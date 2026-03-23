@echo off
chcp 65001 >nul
title QA Server - DUAL TUNNEL (ngrok + Cloudflare)

echo ========================================
echo  QA Server - DUAL TUNNEL
echo  (ngrok + Cloudflare)
echo ========================================
echo.

echo [1/4] Stopping old processes...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM ngrok.exe >nul 2>&1
taskkill /F /IM cloudflared.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo Done

echo.
echo [2/4] Starting Node.js server...
cd /d "%~dp0"
start "QA Node Server" node server.js
timeout /t 3 /nobreak >nul
echo Done

echo.
echo [3/4] Starting ngrok tunnel...
start "ngrok" ngrok http --url=reportorial-thermotactic-natalya.ngrok-free.dev 8085
timeout /t 3 /nobreak >nul
echo ngrok started (URL: https://reportorial-thermotactic-natalya.ngrok-free.dev)

echo.
echo [4/4] Starting Cloudflare tunnel...
cd /d "%~dp0"
set CLOUDFLARED_PATH=cloudflared.exe
if exist "%CLOUDFLARED_PATH%" (
    start "Cloudflare Tunnel" "%CLOUDFLARED_PATH%" tunnel --config cloudflared-config.yml run crispcode-qa
    echo Cloudflare started (URL: https://bytecards.ru)
) else (
    echo [ERROR] cloudflared.exe not found in %cd%
    echo Please make sure cloudflared.exe is placed in this directory.
)

echo.
echo ========================================
echo  EVERYTHING STARTED!
echo ========================================
echo.
echo ngrok: https://reportorial-thermotactic-natalya.ngrok-free.dev
echo Cloudflare: https://bytecards.ru
echo.
echo Check the separate windows for status!
echo.
echo ========================================
echo.
echo This window will close in 15 seconds...
timeout /t 15 /nobreak >nul
