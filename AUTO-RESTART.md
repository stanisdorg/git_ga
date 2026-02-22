# 🔄 Автоматический перезапуск сервера

## 🎯 Варианты решения

### Вариант 1: Монитор с автоперезапуском (просто)

**Запуск:**
```bash
auto-restart.bat
```

**Что делает:**
- Каждые 30 секунд проверяет работу сервера и туннеля
- Автоматически перезапускает при падении
- Работает пока открыто окно консоли

**Для остановки:** Закройте окно консоли

---

### Вариант 2: Службы Windows (надёжно, рекомендуется)

**Требования:**
- NSSM (Non-Sucking Service Manager): https://nssm.cc/download
- Распаковать в `C:\nssm\`

**Установка:**
```bash
install-service.bat
```

**Что делает:**
- Устанавливает сервер как службу Windows
- Автозапуск при загрузке сервера
- Логирование в `logs/`
- Автоматический перезапуск при сбоях

**Проверка:**
```powershell
# Статус служб
sc query QA-Server
sc query Cloudflare-Tunnel

# Просмотр логов
Get-Content logs\server.log -Tail 50 -Wait
```

**Остановка:**
```powershell
net stop QA-Server
net stop Cloudflare-Tunnel
```

**Удаление:**
```bash
uninstall-service.bat
```

---

### Вариант 3: Ручной запуск (для тестов)

**Запуск:**
```bash
start-server.bat
```

**Остановка:**
```bash
stop-server.bat
```

---

## 📊 Логи

| Служба | Лог | Ошибки |
|--------|-----|--------|
| QA Server | `logs/server.log` | `logs/server-error.log` |
| Cloudflare | `logs/tunnel.log` | `logs/tunnel-error.log` |

**Просмотр в реальном времени:**
```powershell
Get-Content logs\server.log -Wait -Tail 100
```

---

## 🐛 Диагностика

### Сервер не запускается

```powershell
# Проверка порта
netstat -ano | findstr :8085

# Проверка Node.js
node --version

# Запуск в режиме отладки
node server.js
```

### Cloudflare не подключается

```powershell
# Проверка туннеля
tasklist | findstr cloudflared

# Проверка credentials
cloudflared.exe tunnel check

# Перелогиниться
cloudflared.exe tunnel login
```

### Служба не запускается

```powershell
# Проверка статуса
sc query QA-Server

# Просмотр логов службы
Get-Content logs\server-error.log -Tail 50

# Попытка запуска вручную
C:\nssm\nssm.exe start QA-Server
```

---

## 📈 Мониторинг

### PowerShell скрипт для проверки

```powershell
# Проверка всех компонентов
Write-Host "=== QA Server Status ==="
Write-Host "Node.js: $(node --version)"
Write-Host "Port 8085: $(if (netstat -ano | findstr ':8085') {'RUNNING'} else {'STOPPED'})"
Write-Host "Cloudflare: $(if (tasklist | findstr 'cloudflared') {'RUNNING'} else {'STOPPED'})"
Write-Host "HTTPS: $(try { (Invoke-WebRequest -Uri 'https://qa.crispcode.ru' -TimeoutSec 5).StatusCode } catch { 'ERROR' })"
```

---

## 🔐 Автозапуск при загрузке Windows

**Для варианта 1 (auto-restart.bat):**

1. Нажмите `Win + R`
2. Введите `shell:startup`
3. Создайте ярлык для `auto-restart.bat`

**Для варианта 2 (службы):** Already configured! ✅

---

## 💡 Рекомендации

| Сценарий | Решение |
|----------|---------|
| Локальная разработка | `start-server.bat` |
| Тестирование на сервере | `auto-restart.bat` |
| Продакшен (Reg.ru) | **Службы Windows** (`install-service.bat`) |

---

## 📞 Быстрые команды

```powershell
# Перезапуск служб
net stop QA-Server && net start QA-Server
net stop Cloudflare-Tunnel && net start Cloudflare-Tunnel

# Проверка доступности
curl http://localhost:8085/
curl https://qa.crispcode.ru/

# Просмотр процессов
tasklist | findstr "node cloudflared"
```
