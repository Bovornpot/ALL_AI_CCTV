# app/api/routers/frame_router.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request, HTTPException
from typing import Dict, Set
import asyncio

router = APIRouter(tags=["Frames"])

# clients per camera_id
_clients: Dict[str, Set[WebSocket]] = {}
_clients_lock = asyncio.Lock()

@router.websocket("/ws/ai-frames/{camera_id}")
async def ws_frames(websocket: WebSocket, camera_id: str):
    await websocket.accept()
    async with _clients_lock:
        _clients.setdefault(camera_id, set()).add(websocket)
    try:
        # keep connection alive; clients usually don't send messages
        while True:
            try:
                # keepalive receive with timeout so disconnect is detected
                await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                # continue waiting
                continue
    except WebSocketDisconnect:
        pass
    finally:
        async with _clients_lock:
            if camera_id in _clients and websocket in _clients[camera_id]:
                _clients[camera_id].remove(websocket)

async def _broadcast_bytes(camera_id: str, b: bytes):
    """ส่ง binary JPEG ไปยังทุก client ของ camera_id"""
    async with _clients_lock:
        clients = list(_clients.get(camera_id, set()))
    if not clients:
        return  # ไม่มีใครดูอยู่ -> ไม่ต้องทำอะไร
    send_tasks = []
    for ws in clients:
        async def _send(ws_local):
            try:
                await ws_local.send_bytes(b)
            except Exception:
                # best-effort: close and remove on exception
                try:
                    await ws_local.close()
                except:
                    pass
                async with _clients_lock:
                    if camera_id in _clients and ws_local in _clients[camera_id]:
                        _clients[camera_id].remove(ws_local)
        send_tasks.append(_send(ws))
    if send_tasks:
        await asyncio.gather(*send_tasks, return_exceptions=True)

@router.post("/api/frames/{camera_id}")
async def publish_frame(camera_id: str, request: Request):
    """
    รับ POST image/jpeg binary จาก main_monitor (หรือ camera worker)
    body: raw JPEG bytes, header content-type: image/jpeg
    """
    ct = request.headers.get("content-type", "")
    if "image/jpeg" not in ct and "image/jpg" not in ct:
        # ยังยอมรับ JSON base64 แบบ fallback
        try:
            data = await request.json()
            b64 = data.get("data") or data.get("img")
            if not b64:
                raise HTTPException(status_code=400, detail="Missing image data")
            import base64
            b = base64.b64decode(b64)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Unsupported content-type and cannot parse body: {e}")
    else:
        b = await request.body()
        if not b:
            raise HTTPException(status_code=400, detail="Empty body")
    # broadcast asynchronously (don't block caller long)
    asyncio.create_task(_broadcast_bytes(camera_id, b))
    return {"status": "ok", "camera_id": camera_id}
