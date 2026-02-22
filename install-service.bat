@echo off
chcp 65001 >nul
echo ========================================
echo  Установка служб QA Server
echo ========================================
echo.

REM Проверка NSSM
if not exist "C:\nssm\nssm.exe" (
    echo ОШИБКА: NSSM не найден!
    echo.
    echo Скачайте NSSM: https://nssm.cc/download
    echo Распакуйте в C:\nssm\
    echo.
    pause
    exit /b 1
)

echo [1/4] Установка службы QA Server...
C:\nssm\nssm.exe install QA-Server "C:\Program Files\nodejs\node.exe" "c:\Users\web\Desktop\git_qa\git_ga\server.js"
C:\nssm\nssm.exe set QA-Server AppDirectory "c:\Users\web\Desktop\git_qa\git_ga"
C:\nssm\nssm.exe set QA-Server DisplayName "QA Voice Assistant Server"
C:\nssm\nssm.exe set QA-Server Description "Сервер для синхронизации данных QA Assistant"
C:\nssm\nssm.exe set QA-Server Start SERVICE_AUTO_START

echo [2/4] Установка службы Cloudflare Tunnel...
C:\nssm\nssm.exe install Cloudflare-Tunnel "c:\Users\web\Desktop\git_qa\git_ga\cloudflared.exe" "tunnel --config c:\Users\web\Desktop\git_qa\git_ga\cloudflared-config.yml run crispcode-qa"
C:\nssm\nssm.exe set Cloudflare-Tunnel AppDirectory "c:\Users\web\Desktop\git_qa\git_ga"
C:\nssm\nssm.exe set Cloudflare-Tunnel DisplayName "Cloudflare Tunnel"
C:\nssm\nssm.exe set Cloudflare-Tunnel Description "Cloudflare Tunnel для доступа к QA Server"
C:\nssm\nssm.exe set Cloudflare-Tunnel Start SERVICE_AUTO_START

echo [3/4] Настройка логов...
C:\nssm\nssm.exe set QA-Server AppStdout "c:\Users\web\Desktop\git_qa\git_ga\logs\server.log"
C:\nssm\nssm.exe set QA-Server AppStderr "c:\Users\web\Desktop\git_qa\git_ga\logs\server-error.log"
C:\nssm\nssm.exe set Cloudflare-Tunnel AppStdout "c:\Users\web\Desktop\git_qa\git_ga\logs\tunnel.log"
C:\nssm\nssm.exe set Cloudflare-Tunnel AppStderr "c:\Users\web\Desktop\git_qa\git_ga\logs\tunnel-error.log"

if not exist "c:\Users\web\Desktop\git_qa\git_ga\logs" mkdir "c:\Users\web\Desktop\git_qa\git_ga\logs"

echo [4/4] Запуск служб...
net start QA-Server
net start Cloudflare-Tunnel

echo.
echo ========================================
echo  Готово! Службы установлены и запущены.
echo ========================================
echo.
echo Для просмотра логов:
echo   - Сервер: c:\Users\web\Desktop\git_qa\git_ga\logs\server.log
echo   - Tunnel: c:\Users\web\Desktop\git_qa\git_ga\logs\tunnel.log
echo.
echo Для остановки служб:
echo   net stop QA-Server
echo   net stop Cloudflare-Tunnel
echo.
echo Для удаления служб:
echo   C:\nssm\nssm.exe remove QA-Server confirm
echo   C:\nssm\nssm.exe remove Cloudflare-Tunnel confirm
echo.
pause
