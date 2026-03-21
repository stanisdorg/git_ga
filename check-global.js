// Скрипт для проверки global.json на поврежденные символы
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const globalPath = path.join(__dirname, 'data', 'global.json');

console.log('🔍 Проверка global.json...\n');

const buffer = fs.readFileSync(globalPath);
const content = buffer.toString('utf-8');

// Проверяем U+FFFD
let uffdCount = 0;
for (let i = 0; i < content.length; i++) {
  if (content[i] === '\uFFFD') uffdCount++;
}

console.log(`U+FFFD найдено: ${uffdCount}`);

// Проверяем характерные последовательности UTF-8 -> Windows-1251 -> UTF-8
const badPatterns = [
  /Р[?]/g,  // Характерные искажения русских букв
  /РўР/g,
  /Р¦Р/g,
];

let totalBad = 0;
badPatterns.forEach((pattern, idx) => {
  const matches = content.match(pattern);
  if (matches) {
    totalBad += matches.length;
    console.log(`Паттерн ${idx + 1}: ${matches.length} совпадений`);
  }
});

console.log(`\nВсего поврежденных последовательностей: ${totalBad}`);

// Показываем примеры
if (totalBad > 0) {
  console.log('\nПримеры поврежденных мест:');
  const lines = content.split('\n');
  let shown = 0;
  for (let i = 0; i < lines.length && shown < 5; i++) {
    if (badPatterns.some(p => p.test(lines[i]))) {
      console.log(`\nСтрока ${i + 1}: ${lines[i].substring(0, 150)}...`);
      shown++;
    }
  }
}

// Проверяем "Документация"
const docIndex = content.indexOf('Документация');
const docBadIndex = content.indexOf('Д');
console.log('\n' + '='.repeat(60));
if (docIndex !== -1) {
  console.log('✅ "Документация" найдена в правильной кодировке');
}
if (docBadIndex !== -1) {
  console.log(`❌ "Д..." найдена на позиции ${docBadIndex}`);
  const ctx = content.substring(docBadIndex - 20, docBadIndex + 50);
  console.log(`Контекст: ${JSON.stringify(ctx)}`);
}
