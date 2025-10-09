#car_tracker_manager.py
import time
from collections import deque
import numpy as np
# ### แก้ไข ###: Import ฟังก์ชันสำหรับหลายโซน
from utils import is_point_in_any_polygon, get_bbox_center
import json
from datetime import datetime, timedelta
import cv2      # ### เพิ่ม ###: สำหรับการจัดการรูปภาพ (Image Processing)
import base64   # ### เพิ่ม ###: สำหรับการเข้ารหัสรูปภาพเป็น Base64

class CarTrackerManager:
    # ### แก้ไข ###: เปลี่ยนชื่อ parameter จาก parking_zone_polygon เป็น parking_zones
    def __init__(self, parking_zones, parking_time_limit_minutes, movement_threshold_px, movement_frame_window,fps, config):
        # ### แก้ไข ###: เก็บเป็นลิสต์ของโซน
        self.parking_zones = [np.array(zone) for zone in parking_zones]
        
        self.movement_threshold_px = movement_threshold_px
        self.movement_frame_window = movement_frame_window
        self.fps = fps
        self.grace_period_frames_exit = int(config.get('grace_period_frames_exit', 5)) 

        # ### เพิ่ม ###: โหลดค่าสำหรับช่วงเวลายืนยันการจอด
        parking_time_threshold_seconds = config.get('parking_time_threshold_seconds', 3) # Default 3 วินาทีถ้าไม่มีใน config
        self.parking_confirm_frames = int(parking_time_threshold_seconds * self.fps)
        print(f"[Info] Parking confirmation time set to {parking_time_threshold_seconds} seconds ({self.parking_confirm_frames} frames).")

        # ### เพิ่ม ###: โหลดค่าสำหรับป้องกัน ID สลับ (ID Stealing)
        self.id_switch_threshold_px = self.movement_threshold_px * 2.0 
        print(f"[Info] ID Switch teleport threshold set to {self.id_switch_threshold_px:.2f} pixels.")

        # ### เพิ่ม ###: โหลดค่า timeout พิเศษสำหรับรถที่จอดแล้ว
        self.parked_car_timeout_seconds = config.get('parked_car_timeout_seconds', 300) # Default 5 minutes
        print(f"[Info] Timeout for parked cars set to {self.parked_car_timeout_seconds} seconds.")

        # ตรรกะสำหรับโหมดทดสอบ (Debug Mode)
        debug_cfg = config.get('debug_settings', {})
        self.debug_mode_enabled = debug_cfg.get('enabled', False)

        if self.debug_mode_enabled:
            print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
            print("!!!      DEBUG MODE IS ENABLED         !!!")
            print("!!! Using shorter mock time limits.    !!!")
            print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
            mock_violation_minutes = debug_cfg.get('mock_violation_minutes', 1)
            mock_warning_minutes = debug_cfg.get('mock_warning_minutes', 0.5)
            
            self.parking_time_limit_seconds = mock_violation_minutes * 60
            self.warning_time_limit_seconds = mock_warning_minutes * 60
            
            print(f"DEBUG: Violation time set to -> {self.parking_time_limit_seconds} seconds ({mock_violation_minutes} min)")
            print(f"DEBUG: Warning time set to -> {self.warning_time_limit_seconds} seconds ({mock_warning_minutes} min)")
        else:
            self.parking_time_limit_seconds = parking_time_limit_minutes * 60
            # self.warning_time_limit_seconds = warning_time_limit_minutes * 60

        self.tracked_cars = {} 
        self.parking_sessions_count = 0 
        self.parking_statistics = []
        self.api_events_queue = []
        self.active_parking = {}

    def reset(self):
        print("Resetting CarTrackerManager state...")
        self.tracked_cars.clear()
        self.parking_statistics.clear()
        self.api_events_queue.clear()

    def _frame_to_datetime(self, frame_idx, current_frame_datetime=None):
        return datetime.utcnow()

    def update(self, current_tracks, current_frame_idx, resized_frame, original_frame=None):
        # --- helper functions (local) ---
        def euclidean_distance(p1, p2):
            return ((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2) ** 0.5

        def compute_iou(a, b):
            # a, b are [x1,y1,x2,y2]
            xA = max(a[0], b[0]); yA = max(a[1], b[1])
            xB = min(a[2], b[2]); yB = min(a[3], b[3])
            interW = max(0, xB - xA); interH = max(0, yB - yA)
            interArea = interW * interH
            if interArea == 0:
                return 0.0
            boxAArea = max(0, a[2] - a[0]) * max(0, a[3] - a[1])
            boxBArea = max(0, b[2] - b[0]) * max(0, b[3] - b[1])
            denom = float(boxAArea + boxBArea - interArea)
            return interArea / denom if denom > 0 else 0.0

        # --- thresholds (อ่านจาก self ถ้ามี หรือใช้ default) ---
        id_switch_threshold_px = getattr(self, 'id_switch_threshold_px', getattr(self, 'movement_threshold_px', 100) * 2.0)
        reid_iou_threshold = getattr(self, 'reid_iou_threshold', 0.30)          # สำหรับ non-parked re-association
        parked_iou_lock_threshold = getattr(self, 'parked_iou_lock_threshold', 0.40)  # ถ้า parked ต้องมี IoU พอสมควร
        reid_frame_window = getattr(self, 'reid_frame_window', int(self.fps * 2.0))  # ภายในกี่เฟรมให้พิจารณา reid (default 2s)
        stillness_grace_frames = getattr(self, 'stillness_grace_period_frames', getattr(self, 'stillness_grace_period_frames', 15))
        # --- end thresholds ---

        detected_ids_in_frame = {t['id'] for t in current_tracks}
        alerts = []

        # --- 1) อัปเดต tracks ที่มี id เดิม (ปรับ bbox + history) และเก็บ list ของ candidates ใหม่ที่ยังไม่รู้จัก ---
        new_candidates = []  # เก็บ detections ที่ยังไม่ match กับ tracked_cars (จะพยายาม re-associate ต่อ)
        for t in current_tracks:
            tid = t['id']
            bbox = t['bbox']  # assumed [x1,y1,x2,y2]
            cls = t.get('cls', None)
            cx, cy = get_bbox_center(bbox)

            if tid in self.tracked_cars:
                car = self.tracked_cars[tid]
                # update fields (รวม cls)
                car.update(current_bbox=bbox, last_seen_frame_idx=current_frame_idx, cls=cls)
                # append center history safely
                if 'center_history' not in car:
                    car['center_history'] = deque(maxlen=self.movement_frame_window)
                car['center_history'].append((cx, cy, current_frame_idx))
            else:
                # เก็บเป็น candidate เพื่อพยายาม re-associate กับ lost tracks
                new_candidates.append({'temp_id': tid, 'bbox': bbox, 'cls': cls, 'center': (cx, cy)})

        # --- 2) พยายาม re-associate สำหรับทุก candidate (hybrid matching) ---
        # เตรียม lost candidates: tracks ที่มีอยู่ใน memory แต่หายไปไม่เกิน timeout (parked ใช้ longer timeout)
        lost_tracks_pool = {}
        for existing_id, info in self.tracked_cars.items():
            frames_disappeared = current_frame_idx - info.get('last_seen_frame_idx', current_frame_idx)
            seconds_disappeared = frames_disappeared / float(self.fps)
            is_parked = info.get('is_parking', False)
            timeout_seconds = (self.parked_car_timeout_seconds if is_parked else 5.0)
            if seconds_disappeared <= timeout_seconds:
                # ให้พิจารณา re-association เฉพาะ tracks ที่ "หายไปไม่เกิน timeout"
                # เก็บ center ของ track ล่าสุด
                if info.get('center_history'):
                    lost_center = info['center_history'][-1][:2]
                else:
                    lost_bbox = info.get('current_bbox')
                    lost_center = ((lost_bbox[0] + lost_bbox[2]) / 2.0, (lost_bbox[1] + lost_bbox[3]) / 2.0)
                lost_tracks_pool[existing_id] = {
                    'center': lost_center,
                    'bbox': info.get('current_bbox'),
                    'is_parked': is_parked,
                    'last_seen_frame_idx': info.get('last_seen_frame_idx', current_frame_idx)
                }

        # For each new candidate, find best match among lost_tracks_pool using hybrid rule
        for cand in new_candidates:
            best_id = None
            best_score = -1.0
            new_center = cand['center']
            new_bbox = cand['bbox']

            for lost_id, lost_info in lost_tracks_pool.items():
                # if lost_id already matched by another candidate, skip (we'll mark matched below)
                if lost_info.get('matched'):
                    continue

                lost_center = lost_info['center']
                lost_bbox = lost_info['bbox']
                dist = euclidean_distance(new_center, lost_center)
                iou = compute_iou(new_bbox, lost_bbox)

                # If the lost track is parked => require stronger IoU to avoid stealing
                if lost_info['is_parked']:
                    # parked track: prefer iou gate first
                    if iou >= parked_iou_lock_threshold and dist < id_switch_threshold_px:
                        # compute score that favors higher iou and smaller dist
                        score = iou * 2.0 - (dist / max(1.0, id_switch_threshold_px)) * 0.5
                    else:
                        score = -1.0
                else:
                    # non-parked => hybrid: need both reasonable dist and iou
                    if dist < id_switch_threshold_px and iou >= reid_iou_threshold:
                        score = iou - (dist / max(1.0, id_switch_threshold_px)) * 0.2
                    else:
                        score = -1.0

                # prefer highest score
                if score > best_score:
                    best_score = score
                    best_id = lost_id

            # ถ้าพบ best match ให้ re-associate
            if best_id is not None and best_score > 0:
                lost_tracks_pool[best_id]['matched'] = True
                old_id = best_id
                new_temp_id = cand['temp_id']
                print(f"[DEBUG] Re-associating temp ID {new_temp_id} -> old ID {old_id} (score={best_score:.3f})")
                # merge/update existing tracked car info
                car_info = self.tracked_cars[old_id]

                # update bbox/last_seen/cls
                car_info.update(current_bbox=cand['bbox'], last_seen_frame_idx=current_frame_idx, cls=cand['cls'])

                # merge center_history (append new center)
                if 'center_history' not in car_info:
                    car_info['center_history'] = deque(maxlen=self.movement_frame_window)
                car_info['center_history'].append((cand['center'][0], cand['center'][1], current_frame_idx))

                # if the old track was parked, preserve parking_start_time/frame and lock_in flag
                if car_info.get('is_parking'):
                    car_info['lock_in_parking'] = True
                    # reset any frames_outside_zone_count if returned inside
                    car_info['frames_outside_zone_count'] = 0

                # IMPORTANT: ensure our detected set contains old_id, not the new temp id
                detected_ids_in_frame.add(old_id)
                detected_ids_in_frame.discard(new_temp_id)
                # do NOT create a tracked_cars entry for new_temp_id
            else:
                # ไม่พบ match ที่เหมาะสม — ต้องถือเป็น track ใหม่
                new_id = cand['temp_id']
                bbox = cand['bbox']
                cx, cy = cand['center']
                self.tracked_cars[new_id] = {
                    'current_bbox': bbox,
                    'center_history': deque([(cx, cy, current_frame_idx)], maxlen=self.movement_frame_window),
                    'last_seen_frame_idx': current_frame_idx,
                    'is_still': False, 'is_parking': False,
                    'parking_start_frame_idx': None, 'parking_start_time': None,
                    'parking_session_id': None, 'has_left_zone': False,
                    'status': 'NEW_DETECTION', 'cls': cand.get('cls', None),
                    'frames_outside_zone_count': 0,
                    'api_event_sent_parked_start': False,
                    'api_event_sent_violation': False,
                    'still_start_frame_idx': None,
                    'still_moved_grace_frames': 0,
                    'db_record_id': None,
                    'is_violation_final': False,
                    'violation_image_base64': None,
                    'lock_in_parking': False
                }
                print(f"[DEBUG] Created new tracked car ID {new_id} (no re-association)")

        # --- 3) อัปเดตสถานะทั้งหมด (parking logic + remove expired) ---
        ids_to_remove = []
        for track_id, car_info in list(self.tracked_cars.items()):
            # ถ้าไม่มีการตรวจจับในเฟรมนี้
            if track_id not in detected_ids_in_frame:
                frames_disappeared = current_frame_idx - car_info.get('last_seen_frame_idx', current_frame_idx)
                seconds_disappeared = frames_disappeared / float(self.fps)
                is_parked = car_info.get('is_parking', False)
                timeout_seconds = (self.parked_car_timeout_seconds if is_parked else 5.0)

                if seconds_disappeared > timeout_seconds:
                    print(f"[Info] Removing track ID {track_id} (disappeared {seconds_disappeared:.2f}s).")
                    if car_info.get('is_parking'):
                        self._end_parking_session(track_id, current_frame_idx, "ended_disappeared")
                    ids_to_remove.append(track_id)
                else:
                    # ยังไม่ถึง timeout: leave it in memory (useful for re-association)
                    continue

            # ถ้ารถยังอยู่ในเฟรม ให้คำนวณสถานะ
            is_center_in_zone = is_point_in_any_polygon(get_bbox_center(car_info['current_bbox']), self.parking_zones)
            is_still = self._check_stillness(car_info.get('center_history', []))
            car_info['is_still'] = is_still

            # --- ยังไม่ได้เป็น parking ---
            if not car_info.get('is_parking', False):
                if is_center_in_zone and is_still:
                    if car_info.get('still_start_frame_idx') is None:
                        car_info['still_start_frame_idx'] = current_frame_idx
                        car_info['status'] = 'CONFIRMING_PARK'
                    else:
                        frames_still = current_frame_idx - car_info['still_start_frame_idx']
                        if frames_still >= self.parking_confirm_frames:
                            # ยืนยันเป็น PARKED
                            car_info['is_parking'] = True
                            car_info['parking_start_frame_idx'] = car_info['still_start_frame_idx']
                            car_info['parking_start_time'] = datetime.utcnow() - timedelta(seconds=(frames_still / float(self.fps)))
                            self.parking_sessions_count += 1
                            car_info['parking_session_id'] = self.parking_sessions_count
                            car_info['has_left_zone'] = False
                            car_info['status'] = 'PARKED'
                            car_info['lock_in_parking'] = True
                            car_info['still_moved_grace_frames'] = 0
                            print(f"[{current_frame_idx}] Car ID {track_id} CONFIRMED PARKED.")
                
                else:
                    car_info['still_start_frame_idx'] = None
                    car_info['status'] = 'MOVING_IN_ZONE' if is_center_in_zone else 'OUT_OF_ZONE'

            # --- ถ้าเป็น parking อยู่แล้ว (lock-in logic) ---
            else:
                # ถ้าหลุดโซนชัดเจน
                if not is_center_in_zone:
                    car_info['frames_outside_zone_count'] = car_info.get('frames_outside_zone_count', 0) + 1
                    if car_info['frames_outside_zone_count'] >= getattr(self, 'grace_period_frames_exit', 5):
                        self._end_parking_session(track_id, current_frame_idx, "ended_left_zone")
                else:
                    car_info['frames_outside_zone_count'] = 0
                    # ถ้ามีการเคลื่อน (not still)
                    if not is_still:
                        # ถ้าถูก lock_in_parking ไว้ ให้ให้โอกาส (stillness grace) ก่อนจะ end session
                        if car_info.get('lock_in_parking', False):
                            car_info['still_moved_grace_frames'] = car_info.get('still_moved_grace_frames', 0) + 1
                            if car_info['still_moved_grace_frames'] >= stillness_grace_frames:
                                print(f"[Info] Parked Car ID {track_id} moved too long -> ending session.")
                                self._end_parking_session(track_id, current_frame_idx, "ended_moved_after_grace")
                        else:
                            # ถ้ายังไม่ได้ lock-in (เพิ่ง confirm) -> เร็ว ๆ นี้ให้จบเลย
                            print(f"[Info] Car ID {track_id} moved while parking (not lock-in) -> ending session.")
                            self._end_parking_session(track_id, current_frame_idx, "ended_moved")
                    else:
                        # still ยังคงเป็น parked -> reset grace counter
                        car_info['still_moved_grace_frames'] = 0
                        # ตรวจ violation
                        if car_info.get('parking_start_frame_idx') is not None:
                            parking_duration_frames = current_frame_idx - car_info['parking_start_frame_idx']
                            parking_duration_s = parking_duration_frames / float(self.fps)
                            if parking_duration_s > self.parking_time_limit_seconds:
                                if car_info.get('status') != 'VIOLATION':
                                    car_info['status'] = 'VIOLATION'
                                    alerts.append(f"VIOLATION: Car ID {track_id} parked over {self.parking_time_limit_seconds/60.0:.2f} minutes")
                                    car_info['is_violation_final'] = True
                                    car_info['api_event_sent_violation'] = True
                                    
                                    # --- NEW: capture & upload image ---
                                    if original_frame is not None:
                                        x1, y1, x2, y2 = map(int, car_info['current_bbox'])
                                        try:
                                            # scale back if bbox likely in resized_frame coordinates
                                            if resized_frame is not None:
                                                res_h, res_w = resized_frame.shape[:2]
                                                orig_h, orig_w = original_frame.shape[:2]
                                                if x2 <= res_w and y2 <= res_h:
                                                    scale_x = orig_w / float(res_w)
                                                    scale_y = orig_h / float(res_h)
                                                    x1_o = int(max(0, min(orig_w - 1, int(x1 * scale_x))))
                                                    x2_o = int(max(0, min(orig_w, int(x2 * scale_x))))
                                                    y1_o = int(max(0, min(orig_h - 1, int(y1 * scale_y))))
                                                    y2_o = int(max(0, min(orig_h, int(y2 * scale_y))))
                                                else:
                                                    x1_o, y1_o, x2_o, y2_o = x1, y1, x2, y2
                                            else:
                                                x1_o, y1_o, x2_o, y2_o = x1, y1, x2, y2

                                            # clamp and min-size guard
                                            orig_h, orig_w = original_frame.shape[:2]
                                            x1_o = max(0, min(orig_w - 1, x1_o)); x2_o = max(0, min(orig_w, x2_o))
                                            y1_o = max(0, min(orig_h - 1, y1_o)); y2_o = max(0, min(orig_h, y2_o))
                                            min_w, min_h = 20, 20

                                            if x2_o > x1_o and y2_o > y1_o and (x2_o - x1_o) >= min_w and (y2_o - y1_o) >= min_h:
                                                cropped_car = original_frame[y1_o:y2_o, x1_o:x2_o]
                                                success, buffer = cv2.imencode('.jpg', cropped_car, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
                                                if success:
                                                    image_bytes = buffer.tobytes()
                                                    entry_time = car_info.get('parking_start_time', datetime.utcnow())
                                                    parking_duration_min = (datetime.utcnow() - entry_time).total_seconds() / 60.0

                                                    # สร้าง event แบบที่ camera_worker คาดหวัง (สร้าง record)
                                                    self.api_events_queue.append({
                                                        'event_type': 'parking_violation_started',   # 'create' event name camera_worker checks
                                                        'car_id': track_id,
                                                        'entry_time': entry_time,
                                                        'exit_time': None,
                                                        'duration_minutes': round(parking_duration_min, 2),
                                                        'is_violation': True,
                                                        'image_bytes': image_bytes,
                                                        'image_mime': 'image/jpeg',
                                                        'image_filename': f"car_violation_{track_id}_{current_frame_idx}.jpg"
                                                    })
                                                    print(f"[Enqueue] Violation START event for Car ID {track_id}")
                                                else:
                                                    print(f"[Error] imencode failed for Car ID {track_id}")
                                            else:
                                                print(f"[Warning] Cropped ROI too small/invalid for Car ID {track_id}")
                                        except Exception as e:
                                            print(f"[ERROR] Capturing scaled crop failed for car ID {track_id}: {e}")


        # --- 4) cleanup: remove expired tracks from memory ---
        for tid in ids_to_remove:
            if tid in self.tracked_cars:
                del self.tracked_cars[tid]

        return alerts

    def _check_stillness(self, center_history):
        if len(center_history) < self.movement_frame_window:
            return False
        # ดึงเฉพาะพิกัด (x, y)
        centers = np.array([p[:2] for p in center_history])
        # หาค่าเฉลี่ยของจุดทั้งหมด
        mean_center = centers.mean(axis=0)
        # วัดระยะห่างสูงสุดจาก mean
        max_dist = np.max(np.linalg.norm(centers - mean_center, axis=1))
        # ถ้าการแกว่งไม่เกิน threshold → ถือว่าหยุดนิ่ง
        return max_dist < self.movement_threshold_px

    def find_closest_lost_track_id(self, new_bbox_center, lost_tracks_info):
        """ค้นหา ID รถที่หายไปล่าสุดซึ่งอยู่ใกล้กับตำแหน่งของรถที่ตรวจจับได้ใหม่"""
        closest_id = None
        min_distance_sq = float('inf')
        
        for track_id, track_info in lost_tracks_info.items():
            lost_center = track_info['current_bbox_center']
            dist_sq = (new_bbox_center[0] - lost_center[0])**2 + (new_bbox_center[1] - lost_center[1])**2
            
            # ใช้ค่า id_switch_threshold_px ที่มีอยู่แล้ว
            if dist_sq < min_distance_sq and dist_sq < (self.id_switch_threshold_px)**2:
                min_distance_sq = dist_sq
                closest_id = track_id
                
        return closest_id
    
    def get_parking_count(self):
        return self.parking_sessions_count

    def get_current_parking_cars(self):
        parking_statuses = ['PARKED','VIOLATION']
        return [id for id, info in self.tracked_cars.items() if info.get('is_parking') and info.get('status') in parking_statuses]
    
    def get_parking_statistics(self):
        return self.parking_statistics

    def get_car_status(self, track_id, current_frame_idx):
        car_info = self.tracked_cars.get(track_id)
        if not car_info: return {'status': 'OUT_OF_SCENE', 'time_parked_str': ''}
        status = car_info.get('status', 'UNKNOWN')
        time_parked_str = ""
        if car_info.get('is_parking') and car_info.get('parking_start_frame_idx') is not None:
            parking_duration_s = (current_frame_idx - car_info['parking_start_frame_idx']) / self.fps
            minutes, seconds = divmod(int(parking_duration_s), 60)
            time_parked_str = f"{minutes:02d}m {seconds:02d}s"
        return {'status': status, 'time_parked_str': time_parked_str}

    def save_all_parking_sessions(self, output_dir, final_frame_idx):
        if output_dir:
            output_file_path = output_dir / "parking_sessions_summary.json"
        else:
            print("Warning: output_dir is None. Cannot save parking sessions to file.")
            return
        
        for track_id, car_info in list(self.tracked_cars.items()):
            if car_info['is_parking']:
                parking_duration_frames = final_frame_idx - car_info['parking_start_frame_idx']
                parking_duration_s = parking_duration_frames / self.fps
                
                status_on_shutdown = car_info['status'] 
                if parking_duration_s > self.parking_time_limit_seconds:
                    status_on_shutdown = 'VIOLATION_SHUTDOWN'
                elif parking_duration_s > self.warning_time_limit_seconds:
                    status_on_shutdown = 'WARNING_SHUTDOWN'
                else:
                    status_on_shutdown = 'PARKED_SHUTDOWN'

                self.parking_statistics.append({
                    'session_id': car_info['parking_session_id'],
                    'car_id': track_id,
                    'start_frame': car_info['parking_start_frame_idx'],
                    'end_frame': final_frame_idx,
                    'duration_frames': parking_duration_frames,
                    'duration_s': parking_duration_s,
                    'duration_min': parking_duration_s / 60.0,
                    'final_status': status_on_shutdown
                })
                print(f"[Parking Ended - App Shutdown] Car ID {track_id}, Session ID {car_info['parking_session_id']}: Parked for {parking_duration_s:.2f} seconds.")
                
                current_parked_count = len([c_id for c_id, c in self.tracked_cars.items() if c_id != track_id and c['is_parking'] and c['status'] in ['PARKED', 'WARNING_PARKED', 'VIOLATION']])
                
                self.api_events_queue.append({
                    'event_type': 'parking_ended_shutdown',
                    'car_id': track_id,
                    'current_park': current_parked_count,
                    'total_parking_sessions': self.parking_sessions_count,
                    'entry_time': car_info['parking_start_time'],
                    'exit_time': datetime.utcnow(),
                    'duration_minutes': round(parking_duration_s / 60.0, 2),
                    'is_violation': (parking_duration_s > self.parking_time_limit_seconds)
                })

        try:
            with open(output_file_path, 'w', encoding='utf-8') as f:
                json.dump(self.parking_statistics, f, indent=4, default=str)
            print(f"All parking sessions saved to {output_file_path}")
        except Exception as e:
            print(f"Error saving parking statistics: {e}")

    def get_final_parking_statistics(self, total_frames):
        all_sessions_for_summary = list(self.parking_statistics) 

        for track_id, car_info in list(self.tracked_cars.items()):
            if car_info['is_parking']:
                parking_duration_frames = total_frames - car_info['parking_start_frame_idx']
                parking_duration_s = parking_duration_frames / self.fps
                
                status_on_summary = car_info['status'] 
                if parking_duration_s > self.parking_time_limit_seconds:
                    status_on_summary = 'VIOLATION_ACTIVE'
                elif parking_duration_s > self.warning_time_limit_seconds:
                    status_on_summary = 'WARNING_ACTIVE'
                else:
                    status_on_summary = 'PARKED_ACTIVE'

                all_sessions_for_summary.append({
                    'session_id': car_info['parking_session_id'],
                    'car_id': track_id,
                    'start_frame': car_info['parking_start_frame_idx'],
                    'end_frame': total_frames,
                    'duration_frames': parking_duration_frames,
                    'duration_s': parking_duration_s,
                    'duration_min': parking_duration_s / 60.0,
                    'final_status': status_on_summary 
                })

        total_sessions = len(all_sessions_for_summary)
        total_duration_s = sum(s['duration_s'] for s in all_sessions_for_summary)
        avg_duration_s = total_duration_s / total_sessions if total_sessions > 0 else 0

        summary_stats = {
            "total_parking_sessions_recorded": total_sessions,
            "average_parking_duration_minutes": avg_duration_s / 60.0,
            "all_sessions_details": all_sessions_for_summary 
        }
        return summary_stats
    
    def set_db_record_id(self, track_id: int, db_id: int):
        """
        Stores the database record ID for a tracked car after its initial violation event is saved.
        """
        if track_id in self.tracked_cars:
            self.tracked_cars[track_id]['db_record_id'] = db_id
            print(f"[Info] Stored DB Record ID {db_id} for Car ID {track_id}.")
    def _end_parking_session(self, track_id, current_frame_idx, reason: str):
        car_info = self.tracked_cars[track_id]
        parking_duration_frames = current_frame_idx - car_info['parking_start_frame_idx']
        parking_duration_s = parking_duration_frames / self.fps
        parking_duration_min = parking_duration_s / 60.0

        if car_info.get('db_record_id') is not None:
            self.api_events_queue.append({
                'event_type': 'parking_violation_ended',
                'db_record_id': car_info['db_record_id'],
                'exit_time': datetime.utcnow(),
                'duration_minutes': round(parking_duration_min, 2)
            })
            print(f"[{reason}] Car ID {track_id} (DB ID: {car_info['db_record_id']}) session ended.")
        else:
            # คำนวณค่าที่ขาดไป
            current_parked_count = len([
                c_id for c_id, c_info in self.tracked_cars.items() 
                if c_id != track_id and c_info.get('is_parking')
            ])
            
            self.api_events_queue.append({
                'event_type': 'parking_session_completed',
                'car_id': track_id,
                'entry_time': car_info['parking_start_time'],
                'exit_time': datetime.utcnow(),
                'duration_minutes': round(parking_duration_min, 2),
                'is_violation': car_info.get('is_violation_final', False),
                'image_base64': car_info.get('violation_image_base64', None),
                # 🔽 เพิ่ม 2 บรรทัดนี้เพื่อให้โครงสร้างเหมือนกัน 🔽
                'current_park': current_parked_count,
                'total_parking_sessions': self.parking_sessions_count 
            })
            print(f"[{reason}] Car ID {track_id} (Normal) session ended.")

        car_info.update(is_parking=False, parking_start_frame_idx=None, parking_start_time=None,
                        parking_session_id=None, has_left_zone=True, status='OUT_OF_ZONE',
                        frames_outside_zone_count=0, still_start_frame_idx=None)

    # <<< เพิ่ม: เมธอดใหม่สำหรับปิดท้ายทุก session ที่ยังแอคทีฟอยู่
    def finalize_all_sessions(self, final_frame_idx):
        """
        Called at the end of a video file to close out any remaining active parking sessions.
        """
        print(f"[Info] Finalizing all active parking sessions at frame {final_frame_idx}...")
        active_car_ids = list(self.tracked_cars.keys())

        for track_id in active_car_ids:
            car_info = self.tracked_cars.get(track_id)
            if car_info and car_info.get('is_parking'):
                parking_duration_frames = final_frame_idx - car_info['parking_start_frame_idx']
                parking_duration_s = parking_duration_frames / self.fps
                parking_duration_min = parking_duration_s / 60.0
                
                if car_info.get('db_record_id') is not None:
                    self.api_events_queue.append({
                        'event_type': 'parking_violation_ended',
                        'db_record_id': car_info['db_record_id'],
                        'exit_time': datetime.utcnow(),
                        'duration_minutes': round(parking_duration_min, 2)
                    })
                    print(f"[Violation Ended - Shutdown] Car ID {track_id} (DB ID: {car_info['db_record_id']}).")
                else:
                    # คำนวณค่าที่ขาดไป
                    current_parked_count = len([
                        c_id for c_id, c_info in self.tracked_cars.items() 
                        if c_id != track_id and c_info.get('is_parking')
                    ])
                    
                    self.api_events_queue.append({
                        'event_type': 'parking_session_completed',
                        'car_id': track_id,
                        'entry_time': car_info['parking_start_time'],
                        'exit_time': datetime.utcnow(),
                        'duration_minutes': round(parking_duration_min, 2),
                        'is_violation': car_info.get('is_violation_final', False),
                        'image_base64': car_info.get('violation_image_base64', None),
                        'current_park': current_parked_count,
                        'total_parking_sessions': self.parking_sessions_count 
    })
        # ล้างข้อมูลรถที่ติดตามทั้งหมดหลังประมวลผลเสร็จ
        self.tracked_cars.clear()

    def get_parking_events_for_api(self):
        events = list(self.api_events_queue)
        self.api_events_queue.clear()
        return events