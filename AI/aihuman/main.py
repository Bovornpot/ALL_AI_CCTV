# main.py (เวอร์ชันแก้ไขสำหรับ Web Streaming)
import yaml
import cv2
import time
import threading
import numpy as np # เพิ่ม numpy import
from flask import Flask, Response
from pathlib import Path
from detector import Detector
from tracker import TrackerWrapper
from calibration import project_point
from reid import TrajectoryReID
from visualize import plot_heatmap, plot_trajectories

# --- ส่วนตั้งค่า Flask และตัวแปรส่วนกลาง ---
app = Flask(__name__)
output_frames = {}
lock = threading.Lock()

# --- ส่วนโหลด Config และ Initialize เหมือนเดิม ---
BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / 'config_human.yaml'

with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
    cfg = yaml.safe_load(f)

RTSP = cfg['rtsp_streams']
WEIGHTS = BASE_DIR / cfg['model']['weights']
CONF = cfg['model']['conf_thres']

out_dir = BASE_DIR / cfg.get('visualization', {}).get('save_dir', 'outputs')
out_dir.mkdir(parents=True, exist_ok=True)

detector = Detector(WEIGHTS, conf=CONF)
trackers = [TrackerWrapper(cfg['tracker']['type']) for _ in RTSP]
reid = TrajectoryReID(dist_threshold=cfg['reid']['dist_threshold'], time_window=cfg['reid']['time_window'])
camera_trajs = [{} for _ in RTSP]

# -----------------------------------------------------------------------------
# ส่วนที่ 1: แก้ไขฟังก์ชันประมวลผลวิดีโอ (จาก capture_thread เดิม)
# -----------------------------------------------------------------------------
def process_video_stream(idx, rtsp_url):
    global output_frames, lock
    
    cap = cv2.VideoCapture(rtsp_url)
    if not cap.isOpened():
        print(f"[cam{idx}] cannot open stream: {rtsp_url}")
        return

    print(f"Started video processing for stream: {rtsp_url}")
    while True:
        ret, frame = cap.read()
        if not ret:
            print(f"[cam{idx}] stream ended, retrying...")
            time.sleep(1)
            cap.release()
            cap = cv2.VideoCapture(rtsp_url)
            continue
        
        t = time.time()
        dets = detector.detect(frame)
        tracks = trackers[idx].update(dets)

        for tr in tracks:
            tid = f"cam{idx}_{tr['track_id']}"
            x1,y1,x2,y2 = tr['bbox']
            cx = (x1 + x2) / 2.0
            cy = (y1 + y2) / 2.0
            camera_trajs[idx].setdefault(tid, []).append((t, cx, cy))
            
            # วาดกล่องและ ID บน frame
            cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (0,255,0), 2)
            cv2.putText(frame, f"ID:{tr['track_id']}", (int(x1), int(y1)-5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,255,0), 1)

        # นำ frame ที่วาดเสร็จแล้วไปเก็บไว้ในตัวแปรส่วนกลาง
        with lock:
            output_frames[idx] = frame.copy()
        
        time.sleep(0.01) # ลดการใช้ CPU

# -----------------------------------------------------------------------------
# ส่วนที่ 2: เพิ่มฟังก์ชันสำหรับ Flask Streaming
# -----------------------------------------------------------------------------
def generate(cam_idx):
    while True:
        # ... (while loop) ...
        with lock:
            frame = output_frames.get(cam_idx)
            if frame is None:
                continue

            # --- เพิ่มโค้ดย่อขนาดภาพตรงนี้ ---
            # ตั้งค่าความกว้างที่ต้องการ เช่น 640 pixels
            new_width = 640
            h, w, _ = frame.shape
            # คำนวณความสูงใหม่เพื่อรักษาสัดส่วน
            new_height = int(h * (new_width / w))
            resized_frame = cv2.resize(frame, (new_width, new_height))
            # --------------------------------

            # ใช้ภาพที่ย่อขนาดแล้วไป encode แทน
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 80]
            (flag, encodedImage) = cv2.imencode(".jpg", resized_frame, encode_param)

            if not flag:
                continue
            
            # ส่งภาพออกไปในรูปแบบ HTTP response
            yield(b'--frame\r\n' b'Content-Type: image/jpeg\r\n\r\n' + 
                bytearray(encodedImage) + b'\r\n')

# สร้าง URL แยกสำหรับแต่ละกล้อง
@app.route("/video_feed/<string:cam_id>")
def video_feed(cam_id):
    try:
        # Check if the ID starts with "cam_" and extract the number
        if cam_id.startswith("cam_"):
            cam_idx = int(cam_id.split('_')[1])
        else:
            # For backward compatibility, also allow just numbers
            cam_idx = int(cam_id)

        if cam_idx not in range(len(RTSP)):
            return "Camera index out of range.", 404
        
        return Response(generate(cam_idx),
            mimetype = "multipart/x-mixed-replace; boundary=frame")
            
    except (ValueError, IndexError):
        return "Invalid camera ID format. Use 'cam_0', 'cam_1', etc.", 400

# -----------------------------------------------------------------------------
# ส่วนที่ 3: แก้ไขส่วนการรันโปรแกรมหลัก
# -----------------------------------------------------------------------------
def reid_and_visualization_loop():
    """ฟังก์ชันที่นำ Main Loop เดิมมาใส่ เพื่อให้ทำงานใน Thread แยก"""
    while True:
        time.sleep(10) # ทำงานทุก 10 วินาที
        
        local_proj = {}
        homos = cfg.get('homographies', {})
        for cam_idx, trajs in enumerate(camera_trajs):
            H = homos.get(f'cam_{cam_idx}', [[1,0,0],[0,1,0],[0,0,1]])
            H = np.array(H)
            for lid, traj in trajs.copy().items():
                proj = [ (t, *project_point(H, x, y)) for (t,x,y) in traj ]
                local_proj[lid] = proj

        mapping, global_trajs = reid.match_and_merge(local_proj)
        
        points = []
        for gid, traj in global_trajs.items():
            for (t,x,y) in traj:
                points.append((x,y))
        
        if points:
            print("Generating heatmap and trajectories...")
            plot_heatmap(points, floorplan_path=BASE_DIR / cfg.get('visualization', {}).get('floorplan', ''), save_path=out_dir / 'heatmap.png')
            plot_trajectories(global_trajs, floorplan_path=BASE_DIR / cfg.get('visualization', {}).get('floorplan', ''), save_path=out_dir / 'trajectories.png')
        else:
            print('No points yet to generate visualization.')

if __name__ == '__main__':
    # 1. เริ่ม Thread สำหรับประมวลผลวิดีโอในเบื้องหลัง
    # สร้างและเริ่ม Thread สำหรับประมวลผลวิดีโอของ "ทุกกล้อง"
    for i, url in enumerate(RTSP):
        thread = threading.Thread(target=process_video_stream, args=(i, url))
        thread.daemon = True
        thread.start()

    # 2. เริ่ม Thread สำหรับทำ Re-ID และสร้าง Heatmap ในเบื้องหลัง
    reid_thread = threading.Thread(target=reid_and_visualization_loop)
    reid_thread.daemon = True
    reid_thread.start()
    
    # 3. เริ่มเว็บเซิร์ฟเวอร์เป็นโปรเซสหลัก
    # Start the web server
    print("Web server started. Open your browser to see the streams:")
    for i in range(len(RTSP)):
        print(f"  - Camera {i}: http://10.152.13.90:5000/video_feed/cam_{i}")
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True, use_reloader=False)