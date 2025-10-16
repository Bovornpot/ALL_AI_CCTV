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