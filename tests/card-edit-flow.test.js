/**
 * E2E тест для воспроизведения проблемы с обновлением UI после редактирования карточки
 * 
 * Проблема:
 * 1. В режиме обучения редактирую карточку (цвет, текст)
 * 2. Сохраняю
 * 3. Выхожу из режима обучения
 * 4. Попадаю на страницу статистики
 * 5. Перехожу на главную
 * 6. Не вижу изменений на карточке - вижу только после перезагрузки страницы
 * 
 * Ожидаемое поведение: Изменения должны быть видны сразу после возврата на главную страницу
 * 
 * ЗАПУСК ТЕСТА:
 * 1. Запустите сервер: node server.js
 * 2. Откройте http://localhost:8765 в браузере
 * 3. Пройдите сценарий вручную или используйте Playwright:
 *    npx playwright test tests/card-edit-flow.test.js --headed
 */

import { test, expect } from '@playwright/test';

// Тестовые данные
const TEST_USERNAME = 'autotest_user';
const TEST_PASSWORD = 'autotest123';
const ORIGINAL_QUESTION = 'Медленный деплой';
const EDITED_QUESTION = 'Медленный деплой [EDITED TEST]';
const EDITED_ANSWER = 'Тестовый ответ с изменением';

test.describe('Card Edit Flow - E2E', () => {
  test.use({
    // Увеличиваем таймаут для долгих тестов
    timeout: 120000,
  });

  test.beforeEach(async ({ page }) => {
    // Переходим на главную страницу
    await page.goto('http://localhost:8765/', { waitUntil: 'networkidle' });
    
    // Логинимся если требуется
    const sessionUser = await page.evaluate(() => localStorage.getItem('qaSessionUser'));
    if (!sessionUser) {
      await page.goto('http://localhost:8765/#/auth');
      await page.fill('input[name="username"]', TEST_USERNAME);
      await page.fill('input[name="password"]', TEST_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForNavigation({ waitUntil: 'networkidle' });
    }
  });

  test('should update UI immediately after card edit', async ({ page }) => {
    console.log('[TEST] Начало теста: редактирование карточки и проверка обновления UI');
    
    // ==========================================
    // ШАГ 1: Переходим в режим обучения
    // ==========================================
    console.log('[TEST] Шаг 1: Переход в режим обучения');
    
    // Открываем статистику (кнопка статистики)
    await page.click('[data-testid="stats-button"], .st-home-btn, button:has-text("Статистика")');
    await page.waitForURL(/.*#.*/);
    
    // Нажимаем кнопку "Продолжить обучение" или аналогичную
    await page.click('[data-testid="continue-learning"], button:has-text("Продолжить"), button:has-text("Обучение")');
    await page.waitForSelector('#learn-container');
    
    console.log('[TEST] Режим обучения активирован');
    
    // ==========================================
    // ШАГ 2: Находим карточку и редактируем её
    // ==========================================
    console.log('[TEST] Шаг 2: Редактирование карточки');
    
    // Ждём загрузки карточки
    await page.waitForSelector('.flashcard-content, #learn-question');
    
    // Проверяем, что карточка существует
    const questionElement = page.locator('#learn-question, .flashcard-content').first();
    await expect(questionElement).toBeVisible();
    
    // Нажимаем кнопку редактирования
    await page.click('.learn-edit-btn, button[title="Редактировать"]');
    await page.waitForSelector('#edit-modal-overlay, .edit-modal');
    
    console.log('[TEST] Модальное окно редактирования открыто');
    
    // ==========================================
    // ШАГ 3: Редактируем текст и цвет
    // ==========================================
    console.log('[TEST] Шаг 3: Внесение изменений (текст и цвет)');
    
    // Редактируем вопрос
    const questionEditor = page.locator('#edit-question-editor');
    await questionEditor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(EDITED_QUESTION);
    
    // Редактируем ответ (если нужно)
    const answerEditor = page.locator('#edit-answer-editor');
    await answerEditor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(EDITED_ANSWER);
    
    // Применяем форматирование/цвет (если есть toolbar)
    const colorButton = page.locator('[data-color], .color-btn, button[title="Цвет"]');
    if (await colorButton.count() > 0) {
      await colorButton.first().click();
      console.log('[TEST] Цвет изменён');
    }
    
    console.log('[TEST] Изменения внесены в редактор');
    
    // ==========================================
    // ШАГ 4: Сохраняем изменения
    // ==========================================
    console.log('[TEST] Шаг 4: Сохранение изменений');
    
    // Логируем состояние localStorage до сохранения
    const localStorageBefore = await page.evaluate(() => {
      return {
        qaUserCards: localStorage.getItem('qaUserCards')?.substring(0, 200),
        qaAdminOverrides: localStorage.getItem('qaAdminOverrides')?.substring(0, 200)
      };
    });
    console.log('[TEST] localStorage до сохранения:', localStorageBefore);
    
    // Нажимаем кнопку сохранения
    await page.click('#edit-save-btn, button:has-text("Сохранить")');
    
    // Ждём закрытия модального окна
    await page.waitForSelector('#edit-modal-overlay', { state: 'hidden' });
    
    console.log('[TEST] Изменения сохранены');
    
    // ==========================================
    // ШАГ 5: Проверяем localStorage после сохранения
    // ==========================================
    console.log('[TEST] Шаг 5: Проверка localStorage после сохранения');
    
    const localStorageAfter = await page.evaluate(() => {
      return {
        qaUserCards: localStorage.getItem('qaUserCards'),
        qaAdminOverrides: localStorage.getItem('qaAdminOverrides'),
        eventDispatched: window.__editEventDispatched
      };
    });
    
    console.log('[TEST] localStorage после сохранения:', {
      qaUserCardsLength: localStorageAfter.qaUserCards?.length,
      qaAdminOverridesLength: localStorageAfter.qaAdminOverrides?.length,
      eventDispatched: localStorageAfter.eventDispatched
    });
    
    // Проверяем, что данные изменились в localStorage
    expect(localStorageAfter.qaUserCards).toContain(EDITED_QUESTION);
    
    // ==========================================
    // ШАГ 6: Выходим из режима обучения
    // ==========================================
    console.log('[TEST] Шаг 6: Выход из режима обучения');
    
    await page.click('#learn-exit-btn, button:has-text("Выход")');
    
    // ==========================================
    // ШАГ 7: Попадаем на страницу статистики
    // ==========================================
    console.log('[TEST] Шаг 7: Проверка страницы статистики');
    
    await page.waitForSelector('#stats-container, .st-wrapper');
    await expect(page.locator('#stats-container')).toBeVisible();
    
    console.log('[TEST] Страница статистики отображается');
    
    // ==========================================
    // ШАГ 8: Переходим на главную страницу
    // ==========================================
    console.log('[TEST] Шаг 8: Переход на главную страницу');
    
    // Переходим на главную (хэш #/ или кнопка "Домой")
    await page.evaluate(() => {
      window.location.hash = '#/';
    });
    
    // ИЛИ кликаем на кнопку "Домой"
    // await page.click('[data-testid="home-button"], button:has-text("Главная"), .st-home-btn');
    
    // Ждём загрузки главной страницы
    await page.waitForSelector('.search-container, #results-list');
    
    console.log('[TEST] Главная страница загружена');
    
    // ==========================================
    // ШАГ 9: ПРОВЕРКА - видны ли изменения?
    // ==========================================
    console.log('[TEST] Шаг 9: ПРОВЕРКА - поиск изменённой карточки');
    
    // Ищем карточку с изменённым вопросом
    const editedCard = page.locator(`text=${EDITED_QUESTION}`);
    const originalCard = page.locator(`text=${ORIGINAL_QUESTION}`);
    
    // Делаем скриншот для отладки
    await page.screenshot({ path: 'test-screenshots/card-edit-check.png' });
    
    // Логируем содержимое results-list
    const resultsListContent = await page.locator('#results-list').textContent();
    console.log('[TEST] Содержимое results-list:', resultsListContent?.substring(0, 500));
    
    // ==========================================
    // АССЕРТЫ
    // ==========================================
    
    // Изменённая карточка должна быть видна
    await expect(editedCard).toBeVisible({ timeout: 5000 });
    
    // ИЛИ (если карточка в списке) проверяем что она обновилась
    const isEditedVisible = await editedCard.count() > 0;
    const isOriginalVisible = await originalCard.count() > 0;
    
    console.log('[TEST] Результаты проверки:', {
      isEditedVisible,
      isOriginalVisible,
      editedCount: await editedCard.count(),
      originalCount: await originalCard.count()
    });
    
    // Основное утверждение: изменённая карточка должна отображаться
    expect(isEditedVisible).toBeTruthy();
    
    console.log('[TEST] Тест успешно пройден - UI обновился сразу после редактирования');
  });

  test('should verify data flow on page reload', async ({ page }) => {
    /**
     * Контрольный тест: проверяем, что после перезагрузки страницы изменения видны
     * Это должен passing тест, чтобы убедиться что данные вообще сохраняются
     */
    console.log('[TEST] Контрольный тест: проверка после перезагрузки');
    
    // Перезгружаем страницу
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Ищем изменённую карточку
    const editedCard = page.locator(`text=${EDITED_QUESTION}`);
    await expect(editedCard).toBeVisible({ timeout: 10000 });
    
    console.log('[TEST] После перезагрузки изменения видны - данные сохраняются корректно');
  });
});
