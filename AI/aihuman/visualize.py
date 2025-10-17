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
    # plt.show()
    plt.close()

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
    # plt.show()
    plt.close()