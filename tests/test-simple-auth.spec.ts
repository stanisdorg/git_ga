// Simple E2E tests to find actual bugs
// Run: npx playwright test tests/test-simple-auth.spec.ts --reporter=list

import { test, expect } from '@playwright/test';

const BACKEND_URL = 'http://localhost:8085';

test.describe('Simple Auth Flow', () => {
    
    test('TEST 1: Login API works', async ({ page, request }) => {
        console.log('[TEST 1] Testing /api/login endpoint...');
        
        const response = await request.post(`${BACKEND_URL}/api/login`, {
            data: { username: 'admin', password: 'admin' }
        });
        
        console.log(`[TEST 1] Status: ${response.status()}`);
        const data = await response.json();
        console.log(`[TEST 1] Response:`, data);
        
        expect(response.status()).toBe(200);
        expect(data.ok).toBe(true);
        expect(data.token).toBeTruthy();
        
        console.log('[TEST 1] PASSED\n');
    });

    test('TEST 2: Login via UI', async ({ page }) => {
        console.log('[TEST 2] Testing login via UI...');
        
        await page.goto(BACKEND_URL);
        await page.waitForLoadState('networkidle');
        
        // Wait for cards
        await page.waitForSelector('#results-list .result-item', { timeout: 10000 });
        const initialCards = await page.$$('#results-list .result-item');
        console.log(`[TEST 2] Initial cards: ${initialCards.length}`);
        
        // Find and click login button
        const loginBtn = await page.locator('.login-main-btn').first();
        await loginBtn.click();
        
        // Wait for login modal
        await page.waitForSelector('#login-overlay', { timeout: 5000 });
        console.log('[TEST 2] Login modal opened');
        
        // Fill credentials
        await page.fill('#login-username', 'admin');
        await page.fill('#login-password', 'admin');
        
        // Click submit and wait for response
        await page.click('#login-submit');
        await page.waitForTimeout(2000);
        
        // Check if modal closed
        const modalVisible = await page.isVisible('#login-overlay').catch(() => false);
        console.log(`[TEST 2] Modal after login: ${modalVisible ? 'VISIBLE' : 'HIDDEN'}`);
        
        // Check localStorage
        const token = await page.evaluate(() => localStorage.getItem('sessionToken'));
        console.log(`[TEST 2] Token: ${token ? token.substring(0, 20) + '...' : 'MISSING'}`);
        
        const user = await page.evaluate(() => localStorage.getItem('qaSessionUser'));
        console.log(`[TEST 2] User: ${user ? 'EXISTS' : 'MISSING'}`);
        
        expect(token).toBeTruthy();
        expect(user).toBeTruthy();
        
        console.log('[TEST 2] PASSED\n');
    });

    test('TEST 3: Save card after login', async ({ page, request }) => {
        console.log('[TEST 3] Testing card save after login...');
        
        // First login via API to get token
        const loginRes = await request.post(`${BACKEND_URL}/api/login`, {
            data: { username: 'admin', password: 'admin' }
        });
        const loginData = await loginRes.json();
        const token = loginData.token;
        console.log(`[TEST 3] Got token: ${token ? 'YES' : 'NO'}`);
        
        // Now try to save
        const testData = [{
            question: `TEST_CARD_${Date.now()}`,
            answer: 'Test answer',
            category: 'Test',
            subcategory: 'AutoTest'
        }];
        
        const saveRes = await request.post(`${BACKEND_URL}/save?user=admin&token=${token}`, {
            data: testData
        });
        
        console.log(`[TEST 3] Save status: ${saveRes.status()}`);
        const saveData = await saveRes.json();
        console.log(`[TEST 3] Save response:`, saveData);
        
        expect(saveRes.status()).toBe(200);
        expect(saveData.ok).toBe(true);
        
        console.log('[TEST 3] PASSED\n');
    });

    test('TEST 4: Load user data', async ({ page, request }) => {
        console.log('[TEST 4] Testing load user data...');
        
        // Login
        const loginRes = await request.post(`${BACKEND_URL}/api/login`, {
            data: { username: 'admin', password: 'admin' }
        });
        const loginData = await loginRes.json();
        const token = loginData.token;
        
        // Load
        const loadRes = await request.get(`${BACKEND_URL}/load?user=admin&token=${token}`);
        console.log(`[TEST 4] Load status: ${loadRes.status()}`);
        
        const loadData = await loadRes.json();
        console.log(`[TEST 4] Cards count: ${loadData._cards?.length || 'N/A'}`);
        
        expect(loadRes.status()).toBe(200);
        // /load returns data directly, not wrapped in {ok: true}
        expect(loadData._cards).toBeTruthy();
        expect(Array.isArray(loadData._cards)).toBe(true);
        // Should have at least the test card from TEST 3
        expect(loadData._cards.length).toBeGreaterThan(0);
        
        console.log('[TEST 4] PASSED\n');
    });

    test('TEST 5: Metadata without auth', async ({ page, request }) => {
        console.log('[TEST 5] Testing metadata without auth...');
        
        // Try to get metadata without token
        const res = await request.get(`${BACKEND_URL}/metadata`);
        console.log(`[TEST 5] Status: ${res.status()}`);
        
        // Should return 200 with empty object, not 401
        expect(res.status()).toBe(200);
        
        const data = await res.json();
        console.log(`[TEST 5] Response:`, data);
        
        console.log('[TEST 5] PASSED\n');
    });
});
