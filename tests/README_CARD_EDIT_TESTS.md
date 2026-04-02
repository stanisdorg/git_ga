# Автотесты для отладки проблемы обновления UI после редактирования карточки

## Проблема

После редактирования карточки в режиме обучения (изменение текста, цвета, форматирования):
1. Данные сохраняются в localStorage ✅
2. При выходе на страницу статистики ✅
3. При переходе на главную страницу ❌ **изменения не видны**
4. Только после перезагрузки страницы изменения отображаются ✅

## Решение

Добавлено механизм событий для автоматического обновления UI:

### 1. Событие `qaDataUpdated`
После успешного сохранения карточки на сервер и в localStorage, диспатчится событие:

```javascript
window.dispatchEvent(new CustomEvent('qaDataUpdated', { 
    detail: { 
        updatedCard: allCards[cardIndex],
        oldQuestion: editModalState.originalCard.question,
        newQuestion: newQuestion
    }
}));
```

### 2. Обработчик события
В `tabs-navigation.js` добавлен обработчик, который автоматически вызывает `refreshCurrentContext()`:

```javascript
window.addEventListener('qaDataUpdated', (event) => {
    if (location.hash === '#/stats') return; // Не обновлять на статистике
    refreshCurrentContext(); // Перерисовываем текущий контекст
});
```

### 3. Детальное логирование
Добавлены логи в ключевые точки:
- `[EDIT MODAL]` - сохранение карточки
- `[qaDataUpdated]` - получение события
- `[refreshCurrentContext]` - процесс обновления UI

## Запуск тестов

### E2E тесты (Playwright)

```bash
# Запуск конкретного теста
npx playwright test tests/card-edit-flow.test.js

# Запуск с UI
npx playwright test tests/card-edit-flow.test.js --ui

# Запуск с подробными логами
npx playwright test tests/card-edit-flow.test.js --reporter=list
```

### API тесты (Jest)

```bash
# Запуск тестов редактирования карточек
npm test -- card-editing

# Запуск всех тестов
npm test
```

## Путь данных при редактировании

```
1. Редактирование в learn-ui.js
   └─> saveEditChanges()
       └─> Отправка на сервер (POST /api/card/update)
       └─> Обновление localStorage
       └─> Диспатч события qaDataUpdated

2. Обработка события в tabs-navigation.js
   └─> Обработчик qaDataUpdated
       └─> Проверка: не на странице статистики
       └─> Вызов refreshCurrentContext()

3. Обновление UI
   └─> getRuntimeData() - получение актуальных данных
   └─> displayQuestions() - перерисовка карточек
   └─> UI обновлён ✅
```

## Структура тестов

### card-edit-flow.test.js

**Тест 1: `should update UI immediately after card edit`**
- Переход в режим обучения
- Редактирование карточки (текст + цвет)
- Сохранение
- Выход на статистику
- Переход на главную
- **Проверка**: изменённая карточка видна сразу

**Тест 2: `should verify data flow on page reload`**
- Перезагрузка страницы
- **Проверка**: изменения сохраняются после reload

## Логи для отладки

При прохождении теста вы увидите логи:

```
[EDIT MODAL] ✅ localStorage обновлён
[EDIT MODAL] ✅ Событие qaDataUpdated отправлено
[qaDataUpdated] 🔥 Получено событие об изменении карточки
[qaDataUpdated] 🔄 Вызываем refreshCurrentContext()
[refreshCurrentContext] 🔥 START
[refreshCurrentContext] Runtime data count: 317
[refreshCurrentContext] Calling showAllQuestions
[refreshCurrentContext] ✅ displayQuestions completed
[refreshCurrentContext] 🔥 END
```

## Ожидаемый результат

После исправления:
- ✅ Изменения видны сразу после возврата на главную
- ✅ Перезагрузка страницы не требуется
- ✅ Тесты проходят без ошибок

## Дополнительная отладка

Если тесты падают, проверьте логи:

1. **Консоль браузера** - логи `[EDIT MODAL]`, `[qaDataUpdated]`, `[refreshCurrentContext]`
2. **Скриншоты** - `test-screenshots/card-edit-check.png`
3. **localStorage** - данные должны содержать изменённую карточку

```bash
# Просмотр логов сервера
npm run logs

# Очистка localStorage перед тестом
npx playwright test tests/card-edit-flow.test.js --grep "should update UI"
```
