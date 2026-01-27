import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Extract version from ui-manager.js without importing it (avoids DOM dependencies)
const uiManagerPath = path.join(process.cwd(), 'ui-manager.js');
const uiManagerContent = fs.readFileSync(uiManagerPath, 'utf-8');
const versionMatch = uiManagerContent.match(/export const APP_VERSION = '([^']+)';/);
const EXPECTED_VERSION = versionMatch ? versionMatch[1] : 'UNKNOWN';

test.describe('QA Voice Assistant E2E', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Mock user login in localStorage
    await page.addInitScript(() => {
        localStorage.setItem('qaSessionUser', JSON.stringify({
            username: 'test_user',
            role: 'user'
        }));
    });

    // 2. Mock network requests for progress
    await page.route('**/api/progress?username=test_user', async route => {
        if (route.request().method() === 'GET') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    srsProgress: {
                        'юнит': { easeFactor: 2.9, interval: 6, repetitions: 3 }, // Easy
                        'ci cd?': { easeFactor: 1.3, interval: 1, repetitions: 1 }, // Hard
                        // Others will be default 2.5
                    },
                    updatedAt: Date.now()
                })
            });
        } else {
            await route.continue();
        }
    });

    await page.goto('/');
    // Wait for content to load
    await page.waitForSelector('#results-list', { timeout: 10000 });
  });

  test('should display correct title and version', async ({ page }) => {
    await expect(page).toHaveTitle(/QA/);
    console.log(`Expecting version: ${EXPECTED_VERSION}`);
    
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain(EXPECTED_VERSION);
  });

  test('should search and find results', async ({ page }) => {
    // Wait for data initialization
    await page.waitForTimeout(1000); 
    
    const searchInput = page.locator('#search-input');
    await searchInput.fill('баг');
    
    // Wait for filter to apply
    await page.waitForTimeout(500);
    
    const results = page.locator('.result-item');
    const count = await results.count();
    console.log(`Found ${count} results for "баг"`);
    expect(count).toBeGreaterThan(0);
  });

  test('should sort results correctly (Asc/Desc) with full validation', async ({ page }) => {
    // Wait for data and rendering
    await page.waitForTimeout(2000);
    
    const sortBtn = page.locator('#sort-toggle-btn');
    if (await sortBtn.count() === 0) {
        console.warn('Sort button not found!');
        return;
    }

    // Helper to extract data from all cards
    const getCardsData = async () => {
        return await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('.result-item'));
            return items.map(item => {
                const questionText = item.querySelector('.question')?.textContent.trim() || '';
                // Try to extract EF from tooltip
                const heartsContainer = item.querySelector('.hearts-container');
                let ef = 2.5; // Default

                if (heartsContainer) {
                    const title = heartsContainer.getAttribute('title') || '';
                    const match = title.match(/EF:\s*([\d\.]+)/);
                    if (match) {
                        ef = parseFloat(match[1]);
                    }
                }
                
                return { text: questionText, ef };
            });
        });
    };

    // 1. Switch to ASC (Hardest to Easiest: 1.3 -> 2.9)
    await sortBtn.click(); // Default -> Asc
    await page.waitForTimeout(1000);
    
    const dataAsc = await getCardsData();
    console.log('ASC Sample:', dataAsc.slice(0, 3));
    
    // Validate ASC sorting
    let isAscSorted = true;
    for (let i = 0; i < dataAsc.length - 1; i++) {
        // Allow small floating point diffs
        if (dataAsc[i].ef > dataAsc[i+1].ef + 0.001) {
            console.error(`ASC Violation at index ${i}: ${dataAsc[i].ef} > ${dataAsc[i+1].ef}`);
            isAscSorted = false;
            break;
        }
    }
    expect(isAscSorted).toBeTruthy();
    
    // Check specific known items
    // 'ci cd?' (EF 1.3) should be before 'юнит' (EF 2.9)
    const idxHard = dataAsc.findIndex(d => d.text.includes('ci cd?'));
    const idxEasy = dataAsc.findIndex(d => d.text.includes('юнит'));
    expect(idxHard).not.toBe(-1);
    expect(idxEasy).not.toBe(-1);
    expect(idxHard).toBeLessThan(idxEasy);

    // 2. Switch to DESC (Easiest to Hardest: 2.9 -> 1.3)
    await sortBtn.click(); // Asc -> Desc
    await page.waitForTimeout(1000);

    const dataDesc = await getCardsData();
    console.log('DESC Sample:', dataDesc.slice(0, 3));

    // Validate DESC sorting
    let isDescSorted = true;
    for (let i = 0; i < dataDesc.length - 1; i++) {
        if (dataDesc[i].ef < dataDesc[i+1].ef - 0.001) {
             console.error(`DESC Violation at index ${i}: ${dataDesc[i].ef} < ${dataDesc[i+1].ef}`);
             isDescSorted = false;
             break;
        }
    }
    expect(isDescSorted).toBeTruthy();

    // Check specific known items
    // 'юнит' (EF 2.9) should be before 'ci cd?' (EF 1.3)
    const idxHardDesc = dataDesc.findIndex(d => d.text.includes('ci cd?'));
    const idxEasyDesc = dataDesc.findIndex(d => d.text.includes('юнит'));
    expect(idxHardDesc).not.toBe(-1);
    expect(idxEasyDesc).not.toBe(-1);
    expect(idxEasyDesc).toBeLessThan(idxHardDesc);

    // 3. Verify total reversal for equal items
    // Since we can't easily see ID, we check if the arrays are reversed versions of each other
    // (approximately, ignoring minor shifts if EF is unique, but for equal EF they should be reversed)
    const ascTexts = dataAsc.map(d => d.text);
    const descTexts = dataDesc.map(d => d.text);
    
    // Check first and last elements are swapped
    expect(ascTexts[0]).toBe(descTexts[descTexts.length - 1]);
    expect(ascTexts[ascTexts.length - 1]).toBe(descTexts[0]);
  });
});
