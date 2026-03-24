# Docker Cleanup & System Cleaner для Windows
# Запускать от имени администратора!

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Docker Cleanup & System Cleaner" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ========== ЧАСТЬ 1: Docker =========

Write-Host "[DOCKER] Проверка наличия Docker..." -ForegroundColor Yellow

$dockerInstalled = Get-Command docker -ErrorAction SilentlyContinue

if ($dockerInstalled) {
    Write-Host "[1/7] Остановка всех контейнеров..." -ForegroundColor Yellow
    docker stop $(docker ps -aq) 2>$null
    
    Write-Host "[2/7] Удаление всех контейнеров..." -ForegroundColor Yellow
    docker rm $(docker ps -aq) 2>$null
    
    Write-Host "[3/7] Удаление всех образов..." -ForegroundColor Yellow
    docker rmi $(docker images -q) 2>$null
    
    Write-Host "[4/7] Удаление всех volumes..." -ForegroundColor Yellow
    docker volume prune -f 2>$null
    
    Write-Host "[5/7] Удаление всех networks..." -ForegroundColor Yellow
    docker network prune -f 2>$null
    
    Write-Host "[6/7] Полная очистка Docker..." -ForegroundColor Yellow
    docker system prune -a -f --volumes 2>$null
    
    Write-Host "[7/7] Сброс Docker Desktop..." -ForegroundColor Yellow
    # Остановка Docker Desktop
    Stop-Process -Name "Docker Desktop" -Force -ErrorAction SilentlyContinue
    Stop-Process -Name "com.docker.backend" -Force -ErrorAction SilentlyContinue
    Stop-Process -Name "com.docker.docker" -Force -ErrorAction SilentlyContinue
    
    # Удаление данных Docker
    $dockerPaths = @(
        "$env:LOCALAPPDATA\Docker",
        "$env:LOCALAPPDATA\packages\DockerDesktop",
        "$env:USERPROFILE\.docker",
        "$env:PROGRAMDATA\Docker"
    )
    
    foreach ($path in $dockerPaths) {
        if (Test-Path $path) {
            Write-Host "  Удаление: $path" -ForegroundColor Gray
            Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
    
    Write-Host "[DOCKER] Очистка завершена!" -ForegroundColor Green
} else {
    Write-Host "[DOCKER] Не найден, пропускаем" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Удаление Docker Desktop" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Удаление Docker Desktop через winget
Write-Host "Удаление Docker Desktop через winget..." -ForegroundColor Yellow
winget uninstall "Docker Desktop" --purge -e 2>$null
Write-Host "Если winget не удалил - удалите вручную через Панель управления" -ForegroundColor Gray

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Очистка системы Windows" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ========== ЧАСТЬ 2: Очистка Windows =========

Write-Host "[1/10] Очистка временных файлов..." -ForegroundColor Yellow
$tempPaths = @(
    "$env:TEMP\*",
    "$env:TMP\*",
    "$env:LOCALAPPDATA\Temp\*",
    "C:\Windows\Temp\*"
)
foreach ($path in $tempPaths) {
    Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "[2/10] Очистка кэша обновлений Windows..." -ForegroundColor Yellow
Stop-Service -Name wuauserv -Force -ErrorAction SilentlyContinue
Stop-Service -Name bits -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Windows\SoftwareDistribution\Download\*" -Recurse -Force -ErrorAction SilentlyContinue
Start-Service -Name wuauserv -ErrorAction SilentlyContinue
Start-Service -Name bits -ErrorAction SilentlyContinue

Write-Host "[3/10] Очистка кэша Microsoft Store..." -ForegroundColor Yellow
wsreset -s 2>$null

Write-Host "[4/10] Очистка корзины..." -ForegroundColor Yellow
Clear-RecycleBin -Force -ErrorAction SilentlyContinue

Write-Host "[5/10] Очистка кэша эскизов..." -ForegroundColor Yellow
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache_*" -Force -ErrorAction SilentlyContinue

Write-Host "[6/10] Очистка кэша DNS..." -ForegroundColor Yellow
ipconfig /flushdns 2>$null

Write-Host "[7/10] Очистка кэша магазина Windows..." -ForegroundColor Yellow
Remove-Item -Path "$env:LOCALAPPDATA\Packages\*\AC\INetCache\*" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "[8/10] Очистка кэша браузеров..." -ForegroundColor Yellow
# Chrome
Remove-Item -Path "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cache\*" -Recurse -Force -ErrorAction SilentlyContinue
# Edge
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Cache\*" -Recurse -Force -ErrorAction SilentlyContinue
# Firefox
Remove-Item -Path "$env:LOCALAPPDATA\Mozilla\Firefox\Profiles\*\cache2\*" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "[9/10] Очистка старых логов..." -ForegroundColor Yellow
Remove-Item -Path "$env:LOCALAPPDATA\CrashDumps\*" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Windows\WER\*" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "[10/10] Очистка кэша PowerShell..." -ForegroundColor Yellow
Remove-Item -Path "$env:APPDATA\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt" -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Анализ занятого места" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$disk = Get-PSDrive C
Write-Host "Диск C:" -ForegroundColor White
Write-Host "  Занято: $([math]::Round($disk.Used / 1GB, 2)) ГБ" -ForegroundColor Red
Write-Host "  Свободно: $([math]::Round($disk.Free / 1GB, 2)) ГБ" -ForegroundColor Green
Write-Host ""

Write-Host "Топ-15 самых больших папок на диске C:" -ForegroundColor White
Write-Host "(Это может занять некоторое время...)" -ForegroundColor Gray
Write-Host ""

Get-ChildItem C:\ -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $size = (Get-ChildItem $_.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum -ErrorAction SilentlyContinue).Sum
    [PSCustomObject]@{
        Path = $_.FullName
        SizeGB = [math]::Round($size / 1GB, 2)
    }
} | Sort-Object SizeGB -Descending | Select-Object -First 15 | Format-Table -AutoSize

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Очистка завершена!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Рекомендуется перезагрузить компьютер" -ForegroundColor Yellow
Write-Host ""
Write-Host "Нажмите любую клавишу для выхода..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
