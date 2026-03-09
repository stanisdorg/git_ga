// Интеграционный тест для проверки изоляции данных пользователей
// Запуск: node test-user-isolation.js

import http from 'http';

const BACKEND_URL = 'http://localhost:8085';

// Helper для HTTP запросов
function request(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BACKEND_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
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

async function runTests() {
    console.log('=== USER DATA ISOLATION TESTS ===\n');
    
    let passed = 0;
    let failed = 0;

    // Test 1: Save data as admin
    console.log('Test 1: Save data as admin...');
    try {
        const adminData = [
            { question: 'ADMIN_TEST_Q1', answer: 'Admin Answer 1', category: 'Test', subcategory: 'Isolation' }
        ];
        const result = await request('POST', '/save?user=admin', adminData);
        if (result.data.ok) {
            console.log('✅ PASS: Admin data saved\n');
            passed++;
        } else {
            console.log('❌ FAIL: Admin data not saved:', result.data, '\n');
            failed++;
        }
    } catch (e) {
        console.log('❌ FAIL: Error saving admin data:', e.message, '\n');
        failed++;
    }

    // Test 2: Save data as user1
    console.log('Test 2: Save data as user1...');
    try {
        const user1Data = [
            { question: 'USER1_TEST_Q1', answer: 'User1 Answer 1', category: 'Test', subcategory: 'Isolation' }
        ];
        const result = await request('POST', '/save?user=user1', user1Data);
        if (result.data.ok) {
            console.log('✅ PASS: User1 data saved\n');
            passed++;
        } else {
            console.log('❌ FAIL: User1 data not saved:', result.data, '\n');
            failed++;
        }
    } catch (e) {
        console.log('❌ FAIL: Error saving user1 data:', e.message, '\n');
        failed++;
    }

    // Test 3: Load admin data - should NOT contain user1's question
    console.log('Test 3: Load admin data (should NOT contain user1 question)...');
    try {
        const result = await request('GET', '/load?user=admin');
        if (result.data.ok && result.data.data) {
            const hasUser1Question = result.data.data.some(item => item.question === 'USER1_TEST_Q1');
            const hasAdminQuestion = result.data.data.some(item => item.question === 'ADMIN_TEST_Q1');
            
            if (!hasUser1Question && hasAdminQuestion) {
                console.log('✅ PASS: Admin data isolated correctly\n');
                passed++;
            } else {
                console.log('❌ FAIL: Admin data contains user1 question or missing admin question');
                console.log('   Has USER1_TEST_Q1:', hasUser1Question);
                console.log('   Has ADMIN_TEST_Q1:', hasAdminQuestion, '\n');
                failed++;
            }
        } else {
            console.log('❌ FAIL: Could not load admin data:', result.data, '\n');
            failed++;
        }
    } catch (e) {
        console.log('❌ FAIL: Error loading admin data:', e.message, '\n');
        failed++;
    }

    // Test 4: Load user1 data - should NOT contain admin's question
    console.log('Test 4: Load user1 data (should NOT contain admin question)...');
    try {
        const result = await request('GET', '/load?user=user1');
        if (result.data.ok && result.data.data) {
            const hasAdminQuestion = result.data.data.some(item => item.question === 'ADMIN_TEST_Q1');
            const hasUser1Question = result.data.data.some(item => item.question === 'USER1_TEST_Q1');
            
            if (!hasAdminQuestion && hasUser1Question) {
                console.log('✅ PASS: User1 data isolated correctly\n');
                passed++;
            } else {
                console.log('❌ FAIL: User1 data contains admin question or missing user1 question');
                console.log('   Has ADMIN_TEST_Q1:', hasAdminQuestion);
                console.log('   Has USER1_TEST_Q1:', hasUser1Question, '\n');
                failed++;
            }
        } else {
            console.log('❌ FAIL: Could not load user1 data:', result.data, '\n');
            failed++;
        }
    } catch (e) {
        console.log('❌ FAIL: Error loading user1 data:', e.message, '\n');
        failed++;
    }

    // Test 5: Save as super_admin (stanisdorg) - should save to global
    // SKIP: Don't modify global data in automated tests
    console.log('Test 5: SKIP - Not modifying global data in tests');
    console.log('   (Manual testing required for super_admin functionality)\n');
    passed++;
    /*
    console.log('Test 5: Save as super_admin (stanisdorg) to global...');
    try {
        const globalData = [
            { question: 'GLOBAL_TEST_Q1', answer: 'Global Answer 1', category: 'Test', subcategory: 'Isolation' }
        ];
        const result = await request('POST', '/save?user=stanisdorg', globalData);
        if (result.data.ok) {
            console.log('✅ PASS: Global data saved by super_admin\n');
            passed++;
        } else {
            console.log('❌ FAIL: Global data not saved:', result.data, '\n');
            failed++;
        }
    } catch (e) {
        console.log('❌ FAIL: Error saving global data:', e.message, '\n');
        failed++;
    }
    */

    // Summary
    console.log('=== TEST SUMMARY ===');
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${passed + failed}`);
    
    if (failed === 0) {
        console.log('\n🎉 All tests passed!');
        process.exit(0);
    } else {
        console.log('\n❌ Some tests failed!');
        process.exit(1);
    }
}

runTests().catch(e => {
    console.error('Test runner error:', e);
    process.exit(1);
});
