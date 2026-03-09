@echo off
chcp 65001 >nul
title Cloudflare Tunnel - Single Instance

set CLOUDFLARED_PATH=c:\Users\web\Desktop\git_qa\git_ga\cloudflared.exe

echo ========================================
echo  Cloudflare Tunnel - Single Instance
echo ========================================
echo.

echo Checking for existing cloudflared processes...
tasklist /FI "IMAGENAME eq cloudflared.exe" /NH | find "cloudflared" >nul 2>&1
if not errorlevel 1 (
    echo Found existing cloudflared processes. Killing them...
    taskkill /F /IM cloudflared.exe >nul 2>&1
    timeout /t 3 /nobreak >nul
    echo Done
) else (
    echo No existing processes found.
)

echo.
echo Starting Cloudflare Tunnel...
cd /d "c:\Users\web\Desktop\git_qa\git_ga"
"%CLOUDFLARED_PATH%" tunnel --config cloudflared-config.yml run crispcode-qa

pause
