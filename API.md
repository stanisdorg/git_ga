# API Документация

Серверная часть приложения предоставляет REST API для работы с карточками вопросов, прогрессом пользователя и корзиной.

## Базовый URL

```
http://localhost:8085
```

## Аутентификация

Все запросы к пользовательским данным требуют параметр `user` с именем пользователя.

**Пример:**
```
GET /metadata?user=jeff
```

---

## Эндпоинты

### 1. Сохранение карточек

**POST** `/save?user={username}`

Сохраняет все карточки пользователя на сервер.

**Тело запроса:**
```json
[
  {
    "id": 0,
    "question": "Вопрос",
    "answer": "Ответ",
    "category": "Колода",
    "subcategory": "Тема"
  }
]
```

**Ответ:**
```json
{ "ok": true }
```

---

### 2. Загрузка карточек

**GET** `/load?user={username}`

Загружает все данные пользователя (карточки, прогресс, избранное, достижения).

**Ответ:**
```json
{
  "ok": true,
  "userData": {
    "cards": [...],
    "_favorites": [...],
    "_achievements": {...},
    "_stats": {...}
  }
}
```

---

### 3. Корзина — добавление

**POST** `/trash?user={username}`

Перемещает карточки в корзину пользователя.

**Тело запроса:**
```json
{
  "items": [
    {
      "question": "Текст вопроса",
      "answer": "Ответ",
      "category": "Колода"
    }
  ]
}
```

**Ответ:**
```json
{
  "ok": true,
  "trash_size": 5
}
```

---

### 4. Корзина — восстановление

**POST** `/restore?user={username}`

Восстанавливает карточки из корзины.

**Тело запроса:**
```json
{
  "questions": ["Вопрос 1", "Вопрос 2"]
}
```

**Ответ:**
```json
{
  "ok": true,
  "restored_count": 2
}
```

---

### 5. Корзина — окончательное удаление

**POST** `/delete-permanent?user={username}`

Полностью удаляет карточки из корзины без возможности восстановления.

**Тело запроса:**
```json
{
  "questions": ["Вопрос 1", "Вопрос 2"]
}
```

**Ответ:**
```json
{
  "ok": true,
  "deleted_count": 2
}
```

---

### 6. Метаданные (включая корзину)

**GET** `/metadata?user={username}`

Получает метаданные пользователя и содержимое корзины.

**Ответ:**
```json
{
  "category_order": [...],
  "subcategory_order": {...},
  "card_order": {...},
  "trash_bin": [
    {
      "item": {...},
      "deleted_at": "2026-03-10T16:00:00.000Z",
      "deleted_by": "jeff"
    }
  ]
}
```

---

### 7. Обновление метаданных

**POST** `/metadata?user={username}`

Обновляет метаданные пользователя (порядок колод, карточек).

**Тело запроса:**
```json
{
  "category_order": [...],
  "subcategory_order": {...},
  "card_order": {...}
}
```

**Ответ:**
```json
{ "ok": true }
```

---

### 8. Отслеживание дубликатов

**POST** `/duplicate`

Фиксирует факт дублирования карточки.

**Тело запроса:**
```json
{
  "items": [
    {
      "original_question": "Оригинал",
      "new_question": "Дубликат"
    }
  ],
  "duplicated_by": "jeff"
}
```

**Ответ:**
```json
{ "ok": true }
```

---

### 9. Прогресс пользователя

**GET** `/api/progress?username={username}`

Получает прогресс пользователя (SRS, статистика).

**Ответ:**
```json
{
  "ok": true,
  "userData": {
    "_srsProgress": {...},
    "_stats": {...},
    "_achievements": {...}
  }
}
```

**POST** `/api/progress?username={username}`

Обновляет прогресс пользователя.

**Тело запроса:**
```json
{
  "_srsProgress": {...},
  "_stats": {...},
  "_achievements": {...}
}
```

**Ответ:**
```json
{ "ok": true }
```

---

### 10. Логи (только для админов)

**GET** `/api/logs?username={username}&limit=100&level=DEBUG`

Получает логи сервера. Доступно только пользователям с ролью `admin`.

**Параметры:**
- `limit` — максимальное количество записей (по умолчанию 100)
- `level` — минимальный уровень логирования (DEBUG, INFO, WARN, ERROR)
- `context` — фильтр по контексту
- `search` — текстовый поиск

**Ответ:**
```json
{
  "ok": true,
  "logs": [...]
}
```

---

## Структура данных

### Карточка вопроса

```json
{
  "id": 0,
  "question": "Текст вопроса",
  "answer": "Текст ответа",
  "category": "Название колоды",
  "subcategory": "Название темы"
}
```

### Элемент корзины

```json
{
  "item": {
    "question": "Текст вопроса",
    "answer": "Текст ответа",
    "category": "Колода",
    "subcategory": "Тема"
  },
  "deleted_at": "2026-03-10T16:00:00.000Z",
  "deleted_by": "jeff"
}
```

---

## Файлы данных

Сервер хранит данные в папке `data/`:

| Файл | Описание |
|------|----------|
| `user_{username}.json` | Основные данные пользователя (карточки, прогресс, избранное) |
| `user_{username}_metadata.json` | Метаданные (порядок колод, карточек) |
| `user_{username}_trash.json` | Корзина пользователя |
| `questions_no_anki.json` | Базовый набор карточек (global) |

---

## Примеры использования

### Добавить карточку в корзину

```javascript
const response = await fetch('http://localhost:8085/trash?user=jeff', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: [{
      question: 'CI CD?',
      answer: 'Continuous Integration / Continuous Delivery',
      category: 'DevOps',
      subcategory: 'CI/CD'
    }]
  })
});
const result = await response.json();
console.log(result); // { ok: true, trash_size: 1 }
```

### Восстановить карточку из корзины

```javascript
const response = await fetch('http://localhost:8085/restore?user=jeff', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    questions: ['CI CD?']
  })
});
const result = await response.json();
console.log(result); // { ok: true, restored_count: 1 }
```

### Получить корзину

```javascript
const response = await fetch('http://localhost:8085/metadata?user=jeff');
const data = await response.json();
console.log(data.trash_bin); // Массив элементов корзины
```

---

## Статусы ответов

| Код | Описание |
|-----|----------|
| 200 | Успешное выполнение |
| 400 | Ошибка запроса (неверный JSON, отсутствует username) |
| 401 | Неавторизованный доступ (неверный токен) |
| 403 | Доступ запрещён (недостаточно прав) |
| 500 | Ошибка сервера |

---

## Примечания

1. **Сервер — главный источник истины.** Все данные должны синхронизироваться с сервером.
2. **localStorage используется для кэширования.** При первой загрузке данные берутся из localStorage, затем обновляются с сервера.
3. **Корзина персональная.** Каждый пользователь имеет свою корзину в файле `user_{username}_trash.json`.
4. **Удаление навсегда.** После `/delete-permanent` карточка удаляется из корзины и помечается как удалённая локально.
