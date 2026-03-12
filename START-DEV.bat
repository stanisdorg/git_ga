@echo off
chcp 65001 >nul
title QA Server - DEVELOPMENT (Port 8086)

echo ========================================
echo  QA Server - DEVELOPMENT
echo ========================================
echo.

echo [1/2] Stopping old Node.js processes on port 8086...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8086" ^| find "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul
echo Done

echo.
echo [2/2] Starting Node.js server on port 8086...
cd /d "%~dp0"
set PORT=8086
start "QA Dev Server" node server.js
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo  DEV SERVER STARTED!
echo ========================================
echo.
echo Local URL: http://localhost:8086
echo.
echo NOTE: This is DEVELOPMENT version!
echo Production is on http://localhost:8085
echo.
echo This window will close in 5 seconds...
timeout /t 5 /nobreak >nul
