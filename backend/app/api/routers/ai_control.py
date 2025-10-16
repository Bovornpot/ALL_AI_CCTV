# app/api/routers/ai_control_router.py  (แก้/สร้างไฟล์นี้)
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from app.api.routers.config_router import validate_rois
from pydantic import BaseModel
import asyncio
import subprocess
import signal
import sys
from pathlib import Path
from typing import Set, Optional, List
import os

router = APIRouter(tags=["AI Control"])

# Paths (แก้ตามโครงโปรเจคถ้าจำเป็น)
AI_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent / "AI/aicar"
CONFIG_FILE_PATH = Path(__file__).resolve().parent.parent.parent.parent / "config.yaml"

# หา python executable: ใช้ sys.executable ก่อน (ครอบคลุม virtualenv / venv), fallback ถ้าจำเป็น
PYTHON_EXE = Path(sys.executable) if sys.executable else Path(os.path.join(sys.prefix, "python.exe"))

# === WS manager for log streaming ===
class WSManager:
    def __init__(self):
        self.active: Set[WebSocket] = set()
        self.lock = asyncio.Lock()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        async with self.lock:
            self.active.add(ws)

    async def disconnect(self, ws: WebSocket):
        async with self.lock:
            self.active.discard(ws)

    async def broadcast(self, text: str):
        async with self.lock:
            dead = []
            for ws in list(self.active):
                try:
                    await ws.send_text(text)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.active.discard(ws)

ws_manager = WSManager()

# === global process state & log queue ===
PROCESS: Optional[subprocess.Popen] = None
LOG_QUEUE: asyncio.Queue[str] = asyncio.Queue()
READER_TASKS: List[asyncio.Task] = []

# read stream and push lines into LOG_QUEUE
async def _read_stream(stream, name: str):
    loop = asyncio.get_running_loop()
    while True:
        # read line in thread pool to avoid blocking the event loop
        line = await loop.run_in_executor(None, stream.readline)
        if not line:
            break
        # ensure we strip trailing newline for nicer messages
        await LOG_QUEUE.put(f"[{name}] {line.rstrip()}")
    await LOG_QUEUE.put(f"[{name}] -- stream closed --")

# pump log queue to all WS clients
async def _pump_to_websocket():
    while True:
        line = await LOG_QUEUE.get()
        await ws_manager.broadcast(line)

# Pydantic model for start options
class StartOptions(BaseModel):
    show_display: Optional[bool] = False
    ws_enable: Optional[bool] = False
    ws_host: Optional[str] = "0.0.0.0"
    ws_port: Optional[int] = 8765
    # (optional) override config file path if caller wants
    config_file: Optional[str] = None
    extra_args: Optional[List[str]] = None  # pass-through extra args if needed

def _build_ai_command(options: StartOptions) -> List[str]:
    """
    Build the command list for subprocess.Popen
    """
    cmd = [str(PYTHON_EXE), str(AI_DIR / "main_monitor.py")]
    # config file: either provided in options or default CONFIG_FILE_PATH
    cfg = options.config_file if options.config_file else str(CONFIG_FILE_PATH)
    cmd.extend(["--config-file", str(cfg)])

    if options.show_display:
        cmd.append("--show-display")
    if options.ws_enable:
        cmd.append("--ws-enable")
        # pass host and port
        if options.ws_host:
            cmd.extend(["--ws-host", str(options.ws_host)])
        if options.ws_port:
            cmd.extend(["--ws-port", str(int(options.ws_port))])

    # append any extra args (safety: ensure they are strings)
    if options.extra_args:
        cmd.extend([str(a) for a in options.extra_args])

    return cmd

