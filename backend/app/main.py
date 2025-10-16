# # backend/app/main.py
# from dotenv import load_dotenv 
# import os 
# from pathlib import Path
# env_path = Path(__file__).parent / ".env"
# load_dotenv(dotenv_path=env_path) 
# print(f"AWS_ACCESS_KEY_ID: {os.environ.get('AWS_ACCESS_KEY_ID')}")

# from fastapi import FastAPI, Depends, HTTPException, status
# from fastapi.middleware.cors import CORSMiddleware
# from app.api.routers import parking, analytics,config_router,ai_control,ai_scheduler,frame_router
# from app import database
# import logging

# logger = logging.getLogger(__name__)
# logging.basicConfig(level=logging.INFO)

# app = FastAPI(
#     title="AI CCTV Prototype Backend API",
#     description="API for receiving and serving AI inference results from CCTV streams.",
#     version="0.1.0"
# )
# origins = [
#     "http://localhost:3000",      # <-- ที่อยู่ของ React App (Frontend)
#     "http://127.0.0.1:3000",    # <-- ที่อยู่เดียวกัน แต่อีกรูปแบบหนึ่ง
#     # (ถ้าคุณเข้าเว็บผ่าน IP อื่น เช่น 10.152.13.90 ก็เพิ่มเข้าไปด้วย)
#     "http://10.152.13.90:3000",
# ]

# app.add_middleware( 
#     CORSMiddleware,
#     allow_origins=origins, #ไว้มาแก้ไขเป็นOriginของ Frontend ตอนนี้ให้อนุญาติทั้งหมดไปก่อน
#     allow_credentials = True,
#     allow_methods = ["*"],
#     allow_headers = ["*"],
# )

# # Create database tables on startup
# @app.on_event("startup") 
# def on_startup(): #runs when the FastAPI application starts up.
#     database.create_db_tables()
#     logger.info(f"Database tables ensured and ready.")

# @app.get("/", tags=["Root"])
# async def root():
#     return {"message": "Welcome to AI CCTV Prototype Backend API!"}

# @app.get("/health", status_code=status.HTTP_200_OK)
# async def health_check(): #checking status endpoint
#     return {"status": "ok", "message": "API is healthy and operational!"}

# app.include_router(parking.router)
# # app.include_router(table.router)
# # app.include_router(chilled.router)
# app.include_router(analytics.router, prefix="/api") 

# app.include_router(config_router.router, prefix="/api")
# app.include_router(ai_control.router, prefix="/api")
# # app.include_router(ai_scheduler.router, prefix="/api")
# app.include_router(frame_router.router, prefix="/api")
# #เพิ่ม logเพื่อตรวจว่ามี route หรือไม่
# for route in app.routes:
#     print("🔹 ROUTE:", route.path)

# backend/app/main.py
from dotenv import load_dotenv
import os
from pathlib import Path

# --- Load Environment Variables ---
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)
print(f"AWS_ACCESS_KEY_ID: {os.environ.get('AWS_ACCESS_KEY_ID')}")

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import Response
from app.api.routers import parking, analytics, config_router, ai_control, frame_router
from app import database
import logging

# --- Configure Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - [%(name)s] - %(message)s')
logger = logging.getLogger(__name__)

# --- Create FastAPI App ---
app = FastAPI(
    title="AI CCTV Prototype Backend API",
    description="API for receiving and serving AI inference results from CCTV streams.",
    version="0.1.0"
)

# # --- 🔽🔽🔽 เพิ่ม Middleware สำหรับวินิจฉัย 🔽🔽🔽 ---
# # Middleware นี้จะทำงานก่อน CORS และจะ Log Header ที่สำคัญให้เราเห็น
# @app.middleware("http")
# async def log_headers_middleware(request: Request, call_next):
#     origin = request.headers.get('origin')
#     host = request.headers.get('host')
#     logger.info(f"--- DIAGNOSTIC --- Incoming request to: {request.url.path}")
#     logger.info(f"--- DIAGNOSTIC --- Request Origin Header: [ {origin} ]")
#     logger.info(f"--- DIAGNOSTIC --- Request Host Header:   [ {host} ]")
#     response = await call_next(request)
#     return response
# # --- 🔼🔼🔼 สิ้นสุด Middleware สำหรับวินิจฉัย 🔼🔼🔼 ---


# --- แก้ไขการตั้งค่า CORS ให้ถูกต้องและสมบูรณ์ ---
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://10.152.13.90:3000", # เพิ่มจาก Log ของคุณ
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Database Startup Event ---
@app.on_event("startup")
def on_startup():
    try:
        database.create_db_tables()
        logger.info("Database tables ensured and ready.")
    except Exception as e:
        logger.critical(f"FATAL: Could not connect to the database on startup: {e}", exc_info=True)


# --- Root and Health Endpoints ---
@app.get("/", tags=["Root"])
async def root():
    return {"message": "Welcome to AI CCTV Prototype Backend API!"}

@app.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    return {"status": "ok", "message": "API is healthy and operational!"}

# --- Include Routers ---
app.include_router(parking.router)
app.include_router(analytics.router, prefix="/api")
app.include_router(config_router.router, prefix="/api")
app.include_router(ai_control.router, prefix="/api")
app.include_router(frame_router.router, prefix="/api")

# # --- Log All Registered Routes on Startup ---
# logger.info("--- REGISTERED ROUTES ---")
# for route in app.routes:
#     if hasattr(route, "methods"):
#         logger.info(f"🔹 PATH: {route.path} METHODS: {route.methods}")
#     else:
#         logger.info(f"🔹 PATH: {route.path} (WebSocket)")
# logger.info("-------------------------")