# 🛡️ Настройка Sentry для ByteCards

Sentry — это сервис для отслеживания ошибок в реальном времени.

## Шаг 1: Регистрация в Sentry

1. Перейдите на https://sentry.io/
2. Зарегистрируйтесь (можно через GitHub/Google)
3. **Бесплатный тариф:** 5000 ошибок/месяц, 10GB данных

## Шаг 2: Создание проекта

1. Нажмите **"Create Project"**
2. Выберите **"Browser"** (для фронтенда)
3. Назовите проект: `ByteCards`
4. Скопируйте **DSN** (выглядит как `https://...@...sentry.io/...`)

## Шаг 3: Настройка сервера

Откройте файл `.env` (или создайте его):

```bash
SENTRY_DSN=https://ваш_ключ@...ingest.sentry.io/...
NODE_ENV=production
```

Или установите переменную окружения:

```bash
# Windows (PowerShell)
$env:SENTRY_DSN="https://ваш_ключ@...ingest.sentry.io/..."
$env:NODE_ENV="production"

# Windows (cmd)
set SENTRY_DSN=https://ваш_ключ@...ingest.sentry.io/...
set NODE_ENV=production

# Linux/Mac
export SENTRY_DSN="https://ваш_ключ@...ingest.sentry.io/..."
export NODE_ENV="production"
```

## Шаг 4: Настройка клиента

Откройте `index.html` и замените:

```javascript
dsn: 'YOUR_SENTRY_DSN_HERE', // Замените на ваш DSN
```

На ваш DSN из личного кабинета Sentry:

```javascript
dsn: 'https://abc123@o123456.ingest.sentry.io/123456',
```

## Шаг 5: Перезапуск сервера

```bash
# Остановите сервер (Ctrl+C)
taskkill /F /PID <процесс>

# Запустите заново
node server.js
```

## Проверка работы

### Сервер
В консоли сервера увидите:
```
[Sentry] Инициализирован
```

### Клиент
В консоли браузера (F12):
```
[Sentry] Инициализирован
```

### Тестовая ошибка

Для проверки добавьте в любой файл:

**server.js:**
```javascript
throw new Error('Тестовая ошибка Sentry');
```

**index.html (в консоль):**
```javascript
Sentry.captureMessage('Тестовое сообщение');
throw new Error('Тестовая ошибка');
```

## Что отслеживает Sentry

### Сервер (Node.js)
- ❌ Необработанные исключения
- ❌ Отклонённые Promise
- ❌ Ошибки в HTTP обработчиках

### Клиент (Browser)
- ❌ JavaScript ошибки
- ❌ Ошибки сети
- ❌ Ошибки при загрузке ресурсов
- 📹 Session Replay (запись действий пользователя)

## Личный кабинет

https://sentry.io/organizations/your-org/projects/

Там вы увидите:
- Список ошибок
- Частоту возникновения
- Стек вызовов
- Записи сессий (Replay)

## Бесплатный лимит

- ✅ **5000 ошибок/месяц**
- ✅ **10GB данных**
- ✅ **Session Replay: 5GB**
- ✅ **Неограниченно пользователей**

Для ByteCards этого более чем достаточно!

## Отключение Sentry

Если нужно отключить:

**server.js:**
```javascript
const SENTRY_DSN = ''; // Или удалите переменную из .env
```

**index.html:**
```javascript
// Закомментируйте или удалите блок Sentry
```
