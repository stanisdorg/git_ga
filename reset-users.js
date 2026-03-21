// Сброс данных пользователей
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, 'data');

console.log('🗑️ Сброс данных пользователей admin и jeff...\n');

const users = ['admin', 'jeff'];

users.forEach(username => {
  console.log(`\n${username}:`);
  
  // 1. Сброс user файла
  const userPath = path.join(dataDir, `user_${username}.json`);
  if (fs.existsSync(userPath)) {
    const globalPath = path.join(dataDir, 'global.json');
    const globalCards = JSON.parse(fs.readFileSync(globalPath, 'utf-8'));
    
    const resetUser = {
      _meta: {
        username,
        role: username === 'admin' ? 'admin' : 'user',
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
        cardsCount: globalCards.length,
        lastSavedAt: null
      },
      _cards: globalCards,
      _achievements: {},
      _stats: {},
      _srsProgress: {},
      _favorites: []
    };
    
    fs.writeFileSync(userPath, JSON.stringify(resetUser, null, 2), 'utf-8');
    console.log(`  ✅ user_${username}.json: сброшен (${globalCards.length} карточек из global.json)`);
  } else {
    console.log(`  ⚠️ user_${username}.json: не найден`);
  }
  
  // 2. Сброс metadata
  const metaPath = path.join(dataDir, `user_${username}_metadata.json`);
  fs.writeFileSync(metaPath, JSON.stringify({}, null, 2), 'utf-8');
  console.log(`  ✅ user_${username}_metadata.json: сброшен`);
  
  // 3. Сброс trash
  const trashPath = path.join(dataDir, `user_${username}_trash.json`);
  fs.writeFileSync(trashPath, JSON.stringify([], null, 2), 'utf-8');
  console.log(`  ✅ user_${username}_trash.json: сброшен`);
  
  // 4. Сброс progress
  const progressPath = path.join(dataDir, `user_progress_${username}.json`);
  if (fs.existsSync(progressPath)) {
    const resetProgress = {
      username,
      lastSessionDate: null,
      totalPoints: 0,
      currentStreak: 0,
      longestStreak: 0,
      cardsLearned: 0,
      cardsInProgress: 0
    };
    fs.writeFileSync(progressPath, JSON.stringify(resetProgress, null, 2), 'utf-8');
    console.log(`  ✅ user_progress_${username}.json: сброшен`);
  }
  
  // 5. Удаляем debug файлы
  const debugFiles = [
    'debug_read_file.json',
    'debug_bad_cards.json',
    'debug_server_response.json',
    'debug_bad_request.json',
    'debug_before_write.json',
    'debug_after_write.json'
  ];
  
  debugFiles.forEach(debugFile => {
    const debugPath = path.join(dataDir, debugFile);
    if (fs.existsSync(debugPath)) {
      fs.unlinkSync(debugPath);
      console.log(`  🗑️ ${debugFile}: удален`);
    }
  });
});

console.log('\n' + '='.repeat(60));
console.log('✅ Сброс завершен!');
console.log('\nТеперь:');
console.log('1. Перезапустите сервер (Ctrl+C → node server.js)');
console.log('2. Очистите localStorage в браузере:');
console.log('   - Откройте консоль (F12)');
console.log('   - Введите: localStorage.clear()');
console.log('   - Перезагрузите страницу (F5)');
console.log('3. Войдите в аккаунт admin или jeff');
