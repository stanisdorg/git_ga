# QA Server Windows Service Installer
# Запускать от имени администратора!

Write-Host "========================================"
Write-Host "  Установка служб QA Server"
Write-Host "========================================"
Write-Host ""

# Проверка прав администратора
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ОШИБКА: Требуется запуск от имени администратора!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Нажмите правой кнопкой на этот файл -> 'Запуск от имени администратора'"
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Создание службы QA Server
Write-Host "[1/3] Создание службы QA Server..."
$nodePath = "C:\Program Files\nodejs\node.exe"
$serverPath = "c:\Users\web\Desktop\git_qa\git_ga\server.js"

try {
    sc.exe create QA-Server binPath= "`"$nodePath`" `"$serverPath`"" start= auto DisplayName= "QA Voice Assistant Server"
    sc.exe config QA-Server obj= "LocalSystem"
    sc.exe failure QA-Server reset= 30000 actions= restart/60000/restart/60000/restart/60000
    Write-Host "  ✓ Служба QA-Server создана" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Ошибка создания QA-Server: $_" -ForegroundColor Red
}

Write-Host ""

# Создание службы Cloudflare Tunnel
Write-Host "[2/3] Создание службы Cloudflare Tunnel..."
$cloudflaredPath = "c:\Users\web\Desktop\git_qa\git_ga\cloudflared.exe"
$configPath = "c:\Users\web\Desktop\git_qa\git_ga\cloudflared-config.yml"

try {
    sc.exe create Cloudflare-Tunnel binPath= "`"$cloudflaredPath`" tunnel --config `"$configPath`" run crispcode-qa" start= auto DisplayName= "Cloudflare Tunnel"
    sc.exe config Cloudflare-Tunnel obj= "LocalSystem"
    sc.exe failure Cloudflare-Tunnel reset= 30000 actions= restart/60000/restart/60000/restart/60000
    Write-Host "  ✓ Служба Cloudflare-Tunnel создана" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Ошибка создания Cloudflare-Tunnel: $_" -ForegroundColor Red
}

Write-Host ""

# Запуск служб
Write-Host "[3/3] Запуск служб..."
try {
    Start-Service QA-Server
    Write-Host "  ✓ QA-Server запущен" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Ошибка запуска QA-Server: $_" -ForegroundColor Red
}

try {
    Start-Service Cloudflare-Tunnel
    Write-Host "  ✓ Cloudflare-Tunnel запущен" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Ошибка запуска Cloudflare-Tunnel: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================"
Write-Host "  Готово!"
Write-Host "========================================"
Write-Host ""

# Статус служб
Write-Host "Статус служб:"
Get-Service QA-Server | Select-Object Name, Status, StartType
Get-Service Cloudflare-Tunnel | Select-Object Name, Status, StartType
Write-Host ""

Write-Host "Для остановки служб:"
Write-Host "  net stop QA-Server"
Write-Host "  net stop Cloudflare-Tunnel"
Write-Host ""

Write-Host "Для удаления служб:"
Write-Host "  sc delete QA-Server"
Write-Host "  sc delete Cloudflare-Tunnel"
Write-Host ""

Read-Host "Press Enter to exit"
