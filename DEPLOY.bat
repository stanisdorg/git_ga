@echo off
chcp 65001 >nul
title DEPLOY: Dev -> Production

echo ========================================
echo  DEPLOY TO PRODUCTION
echo  From: git_ga-dev
echo  To:   git_ga (current folder)
echo ========================================
echo.

echo [1/4] Stopping production server...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo Done

echo.
echo [2/4] Copying application files...
echo.
echo Copying JavaScript files...
xcopy /E /I /Y /Q "git_ga-dev\*.js" ".\"
xcopy /E /I /Y /Q "git_ga-dev\ui-variants\*.js" "ui-variants\"
xcopy /E /I /Y /Q "git_ga-dev\srs\*.js" "srs\"
echo.
echo Copying HTML files...
xcopy /E /I /Y /Q "git_ga-dev\*.html" ".\"
echo.
echo Copying CSS files...
xcopy /E /I /Y /Q "git_ga-dev\*.css" ".\"
echo.
echo Copying batch files...
xcopy /E /I /Y /Q "git_ga-dev\*.bat" ".\"
echo Done!

echo.
echo [3/4] Copy node_modules?
echo.
echo Choose:
echo   y - Yes, if you installed new npm packages
echo   n - No, if you only changed your code (faster)
echo.
set /p copyNpm="Copy node_modules? (y/n): "

if /i "%copyNpm%"=="y" (
    echo.
    echo Copying node_modules (this may take a while)...
    xcopy /E /I /Y /Q "git_ga-dev\node_modules" "node_modules\"
    echo Done!
) else (
    echo Skipping node_modules.
)

echo.
echo [4/4] Starting production server...
timeout /t 2 /nobreak >nul
start "QA Production" cmd /k "title QA Production Server && echo Starting production server... && node server.js"
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo  DEPLOY COMPLETE!
echo ========================================
echo.
echo Production URL: http://localhost:8085
echo.
if /i "%copyNpm%"=="y" (
    echo [!] Remember to run: npm install
)
echo.
echo Now commit your changes to git:
echo   git add -A
echo   git commit -m "feat: your changes"
echo   git push
echo.

pause
