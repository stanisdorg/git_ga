import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8085;
const IP = '0.0.0.0'; // Слушаем на всех интерфейсах

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
const server = http.createServer((req, res) => {
  const ts = new Date().toISOString();
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  
  // Детальное логирование всех запросов
  logger.info('HTTP запрос', {
    method: req.method,
    url: req.url,
    path: urlObj.pathname,
    query: Object.fromEntries(urlObj.searchParams),
    headers: {
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length']
    }
  }, 'HTTP');
  
  console.log(`${ts} - ${req.method} ${req.url}`);

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

  // 🔒 ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ПРОВЕРКИ ПРАВ
  // isEditor: true для проверки прав editor/admin, false для проверки только admin
  function checkUserPermissions(req, res, requireAdmin = false) {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
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
  if (req.method === 'GET' && req.url.startsWith('/api/logs')) {
    const adminCheck = checkAdmin(req, res); // requireAdmin = true
    if (!adminCheck.authorized) {
      logger.warn('Доступ к логам без авторизации', { 
        username: new URL(req.url, `http://${req.headers.host}`).searchParams.get('username'),
        reason: adminCheck.reason 
      }, 'Security');
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: adminCheck.reason }));
      return;
    }
    
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const limit = parseInt(urlObj.searchParams.get('limit') || '100');
    const level = urlObj.searchParams.get('level') || 'DEBUG';
    const context = urlObj.searchParams.get('context');
    const search = urlObj.searchParams.get('search');
    const logs = logger.getLogs({ limit, level, context, search });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, logs }));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/logs/clear') {
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

  if (req.method === 'GET' && req.url === '/api/logs/stats') {
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

  // POST /api/login - Login and get username (token disabled)
  if (req.method === 'POST' && req.url === '/api/login') {
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
  if (req.method === 'POST' && req.url === '/api/logout') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const {token} = JSON.parse(body);
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
  if (req.method === 'POST' && req.url === '/api/register') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const {username, password, role, adminToken} = JSON.parse(body);
        
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
  if (req.method === 'GET' && (req.url === '/load' || req.url.startsWith('/load?'))) {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
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
  if (req.method === 'GET' && req.url.startsWith('/api/progress')) {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const username = urlObj.searchParams.get('username');

    logger.info('=== ЗАПРОС НА ЗАГРУЗКУ ПРОГРЕССА ===', { username }, 'Load');

    if (!username) {
      logger.error('Ошибка: username не указан', null, 'Load');
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'username required' }));
      return;
    }

    const targetPath = path.join(__dirname, 'data', `user_${username}.json`);

    if (!fs.existsSync(targetPath)) {
      logger.warn('Файл пользователя не найден', { username }, 'Load');
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'User data not found' }));
      return;
    }

    try {
      const rawContent = fs.readFileSync(targetPath, 'utf-8');
      
      // 🔍 ПРОВЕРКА ПОСЛЕ ЧТЕНИЯ
      const hasFFFD = rawContent.includes('\uFFFD');
      const hasBadRussian = /Д\?{1,5}кументация/.test(rawContent);
      const hasQuestionInRussian = /[а-яА-Я]\?[а-яА-Я]/.test(rawContent);
      
      if (hasFFFD || hasBadRussian || hasQuestionInRussian) {
        logger.error('❌ ФАЙЛ ПОВРЕЖДЕН ПРИ ЧТЕНИИ!', {
          hasFFFD,
          hasBadRussian,
          hasQuestionInRussian,
          filePath: targetPath
        }, 'Load');
        
        // Сохраняем для отладки
        const debugReadPath = path.join(__dirname, 'data', 'debug_read_file.json');
        fs.writeFileSync(debugReadPath, rawContent, 'utf-8');
      }
      
      const userData = JSON.parse(rawContent);
      logger.info('Прочитано данных', {
        cards: userData._cards?.length || 0,
        favorites: Array.isArray(userData._favorites) ? userData._favorites.length : 0,
        achievements: Object.keys(userData._achievements || {}).length
      }, 'Load');

      console.log('[SERVER /api/progress] Прочитано из файла:', {
        cardsCount: userData._cards?.length || 0,
        filePath: targetPath
      });
      
      // Проверяем карточки на повреждение
      if (userData._cards && Array.isArray(userData._cards)) {
        const badCards = userData._cards.filter(card => {
          const cat = card.category || '';
          const subcat = card.subcategory || '';
          const q = card.question || '';
          const a = card.answer || '';
          const all = cat + subcat + q + a;
          return /\uFFFD/.test(all) || /Д\?{1,5}кументация/.test(all) || /[а-яА-Я]\?[а-яА-Я]/.test(all);
        });
        
        if (badCards.length > 0) {
          logger.error(`❌ НАЙДЕНО ${badCards.length} карточек с поврежденными символами!`, null, 'Load');
          
          // Показываем первые 3
          badCards.slice(0, 3).forEach((card, idx) => {
            logger.error(`Карточка ${idx + 1}: ${JSON.stringify({
              category: card.category,
              subcategory: card.subcategory,
              question: card.question?.substring(0, 50)
            })}`, null, 'Load');
          });
          
          // Сохраняем список поврежденных карточек
          const debugCardsPath = path.join(__dirname, 'data', 'debug_bad_cards.json');
          fs.writeFileSync(debugCardsPath, JSON.stringify(badCards, null, 2), 'utf-8');
        }

        console.log('[SERVER /api/progress] Найдено повреждённых карточек:', badCards.length);
      }

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
  if (req.method === 'POST' && req.url.startsWith('/api/progress')) {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
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

  // Сохранение данных в JSON (персональное для пользователя)
  if (req.method === 'POST' && req.url.startsWith('/save')) {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
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
        // 🔍 АВТОМАТИЧЕСКОЕ ИСПРАВЛЕНИЕ ПОВРЕЖДЕННЫХ СИМВОЛОВ
        let originalBody = body;
        body = body.replace(/\uFFFD/g, '?'); // Заменяем U+FFFD
        body = body.replace(/Д\?{1,10}кументация/g, 'Документация');
        body = body.replace(/инфу о\? сервера/g, 'инфу от сервера');
        body = body.replace(/получа\?м/g, 'получаем');
        body = body.replace(/се\?{1,5}висы/g, 'сервисы');

        if (body !== originalBody) {
          logger.warn('⚠️ ДАННЫЕ БЫЛИ АВТОМАТИЧЕСКИ ИСПРАВЛЕНЫ ПЕРЕД ПАРСИНГОМ', null, 'Save');
        }

        const data = JSON.parse(body);

        console.log('[SERVER /save] Распарсены данные:', {
            count: Array.isArray(data) ? data.length : 'not array',
            hasNewItems: Array.isArray(data) && data.some(c => c.question && c.question.includes('копия'))
        });
        if (Array.isArray(data)) {
            const copyItems = data.filter(c => c.question && c.question.includes('копия'));
            if (copyItems.length > 0) {
                console.log('[SERVER /save] Найдено дубликатов:', copyItems.length);
                console.log('[SERVER /save] Первый дубликат:', copyItems[0]);
            }
        }

        logger.info('Получено данных', { count: Array.isArray(data) ? data.length : 'not array', bodyLength: body.length }, 'Save');

        // 🔍 ПРОВЕРКА НА ПОВРЕЖДЕННЫЕ СИМВОЛЫ
        const hasFFFD = body.includes('\uFFFD');
        const badRussianPattern = /Д\?{1,5}кументация/.test(body);
        const questionMarksInRussian = /[а-яА-Я]\?[а-яА-Я]/.test(body);

        if (hasFFFD || badRussianPattern || questionMarksInRussian) {
          logger.error('⚠️ ВХОДЯЩИЕ ДАННЫЕ СОДЕРЖАТ ПОВРЕЖДЕННЫЕ СИМВОЛЫ!', {
            hasFFFD,
            badRussianPattern,
            questionMarksInRussian,
            bodyLength: body.length
          }, 'Save');

          // Сохраняем сырое тело для отладки
          const debugPath = path.join(__dirname, 'data', 'debug_bad_request.json');
          fs.writeFileSync(debugPath, body, 'utf-8');
          logger.error(`Сырое тело сохранено в ${debugPath}`, null, 'Save');
        }

        const targetPath = path.join(__dirname, 'data', `user_${username}.json`);

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

        // 🔍 ПРИНУДИТЕЛЬНОЕ ИСПРАВЛЕНИЕ КАЖДОЙ КАРТОЧКИ ПЕРЕД ЗАПИСЬЮ
        const fixCard = (card) => {
            if (!card) return card;
            const fixed = {};
            for (const key in card) {
                if (typeof card[key] === 'string') {
                    fixed[key] = card[key]
                        .replace(/\uFFFD/g, '?')
                        .replace(/Д\?{1,10}кументация/g, 'Документация')
                        .replace(/инфу о\? сервера/g, 'инфу от сервера')
                        .replace(/получа\?м/g, 'получаем')
                        .replace(/се\?{1,5}висы/g, 'сервисы');
                } else {
                    fixed[key] = card[key];
                }
            }
            return fixed;
        };
        
        if (Array.isArray(userData._cards)) {
            userData._cards = userData._cards.map(fixCard);
            logger.info(`Исправлено ${userData._cards.length} карточек перед записью`, null, 'Save');
        }

        // 🔍 ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ ПЕРЕД ЗАПИСЬЮ
        let jsonString = JSON.stringify(userData, null, 2);
        const originalJson = jsonString;
        
        jsonString = jsonString.replace(/\uFFFD/g, '?');
        jsonString = jsonString.replace(/Д\?{1,10}кументация/g, 'Документация');
        jsonString = jsonString.replace(/инфу о\? сервера/g, 'инфу от сервера');
        jsonString = jsonString.replace(/получа\?м/g, 'получаем');
        jsonString = jsonString.replace(/се\?{1,5}висы/g, 'сервисы');
        
        if (jsonString !== originalJson) {
          logger.warn('⚠️ ДАННЫЕ БЫЛИ АВТОМАТИЧЕСКИ ИСПРАВЛЕНЫ ПЕРЕД ЗАПИСЬЮ', null, 'Save');
        }

        // 🔍 ПРОВЕРКА ПЕРЕД ЗАПИСЬЮ
        const hasFFFDInOutput = jsonString.includes('\uFFFD');
        const hasBadRussianInOutput = /Д\?{1,5}кументация/.test(jsonString);
        const hasQuestionInRussian = /[а-яА-Я]\?[а-яА-Я]/.test(jsonString);
        
        if (hasFFFDInOutput || hasBadRussianInOutput || hasQuestionInRussian) {
          logger.error('⚠️ ПОСЛЕ СБОРКИ ДАННЫХ ОБНАРУЖЕНЫ ПОВРЕЖДЕННЫЕ СИМВОЛЫ!', {
            hasFFFDInOutput,
            hasBadRussianInOutput,
            hasQuestionInRussian,
            outputLength: jsonString.length
          }, 'Save');

          // Сохраняем что именно пойдет в файл
          const debugOutputPath = path.join(__dirname, 'data', 'debug_before_write.json');
          fs.writeFileSync(debugOutputPath, jsonString, 'utf-8');
          logger.error(`Данные перед записью сохранены в ${debugOutputPath}`, null, 'Save');
        }

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
          
          // 🔍 ПРОВЕРКА ПОСЛЕ ЗАПИСИ
          try {
            const writtenContent = fs.readFileSync(targetPath, 'utf-8');
            const hasFFFDWritten = writtenContent.includes('\uFFFD');
            const hasBadRussianWritten = /Д\?{1,5}кументация/.test(writtenContent);
            const hasQuestionInRussianWritten = /[а-яА-Я]\?[а-яА-Я]/.test(writtenContent);
            
            if (hasFFFDWritten || hasBadRussianWritten || hasQuestionInRussianWritten) {
              logger.error('❌ ПОСЛЕ ЗАПИСИ В ФАЙЛЕ ОБНАРУЖЕНЫ ПОВРЕЖДЕННЫЕ СИМВОЛЫ!', {
                hasFFFDWritten,
                hasBadRussianWritten,
                hasQuestionInRussianWritten,
                filePath: targetPath
              }, 'Save');
              
              // Сохраняем копию поврежденного файла
              const debugWrittenPath = path.join(__dirname, 'data', 'debug_after_write.json');
              fs.writeFileSync(debugWrittenPath, writtenContent, 'utf-8');
              logger.error(`Поврежденный файл сохранен в ${debugWrittenPath}`, null, 'Save');
            } else {
              logger.info('✅ Файл записан без повреждений', { filePath: targetPath }, 'Save');
            }
          } catch (checkErr) {
            logger.error('Ошибка проверки файла', { error: checkErr.message }, 'Save');
          }

          console.log('[SERVER /save] Успешно записано:', {
              cardsCount: data.length,
              filePath: targetPath
          });

          logger.info('=== УСПЕШНО СОХРАНЕНО ===', { count: data.length, username }, 'Save');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          // 🔍 ДОБАВЛЯЕМ ЛОГИ В ОТВЕТ КЛИЕНТУ
          const logResponse = {
              ok: true,
              serverCardsCount: data.length,
              timestamp: Date.now()
          };
          console.log('[SERVER /save] Отправляем ответ клиенту:', logResponse);
          res.end(JSON.stringify({ ok: true, saved: data.length }));
        });
      } catch (e) {
        logger.error('Ошибка парсинга JSON', { error: e.message }, 'Save');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'invalid_json' }));
      }
    });
    return;
  }

  // POST /api/achievements - Save achievements
  if (req.method === 'POST' && req.url.startsWith('/api/achievements')) {
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
  if (req.method === 'POST' && req.url.startsWith('/api/favorites')) {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
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
  if (req.method === 'GET' && req.url.startsWith('/metadata')) {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const username = urlObj.searchParams.get('user');
    const token = urlObj.searchParams.get('token');

    // Verify token (опционально - если нет токена, возвращаем пустые метаданные)
    let userInfo = null;
    if (token) {
      userInfo = verifyToken(token);
      if (!userInfo || userInfo.username !== username) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
        return;
      }
    }

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
  if (req.method === 'POST' && req.url.startsWith('/metadata')) {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const username = urlObj.searchParams.get('user');
    const token = urlObj.searchParams.get('token');

    // Verify token
    const userInfo = verifyToken(token);
    if (!userInfo || userInfo.username !== username) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
      return;
    }

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
        } catch (_) {}

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
  if (req.method === 'POST' && req.url.startsWith('/trash')) {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const username = urlObj.searchParams.get('user');
    // token removed - using username only for development

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
        
        const trash = getUserTrash(username);
        logger.info('Текущая корзина', { count: trash.length }, 'Trash');
        
        items.forEach(item => {
            trash.push({
                item,
                deleted_at: new Date().toISOString(),
                deleted_by: username
            });
        });
        
        saveUserTrash(username, trash);
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
  if (req.method === 'POST' && req.url.startsWith('/restore')) {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const username = urlObj.searchParams.get('user');
    // token removed - using username only for development

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
        let trash = getUserTrash(username);
        const before = trash.length;
        trash = trash.filter(t => !questions.has(t.item?.question));
        saveUserTrash(username, trash);
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
  if (req.method === 'POST' && req.url.startsWith('/delete-permanent')) {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const username = urlObj.searchParams.get('user');
    // token removed - using username only for development

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
        let trash = getUserTrash(username);
        const before = trash.length;
        trash = trash.filter(t => !questions.has(t.item?.question));
        saveUserTrash(username, trash);
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
  if (req.method === 'POST' && req.url.startsWith('/duplicate')) {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const username = urlObj.searchParams.get('user') || 'anonymous';
    // token removed - using username only for development

    let body = '';
    req.on('data', chunk => body += chunk);
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

  // Нормализуем URL
  // 🔒 СНАЧАЛА ПРОВЕРЯЕМ НА PATH TRAVERSAL (до декодирования!)
  if (req.url.includes('..') || req.url.includes('\\') || req.url.includes('%2e%2e') || req.url.includes('%252e')) {
    logger.warn('Попытка Path Traversal', { url: req.url }, 'Security');
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Forbidden: Invalid path' }));
    return;
  }
  
  // Декодируем URL для поддержки кириллических имен файлов
  let requestUrl;
  try {
    requestUrl = decodeURIComponent(req.url);
  } catch (e) {
    console.error('URI Decode Error:', e.message);
    requestUrl = req.url;
  }

  // ============================================
  // Обработка статических файлов (с защитой!)
  // ============================================

  // Удаляем параметры запроса (например ?t=...)
  const queryIndex = requestUrl.indexOf('?');
  if (queryIndex !== -1) {
    requestUrl = requestUrl.substring(0, queryIndex);
  }

  // 🔒 ПОВТОРНАЯ ПРОВЕРКА ПОСЛЕ ДЕКОДИРОВАНИЯ
  if (requestUrl.includes('..') || requestUrl.includes('\\')) {
    logger.warn('Попытка Path Traversal (после декодирования)', { url: req.url, decoded: requestUrl }, 'Security');
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Forbidden: Invalid path' }));
    return;
  }

  // Разрешаем только безопасные пути
  const allowedPaths = ['/', '/index.html', '/logs.html', '/style.css', '/custom-styles.css', '/manifest.json'];
  const isStaticFile = allowedPaths.some(p => requestUrl === p) || 
                       requestUrl.startsWith('/icons/') ||
                       requestUrl.startsWith('/data/') ||
                       requestUrl.startsWith('/srs/') ||
                       requestUrl.startsWith('/ui-variants/');
  
  if (!isStaticFile && !requestUrl.startsWith('/api/') && !requestUrl.startsWith('/save') && !requestUrl.startsWith('/load') && !requestUrl.startsWith('/metadata') && !requestUrl.startsWith('/trash') && !requestUrl.startsWith('/restore') && !requestUrl.startsWith('/duplicate')) {
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
        // Файл не найден
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
});

server.listen(PORT, IP, () => {
  console.log(`Server running at http://${IP}:${PORT}/`);
  console.log(`Open http://localhost:${PORT}/ in your browser`);
});
