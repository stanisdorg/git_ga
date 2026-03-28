import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { logger } from './logger.js';
import * as Sentry from '@sentry/node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8085;
const IP = '0.0.0.0'; // Слушаем на всех интерфейсах
const VERSION = '6.18';

// ============================================
// Sentry Error Tracking
// ============================================
const SENTRY_DSN = process.env.SENTRY_DSN || '';

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1, // 10% транзакций
    release: `bytecards@${VERSION}`,
  });
  console.log('[Sentry] Инициализирован');
} else {
  console.log('[Sentry] Не настроен (SENTRY_DSN не указан)');
}

console.log('========================================');
console.log(`[SERVER] Starting QA Assistant v${VERSION}...`);
console.log('========================================');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// ============================================
// Хеширование паролей (SHA-256 + соль)
// ============================================
const PASSWORD_SALT = process.env.PASSWORD_SALT || 'qa_helper_salt_2026_secure_key';

function hashPassword(password) {
  return crypto.createHash('sha256').update(PASSWORD_SALT + password).digest('hex');
}

function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

// ============================================
// Telegram Auth (v6.09)
// ============================================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8636706073:AAFKjiCtuU0zlhYCJI-glCc_Bc_xKpWqTcI';
const TELEGRAM_CHANNEL_ID = '@brotherhood_qa';
const TELEGRAM_ADMIN_IDS = [721236696]; // 🛡️ Ваш основной ID для гарантированного входа

/**
 * Проверка подписи Telegram (защита от подделки)
 */
function verifyTelegramAuth(data) {
  const { hash, ...authData } = data;

  // 1. Создаем строку из всех полей (кроме hash), отсортированных по алфавиту
  const checkString = Object.keys(authData)
    .sort()
    .map(key => `${key}=${authData[key]}`)
    .join('\n');

  // 2. Вычисляем секретный ключ (SHA256 от токена бота)
  const secretKey = crypto.createHash('sha256')
    .update(TELEGRAM_BOT_TOKEN)
    .digest();

  // 3. Вычисляем HMAC-SHA256 от строки с данными
  const hmac = crypto.createHmac('sha256', secretKey)
    .update(checkString)
    .digest('hex');

  // 4. Сравниваем с присланным хешем
  return hmac === hash;
}

/**
 * Проверка подписки на канал через Telegram Bot API
 */
async function checkTelegramSubscription(userId) {
  const numId = Number(userId);
  logger.info(`Проверка подписки для ID: ${numId}`, null, 'TG API');

  // 🛡️ БАЙПАС ТОЛЬКО ДЛЯ АДМИНИСТРАТОРОВ (Станислав)
  if (TELEGRAM_ADMIN_IDS.includes(numId)) {
    logger.info(`!!! БАЙПАС СРАБОТАЛ !!! Вход разрешен для ID ${numId}`, null, 'TG API');
    return true;
  }

  try {
    // Запрос через Cloudflare Worker (обход блокировок Telegram API)
    const workerUrl = 'https://telegram-check.stasdoroganov.workers.dev/';

    const postData = JSON.stringify({
      user_id: userId
    });

    const options = {
      hostname: 'telegram-check.stasdoroganov.workers.dev',
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      },
      timeout: 15000 // 15 секунд таймаут
    };

    console.log(`[TG API] Запрос через Cloudflare Worker: ${workerUrl}`);
    console.log(`[TG API] Данные: user_id=${userId}`);

    const response = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        console.log(`[TG API] HTTP статус от Worker: ${res.statusCode}`);
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            console.log(`[TG API] Ответ от Telegram:`, JSON.stringify(parsed, null, 2));
            logger.info(`Ответ от Telegram для ${userId}:`, parsed, 'TG API');
            resolve(parsed);
          } catch (e) {
            console.error(`[TG API] Ошибка парсинга JSON:`, data.substring(0, 200));
            reject(new Error(`Invalid JSON from Telegram API: ${data.substring(0, 100)}`));
          }
        });
      });
      req.on('error', (err) => {
        console.error(`[TG API] Ошибка запроса к Worker:`, err.message, err.code || '');
        reject(err);
      });
      req.setTimeout(15000, () => {
        req.destroy();
        console.error(`[TG API] Таймаут запроса к Worker (15s)`);
        reject(new Error('Cloudflare Worker timeout (15s)'));
      });
      req.write(postData);
    });

    if (!response.ok) {
      console.error(`[TG API] response.ok = false, description:`, response.description);
      logger.error('Ошибка запроса к Telegram:', { description: response.description }, 'TG API');
      return false;
    }

    const status = response.result.status;
    logger.info(`Статус пользователя ${userId} в канале ${TELEGRAM_CHANNEL_ID}: ${status}`, null, 'TG API');

    // Статусы 'member', 'administrator', 'creator', 'restricted' (если может читать)
    // ВАЖНО: 'restricted' тоже может быть подписчиком, но с ограничениями
    const isSubscribed = ['member', 'administrator', 'creator', 'restricted'].includes(status);

    if (!isSubscribed) {
      logger.warn(`Пользователь ${userId} имеет статус "${status}", доступ запрещен.`, null, 'TG API');
    }
    return isSubscribed;
  } catch (error) {
    logger.error('Ошибка при проверке подписки:', { error: error.message }, 'TG API');
    return false;
  }
}

/**
 * Отправка сообщения в Telegram через Bot API
 */
async function sendTelegramMessage(chatId, text) {
  try {
    const data = JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML' });
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', chunk => responseBody += chunk);
        res.on('end', () => resolve(JSON.parse(responseBody)));
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  } catch (error) {
    console.error('[TG Bot] Ошибка отправки сообщения:', error);
  }
}

/**
 * Обработка входящих команд бота
 */
async function handleBotCommand(message) {
  try {
    const chatId = message.chat.id;
    const userId = message.from.id;
    const text = message.text || '';

    console.log(`[TG Bot] Обработка команды: "${text}" от ${userId}`);

    // 🛡️ Проверка прав администратора (Станислав)
    if (!TELEGRAM_ADMIN_IDS.includes(userId)) {
      console.warn(`[TG Bot] Попытка несанкционированного доступа: ID ${userId}`);
      await sendTelegramMessage(chatId, '❌ У вас нет прав для управления пользователями.');
      return;
    }

    // Команда /start
    if (text.startsWith('/start')) {
      await sendTelegramMessage(chatId,
        '👋 <b>Добро пожаловать в админ-панель ByteCards!</b>\n\n' +
        'Доступные команды:\n' +
        '/users — Список всех пользователей\n' +
        '/setrole username role — Изменить роль (admin/editor/guest)'
      );
      return;
    }

    // Команда /users
    if (text === '/users') {
      const usersPath = path.join(__dirname, 'data', 'users.json');
      if (!fs.existsSync(usersPath)) {
        await sendTelegramMessage(chatId, '📭 База пользователей пуста.');
        return;
      }
      const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
      let response = '👥 <b>Список пользователей:</b>\n\n';
      users.forEach((u, i) => {
        response += `${i + 1}. <code>${u.username}</code> [${u.role}]\n`;
        if (u.firstName) response += `   👤 ${u.firstName} ${u.lastName || ''}\n`;
        if (u.telegramId) response += `   🆔 <code>${u.telegramId}</code>\n`;
        response += '\n';
      });
      await sendTelegramMessage(chatId, response);
      return;
    }

    // Команда /setrole
    if (text.startsWith('/setrole')) {
      const parts = text.split(' ');
      if (parts.length < 3) {
        await sendTelegramMessage(chatId, '⚠️ Формат: <code>/setrole username role</code>\nПример: <code>/setrole stas admin</code>');
        return;
      }
      const targetUser = parts[1];
      const newRole = parts[2];

      const usersPath = path.join(__dirname, 'data', 'users.json');
      let users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
      const userIndex = users.findIndex(u => u.username === targetUser);

      if (userIndex === -1) {
        await sendTelegramMessage(chatId, `❌ Пользователь <code>${targetUser}</code> не найден.`);
        return;
      }

      users[userIndex].role = newRole;
      fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf-8');
      await sendTelegramMessage(chatId, `✅ Роль пользователя <code>${targetUser}</code> изменена на <b>${newRole}</b>.`);
      return;
    }
  } catch (err) {
    console.error('[TG Bot] Ошибка в handleBotCommand:', err);
  }
}

