# backend/app/main.py
from dotenv import load_dotenv 
import os 
from pathlib import Path
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path) 
print(f"AWS_ACCESS_KEY_ID: {os.environ.get('AWS_ACCESS_KEY_ID')}")

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from app.api.routers import parking, analytics,config_router,ai_control,ai_scheduler,frame_router
from app import database
import logging

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="AI CCTV Prototype Backend API",
    description="API for receiving and serving AI inference results from CCTV streams.",
    version="0.1.0"
)

app.add_middleware( 
    CORSMiddleware,
    allow_origins = ["*"], #ไว้มาแก้ไขเป็นOriginของ Frontend ตอนนี้ให้อนุญาติทั้งหมดไปก่อน
    allow_credentials = True,
    allow_methods = ["*"],
    allow_headers = ["*"],
)

# Create database tables on startup
@app.on_event("startup") 
def on_startup(): #runs when the FastAPI application starts up.
    database.create_db_tables()
    logger.info(f"Database tables ensured and ready.")

@app.get("/", tags=["Root"])
async def root():
    return {"message": "Welcome to AI CCTV Prototype Backend API!"}

@app.get("/health", status_code=status.HTTP_200_OK)
async def health_check(): #checking status endpoint
    return {"status": "ok", "message": "API is healthy and operational!"}

app.include_router(parking.router)
# app.include_router(table.router)
# app.include_router(chilled.router)
app.include_router(analytics.router, prefix="/api") 

app.include_router(config_router.router, prefix="/api")
app.include_router(ai_control.router, prefix="/api")
# app.include_router(ai_scheduler.router, prefix="/api")
app.include_router(frame_router.router, prefix="/api")
#เพิ่ม logเพื่อตรวจว่ามี route หรือไม่
for route in app.routes:
    print("🔹 ROUTE:", route.path)