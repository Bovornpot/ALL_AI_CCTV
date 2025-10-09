# select_roi_multiple.py
import cv2
import json
import numpy as np
import yaml
from pathlib import Path

# --- Global variables ---
drawing_points = []         # เก็บจุดของโซนที่กำลังวาดอยู่
completed_polygons = []     # ### ใหม่: เก็บโซนทั้งหมดที่วาดเสร็จแล้ว ###
window_name = "Select Multiple ROIs"
display_img = None
original_img = None
current_source_info = None
original_video_width = 0
original_video_height = 0
current_scale_factor = 1.0

def redraw_canvas():
    """ฟังก์ชันสำหรับวาดภาพใหม่ทั้งหมด ทั้งโซนที่เสร็จแล้วและโซนที่กำลังวาด"""
    global display_img
    if original_img is None:
        return

    # สร้างภาพจากต้นฉบับเสมอ
    display_img_working_copy = original_img.copy()

    # 1. วาดโซนที่วาดเสร็จแล้วทั้งหมดด้วยสีเขียวทึบ
    if completed_polygons:
        for poly in completed_polygons:
            cv2.polylines(display_img_working_copy, [np.array(poly)], True, (0, 180, 0), 2)
            overlay = display_img_working_copy.copy()
            cv2.fillPoly(overlay, [np.array(poly)], (0, 180, 0))
            display_img_working_copy = cv2.addWeighted(overlay, 0.2, display_img_working_copy, 0.8, 0)

    # 2. วาดโซนที่กำลังวาดอยู่ด้วยสีเขียวสว่าง
    if drawing_points:
        for i, point in enumerate(drawing_points):
            cv2.circle(display_img_working_copy, point, 5, (0, 255, 0), -1)
        if len(drawing_points) > 1:
            cv2.polylines(display_img_working_copy, [np.array(drawing_points)], False, (0, 255, 0), 2)
    
    display_img = display_img_working_copy
    cv2.imshow(window_name, display_img)

def mouse_callback(event, x, y, flags, param):
    if event == cv2.EVENT_LBUTTONDOWN:
        drawing_points.append((x, y))
        print(f"Point added: ({x}, {y})")
        redraw_canvas()

def select_roi(source_path, cam_name=None, roi_filename_suggestion=None):
    global drawing_points, completed_polygons, display_img, original_img, window_name, current_source_info
    global original_video_width, original_video_height, current_scale_factor 
    
    # รีเซ็ตค่าทุกครั้งที่เริ่มใหม่
    drawing_points = []
    completed_polygons = []

    # ... (ส่วนโค้ดโหลดวิดีโอและปรับขนาดเหมือนเดิม) ...
    cap = cv2.VideoCapture(str(source_path))
    if not cap.isOpened():
        print(f"Error: Could not open video source {source_path}.")
        return None
    original_video_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    original_video_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    ret, frame = cap.read()
    cap.release()
    if not ret:
        print(f"Error: Failed to read frame from video source {source_path}.")
        return None
    
    display_width, display_height = 1280, 720
    h, w = frame.shape[:2]
    current_scale_factor = 1.0
    if w > display_width or h > display_height:
        scale = min(display_width / w, display_height / h)
        frame = cv2.resize(frame, (int(w * scale), int(h * scale)))
        current_scale_factor = scale

    original_img = frame.copy()
    display_img = original_img.copy()

    cv2.namedWindow(window_name)
    cv2.setMouseCallback(window_name, mouse_callback)

    # ### แก้ไข ###: เพิ่มคำอธิบายปุ่ม 'n'
    print("\n--- ROI Selection Guide (Multiple Zones) ---")
    print("'n': Finish current polygon and start a NEW one")
    print("'d': Delete the last point of the CURRENT polygon")
    print("'c': Clear ALL polygons and start over")
    print("'s': Save all completed polygons to JSON")
    print("'q': Quit without saving")
    print("--------------------------------------------\n")

    redraw_canvas()

    while True:
        key = cv2.waitKey(1) & 0xFF
        
        if key == ord('n'): # ### ใหม่: ปุ่มสำหรับจบโซนปัจจุบันและเริ่มโซนใหม่ ###
            if len(drawing_points) >= 3:
                completed_polygons.append(list(drawing_points))
                print(f"Polygon #{len(completed_polygons)} saved. Ready to start new polygon.")
                drawing_points.clear()
                redraw_canvas()
            else:
                print("Warning: A polygon needs at least 3 points to be saved.")

        elif key == ord('s'): # Save
            # ถ้ากำลังวาดโซนสุดท้ายอยู่ ให้เพิ่มเข้าไปในลิสต์ก่อนบันทึก
            if len(drawing_points) >= 3:
                completed_polygons.append(list(drawing_points))
                drawing_points.clear()

            if not completed_polygons:
                print("Warning: No completed polygons to save.")
                continue
            
            output_filename = roi_filename_suggestion
            if not output_filename:
                output_filename = input("Enter filename to save (e.g., parking_zones.json): ")
            
            # ### แก้ไข ###: บันทึก List ของ Polygons ลงไฟล์ JSON
            scaled_polygons = []
            for poly in completed_polygons:
                scaled_points = [[int(p[0] / current_scale_factor), int(p[1] / current_scale_factor)] for p in poly]
                scaled_polygons.append(scaled_points)

            with open(output_filename, 'w') as f:
                json.dump(scaled_polygons, f, indent=4)
            print(f"{len(scaled_polygons)} ROI polygons saved to {output_filename}")
            break

        elif key == ord('c'): # Clear all
            drawing_points.clear()
            completed_polygons.clear()
            print("All points and polygons cleared.")
            redraw_canvas()

        elif key == ord('d'): # Delete last point
            if drawing_points:
                drawing_points.pop()
                redraw_canvas()
            else:
                print("No points in the current polygon to delete.")

        elif key == ord('q'): # Quit
            print("Quitting ROI selection.")
            break

    cv2.destroyAllWindows()

