# QA Git Auto-Restart Script
# Автоматический перезапуск сервера после git операций

param(
    [string]$Message = "Auto commit"
)

Write-Host "========================================"
Write-Host "  QA Git Auto-Restart"
Write-Host "========================================"
Write-Host ""

# Функция для проверки сервера
function Test-Server {
    $result = netstat -ano | findstr ":8085"
    return $result -ne $null
}

# Функция для запуска сервера
function Start-QAServer {
    Write-Host "[Сервер] Запуск..."
    Start-Process "node" -ArgumentList "server.js" -WorkingDirectory "c:\Users\web\Desktop\git_qa\git_ga" -WindowStyle Hidden
    Start-Sleep -Seconds 2
    
    if (Test-Server) {
        Write-Host "[Сервер] ✓ Запущен" -ForegroundColor Green
    } else {
        Write-Host "[Сервер] ✗ Ошибка запуска" -ForegroundColor Red
    }
}

# Остановка старого сервера
Write-Host "[Сервер] Остановка старого процесса..."
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue 2>$null
Start-Sleep -Seconds 1

# Запуск нового сервера
Start-QAServer

# Git операции
Write-Host ""
Write-Host "[Git] Добавление файлов..."
git add -A

Write-Host "[Git] Коммит: $Message"
git commit -m $Message

Write-Host "[Git] Push..."
git push origin main

Write-Host ""
Write-Host "========================================"
Write-Host "  Готово!"
Write-Host "========================================"
Write-Host ""

# Проверка сервера после git
if (Test-Server) {
    Write-Host "[Проверка] ✓ Сервер работает" -ForegroundColor Green
} else {
    Write-Host "[Проверка] Сервер упал, перезапуск..." -ForegroundColor Yellow
    Start-QAServer
}

Write-Host ""
Write-Host "Сайт доступен:"
Write-Host "  - http://localhost:8085"
Write-Host "  - https://qa.crispcode.ru"
Write-Host ""
