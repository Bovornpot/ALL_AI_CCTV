import pandas as pd
import numpy as np
from pathlib import Path

# --- ตั้งค่า MOT results ของแต่ละกล้อง ---
mot_files = {
    # "camera_1": Path(r"C:\Users\USER\OneDrive\เอกสาร\CarParkingMonitor\AI\runs\car_parking_monitor_multi_cam\camera_1\mot_results\mot.txt"),
    "camera_2": Path(r"C:\Users\USER\OneDrive\เอกสาร\CarParkingMonitor\AI\runs\car_parking_monitor_multi_cam\camera_25\mot_results\mot.txt"),
}
# --- ฟังก์ชันวิเคราะห์ MOT result ของกล้องเดียว ---
def analyze_camera(mot_file: Path):
    df = pd.read_csv(
    mot_file, 
    names=['frame','id','x','y','w','h','conf','_','__','___']
) 
    # Track lifetime
    track_lifetimes = df.groupby('id')['frame'].agg(['min','max'])
    track_lifetimes['lifetime'] = track_lifetimes['max'] - track_lifetimes['min'] + 1
    
    # Short tracks (proxy ID switch)
    short_tracks = track_lifetimes[track_lifetimes['lifetime'] < 10]
    
    # Detection rate per track
    detection_rate = df.groupby('id').size() / track_lifetimes['lifetime']
    
    # Bounding box stability
    def bbox_center_std(track_df):
        cx = track_df['x'] + track_df['w']/2
        cy = track_df['y'] + track_df['h']/2
        return np.std(cx), np.std(cy)
    
    bbox_stability = df.groupby('id').apply(bbox_center_std)
    cx_std = np.mean([v[0] for v in bbox_stability])
    cy_std = np.mean([v[1] for v in bbox_stability])
    
    result = {
        "num_tracks": len(track_lifetimes),
        "avg_lifetime": track_lifetimes['lifetime'].mean(),
        "short_tracks": len(short_tracks),
        "avg_detection_rate": detection_rate.mean(),
        "avg_bbox_std_cx": cx_std,
        "avg_bbox_std_cy": cy_std,
    }
    return result

# --- วิเคราะห์ทุกกล้อง ---
camera_results = {}
for cam, f in mot_files.items():
    if f.exists():
        camera_results[cam] = analyze_camera(f)
    else:
        camera_results[cam] = None

# --- รวม metric กลาง (average ของทุกกล้อง) ---
metrics = ['num_tracks','avg_lifetime','short_tracks','avg_detection_rate','avg_bbox_std_cx','avg_bbox_std_cy']
summary = {m: np.mean([camera_results[c][m] for c in camera_results if camera_results[c] is not None]) for m in metrics}

# --- แนะนำค่า config แบบ auto ---
# 1. Detection threshold: ถ้า detection rate ต่ำ ให้ลด conf threshold
detection_conf_threshold = 0.45
if summary['avg_detection_rate'] < 0.8:
    detection_conf_threshold = max(0.05, 0.45 * summary['avg_detection_rate'])

# 2. Parking time threshold: ถ้า track หลุดบ่อย → เพิ่ม threshold
parking_time_threshold_seconds = 30
if summary['short_tracks'] > 0:
    parking_time_threshold_seconds = min(60, 30 + summary['short_tracks'] / summary['num_tracks'] * 30)

# 3. Movement threshold px: ถ้า bbox deviation สูง → เพิ่ม threshold
movement_threshold_px = 80
bbox_std = (summary['avg_bbox_std_cx'] + summary['avg_bbox_std_cy']) / 2
if bbox_std > 15:
    movement_threshold_px = min(200, 80 + bbox_std)

# --- แสดงผล ---
print("=== Camera Metrics ===")
for cam, res in camera_results.items():
    print(f"{cam}: {res}")
print("\n=== Summary Metrics (All Cameras) ===")
print(summary)
print("\n=== Recommended Config ===")
print(f"detection_conf_threshold: {detection_conf_threshold:.2f}")
print(f"parking_time_threshold_seconds: {parking_time_threshold_seconds:.1f}")
print(f"movement_threshold_px: {movement_threshold_px:.1f}")
