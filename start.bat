@echo off
echo ================================
echo Starting Car Parking Monitor System...
echo ================================

REM --- ตั้งชื่อ Conda environment ---
SET CONDA_ENV_NAME=car_parking_env

REM --- หา Conda activate อัตโนมัติ ---
SET CONDA_ACTIVATE_PATH=
IF EXIST "%USERPROFILE%\AppData\Local\anaconda3\Scripts\activate.bat" (
    SET CONDA_ACTIVATE_PATH=%USERPROFILE%\AppData\Local\anaconda3\Scripts\activate.bat
) ELSE IF EXIST "%USERPROFILE%\Miniconda3\Scripts\activate.bat" (
    SET CONDA_ACTIVATE_PATH=%USERPROFILE%\Miniconda3\Scripts\activate.bat
)

IF DEFINED CONDA_ACTIVATE_PATH (
    echo Conda activate found: %CONDA_ACTIVATE_PATH%
    CALL "%CONDA_ACTIVATE_PATH%" %CONDA_ENV_NAME%
) ELSE (
    echo WARNING: Conda activate not found. Make sure Anaconda/Miniconda is installed.
)

REM --- ตรวจสอบ Node.js ---
node -v >nul 2>&1
IF ERRORLEVEL 1 (
    echo WARNING: Node.js not found. Please install Node.js and add it to PATH.
) ELSE (
    echo Node.js detected.
)

REM --- ตั้ง project root เป็น path ปัจจุบัน ---
SET PROJECT_ROOT=%~dp0
SET APP_DIR=%PROJECT_ROOT%backend
SET FRONTEND_DIR=%PROJECT_ROOT%my-app

REM --- รัน Backend ใน Tab ใหม่ ---
echo --------------------------------------------
echo Starting Backend (FastAPI)...
start "" cmd /k "cd /d %APP_DIR% && uvicorn app.main:app --reload
REM --- รอ Backend สัก 3 วินาที ---
timeout /t 3 /nobreak >nul

REM --- รัน Frontend ใน Tab ใหม่ ---
echo Starting Frontend (Vite)...
start "" cmd /k "cd /d %FRONTEND_DIR% && npm run dev"

REM --- เปิด Browser ไปที่ frontend ---
echo Opening browser at http://localhost:5173
start http://localhost:5173

echo ============================================
echo All services started.
pause
