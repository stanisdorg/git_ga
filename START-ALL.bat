@echo off
chcp 65001 >nul
title QA Server - START ALL

echo ========================================
echo  QA Server - START ALL
echo  (Server + ngrok)
echo ========================================
echo.

echo [1/3] Stopping old processes...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM ngrok.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo Done

echo.
echo [2/3] Starting Node.js server...
cd /d "%~dp0"
start "QA Node Server" node server.js
timeout /t 3 /nobreak >nul
echo Done

echo.
echo [3/3] Starting ngrok tunnel...
start "ngrok" ngrok http 8085
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo  EVERYTHING STARTED!
echo ========================================
echo.
echo Check the "ngrok" window for your URL!
echo Look for: Forwarding https://...ngrok-free.dev
echo.
echo Copy that URL and open in browser!
echo.
echo ========================================
echo.
echo This window will close in 10 seconds...
timeout /t 10 /nobreak >nul
