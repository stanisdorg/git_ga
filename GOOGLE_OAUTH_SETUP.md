# Google OAuth Setup

## Credentials (ХРАНИТЬ В СЕКРЕТЕ!)

**Файл:** `.env.google` (не коммитить в git!)

```
GOOGLE_CLIENT_ID=862467912934-pjug7gt80qcp3t4rmtjvvu78fa6nukuf.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
```

## Redirect URIs

| Среда | URI |
|-------|-----|
| Production | `https://bytecards.ru/` |
| Localhost | `http://localhost:8085/` |

## Google Cloud Console

**Проект:** ByteCards  
**Ссылка:** https://console.cloud.google.com/

## Следующие шаги

1. ✅ Google Cloud проект создан
2. ✅ OAuth Consent Screen настроен
3. ✅ OAuth Client ID создан
4. ⏳ Добавить кнопку Google в `index.html`
5. ⏳ Добавить endpoint `/api/auth/google` в `server.js`
6. ⏳ Тестировать
