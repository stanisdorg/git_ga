// Экстренное исправление файлов
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, 'data');

console.log('🚑 Экстренное исправление файлов...\n');

const files = ['user_admin.json', 'user_jeff.json'];

files.forEach(file => {
  const filePath = path.join(dataDir, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ ${file} не найден`);
    return;
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Считаем проблемы
  const uffdCount = [...content].filter(c => c === '\uFFFD').length;
  const badRussian = /[а-яА-Я]\?[а-яА-Я]/g;
  const badMatches = content.match(badRussian);
  
  if (uffdCount === 0 && (!badMatches || badMatches.length === 0)) {
    console.log(`✅ ${file} чист`);
    return;
  }
  
  console.log(`${file}:`);
  console.log(`  U+FFFD: ${uffdCount}`);
  console.log(`  Поврежденные русские: ${badMatches ? badMatches.length : 0}`);
  
  // Создаем резервную копию
  const backupPath = path.join(dataDir, `${file}.backup_before_fix`);
  fs.writeFileSync(backupPath, content, 'utf-8');
  console.log(`  💾 Резервная копия: ${backupPath}`);
  
  // Исправляем
  let fixed = content;
  
  // Заменяем U+FFFD на "?"
  fixed = fixed.replace(/\uFFFD/g, '?');
  
  // Исправляем известные паттерны
  const fixes = [
    { from: /Д\?{1,5}кументация/g, to: 'Документация' },
    { from: /инфу о\? сервера/g, to: 'инфу от сервера' },
    { from: /получа\?м/g, to: 'получаем' },
  ];
  
  fixes.forEach(fix => {
    if (fix.from.test(fixed)) {
      fixed = fixed.replace(fix.from, fix.to);
      console.log(`  ✏️ Исправлено: ${fix.from} → ${fix.to}`);
    }
  });
  
  // Сохраняем
  fs.writeFileSync(filePath, fixed, 'utf-8');
  console.log(`  ✅ Исправлено\n`);
});

console.log('Готово! Перезапустите сервер.');
