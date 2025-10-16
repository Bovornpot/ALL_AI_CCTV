@echo off
cls
echo =======================================================
echo Starting CCTV Parking Monitor System...
echo =======================================================

REM --- กำหนดตำแหน่งของโปรเจกต์ ---
SET PROJECT_ROOT=%~dp0
SET BACKEND_DIR=%PROJECT_ROOT%backend
SET FRONTEND_DIR=%PROJECT_ROOT%frontend

REM --- ค้นหา IP Address ในเครือข่าย ---
echo.
echo [1/4] Finding your network IP address...
SET "NETWORK_IP="
FOR /F "tokens=2 delims=:" %%a IN ('ipconfig ^| findstr "IPv4"') DO (
    SET "NETWORK_IP=%%a"
)
SET NETWORK_IP=%NETWORK_IP: =%

IF NOT DEFINED NETWORK_IP (
    echo      WARNING: Could not find network IP. Using localhost as fallback.
    SET NETWORK_IP=localhost
) ELSE (
    echo      Found IP: %NETWORK_IP%
)

REM --- รัน Backend ---
echo.
echo [2/4] Starting Backend (FastAPI)...
start "Backend FastAPI" cmd /k "cd /d "%BACKEND_DIR%" && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

REM --- รอ Backend ---
echo      Waiting for backend to initialize (5 seconds)...
timeout /t 5 /nobreak >nul

REM --- รัน Frontend ---
echo.
echo [3/4] Starting Frontend (React)...
REM --- 🔽🔽🔽 นี่คือบรรทัดที่แก้ไข 🔽🔽🔽 ---
start "Frontend React" cmd /k "cd /d "%FRONTEND_DIR%" && set BROWSER=none&& npm start -- --host 0.0.0.0"

REM --- รอ Frontend ---
echo      Waiting for frontend to compile (8 seconds)...
timeout /t 8 /nobreak >nul

REM --- เปิดเบราว์เซอร์ ---
echo.
echo [4/4] Opening browser at http://%NETWORK_IP%:3000
start http://%NETWORK_IP%:3000
REM --- 🔼🔼🔼 สิ้นสุดการแก้ไข 🔼🔼🔼 ---

echo.
echo =======================================================
echo All services are starting up in new windows.
echo =======================================================
echo.
pause