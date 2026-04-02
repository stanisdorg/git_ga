# 🔐 Система аутентификации QA Helper

## 📋 Обзор

Система поддерживает два уровня аутентификации:
1. **Серверная аутентификация** (основная) - через `server.js`
2. **Клиентская аутентификация** (локальная) - через `user-system.js`

---

## 🗄️ Хранение паролей

### Серверная часть

**Файл:** `data/users.json`

```json
{
  "username": "admin",
  "password": "eb653343d706617af1347831b5717c2609ffa4502217ab88a20acf1b9b9dd21c",
  "role": "admin",
  "createdAt": "2026-03-08T12:00:00Z",
  "lastLoginAt": "2026-03-25T14:37:30.844Z"
}
```

**Алгоритм хеширования:**
```javascript
const PASSWORD_SALT = 'qa_helper_salt_2026_secure_key';
const hash = crypto.createHash('sha256')
  .update(PASSWORD_SALT + password)
  .digest('hex');
```

**Параметры:**
- Алгоритм: **SHA-256**
- Соль: `'qa_helper_salt_2026_secure_key'`
- Формат: **hex** (64 символа)
- Пример: `admin:ghettocoal` → `eb653343d706617af1347831b5717c2609ffa4502217ab88a20acf1b9b9dd21c`

### Клиентская часть

**Хранение:** `localStorage` браузера

**Ключи:**
- `usersDB` - база пользователей (пароли в открытом виде!)
- `currentUser` - текущая сессия

**⚠️ Уязвимость:** Клиентские пароли не хешируются!

---

## 🔑 Роли пользователей

| Роль | Права |
|------|-------|
| `super_admin` | Полный доступ, создание super_admin |
| `admin` | Управление пользователями, редактирование карт |
| `editor` | Редактирование карт |
| `user` | Базовый доступ |

---

## 📝 APIEndpoints

### POST `/api/login`

**Вход:**
```json
{
  "username": "admin",
  "password": "ghettocoal"
}
```

**Выход (успех):**
```json
{
  "ok": true,
  "username": "admin",
  "role": "admin"
}
```

**Выход (ошибка):**
```json
{
  "ok": false,
  "error": "Invalid credentials"
}
```

### POST `/api/users` (создание пользователя)

**Требования:** `admin` или `super_admin`

**Вход:**
```json
{
  "username": "newuser",
  "password": "password123",
  "role": "user",
  "adminToken": "..."
}
```

---

## 🔄 Кеширование и сессии

### Механизм работы

1. **Логин:**
   - Пользователь вводит логин/пароль
   - Отправка POST `/api/login`
   - Сервер проверяет хеш: `hashPassword(введенный) === хеш_в_базе`
   - При успехе: возврат `{username, role}`
   - Клиент сохраняет в `localStorage.currentUser`

2. **Проверка сессии:**
   - При загрузке страницы: чтение из `localStorage.currentUser`
   - Если данные есть - пользователь авторизован
   - Если нет - требуется вход

3. **Logout:**
   - Очистка `localStorage.currentUser`
   - POST `/api/logout` (опционально)

### Проблемы

- **Нет токенов** - сессия хранится только в localStorage
- **Нет срока действия** - сессия бессрочная
- **Уязвимость к XSS** - localStorage доступен через JS

---

## 🛠️ Управление паролями

### Смена пароля (скрипт)

```bash
node change-password.js <username> <новый_пароль>

# Пример:
node change-password.js admin ghettocoal
```

**Что делает скрипт:**
1. Проверяет сложность пароля (6-100 символов)
2. Хеширует пароль с солью
3. Обновляет `data/users.json`
4. Добавляет метаданные (`passwordChangedAt`, `passwordChangedBy`)

### Ручная смена (через консоль)

```javascript
// В браузере (client-side):
const users = JSON.parse(localStorage.getItem('usersDB'));
const admin = users.find(u => u.username === 'admin');
admin.password = 'ghettocoal'; // В открытом виде!
localStorage.setItem('usersDB', JSON.stringify(users));
```

