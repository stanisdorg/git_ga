@echo off
chcp 65001 >nul
echo ========================================
echo   Docker Cleanup Script
echo   Очистка Docker и системы Windows
echo ========================================
echo.

:: Проверка Docker
echo [1/6] Проверка Docker...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Docker не найден, пропускаем очистку Docker
    goto :docker_cleanup_done
)

echo [2/6] Остановка всех контейнеров...
docker stop $(docker ps -aq) 2>nul

echo [3/6] Удаление всех контейнеров...
docker rm $(docker ps -aq) 2>nul

echo [4/6] Удаление всех образов...
docker rmi $(docker images -q) 2>nul

echo [5/6] Очистка volumes...
docker volume prune -f 2>nul

echo [6/6] Полная очистка системы Docker...
docker system prune -a -f --volumes 2>nul

:docker_cleanup_done
echo.
echo ========================================
echo   Очистка Docker завершена
echo ========================================
echo.

:: Очистка временных файлов Windows
echo [1/4] Очистка временных файлов Windows...
del /q /s %TEMP%\* 2>nul
del /q /s C:\Windows\Temp\* 2>nul

echo [2/4] Очистка кэша Microsoft Store...
wsreset -s 2>nul

echo [3/4] Очистка кэша обновлений Windows...
net stop wuauserv 2>nul
net stop bits 2>nul
del /q /s C:\Windows\SoftwareDistribution\Download\* 2>nul
net start wuauserv 2>nul
net start bits 2>nul

echo [4/4] Очистка корзины...
powershell -Command "Clear-RecycleBin -Force" 2>nul

echo.
echo ========================================
echo   Очистка системы завершена
echo ========================================
echo.

:: Анализ занятого места
echo Анализ занятого места на диске C:...
powershell -Command "Get-PSDrive C | Select-Object Name,Used,Free,Root | Format-List"
echo.

:: Поиск больших папок
echo Топ-10 самых больших папок на диске C:
powershell -Command "Get-ChildItem C:\ -Directory -ErrorAction SilentlyContinue | ForEach-Object { $size = (Get-ChildItem $_.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum; [PSCustomObject]@{Path=$_.FullName; SizeGB=[math]::Round($size/1GB,2)} } | Sort-Object SizeGB -Descending | Select-Object -First 10 | Format-Table -AutoSize"
echo.

pause
