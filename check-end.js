// Проверка конца файла
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'data', 'user_jeff.json');
const buffer = fs.readFileSync(filePath);

console.log(`Длина файла: ${buffer.length} байт`);
console.log(`Последние 50 байт: ${buffer.slice(-50).toString('hex')}`);
console.log(`Последние 50 символов: ${JSON.stringify(buffer.toString('utf-8').slice(-50))}`);

// Проверяем, есть ли данные после закрывающей скобки
const content = buffer.toString('utf-8');
const trimmed = content.trimEnd();
console.log(`\nПосле trimEnd:`);
console.log(`Последние 10 символов: ${JSON.stringify(trimmed.slice(-10))}`);

// Проверяем, валидный ли JSON
try {
  JSON.parse(trimmed);
  console.log('\n✅ Валидный JSON');
} catch (e) {
  console.log(`\n❌ Ошибка JSON: ${e.message}`);
  // Показываем позицию ошибки
  const match = e.message.match(/position (\d+)/);
  if (match) {
    const pos = parseInt(match[1]);
    const ctx = content.substring(Math.max(0, pos - 50), Math.min(content.length, pos + 50));
    console.log(`Позиция ошибки: ${pos}`);
    console.log(`Контекст: ${JSON.stringify(ctx)}`);
  }
}
