// Скрипт для вставки в консоль браузера для проверки localStorage
console.log('🔍 Проверка localStorage на поврежденные символы...\n');

const keysToCheck = [
  'qaUserCards',
  'qaFavorites',
  'srsProgress',
  'studyStats'
];

let foundIssues = false;

keysToCheck.forEach(key => {
  const value = localStorage.getItem(key);
  if (!value) {
    console.log(`⚠️ ${key}: не найден`);
    return;
  }
  
  const hasFFFD = value.includes('\uFFFD');
  const hasBadRussian = /Д\?{1,10}кументация/.test(value);
  const hasQuestionInRussian = /[а-яА-Я]\?[а-яА-Я]/.test(value);
  
  if (hasFFFD || hasBadRussian || hasQuestionInRussian) {
    console.log(`❌ ${key}: ПОВРЕЖДЕН!`);
    console.log(`   U+FFFD: ${hasFFFD}`);
    console.log(`   Поврежденный русский: ${hasBadRussian}`);
    console.log(`   ? внутри слов: ${hasQuestionInRussian}`);
    foundIssues = true;
    
    // Показываем пример
    if (hasBadRussian || hasQuestionInRussian) {
      const match = value.match(/Д\?{1,10}кументация|[а-яА-Я]\?[а-яА-Я]/);
      if (match) {
        console.log(`   Пример: ${match[0]}`);
      }
    }
  } else {
    console.log(`✅ ${key}: чист`);
  }
});

console.log('\n' + '='.repeat(60));
if (foundIssues) {
  console.log('❌ localStorage содержит поврежденные данные!');
  console.log('Это значит, что проблема НА КЛИЕНТЕ до отправки на сервер.');
} else {
  console.log('✅ localStorage чист.');
  console.log('Значит проблема происходит ПРИ ОТПРАВКЕ или НА СЕРВЕРЕ.');
}
