// Скрипт для хеширования существующих паролей в users.json
// Запуск: node hash-passwords.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PASSWORD_SALT = 'qa_helper_salt_2026_secure_key';

function hashPassword(password) {
  return crypto.createHash('sha256').update(PASSWORD_SALT + password).digest('hex');
}

const usersPath = path.join(__dirname, 'data', 'users.json');
const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));

console.log('Миграция паролей...');
console.log('Найдено пользователей:', users.length);

let updated = 0;
users.forEach(user => {
  // Если пароль ещё не хеш (длина < 64 символов для SHA-256)
  if (user.password && user.password.length < 64) {
    const oldPassword = user.password;
    user.password = hashPassword(user.password);
    console.log(`✓ ${user.username}: ${oldPassword} → ${user.password.substring(0, 16)}...`);
    updated++;
  } else {
    console.log(`  ${user.username}: уже захеширован`);
  }
});

fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf-8');

console.log('\nГотово!');
console.log('Обновлено паролей:', updated);
console.log('Файл сохранён:', usersPath);