// ============================================
const server = http.createServer((req, res) => {
  try {
    const ts = new Date().toISOString();
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const pathname = urlObj.pathname;

    // ВАЖНО: Всегда устанавливаем UTF-8 для JSON ответов
    if (pathname.startsWith('/api/') || pathname.startsWith('/load') || pathname.startsWith('/save')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }

    // Детальное логирование всех запросов
    logger.info('HTTP запрос', {
      method: req.method,
      url: req.url,
      path: pathname,
      query: Object.fromEntries(urlObj.searchParams),
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
        'content-length': req.headers['content-length']
      }
    }, 'HTTP');

    console.log(`${ts} - ${req.method} ${req.url}`);

    // 🤖 [CRITICAL] Telegram Bot Webhook (v6.09.4)
    // Выносим в самое начало, до любых проверок прав и статики
    const webhookUrl = `/api/bot-webhook/${TELEGRAM_BOT_TOKEN}`;
    if (req.method === 'POST' && (pathname === webhookUrl || pathname === webhookUrl + '/')) {
      console.log(`[TG Bot Webhook] >>> Входящее обновление (${req.url})`);
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          if (!body) {
            console.warn('[TG Bot Webhook] Пустое тело запроса');
            res.writeHead(200);
            res.end();
            return;
          }

          const update = JSON.parse(body);
          console.log('[TG Bot Webhook] JSON распарсен, тип:', update.message ? 'message' : 'other');

          if (update.message) {
            console.log(`[TG Bot Webhook] Команда от ${update.message.from.username || update.message.from.id}: ${update.message.text}`);
            await handleBotCommand(update.message);
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          console.error('[TG Bot Webhook] CRITICAL ERROR:', e);
          res.writeHead(200); // Telegram требует 200 чтобы не слать повторно
          res.end();
        }
      });
      return;
    }

    // Логирование всех POST запросов для отладки
    if (req.method === 'POST') {
      console.log('[SERVER DEBUG] POST запрос:', req.url);
      req.setEncoding('utf-8'); // 🔧 Глобально устанавливаем кодировку для всех POST запросов, чтобы избежать разрыва UTF-8 символов
    }

    // CORS и preflight
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // No-cache headers для ВСЕХ запросов
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    res.setHeader('Connection', 'close');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // 🛡️ ЗАЩИТА ОТ ПЕРЕХВАТА API СТАТИКОЙ
    // Если запрос начинается с /api/, /load, /save и т.д., мы НЕ должны отдавать index.html
    const isApiRequest = pathname.startsWith('/api/') ||
      pathname.startsWith('/load') ||
      pathname.startsWith('/save') ||
      pathname.startsWith('/metadata') ||
      pathname.startsWith('/trash') ||
      pathname.startsWith('/restore') ||
      pathname.startsWith('/duplicate') ||
      pathname.includes('/bot-webhook/');

    // 🔒 ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ПРОВЕРКИ ПРАВ
    // isEditor: true для проверки прав editor/admin, false для проверки только admin
    function checkUserPermissions(req, res, requireAdmin = false) {
      const username = urlObj.searchParams.get('username') || urlObj.searchParams.get('user');

      // 🔒 ВАЛИДАЦИЯ username (только буквы, цифры, _)
      if (username && !/^[a-zA-Z0-9_]{1,50}$/.test(username)) {
        return { authorized: false, reason: 'invalid username format' };
      }

      if (!username) {
        return { authorized: false, reason: 'username required' };
      }

      try {
        const usersPath = path.join(__dirname, 'data', 'users.json');
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
        const user = users.find(u => u.username === username);

        if (!user) {
          return { authorized: false, reason: 'user not found' };
        }

        // Если требуется admin, проверяем только admin
        if (requireAdmin && user.role !== 'admin') {
          return { authorized: false, reason: 'admin access required' };
        }

        // Для editor: разрешаем admin и editor
        if (!requireAdmin && !['admin', 'editor'].includes(user.role)) {
          return { authorized: false, reason: 'editor or admin access required' };
        }

        return { authorized: true, user, role: user.role };
      } catch (e) {
        return { authorized: false, reason: 'error checking permissions' };
      }
    }

    // Для обратной совместимости
    function checkAdmin(req, res) {
      return checkUserPermissions(req, res, true); // requireAdmin = true
    }

    // API: Логи (ТОЛЬКО ДЛЯ АДМИНОВ!)
    if (req.method === 'GET' && pathname.startsWith('/api/logs')) {
      const adminCheck = checkAdmin(req, res); // requireAdmin = true
      if (!adminCheck.authorized) {
        logger.warn('Доступ к логам без авторизации', {
          username: urlObj.searchParams.get('username'),
          reason: adminCheck.reason
        }, 'Security');
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: adminCheck.reason }));
        return;
      }

      const limit = parseInt(urlObj.searchParams.get('limit') || '100');
      const level = urlObj.searchParams.get('level') || 'DEBUG';
      const context = urlObj.searchParams.get('context');
      const search = urlObj.searchParams.get('search');
      const logs = logger.getLogs({ limit, level, context, search });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, logs }));
      return;
    }

    if (req.method === 'POST' && pathname === '/api/logs/clear') {
      const adminCheck = checkAdmin(req, res);
      if (!adminCheck.authorized) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'admin access required' }));
        return;
      }
      const result = logger.clearLogs();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (req.method === 'GET' && pathname === '/api/logs/stats') {
      const adminCheck = checkAdmin(req, res);
      if (!adminCheck.authorized) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'admin access required' }));
        return;
      }
      const stats = logger.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, stats }));
      return;
    }

    // Helper: Generate random session token (DISABLED for development)
    // const generateToken = () => {
    //   return 'session_' + crypto.randomBytes(16).toString('hex');
    // };

    // Helper: Verify token (DISABLED for development)
    // const verifyToken = (token) => {
    //   return activeTokens.get(token) || null;
    // };
    const activeTokens = new Map(); // Keep for future use

    // 🔒 RATE LIMITING ДЛЯ LOGIN (защита от brute-force)
    const loginAttempts = new Map(); // IP → { count, lastAttempt }
    const MAX_ATTEMPTS = 5;
    const BLOCK_TIME_MS = 15 * 60 * 1000; // 15 минут блокировки

    function checkRateLimit(ip) {
      const now = Date.now();
      const attempt = loginAttempts.get(ip);

      if (attempt) {
        // Если прошло больше BLOCK_TIME_MS, сбрасываем счётчик
        if (now - attempt.lastAttempt > BLOCK_TIME_MS) {
          loginAttempts.delete(ip);
          return { allowed: true };
        }

        // Если превышен лимит попыток
        if (attempt.count >= MAX_ATTEMPTS) {
          const remainingTime = Math.ceil((BLOCK_TIME_MS - (now - attempt.lastAttempt)) / 60000);
          return { allowed: false, remainingMinutes: remainingTime };
        }

        // Увеличиваем счётчик
        attempt.count++;
        attempt.lastAttempt = now;
        loginAttempts.set(ip, attempt);
        return { allowed: true };
      }

      // Первая попытка
      loginAttempts.set(ip, { count: 1, lastAttempt: now });
      return { allowed: true };
    }

    function resetRateLimit(ip) {
      loginAttempts.delete(ip);
    }

    // POST /api/auth/google - Вход через Google OAuth
    if (req.method === 'POST' && pathname === '/api/auth/google') {
      console.log('[Google Auth] Входящий запрос на авторизацию');
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { email, name, picture, googleId } = JSON.parse(body);
          console.log('[Google Auth] Данные получены:', email);

          const usersPath = path.join(__dirname, 'data', 'users.json');
          let users = [];
          if (fs.existsSync(usersPath)) {
            users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
          }

          // Ищем пользователя по email или googleId
          let user = users.find(u => u.email === email || u.googleId === googleId);

          if (!user) {
            // Создаём нового пользователя
            const username = email.split('@')[0].toLowerCase(); // hello@gmail.com → hello
            user = {
              username: username,
              email: email,
              googleId: googleId,
              name: name,
              picture: picture,
              role: 'editor',  // Дефолтная роль
              password: crypto.randomBytes(32).toString('hex'), // Случайный пароль
              createdAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString()
            };
            users.push(user);
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf-8');
            logger.info('Новый пользователь зарегистрирован через Google', { username: user.username }, 'Auth');

            // Создаём файл данных пользователя
            const newUserPath = path.join(__dirname, 'data', `user_${user.username}.json`);
            const globalPath = path.join(__dirname, 'data', 'global.json');
            let initialCards = [];
            if (fs.existsSync(globalPath)) {
              initialCards = JSON.parse(fs.readFileSync(globalPath, 'utf-8'));
            }
            const initialData = {
              _cards: initialCards,
              _achievements: {},
              _favorites: [],
              _srsProgress: {},
              _stats: {},
              _meta: {
                username: user.username,
                role: user.role,
                createdAt: user.createdAt,
                lastLoginAt: user.lastLoginAt,
                cardsCount: initialCards.length
              }
            };
            fs.writeFileSync(newUserPath, JSON.stringify(initialData, null, 2), 'utf-8');
            logger.info('Файл данных создан для ' + user.username, null, 'Auth');
          } else {
            // Обновляем lastLoginAt
            user.lastLoginAt = new Date().toISOString();
            user.name = name || user.name;
            user.picture = picture || user.picture;
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf-8');
            logger.info('Пользователь вошёл через Google', { username: user.username }, 'Auth');
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ok: true,
            username: user.username,
            role: user.role
          }));
        } catch (e) {
          console.error('[Google Auth] Ошибка:', e.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    // POST /api/auth/telegram - Вход через Telegram (v6.09)
    if (req.method === 'POST' && pathname === '/api/auth/telegram') {
      console.log('========================================');
      console.log('[TG Auth] 🔐 ВХОДЯЩИЙ ЗАПРОС НА АВТОРИЗАЦИЮ');
      console.log('[TG Auth] Headers:', JSON.stringify(req.headers, null, 2));
      console.log('[TG Auth] Origin:', req.headers.origin);
      console.log('[TG Auth] TELEGRAM_BOT_TOKEN (first 8 chars):', TELEGRAM_BOT_TOKEN.substring(0, 8) + '...');

      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 50000) req.destroy(); // Защита от переполнения
      });
      req.on('error', (err) => {
        console.error('[TG Auth] Request error:', err.message);
        if (!res.writableEnded) { res.writeHead(400); res.end(); }
      });
      req.on('end', async () => {
        try {
          if (!body) {
            console.error('[TG Auth] ❌ Пустое тело запроса');
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Empty body' }));
            return;
          }

          console.log('[TG Auth] Сырое тело запроса:', body);

          const authData = JSON.parse(body);
          console.log('[TG Auth] 📥 Данные получены:', JSON.stringify(authData, null, 2));
          console.log('[TG Auth] ID:', authData.id);
          console.log('[TG Auth] Username:', authData.username);
          console.log('[TG Auth] Hash:', authData.hash);
          console.log('[TG Auth] Auth date:', authData.auth_date);

          // 1. Проверка подписи Telegram
          console.log('[TG Auth] 🔍 Начало проверки подписи Telegram...');
          const isValid = verifyTelegramAuth(authData);
          console.log('[TG Auth] Результат проверки подписи:', isValid ? '✅ VALID' : '❌ INVALID');

          if (!isValid) {
            console.error('[TG Auth] ❌ ОШИБКА: Неверная подпись Telegram');
            console.error('[TG Auth] Данные для проверки:', JSON.stringify(authData, null, 2));
            logger.warn('Попытка входа с неверным хешем Telegram', { id: authData.id }, 'Auth');
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Invalid Telegram hash' }));
            return;
          }

          // 2. Проверка подписки на канал (с таймаутом)
          console.log('[TG Auth] 🔍 Проверка подписки на канал...');
          const isSubscribed = await checkTelegramSubscription(authData.id);

          // 🔍 ЛОГ ДЛЯ ОТЛАДКИ (v6.09.3)
          console.log(`[TG Auth] Результат проверки подписки для ${authData.id}: ${isSubscribed}`);

          if (!isSubscribed) {
            console.warn(`[TG Auth] ❌ Доступ запрещен: пользователь ${authData.id} не подписан.`);
            logger.info('Отказано во входе: пользователь не подписан на канал', { id: authData.id }, 'Auth');
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              ok: false,
              error: 'not_subscribed',
              message: 'Чтобы войти, подпишитесь на наш канал: ' + TELEGRAM_CHANNEL_ID
            }));
            return;
          }

          console.log(`[TG Auth] ✅ Доступ разрешен для ${authData.id}. Продолжаем вход...`);

          // 3. Работа с базой пользователей
          const usersPath = path.join(__dirname, 'data', 'users.json');
          let users = [];
          if (fs.existsSync(usersPath)) {
            users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
          }

          // Ищем по telegramId или по username (если совпадает)
          let user = users.find(u => u.telegramId === authData.id || u.username === authData.username);

          if (!user) {
            // 🆕 РЕГИСТРАЦИЯ НОВОГО ПОЛЬЗОВАТЕЛЯ
            user = {
              username: authData.username || `user_${authData.id}`,
              telegramId: authData.id,
              firstName: authData.first_name,
              lastName: authData.last_name,
              role: (TELEGRAM_ADMIN_IDS.includes(authData.id)) ? 'admin' : 'editor', // Админ для вас, редактор для остальных
              createdAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString()
            };
            users.push(user);
            logger.info('Новый пользователь зарегистрирован через Telegram', { username: user.username }, 'Auth');

            // 📄 СОЗДАЕМ ФАЙЛ ДАННЫХ ДЛЯ НОВОГО ПОЛЬЗОВАТЕЛЯ
            const newUserPath = path.join(__dirname, 'data', `user_${user.username}.json`);
            const globalPath = path.join(__dirname, 'data', 'global.json');
            let initialCards = [];
            if (fs.existsSync(globalPath)) {
              initialCards = JSON.parse(fs.readFileSync(globalPath, 'utf-8'));
            }
            const initialData = {
              _cards: initialCards,
              _achievements: {},
              _favorites: [],
              _srsProgress: {},
              _stats: {},
              _meta: {
                username: user.username,
                role: user.role,
                createdAt: user.createdAt,
                lastLoginAt: user.lastLoginAt,
                cardsCount: initialCards.length
              }
            };
            fs.writeFileSync(newUserPath, JSON.stringify(initialData, null, 2), 'utf-8');
          } else {
            // Обновляем данные существующего
            user.telegramId = authData.id;
            user.lastLoginAt = new Date().toISOString();
            if (authData.username) user.username = authData.username;
          }

          // Сохраняем изменения
          fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf-8');

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ok: true,
            username: user.username,
            role: user.role
          }));
        } catch (e) {
          console.error('[TG Auth] Error:', e.message);
          if (!res.writableEnded) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Internal server error' }));
          }
        }
      });
      return;
    }

    // POST /api/login - Login and get username (token disabled)
    if (req.method === 'POST' && pathname === '/api/login') {
      // Получаем IP клиента для rate limiting
      const clientIP = req.headers['x-forwarded-for']?.split(',')[0] ||
        req.headers['x-real-ip'] ||
        req.socket.remoteAddress ||
        'unknown';

      // 🔒 ПРОВЕРКА RATE LIMIT
      const rateLimit = checkRateLimit(clientIP);
      if (!rateLimit.allowed) {
        logger.warn('Brute-force атака (превышен лимит)', {
          ip: clientIP,
          remainingMinutes: rateLimit.remainingMinutes
        }, 'Security');
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: false,
          error: `Too many login attempts. Try again in ${rateLimit.remainingMinutes} minutes.`
        }));
        return;
      }

      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          // ВАЖНО: Не логируем тело запроса чтобы не сохранять пароли!
          logger.info('Login запрос', { username: '***' }, 'Auth');
          if (!body) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Empty body' }));
            return;
          }
          const parsed = JSON.parse(body);
          const username = parsed.username;
          const password = parsed.password;

          // 🔒 ВАЛИДАЦИЯ ВХОДНЫХ ДАННЫХ
          if (typeof username !== 'string' || typeof password !== 'string') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'invalid input type' }));
            return;
          }

          // Проверяем длину (защита от переполнения)
          if (username.length > 50 || password.length > 100) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'input too long' }));
            return;
          }

          // Проверяем формат username (только буквы, цифры, _)
          if (!/^[a-zA-Z0-9_]{1,50}$/.test(username)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'invalid username format' }));
            return;
          }

          if (!username || !password) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'username and password required' }));
            return;
          }

          const usersPath = path.join(__dirname, 'data', 'users.json');

          if (!fs.existsSync(usersPath)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Users database not found' }));
            return;
          }

          const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));

          // Ищем пользователя и проверяем хеш пароля
          const user = users.find(u => u.username === username);

          if (!user || !verifyPassword(password, user.password)) {
            logger.warn('Неверный пароль', { username, ip: clientIP }, 'Auth');
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Invalid credentials' }));
            return;
          }

          // Успешный вход — сбрасываем счётчик попыток
          resetRateLimit(clientIP);

          // Update lastLoginAt in users.json
          const userIndex = users.findIndex(u => u.username === username);
          if (userIndex !== -1) {
            users[userIndex].lastLoginAt = new Date().toISOString();
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf-8');
          }

          console.log(`[Login] User ${username} logged in successfully`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ok: true,
            username: user.username,
            role: user.role
            // token removed for development simplicity
          }));
        } catch (e) {
          console.error('[Login] Error:', e.message);
          console.error('[Login] Stack:', e.stack);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'invalid_json', details: e.message }));
        }
      });
      return;
    }

    // POST /api/logout - Invalidate session token
    if (req.method === 'POST' && pathname === '/api/logout') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { token } = JSON.parse(body);
          if (token && activeTokens.has(token)) {
            const userInfo = activeTokens.get(token);
            console.log(`[Logout] User ${userInfo.username} logged out`);
            activeTokens.delete(token);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'invalid_json' }));
        }
      });
      return;
    }

    // POST /api/register - Register new user
    if (req.method === 'POST' && pathname === '/api/register') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { username, password, role, adminToken } = JSON.parse(body);

          // Verify admin token (only admin can create new users)
          const adminInfo = verifyToken(adminToken);
          if (!adminInfo || adminInfo.role !== 'admin') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Admin authorization required' }));
            return;
          }

          const usersPath = path.join(__dirname, 'data', 'users.json');
          const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));

          // Check if user exists
          if (users.find(u => u.username === username)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'User already exists' }));
            return;
          }

          // Add user to users.json с хешированным паролем
          const newUser = {
            username,
            password: hashPassword(password), // Хешируем пароль
            role: role || 'user',
            createdAt: new Date().toISOString()
          };
          users.push(newUser);
          fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf-8');

          // Clone global.json to user file
          const globalPath = path.join(__dirname, 'data', 'global.json');
          const globalCards = JSON.parse(fs.readFileSync(globalPath, 'utf-8'));

          const userFile = {
            _meta: {
              username,
              role: role || 'user',
              createdAt: new Date().toISOString(),
              lastLoginAt: null,
              cardsCount: globalCards.length
            },
            _cards: globalCards,
            _achievements: {},
            _stats: {},
            _srsProgress: {},
            _favorites: []
          };

          const userFilePath = path.join(__dirname, 'data', `user_${username}.json`);
          fs.writeFileSync(userFilePath, JSON.stringify(userFile, null, 2), 'utf-8');

          // Create user metadata file
          const metadataFilePath = path.join(__dirname, 'data', `user_${username}_metadata.json`);
          fs.writeFileSync(metadataFilePath, JSON.stringify({}, null, 2), 'utf-8');

          // Create user trash file
          const trashFilePath = path.join(__dirname, 'data', `user_${username}_trash.json`);
          fs.writeFileSync(trashFilePath, JSON.stringify([], null, 2), 'utf-8');

          console.log(`[Register] New user ${username} registered by admin ${adminInfo.username}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ok: true,
            user: { username, role: role || 'user' }
          }));
        } catch (e) {
          console.error('[Register] Error:', e.message);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    // GET /load - Load all user data (ТОЧНЫЙ МАТЧ /load или /load?user=...)
    if (req.method === 'GET' && pathname === '/load') {
      const username = urlObj.searchParams.get('user');
      // token parameter removed - using username only for development

      // Проверка что username существует
      if (!username) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'username required' }));
        return;
      }

      const userFilePath = path.join(__dirname, 'data', `user_${username}.json`);

      if (!fs.existsSync(userFilePath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'User data not found' }));
        return;
      }

      fs.readFile(userFilePath, 'utf-8', (err, content) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Read error' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(content);
      });
      return;
    }

    // GET /api/progress - Load all user progress
    if (req.method === 'GET' && pathname === '/api/progress') {
      const username = urlObj.searchParams.get('username');

      logger.info('=== ЗАПРОС НА ЗАГРУЗКУ ПРОГРЕССА ===', { username }, 'Load');

      if (!username) {
        logger.error('Ошибка: username не указан', null, 'Load');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'username required' }));
        return;
      }

      const targetPath = path.join(__dirname, 'data', `user_${username}.json`);
      console.log('[SERVER] ЧТЕНИЕ файла:', {
        operation: 'read',
        filePath: targetPath,
        username,
        exists: fs.existsSync(targetPath),
        timestamp: Date.now()
      });

      if (!fs.existsSync(targetPath)) {
        logger.warn('Файл пользователя не найден', { username }, 'Load');
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'User data not found' }));
        return;
      }

      try {
        const rawContent = fs.readFileSync(targetPath, 'utf-8');
        const userData = JSON.parse(rawContent);

        logger.info('Прочитано данных', {
          cards: userData._cards?.length || 0,
          favorites: Array.isArray(userData._favorites) ? userData._favorites.length : 0,
          achievements: Object.keys(userData._achievements || {}).length
        }, 'Load');

        // Загружаем корзину пользователя
        const trashPath = path.join(__dirname, 'data', `user_${username}_trash.json`);
        let trash = [];
        if (fs.existsSync(trashPath)) {
          trash = JSON.parse(fs.readFileSync(trashPath, 'utf-8')) || [];
        }

        const response = {
          ok: true,
          _cards: userData._cards || [],
          studyAchievements: userData._achievements || {},
          qaFavorites: userData._favorites || [],
          srsProgress: userData._srsProgress || {},
          studyStats: userData._stats || {},
          studyStreak: userData.studyStreak || {},
          dailyPoints: userData.dailyPoints || {},
          dailyBonusPoints: userData.dailyBonusPoints || {},
          dailyDayBonusPoints: userData.dailyDayBonusPoints || {},
          userTrash: trash,  // 🔒 Добавляем корзину
          updatedAt: Date.now()
        };

        // 🔍 ПРОВЕРКА ПЕРЕД ОТПРАВКОЙ КЛИЕНТУ
        const jsonResponse = JSON.stringify(response);
        const hasFFFDInResponse = jsonResponse.includes('\uFFFD');
        const hasBadRussianInResponse = /Д\?{1,5}кументация/.test(jsonResponse);
        const hasQuestionInRussianResponse = /[а-яА-Я]\?[а-яА-Я]/.test(jsonResponse);

        if (hasFFFDInResponse || hasBadRussianInResponse || hasQuestionInRussianResponse) {
          logger.error('❌ ОТВЕТ КЛИЕНТУ СОДЕРЖИТ ПОВРЕЖДЕННЫЕ СИМВОЛЫ!', {
            hasFFFDInResponse,
            hasBadRussianInResponse,
            hasQuestionInRussianResponse,
            responseLength: jsonResponse.length
          }, 'Load');

          // Сохраняем для отладки
          const debugResponsePath = path.join(__dirname, 'data', 'debug_server_response.json');
          fs.writeFileSync(debugResponsePath, jsonResponse, 'utf-8');
        }

        console.log('[SERVER /api/progress] Отправляем клиенту:', {
          cardsCount: response._cards?.length || 0,
          favoritesCount: response.qaFavorites?.length || 0,
          updatedAt: response.updatedAt
        });

        logger.info('=== ОТПРАВКА ДАННЫХ КЛИЕНТУ ===', null, 'Load');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(jsonResponse);
      } catch (e) {
        logger.error('Ошибка чтения', { error: e.message }, 'Load');
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'read_failed' }));
      }
      return;
    }

    // POST /api/progress - Save all user progress (achievements, favorites, stats)
    if (req.method === 'POST' && pathname === '/api/progress') {
      const username = urlObj.searchParams.get('username');

      if (!username) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'username required' }));
        return;
      }

      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const targetPath = path.join(__dirname, 'data', `user_${username}.json`);

          let userData = {};
          if (fs.existsSync(targetPath)) {
            userData = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
          }

          // Обновляем все данные
          if (data._cards) userData._cards = data._cards;
          if (data._achievements) userData._achievements = data._achievements;
          if (data._favorites) userData._favorites = data._favorites;
          if (data._stats) userData._stats = data._stats;
          if (data._srsProgress) userData._srsProgress = data._srsProgress;
          if (data.studyAchievements) userData._achievements = data.studyAchievements;
          if (data.qaFavorites) userData._favorites = data.qaFavorites;
          if (data.srsProgress) userData._srsProgress = data.srsProgress;
          if (data.studyStats) userData._stats = data.studyStats;

          fs.writeFile(targetPath, JSON.stringify(userData, null, 2), 'utf-8', (err) => {
            if (err) {
              console.error('Failed to save progress:', err);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: 'write_failed' }));
              return;
            }
            console.log(`[Progress] User ${username} saved progress`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          });
        } catch (e) {
          console.error('Invalid JSON body:', e);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'invalid_json' }));
        }
      });
      return;
    }

    // POST /api/card/update - Обновление одной карточки (вопрос/ответ)
    if (req.method === 'POST' && pathname === '/api/card/update') {
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const username = urlObj.searchParams.get('username');

      console.log('========================================');
      console.log('[SERVER /api/card/update] === ЗАПРОС НА ОБНОВЛЕНИЕ КАРТОЧКИ ===');
      console.log('[SERVER /api/card/update] username:', username);
      console.log('[SERVER /api/card/update] URL:', req.url);
      console.log('========================================');

      logger.info('=== ЗАПРОС НА ОБНОВЛЕНИЕ КАРТОЧКИ ===', { username }, 'CardUpdate');

      if (!username) {
        logger.error('Ошибка: username не указан', null, 'CardUpdate');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'username required' }));
        return;
      }

      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const { oldQuestion, newQuestion, newAnswer, formatting } = data;

          logger.info('Получены данные для обновления', {
            oldQuestionLength: oldQuestion?.length,
            newQuestionLength: newQuestion?.length,
            hasNewAnswer: !!newAnswer,
            hasFormatting: !!formatting
          }, 'CardUpdate');

          if (!oldQuestion || !newQuestion) {
            logger.error('Ошибка: oldQuestion и newQuestion обязательны', null, 'CardUpdate');
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'oldQuestion and newQuestion required' }));
            return;
          }

          const targetPath = path.join(__dirname, 'data', `user_${username}.json`);
          let userData = {};

          if (fs.existsSync(targetPath)) {
            userData = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
            console.log('[SERVER /api/card/update] Файл прочитан, количество карточек:', userData._cards?.length || 0);
            console.log('[SERVER /api/card/update] Время чтения файла:', new Date().toISOString());
          } else {
            console.log('[SERVER /api/card/update] Файл не существует:', targetPath);
          }

          // Логирование для отладки
          console.log('========================================');
          console.log('[SERVER /api/card/update] === ЧТЕНИЕ ПЕРЕД ЗАПИСЬЮ ===');
          console.log('[SERVER /api/card/update] Чтение файла:', targetPath);
          console.log('[SERVER /api/card/update] oldQuestion для поиска:', oldQuestion);
          console.log('[SERVER /api/card/update] Вопросы в файле (первые 5):', userData._cards?.slice(0, 5).map(c => c.question.substring(0, 30)) || []);
          console.log('========================================');

          // Ищем карточку по старому вопросу и обновляем
          let updated = false;
          let foundIndex = -1;
          if (userData._cards && Array.isArray(userData._cards)) {
            foundIndex = userData._cards.findIndex(c => c.question === oldQuestion);
            console.log('[SERVER /api/card/update] cardIndex:', foundIndex);
            if (foundIndex !== -1) {
              userData._cards[foundIndex].question = newQuestion;
              if (newAnswer !== undefined) {
                userData._cards[foundIndex].answer = newAnswer;
              }
              // Сохраняем formatting если есть
              if (formatting !== undefined) {
                userData._cards[foundIndex].formatting = formatting;
              }
              updated = true;
              logger.info('Карточка обновлена', {
                oldQuestion: oldQuestion.substring(0, 50) + '...',
                newQuestion: newQuestion.substring(0, 50) + '...',
                hasFormatting: !!formatting
              }, 'CardUpdate');
            } else {
              // Логируем все вопросы для отладки
              console.log('[SERVER /api/card/update] Карточка не найдена! Вопросы в файле (первые 10):');
              userData._cards.slice(0, 10).forEach((c, i) => {
                console.log(`  [${i}] ${c.question.substring(0, 50)}...`);
              });
            }
          }

          if (!updated) {
            logger.warn('Карточка не найдена для обновления', { oldQuestion: oldQuestion.substring(0, 50) }, 'CardUpdate');
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              ok: false,
              error: 'card_not_found',
              debug: {
                oldQuestion: oldQuestion,
                questionsInFile: userData._cards?.slice(0, 10).map(c => c.question) || [],
                foundIndex: foundIndex,
                fileReadTime: new Date().toISOString()
              }
            }));
            return;
          }

          // Синхронная запись для гарантии обновления до ответа
          try {
            const jsonString = JSON.stringify(userData, null, 2);

            // Используем флаг 'w' для явной перезаписи файла
            fs.writeFileSync(targetPath, jsonString, { encoding: 'utf8', flag: 'w' });
            console.log('[SERVER /api/card/update] Файл записан, время:', new Date().toISOString());

            // Явно закрываем файловый дескриптор для сброса кэша
            const fd = fs.openSync(targetPath, 'r');
            fs.closeSync(fd);

            // Небольшая задержка перед проверкой
            const startWait = Date.now();
            while (Date.now() - startWait < 50) { /* ждём 50ms */ }

            // Читаем файл после записи для проверки
            const verifyData = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
            const foundNewCard = verifyData._cards?.some(c => c.question === newQuestion);

            console.log('========================================');
            console.log('[SERVER /api/card/update] === ПРОВЕРКА ПОСЛЕ ЗАПИСИ ===');
            console.log('[SERVER /api/card/update] Файл записан:', targetPath);
            console.log('[SERVER /api/card/update] newQuestion:', newQuestion);
            console.log('[SERVER /api/card/update] Найдена ли новая карточка:', foundNewCard);
            console.log('[SERVER /api/card/update] Время проверки:', new Date().toISOString());
            console.log('[SERVER /api/card/update] Время между записью и проверкой:', Date.now() - startWait, 'ms');
            console.log('========================================');

            logger.info(`Карточка пользователя ${username} обновлена`, null, 'CardUpdate');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              ok: true,
              message: 'card_updated',
              debug: {
                fileWritten: targetPath,
                newQuestion: newQuestion,
                cardFoundInFile: foundNewCard,
                writeTime: new Date().toISOString()
              }
            }));
          } catch (err) {
            console.error('[SERVER /api/card/update] Ошибка записи:', err);
            logger.error('Ошибка записи файла', { error: err.message }, 'CardUpdate');
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'write_failed' }));
          }
        } catch (e) {
          logger.error('Ошибка парсинга JSON', { error: e.message }, 'CardUpdate');
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'invalid_json' }));
        }
      });
      return;
    }

    // Сохранение данных в JSON (персональное для пользователя)
    if (req.method === 'POST' && pathname === '/save') {
      const username = urlObj.searchParams.get('user');

      logger.info('=== ЗАПРОС НА СОХРАНЕНИЕ ===', { username }, 'Save');

      if (!username) {
        logger.error('Ошибка: username не указан', null, 'Save');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'username required' }));
        return;
      }

      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          console.log('[SERVER /save] Попытка парсинга JSON, длина:', body.length);
          const data = JSON.parse(body);

          console.log('[SERVER /save] Распарсены данные:', {
            count: Array.isArray(data) ? data.length : 'not array',
            hasNewItems: Array.isArray(data) && data.some(c => c.question && c.question.includes('копия'))
          });

          logger.info('Получено данных', { count: Array.isArray(data) ? data.length : 'not array', bodyLength: body.length }, 'Save');

          const targetPath = path.join(__dirname, 'data', `user_${username}.json`);

          // 🔍 Читаем существующий файл (если есть)
          let userData = {};
          if (fs.existsSync(targetPath)) {
            userData = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
            logger.info('Существующий файл', { cards: userData._cards?.length || 0 }, 'Save');
          } else {
            logger.info('Создаётся новый файл пользователя', null, 'Save');
          }

          userData._cards = data;
          if (!userData._meta) userData._meta = {};
          userData._meta.cardsCount = data.length;
          userData._meta.lastLoginAt = new Date().toISOString();
          userData._meta.lastSavedAt = new Date().toISOString();

          let jsonString = JSON.stringify(userData, null, 2);

          console.log('[SERVER /save] Записываем данные:', {
            cardsCount: userData._cards?.length || 0,
            filePath: targetPath
          });

          fs.writeFile(targetPath, jsonString, 'utf-8', (err) => {
            if (err) {
              logger.error('Ошибка записи', { error: err.message }, 'Save');
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: 'write_failed' }));
              return;
            }

            logger.info('=== УСПЕШНО СОХРАНЕНО ===', { count: data.length, username }, 'Save');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, saved: data.length }));
          });
        } catch (e) {
          logger.error('Ошибка парсинга JSON', { error: e.message }, 'Save');
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    // POST /api/achievements - Save achievements
    if (req.method === 'POST' && pathname === '/api/achievements') {
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const username = urlObj.searchParams.get('user');

      if (!username) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'username required' }));
        return;
      }

      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const achievements = JSON.parse(body);
          const targetPath = path.join(__dirname, 'data', `user_${username}.json`);

          let userData = {};
          if (fs.existsSync(targetPath)) {
            userData = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
          }

          // Обновляем достижения
          userData._achievements = achievements;

          fs.writeFile(targetPath, JSON.stringify(userData, null, 2), 'utf-8', (err) => {
            if (err) {
              console.error('Failed to save achievements:', err);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: 'write_failed' }));
              return;
            }
            console.log(`[Achievements] User ${username} saved achievements`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          });
        } catch (e) {
          console.error('Invalid JSON body:', e);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'invalid_json' }));
        }
      });
      return;
    }

    // POST /api/favorites - Save favorites
    if (req.method === 'POST' && pathname === '/api/favorites') {
      const username = urlObj.searchParams.get('username') || urlObj.searchParams.get('user');

      logger.info('Сохранение избранного', { username }, 'Favorites');

      if (!username) {
        logger.error('Ошибка: username не указан', null, 'Favorites');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'username required' }));
        return;
      }

      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const favorites = JSON.parse(body);
          logger.info('Получено избранное', { count: Array.isArray(favorites) ? favorites.length : 0 }, 'Favorites');

          const targetPath = path.join(__dirname, 'data', `user_${username}.json`);

          let userData = {};
          if (fs.existsSync(targetPath)) {
            userData = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
          }

          // Обновляем избранное
          userData._favorites = favorites;
          if (!userData._meta) userData._meta = {};
          userData._meta.lastSavedAt = new Date().toISOString();

          fs.writeFile(targetPath, JSON.stringify(userData, null, 2), 'utf-8', (err) => {
            if (err) {
              logger.error('Ошибка записи избранного', { error: err.message }, 'Favorites');
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: 'write_failed' }));
              return;
            }
            logger.info('Избранное сохранено', { count: favorites.length, username }, 'Favorites');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          });
        } catch (e) {
          logger.error('Ошибка парсинга JSON', { error: e.message }, 'Favorites');
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'invalid_json' }));
        }
      });
      return;
    }

    // Обработка метаданных (GET) - персональные для пользователя
    if (req.method === 'GET' && pathname === '/metadata') {
      const username = urlObj.searchParams.get('user');

      // Если нет username, возвращаем пустые метаданные
      if (!username) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({}));
        return;
      }

      const metaPath = path.join(__dirname, 'data', `user_${username}_metadata.json`);
      const trashPath = path.join(__dirname, 'data', `user_${username}_trash.json`);

      let meta = {};
      try {
        if (fs.existsSync(metaPath)) {
          meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        }
      } catch (e) { console.error('Error reading metadata:', e); }

      // Добавляем корзину в ответ
      try {
        if (fs.existsSync(trashPath)) {
          meta.trash_bin = JSON.parse(fs.readFileSync(trashPath, 'utf-8'));
        } else {
          meta.trash_bin = [];
        }
      } catch (e) { console.error('Error reading trash:', e); meta.trash_bin = []; }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(meta));
      return;
    }

    // Обработка метаданных (POST) - персональные для пользователя
    if (req.method === 'POST' && pathname === '/metadata') {
      const username = urlObj.searchParams.get('user');

      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          const metaPath = path.join(__dirname, 'data', `user_${username}_metadata.json`);

          // Читаем текущие метаданные
          let currentMeta = {};
          try {
            if (fs.existsSync(metaPath)) currentMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          } catch (_) { }

          // Обновляем поля
          const newMeta = { ...currentMeta, ...payload };

          fs.writeFile(metaPath, JSON.stringify(newMeta, null, 2), 'utf-8', (err) => {
            if (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: 'write_failed' }));
              return;
            }
            console.log(`[Metadata] User ${username} saved metadata`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          });
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'invalid_json' }));
        }
      });
      return;
    }


    // Сохранение пользовательского прогресса (объединено с основным файлом)
    if (req.method === 'POST' && req.url.startsWith('/api/progress')) {
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const username = urlObj.searchParams.get('username');
      const token = urlObj.searchParams.get('token');

      // Verify token (опционально - для обратной совместимости)
      if (token) {
        const userInfo = verifyToken(token);
        if (!userInfo || userInfo.username !== username) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
          return;
        }
      }

      // Если нет username, возвращаем ошибку
      if (!username) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'username required' }));
        return;
      }

      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const userFilePath = path.join(__dirname, 'data', `user_${username}.json`);

          // Читаем текущие данные
          let userData = {};
          if (fs.existsSync(userFilePath)) {
            userData = JSON.parse(fs.readFileSync(userFilePath, 'utf-8'));
          }

          // Обновляем поля прогресса
          if (data._achievements) userData._achievements = data._achievements;
          if (data._stats) userData._stats = data._stats;
          if (data._srsProgress) userData._srsProgress = data._srsProgress;
          if (data._favorites) userData._favorites = data._favorites;

          // Записываем обратно
          fs.writeFile(userFilePath, JSON.stringify(userData, null, 2), 'utf-8', (err) => {
            if (err) {
              console.error('Failed to write progress:', err);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: 'write_failed' }));
              return;
            }
            console.log(`[Progress] User ${username} saved progress`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          });
        } catch (e) {
          console.error('Invalid JSON body:', e);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'invalid_json' }));
        }
      });
      return;
    }

    // Загрузка пользовательского прогресса (теперь часть /load)
    // Оставляем для обратной совместимости, но возвращаем данные из основного файла
    if (req.method === 'GET' && req.url.startsWith('/api/progress')) {
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const username = urlObj.searchParams.get('username');
      const token = urlObj.searchParams.get('token');

      // Verify token (опционально, для обратной совместимости можно без токена)
      // const userInfo = verifyToken(token);
      // if (!userInfo || userInfo.username !== username) {
      //   res.writeHead(401, { 'Content-Type': 'application/json' });
      //   res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
      //   return;
      // }

      const userFilePath = path.join(__dirname, 'data', `user_${username}.json`);

      if (fs.existsSync(userFilePath)) {
        fs.readFile(userFilePath, 'utf-8', (err, content) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false }));
            return;
          }
          const userData = JSON.parse(content);
          // Возвращаем только прогресс (без карт)
          const progressData = {
            _achievements: userData._achievements || {},
            _stats: userData._stats || {},
            _srsProgress: userData._srsProgress || {},
            _favorites: userData._favorites || []
          };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(progressData));
        });
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({}));
      }
      return;
    }

    // Helper for Trash (персональная для пользователя)
    const getUserTrash = (username) => {
      const p = path.join(__dirname, 'data', `user_${username}_trash.json`);
      if (!fs.existsSync(p)) return [];
      try { return JSON.parse(fs.readFileSync(p, 'utf-8')) || []; } catch { return []; }
    };

    const saveUserTrash = (username, items) => {
      const p = path.join(__dirname, 'data', `user_${username}_trash.json`);
      const dir = path.dirname(p);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(p, JSON.stringify(items, null, 2), 'utf-8');
    };

    // Trash: Move to trash (персональная)
    if (req.method === 'POST' && pathname === '/trash') {
      const username = urlObj.searchParams.get('user');

      logger.info('Запрос в корзину', { username, url: req.url }, 'Trash');

      // 🔒 ПРОВЕРКА USERNAME
      if (!username) {
        logger.error('Нет username', null, 'Trash');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'username required' }));
        return;
      }

      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          logger.info('Тело запроса', { bodyLength: body.length }, 'Trash');
          const data = JSON.parse(body);
          const items = data.items || [];
          logger.info('Получено элементов', { count: items.length }, 'Trash');

          const trashPath = path.join(__dirname, 'data', `user_${username}_trash.json`);
          let trash = [];
          if (fs.existsSync(trashPath)) {
            trash = JSON.parse(fs.readFileSync(trashPath, 'utf-8')) || [];
          }

          items.forEach(item => {
            trash.push({
              item,
              deleted_at: new Date().toISOString(),
              deleted_by: username
            });
          });

          fs.writeFileSync(trashPath, JSON.stringify(trash, null, 2), 'utf-8');
          logger.info('Сохранено в корзину', { username, count: trash.length }, 'Trash');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, trash_size: trash.length }));
        } catch (e) {
          logger.error('Ошибка', { error: e.message }, 'Trash');
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    // Trash: Restore (персональная)
    if (req.method === 'POST' && pathname === '/restore') {
      const username = urlObj.searchParams.get('user');

      // 🔒 ПРОВЕРКА USERNAME
      if (!username) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'username required' }));
        return;
      }

      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const questions = new Set(data.questions || []);
          const trashPath = path.join(__dirname, 'data', `user_${username}_trash.json`);
          let trash = fs.existsSync(trashPath) ? JSON.parse(fs.readFileSync(trashPath, 'utf-8')) : [];
          const before = trash.length;
          trash = trash.filter(t => !questions.has(t.item?.question));
          fs.writeFileSync(trashPath, JSON.stringify(trash, null, 2), 'utf-8');
          logger.info('Восстановление', { username, count: before - trash.length }, 'Trash');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, restored_count: before - trash.length }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    // Trash: Delete Permanent (персональная)
    if (req.method === 'POST' && pathname === '/delete-permanent') {
      const username = urlObj.searchParams.get('user');

      // 🔒 ПРОВЕРКА USERNAME
      if (!username) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'username required' }));
        return;
      }

      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const questions = new Set(data.questions || []);
          const trashPath = path.join(__dirname, 'data', `user_${username}_trash.json`);
          let trash = fs.existsSync(trashPath) ? JSON.parse(fs.readFileSync(trashPath, 'utf-8')) : [];
          const before = trash.length;
          trash = trash.filter(t => !questions.has(t.item?.question));
          fs.writeFileSync(trashPath, JSON.stringify(trash, null, 2), 'utf-8');
          logger.info('Удаление из корзины', { username, count: before - trash.length }, 'Trash');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, deleted_count: before - trash.length }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    // Duplicate: Track duplication (персональная)
    if (req.method === 'POST' && pathname === '/duplicate') {
      const username = urlObj.searchParams.get('user') || 'anonymous';

      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const items = data.items || [];
          logger.info('Дублирование', { username, count: items.length }, 'Duplicate');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, duplicated_count: items.length }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    // ============================================
    // POST /api/iphone-logs - Приём логов с iPhone
    // ============================================
    if (req.method === 'POST' && pathname === '/api/iphone-logs') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const logsDir = path.join(__dirname, 'logs');
          if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

          const logFile = path.join(logsDir, 'iphone-logs.txt');
          const timestamp = new Date().toISOString();
          const logEntry = `\n\n========== ${timestamp} ==========\n${body}\n`;

          fs.appendFileSync(logFile, logEntry, 'utf8');
          console.log('[iPhone Logs] Saved to logs/iphone-logs.txt');

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          console.error('[iPhone Logs] Error:', e);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    // Формализуем URL
    // 🔒 СНАЧАЛА ПРОВЕРЯЕМ НА PATH TRAVERSAL (до декодирования!)
    if (pathname.includes('..') || pathname.includes('\\')) {
      logger.warn('Попытка Path Traversal', { url: req.url }, 'Security');
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Forbidden: Invalid path' }));
      return;
    }

    // Декодируем URL для поддержки кириллических имен файлов
    let requestUrl;
    try {
      requestUrl = decodeURIComponent(pathname);
    } catch (e) {
      console.error('URI Decode Error:', e.message);
      requestUrl = pathname;
    }

    // Разрешаем только безопасные пути
    const allowedPaths = ['/', '/index.html', '/logs.html', '/style.css', '/custom-styles.css', '/manifest.json'];
    const isStaticFile = allowedPaths.includes(requestUrl) ||
      requestUrl.startsWith('/icons/') ||
      requestUrl.startsWith('/data/') ||
      requestUrl.startsWith('/srs/') ||
      requestUrl.startsWith('/ui-variants/');

    if (!isStaticFile && !isApiRequest) {
      logger.warn('Доступ к неизвестному пути', { url: req.url }, 'Security');
    }

    let filePath = '.' + requestUrl;
    if (filePath === './' || filePath === './index.html') {
      filePath = './index.html';
    }

    // Получаем расширение файла
    const extname = path.extname(filePath);
    let contentType = MIME_TYPES[extname] || 'application/octet-stream';

    // Читаем файл
    fs.readFile(filePath, (err, content) => {
      if (err) {
        if (err.code === 'ENOENT') {
          // 🛡️ Если это API запрос, который не был обработан выше, НЕ отдаем index.html
          if (isApiRequest) {
            logger.error('API эндпоинт не найден', { url: req.url }, 'HTTP');
            res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: 'API endpoint not found' }));
            return;
          }

          // Файл не найден, отдаем index.html для поддержки SPA роутинга
          fs.readFile('./index.html', (err, content) => {
            if (err) {
              res.writeHead(500);
              res.end('Ошибка сервера: ' + err.code);
              return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(content);
          });
        } else {
          // Другая ошибка сервера
          res.writeHead(500);
          res.end('Ошибка сервера: ' + err.code);
        }
        return;
      }

      // Успешный ответ
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  } catch (globalError) {
    console.error('[CRITICAL SERVER ERROR]', globalError);
    if (!res.writableEnded) {
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  }
});

server.listen(PORT, IP, () => {
  console.log(`Server running at http://${IP}:${PORT}/`);
  console.log(`Open http://localhost:${PORT}/ in your browser`);

  // Автоматическая установка команд меню в Telegram (v6.09.4)
  const menuCommands = JSON.stringify({
    commands: [
      { command: 'users', description: 'Список всех пользователей' },
      { command: 'setrole', description: 'Изменить роль (username role)' },
      { command: 'start', description: 'Перезапустить / Справка' }
    ]
  });

  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${TELEGRAM_BOT_TOKEN}/setMyCommands`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(menuCommands)
    }
  };

  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => console.log('[TG Bot] Команды меню обновлены:', body));
  });
  req.on('error', (e) => console.error('[TG Bot] Ошибка обновления команд меню:', e));
  req.write(menuCommands);
  req.end();
});

// ============================================
// Global Error Handling with Sentry
// ============================================
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', error);
  if (SENTRY_DSN) {
    Sentry.captureException(error);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
  if (SENTRY_DSN) {
    Sentry.captureException(reason);
  }
});
