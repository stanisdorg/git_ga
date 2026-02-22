@echo off
chcp 65001 >nul
title QA Server - Auto Restart

echo ========================================
echo  QA Server - Auto Restart Mode
echo ========================================
echo.
echo Сервер будет автоматически перезапускаться при сбоях.
echo Для остановки закройте это окно.
echo.

:restart
    echo [%date% %time%] Запуск сервера...
    
    REM Запуск Node.js сервера в фоне этого процесса
    start "QA Server" /B node server.js
    set SERVER_PID=!ERRORLEVEL!
    
    REM Запуск Cloudflare Tunnel
    start "Cloudflare Tunnel" /B c:\Users\web\Desktop\git_qa\git_ga\cloudflared.exe tunnel --config c:\Users\web\Desktop\git_qa\git_ga\cloudflared-config.yml run crispcode-qa
    
    echo [%date% %time%] Серверы запущены. Мониторинг...
    echo.
    
    REM Мониторинг
    :loop
        timeout /t 30 /nobreak >nul
        
        REM Проверка Node.js
        netstat -ano | findstr ":8085" >nul 2>&1
        if errorlevel 1 (
            echo [%date% %time%] Сервер упал! Перезапуск...
            taskkill /F /IM node.exe >nul 2>&1
            goto restart
        )
        
        REM Проверка Cloudflare
        tasklist | findstr "cloudflared.exe" >nul 2>&1
        if errorlevel 1 (
            echo [%date% %time%] Cloudflare упал! Перезапуск...
            taskkill /F /FI "WINDOWTITLE eq Cloudflare*" >nul 2>&1
            start "Cloudflare Tunnel" /B c:\Users\web\Desktop\git_qa\git_ga\cloudflared.exe tunnel --config c:\Users\web\Desktop\git_qa\git_ga\cloudflared-config.yml run crispcode-qa
        )
        
        goto loop
