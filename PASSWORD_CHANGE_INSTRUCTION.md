# 🔐 Инструкция по смене пароля admin на ghettocoal

## ❗ Проблема

Вы не могли войти как `admin` / `ghettocoal` по следующим причинам:

1. **Пробел в URL API** (строка 1844 в `tabs-navigation.js`):
   ```javascript
   // ❌ БЫЛО:
   fetch(`${BACKEND_URL} /api/login`)  // Пробел перед /api/login
   
   // ✅ СТАЛО:
   fetch(`${BACKEND_URL}/api/login`)
   ```

2. **Пароль в client-side базе** (`user-system.js`):
   ```javascript
   // ❌ БЫЛО:
   password: 'admin'
   
   // ✅ СТАЛО:
   password: 'ghettocoal'
   ```

3. **Кеширование Service Worker**:
   - Браузер кэширует JS файлы
   - Версия кэша: `bytecards-v44`

---

## ✅ Выполненные изменения

### 1. Исправлен URL API login
**Файл:** `ui-variants/tabs-navigation.js` (строка 1844)

### 2. Обновлен пароль admin в user-system.js
**Файл:** `user-system.js` (строка 38)

### 3. Серверная база уже содержит правильный хеш
**Файл:** `data/users.json`
- Хеш для `ghettocoal`: `eb653343d706617af1347831b5717c2609ffa4502217ab88a20acf1b9b9dd21c`

---

## 🔄 Что нужно сделать СЕЙЧАС

### Вариант 1: Полная очистка кеша (рекомендуется)

1. **Откройте вкладку инкогнито** (Ctrl+Shift+N / Cmd+Shift+N)

2. **Откройте консоль разработчика** (F12)

3. **Перейдите на вкладку Application** (или Storage)

4. **Очистите всё:**
   -左侧: Application → Storage
   - Кнопка: **Clear site data**

5. **Или выполните в Console:**
   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   caches.keys().then(names => names.forEach(n => caches.delete(n)));
   if ('serviceWorker' in navigator) {
     navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
   }
   location.reload();
   ```

6. **После перезагрузки войдите:**
   - Логин: `admin`
   - Пароль: `ghettocoal`

---

### Вариант 2: Обновление localStorage вручную

1. **Откройте консоль** (F12)

2. **Выполните скрипт:**
   ```javascript
   // Обновляем пароль admin в localStorage
   const users = JSON.parse(localStorage.getItem('usersDB') || '[]');
   const admin = users.find(u => u.username === 'admin');
   if (admin) {
     admin.password = 'ghettocoal';
     localStorage.setItem('usersDB', JSON.stringify(users));
     console.log('✅ Пароль admin обновлён на ghettocoal');
   } else {
     console.log('❌ Пользователь admin не найден');
   }
   location.reload();
   ```

---

### Вариант 3: Хард перезагрузка

1. **Нажмите Ctrl+Shift+R** (Windows) или **Cmd+Shift+R** (Mac)
   - Это перезагрузит страницу с очисткой кеша

2. **Или очистите кеш браузера:**
   - Chrome: Settings → Privacy → Clear browsing data
   - Firefox: Settings → Privacy → Clear Data
   - Edge: Settings → Privacy → Clear browsing data

3. **Перезапустите сервер:**
   ```bash
   # Остановите текущий процесс (Ctrl+C)
   # Запустите заново:
   npm start
   # или
   node server.js
   ```

---

## 🧪 Проверка работы

### 1. Проверка серверного API

```bash
curl -X POST http://localhost:8085/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"ghettocoal"}'
```

**Ожидаемый ответ:**
```json
{
  "ok": true,
  "username": "admin",
  "role": "admin"
}
```

### 2. Проверка хеша пароля

```bash
node -e "const crypto=require('crypto'); console.log(crypto.createHash('sha256').update('qa_helper_salt_2026_secure_key'+'ghettocoal').digest('hex'));"
```

**Ожидаемый вывод:**
```
eb653343d706617af1347831b5717c2609ffa4502217ab88a20acf1b9b9dd21c
```

### 3. Проверка в браузере

1. Откройте консоль (F12)
2. Введите:
   ```javascript
   JSON.parse(localStorage.getItem('usersDB')).find(u => u.username === 'admin')
   ```
3. Должно вернуть:
   ```json
   {
     "username": "admin",
     "password": "ghettocoal",
     "role": "admin"
   }
   ```

---

## 🚨 Если всё ещё не работает

### Проверьте логи сервера

Ищите строки:
```
[Login] User admin logged in successfully
```
или
```
Неверный пароль
```

### Проверьте консоль браузера

Ищите ошибки:
```
ERR_NAME_NOT_RESOLVED  // Пробел в URL
401 Unauthorized       // Неверный пароль
Network Error          // Сервер недоступен
```

### Проверьте какой файл используется

1. Откройте DevTools (F12)
2. Перейдите в Sources
3. Найдите `tabs-navigation.js`
4. Проверьте строку 1844 - должно быть без пробела:
   ```javascript
   `${BACKEND_URL}/api/login`  // ✅ Правильно
   ```

### Обновите Service Worker

```javascript
// В консоли браузера:
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => reg.unregister());
});
caches.keys().then(names => names.forEach(n => caches.delete(n)));
location.reload();
```

---

## 📋 Чек-лист

- [ ] Исправлен пробел в `tabs-navigation.js` (строка 1844)
- [ ] Обновлён пароль в `user-system.js` (строка 38)
- [ ] Серверная база содержит правильный хеш (`data/users.json`)
- [ ] Перезапущен сервер
- [ ] Очищен кеш браузера / Service Worker
- [ ] Очищен localStorage
- [ ] Проверка через curl работает
- [ ] Вход через браузер работает

---

## 📚 Созданные файлы

| Файл | Описание |
|------|----------|
| [`change-password.js`](change-password.js) | Скрипт смены пароля в серверной базе |
| [`update-admin-password-console.js`](update-admin-password-console.js) | Скрипт для обновления в браузере |
| [`AUTH_SYSTEM.md`](AUTH_SYSTEM.md) | Документация системы аутентификации |
| [`PASSWORD_CHANGE_INSTRUCTION.md`](PASSWORD_CHANGE_INSTRUCTION.md) | Эта инструкция |

---

## 🔑 Текущие credentials

```
Логин: admin
Пароль: ghettocoal
Роль: admin
```

---

**Дата обновления:** 2026-04-02  
**Версия инструкции:** 1.0
