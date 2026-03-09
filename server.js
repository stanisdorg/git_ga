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
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
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

  // API: Логи
  if (req.method === 'GET' && req.url.startsWith('/api/logs')) {
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
    const result = logger.clearLogs();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  if (req.method === 'GET' && req.url === '/api/logs/stats') {
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

  // POST /api/login - Login and get username (token disabled)
  if (req.method === 'POST' && req.url === '/api/login') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        logger.info('Тело запроса', { 
          body: body.substring(0, 5000),
          bodyLength: body.length
        }, 'HTTP');
        console.log('[Login] Request body:', body);
        if (!body) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Empty body' }));
          return;
        }
        const parsed = JSON.parse(body);
        console.log('[Login] Parsed:', parsed);
        const username = parsed.username;
        const password = parsed.password;
        
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
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Invalid credentials' }));
          return;
        }

        // Update lastLoginAt in users.json
        const userIndex = users.findIndex(u => u.username === username);
        if (userIndex !== -1) {
          users[userIndex].lastLoginAt = new Date().toISOString();
          fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
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
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

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
        fs.writeFileSync(userFilePath, JSON.stringify(userFile, null, 2));

        // Create user metadata file
        const metadataFilePath = path.join(__dirname, 'data', `user_${username}_metadata.json`);
        fs.writeFileSync(metadataFilePath, JSON.stringify({}, null, 2));

        // Create user trash file
        const trashFilePath = path.join(__dirname, 'data', `user_${username}_trash.json`);
        fs.writeFileSync(trashFilePath, JSON.stringify([], null, 2));

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
      const userData = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
      logger.info('Прочитано данных', {
        cards: userData._cards?.length || 0,
        favorites: Array.isArray(userData._favorites) ? userData._favorites.length : 0,
        achievements: Object.keys(userData._achievements || {}).length
      }, 'Load');

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
        updatedAt: Date.now()
      };

      logger.info('=== ОТПРАВКА ДАННЫХ КЛИЕНТУ ===', null, 'Load');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
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
        const data = JSON.parse(body);
        logger.info('Получено данных', { count: Array.isArray(data) ? data.length : 'not array' }, 'Save');

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

        fs.writeFile(targetPath, JSON.stringify(userData, null, 2), 'utf-8', (err) => {
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

    let meta = {};
    try {
      if (fs.existsSync(metaPath)) {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      }
    } catch (e) { console.error('Error reading metadata:', e); }

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
    const token = urlObj.searchParams.get('token');

    // Verify token
    const userInfo = verifyToken(token);
    if (!userInfo || userInfo.username !== username) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
      return;
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const items = data.items || [];
        const trash = getUserTrash(username);
        items.forEach(item => {
            trash.push({
                item,
                deleted_at: new Date().toISOString(),
                deleted_by: username
            });
        });
        saveUserTrash(username, trash);
        console.log(`[Trash] User ${username} moved ${items.length} items to trash`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, trash_size: trash.length }));
      } catch (e) {
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
    const token = urlObj.searchParams.get('token');

    // Verify token
    const userInfo = verifyToken(token);
    if (!userInfo || userInfo.username !== username) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
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
        console.log(`[Restore] User ${username} restored ${before - trash.length} items`);
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
    const token = urlObj.searchParams.get('token');

    // Verify token
    const userInfo = verifyToken(token);
    if (!userInfo || userInfo.username !== username) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
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
        console.log(`[Trash] User ${username} permanently deleted ${before - trash.length} items`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, deleted_count: before - trash.length }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // Нормализуем URL
  // Декодируем URL для поддержки кириллических имен файлов
  let requestUrl;
  try {
    requestUrl = decodeURIComponent(req.url);
  } catch (e) {
    console.error('URI Decode Error:', e.message);
    requestUrl = req.url;
  }

  // Удаляем параметры запроса (например ?t=...)
  const queryIndex = requestUrl.indexOf('?');
  if (queryIndex !== -1) {
    requestUrl = requestUrl.substring(0, queryIndex);
  }

  let filePath = '.' + requestUrl;
  if (filePath === './') {
    filePath = './index.html';
  }

  console.log('Request:', req.url);
  console.log('Decoded:', requestUrl);
  console.log('FilePath:', filePath);


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
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(content, 'utf-8');
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
    res.end(content, 'utf-8');
  });
});

server.listen(PORT, IP, () => {
  console.log(`Server running at http://${IP}:${PORT}/`);
  console.log(`Open http://localhost:${PORT}/ in your browser`);
});
