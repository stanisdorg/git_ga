@echo off
chcp 65001 >nul
title QA Server - START NGROK

echo ========================================
echo  QA Server - START NGROK
echo ========================================
echo.

echo [1/2] Stopping old ngrok processes...
taskkill /F /IM ngrok.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo Done

echo.
echo [2/2] Starting ngrok tunnel...
cd /d "%~dp0"
start "ngrok" ngrok http --url=reportorial-thermotactic-natalya.ngrok-free.dev 8085
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo  NGROK STARTED!
echo ========================================
echo.
echo Your URL: https://reportorial-thermotactic-natalya.ngrok-free.dev
echo.
echo Check the "ngrok" window for status!
echo Or open: http://127.0.0.1:4040
echo.
echo This window will close in 10 seconds...
timeout /t 10 /nobreak >nul