if __name__ == '__main__':
    config_file = 'config.yaml'
    try:
        with open(config_file, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
    except FileNotFoundError:
        print(f"Error: {config_file} not found. Please ensure it exists.")
        exit()
    except yaml.YAMLError as e:
        print(f"Error parsing YAML config file {config_file}: {e}")
        exit()

    video_sources = config.get('video_sources', [])

    if not video_sources:
        print("No 'video_sources' defined in config.yaml. Please define them to select ROIs.")
        # Fallback to single source if no multi-source defined
        main_source = config.get('source')
        if main_source is not None:
            print(f"Falling back to single 'source' definition: {main_source}")
            print("To define ROIs for multiple cameras, please configure 'video_sources' in config.yaml.")
            
            # Use parking_zone_file_for_single_camera from config if available, else a default
            default_roi_file = config.get('parking_zone_file_for_single_camera', "parking_zone_single_camera.json")
            
            if not Path(default_roi_file).exists() or input(f"ROI file '{default_roi_file}' already exists. Overwrite? (y/N): ").lower() == 'y':
                select_roi(main_source, cam_name="main_camera", roi_filename_suggestion=default_roi_file)
            else:
                print(f"Skipping ROI selection for single camera.")
        else:
            print("No video source found in config.yaml. Please add a 'source' or 'video_sources'.")
            exit()
    else:
        print("\n--- Starting ROI selection for each defined camera source ---")
        for entry in video_sources:
            # Use 'name' from config.yaml
            cam_name_from_config = entry.get('name')
            source_path = entry.get('source_path')
            parking_zone_file_suggestion = entry.get('parking_zone_file')

            if source_path is None:
                print(f"Warning: 'source_path' not defined for camera '{cam_name_from_config}'. Skipping.")
                continue
            if parking_zone_file_suggestion is None:
                print(f"Warning: 'parking_zone_file' not defined for camera '{cam_name_from_config}'. Cannot save ROI. Skipping.")
                continue

            print(f"\nSelecting ROI for Camera Name: {cam_name_from_config}, Source: {source_path}")
            print(f"Suggested output filename: {parking_zone_file_suggestion}")
            
            if Path(parking_zone_file_suggestion).exists():
                response = input(f"ROI file '{parking_zone_file_suggestion}' already exists. Overwrite? (y/N): ").lower()
                if response != 'y':
                    print(f"Skipping ROI selection for Camera {cam_name_from_config}.")
                    continue
            
            selected_roi_points = select_roi(source_path, cam_name=cam_name_from_config, roi_filename_suggestion=parking_zone_file_suggestion)
            
            if selected_roi_points:
                print(f"ROI for Camera {cam_name_from_config} successfully selected/saved.")
            else:
                print(f"ROI selection for Camera {cam_name_from_config} was not saved or cancelled.")
    pass                