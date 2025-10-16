# car_tracker_manager_patch.py
import time
from collections import deque
import numpy as np
from utils import is_point_in_any_polygon, get_bbox_center
import json
from datetime import datetime, timedelta
import cv2
import base64

class CarTrackerManager:
    def __init__(self, parking_zones, parking_time_limit_minutes, movement_threshold_px, movement_frame_window, fps, config):
        self.parking_zones = [np.array(zone) for zone in parking_zones]
        self.movement_threshold_px = movement_threshold_px
        self.movement_frame_window = movement_frame_window
        self.fps = fps
        self.grace_period_frames_exit = int(config.get('grace_period_frames_exit', 5))
        parking_time_threshold_seconds = config.get('parking_time_threshold_seconds', 3)
        self.parking_confirm_frames = int(parking_time_threshold_seconds * self.fps)
        self.id_switch_threshold_px = self.movement_threshold_px * 2.0
        self.parked_car_timeout_seconds = config.get('parked_car_timeout_seconds', 300)
        self.debug_mode_enabled = config.get('debug_settings', {}).get('enabled', False)
        
        if self.debug_mode_enabled:
            mock_violation_minutes = config.get('debug_settings', {}).get('mock_violation_minutes', 1)
            mock_warning_minutes = config.get('debug_settings', {}).get('mock_warning_minutes', 0.5)
            self.parking_time_limit_seconds = mock_violation_minutes * 60
            self.warning_time_limit_seconds = mock_warning_minutes * 60
        else:
            self.parking_time_limit_seconds = parking_time_limit_minutes * 60
        
        self.tracked_cars = {}
        self.parking_sessions_count = 0
        self.parking_statistics = []
        self.api_events_queue = []

    def reset(self):
        print("Resetting CarTrackerManager state...")
        self.tracked_cars.clear()
        self.parking_statistics.clear()
        self.api_events_queue.clear()

        

    def update(self, current_tracks, current_frame_idx, resized_frame, original_frame=None):
        detected_ids_in_frame = {t['id'] for t in current_tracks}
        alerts = []

        for track_data in current_tracks:
            track_id = track_data['id']
            bbox = track_data['bbox']
            cls = track_data['cls']
            if cls == 7:  # truck -> car
                cls = 2
            bbox_center_x, bbox_center_y = get_bbox_center(bbox)

            # --- CREATE tracked car if new ---
            if track_id not in self.tracked_cars:
                self.tracked_cars[track_id] = {
                    'current_bbox': bbox,
                    'center_history': deque([(bbox_center_x, bbox_center_y, current_frame_idx)], maxlen=self.movement_frame_window),
                    'last_seen_frame_idx': current_frame_idx,
                    'is_still': False,
                    'is_parking': False,
                    'parking_start_frame_idx': None,
                    'parking_start_time': None,
                    'parking_session_id': None,
                    'has_left_zone': False,
                    'status': 'NEW_DETECTION',
                    'cls': cls,
                    'frames_outside_zone_count': 0,
                    'api_event_sent_parked_start': False,
                    'api_event_sent_violation': False,
                    'still_start_frame_idx': None,
                    'db_record_id': None,
                    'is_violation_final': False,
                    'violation_image_base64': None
                }
                print(f"[DEBUG] Created new tracked car ID {track_id}, cls={cls}")

            car_info = self.tracked_cars[track_id]

            # --- CHECK ID switch only for parked cars ---
            if car_info['status'] in ['PARKED', 'WARNING_PARKED', 'VIOLATION']:
                last_center = get_bbox_center(car_info['current_bbox'])
                distance_moved = np.linalg.norm(np.array(last_center) - np.array([bbox_center_x, bbox_center_y]))
                if distance_moved > self.id_switch_threshold_px:
                    print(f"WARNING: Potential ID switch for parked Car ID {track_id}. Dist: {distance_moved:.2f}px. Ignoring update.")
                    continue

            car_info.update(current_bbox=bbox, last_seen_frame_idx=current_frame_idx)
            car_info['center_history'].append((bbox_center_x, bbox_center_y, current_frame_idx))
            car_info['is_still'] = self._check_stillness(car_info['center_history'])

            is_center_in_parking_zone = is_point_in_any_polygon((bbox_center_x, bbox_center_y), self.parking_zones)

            # --- PARKING LOGIC ---
            if not car_info['is_parking']:
                if is_center_in_parking_zone:
                    if car_info['is_still']:
                        if car_info['still_start_frame_idx'] is None:
                            car_info['still_start_frame_idx'] = current_frame_idx
                            car_info['status'] = 'CONFIRMING_PARK'
                        else:
                            frames_still = current_frame_idx - car_info['still_start_frame_idx']
                            if frames_still >= self.parking_confirm_frames:
                                car_info['is_parking'] = True
                                car_info['parking_start_frame_idx'] = car_info['still_start_frame_idx']
                                car_info['parking_start_time'] = datetime.utcnow() - timedelta(seconds=(frames_still / self.fps))
                                self.parking_sessions_count += 1
                                car_info['parking_session_id'] = self.parking_sessions_count
                                car_info['status'] = 'PARKED'
                                print(f"[{current_frame_idx}] Car ID {track_id} CONFIRMED parking.")
                    else:
                        car_info['still_start_frame_idx'] = None
                        car_info['status'] = 'MOVING_IN_ZONE'
                else:
                    car_info['still_start_frame_idx'] = None
                    car_info['status'] = 'OUT_OF_ZONE'
            else:
                # --- CAR ALREADY PARKED ---
                if not is_center_in_parking_zone:
                    car_info['frames_outside_zone_count'] += 1
                    if car_info['frames_outside_zone_count'] >= self.grace_period_frames_exit:
                        self._end_parking_session(track_id, current_frame_idx, "left_zone")
                    else:
                        car_info['status'] = 'OUT_OF_ZONE_GRACE_PERIOD'
                else:
                    car_info['frames_outside_zone_count'] = 0
                    if not car_info['is_still']:
                        if car_info['status'] != 'VIOLATION':
                            print(f"[Info] Parked Car ID {track_id} moved within zone. Resetting stillness.")
                            car_info['is_parking'] = False
                            car_info['still_start_frame_idx'] = None
                            car_info['status'] = 'MOVING_IN_ZONE'
                    else:
                        # --- VIOLATION CHECK ---
                        parking_duration_frames = current_frame_idx - car_info['parking_start_frame_idx']
                        parking_duration_s = parking_duration_frames / self.fps
                        if parking_duration_s > self.parking_time_limit_seconds and not car_info['api_event_sent_violation']:
                            car_info['status'] = 'VIOLATION'
                            alerts.append(f"VIOLATION: Car ID {track_id} parked over {self.parking_time_limit_seconds/60:.2f} min.")
                            car_info['is_violation_final'] = True
                            # Capture high-res image if possible
                            image_base64 = None
                            try:
                                if original_frame is not None:
                                    x1_s, y1_s, x2_s, y2_s = map(int, car_info['current_bbox'])
                                    scale_x = original_frame.shape[1] / resized_frame.shape[1]
                                    scale_y = original_frame.shape[0] / resized_frame.shape[0]
                                    x1_o, y1_o, x2_o, y2_o = int(x1_s*scale_x), int(y1_s*scale_y), int(x2_s*scale_x), int(y2_s*scale_y)
                                    if x2_o > x1_o and y2_o > y1_o:
                                        crop = original_frame[y1_o:y2_o, x1_o:x2_o]
                                        _, buf = cv2.imencode('.jpg', crop)
                                        image_bytes = buf.tobytes()
                                        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
                                        car_info['violation_image_base64'] = image_base64
                            except Exception as e:
                                print(f"ERROR: Cannot capture high-res image for Car ID {track_id}: {e}")
                            car_info['api_event_sent_violation'] = True

        # --- REMOVE MISSING TRACKS ---
        ids_to_remove = []
        for track_id, car_info in list(self.tracked_cars.items()):
            if track_id not in detected_ids_in_frame:
                frames_disappeared = current_frame_idx - car_info['last_seen_frame_idx']
                timeout = self.parked_car_timeout_seconds if car_info.get('is_parking') else 5.0
                if frames_disappeared / self.fps > timeout:
                    if car_info.get('is_parking'):
                        self._end_parking_session(track_id, current_frame_idx, "disappeared")
                    ids_to_remove.append(track_id)
        for track_id in ids_to_remove:
            del self.tracked_cars[track_id]

        return alerts

    def _check_stillness(self, center_history):
        if len(center_history) < self.movement_frame_window:
            return False
        centers = np.array([p[:2] for p in center_history])
        return np.max(np.linalg.norm(centers - centers.mean(axis=0), axis=1)) < self.movement_threshold_px

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
        if car_info.get('db_record_id') is not None:
            self.api_events_queue.append({
                'event_type': 'parking_violation_ended',
                'db_record_id': car_info['db_record_id'],
                'exit_time': datetime.utcnow(),
                'duration_minutes': round(parking_duration_s/60,2)
            })
        else:
            current_parked_count = len([c for c in self.tracked_cars.values() if c.get('is_parking')])
            self.api_events_queue.append({
                'event_type': 'parking_session_completed',
                'car_id': track_id,
                'entry_time': car_info['parking_start_time'],
                'exit_time': datetime.utcnow(),
                'duration_minutes': round(parking_duration_s/60,2),
                'is_violation': car_info.get('is_violation_final', False),
                'image_base64': car_info.get('violation_image_base64'),
                'current_park': current_parked_count,
                'total_parking_sessions': self.parking_sessions_count
            })
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
    # --- Other methods (get_parking_count, get_current_parking_cars, etc.) remain unchanged ---
