// Мониторинг файлов данных на повреждение в реальном времени
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, 'data');

console.log('🔍 Мониторинг файлов данных...\n');

// Проверяем все JSON файлы
const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));

let totalIssues = 0;

files.forEach(file => {
  const filePath = path.join(dataDir, file);
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Проверяем на U+FFFD
    const uffdCount = [...content].filter(c => c === '\uFFFD').length;
    
    // Проверяем на поврежденные русские символы
    const badRussian = /[а-яА-Я]\?[а-яА-Я]/g;
    const badMatches = content.match(badRussian);
    
    // Проверяем конкретные паттерны
    const docBad = /Д\?{1,5}кументация/.test(content);
    
    if (uffdCount > 0 || badMatches || docBad) {
      totalIssues++;
      console.log(`❌ ${file}:`);
      if (uffdCount > 0) console.log(`   U+FFFD: ${uffdCount}`);
      if (badMatches) console.log(`   Поврежденные русские: ${badMatches.length}`);
      if (docBad) console.log(`   "Д?кументация": найдено`);
      
      // Показываем первый пример
      if (badMatches && badMatches.length > 0) {
        const idx = content.indexOf(badMatches[0]);
        const ctx = content.substring(Math.max(0, idx - 30), Math.min(content.length, idx + 50));
        console.log(`   Пример: ${JSON.stringify(ctx)}`);
      }
      console.log('');
    }
  } catch (err) {
    console.log(`⚠️ ${file}: ошибка чтения - ${err.message}`);
  }
});

console.log('='.repeat(60));
if (totalIssues > 0) {
  console.log(`❌ Найдено файлов с проблемами: ${totalIssues}`);
  console.log('\nСрочно проверьте логи сервера!');
  process.exit(1);
} else {
  console.log('✅ Все файлы чисты!');
}
