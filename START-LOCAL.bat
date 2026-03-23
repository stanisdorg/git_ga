@echo off
chcp 65001 >nul
title QA Server - PRODUCTION (Port 8085)

echo ========================================
echo  QA Server - PRODUCTION
echo ========================================
echo.

echo [1/2] Stopping old Node.js processes on port 8085...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8085" ^| find "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul
echo Done

echo.
echo [2/2] Starting Node.js server on port 8085...
cd /d "%~dp0"
set PORT=8085
start "QA Production Server" node server.js
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo  PRODUCTION SERVER STARTED!
echo ========================================
echo.
echo Local URL: http://localhost:8085
echo ngrok URL: https://reportorial-thermotactic-natalya.ngrok-free.dev
echo Cloudflare URL: https://bytecards.ru
echo.
echo This window will close in 5 seconds...
timeout /t 5 /nobreak >nul
