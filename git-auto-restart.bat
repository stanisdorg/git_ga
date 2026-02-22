@echo off
chcp 65001 >nul
title QA Git Auto-Restart

echo ========================================
echo  QA Git + Auto-Restart
echo ========================================
echo.
echo Использование: git-auto-restart.bat [git-команды]
echo Пример: git-auto-restart.bat add -A ^&^& commit -m "message" ^&^& push
echo.

REM Запуск сервера в фоне
echo [1/2] Запуск сервера...
start "QA Server" /MIN node server.js
timeout /t 2 /nobreak >nul

REM Проверка работы сервера
netstat -ano | findstr ":8085" >nul 2>&1
if errorlevel 1 (
    echo ОШИБКА: Не удалось запустить сервер!
    pause
    exit /b 1
)
echo Сервер запущен OK

REM Запуск Cloudflare если не работает
tasklist | findstr "cloudflared.exe" >nul 2>&1
if errorlevel 1 (
    echo [2/2] Запуск Cloudflare Tunnel...
    start "Cloudflare Tunnel" /MIN c:\Users\web\Desktop\git_qa\git_ga\cloudflared.exe tunnel --config c:\Users\web\Desktop\git_qa\git_ga\cloudflared-config.yml run crispcode-qa
    timeout /t 3 /nobreak >nul
) else (
    echo [2/2] Cloudflare Tunnel уже работает
)

echo.
echo ========================================
echo  Готово! Сервер работает.
echo ========================================
echo.
echo - http://localhost:8085
echo - https://qa.crispcode.ru
echo.
echo Окно можно закрыть - сервер продолжит работу.
echo.
