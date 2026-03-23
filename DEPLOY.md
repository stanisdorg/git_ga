# 🚀 Развертывание QA Assistant на Reg.ru с Cloudflare Tunnel

## 📋 Требования

1. **Node.js** (версия 18+)
2. **Cloudflare Tunnel** (cloudflared.exe)
3. **Домен** на Cloudflare (crispcode.ru)
4. **Сервер** на Reg.ru (Windows/Linux)

---

## 🔧 Локальная разработка (Windows)

### 1. Запуск сервера и туннелей

Для локальной разработки или тестирования используйте один из bat-файлов:

- **START-DUAL-TUNNEL.bat**: (Рекомендуется) Запускает Node.js сервер, ngrok и Cloudflare Tunnel одновременно.
- **START-ALL.bat**: Аналог DUAL-TUNNEL, запускает все три компонента.
- **START-LOCAL.bat**: Запускает только Node.js сервер локально на порту 8085.
- **START-NGROK.bat**: Запускает только туннель ngrok (требуется работающий сервер).
- **START-CLOUDFLARE.bat**: Запускает только туннель Cloudflare (требуется работающий сервер).

### 2. Доступные URL

После запуска через DUAL-TUNNEL сервис будет доступен по трем адресам:
1. **Локально**: http://localhost:8085
2. **ngrok**: https://reportorial-thermotactic-natalya.ngrok-free.dev (для текущих пользователей)
3. **Cloudflare**: https://crispcode.ru (основной домен)

### 3. Проверка работы

- Откройте один из указанных выше URL.
- Войдите как `admin/admin`
- Проверьте консоль браузера (F12) на ошибки.

### 3. Остановка сервера

```bash
stop-server.bat
# или
taskkill /F /IM node.exe
```

---

## 🌐 Развертывание на сервере Reg.ru (Windows)

### Шаг 1: Подготовка сервера

1. **Установите Node.js:**
   - Скачайте с https://nodejs.org/
   - Установите LTS версию
   - Проверьте: `node --version`

2. **Установите cloudflared:**
   ```powershell
   # Скачайте cloudflared.exe
   # https://github.com/cloudflare/cloudflared/releases/latest
   # Положите в папку проекта
   ```

3. **Настройте Cloudflare Tunnel:**
   - Войдите в Cloudflare Dashboard
   - Zero Trust → Networks → Tunnels
   - Создайте туннель или используйте существующий
   - Скопируйте credentials file в `C:\Users\web\.cloudflared\`

### Шаг 2: Настройка конфигурации

**cloudflared-config.yml:**
```yaml
tunnel: e315380c-7f82-49b0-bb14-4ee1f53a16a2
credentials-file: C:\\Users\\web\\.cloudflared\\e315380c-7f82-49b0-bb14-4ee1f53a16a2.json

ingress:
  - hostname: crispcode.ru
    service: http://localhost:8085
  - service: http_status:404
```

### Шаг 3: Запуск на сервере

**Вариант 1: Вручную (для тестирования)**
```bash
# Запуск сервера
node server.js

# В новом окне: запуск туннеля
cloudflared.exe tunnel --config cloudflared-config.yml run crispcode-qa
```

**Вариант 2: Как служба Windows (для продакшена)**

1. Установите NSSM (Non-Sucking Service Manager):
   ```powershell
   # Скачайте с https://nssm.cc/download
   # Распакуйте в C:\nssm\
   ```

2. Создайте службу для сервера:
   ```powershell
   C:\nssm\nssm.exe install QA-Server
   # Path: C:\Program Files\nodejs\node.exe
   # Startup directory: C:\Users\web\Desktop\git_qa\git_ga
   # Arguments: server.js
   ```

3. Создайте службу для туннеля:
   ```powershell
   C:\nssm\nssm.exe install Cloudflare-Tunnel
   # Path: C:\Users\web\Desktop\git_qa\git_ga\cloudflared.exe
   # Arguments: tunnel --config cloudflared-config.yml run crispcode-qa
   ```

4. Запустите службы:
   ```powershell
   net start QA-Server
   net start Cloudflare-Tunnel
   ```

### Шаг 4: Проверка работы

1. **Локально на сервере:**
   ```
   http://localhost:8085
   ```

2. **Через Cloudflare:**
   ```
   https://qa.crispcode.ru
   ```

3. **Проверьте логи:**
   ```powershell
   # Логи сервера
   Get-EventLog -LogName Application -Source QA-Server -Newest 50
   
   # Статус туннеля
   cloudflared.exe tunnel info crispcode-qa
   ```

---

## 📦 Структура данных

Данные пользователей сохраняются в папке `data/`:

```
data/
├── user_progress_admin.json      # Прогресс admin
├── user_progress_user1.json      # Прогресс user1
├── user_progress.json            # Общий прогресс (guest)
├── questions_no_anki.json        # Вопросы
├── metadata.json                 # Метаданные
└── trash.json                    # Корзина
```

---

## 🔐 Безопасность

### 1. Брандмауэр Windows

Разрешите порт 8085 только для локальных подключений:
```powershell
netsh advfirewall firewall add rule name="QA Server" dir=in action=allow protocol=TCP localport=8085 remoteip=localsubnet
```

### 2. Cloudflare Access (опционально)

Настройте доступ через Cloudflare Zero Trust:
- Zero Trust → Access → Applications
- Добавьте `qa.crispcode.ru`
- Настройте правила доступа

---

## 🐛 Диагностика проблем

### Сервер не запускается

```bash
# Проверьте порт
netstat -ano | findstr :8085

# Проверьте логи
node server.js 2>&1 | tee server.log
```

### Туннель не подключается

```bash
# Проверьте credentials
cloudflared.exe tunnel check

# Пересоздайте туннель
cloudflared.exe tunnel login
cloudflared.exe tunnel create crispcode-qa
```

### Данные не синхронизируются

1. Проверьте консоль браузера (F12)
2. Проверьте логи сервера
3. Проверьте права доступа к папке `data/`

---

## 📊 Мониторинг

### Логи сервера

```bash
# В реальном времени
Get-Content server.log -Wait -Tail 50
```

### Статистика туннеля

```bash
cloudflared.exe tunnel metrics
```

### Использование диска

```powershell
Get-ChildItem data\ | Measure-Object -Property Length -Sum
```

---

## 🔄 Обновление

1. Остановите службы:
   ```powershell
   net stop QA-Server
   net stop Cloudflare-Tunnel
   ```

2. Обновите файлы проекта

3. Запустите службы:
   ```powershell
   net start QA-Server
   net start Cloudflare-Tunnel
   ```

---

## 📞 Поддержка

При проблемах проверьте:
1. Логи сервера в консоли
2. Логи Cloudflare в Dashboard
3. Браузерную консоль (F12)
