# main_monitor.py
import argparse
import multiprocessing
import queue  # For queue.Empty
import cv2
import time
import torch
import sys
from multiprocessing import Process, Queue
from pathlib import Path
from camera_worker_process import camera_worker
from utils import load_config, save_parking_statistics
import os
import base64
import threading
import asyncio
import websockets
from typing import Dict, Any, Set

# ### FIX: เพิ่มฟังก์ชันตรวจสอบ Config ###
def validate_config(config: Dict[str, Any], required_keys):
    """Checks if all required keys are present in the config."""
    missing_keys = [key for key in required_keys if key not in config]
    if missing_keys:
        print(f"Error: Missing required keys in config.yaml: {', '.join(missing_keys)}")
        sys.exit(1)  # ออกจากโปรแกรมพร้อมแจ้งข้อผิดพลาด

def map_vehicle_class(cls_id: int) -> int:
    """
    Map YOLO class id ให้เหมาะกับงาน parking lot.
    Example: 7 (truck) -> 2 (car)
    """
    if cls_id == 7:
        return 2
    return cls_id

def frame_to_jpeg_bytes(frame) -> bytes:
    """Encode BGR frame (numpy) to JPEG bytes."""
    ok, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
    if not ok:
        raise RuntimeError("Failed to encode frame to JPEG")
    return buffer.tobytes()

# -------------------------
# WebSocket Broadcaster
# -------------------------
class WsBroadcaster:
    """
    Simple WebSocket broadcaster running in its own thread + asyncio loop.
    Clients receive messages: "<cam_name>|<base64_jpeg>"
    """
    def __init__(self, host: str = "0.0.0.0", port: int = 8765):
        self.host = host
        self.port = port
        self._loop = None
        self._thread: threading.Thread | None = None
        self._clients: Set[websockets.WebSocketServerProtocol] = set()
        self._server = None
        self._stop_event = threading.Event()

    async def _handler(self, websocket: websockets.WebSocketServerProtocol, path):
        # New client connected
        self._clients.add(websocket)
        try:
            # Keep listening for messages from client (e.g., heartbeats), but we don't require them
            async for _ in websocket:
                pass
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self._clients.discard(websocket)

    async def _start_server(self):
        self._server = await websockets.serve(self._handler, self.host, self.port, ping_interval=20, ping_timeout=10)
        # keep running until stopped
        await self._server.wait_closed()

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._thread = threading.Thread(target=self._thread_main, daemon=True)
        self._thread.start()
        # wait until loop is ready
        while self._loop is None:
            time.sleep(0.01)

    def _thread_main(self):
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        try:
            # schedule server coroutine
            server_coro = self._start_server()
            self._loop.run_until_complete(server_coro)  # This blocks until server closed
        except Exception as e:
            print(f"[WsBroadcaster] server error: {e}")
        finally:
            self._loop.close()

    def stop(self):
        # Close server and stop loop
        if not self._loop:
            return
        def _stop():
            # close all clients
            for ws in list(self._clients):
                try:
                    asyncio.ensure_future(ws.close())
                except Exception:
                    pass
            # close server
            if self._server:
                self._server.close()
        self._loop.call_soon_threadsafe(_stop)
        # stop the loop
        self._loop.call_soon_threadsafe(self._loop.stop)
        if self._thread:
            self._thread.join(timeout=2)

    def broadcast(self, cam_name: str, jpeg_bytes: bytes):
        """Public method to broadcast a frame (jpeg bytes) as base64."""
        if not self._loop:
            return
        # prepare base64
        b64 = base64.b64encode(jpeg_bytes).decode('ascii')
        msg = f"{cam_name}|{b64}"
        asyncio.run_coroutine_threadsafe(self._broadcast_msg(msg), self._loop)

    async def _broadcast_msg(self, msg: str):
        if not self._clients:
            return
        coros = []
        for ws in list(self._clients):
            if ws.closed:
                self._clients.discard(ws)
                continue
            coros.append(ws.send(msg))
        if coros:
            # send concurrently; ignore exceptions for individual clients
            await asyncio.gather(*coros, return_exceptions=True)


