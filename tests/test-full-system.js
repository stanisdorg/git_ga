// Полный интеграционный тест системы
// Запуск: node tests/test-full-system.js

import http from 'http';
import fs from 'fs';
import path from 'path';

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
                    resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
                } catch {
                    resolve({ status: res.statusCode, headers: res.headers, data: body });
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
    console.log('=== FULL SYSTEM INTEGRATION TESTS ===\n');
    
    let passed = 0;
    let failed = 0;
    const testResults = [];

    // ===== SECTION 1: Static Files =====
    console.log('--- SECTION 1: Static Files ---');
    
    const staticFiles = [
        { path: '/', name: 'index.html', check: (body) => body.includes('<!DOCTYPE html>') },
        { path: '/all-data.js?v=1.81', name: 'all-data.js', check: (body, headers) => headers['content-type'].includes('javascript') },
        { path: '/load-json-data.js', name: 'load-json-data.js', check: (body, headers) => headers['content-type'].includes('javascript') },
        { path: '/ui-manager.js?v=2.32', name: 'ui-manager.js', check: (body, headers) => headers['content-type'].includes('javascript') },
        { path: '/ui-variants/tabs-navigation.js?v=2.08', name: 'tabs-navigation.js', check: (body, headers) => headers['content-type'].includes('javascript') },
        { path: '/user-system.js?v=1.01', name: 'user-system.js', check: (body, headers) => headers['content-type'].includes('javascript') },
        { path: '/style.css?v=2.00', name: 'style.css', check: (body, headers) => headers['content-type'].includes('css') },
        { path: '/custom-styles.css?v=42.0', name: 'custom-styles.css', check: (body, headers) => headers['content-type'].includes('css') },
    ];

    for (const file of staticFiles) {
        try {
            const result = await request('GET', file.path);
            if (result.status === 200 && file.check(result.data, result.headers)) {
                console.log(`✅ ${file.name}: OK`);
                passed++;
                testResults.push({ name: file.name, status: 'PASS' });
            } else {
                console.log(`❌ ${file.name}: FAILED (status: ${result.status}, content-type: ${result.headers['content-type']})`);
                failed++;
                testResults.push({ name: file.name, status: 'FAIL', reason: `Status: ${result.status}` });
            }
        } catch (e) {
            console.log(`❌ ${file.name}: ERROR - ${e.message}`);
            failed++;
            testResults.push({ name: file.name, status: 'ERROR', reason: e.message });
        }
    }

    // ===== SECTION 2: Data Integrity =====
    console.log('\n--- SECTION 2: Data Integrity ---');
    
    // Check questions_no_anki.json
    try {
        const dataPath = path.join(process.cwd(), 'data', 'questions_no_anki.json');
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
        if (Array.isArray(data) && data.length >= 300) {
            console.log(`✅ questions_no_anki.json: ${data.length} items (OK)`);
            passed++;
            testResults.push({ name: 'questions_no_anki.json', status: 'PASS', count: data.length });
        } else {
            console.log(`❌ questions_no_anki.json: ${data.length} items (EXPECTED >= 300)`);
            failed++;
            testResults.push({ name: 'questions_no_anki.json', status: 'FAIL', count: data.length });
        }
    } catch (e) {
        console.log(`❌ questions_no_anki.json: ERROR - ${e.message}`);
        failed++;
        testResults.push({ name: 'questions_no_anki.json', status: 'ERROR', reason: e.message });
    }

    // Check /load API
    try {
        const result = await request('GET', '/load?user=global');
        if (result.status === 200 && result.data.ok && result.data.data && result.data.data.length >= 300) {
            console.log(`✅ /load API: ${result.data.data.length} items (OK)`);
            passed++;
            testResults.push({ name: '/load API', status: 'PASS', count: result.data.data.length });
        } else {
            console.log(`❌ /load API: FAILED (items: ${result.data.data?.length || 0})`);
            failed++;
            testResults.push({ name: '/load API', status: 'FAIL', count: result.data.data?.length || 0 });
        }
    } catch (e) {
        console.log(`❌ /load API: ERROR - ${e.message}`);
        failed++;
        testResults.push({ name: '/load API', status: 'ERROR', reason: e.message });
    }

    // ===== SECTION 3: User Isolation =====
    console.log('\n--- SECTION 3: User Data Isolation ---');
    
    // Create test data for admin
    const adminTestData = {
        question: `ADMIN_ISOLATION_TEST_${Date.now()}`,
        answer: 'Admin Test Answer',
        category: 'Test',
        subcategory: 'Isolation'
    };
    
    try {
        const result = await request('POST', '/save?user=admin', [adminTestData]);
        if (result.data.ok) {
            console.log(`✅ Admin save: OK`);
            passed++;
            testResults.push({ name: 'Admin save', status: 'PASS' });
        } else {
            console.log(`❌ Admin save: FAILED`);
            failed++;
            testResults.push({ name: 'Admin save', status: 'FAIL' });
        }
    } catch (e) {
        console.log(`❌ Admin save: ERROR - ${e.message}`);
        failed++;
        testResults.push({ name: 'Admin save', status: 'ERROR', reason: e.message });
    }

    // Verify admin data is isolated
    try {
        const adminResult = await request('GET', '/load?user=admin');
        const globalResult = await request('GET', '/load?user=global');
        
        const adminHasTest = adminResult.data.data.some(item => item.question === adminTestData.question);
        const globalHasTest = globalResult.data.data.some(item => item.question === adminTestData.question);
        
        if (adminHasTest && !globalHasTest) {
            console.log(`✅ Admin isolation: OK (admin has test, global doesn't)`);
            passed++;
            testResults.push({ name: 'Admin isolation', status: 'PASS' });
        } else {
            console.log(`❌ Admin isolation: FAILED (adminHasTest: ${adminHasTest}, globalHasTest: ${globalHasTest})`);
            failed++;
            testResults.push({ name: 'Admin isolation', status: 'FAIL', adminHasTest, globalHasTest });
        }
    } catch (e) {
        console.log(`❌ Admin isolation: ERROR - ${e.message}`);
        failed++;
        testResults.push({ name: 'Admin isolation', status: 'ERROR', reason: e.message });
    }

    // Clean up admin test data
    try {
        const adminPath = path.join(process.cwd(), 'data', 'user-data', 'admin.json');
        if (fs.existsSync(adminPath)) {
            const adminData = JSON.parse(fs.readFileSync(adminPath, 'utf-8'));
            const filtered = adminData.filter(item => item.question !== adminTestData.question);
            fs.writeFileSync(adminPath, JSON.stringify(filtered, null, 2));
            console.log(`✅ Admin cleanup: OK`);
            passed++;
            testResults.push({ name: 'Admin cleanup', status: 'PASS' });
        }
    } catch (e) {
        console.log(`❌ Admin cleanup: ERROR - ${e.message}`);
        failed++;
        testResults.push({ name: 'Admin cleanup', status: 'ERROR', reason: e.message });
    }

    // ===== SUMMARY =====
    console.log('\n=== TEST SUMMARY ===');
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${passed + failed}`);
    console.log(`\nSuccess Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    
    if (failed === 0) {
        console.log('\n🎉 ALL TESTS PASSED! System is ready for use.');
        console.log('\n📋 NEXT STEPS:');
        console.log('1. Open http://localhost:8085 in browser');
        console.log('2. Verify 316 cards are displayed');
        console.log('3. Verify categories are shown');
        console.log('4. Login as admin/admin and test editing');
        console.log('5. Logout and verify changes are isolated');
        process.exit(0);
    } else {
        console.log('\n❌ SOME TESTS FAILED! Review results above.');
        console.log('\n📋 DETAILED RESULTS:');
        testResults.forEach(r => {
            if (r.status !== 'PASS') {
                console.log(`   - ${r.name}: ${r.status}${r.reason ? ` (${r.reason})` : ''}`);
            }
        });
        process.exit(1);
    }
}

runTests().catch(e => {
    console.error('Test runner error:', e);
    process.exit(1);
});
