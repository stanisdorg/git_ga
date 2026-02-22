@echo off
chcp 65001 >nul
title QA Server Auto-Restart Monitor

echo ========================================
echo  QA Server Auto-Restart Monitor
echo ========================================
echo.

:loop
    echo [%date% %time%] Проверка сервера...
    
    REM Проверка Node.js сервера
    netstat -ano | findstr ":8085" >nul 2>&1
    if errorlevel 1 (
        echo [%date% %time%] Сервер не работает. Перезапуск...
        taskkill /F /IM node.exe >nul 2>&1
        timeout /t 1 /nobreak >nul
        start "QA Server" node server.js
        timeout /t 2 /nobreak >nul
    ) else (
        echo [%date% %time%] Сервер работает OK
    )
    
    REM Проверка Cloudflare Tunnel
    tasklist | findstr "cloudflared.exe" >nul 2>&1
    if errorlevel 1 (
        echo [%date% %time%] Cloudflare Tunnel не работает. Перезапуск...
        taskkill /F /FI "WINDOWTITLE eq Cloudflare*" >nul 2>&1
        timeout /t 1 /nobreak >nul
        start "Cloudflare Tunnel" c:\Users\web\Desktop\git_qa\git_ga\cloudflared.exe tunnel --config c:\Users\web\Desktop\git_qa\git_ga\cloudflared-config.yml run crispcode-qa
        timeout /t 2 /nobreak >nul
    ) else (
        echo [%date% %time%] Cloudflare Tunnel работает OK
    )
    
    echo.
    timeout /t 30 /nobreak >nul
    goto loop
