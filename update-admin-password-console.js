/**
 * 🔐 Скрипт для обновления пароля admin в localStorage браузера
 * 
 * Использование:
 * 1. Откройте консоль разработчика (F12)
 * 2. Перейдите на вкладку Console
 * 3. Скопируйте и вставьте этот скрипт
 * 4. Нажмите Enter
 * 5. Перезагрузите страницу (F5)
 * 
 * Или выполните команду в Node.js для генерации команды:
 *   node update-admin-password.js
 */

console.log('🔑 Обновление пароля admin в localStorage...');
console.log('');

// Проверяем наличие localStorage
if (typeof localStorage === 'undefined') {
  console.error('❌ localStorage недоступен');
  console.log('Запустите этот скрипт в консоли браузера (F12 → Console)');
  return;
}

// Получаем текущую базу пользователей
const usersDBRaw = localStorage.getItem('usersDB');
let usersDB = [];

if (usersDBRaw) {
  try {
    usersDB = JSON.parse(usersDBRaw);
    console.log('📦 Загружено пользователей:', usersDB.length);
  } catch (e) {
    console.error('❌ Ошибка парсинга usersDB:', e.message);
    usersDB = [];
  }
}

// Находим admin
const adminIndex = usersDB.findIndex(u => u.username === 'admin');

if (adminIndex === -1) {
  console.error('❌ Пользователь admin не найден');
  console.log('Создаём нового...');
  
  usersDB.push({
    username: 'admin',
    password: 'ghettocoal',
    role: 'admin',
    createdAt: new Date().toISOString()
  });
  
  console.log('✅ Пользователь admin создан');
} else {
  // Обновляем пароль
  const oldPassword = usersDB[adminIndex].password;
  usersDB[adminIndex].password = 'ghettocoal';
  usersDB[adminIndex].passwordChangedAt = new Date().toISOString();
  
  console.log('✅ Пароль admin обновлён');
  console.log('   Было:', oldPassword);
  console.log('   Стало:', 'ghettocoal');
}

// Сохраняем изменения
localStorage.setItem('usersDB', JSON.stringify(usersDB));
console.log('💾 usersDB сохранён в localStorage');

// Также обновляем текущую сессию если есть
const currentUserRaw = localStorage.getItem('currentUser');
if (currentUserRaw) {
  try {
    const currentUser = JSON.parse(currentUserRaw);
    if (currentUser.username === 'admin') {
      console.log('⚠️  Найдена активная сессия admin');
      console.log('   Рекомендуется выйти и зайти заново');
    }
  } catch (e) {
    // Игнорируем ошибки парсинга
  }
}

console.log('');
console.log('✅ Готово!');
console.log('');
console.log('📋 Следующие шаги:');
console.log('   1. Перезагрузите страницу (F5 или Ctrl+R)');
console.log('   2. Войдите с credentials:');
console.log('      Логин: admin');
console.log('      Пароль: ghettocoal');
console.log('');
console.log('🗑️  Для полной очистки кеша выполните:');
console.log('   localStorage.clear(); location.reload();');
console.log('');
