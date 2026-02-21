@echo off
echo Monitoring Cloudflare Tunnel...

:loop
tasklist | findstr cloudflared.exe >nul
if errorlevel 1 (
    echo Tunnel stopped! Restarting...
    start /B c:\Users\web\Desktop\git_qa\git_ga\cloudflared.exe tunnel --config c:\Users\web\Desktop\git_qa\git_ga\cloudflared-config.yml run crispcode-qa
)
timeout /t 10 >nul
goto loop
