# iOS PWA Safe Areas — Инструкция

## Проблема

На iPhone в режиме PWA (установлено на главный экран) приложение разворачивается на весь экран, включая области за:
- **Сверху**: челка (notch) / Dynamic Island / статус-бар с камерой
- **Снизу**: скруглённые углы экрана / полоска Home

Контент, попадающий в эти области, **не виден** или **недоступен для нажатия**.

---

## Решение

### 1. Отступ СВЕРХУ (между шапкой и колодами)

**Файл:** `style.css`

**Добавить после `.container`:**

```css
/* Добавляем отступ для первого элемента внутри container */
.container > *:first-child {
    margin-top: 44px !important;
}
```

**Почему 44px:**
- Высота шапки: 40px
- Небольшой дополнительный отступ: 4px
- Итого: 44px

**Результат:**
- Шапка прижата к верху экрана (`top: 0px`)
- Первый элемент внутри `.container` (обычно `.tabs-navigation`) сдвинут вниз на 44px
- Колоды начинаются сразу под шапкой, не перекрываются челкой

---

### 2. Отступ СНИЗУ (между навигацией и краем экрана)

**Файл:** `style.css`

**Добавить после правила для первого элемента:**

```css
/* Добавляем отступ для последнего элемента внутри container */
.container > *:last-child {
    margin-bottom: 34px !important;
}
```

**Почему 34px:**
- Высота нижней навигационной панели: ~56px
- Safe area inset bottom на iPhone: ~20-34px (зависит от модели)
- Итого: 34px достаточно для большинства iPhone

**Результат:**
- Последний элемент внутри `.container` сдвинут вверх на 34px
- Контент не перекрывается полоской Home и скруглениями экрана

---

## Проверка

### Логи для отладки (если нужно)

Добавить временный скрипт в `index.html` перед `</body>`:

```html
<script>
    setTimeout(function() {
        var container = document.querySelector('.container');
        if (container) {
            var firstChild = container.firstElementChild;
            if (firstChild) {
                var rect = firstChild.getBoundingClientRect();
                console.log('First child:', firstChild.className);
                console.log('First child top:', rect.top);
                console.log('First child margin-top:', getComputedStyle(firstChild).marginTop);
            }
            
            var lastChild = container.lastElementChild;
            if (lastChild) {
                var rect = lastChild.getBoundingClientRect();
                console.log('Last child:', lastChild.className);
                console.log('Last child bottom:', rect.bottom);
                console.log('Last child margin-bottom:', getComputedStyle(lastChild).marginBottom);
            }
        }
    }, 1000);
</script>
```

### Ожидаемые значения (iPhone PWA):

```
First child: tabs-navigation
First child top: 44          ← Сдвинуто вниз!
First child margin-top: 44px

Last child: [навигация]
Last child bottom: 600       ← Не доходит до края!
Last child margin-bottom: 34px
```

---

## Модели iPhone и размеры safe areas

| Модель | Screen | Safe Area Top | Safe Area Bottom |
|--------|--------|---------------|------------------|
| iPhone 14/15 Pro | 393x852 | 59px | 34px |
| iPhone 14/15 | 390x844 | 50px | 34px |
| iPhone SE | 375x667 | 20px | 0px |
| iPhone 12/13 Pro | 390x844 | 50px | 34px |

**Рекомендуемые значения:**
- `margin-top: 44px` — работает для всех iPhone (шапка 40px + 4px)
- `margin-bottom: 34px` — работает для iPhone с челкой и полоской Home

---

## Важно!

1. **Не использовать `viewport-fit=cover`** на iOS 26+ — он ломает safe areas
2. **Не применять padding к `.container`** — он добавляется ВНУТРЬ, а не снаружи
3. **Использовать `margin-top` для `:first-child`** — сдвигает весь элемент вниз
4. **Использовать `margin-bottom` для `:last-child`** — сдвигает весь элемент вверх
5. **Всегда добавлять `!important`** — перебивает другие стили

---

## Пример полной структуры

```
1) Челка айфона (0-59px)
   ↓
2) Шапка (top=0px, height=40px) ← У ВЕРХА ЭКРАНА!
   ↓
3) margin-top: 44px ← ПЕРВЫЙ ЭЛЕМЕНТ СДВИНУТ
   ↓
4) Колоды (.tabs-navigation)
   ↓
5) Контент (вопросы, карточки)
   ↓
6) margin-bottom: 34px ← ПОСЛЕДНИЙ ЭЛЕМЕНТ СДВИНУТ
   ↓
7) Навигация (bottom nav)
   ↓
8) Полоска Home (34px safe area)
```

---

## Контакты

Если что-то не работает — проверить:
1. Файл `style.css` — добавлены ли правила
2. Специфичность селекторов — перебивают ли другие стили
3. iOS PWA — работает только в PWA, не в Safari
