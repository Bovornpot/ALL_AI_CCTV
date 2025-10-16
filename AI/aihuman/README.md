# AI Human — Multi-Camera Trajectory-Based ReID & Heatmap (Project files)

โครงงานนี้รวมไฟล์ Python, config และคำอธิบายการใช้งานสำหรับระบบ **aihuman** ที่จะวางอยู่ในโฟลเดอร์ `C:\Users\chayaphonlamt\Documents\cctv\AI\aihuman` (แต่ทุก path ในโค้ดเป็น **relative** จากโฟลเดอร์ `aihuman/` เพื่อให้ย้ายเครื่องได้)

---

## โครงสร้างไฟล์ (project tree)

```
aihuman/
├── detector.py
├── tracker.py
├── calibration.py
├── reid.py
├── visualize.py
├── main.py
├── config_human.yaml
├── requirements.txt
└── README.md
```

---

> เปิดไฟล์แต่ละไฟล์ด้านล่างได้เลย (คัดลอกไปวางเป็นไฟล์จริงในโฟลเดอร์ `aihuman/`).

---

## `config_human.yaml`

```yaml
# Relative config for aihuman project
# Place this file at: aihuman/config_human.yaml

# RTSP streams (use the values you gave)
rtsp_streams:
  - "rtsp://adminhq:admin1%402@117.199.188.9:554/Streaming/Channels/1301"
  - "rtsp://adminhq:admin1%402@117.199.188.9:554/Streaming/Channels/1401"
  - "rtsp://adminhq:admin1%402@117.199.188.9:554/Streaming/Channels/1501"
  - "rtsp://adminhq:admin1%402@117.199.188.9:554/Streaming/Channels/1601"

# Model weights path (relative)
model:
  weights: "weights/yolov12s.pt"  # ใส่ weights ของคุณที่นี่ (relative to aihuman/)
  conf_thres: 0.4
  iou_thres: 0.5

# Tracking params
tracker:
  type: "bytetrack"   # try 'bytetrack', fallback to simple SORT if not installed
  track_high_thresh: 0.6

# Homography matrices per camera (3x3) - ตัวอย่าง matrix identity ให้แก้ด้วยการ calibrate
homographies:
  cam_0: [[1,0,0],[0,1,0],[0,0,1]]
  cam_1: [[1,0,0],[0,1,0],[0,0,1]]
  cam_2: [[1,0,0],[0,1,0],[0,0,1]]
  cam_3: [[1,0,0],[0,1,0],[0,0,1]]

# ReID / matching thresholds
reid:
  dist_threshold: 2.0    # meters (example) — adjust to your floorplan scale
  time_window: 5.0      # seconds allowable time gap for matching

# Visualization
visualization:
  floorplan: "assets/floorplan.png"  # optional relative path to floorplan image
  heatmap_bin_size: 0.5
  save_dir: "outputs"
```

---

## `requirements.txt`

```
# core
python-dateutil
PyYAML
numpy
opencv-python
matplotlib
pandas
scipy
pathlib

# deep learning
torch
torchvision
# ultralytics (provides YOLO API - you can use your own wrapper if you prefer)
ultralytics

# optional tracker libs (ByteTrack)
# If you want the original ByteTrack, clone project and make it importable.
# Otherwise the tracker module falls back to a lightweight SORT implementation.

# For web integration/DB (optional)
requests
```

---

## `detector.py`

```python
# detector.py
# Simple wrapper for YOLO model using ultralytics (works with many weights)
from pathlib import Path
from ultralytics import YOLO
import numpy as np

BASE_DIR = Path(__file__).resolve().parent

class Detector:
    def __init__(self, weights_path, conf=0.4):
        self.model = YOLO(str(weights_path))
        self.conf = conf

    def detect(self, frame):
        # returns list of detections: [ (x1,y1,x2,y2,conf,cls) , ... ]
        results = self.model.predict(frame, conf=self.conf, verbose=False)
        dets = []
        # results is a list; take first
        if len(results) == 0:
            return dets
        r = results[0]
        boxes = r.boxes
        for box in boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            conf = float(box.conf[0])
            cls = int(box.cls[0])
            dets.append((int(x1), int(y1), int(x2), int(y2), conf, cls))
        return dets

if __name__ == '__main__':
    # quick local test if needed
    import cv2
    img = cv2.imread(str(BASE_DIR / 'test.jpg')) if (BASE_DIR / 'test.jpg').exists() else None
    if img is not None:
        det = Detector(BASE_DIR / 'weights' / 'yolov12s.pt')
        print(det.detect(img))
```

