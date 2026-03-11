@echo off
chcp 65001 >nul
title QA Server - START LOCAL

echo ========================================
echo  QA Server - START LOCAL
echo ========================================
echo.

echo [1/2] Stopping old Node.js processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo Done

echo.
echo [2/2] Starting Node.js server...
cd /d "%~dp0"
start "QA Node Server" node server.js
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo  SERVER STARTED!
echo ========================================
echo.
echo Local URL: http://localhost:8085
echo.
echo This window will close in 5 seconds...
timeout /t 5 /nobreak >nul
