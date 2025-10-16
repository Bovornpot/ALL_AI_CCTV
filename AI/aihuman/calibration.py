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