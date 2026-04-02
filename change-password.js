/**
 * Скрипт для смены пароля пользователя
 * 
 * Использование:
 *   node change-password.js <username> <новый_пароль>
 * 
 * Пример:
 *   node change-password.js admin ghettocoal
 * 
 * Важно:
 * - Пароли хранятся в data/users.json в захешированном виде
 * - Используется SHA-256 + соль: hash = SHA256(salt + password)
 * - Соль: 'qa_helper_salt_2026_secure_key'
 * - После смены пароля нужно перезапустить сервер
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PASSWORD_SALT = 'qa_helper_salt_2026_secure_key';

/**
 * Хеширование пароля с солью
 * @param {string} password - Пароль в открытом виде
 * @returns {string} - SHA-256 хеш в hex формате (64 символа)
 */
function hashPassword(password) {
  return crypto.createHash('sha256').update(PASSWORD_SALT + password).digest('hex');
}

// Парсинг аргументов командной строки
const args = process.argv.slice(2);

if (args.length !== 2) {
  console.error('❌ Ошибка: Неверное количество аргументов');
  console.error('');
  console.error('Использование:');
  console.error('  node change-password.js <username> <новый_пароль>');
  console.error('');
  console.error('Пример:');
  console.error('  node change-password.js admin ghettocoal');
  console.error('');
  process.exit(1);
}

const [username, newPassword] = args;

// Проверка сложности пароля
if (newPassword.length < 6) {
  console.error('❌ Ошибка: Пароль должен быть не менее 6 символов');
  process.exit(1);
}

if (newPassword.length > 100) {
  console.error('❌ Ошибка: Пароль не должен превышать 100 символов');
  process.exit(1);
}

// Чтение базы пользователей
const usersPath = path.join(__dirname, 'data', 'users.json');

if (!fs.existsSync(usersPath)) {
  console.error('❌ Ошибка: Файл users.json не найден');
  process.exit(1);
}

let users;
try {
  users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
} catch (e) {
  console.error('❌ Ошибка чтения users.json:', e.message);
  process.exit(1);
}

// Поиск пользователя
const userIndex = users.findIndex(u => u.username === username);

if (userIndex === -1) {
  console.error(`❌ Ошибка: Пользователь "${username}" не найден`);
  console.error('');
  console.error('Доступные пользователи:');
  users.forEach(u => {
    console.error(`  - ${u.username} (${u.role})`);
  });
  process.exit(1);
}

// Сохранение старого хеша для сравнения
const oldHash = users[userIndex].password;
const newHash = hashPassword(newPassword);

// Проверка: не совпадает ли новый пароль со старым
if (oldHash === newHash) {
  console.error('⚠️  Предупреждение: Новый пароль совпадает со старым');
  console.error('   Изменения не внесены');
  process.exit(0);
}

// Обновление пароля
users[userIndex].password = newHash;
users[userIndex].passwordChangedAt = new Date().toISOString();
users[userIndex].passwordChangedBy = 'script';

// Сохранение изменений
try {
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf-8');
} catch (e) {
  console.error('❌ Ошибка записи users.json:', e.message);
  process.exit(1);
}

// Вывод результата
console.log('');
console.log('✅ Пароль успешно изменён!');
console.log('');
console.log('📋 Детали:');
console.log(`   Пользователь: ${username}`);
console.log(`   Новый пароль: ${newPassword}`);
console.log(`   Хеш пароля: ${newHash.substring(0, 16)}...`);
console.log(`   Время изменения: ${users[userIndex].passwordChangedAt}`);
console.log('');
console.log('📁 Файл обновлён: data/users.json');
console.log('');
console.log('⚠️  Важно:');
console.log('   - Перезапустите сервер для применения изменений');
console.log('   - Если пользователь сейчас в системе, потребуется повторный вход');
console.log('');
console.log('🔒 Рекомендации по безопасности:');
console.log('   - Используйте сложные пароли (8+ символов, буквы, цифры, спецсимволы)');
console.log('   - Регулярно меняйте пароли');
console.log('   - Не используйте одинаковые пароли для разных сервисов');
console.log('');
