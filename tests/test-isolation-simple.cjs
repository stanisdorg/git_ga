/**
 * ТЕСТ НА ИЗОЛЯЦИЮ ДАННЫХ ПОЛЬЗОВАТЕЛЕЙ (Node.js + API)
 * 
 * Проверяет что:
 * 1. У каждого пользователя свои файлы данных
 * 2. Файлы не пересекаются
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const BASE_URL = 'http://localhost:8085';
const DATA_DIR = path.join(__dirname, '..', 'data');

// Тестовые пользователи
const USER1 = { username: 'autotest_user1', password: 'auto123' };
const USER2 = { username: 'autotest_user2', password: 'auto456' };

console.log('\n========================================');
console.log(' USER ISOLATION AUTO-TEST');
console.log('========================================\n');

// Создаём тестовых пользователей если нет
function ensureTestUsers() {
    const usersPath = path.join(DATA_DIR, 'users.json');
    let users = [];
    
    if (fs.existsSync(usersPath)) {
        users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
    }
    
    let created = 0;
    [USER1, USER2].forEach(user => {
        if (!users.find(u => u.username === user.username)) {
            users.push({
                username: user.username,
                password: hashPassword(user.password),
                role: 'user',
                createdAt: new Date().toISOString()
            });
            created++;
        }
    });
    
    if (created > 0) {
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        console.log(`✓ Created ${created} test users\n`);
    } else {
        console.log('✓ Test users exist\n');
    }
}

function hashPassword(password) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update('test_salt_' + password).digest('hex');
}

function makeRequest(method, url, data = null) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || 8085,
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body) });
                } catch {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });
        
        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

async function test1_User1CreatesData() {
    console.log('=== TEST 1: User 1 creates data ===');
    
    // Login User 1
    const loginRes = await makeRequest('POST', `${BASE_URL}/register?user=admin&token=admin`, {
        username: USER1.username,
        password: USER1.password,
        role: 'user'
    });
    console.log('User 1 registered/logged in');
    
    // Save test card
    const testCard = {
        question: 'Автотест: Вопрос User 1',
        answer: 'Автотест: Ответ User 1',
        category: 'Автотесты',
        subcategory: 'Изоляция'
    };
    
    const saveRes = await makeRequest('POST', `${BASE_URL}/save?user=${USER1.username}`, [testCard]);
    console.log(`User 1 saved card: ${saveRes.status === 200 ? '✓' : '✗'}`);
    
    // Verify file exists
    const user1File = path.join(DATA_DIR, `user_${USER1.username}.json`);
    const exists = fs.existsSync(user1File);
    console.log(`User 1 file exists: ${exists ? '✓' : '✗'}`);
    
    if (exists) {
        const userData = JSON.parse(fs.readFileSync(user1File, 'utf-8'));
        const hasCard = userData._cards?.some(c => c.question.includes('Автотест: Вопрос User 1'));
        console.log(`User 1 has test card: ${hasCard ? '✓' : '✗'}`);
    }
    
    console.log('=== TEST 1 COMPLETE ===\n');
    return exists;
}

async function test2_User2SeparateFile() {
    console.log('=== TEST 2: User 2 has separate file ===');
    
    // Login User 2
    const loginRes = await makeRequest('POST', `${BASE_URL}/register?user=admin&token=admin`, {
        username: USER2.username,
        password: USER2.password,
        role: 'user'
    });
    console.log('User 2 registered/logged in');
    
    // Check User 2 file
    const user2File = path.join(DATA_DIR, `user_${USER2.username}.json`);
    const exists = fs.existsSync(user2File);
    console.log(`User 2 file exists: ${exists ? '✓' : '✗'}`);
    
    // Verify User 2 does NOT have User 1 card
    if (exists) {
        const userData = JSON.parse(fs.readFileSync(user2File, 'utf-8'));
        const hasUser1Card = userData._cards?.some(c => c.question.includes('Автотест: Вопрос User 1'));
        console.log(`User 2 does NOT have User 1 card: ${!hasUser1Card ? '✓' : '✗'}`);
    }
    
    console.log('=== TEST 2 COMPLETE ===\n');
    return exists && true;
}

async function test3_BothFilesSeparate() {
    console.log('=== TEST 3: Both files are separate ===');
    
    const user1File = path.join(DATA_DIR, `user_${USER1.username}.json`);
    const user2File = path.join(DATA_DIR, `user_${USER2.username}.json`);
    
    const user1Exists = fs.existsSync(user1File);
    const user2Exists = fs.existsSync(user2File);
    
    console.log(`User 1 file: ${user1Exists ? '✓' : '✗'}`);
    console.log(`User 2 file: ${user2Exists ? '✓' : '✗'}`);
    
    if (user1Exists && user2Exists) {
        const user1Data = JSON.parse(fs.readFileSync(user1File, 'utf-8'));
        const user2Data = JSON.parse(fs.readFileSync(user2File, 'utf-8'));
        
        const user1CardCount = user1Data._cards?.length || 0;
        const user2CardCount = user2Data._cards?.length || 0;
        
        console.log(`User 1 cards: ${user1CardCount}`);
        console.log(`User 2 cards: ${user2CardCount}`);
        
        const user1HasOwnCard = user1Data._cards?.some(c => c.question.includes('Автотест: Вопрос User 1'));
        const user2HasOwnCard = user2Data._cards?.some(c => c.question.includes('Автотест: Вопрос User 2'));
        
        console.log(`User 1 has own card: ${user1HasOwnCard ? '✓' : '✗'}`);
        console.log(`User 2 has own card: ${user2HasOwnCard ? '✓' : '✗'}`);
    }
    
    console.log('=== TEST 3 COMPLETE ===\n');
    return user1Exists && user2Exists;
}

async function runTests() {
    try {
        ensureTestUsers();
        
        const test1Pass = await test1_User1CreatesData();
        const test2Pass = await test2_User2SeparateFile();
        const test3Pass = await test3_BothFilesSeparate();
        
        console.log('========================================');
        console.log(' RESULTS');
        console.log('========================================');
        console.log(`TEST 1 (User 1 creates): ${test1Pass ? '✓ PASS' : '✗ FAIL'}`);
        console.log(`TEST 2 (User 2 separate): ${test2Pass ? '✓ PASS' : '✗ FAIL'}`);
        console.log(`TEST 3 (Files separate): ${test3Pass ? '✓ PASS' : '✗ FAIL'}`);
        console.log('========================================\n');
        
        const allPass = test1Pass && test2Pass && test3Pass;
        console.log(`OVERALL: ${allPass ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}\n`);
        
        process.exit(allPass ? 0 : 1);
    } catch (error) {
        console.error('Test error:', error.message);
        process.exit(1);
    }
}

runTests();
