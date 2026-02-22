@echo off
chcp 65001 >nul
echo ========================================
echo  Сервер QA Assistant + Cloudflare Tunnel
echo ========================================
echo.

REM Запуск Node.js сервера на порту 8085
echo [1/2] Запуск сервера на порту 8085...
start "QA Server" node server.js

timeout /t 2 /nobreak >nul

REM Запуск Cloudflare Tunnel
echo [2/2] Запуск Cloudflare Tunnel...
start "Cloudflare Tunnel" c:\Users\web\Desktop\git_qa\git_ga\cloudflared.exe tunnel --config c:\Users\web\Desktop\git_qa\git_ga\cloudflared-config.yml run crispcode-qa

echo.
echo ========================================
echo  Сервер запущен!
echo  - Локально: http://localhost:8085
echo  - Через Cloudflare: https://qa.crispcode.ru
echo ========================================
echo.
echo Нажмите Ctrl+C для остановки