# === Start AI endpoint (รับ body JSON เพื่อระบุโหมด) ===
@router.post("/ai/start")
async def start_ai(options: StartOptions):
    global PROCESS, READER_TASKS

    if PROCESS is not None and PROCESS.poll() is None:
        raise HTTPException(status_code=400, detail="AI is already running.")
    # --- 🔽 2. เพิ่มขั้นตอนการตรวจสอบ ROI ก่อนเริ่มทำงาน 🔽 ---
    invalid_cameras = validate_rois()
    if invalid_cameras:
        # สร้างข้อความ Error ที่ชัดเจน
        error_message = "ไม่สามารถเริ่ม AI ได้ พบปัญหากับ ROI ของกล้อง:\n" + "\n".join(f"  - {msg}" for msg in invalid_cameras)
        
        # ส่งข้อความ Error นี้ไปที่ Log Console ผ่าน WebSocket ก่อน
        await ws_manager.broadcast(f"[ERROR] {error_message}")
        
        # ส่ง HTTP Error กลับไปให้ Frontend เพื่อหยุดการทำงาน
        raise HTTPException(status_code=400, detail=error_message)
    await ws_manager.broadcast("=== AI Process Starting... ===")
    # config_path = Path(options.config_file_path) if options.config_file_path else CONFIG_FILE_PATH
    if not AI_DIR.exists():
        raise HTTPException(status_code=400, detail=f"AI_DIR not found: {AI_DIR}")

    if not PYTHON_EXE.exists():
        raise HTTPException(status_code=400, detail=f"Python executable not found: {PYTHON_EXE}")

    # build command
    cmd = _build_ai_command(options)

    # Windows: create new process group for CTRL_BREAK_EVENT support
    creationflags = 0
    startupinfo = None
    if sys.platform.startswith("win"):
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP

    try:
        PROCESS = subprocess.Popen(
            cmd,
            cwd=str(AI_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            bufsize=1,
            text=True,
            creationflags=creationflags
        )
    except Exception as e:
        PROCESS = None
        raise HTTPException(status_code=500, detail=f"Failed to start AI: {e}")

    # start tasks to read stdout/stderr
    loop = asyncio.get_running_loop()
    READER_TASKS = [
        loop.create_task(_read_stream(PROCESS.stdout, "STDOUT")),
        loop.create_task(_read_stream(PROCESS.stderr, "STDERR")),
    ]

    # notify clients
    await ws_manager.broadcast(f"=== AI Process Started (pid={PROCESS.pid}) ===")
    await ws_manager.broadcast(f"Command: {' '.join(cmd)}")

    return {"status": "success", "pid": PROCESS.pid, "command": cmd}

# === Stop AI endpoint ===
@router.post("/ai/stop")
async def stop_ai():
    global PROCESS, READER_TASKS
    if PROCESS is None or PROCESS.poll() is not None:
        raise HTTPException(status_code=400, detail="AI is not running.")

    try:
        if sys.platform.startswith("win"):
            # send CTRL_BREAK (works if CREATE_NEW_PROCESS_GROUP used at start)
            PROCESS.send_signal(signal.CTRL_BREAK_EVENT)
        else:
            PROCESS.terminate()
    except Exception as e:
        await ws_manager.broadcast(f"[STOP] Failed to signal process: {e}")

    try:
        await asyncio.wait_for(asyncio.to_thread(PROCESS.wait), timeout=10)
    except asyncio.TimeoutError:
        await ws_manager.broadcast("[STOP] Graceful stop timeout. Killing process...")
        try:
            PROCESS.kill()
        except Exception:
            pass
        await asyncio.to_thread(PROCESS.wait)

    # cancel reader tasks
    for t in READER_TASKS:
        try:
            t.cancel()
        except Exception:
            pass
    READER_TASKS = []
    PROCESS = None

    await ws_manager.broadcast("=== AI Process Stopped ===")
    return {"status": "success", "message": "AI stopped"}

# === Status endpoint ===
@router.get("/ai/status")
async def ai_status():
    if PROCESS is None or PROCESS.poll() is not None:
        return {"status": "stopped"}
    return {"status": "running", "pid": PROCESS.pid}

# === WebSocket for logs ===
@router.websocket("/ws/ai-logs")
async def ai_logs_ws(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        await websocket.send_text("--- Connected to AI Log Stream ---")
        # don't consume LOG_QUEUE here; _pump_to_websocket handles broadcasting,
        # here simply keep the connection open and optionally receive pings
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=30)
            except asyncio.TimeoutError:
                # loop, waiting for client keepalive or disconnection
                continue
    except WebSocketDisconnect:
        pass
    finally:
        await ws_manager.disconnect(websocket)

# startup: run background task to pump logs to websocket clients
@router.on_event("startup")
async def _on_startup():
    asyncio.create_task(_pump_to_websocket())
