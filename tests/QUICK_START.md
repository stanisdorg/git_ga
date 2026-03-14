# 🧪 Быстрый старт: Тесты перехода на статистику

## Проблема
Черный экран при переходе на статистику из тренировки.

## Что исправлено

### ✅ Исправления в коде

1. **srs/stats-ui.js** - `hideStatsPage()`:
   - Очищается ссылка `statsContainer = null` после удаления
   - Явно устанавливается `mainContainer.style.display = 'block'`

2. **srs/stats-ui.js** - `initStatsPage()`:
   - Добавлена проверка вычисленных стилей через `getComputedStyle()`
   - Добавлен лог скрытия sidebar

3. **ui-variants/tabs-navigation.js** - `hashchange`:
   - Добавлено скрытие sidebar при переходе на `#/stats`

## Запуск тестов

### Вариант 1: Через консоль браузера (быстро)

1. Откройте http://localhost:8085
2. Откройте DevTools (F12) → Console
3. Выполните:
```javascript
await import('./tests/stats-navigation.test.js')
```

### Вариант 2: Через HTML-раннер (красиво)

1. Откройте http://localhost:8085/tests/stats-navigation-test-runner.html
2. Нажмите "▶️ Запустить все тесты"

## Ожидаемые результаты

Все 6 тестов должны быть пройдены:
- ✅ Контейнеры ДО перехода
- ✅ Инициализация страницы статистики  
- ✅ Переход из режима обучения
- ✅ Hashchange обработчик
- ✅ Z-index и перекрытия
- ✅ Полный сценарий

## Проверка исправления

1. Запустите тренировку (обучение)
2. Пройдите несколько вопросов
3. Нажмите кнопку "Статистика" в модальном окне
4. **Ожидаемый результат:** Видна страница статистики с графиками
5. **Было:** Черный экран

## Логи для отладки

Если проблема осталась, проверьте консоль. Должны быть видны:
```
[STATS INIT] stats-container created
[STATS INIT] stats-container display set to block
[STATS INIT] stats-container computed display: block
[STATS INIT] stats-container computed zIndex: 2000
[STATS INIT] Hid sidebar
```

## Контакты

При возникновении проблем прикрепите:
1. Скриншот результатов тестов
2. Консольные логи после `#/stats`
3. Версию приложения (из `stats-ui.js`)
