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