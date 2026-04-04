@echo off
chcp 65001 >nul
title ByteCards Documentation Server

echo.
echo ========================================
echo   ByteCards Documentation Server
echo ========================================
echo.

REM Check for Python
set PYTHON_CMD=

py --version >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON_CMD=py
    goto :found_python
)

python --version >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON_CMD=python
    goto :found_python
)

python3 --version >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON_CMD=python3
    goto :found_python
)

echo [ERROR] Python is not found!
echo.
echo Please install Python from https://python.org
echo.
pause
exit /b 1

:found_python
echo [OK] Python found! (using %PYTHON_CMD%)
echo.
echo Starting documentation server...
echo.
echo ========================================
echo   Main page: http://localhost:9000/index.html
echo   Swagger UI: http://localhost:9000/swagger.html
echo   Diagrams: http://localhost:9000/diagrams.html
echo   API Docs: http://localhost:9000/API.html
echo   Auth Docs: http://localhost:9000/AUTH.html
echo   OpenAPI: http://localhost:9000/openapi.yaml
echo ========================================
echo.
echo Press Ctrl+C to stop the server
echo.

cd /d "%~dp0"

REM Start custom Python HTTP server with YAML MIME type
%PYTHON_CMD% -c "from http.server import HTTPServer, SimpleHTTPRequestHandler; import mimetypes; mimetypes.add_type('application/yaml', '.yaml'); mimetypes.add_type('application/yaml', '.yml'); HTTPServer(('0.0.0.0', 9000), SimpleHTTPRequestHandler).serve_forever()"
