# АВТОТЕСТЫ НА ИЗОЛЯЦИЮ ПОЛЬЗОВАТЕЛЕЙ

## 📋 Что тестируется

Эти тесты проверяют что данные пользователей полностью изолированы:

1. **TEST 1**: User 1 создаёт и редактирует карточки
2. **TEST 2**: User 2 НЕ видит изменения User 1
3. **TEST 3**: User 1 возвращается - все изменения на месте
4. **TEST 4**: Полная изоляция - два пользователя одновременно в разных браузерах

## 🚀 Запуск тестов

### Вариант 1: Через батник (проще)

1. **Запустите сервер** на порту 8085:
   ```
   START-LOCAL.bat
   ```

2. **Запустите тесты**:
   ```
   RUN-ISOLATION-TESTS.bat
   ```

3. **Наблюдайте** за тестами в открывшемся браузере

### Вариант 2: Через командную строку

```bash
cd c:\Users\web\Desktop\git_qa\git_ga
npx playwright test tests/test-user-isolation-ui.spec.ts --headed
```

## 📊 Отчёт о тестах

После запуска вы увидите:

```
=== TEST 1: User 1 creates and edits cards ===
Logging in as testuser1...
Creating duplicate...
✓ Card created and saved
Editing duplicate...
✓ Card edited and saved
=== TEST 1 COMPLETE ===

=== TEST 2: User 2 should NOT see User 1 changes ===
Logging in as testuser2...
✓ User 2 does NOT see User 1 cards
=== TEST 2 COMPLETE ===

...
```

## ✅ Если все тесты прошли

Вы увидите сообщение:
```
✓ All tests passed
```

## ❌ Если тесты упали

### Ошибка: "User 2 sees User 1 cards"
**Проблема:** Данные пользователей пересекаются

**Решение:**
1. Проверьте что `clearQaUserCards()` вызывается при logout
2. Убедитесь что у каждого пользователя свой ключ `qaUserCards_{username}`

### Ошибка: "User 1 changes not found"
**Проблема:** Изменения не сохраняются

**Решение:**
1. Проверьте логи сервера
2. Убедитесь что `setQaUserCards()` работает корректно

## 🔧 Отладка

### Запуск конкретного теста:
```bash
npx playwright test tests/test-user-isolation-ui.spec.ts -g "TEST 2"
```

### Запуск без GUI (быстрее):
```bash
npx playwright test tests/test-user-isolation-ui.spec.ts --headless
```

### Запуск с видео:
```bash
npx playwright test tests/test-user-isolation-ui.spec.ts --video=on
```

## 📹 Видео тестов

Видео сохраняются в папку `test-results/`

## 🛠 Требования

- Node.js 16+
- Playwright (установится автоматически)
- Запущенный сервер на http://localhost:8085

## 📝 Тестовые пользователи

Тесты автоматически создают пользователей:
- **testuser1** / test123
- **testuser2** / test456

Если пользователи не существуют - создадутся автоматически при первом запуске.

## 🎯 Что проверяется

| Тест | Проверяет |
|------|-----------|
| TEST 1 | Создание и редактирование работает |
| TEST 2 | Изоляция - другой пользователь не видит изменения |
| TEST 3 | Сохранение данных при возврате |
| TEST 4 | Полная изоляция в реальном времени |

## 🐛 Troubleshooting

### Сервер не запущен
```
Error: page.goto: Timeout 30000ms exceeded
```
**Решение:** Запустите `START-LOCAL.bat`

### Пользователи не созданы
```
Error: Login failed
```
**Решение:** Создайте пользователей через админ-панель или используйте существующих (admin/admin)

### localStorage не очищается
```
Error: User 2 sees User 1 cards
```
**Решение:** Проверьте что `clearQaUserCards()` вызывается и что ключи разные (`qaUserCards_testuser1` vs `qaUserCards_testuser2`)
