@echo off
title ResearchAI - Stop Servers
color 0C

echo ========================================================
echo        ResearchAI - Stopping All Services
echo ========================================================
echo.

echo Stopping FastAPI Backend (port 8000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do taskkill /f /pid %%a 2>nul

echo Stopping React Vite Frontend (port 5173)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do taskkill /f /pid %%a 2>nul

echo.
echo ========================================================
echo  All services stopped successfully!
echo ========================================================
echo.
pause
