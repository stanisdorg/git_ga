/**
 * ТЕСТ НА ИЗОЛЯЦИЮ ДАННЫХ ПОЛЬЗОВАТЕЛЕЙ
 * 
 * Проверяет что:
 * 1. У каждого пользователя свои карточки
 * 2. Изменения одного пользователя не видны другому
 * 3. Дубликаты создаются только для текущего пользователя
 * 4. При возврате к первому пользователю - все изменения на месте
 */

import { test, expect } from '@playwright/test';

// Тестовые данные
const USER1 = { username: 'testuser1', password: 'test123' };
const USER2 = { username: 'testuser2', password: 'test456' };
const TEST_CARD_QUESTION = 'Тестовая карточка для автотеста';
const TEST_CARD_ANSWER = 'Ответ для автотеста';
const EDITED_CARD_QUESTION = 'ОТРЕДАКТИРОВАНО: Тестовая карточка для автотеста';
const EDITED_CARD_ANSWER = 'ОТРЕДАКТИРОВАНО: Ответ для автотеста';

test.describe('USER ISOLATION TEST', () => {
  
  test.beforeEach(async ({ page }) => {
    // Очищаем localStorage перед каждым тестом
    await page.context().clearCookies();
    await page.goto('http://localhost:8085');
    await page.waitForLoadState('networkidle');
  });

  test('TEST 1: User 1 creates and edits cards', async ({ page }) => {
    console.log('\n=== TEST 1: User 1 creates and edits cards ===\n');
    
    // Login as User 1
    await login(page, USER1);
    await page.waitForTimeout(2000);
    
    // Enable edit mode
    await toggleEditMode(page);
    await page.waitForTimeout(1000);
    
    // Create duplicate of first card
    console.log('Creating duplicate...');
    await duplicateFirstCard(page);
    await page.waitForTimeout(2000);
    
    // Wait for save to complete
    await page.waitForSelector('text=Успешно сохранено', { timeout: 10000 });
    console.log('Duplicate created and saved');
    
    // Edit the duplicate
    console.log('Editing duplicate...');
    await editFirstCard(page, EDITED_CARD_QUESTION, EDITED_CARD_ANSWER);
    await page.waitForTimeout(2000);
    
    // Wait for save to complete
    await page.waitForSelector('text=Успешно сохранено', { timeout: 10000 });
    console.log('Card edited and saved');
    
    // Logout
    await logout(page);
    await page.waitForTimeout(1000);
    
    console.log('=== TEST 1 COMPLETE ===\n');
  });

  test('TEST 2: User 2 should NOT see User 1 changes', async ({ page }) => {
    console.log('\n=== TEST 2: User 2 should NOT see User 1 changes ===\n');
    
    // Login as User 2
    await login(page, USER2);
    await page.waitForTimeout(2000);
    
    // Enable edit mode
    await toggleEditMode(page);
    await page.waitForTimeout(1000);
    
    // Check that User 2 does NOT see the test card
    console.log('Checking that User 2 does NOT see test card...');
    const pageContent = await page.content();
    
    expect(pageContent).not.toContain(TEST_CARD_QUESTION);
    expect(pageContent).not.toContain(EDITED_CARD_QUESTION);
    console.log('✓ User 2 does NOT see User 1 cards');
    
    // Count cards for User 2
    const cardCount = await countCards(page);
    console.log(`User 2 has ${cardCount} cards`);
    
    // Logout
    await logout(page);
    await page.waitForTimeout(1000);
    
    console.log('=== TEST 2 COMPLETE ===\n');
  });

  test('TEST 3: User 1 returns and changes are still there', async ({ page }) => {
    console.log('\n=== TEST 3: User 1 returns and changes are still there ===\n');
    
    // Login as User 1
    await login(page, USER1);
    await page.waitForTimeout(2000);
    
    // Enable edit mode
    await toggleEditMode(page);
    await page.waitForTimeout(1000);
    
    // Check that User 1 sees the edited card
    console.log('Checking that User 1 sees edited card...');
    const pageContent = await page.content();
    
    expect(pageContent).toContain(EDITED_CARD_QUESTION);
    console.log('✓ User 1 sees edited card');
    
    // Count cards for User 1
    const cardCount = await countCards(page);
    console.log(`User 1 has ${cardCount} cards (should be more than base)`);
    
    // Logout
    await logout(page);
    await page.waitForTimeout(1000);
    
    console.log('=== TEST 3 COMPLETE ===\n');
  });

  test('TEST 4: Full isolation test - both users simultaneously', async ({ page, browser }) => {
    console.log('\n=== TEST 4: Full isolation test ===\n');
    
    // Create two browser contexts (completely isolated)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    try {
      // Login User 1 in context 1
      console.log('Logging in User 1...');
      await page1.goto('http://localhost:8085');
      await page1.waitForLoadState('networkidle');
      await login(page1, USER1);
      await page1.waitForTimeout(2000);
      
      // Login User 2 in context 2
      console.log('Logging in User 2...');
      await page2.goto('http://localhost:8085');
      await page2.waitForLoadState('networkidle');
      await login(page2, USER2);
      await page2.waitForTimeout(2000);
      
      // User 1 creates a card
      console.log('User 1 creating card...');
      await toggleEditMode(page1);
      await duplicateFirstCard(page1);
      await page1.waitForTimeout(2000);
      await page1.waitForSelector('text=Успешно сохранено', { timeout: 10000 });
      
      // User 2 refreshes and checks
      console.log('User 2 checking for User 1 card...');
      await page2.reload();
      await page2.waitForLoadState('networkidle');
      await page2.waitForTimeout(2000);
      
      const page2Content = await page2.content();
      expect(page2Content).not.toContain(TEST_CARD_QUESTION);
      console.log('✓ User 2 does NOT see User 1 card');
      
      // User 1 refreshes and checks
      console.log('User 1 checking own card...');
      await page1.reload();
      await page1.waitForLoadState('networkidle');
      await page1.waitForTimeout(2000);
      
      const page1Content = await page1.content();
      expect(page1Content).toContain(TEST_CARD_QUESTION);
      console.log('✓ User 1 sees own card');
      
      console.log('=== TEST 4 COMPLETE ===\n');
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function login(page, user) {
  console.log(`Logging in as ${user.username}...`);
  
  // Click login button
  await page.click('button:has-text("Войти")');
  await page.waitForTimeout(500);
  
  // Enter credentials
  await page.fill('input[placeholder="Логин"]', user.username);
  await page.fill('input[placeholder="Пароль"]', user.password);
  
  // Submit
  await page.click('button:has-text("Войти")');
  await page.waitForTimeout(1000);
  
  console.log(`Logged in as ${user.username}`);
}

async function logout(page) {
  console.log('Logging out...');
  
  // Click logout button
  const logoutBtn = page.locator('button:has-text("Выйти")').first();
  await logoutBtn.click();
  await page.waitForTimeout(1000);
  
  console.log('Logged out');
}

async function toggleEditMode(page) {
  console.log('Toggling edit mode...');
  
  const editBtn = page.locator('button:has-text("✎")').first();
  await editBtn.click();
  await page.waitForTimeout(500);
  
  console.log('Edit mode toggled');
}

async function duplicateFirstCard(page) {
  console.log('Duplicating first card...');
  
  // Find first kebab menu button
  const kebabBtn = page.locator('button.kebab-menu-btn').first();
  await kebabBtn.click();
  await page.waitForTimeout(500);
  
  // Click duplicate
  await page.click('button:has-text("Дублировать")');
  await page.waitForTimeout(500);
  
  console.log('Card duplicated');
}

async function editFirstCard(page, newQuestion, newAnswer) {
  console.log('Editing first card...');
  
  // Find first kebab menu button
  const kebabBtn = page.locator('button.kebab-menu-btn').first();
  await kebabBtn.click();
  await page.waitForTimeout(500);
  
  // Click edit
  await page.click('button:has-text("Редактировать")');
  await page.waitForTimeout(1000);
  
  // Fill new content
  await page.fill('textarea.edit-question', newQuestion);
  await page.fill('textarea.edit-answer', newAnswer);
  await page.waitForTimeout(500);
  
  // Save
  await page.click('button:has-text("Сохранить")');
  await page.waitForTimeout(500);
  
  console.log('Card edited');
}

async function countCards(page) {
  const cards = page.locator('.result-item');
  const count = await cards.count();
  return count;
}
