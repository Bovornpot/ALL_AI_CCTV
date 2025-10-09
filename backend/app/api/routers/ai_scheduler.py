from fastapi import APIRouter
import schedule
import time
import asyncio
from concurrent.futures import ThreadPoolExecutor
from app.api.routers import ai_control

router = APIRouter(tags=["AI Scheduler"])

# โหมดการทำงาน: Auto (True) หรือ Manual (False)
AUTO_MODE = True

# === ฟังก์ชันตามช่วงเวลา ===
async def prime_time():
    if AUTO_MODE:
        print("Prime Time: Running AI (45% load)")
        await ai_control.start_ai()

async def normal_time():
    if AUTO_MODE:
        print("Normal Time: Running AI (35% load)")
        await ai_control.start_ai()

async def off_time():
    if AUTO_MODE:
        print("Off Time: Stopping AI")
        await ai_control.stop_ai()

# === ตั้งเวลา ===
schedule.every().day.at("07:00").do(lambda: asyncio.create_task(prime_time()))
schedule.every().day.at("09:00").do(lambda: asyncio.create_task(off_time()))
schedule.every().day.at("11:00").do(lambda: asyncio.create_task(normal_time()))
schedule.every().day.at("14:00").do(lambda: asyncio.create_task(off_time()))
schedule.every().day.at("17:00").do(lambda: asyncio.create_task(prime_time()))
schedule.every().day.at("20:00").do(lambda: asyncio.create_task(normal_time()))
schedule.every().day.at("23:00").do(lambda: asyncio.create_task(off_time()))

# === background task loop ===
def _run_scheduler_loop():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    async def runner():
        while True:
            schedule.run_pending()
            await asyncio.sleep(1)

    loop.run_until_complete(runner())

@router.on_event("startup")
async def start_scheduler():
    executor = ThreadPoolExecutor(max_workers=1)
    loop = asyncio.get_running_loop()
    loop.run_in_executor(executor, _run_scheduler_loop)
    print("AI Scheduler started")

# === API สำหรับสลับโหมด ===
@router.post("/ai/auto/on")
async def enable_auto():
    global AUTO_MODE
    AUTO_MODE = True
    return {"status": "success", "message": "Auto mode enabled"}

@router.post("/ai/auto/off")
async def disable_auto():
    global AUTO_MODE
    AUTO_MODE = False
    return {"status": "success", "message": "Auto mode disabled"}
