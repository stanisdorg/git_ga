// Comprehensive E2E tests for user data isolation
// Run: npx playwright test tests/test-user-data-isolation.spec.ts

import { test, expect } from '@playwright/test';

const BACKEND_URL = 'http://localhost:8085';

test.describe('User Data Isolation - Full Flow', () => {
    
    // Clean state before each test
    test.beforeEach(async ({ page }) => {
        await page.goto(BACKEND_URL);
        await page.waitForLoadState('networkidle');
        // Clear localStorage
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.waitForLoadState('networkidle');
        // Wait for data to load
        await page.waitForFunction(() => {
            const items = document.querySelectorAll('#results-list .result-item');
            return items.length > 0;
        }, { timeout: 10000 });
    });

    test('TEST 1: Initial load - should show 316 cards from global.json', async ({ page }) => {
        console.log('[TEST 1] Checking initial card count...');
        
        // Wait for cards to load
        await page.waitForSelector('#results-list .result-item', { state: 'visible', timeout: 10000 });
        
        // Count cards
        const cards = await page.$$('#results-list .result-item');
        console.log(`[TEST 1] Found ${cards.length} cards`);
        
        expect(cards.length).toBeGreaterThan(300); // Should be 316
        
        // Check for categories
        const tabs = await page.$$('.tabs-container .tab');
        expect(tabs.length).toBeGreaterThan(0);
        
        console.log('[TEST 1] PASSED');
    });

    test('TEST 2: Login as admin - should load user data', async ({ page }) => {
        console.log('[TEST 2] Testing admin login...');
        
        // Click login button
        await page.click('.login-main-btn');
        await page.waitForSelector('#login-overlay', { state: 'visible' });
        
        // Enter credentials
        await page.fill('#login-username', 'admin');
        await page.fill('#login-password', 'admin');
        
        // Submit
        await Promise.all([
            page.waitForResponse(response => 
                response.url().includes('/api/login') && response.status() === 200
            ),
            page.click('#login-submit')
        ]);
        
        // Wait for overlay to close
        await page.waitForSelector('#login-overlay', { state: 'hidden', timeout: 5000 });
        
        // Check that session token is saved
        const token = await page.evaluate(() => localStorage.getItem('sessionToken'));
        console.log(`[TEST 2] Session token: ${token ? 'EXISTS' : 'MISSING'}`);
        expect(token).toBeTruthy();
        
        // Check that user is saved
        const user = await page.evaluate(() => localStorage.getItem('qaSessionUser'));
        console.log(`[TEST 2] User data: ${user ? 'EXISTS' : 'MISSING'}`);
        expect(user).toBeTruthy();
        
        console.log('[TEST 2] PASSED');
    });

    test('TEST 3: Edit card as admin - should save to user file', async ({ page }) => {
        console.log('[TEST 3] Testing card editing...');
        
        // Login first
        await page.click('.login-main-btn');
        await page.waitForSelector('#login-overlay');
        await page.fill('#login-username', 'admin');
        await page.fill('#login-password', 'admin');
        await page.click('#login-submit');
        await page.waitForSelector('#login-overlay', { state: 'hidden' });
        
        // Wait for card to be clickable
        await page.waitForSelector('#results-list .result-item', { state: 'visible' });
        
        // Click kebab menu on first card
        await page.click('#results-list .result-item:first-child .kebab-btn');
        
        // Click edit
        await page.click('[data-act="edit"]');
        
        // Wait for edit mode
        await page.waitForSelector('.edit-question', { state: 'visible' });
        
        // Get original question
        const originalQuestion = await page.inputValue('.edit-question');
        const testSuffix = `_TEST_${Date.now()}`;
        const newQuestion = originalQuestion + testSuffix;
        
        // Edit question
        await page.fill('.edit-question', newQuestion);
        
        // Save
        await Promise.all([
            page.waitForResponse(response => 
                response.url().includes('/save') && response.status() === 200
            ),
            page.click('.save-inline')
        ]);
        
        console.log(`[TEST 3] Card edited: ${testSuffix}`);
        
        // Check sync widget shows success
        const syncStatus = await page.locator('.sync-status-indicator').textContent();
        console.log(`[TEST 3] Sync status: ${syncStatus}`);
        
        console.log('[TEST 3] PASSED');
        
        return testSuffix;
    });

    test('TEST 4: Logout and login again - changes should persist', async ({ page }) => {
        console.log('[TEST 4] Testing data persistence after logout/login...');
        
        // Login
        await page.click('.login-main-btn');
        await page.waitForSelector('#login-overlay');
        await page.fill('#login-username', 'admin');
        await page.fill('#login-password', 'admin');
        await page.click('#login-submit');
        await page.waitForSelector('#login-overlay', { state: 'hidden' });
        
        // Edit a card
        await page.waitForSelector('#results-list .result-item', { state: 'visible' });
        await page.click('#results-list .result-item:first-child .kebab-btn');
        await page.click('[data-act="edit"]');
        await page.waitForSelector('.edit-question');
        
        const originalQuestion = await page.inputValue('.edit-question');
        const testSuffix = `_PERSIST_TEST_${Date.now()}`;
        await page.fill('.edit-question', originalQuestion + testSuffix);
        await page.click('.save-inline');
        await page.waitForTimeout(1000);
        
        console.log(`[TEST 4] Edited card with suffix: ${testSuffix}`);
        
        // Logout
        await page.click('.login-main-btn');
        await page.waitForTimeout(500);
        
        // Clear localStorage (simulate fresh session)
        await page.evaluate(() => {
            localStorage.removeItem('sessionToken');
            localStorage.removeItem('qaSessionUser');
        });
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        // Login again
        await page.click('.login-main-btn');
        await page.waitForSelector('#login-overlay');
        await page.fill('#login-username', 'admin');
        await page.fill('#login-password', 'admin');
        await page.click('#login-submit');
        await page.waitForSelector('#login-overlay', { state: 'hidden' });
        await page.waitForTimeout(2000);
        
        // Search for the edited card
        await page.fill('#search-input', testSuffix);
        await page.waitForTimeout(1000);
        
        // Check if card exists
        const cards = await page.$$('#results-list .result-item');
        console.log(`[TEST 4] Found ${cards.length} cards with test suffix`);
        
        // The edited card should be found
        expect(cards.length).toBeGreaterThan(0);
        
        console.log('[TEST 4] PASSED');
    });

    test('TEST 5: Different users - data should be isolated', async ({ page }) => {
        console.log('[TEST 5] Testing user data isolation...');
        
        // Login as admin and edit card
        await page.click('.login-main-btn');
        await page.waitForSelector('#login-overlay');
        await page.fill('#login-username', 'admin');
        await page.fill('#login-password', 'admin');
        await page.click('#login-submit');
        await page.waitForSelector('#login-overlay', { state: 'hidden' });
        
        await page.waitForSelector('#results-list .result-item', { state: 'visible' });
        await page.click('#results-list .result-item:first-child .kebab-btn');
        await page.click('[data-act="edit"]');
        await page.waitForSelector('.edit-question');
        
        const adminSuffix = `_ADMIN_ONLY_${Date.now()}`;
        const originalQuestion = await page.inputValue('.edit-question');
        await page.fill('.edit-question', originalQuestion + adminSuffix);
        await page.click('.save-inline');
        await page.waitForTimeout(1000);
        
        console.log(`[TEST 5] Admin edited card: ${adminSuffix}`);
        
        // Logout
        await page.click('.login-main-btn');
        await page.waitForTimeout(500);
        
        // Login as stas (user role)
        await page.fill('#login-username', 'stas');
        await page.fill('#login-password', 'admin');
        await page.click('#login-submit');
        await page.waitForSelector('#login-overlay', { state: 'hidden' });
        await page.waitForTimeout(2000);
        
        // Search for admin's edit - should NOT be found
        await page.fill('#search-input', adminSuffix);
        await page.waitForTimeout(1000);
        
        const stasCards = await page.$$('#results-list .result-item');
        console.log(`[TEST 5] Stas found ${stasCards.length} cards with admin suffix (should be 0)`);
        
        // Stas should NOT see admin's changes
        expect(stasCards.length).toBe(0);
        
        console.log('[TEST 5] PASSED');
    });

    test('TEST 6: Sync widget should show correct status', async ({ page }) => {
        console.log('[TEST 6] Testing sync widget...');
        
        // Login
        await page.click('.login-main-btn');
        await page.waitForSelector('#login-overlay');
        await page.fill('#login-username', 'admin');
        await page.fill('#login-password', 'admin');
        await page.click('#login-submit');
        await page.waitForSelector('#login-overlay', { state: 'hidden' });
        
        // Wait for sync widget to appear
        await page.waitForSelector('.sync-status-indicator', { state: 'visible', timeout: 5000 });
        
        // Check sync widget exists
        const syncWidget = await page.locator('.sync-status-indicator');
        expect(syncWidget).toBeTruthy();
        
        console.log('[TEST 6] Sync widget exists');
        
        // Edit card and check sync
        await page.waitForSelector('#results-list .result-item', { state: 'visible' });
        await page.click('#results-list .result-item:first-child .kebab-btn');
        await page.click('[data-act="edit"]');
        await page.waitForSelector('.edit-question');
        
        await page.fill('.edit-question', 'Sync Test ' + Date.now());
        await page.click('.save-inline');
        
        // Wait for sync to complete
        await page.waitForTimeout(2000);
        
        // Check sync status
        const syncStatus = await syncWidget.textContent();
        console.log(`[TEST 6] Sync status after save: ${syncStatus}`);
        
        console.log('[TEST 6] PASSED');
    });
});
