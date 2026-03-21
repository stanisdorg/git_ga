// Персистентное исправление файлов с логированием
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, 'data');

console.log('🔧 Персистентное исправление файлов данных...\n');

// Функция для исправления известных паттернов
function fixContent(content, fileName) {
  let fixed = content;
  let changes = [];
  
  // 1. Заменяем U+FFFD на "?"
  const uffdCount = [...fixed].filter(c => c === '\uFFFD').length;
  if (uffdCount > 0) {
    fixed = fixed.replace(/\uFFFD/g, '?');
    changes.push(`U+FFFD: ${uffdCount} → '?'`);
  }
  
  // 2. Исправляем известные паттерны
  const patterns = [
    { from: /Д\?{1,10}кументация/g, to: 'Документация', desc: '"Д?...кументация" → "Документация"' },
    { from: /инфу о\? сервера/g, to: 'инфу от сервера', desc: '"инфу о? сервера" → "инфу от сервера"' },
    { from: /получа\?м/g, to: 'получаем', desc: '"получа?м" → "получаем"' },
    { from: /се\?висы/g, to: 'сервисы', desc: '"се?висы" → "сервисы"' },
    { from: /се\?\?\?висы/g, to: 'сервисы', desc: '"се???висы" → "сервисы"' },
  ];
  
  patterns.forEach(pattern => {
    if (pattern.from.test(fixed)) {
      const count = (fixed.match(pattern.from) || []).length;
      fixed = fixed.replace(pattern.from, pattern.to);
      changes.push(`${pattern.desc}: ${count}`);
    }
  });
  
  // 3. Исправляем "Д?????????кументация" (9 вопросительных знаков)
  const longDocPattern = /Д\?{9}кументация/g;
  if (longDocPattern.test(fixed)) {
    const count = (fixed.match(longDocPattern) || []).length;
    fixed = fixed.replace(longDocPattern, 'Документация');
    changes.push(`"Д?????????кументация" → "Документация": ${count}`);
  }
  
  if (changes.length > 0) {
    console.log(`${fileName}:`);
    changes.forEach(change => console.log(`  ✏️ ${change}`));
    
    // Сохраняем
    const filePath = path.join(dataDir, fileName);
    fs.writeFileSync(filePath, fixed, 'utf-8');
    console.log(`  ✅ Сохранено\n`);
    
    return true;
  } else {
    console.log(`${fileName}: ✅ чист`);
    return false;
  }
}

// Исправляем файлы
const files = ['user_admin.json', 'user_jeff.json'];
let fixedCount = 0;

files.forEach(file => {
  const filePath = path.join(dataDir, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (fixContent(content, file)) {
      fixedCount++;
    }
  } else {
    console.log(`⚠️ ${file} не найден`);
  }
});

console.log('='.repeat(60));
console.log(`Исправлено файлов: ${fixedCount}`);
console.log('\nТеперь перезапустите сервер!');