# -------------------------
# Main runner
# -------------------------
@torch.no_grad()
def run(args):
    # determine config path (relative to project)
    config_path = os.path.join(os.path.dirname(__file__), "../config.yaml")
    config = load_config(config_path)

    main_required_keys = ['yolo_model', 'reid_model', 'boxmot_config_path', 'api_key', 'video_sources']
    validate_config(config, main_required_keys)

    camera_configs = config.get('video_sources', [])
    if not camera_configs:
        print("Error: No 'video_sources' defined in config.yaml. Please define at least one camera.")
        return

    display_queue = Queue(maxsize=config.get('display_queue_max_size', 10))
    stats_queue = Queue()
    processes = []

    # Start camera worker processes
    for cam_cfg in camera_configs:
        cam_name = cam_cfg['name']
        source_path = cam_cfg['source_path']
        parking_zone_file = cam_cfg.get('parking_zone_file', "")
        # check local file if not URL
        if not str(source_path).startswith(('rtsp://', 'http://')):
            src_path = Path(source_path)
            if not src_path.exists():
                print(f"[main] Warning: Video source file '{src_path}' for camera '{cam_name}' not found. Skipping this camera.")
                continue
        roi_file = Path(parking_zone_file) if parking_zone_file else None
        if roi_file and not roi_file.exists():
            print(f"[main] Warning: ROI file '{roi_file}' for camera '{cam_name}' not found. Skipping this camera.")
            continue

        p = Process(target=camera_worker, args=(cam_cfg, config, display_queue, stats_queue, args.show_display))
        processes.append(p)
        p.start()

    # If no processes started, exit
    if not processes:
        print("No camera processes started. Exiting.")
        return

    # Optionally start websocket broadcaster
    ws_broadcaster = None
    if args.ws_enable:
        ws_broadcaster = WsBroadcaster(host=args.ws_host, port=args.ws_port)
        print(f"[main] Starting WebSocket broadcaster at ws://{args.ws_host}:{args.ws_port}")
        ws_broadcaster.start()

    print("\n--- Starting Multi-Camera Parking Monitor (Multi-processing) ---")
    print(f"Display Streams: {'Enabled' if args.show_display else 'Disabled'}")
    print(f"WebSocket Broadcast: {'Enabled' if args.ws_enable else 'Disabled'}")
    print("Press 'q' to quit.")

    latest_frames = {}
    active_processes = {p.pid: p for p in processes}

    try:
        while True:
            try:
                cam_name, frame_to_display = display_queue.get(timeout=0.01)
                latest_frames[cam_name] = frame_to_display
            except queue.Empty:
                pass

            # show display windows if requested
            if args.show_display:
                for cam_name, frame_data in list(latest_frames.items()):
                    if frame_data is None:
                        continue
                    try:
                        original_width_display = frame_data.shape[1]
                        original_height_display = frame_data.shape[0]
                        display_max_width = 960
                        display_max_height = 540

                        if original_width_display > display_max_width or original_height_display > display_max_height:
                            scale_w = display_max_width / original_width_display
                            scale_h = display_max_height / original_height_display
                            display_scale_factor = min(scale_w, scale_h)
                        else:
                            display_scale_factor = 1.0

                        new_display_width = int(original_width_display * display_scale_factor)
                        new_display_height = int(original_height_display * display_scale_factor)

                        display_frame = cv2.resize(frame_data, (new_display_width, new_display_height))
                        cv2.imshow(f"Car Parking Monitor - {cam_name}", display_frame)
                    except Exception as e:
                        print(f"[Monitor] Error displaying frame for {cam_name}: {e}")

            # broadcast frames via websocket (non-blocking)
            if ws_broadcaster:
                for cam_name, frame_data in list(latest_frames.items()):
                    if frame_data is None:
                        continue
                    try:
                        jpeg_bytes = frame_to_jpeg_bytes(frame_data)
                        ws_broadcaster.broadcast(cam_name, jpeg_bytes)
                    except Exception as e:
                        # don't crash; keep running
                        print(f"[Monitor] Error broadcasting frame for {cam_name}: {e}")

            # keyboard input for exit
            if args.show_display:
                key = cv2.waitKey(1) & 0xFF
                if key == ord('q'):
                    print("Quitting by user request...")
                    break
            else:
                # still allow graceful stop if all processes finished
                pass

            # cleanup finished processes
            for p in list(active_processes.values()):
                if not p.is_alive():
                    print(f"[Monitor] Process {p.pid} for camera has finished.")
                    del active_processes[p.pid]

            if not active_processes:
                print("[Monitor] All camera processes have finished.")
                break

            # tiny sleep to avoid busy loop
            time.sleep(0.005)

    except KeyboardInterrupt:
        print("KeyboardInterrupt received. Shutting down...")
    finally:
        # terminate processes
        for p in processes:
            if p.is_alive():
                print(f"[Monitor] Terminating process {p.pid}...")
                p.terminate()
                p.join(timeout=2)

        # stop websocket broadcaster
        if ws_broadcaster:
            print("[Monitor] Stopping WebSocket broadcaster...")
            ws_broadcaster.stop()

        cv2.destroyAllWindows()
        print("[Monitor] Windows closed.")

        # collect stats from stats_queue
        all_parking_stats = {}
        while not stats_queue.empty():
            try:
                cam_name, stats_data = stats_queue.get_nowait()
                all_parking_stats[cam_name] = stats_data
                print(f"[Monitor] Received final stats for {cam_name}")
            except queue.Empty:
                break

        # Save stats if requested
        if all_parking_stats and config.get('save_parking_stats', False):
            output_dir = Path(config['output_dir'])
            stats_file_path = output_dir / f"parking_stats_{time.strftime('%Y%m%d-%H%M%S')}.json"
            save_parking_statistics(all_parking_stats, stats_file_path)
            print(f"[Monitor] Parking statistics saved to: {stats_file_path}")

        print("[Monitor] Multi-camera monitoring completed.")


if __name__ == '__main__':
    multiprocessing.set_start_method('spawn', force=True)  # Recommended for Windows

    parser = argparse.ArgumentParser(description="Multi-Camera Car Parking Monitor using YOLOv12 and BoxMOT")
    parser.add_argument("--config-file", type=str, default="config.yaml", help="Path to the configuration file.")
    parser.add_argument("--show-display", action="store_true", help="Display the output video in real-time.")
    parser.add_argument("--ws-enable", action="store_true", help="Enable WebSocket broadcasting of frames (base64 JPEG).")
    parser.add_argument("--ws-host", type=str, default="0.0.0.0", help="WebSocket server host (default 0.0.0.0).")
    parser.add_argument("--ws-port", type=int, default=8765, help="WebSocket server port (default 8765).")
    parser.add_argument("--save-video", action="store_true", help="Save the output video.")
    parser.add_argument("--save-mot-results", action="store_true", help="Save tracking results in MOTChallenge format.")
    parser.add_argument("--device", type=str, help="Device to run on (e.g., cpu, cuda:0). Overrides config.")
    args = parser.parse_args()

    run(args)
