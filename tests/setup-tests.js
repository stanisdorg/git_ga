// Скрипт настройки тестового окружения
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Хеширование паролей (как в server.js)
const PASSWORD_SALT = process.env.PASSWORD_SALT || 'qa_helper_salt_2026_secure_key';

function hashPassword(password) {
  return crypto.createHash('sha256').update(PASSWORD_SALT + password).digest('hex');
}

// Создаём тестового пользователя
const TEST_USER = {
  username: 'autotest_user',
  password: hashPassword('autotest123'),
  role: 'admin',  // admin права для доступа ко всем API
  createdAt: new Date().toISOString()
};

// Загружаем существующих пользователей
let users = [];
if (fs.existsSync(USERS_FILE)) {
  users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
}

// Проверяем, есть ли уже тестовый пользователь
const existingUserIndex = users.findIndex(u => u.username === TEST_USER.username);

if (existingUserIndex !== -1) {
  console.log('[SETUP] Тестовый пользователь уже существует, обновляем пароль');
  users[existingUserIndex].password = TEST_USER.password;
  users[existingUserIndex].role = 'admin';
} else {
  console.log('[SETUP] Создаём тестового пользователя:', TEST_USER.username);
  users.push(TEST_USER);
}

// Сохраняем
fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
console.log('[SETUP] Тестовый пользователь готов');

// Создаём тестовую карточку если нет
const USER_DATA_FILE = path.join(DATA_DIR, `user_${TEST_USER.username}.json`);
let userData = { _cards: [], _srsProgress: {}, _stats: {} };

if (fs.existsSync(USER_DATA_FILE)) {
  userData = JSON.parse(fs.readFileSync(USER_DATA_FILE, 'utf-8'));
}

// Добавляем тестовую карточку если нет
const TEST_CARD_QUESTION = 'Медленный деплой';
if (!userData._cards.find(c => c.question === TEST_CARD_QUESTION)) {
  userData._cards.push({
    category: 'DevOps',
    subcategory: 'CI/CD',
    question: TEST_CARD_QUESTION,
    answer: 'пересборка всего приложения при любом изменении'
  });
  console.log('[SETUP] Добавлена тестовая карточка:', TEST_CARD_QUESTION);
  
  fs.writeFileSync(USER_DATA_FILE, JSON.stringify(userData, null, 2), 'utf-8');
}

console.log('[SETUP] Тестовое окружение готово');