---

## `tracker.py`

```python
# tracker.py
# Wrapper to use ByteTrack if available, otherwise fallback to a simple SORT-like tracker
from collections import deque
import numpy as np

try:
    from bytetrack.yolox.tracker.byte_tracker import BYTETracker
    BYTE_AVAILABLE = True
except Exception:
    BYTE_AVAILABLE = False

class SimpleTrack:
    """
    Very lightweight track store for quick testing (not production-level).
    Maintains track_id and last bbox center.
    """
    def __init__(self):
        self.next_id = 1
        self.tracks = {}  # id -> (bbox, last_time)

    def update(self, detections):
        # detections: list of (x1,y1,x2,y2,conf,cls)
        out = []
        for det in detections:
            x1,y1,x2,y2,conf,cls = det
            tid = self.next_id
            self.next_id += 1
            cx = int((x1+x2)/2)
            cy = int((y1+y2)/2)
            self.tracks[tid] = ((x1,y1,x2,y2), (cx,cy))
            out.append({'track_id': tid, 'bbox': (x1,y1,x2,y2)})
        return out

class TrackerWrapper:
    def __init__(self, tracker_type='bytetrack'):
        self.tracker_type = tracker_type
        if tracker_type == 'bytetrack' and BYTE_AVAILABLE:
            # configure BYTETracker with defaults
            self.impl = BYTETracker({})
        else:
            self.impl = SimpleTrack()

    def update(self, detections):
        # detections: list of (x1,y1,x2,y2,conf,cls)
        if self.tracker_type == 'bytetrack' and BYTE_AVAILABLE:
            # transform detections to format expected by BYTETracker if necessary
            # NOTE: user must install/clone ByteTrack for production
            np_dets = np.array([[d[0], d[1], d[2], d[3], d[4]] for d in detections])
            online_targets = self.impl.update(np_dets, info={})
            out = []
            for t in online_targets:
                tid = t.track_id
                x1,y1,x2,y2 = t.tlbr
                out.append({'track_id': tid, 'bbox': (int(x1),int(y1),int(x2),int(y2))})
            return out
        else:
            return self.impl.update(detections)
```

---

## `calibration.py`

```python
# calibration.py
# Helpers to load homography matrices from config and do projection
import numpy as np

def project_point(H, x, y):
    pt = np.array([x, y, 1.0])
    proj = H.dot(pt)
    if proj[2] == 0:
        return (0,0)
    proj = proj / proj[2]
    return float(proj[0]), float(proj[1])

def project_trajectory(H, traj):
    # traj: list of (t, x, y)
    return [(t, *project_point(H, x, y)) for (t, x, y) in traj]
```

---

## `reid.py`