```bash
# На сервере (хеширование):
node -e "const crypto = require('crypto'); console.log(crypto.createHash('sha256').update('qa_helper_salt_2026_secure_key' + 'ghettocoal').digest('hex'))"
```

---

## 🚀 Интеграция с другими методами входа

### Telegram Auth

**Endpoint:** `POST /api/auth/telegram`

**Проверка:**
1. Проверка подписи Telegram (HMAC-SHA256)
2. Проверка подписки на канал
3. Автоматическая регистрация/вход

**Байпас:** Пользователи из `TELEGRAM_ADMIN_IDS` входят без проверки подписки

### GitHub OAuth

**Endpoint:** `GET /api/auth/github`

**Flow:**
1. Редирект на GitHub
2. Получение кода
3. Обмен на токен
4. Получение данных пользователя
5. Регистрация/вход

### Google OAuth

**Endpoint:** `POST /api/auth/google`

**Flow:** Аналогично GitHub

---

## 🔒 Рекомендации по безопасности

### Критические

- [ ] **Хешировать клиентские пароли** в `user-system.js`
- [ ] **Добавить токены сессий** с сроком действия
- [ ] **HTTPS** для всех запросов
- [ ] **Rate limiting** для `/api/login` (частично реализован)

### Важные

- [ ] Использовать **bcrypt/argon2** вместо SHA-256
- [ ] Добавить **refresh tokens**
- [ ] Валидация сложности пароля
- [ ] Логирование попыток входа

### Желательные

- [ ] Двухфакторная аутентификация
- [ ] Уведомления о входе
- [ ] История входов
- [ ] Принудительная смена пароля

---

## 📊 Текущие пользователи (data/users.json)

| Username | Роль | Пароль (хеширован) |
|----------|------|-------------------|
| `admin` | admin | ✅ ghettocoal |
| `jeff` | editor | ✅ |
| `stas` | user | ✅ admin |
| `doroganov_stanislav` | admin | 🔑 Telegram |
| `user_8333264308` | editor | 🔑 Telegram |
| `stasdoroganov` | editor | ✅ Google |

---

## 🧪 Тестирование

### Проверка входа

```bash
curl -X POST https://bytecards.ru/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"ghettocoal"}'
```

### Проверка хеша

```bash
node -e "
const crypto = require('crypto');
const salt = 'qa_helper_salt_2026_secure_key';
const password = 'ghettocoal';
const hash = crypto.createHash('sha256').update(salt + password).digest('hex');
console.log('Hash:', hash);
console.log('Expected: eb653343d706617af1347831b5717c2609ffa4502217ab88a20acf1b9b9dd21c');
console.log('Match:', hash === 'eb653343d706617af1347831b5717c2609ffa4502217ab88a20acf1b9b9dd21c');
"
```

---

## 📚 Файлы системы

| Файл | Описание |
|------|----------|
| `server.js` | Серверная аутентификация, API |
| `user-system.js` | Клиентская аутентификация (LocalStorage) |
| `data/users.json` | База пользователей (хеши) |
| `change-password.js` | Скрипт смены пароля |
| `hash-passwords.js` | Миграция паролей в хеши |
| `tests/setup-tests.js` | Тестовые пользователи |

---

## ❓ FAQ

### Почему пароль не меняется?

1. Проверьте, что используете правильный юзернейм
2. Убедитесь, что сервер перезапущен после изменений
3. Очистите кеш браузера (localStorage)

### Как узнать текущий пароль?

**Никак!** Пароли хранятся в захешированном виде. Можно только:
- Сменить на новый
- Подобрать (brute-force)

### Где хранится соль?

В `server.js`:
```javascript
const PASSWORD_SALT = process.env.PASSWORD_SALT || 'qa_helper_salt_2026_secure_key';
```

**⚠️ Проблема:** Соль захардкожена, не через `.env`

### Можно ли использовать одинаковые пароли?

Технически - да, но **не рекомендуется**!

---

**Версия документации:** 1.0  
**Дата обновления:** 2026-04-02
