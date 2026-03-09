// Интеграционный тест для проверки загрузки данных и UI
// Запуск: node tests/test-page-load.js

import http from 'http';

const BACKEND_URL = 'http://localhost:8085';

// Helper для HTTP запросов
function request(path) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BACKEND_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: 'GET',
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                resolve({ 
                    status: res.statusCode, 
                    headers: res.headers,
                    body: body 
                });
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function runTests() {
    console.log('=== PAGE LOAD INTEGRATION TESTS ===\n');
    
    let passed = 0;
    let failed = 0;

    // Test 1: Check index.html loads
    console.log('Test 1: Loading index.html...');
    try {
        const result = await request('/');
        if (result.status === 200 && result.body.includes('<!DOCTYPE html>')) {
            console.log('✅ PASS: index.html loaded\n');
            passed++;
        } else {
            console.log('❌ FAIL: index.html not loaded properly');
            console.log('   Status:', result.status);
            console.log('   Body preview:', result.body.substring(0, 200), '\n');
            failed++;
        }
    } catch (e) {
        console.log('❌ FAIL: Error loading index.html:', e.message, '\n');
        failed++;
    }

    // Test 2: Check all-data.js loads with correct MIME type
    console.log('Test 2: Loading all-data.js...');
    try {
        const result = await request('/all-data.js?v=1.81');
        const contentType = result.headers['content-type'];
        if (result.status === 200 && contentType.includes('javascript')) {
            console.log('✅ PASS: all-data.js loaded with correct MIME type:', contentType, '\n');
            passed++;
        } else {
            console.log('❌ FAIL: all-data.js not loaded properly');
            console.log('   Status:', result.status);
            console.log('   Content-Type:', contentType);
            console.log('   Body preview:', result.body.substring(0, 200), '\n');
            failed++;
        }
    } catch (e) {
        console.log('❌ FAIL: Error loading all-data.js:', e.message, '\n');
        failed++;
    }

    // Test 3: Check load-json-data.js loads with correct MIME type
    console.log('Test 3: Loading load-json-data.js...');
    try {
        const result = await request('/load-json-data.js');
        const contentType = result.headers['content-type'];
        if (result.status === 200 && contentType.includes('javascript')) {
            console.log('✅ PASS: load-json-data.js loaded with correct MIME type:', contentType, '\n');
            passed++;
        } else {
            console.log('❌ FAIL: load-json-data.js not loaded properly');
            console.log('   Status:', result.status);
            console.log('   Content-Type:', contentType);
            console.log('   Body preview:', result.body.substring(0, 200), '\n');
            failed++;
        }
    } catch (e) {
        console.log('❌ FAIL: Error loading load-json-data.js:', e.message, '\n');
        failed++;
    }

    // Test 4: Check ui-manager.js loads
    console.log('Test 4: Loading ui-manager.js...');
    try {
        const result = await request('/ui-manager.js?v=2.32');
        const contentType = result.headers['content-type'];
        if (result.status === 200 && contentType.includes('javascript')) {
            console.log('✅ PASS: ui-manager.js loaded with correct MIME type:', contentType, '\n');
            passed++;
        } else {
            console.log('❌ FAIL: ui-manager.js not loaded properly');
            console.log('   Status:', result.status);
            console.log('   Content-Type:', contentType);
            console.log('   Body preview:', result.body.substring(0, 200), '\n');
            failed++;
        }
    } catch (e) {
        console.log('❌ FAIL: Error loading ui-manager.js:', e.message, '\n');
        failed++;
    }

    // Test 5: Check tabs-navigation.js loads
    console.log('Test 5: Loading tabs-navigation.js...');
    try {
        const result = await request('/ui-variants/tabs-navigation.js?v=2.08');
        const contentType = result.headers['content-type'];
        if (result.status === 200 && contentType.includes('javascript')) {
            console.log('✅ PASS: tabs-navigation.js loaded with correct MIME type:', contentType, '\n');
            passed++;
        } else {
            console.log('❌ FAIL: tabs-navigation.js not loaded properly');
            console.log('   Status:', result.status);
            console.log('   Content-Type:', contentType);
            console.log('   Body preview:', result.body.substring(0, 200), '\n');
            failed++;
        }
    } catch (e) {
        console.log('❌ FAIL: Error loading tabs-navigation.js:', e.message, '\n');
        failed++;
    }

    // Test 6: Check /load API endpoint works
    console.log('Test 6: Testing /load API endpoint...');
    try {
        const result = await request('/load?user=global');
        const contentType = result.headers['content-type'];
        if (result.status === 200 && contentType.includes('application/json')) {
            const data = JSON.parse(result.body);
            if (data.ok && data.data && data.data.length > 0) {
                console.log('✅ PASS: /load API returns data with', data.data.length, 'items\n');
                passed++;
            } else {
                console.log('❌ FAIL: /load API returns empty data');
                console.log('   Response:', result.body.substring(0, 200), '\n');
                failed++;
            }
        } else {
            console.log('❌ FAIL: /load API not working properly');
            console.log('   Status:', result.status);
            console.log('   Content-Type:', contentType);
            console.log('   Body preview:', result.body.substring(0, 200), '\n');
            failed++;
        }
    } catch (e) {
        console.log('❌ FAIL: Error calling /load API:', e.message, '\n');
        failed++;
    }

    // Test 7: Check data/questions_no_anki.json exists and has data
    console.log('Test 7: Checking questions_no_anki.json...');
    try {
        const fs = await import('fs');
        const path = await import('path');
        const dataPath = path.join(process.cwd(), 'data', 'questions_no_anki.json');
        if (fs.existsSync(dataPath)) {
            const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
            if (Array.isArray(data) && data.length > 0) {
                console.log('✅ PASS: questions_no_anki.json exists with', data.length, 'items\n');
                passed++;
            } else {
                console.log('❌ FAIL: questions_no_anki.json is empty or invalid\n');
                failed++;
            }
        } else {
            console.log('❌ FAIL: questions_no_anki.json not found\n');
            failed++;
        }
    } catch (e) {
        console.log('❌ FAIL: Error reading questions_no_anki.json:', e.message, '\n');
        failed++;
    }

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
