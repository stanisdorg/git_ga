/**
 * ПРОСТОЙ ТЕСТ НА ИЗОЛЯЦИЮ ДАННЫХ
 * Проверяет что файлы пользователей разные
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

console.log('\n========================================');
console.log(' USER DATA ISOLATION TEST');
console.log('========================================\n');

// Проверяем существующие файлы пользователей
const userFiles = fs.readdirSync(DATA_DIR)
    .filter(f => f.startsWith('user_') && f.endsWith('.json') && !f.includes('_metadata') && !f.includes('_trash'));

console.log('User files found:');
userFiles.forEach(f => console.log(`  - ${f}`));
console.log();

// Проверяем jeff и admin
const jeffFile = path.join(DATA_DIR, 'user_jeff.json');
const adminFile = path.join(DATA_DIR, 'user_admin.json');

console.log('=== CHECKING ISOLATION ===\n');

const jeffExists = fs.existsSync(jeffFile);
const adminExists = fs.existsSync(adminFile);

console.log(`jeff file exists: ${jeffExists ? '✓' : '✗'}`);
console.log(`admin file exists: ${adminExists ? '✓' : '✗'}\n`);

if (jeffExists && adminExists) {
    const jeffData = JSON.parse(fs.readFileSync(jeffFile, 'utf-8'));
    const adminData = JSON.parse(fs.readFileSync(adminFile, 'utf-8'));
    
    const jeffCards = jeffData._cards?.length || 0;
    const adminCards = adminData._cards?.length || 0;
    
    console.log(`jeff cards: ${jeffCards}`);
    console.log(`admin cards: ${adminCards}`);
    
    // Проверяем что это разные файлы
    const jeffQuestions = jeffData._cards?.map(c => c.question) || [];
    const adminQuestions = adminData._cards?.map(c => c.question) || [];
    
    // Проверяем есть ли пересечения
    const hasUniqueJeff = jeffQuestions.some(q => !adminQuestions.includes(q));
    const hasUniqueAdmin = adminQuestions.some(q => !jeffQuestions.includes(q));
    
    console.log(`\njeff has unique cards: ${hasUniqueJeff ? '✓' : '✗'}`);
    console.log(`admin has unique cards: ${hasUniqueAdmin ? '✓' : '✗'}`);
    
    // Проверяем что файлы не идентичны
    const areIdentical = JSON.stringify(jeffData) === JSON.stringify(adminData);
    console.log(`\nFiles are NOT identical: ${!areIdentical ? '✓' : '✗'}`);
    
    console.log('\n=== ISOLATION TEST COMPLETE ===\n');
    
    const pass = hasUniqueJeff && hasUniqueAdmin && !areIdentical;
    console.log(`OVERALL: ${pass ? '✓ PASS - Users are isolated' : '✗ FAIL - Users share data'}\n`);
    
    process.exit(pass ? 0 : 1);
} else {
    console.log('Cannot test - files do not exist\n');
    process.exit(1);
}
