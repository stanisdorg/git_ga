// Детальная проверка user_admin.json
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'data', 'user_admin.json');
const content = fs.readFileSync(filePath, 'utf-8');

console.log('🔍 Детальная проверка user_admin.json\n');

// Считаем U+FFFD
const uffdPositions = [];
for (let i = 0; i < content.length; i++) {
  if (content[i] === '\uFFFD') {
    uffdPositions.push(i);
  }
}

console.log(`Найдено U+FFFD: ${uffdPositions.length}`);

if (uffdPositions.length > 0) {
  console.log('\nПозиции и контекст:');
  
  // Показываем первые 10
  uffdPositions.slice(0, 10).forEach(pos => {
    const ctx = content.substring(Math.max(0, pos - 30), Math.min(content.length, pos + 30));
    console.log(`\nПозиция ${pos}: ${JSON.stringify(ctx)}`);
  });
  
  // Находим строки с повреждениями
  const lines = content.split('\n');
  let currentPos = 0;
  
  console.log('\n\nПоврежденные строки:');
  console.log('='.repeat(80));
  
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    const lineStart = currentPos;
    const lineEnd = currentPos + line.length;
    
    const hasDamage = uffdPositions.some(pos => pos >= lineStart && pos < lineEnd);
    
    if (hasDamage) {
      console.log(`\nСтрока ${lineNum + 1}:`);
      console.log(line.substring(0, 200));
    }
    
    currentPos = lineEnd + 1;
  }
}

// Проверяем конкретные карточки
const data = JSON.parse(content);
if (data._cards && Array.isArray(data._cards)) {
  const badCards = data._cards.filter(card => {
    const all = (card.category || '') + (card.subcategory || '') + (card.question || '') + (card.answer || '');
    return /\uFFFD/.test(all) || /Д\?{1,5}кументация/.test(all);
  });
  
  console.log('\n\n' + '='.repeat(80));
  console.log(`Повреждено карточек: ${badCards.length}`);
  
  if (badCards.length > 0) {
    console.log('\nПримеры:');
    badCards.slice(0, 3).forEach((card, idx) => {
      console.log(`\n${idx + 1}. Category: ${card.category}`);
      console.log(`   Subcategory: ${card.subcategory}`);
      console.log(`   Question: ${card.question?.substring(0, 50)}`);
    });
  }
}
