# evaluate_from_mot.py
import argparse
import yaml
import json
from pathlib import Path
from collections import defaultdict
import numpy as np
import math
import sys

# พาธไปยังโมดูลของคุณ (ปรับถ้าจำเป็น)
from car_tracker_manager import CarTrackerManager

# ถ้าในโปรเจคมี utils.get_bbox_center ให้ใช้ ถ้าไม่มี ให้นิยาม fallback
try:
    from utils import get_bbox_center
except Exception:
    def get_bbox_center(bbox):
        # bbox: [x1,y1,x2,y2]
        x1, y1, x2, y2 = bbox
        return ((x1 + x2) / 2.0, (y1 + y2) / 2.0)

def load_config(config_path: Path):
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def resolve_parking_zone_file_path(parking_zone_filename: str, config_path: Path) -> Path:
    p = Path(parking_zone_filename)
    if p.is_absolute():
        return p
    base_project_dir = config_path.parent
    ai_folder_path = base_project_dir / "AI"
    return ai_folder_path / parking_zone_filename

def load_roi_zones(parking_zone_file_path: Path):
    if not parking_zone_file_path.exists():
        raise FileNotFoundError(f"ROI file not found: {parking_zone_file_path}")
    import json
    with open(parking_zone_file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    # หากไฟล์เป็น list ของ polygons
    if isinstance(data, list):
        return data
    # หากไฟล์เป็น object ที่มี roi_sets
    if isinstance(data, dict) and "roi_sets" in data:
        return [rs["points"] for rs in data["roi_sets"]]
    # หากเก็บชื่ออื่น ๆ ให้พยายามค้นหา keys ที่ดูเหมือน points
    if isinstance(data, dict):
        if "roi_points" in data:
            return [data["roi_points"]]
    return []

def parse_mot_file(mot_path: Path):
    """
    รองรับรูปแบบพื้นฐานของ mot.txt:
      frame, id, x, y, w, h, [conf, ...]
    คืนค่า detections_by_frame: {frame_idx: [ {'id': str, 'bbox':[x1,y1,x2,y2], 'conf': float (opt), 'cls': int (opt)} ] }
    """
    detections_by_frame = defaultdict(list)
    with mot_path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            # แยกด้วย comma หรือ space
            if "," in line:
                parts = [p.strip() for p in line.split(",") if p.strip() != ""]
            else:
                parts = [p.strip() for p in line.split() if p.strip() != ""]
            # ต้องมี อย่างน้อย 6 field: frame,id,x,y,w,h
            if len(parts) < 6:
                # ข้ามบรรทัดที่ไม่ตรงรูปแบบ
                print(f"[warn] skipping mot line (not enough columns): {line}")
                continue
            try:
                frame_idx = int(float(parts[0]))
                track_id = str(parts[1])
                x = float(parts[2])
                y = float(parts[3])
                w = float(parts[4])
                h = float(parts[5])
                x1 = x
                y1 = y
                x2 = x + w
                y2 = y + h
                entry = {'id': track_id, 'bbox': [x1, y1, x2, y2]}
                # optional fields
                if len(parts) >= 7:
                    try:
                        conf = float(parts[6])
                        entry['conf'] = conf
                    except:
                        pass
                if len(parts) >= 8:
                    try:
                        cls = int(float(parts[7]))
                        entry['cls'] = cls
                    except:
                        pass
                detections_by_frame[frame_idx].append(entry)
            except Exception as e:
                print(f"[warn] failed parse line: {line} -> {e}")
                continue
    return detections_by_frame

def evaluate_camera_from_mot(config_path: Path, camera_name: str, mot_path: Path, fps: int = 25):
    cfg = load_config(config_path)
    # หา camera config จาก name (หรือ index ถ้าต้องการ)
    camera_cfg = None
    for src in cfg.get("video_sources", []):
        if src.get("name") == camera_name:
            camera_cfg = src
            break
    if camera_cfg is None:
        raise ValueError(f"Camera named '{camera_name}' not found in config.yaml")

    # โหลด ROI zones โดย resolve path ให้เหมาะสม
    parking_zone_filename = camera_cfg.get("parking_zone_file", "")
    if not parking_zone_filename:
        raise ValueError("camera config has no parking_zone_file set")
    parking_zone_path = resolve_parking_zone_file_path(parking_zone_filename, config_path)
    zones = load_roi_zones(parking_zone_path)

    # เตรียม CarTrackerManager ด้วยค่า config ที่เอามาจากไฟล์ config.yaml
    parking_time_limit_minutes = cfg.get("parking_time_limit_minutes", 15)
    movement_threshold_px = cfg.get("movement_threshold_px", 80)
    movement_frame_window = cfg.get("movement_frame_window", 120)

    manager = CarTrackerManager(
        parking_zones=zones,
        parking_time_limit_minutes=parking_time_limit_minutes,
        movement_threshold_px=movement_threshold_px,
        movement_frame_window=movement_frame_window,
        fps=fps,
        config=cfg
    )

    # โหลด mot file -> detections_by_frame
    detections_by_frame = parse_mot_file(mot_path)
    if not detections_by_frame:
        print("[error] No detections found in mot file.")
        return

    # เก็บสถิติเพื่อการประเมินแบบง่าย
    from collections import defaultdict
    track_frame_counts = defaultdict(int)
    track_first_frame = {}
    track_last_frame = {}
    track_centers = defaultdict(list)

    frame_indices = sorted(detections_by_frame.keys())
    for frame_idx in frame_indices:
        cur_dets = detections_by_frame[frame_idx]
        cur_tracks = []
        for d in cur_dets:
            tid = d['id']
            bbox = d['bbox']
            cls = d.get('cls', None)
            cur_tracks.append({'id': tid, 'bbox': bbox, 'cls': cls})

            track_frame_counts[tid] += 1
            if tid not in track_first_frame:
                track_first_frame[tid] = frame_idx
            track_last_frame[tid] = frame_idx
            cx, cy = get_bbox_center(bbox)
            track_centers[tid].append((cx, cy))

        # เรียก update ของ manager
        manager.update(cur_tracks, current_frame_idx=frame_idx, resized_frame=None, original_frame=None)

    # finalize sessions เมื่อสิ้นสุดวิดีโอ
    manager.finalize_all_sessions(final_frame_idx=frame_indices[-1])

    # คำนวณ metrics
    lifetimes = []
    center_std_x = []
    center_std_y = []
    detection_rates = []

    for tid, count in track_frame_counts.items():
        first = track_first_frame.get(tid, 0)
        last = track_last_frame.get(tid, first)
        lifetime_frames = last - first + 1
        lifetimes.append(lifetime_frames)

        centers = np.array(track_centers[tid])
        if centers.shape[0] >= 2:
            stdx = float(np.std(centers[:,0]))
            stdy = float(np.std(centers[:,1]))
        else:
            stdx = 0.0
            stdy = 0.0
        center_std_x.append(stdx)
        center_std_y.append(stdy)

        detection_rate = count / lifetime_frames if lifetime_frames > 0 else 0.0
        detection_rates.append(detection_rate)

    def safe_mean(x): return float(np.mean(x)) if x else 0.0

    metrics = {
        "num_tracks": len(track_frame_counts),
        "avg_lifetime_frames": safe_mean(lifetimes),
        "avg_lifetime_seconds": safe_mean(lifetimes) / float(fps),
        "avg_detection_rate": safe_mean(detection_rates),
        "avg_bbox_std_cx": safe_mean(center_std_x),
        "avg_bbox_std_cy": safe_mean(center_std_y),
        "parking_sessions_count": manager.get_parking_count(),
        "parking_statistics_count": len(manager.get_parking_statistics()),
    }

    # คำนวณ recommended heuristic แบบง่าย
    recommended_movement_threshold_px = max(10, round(metrics["avg_bbox_std_cx"] * 7.0, 1))
    avg_det = metrics["avg_detection_rate"]
    rec_conf = 0.45
    if avg_det > 0.95:
        rec_conf = 0.55
    elif avg_det > 0.9:
        rec_conf = 0.5
    elif avg_det < 0.85:
        rec_conf = 0.4
    rec_conf = round(rec_conf, 2)

    parking_stats = manager.get_parking_statistics()
    if parking_stats:
        dur_seconds = [s.get('duration_s', 0) for s in parking_stats if s.get('duration_s')]
        if dur_seconds:
            median_dur = float(np.median(dur_seconds))
            recommended_parking_time_threshold_seconds = max(5, round(median_dur * 0.8))
        else:
            recommended_parking_time_threshold_seconds = cfg.get("parking_time_threshold_seconds", 30)
    else:
        recommended_parking_time_threshold_seconds = cfg.get("parking_time_threshold_seconds", 30)

    recommended = {
        "detection_conf_threshold": rec_conf,
        "parking_time_threshold_seconds": recommended_parking_time_threshold_seconds,
        "movement_threshold_px": recommended_movement_threshold_px
    }

    print("=== Metrics ===")
    print(json.dumps(metrics, indent=2))
    print("=== Recommended ===")
    print(json.dumps(recommended, indent=2))
    return {"metrics": metrics, "recommended": recommended, "manager": manager}

def main():
    parser = argparse.ArgumentParser(description="Evaluate AI performance from MOT file using CarTrackerManager")
    parser.add_argument("--config", "-c", required=True, help="Path to config.yaml")
    parser.add_argument("--camera", required=True, help="Camera name in config (e.g. camera_1)")
    parser.add_argument("--mot", required=True, help="Path to mot.txt file (frame,id,x,y,w,h,...)")
    parser.add_argument("--fps", type=int, default=25, help="FPS used for evaluation (default 25)")
    args = parser.parse_args()

    config_path = Path(args.config)
    mot_path = Path(args.mot)
    if not config_path.exists():
        print("[error] config.yaml not found:", config_path); sys.exit(1)
    if not mot_path.exists():
        print("[error] mot.txt not found:", mot_path); sys.exit(1)

    evaluate_camera_from_mot(config_path, args.camera, mot_path, fps=args.fps)

if __name__ == "__main__":
    main()
