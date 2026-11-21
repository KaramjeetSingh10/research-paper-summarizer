@echo off
title ResearchAI - Academic Paper Summarizer
color 0B

echo ========================================================
echo        ResearchAI - Starting Full Stack Application
echo ========================================================
echo.

:: Get project root directory
set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"

echo [1/3] Launching FastAPI Backend (Port 8000)...
start "ResearchAI - Backend (FastAPI)" cmd /k "cd /d ""%PROJECT_ROOT%backend"" && call venv\Scripts\activate.bat && uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [2/3] Launching React Frontend (Port 5173)...
start "ResearchAI - Frontend (React)" cmd /k "cd /d ""%PROJECT_ROOT%frontend"" && npm run dev"

echo [3/3] Waiting for servers to initialize...
timeout /t 4 /nobreak >nul

echo.
echo ========================================================
echo  All services started!
echo    - Frontend : http://localhost:5173
echo    - Backend  : http://127.0.0.1:8000
echo    - API Docs : http://127.0.0.1:8000/docs
echo ========================================================
echo.
echo Opening browser...
start http://localhost:5173

echo.
echo Both servers are running in their respective windows.
echo To stop the application, simply close those terminal windows.
echo.
pause
