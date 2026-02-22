@echo off
chcp 65001 >nul
echo ========================================
echo  Установка служб QA Server
echo ========================================
echo.

REM Проверка прав администратора
net session >nul 2>&1
if errorlevel 1 (
    echo Требуется запуск от администратора!
    echo.
    echo Нажмите правую кнопку на этом файле -^> "Запуск от имени администратора"
    echo.
    pause
    exit /b 1
)

echo [1/3] Создание службы QA Server...
sc create QA-Server binPath= "\"C:\Program Files\nodejs\node.exe\" \"c:\Users\web\Desktop\git_qa\git_ga\server.js\"" start= auto DisplayName= "QA Voice Assistant Server"
sc config QA-Server obj= "LocalSystem"
sc failure QA-Server reset= 30000 actions= restart/60000/restart/60000/restart/60000

echo.
echo [2/3] Создание службы Cloudflare Tunnel...
sc create Cloudflare-Tunnel binPath= "\"c:\Users\web\Desktop\git_qa\git_ga\cloudflared.exe\" tunnel --config c:\Users\web\Desktop\git_qa\git_ga\cloudflared-config.yml run crispcode-qa" start= auto DisplayName= "Cloudflare Tunnel"
sc config Cloudflare-Tunnel obj= "LocalSystem"
sc failure Cloudflare-Tunnel reset= 30000 actions= restart/60000/restart/60000/restart/60000

echo.
echo [3/3] Запуск служб...
net start QA-Server
net start Cloudflare-Tunnel

echo.
echo ========================================
echo  Готово!
echo ========================================
echo.
echo Статус служб:
sc query QA-Server | findstr "STATE"
sc query Cloudflare-Tunnel | findstr "STATE"
echo.
pause
