# 🔐 Как добавить Privacy Policy и Terms of Service для Google OAuth

## ✅ Что уже сделано:

1. ✅ Созданы файлы:
   - `legal/privacy.html` - Privacy Policy (веб-версия)
   - `legal/terms.html` - Terms of Service (веб-версия)
   - `legal/privacy.md` - Privacy Policy (Markdown)
   - `legal/terms.md` - Terms of Service (Markdown)

2. ✅ Файлы закоммичены в Git

---

## 📋 **ШАГ 1: Создай новый репозиторий для legal документов**

### 1.1 Открой GitHub

Зайди на: https://github.com/new

### 1.2 Создай репозиторий

| Поле | Значение |
|------|----------|
| **Repository name** | `bytecards-legal` |
| **Description** | `Legal documents for ByteCards application` |
| **Visibility** | ✅ Public |
| **Initialize with README** | ❌ Не отмечай |

**Нажми "Create repository"**

---

## 📋 **ШАГ 2: Загрузи файлы на GitHub**

### Вариант A: Через Git командную строку (рекомендуется)

```bash
# Перейди в папку legal
cd C:\Users\web\Desktop\git_qa\git_ga\legal

# Инициализируй Git
git init

# Добавь все файлы
git add .

# Создай коммит
git commit -m "Add Privacy Policy and Terms of Service"

# Добавь удалённый репозиторий (замени stanisdorg на свой username если нужно)
git remote add origin https://github.com/stanisdorg/bytecards-legal.git

# Отправь файлы
git push -u origin main
```

### Вариант B: Через GitHub UI (проще)

1. Открой созданный репозиторий: https://github.com/stanisdorg/bytecards-legal
2. Нажми **"uploading an existing file"**
3. Перетащи файлы:
   - `privacy.html`
   - `terms.html`
   - `privacy.md`
   - `terms.md`
   - `README.md`
4. Нажми **"Commit changes"**

---

## 📋 **ШАГ 3: Включи GitHub Pages**

### 3.1 Открой настройки репозитория

1. Зайди в репозиторий: https://github.com/stanisdorg/bytecards-legal
2. Нажми **Settings** (вверху)

### 3.2 Включи Pages

1. В меню слева найди **Pages**
2. **Source:** Deploy from a branch
3. **Branch:** main
4. **Folder:** / (root)
5. Нажми **Save**

### 3.3 Подожди 1-2 минуты

GitHub Pages опубликует сайт.

### 3.4 Проверь URL

Открой в браузере:
- Privacy Policy: `https://stanisdorg.github.io/bytecards-legal/privacy.html`
- Terms of Service: `https://stanisdorg.github.io/bytecards-legal/terms.html`

**Если видишь красивые страницы с текстом — всё получилось!** ✅

---

## 📋 **ШАГ 4: Добавь URL в Google Cloud Console**

### 4.1 Открой Google Cloud Console

Зайди на: https://console.cloud.google.com/

### 4.2 Выбери проект

Вверху выбери проект: **ByteCards**

### 4.3 Открой OAuth consent screen

1. В меню слева: **APIs & Services** → **OAuth consent screen**

### 4.4 Добавь URLs

Прокрути вниз до раздела:

| Поле | Значение |
|------|----------|
| **Privacy Policy URL** | `https://stanisdorg.github.io/bytecards-legal/privacy.html` |
| **Terms of Service URL** | `https://stanisdorg.github.io/bytecards-legal/terms.html` |

### 4.5 Сохрани

**Нажми "Save"** внизу страницы.

---

## 📋 **ШАГ 5: Проверь что всё работает**

### 5.1 Проверка в Google Cloud Console

1. В **OAuth consent screen** должно быть:
   - ✅ Publishing status: **Testing** (или **In production** если верифицировано)
   - ✅ Privacy Policy URL: заполнено
   - ✅ Terms of Service URL: заполнено

### 5.2 Проверка ссылок

Открой в браузере:
- ✅ `https://stanisdorg.github.io/bytecards-legal/privacy.html` — должна открыться Privacy Policy
- ✅ `https://stanisdorg.github.io/bytecards-legal/terms.html` — должна открыться Terms of Service

---

## 🎯 **Что дальше?**

### Сейчас (до 100 пользователей):

- ✅ Ничего не нужно делать
- ✅ Приложение может работать без верификации
- ⚠️ Пользователи видят предупреждение "This app isn't verified"

### Когда приблизишься к 100 пользователям:

1. **Вернись в Google Cloud Console**
2. **OAuth consent screen** → нажми **Publish App**
3. **Заполни форму верификации:**
   - Domain verification (уже есть GitHub Pages)
   - Privacy Policy (уже есть)
   - Terms of Service (уже есть)
4. **Отправь на проверку**
5. **Жди 3-7 дней**

---

## ❓ **FAQ**

### Q: Можно ли использовать один репозиторий для всего?

**A:** Да, можно использовать `git_ga` и включить Pages для папки `/legal`. Но лучше отдельный репозиторий — чище и профессиональнее.

### Q: Что если я не хочу использовать GitHub Pages?

**A:** Можно разместить на:
- **Vercel** (https://vercel.com) — бесплатно
- **Netlify** (https://netlify.com) — бесплатно
- **Notion** + публикация страницы
- **Google Sites** — бесплатно

### Q: Нужно ли менять email в документах?

**A:** Если хочешь использовать другой email — открой `privacy.html` и `terms.html`, найди `stasdoroganov@gmail.com` и замени на нужный.

### Q: Что если я хочу изменить текст?

**A:** Отредактируй `.md` файлы (Markdown проще), затем сгенерируй HTML или отредактируй `.html` напрямую.

---

## 📞 **Нужна помощь?**

Если что-то не получается:

1. Проверь что репозиторий **Public** (не Private)
2. Проверь что GitHub Pages включён
3. Подожди 5-10 минут после включения Pages
4. Попробуй открыть URL в режиме инкогнито

---

**Удачи! 🚀**

После выполнения шагов у тебя будут рабочие URL для Google OAuth верификации!
