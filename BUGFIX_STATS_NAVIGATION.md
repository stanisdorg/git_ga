# 🐛 Найденная проблема: Черный экран при переходе на статистику из тренировки

## 🔍 Анализ проблемы

### Последовательность событий (из логов):

```
1. Пользователь проходит тренировку (обучение)
   → learn-ui.js: startLearnSession() запущена
   → document.body.classList.add('learning-mode')
   → learn-container.style.display = 'block'

2. Пользователь завершает тренировку
   → Показывается модалка с результатами
   → learn-ui.js: showStats() создает overlay с кнопкой "Статистика"

3. Пользователь нажимает кнопку "Статистика"
   → learn-ui.js:905 [STATS BUTTON] Cleared currentScheduler
   → learn-ui.js:918 [STATS BUTTON] Removed learning-mode
   → learn-ui.js:923 [STATS BUTTON] Hid learn-container
   → learn-ui.js:927 [STATS BUTTON] Hash changed to: #/stats
   
4. Срабатывает hashchange обработчик (tabs-navigation.js:647)
   → tabs-navigation.js:655 [HASH CHANGE] Detected #/stats
   → tabs-navigation.js:656 [HASH CHANGE] stats already initialized by button click
   → ❌ НЕ вызывает initStatsPage()!
   
5. Проблема: stats-container НЕ существует!
   → stats-ui.js:1540 [STATS INIT] stats-container exists: false
   → stats-ui.js:1541 [STATS INIT] main container display: (пусто)
   
6. Результат: Черный экран
   → mainContainer скрыт (display: none)
   → sidebar остается видимым
   → stats-container не создан
```

## 🎯 Корневая причина

**Файл:** `ui-variants/tabs-navigation.js`, строка 655-656

**Проблема:** Hashchange обработчик предполагал, что `initStatsPage()` уже был вызван кнопкой, но это неверно!

### Сценарий 1: Клик по кнопке "Статистика" в sidebar
```javascript
// ui-manager.js:297
statsBtn.addEventListener('click', () => {
    initStatsPage(APP_VERSION);  // ✅ Вызывается initStatsPage
    location.hash = '#/stats';
});
```
→ hashchange видит что stats-container существует → все OK

### Сценарий 2: Клик по кнопке "Статистика" из модалки обучения
```javascript
// learn-ui.js:889-928
overlay.querySelector('#sum-exit').addEventListener('click', () => {
    // ❌ НЕ вызывает initStatsPage()!
    location.hash = '#/stats';  // Только меняет hash
});
```
→ hashchange НЕ вызывает initStatsPage() → stats-container не создан → черный экран

## ✅ Решение

### Изменения в `ui-variants/tabs-navigation.js`:

**Было:**
```javascript
if (location.hash === '#/stats') {
    console.log('[HASH CHANGE] Detected #/stats - stats already initialized by button click');
    // НЕ вызываем initStatsPage() - он уже вызван кнопкой!
    // Просто скрываем главный контейнер
    const mainContainer = document.querySelector('.container');
    if (mainContainer) {
        mainContainer.style.display = 'none';
    }
}
```

**Стало:**
```javascript
if (location.hash === '#/stats') {
    console.log('[HASH CHANGE] Detected #/stats');
    
    // ПРОВЕРЯЕМ: существует ли stats-container
    const statsContainerExists = document.getElementById('stats-container');
    console.log('[HASH CHANGE] stats-container exists:', !!statsContainerExists);
    
    // Если stats-container НЕ существует, создаем его
    if (!statsContainerExists) {
        console.log('[HASH CHANGE] stats-container NOT found - calling initStatsPage()');
        const { initStatsPage } = await import('../srs/stats-ui.js');
        initStatsPage(appVersion);
    } else {
        console.log('[HASH CHANGE] stats-container already exists');
    }
    
    // Скрываем главный контейнер и sidebar
    const mainContainer = document.querySelector('.container');
    if (mainContainer) {
        mainContainer.style.display = 'none';
    }
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.style.display = 'none';
    }
}
```

### Дополнительные исправления в `srs/stats-ui.js`:

**1. hideStatsPage() - очистка ссылки:**
```javascript
if (statsContainer) {
    statsContainer.remove();
    statsContainer = null; // ✅ Очищаем ссылку на удаленный элемент
    console.log('[hideStatsPage] stats-container removed and reference cleared');
}
```

**2. hideStatsPage() - явное отображение mainContainer:**
```javascript
if (mainContainer) {
    mainContainer.style.display = 'block'; // ✅ Явно показываем
    console.log('[hideStatsPage] mainContainer display set to block');
}
```

**3. initStatsPage() - проверка вычисленных стилей:**
```javascript
// Проверяем что контейнер действительно виден
const computedStyle = window.getComputedStyle(statsContainerEl);
console.log('[STATS INIT] stats-container computed display:', computedStyle.display);
console.log('[STATS INIT] stats-container computed zIndex:', computedStyle.zIndex);
```

## 🧪 Тестирование

### Запуск тестов:

1. Откройте `http://localhost:8085/test-stats-fix.html`
2. Нажмите "Тестировать" для каждого шага
3. Все шаги должны показать ✅

### Ручное тестирование:

1. Откройте `http://localhost:8085`
2. Пройдите тренировку (несколько вопросов)
3. В модалке результатов нажмите "Статистика"
4. **Ожидаемый результат:** Видна страница статистики с графиками
5. **Было:** Черный экран

### Проверка в консоли:

Должны появиться логи:
```
[HASH CHANGE] Detected #/stats
[HASH CHANGE] stats-container exists: false
[HASH CHANGE] stats-container NOT found - calling initStatsPage()
[STATS INIT] ========== initStatsPage CALLED ==========
[STATS INIT] stats-container created
[STATS INIT] stats-container display set to block
[STATS INIT] stats-container computed display: block
```

## 📁 Измененные файлы

1. **ui-variants/tabs-navigation.js** (строки 647-673)
   - Добавлена проверка существования stats-container
   - Добавлен вызов initStatsPage() если контейнер не найден
   - Добавлено скрытие sidebar

2. **srs/stats-ui.js** (строки 1607-1636)
   - Очистка ссылки statsContainer после удаления
   - Явная установка display: block для mainContainer
   - Добавлена проверка вычисленных стилей

3. **srs/stats-ui.js** (строки 1528-1592)
   - Добавлен лог при скрытии sidebar
   - Добавлена проверка computed styles

## 📊 Статистика исправления

| Проблема | Решение | Статус |
|----------|---------|--------|
| stats-container не создавался | Проверка + вызов initStatsPage() | ✅ |
| statsContainer ссылка не очищалась | statsContainer = null | ✅ |
| mainContainer не показывался явно | display = 'block' | ✅ |
| sidebar не скрывался в hashchange | sidebar.style.display = 'none' | ✅ |
| Нет диагностики | Добавлены логи computed styles | ✅ |

## 🚀 Следующие шаги

1. ✅ Протестировать в браузере
2. ✅ Проверить все сценарии перехода на статистику
3. ✅ Убедиться что нет регрессий
