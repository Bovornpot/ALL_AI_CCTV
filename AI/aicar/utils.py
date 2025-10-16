# utils.py
import cv2
import numpy as np
import yaml
from pathlib import Path
import json

def load_config(config_path_str):
    config_path = Path(config_path_str)

    if not config_path.is_absolute():
        # ให้ base_dir เป็น root ของโปรเจกต์
        base_dir = Path(__file__).resolve().parent.parent.parent
        config_path = base_dir / config_path_str

    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    with open(config_path, 'r', encoding='utf-8') as f:
        config_data = yaml.safe_load(f)
    return config_data

def load_parking_zone(roi_coords_file_path):
    """
    Loads one or more parking zone coordinates from a JSON file.
    The JSON file should contain a list of polygons.
    e.g., [ [[x,y], [x,y]], [[x,y], [x,y]] ]
    """
    if not Path(roi_coords_file_path).exists():
        print(f"Error: ROI file '{roi_coords_file_path}' not found.")
        return None
    try:
        with open(roi_coords_file_path, 'r', encoding='utf-8') as f:
            # โค้ดนี้จะทำงานได้กับทั้งไฟล์เก่า (รูปเดียว) และไฟล์ใหม่ (หลายรูป)
            # แต่คาดหวังว่าจะเป็น List ของ Polygons
            data = json.load(f)
            # ตรวจสอบโครงสร้างข้อมูลเพื่อให้แน่ใจว่าเป็น List ของ Polygons
            if not isinstance(data, list) or not all(isinstance(i, list) for i in data):
                 print(f"Warning: ROI file '{roi_coords_file_path}' has an unexpected format. Assuming single polygon.")
                 # ถ้าเป็นรูปแบบเก่า (list of points) ให้หุ้มด้วย list อีกชั้น
                 if all(isinstance(p, list) and len(p) == 2 for p in data):
                     return [data]
                 return None
            print(f"Loaded {len(data)} parking zones from {roi_coords_file_path}")
            return data
    except Exception as e:
        print(f"An error occurred while loading ROI: {e}")
        return None
def map_detection_classes(detections, class_map={7:2}):
    """
    detections: list of [x1,y1,x2,y2,conf,cls]  หรือ list of dict {'bbox':..., 'conf':..., 'cls':...}
    คืนค่า list ในรูปเดิมแต่ cls ถูกแมป
    """
    mapped = []
    for det in detections:
        if isinstance(det, (list, tuple)) and len(det) >= 6:
            x1,y1,x2,y2,conf,cls = det[:6]
            new_cls = class_map.get(int(cls), int(cls))
            mapped.append([x1,y1,x2,y2,conf,new_cls] + list(det[6:]))
        elif isinstance(det, dict):
            new = det.copy()
            if 'cls' in new:
                new['cls'] = class_map.get(int(new['cls']), int(new['cls']))
            mapped.append(new)
        else:
            mapped.append(det)
    return mapped

# ### แก้ไข ###: เปลี่ยนชื่อและตรรกะให้รองรับหลายโซน
def is_point_in_any_polygon(point, polygons):
    """
    Checks if a 2D point is inside ANY of the provided polygons.
    """
    if polygons is None:
        return False
        
    for polygon in polygons:
        # ใช้ตรรกะเดิม แต่ทำในลูป
        polygon_np = np.array(polygon, np.int32)
        if cv2.pointPolygonTest(polygon_np, (float(point[0]), float(point[1])), False) >= 0:
            return True # ถ้าเจอในโซนใดโซนหนึ่ง ให้คืนค่า True ทันที
    return False # ถ้าไม่เจอในทุกโซน ค่อยคืนค่า False

# ### แก้ไข ###: เปลี่ยนชื่อและตรรกะให้รองรับหลายโซน
def draw_parking_zones(im, polygons, color=(0, 255, 255), thickness=2):
    """Draws all parking zone polygons on the image."""
    if polygons is None:
        return im
        
    for polygon in polygons:
        # ใช้ตรรกะเดิม แต่ทำในลูป
        if len(polygon) >= 3:
            polygon_np = np.array(polygon, np.int32).reshape((-1, 1, 2))
            cv2.polylines(im, [polygon_np], True, color, thickness)
    return im

def save_parking_statistics(stats_data, output_dir, file_name="parking_statistics.csv"):
    """
    Saves parking statistics to a CSV file.
    Args:
        stats_data (list of dicts): List of parking session dictionaries.
        output_dir (Path): Directory to save the file.
        file_name (str): Name of the CSV file.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    file_path = output_dir / file_name

    import pandas as pd
    df = pd.DataFrame(stats_data)
    
    # Append to file if it exists, otherwise write header
    if file_path.exists():
        df.to_csv(file_path, mode='a', header=False, index=False)
    else:
        df.to_csv(file_path, mode='w', header=True, index=False)
    print(f"Parking statistics saved to {file_path}")

def get_bbox_center(bbox_xyxy):
    """Calculates the center (x, y) of a bounding box."""
    x1, y1, x2, y2 = bbox_xyxy
    return ((x1 + x2) / 2, (y1 + y2) / 2)

def adjust_brightness_clahe(frame, clipLimit=2.0, tileGridSize=(8,8)):
    """
    Adjusts brightness and contrast using CLAHE (Contrast Limited Adaptive Histogram Equalization).
    Works well for improving local contrast in dark or unevenly lit areas.
    """
    if len(frame.shape) == 3: # Color image
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=clipLimit, tileGridSize=tileGridSize)
        cl = clahe.apply(l)
        limg = cv2.merge((cl, a, b))
        adjusted_frame = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
    else: # Grayscale image
        clahe = cv2.createCLAHE(clipLimit=clipLimit, tileGridSize=tileGridSize)
        adjusted_frame = clahe.apply(frame)
    return adjusted_frame

def adjust_brightness_histogram(frame, alpha=1.0, beta=0):
    """
    Adjusts brightness and contrast using simple alpha-beta scaling.
    alpha: contrast control (1.0-3.0)
    beta: brightness control (0-100)
    """
    adjusted_frame = cv2.convertScaleAbs(frame, alpha=alpha, beta=beta)
    return adjusted_frame

def write_mot_results(save_path, frame_idx, tracks_data):
    """
    Writes tracking results in MOTChallenge format.
    Format: <frame>, <id>, <bb_left>, <bb_top>, <bb_width>, <bb_height>, <conf>, <x>, <y>, <z>
    Args:
        save_path (Path): Path to the output text file.
        frame_idx (int): Current frame index (0-based, convert to 1-based for MOT).
        tracks_data (list of dict): List of track info for current frame.
            Each dict: {'id': int, 'bbox': [x1,y1,x2,y2], 'conf': float}
    """
    save_path.parent.mkdir(parents=True, exist_ok=True)
    with open(save_path, 'a') as f:
        for track in tracks_data:
            x1, y1, x2, y2 = track['bbox']
            width = x2 - x1
            height = y2 - y1
            # Assuming conf, x, y, z are not always available or needed for parking
            conf = track.get('conf', -1)
            f.write(f"{frame_idx + 1},{int(track['id'])},{x1:.2f},{y1:.2f},{width:.2f},{height:.2f},{conf:.2f},-1,-1,-1\n")
