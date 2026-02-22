@echo off
chcp 65001 >nul
echo ========================================
echo  Удаление служб QA Server
echo ========================================
echo.

echo [1/2] Остановка служб...
net stop QA-Server
net stop Cloudflare-Tunnel

echo [2/2] Удаление служб...
C:\nssm\nssm.exe remove QA-Server confirm
C:\nssm\nssm.exe remove Cloudflare-Tunnel confirm

echo.
echo Готово! Службы удалены.
echo.
pause
