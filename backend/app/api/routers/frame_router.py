# app/api/routers/frame_router.py

# --- 🔽 1. แก้ไข Import ให้ครบถ้วน 🔽 ---
from fastapi import (
    APIRouter, WebSocket, WebSocketDisconnect, Request, 
    HTTPException, Response, status
)
from typing import Dict, Set
import asyncio
import logging

# --- 🔽 2. สร้าง Logger สำหรับไฟล์นี้ 🔽 ---
logger = logging.getLogger(__name__)

router = APIRouter(tags=["Frames"])

# clients per camera_id
_clients: Dict[str, Set[WebSocket]] = {}
_clients_lock = asyncio.Lock()

# --- 🔽 3. แก้ไขฟังก์ชัน ws_frames ให้ "หุ้มเกราะ" 🔽 ---
@router.websocket("/ws/ai-frames/{camera_id}")
async def ws_frames(websocket: WebSocket, camera_id: str):
    await websocket.accept()
    async with _clients_lock:
        _clients.setdefault(camera_id, set()).add(websocket)
    
    logger.info(f"Client connected for camera_id: {camera_id}")
    
    try:
        # Keep connection alive
        while True:
            # รอรับข้อความ (ping/pong) จาก client เพื่อเช็คว่ายังเชื่อมต่ออยู่
            # ถ้า client หลุดไปโดยไม่บอกลา (เช่น ปิดแท็บเบราว์เซอร์)
            # await websocket.receive_text() จะ raise WebSocketDisconnect
            await websocket.receive_text()

    except WebSocketDisconnect:
        # logger.info(f"Client disconnected gracefully for camera_id: {camera_id}")
        pass
    except Exception as e:
        # **นี่คือส่วนที่สำคัญที่สุด**
        # ดักจับ Error อื่นๆ ที่ไม่คาดคิดทั้งหมด แล้ว log มันออกมา
        # logger.error(f"An unexpected error occurred in WebSocket for {camera_id}: {e}", exc_info=True)
        pass
    finally:
        # ไม่ว่าจะเกิดอะไรขึ้น ส่วนนี้จะทำงานเสมอ เพื่อเคลียร์การเชื่อมต่อ
        async with _clients_lock:
            if camera_id in _clients and websocket in _clients[camera_id]:
                _clients[camera_id].remove(websocket)
        # logger.info(f"Cleaned up client for camera_id: {camera_id}")


# --- 🔽 4. แก้ไขฟังก์ชัน _broadcast_bytes ให้สมบูรณ์ 🔽 ---
async def _broadcast_bytes(camera_id: str, b: bytes):
    """ส่ง binary JPEG ไปยังทุก client ของ camera_id"""
    async with _clients_lock:
        clients_to_send = list(_clients.get(camera_id, set()))

    if not clients_to_send:
        return

    send_tasks = [ws.send_bytes(b) for ws in clients_to_send]
    results = await asyncio.gather(*send_tasks, return_exceptions=True)
    
    for ws, result in zip(clients_to_send, results):
        if isinstance(result, Exception):
            logger.error(f"Error broadcasting to client for {camera_id}: {result}. Removing client.")
            async with _clients_lock:
                if camera_id in _clients and ws in _clients[camera_id]:
                    _clients[camera_id].remove(ws)


# --- 🔽 5. แก้ไขฟังก์ชัน publish_frame ให้สมบูรณ์ 🔽 ---
@router.post("/frames/{camera_id}")
async def publish_frame(camera_id: str, request: Request):
    """
    รับ POST image/jpeg binary จาก camera worker
    """
    # ตรวจสอบ content-type
    ct = request.headers.get("content-type", "")
    if "image/jpeg" not in ct and "image/jpg" not in ct:
        raise HTTPException(status_code=400, detail=f"Unsupported content-type: {ct}")
    
    # อ่านข้อมูลภาพ
    b = await request.body()
    if not b:
        raise HTTPException(status_code=400, detail="Empty body")
    
    # สร้าง task ให้ส่งภาพไปเบื้องหลัง จะได้ไม่ block AI worker
    asyncio.create_task(_broadcast_bytes(camera_id, b))
    
    # คืนค่า 204 No Content เพื่อบอก AI worker ว่ารับทราบแล้ว
    return Response(status_code=status.HTTP_204_NO_CONTENT)