```python
# reid.py
# Implements simple trajectory-based matching (first-last strategy + time+distance constraint)
from math import sqrt
from collections import defaultdict

class TrajectoryReID:
    def __init__(self, dist_threshold=2.0, time_window=5.0):
        # thresholds (units consistent with projected floor coords)
        self.dist_threshold = dist_threshold
        self.time_window = time_window
        self.next_global_id = 1
        self.mapping = {}  # local_global_id -> global_id
        self.global_trajs = defaultdict(list)  # global_id -> list of (t,x,y)

    def register_local(self, local_id, traj, cam_id):
        # local_id is e.g. "cam2_45"; traj is list of (t,x,y) in floor coords
        self.mapping[local_id] = None
        # store as pending until matching
        return

    def match_and_merge(self, local_trajs):
        # local_trajs: dict local_id -> traj (list of (t,x,y))
        # Build first and last positions
        firsts = []  # (local_id, t_first, x_first, y_first)
        lasts = []
        for lid, traj in local_trajs.items():
            if len(traj) == 0:
                continue
            t0,x0,y0 = traj[0]
            tn,xn,yn = traj[-1]
            firsts.append((lid, t0, x0, y0))
            lasts.append((lid, tn, xn, yn))

        # naive matching: for each last, look for firsts with t_first < t_last <= t_first + time_window
        used_first = set()
        for (lid_last, t_last, x_last, y_last) in sorted(lasts, key=lambda x: x[1]):
            best = None
            best_d = None
            for (lid_first, t_first, x_first, y_first) in firsts:
                if lid_first in used_first:
                    continue
                if t_first >= t_last:
                    continue
                if (t_last - t_first) > self.time_window:
                    continue
                d = sqrt((x_last-x_first)**2 + (y_last-y_first)**2)
                if d <= self.dist_threshold:
                    if best is None or d < best_d:
                        best = lid_first
                        best_d = d
            if best is not None:
                # merge lid_last into best
                gid = self._get_or_create_global(best)
                self.mapping[lid_last] = gid
                used_first.add(best)
            else:
                # treat as new global id
                gid = self._get_or_create_global(lid_last)
                self.mapping[lid_last] = gid

        # After mapping, aggregate global trajectories
        self.global_trajs.clear()
        for lid, traj in local_trajs.items():
            gid = self.mapping.get(lid)
            if gid is None:
                gid = self._get_or_create_global(lid)
                self.mapping[lid] = gid
            self.global_trajs[gid].extend(traj)

        return self.mapping, self.global_trajs

    def _get_or_create_global(self, local_id):
        # if local_id already mapped to a global id, return it, else create new
        if local_id in self.mapping and self.mapping[local_id] is not None:
            return self.mapping[local_id]
        gid = self.next_global_id
        self.next_global_id += 1
        self.mapping[local_id] = gid
        return gid
```

---

## `visualize.py`

```python
# visualize.py
import matplotlib.pyplot as plt
import numpy as np
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

def plot_heatmap(points, floorplan_path=None, bin_size=0.5, save_path=None):
    # points: list of (x,y)
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    plt.figure(figsize=(8,6))
    if floorplan_path and Path(floorplan_path).exists():
        img = plt.imread(floorplan_path)
        plt.imshow(img, alpha=0.4)
    # KDE via hist2d
    heat, xedges, yedges = np.histogram2d(ys, xs, bins=200)
    extent = [xedges[0], xedges[-1], yedges[0], yedges[-1]]
    plt.imshow(heat.T, extent=extent, origin='lower', alpha=0.6)
    plt.title('Heatmap')
    if save_path:
        plt.savefig(save_path)
    plt.show()

def plot_trajectories(global_trajs, floorplan_path=None, save_path=None):
    plt.figure(figsize=(8,6))
    if floorplan_path:
        try:
            img = plt.imread(floorplan_path)
            plt.imshow(img, alpha=0.4)
        except Exception:
            pass
    for gid, traj in global_trajs.items():
        xs = [p[1] for p in traj]
        ys = [p[2] for p in traj]
        plt.plot(xs, ys, marker='o', linewidth=1, label=f'G{gid}')
    plt.legend(loc='upper right')
    if save_path:
        plt.savefig(save_path)
    plt.show()
```

---

## `main.py`

