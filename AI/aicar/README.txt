aicar/
├── __pycache__/  (ไฟล์แคชของ Python)
├── boxmot/       (โมดูลหลักสำหรับ BoxMOT)
│   ├── __pycache__/
│   ├── configs/      (ไฟล์ตั้งค่าสำหรับ Tracking Algorithms ภายใต้ BoxMOT)
│   │   ├── __init__.py
│   │   ├── botsort.yaml
│   │   ├── bytetrack.yaml
│   │   ├── deepocsort.yaml
│   │   ├── ocsort.yaml
│   │   └── strongsort.yaml
│   └── __init__.py   (ไฟล์ __init__.py ที่อยู่ในระดับเดียวกับ configs/ ภายใต้ boxmot/)
├── detectors/    (โมดูลสำหรับ Detection)
│   ├── __pycache__/
│   ├── __init__.py
│   ├── strategy.py
│   └── yolo_processor.py
├── evaluation_logs/
├── parking_logs/ (โฟลเดอร์สำหรับบันทึกข้อมูลการจอด)
├── runs/         (โฟลเดอร์สำหรับผลลัพธ์การรัน)
├── trackers/     (ไฟล์ตั้งค่าเฉพาะของ Tracker)
│   ├── botsort.yaml
│   ├── bytetrack.yaml
│   └── deepocsort.yaml
├── weights/      (ไฟล์โมเดล AI)
│   └── model_best.pth  (เฉพาะไฟล์นี้ที่อยู่ใน weights/)
├── camera_worker_process.py
├── car_tracker_manager.py
├── evaluation.py
├── main_monitor.py
├── parking_zone_camera1.json
├── parking_zone_camera2.json
├── select_roi.py
├── SmartPlayer.exe
├── utils.py
├── yolo12m.pt      <-- ไฟล์โมเดล YOLO ถูกย้ายมาอยู่ระดับบนสุดของโฟลเดอร์ AI/
├── yolo12n.pt      <--
├── yolo12s.pt      <--
