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