```python
# main.py
# Entrypoint: run multi-camera pipeline using RTSP streams defined in config_human.yaml
import yaml
import cv2
import time
import threading
from pathlib import Path
from detector import Detector
from tracker import TrackerWrapper
from calibration import project_point
from reid import TrajectoryReID
from visualize import plot_heatmap, plot_trajectories

BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / 'config_human.yaml'

# load config
with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
    cfg = yaml.safe_load(f)

RTSP = cfg['rtsp_streams']
WEIGHTS = BASE_DIR / cfg['model']['weights']
CONF = cfg['model']['conf_thres']

# create outputs
out_dir = BASE_DIR / cfg.get('visualization', {}).get('save_dir', 'outputs')
out_dir.mkdir(parents=True, exist_ok=True)

# initialize modules
detector = Detector(WEIGHTS, conf=CONF)
trackers = [TrackerWrapper(cfg['tracker']['type']) for _ in RTSP]
reid = TrajectoryReID(dist_threshold=cfg['reid']['dist_threshold'], time_window=cfg['reid']['time_window'])

# simple per-camera storage
camera_trajs = [{} for _ in RTSP]  # list of dict: local_id -> list of (t,x,y) in image coords

# helper: per-camera capture thread
def capture_thread(idx, rtsp_url):
    cap = cv2.VideoCapture(rtsp_url)
    if not cap.isOpened():
        print(f"[cam{idx}] cannot open stream: {rtsp_url}")
        return
    fps = cap.get(cv2.CAP_PROP_FPS) or 20.0
    while True:
        ret, frame = cap.read()
        if not ret:
            time.sleep(0.1)
            continue
        t = time.time()
        dets = detector.detect(frame)
        tracks = trackers[idx].update(dets)
        # store center points for each local track id
        for tr in tracks:
            tid = f"cam{idx}_{tr['track_id']}"
            x1,y1,x2,y2 = tr['bbox']
            cx = (x1 + x2) / 2.0
            cy = (y1 + y2) / 2.0
            camera_trajs[idx].setdefault(tid, []).append((t, cx, cy))
        # lightweight: sleep to avoid 100% CPU
        time.sleep(0.01)

# start threads
threads = []
for i, url in enumerate(RTSP):
    t = threading.Thread(target=capture_thread, args=(i, url), daemon=True)
    t.start()
    threads.append(t)

print("Started capture threads for", len(RTSP), "streams.")

# main loop: periodically run reid and visualization
try:
    while True:
        time.sleep(10)  # every 10s aggregate
        # project trajectories using homographies from config
        local_proj = {}
        homos = cfg.get('homographies', {})
        for cam_idx, trajs in enumerate(camera_trajs):
            H = homos.get(f'cam_{cam_idx}', [[1,0,0],[0,1,0],[0,0,1]])
            H = __import__('numpy').array(H)
            for lid, traj in trajs.items():
                # project last N points (or all) to floor coords
                proj = [ (t, *project_point(H, x, y)) for (t,x,y) in traj ]
                local_proj[lid] = proj

        mapping, global_trajs = reid.match_and_merge(local_proj)
        # flatten points for heatmap
        points = []
        for gid, traj in global_trajs.items():
            for (t,x,y) in traj:
                points.append((x,y))
        if points:
            plot_heatmap(points, floorplan_path=BASE_DIR / cfg.get('visualization', {}).get('floorplan', ''), save_path=out_dir / 'heatmap.png')
            plot_trajectories(global_trajs, floorplan_path=BASE_DIR / cfg.get('visualization', {}).get('floorplan', ''), save_path=out_dir / 'trajectories.png')
        else:
            print('No points yet')

except KeyboardInterrupt:
    print('Stopping')
```

---

## `README.md` (สั้น ๆ)

```markdown
# aihuman
Multi-camera trajectory-based ReID & Heatmap (prototype)

## Setup
1. Create virtualenv (recommended)
2. Install requirements: `pip install -r requirements.txt`
3. Put your YOLO weights at `aihuman/weights/yolov12s.pt` or update `config_human.yaml`
4. Edit `config_human.yaml` homography matrices and rtsp streams
5. Run: `python main.py`

Notes: This is a prototype. For production, use proper ByteTrack installation, GPU acceleration, DB storage, and robust exception handling.
```

---

# หมายเหตุสำคัญ

* โค้ดใน repo นี้เป็น **prototype** เพื่อเริ่มทดลองตามบทความ MDPI โดยโฟลเดอร์ `aihuman/` ต้องมีไฟล์ weights และ assets ที่จำเป็น (floorplan image ฯลฯ)
* ถ้าต้องการ ผมสามารถทำให้เป็น `git repo` แบบพร้อมดาวน์โหลด หรือสร้างไฟล์จริงในเครื่องของคุณ (แต่ผมไม่สามารถเข้าถึงไฟล์เครื่องคุณโดยตรง) — ผมจะช่วยส่งเนื้อหาไฟล์ทั้งหมดให้ คุณก็แค่คัดลอกและวางลงในไฟล์ภายใน `C:\Users\chayaphonlamt\Documents\cctv\AI\aihuman` แล้วรันได้ทันที

---

ถ้าต้องการให้ผมปรับแก้ไฟล์ใดเพิ่มเติม (เช่น เพิ่มการบันทึกลง DB, เพิ่ม API endpoint เพื่อสั่ง start/stop จาก backend, หรือปรับให้ใช้ ByteTrack แบบเต็ม) บอกได้เลยครับ ผมจะอัปเดตไฟล์ใน Canvas ให้ทันที.
