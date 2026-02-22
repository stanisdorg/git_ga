@echo off
echo Остановка сервера...
taskkill /F /FI "WINDOWTITLE eq QA Server*" /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Cloudflare Tunnel*" /T >nul 2>&1
echo Сервер остановлен.
