@echo off
chcp 65001 >nul
title Running User Isolation Tests

echo ========================================
echo  USER ISOLATION AUTOTESTS
echo ========================================
echo.
echo Starting tests...
echo.

cd /d "%~dp0.."

REM Run Playwright tests
npx playwright test tests/test-user-isolation-ui.spec.ts --headed --reporter=list

echo.
echo ========================================
echo  TESTS COMPLETE
echo ========================================
echo.

pause
