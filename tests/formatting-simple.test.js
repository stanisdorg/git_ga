/**
 * @fileoverview Простые тесты для форматирования
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8085';

test.describe('Форматирование - быстрая проверка', () => {
    test('CSS правила для span', async ({ page }) => {
        await page.goto(BASE_URL);
        
        // Логин
        await page.click('.login-main-btn');
        await page.fill('input[name="username"]', 'admin');
        await page.fill('input[name="password"]', 'admin');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);

        // Идём в обучение
        await page.goto(`${BASE_URL}/#/stats`);
        await page.waitForTimeout(1000);
        await page.click('button:has-text("Ежедневная сессия")');
        await page.waitForTimeout(2000);

        // Проверяем CSS
        const cssRules = await page.evaluate(() => {
            const rules = [];
            for (const sheet of document.styleSheets) {
                try {
                    for (const rule of sheet.cssRules) {
                        if (rule.selectorText?.includes('flashcard-content') && 
                            rule.selectorText?.includes('span')) {
                            rules.push({
                                selector: rule.selectorText,
                                display: rule.style.display
                            });
                        }
                    }
                } catch (e) {}
            }
            return rules;
        });

        console.log('CSS правила:', cssRules);
        expect(cssRules.length).toBeGreaterThan(0);
    });

    test('Форматирование в редакторе', async ({ page }) => {
        await page.goto(`${BASE_URL}/#/stats`);
        await page.waitForTimeout(1000);
        await page.click('button:has-text("Ежедневная сессия")');
        await page.waitForTimeout(2000);

        // Открываем редактор
        await page.click('.learn-edit-btn');
        await page.waitForTimeout(1000);

        // Проверяем toolbar
        const toolbar = await page.$('.format-toolbar');
        expect(toolbar).toBeTruthy();

        const colorBtn = await page.$('.format-text-color-btn[data-color="#FF6B6B"]');
        expect(colorBtn).toBeTruthy();

        // Закрываем
        await page.click('#edit-cancel-btn');
        await page.waitForTimeout(500);
    });

    test('Сохранение и отображение форматирования', async ({ page }) => {
        await page.goto(`${BASE_URL}/#/stats`);
        await page.waitForTimeout(1000);
        await page.click('button:has-text("Ежедневная сессия")');
        await page.waitForTimeout(2000);

        // Открываем редактор
        await page.click('.learn-edit-btn');
        await page.waitForTimeout(1000);

        // Выделяем текст в вопросе
        await page.focus('#edit-question-editor');
        await page.evaluate(() => {
            const editor = document.getElementById('edit-question-editor');
            const range = document.createRange();
            const selection = window.getSelection();
            const textNode = editor.childNodes[0];
            if (textNode && textNode.textContent.length >= 5) {
                range.setStart(textNode, 0);
                range.setEnd(textNode, 5);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        });
        await page.waitForTimeout(300);

        // Применяем цвет
        await page.click('.format-text-color-btn[data-color="#FF6B6B"]');
        await page.waitForTimeout(500);

        // Проверяем HTML в редакторе
        const editorHTML = await page.evaluate(() => {
            return document.getElementById('edit-question-editor').innerHTML;
        });
        console.log('Editor HTML:', editorHTML);
        expect(editorHTML).toContain('style="color: #FF6B6B"');

        // Сохраняем
        await page.click('#edit-save-btn');
        await page.waitForTimeout(1500);

        // Проверяем HTML на карточке
        const cardHTML = await page.evaluate(() => {
            return document.getElementById('learn-question')?.innerHTML;
        });
        console.log('Card HTML:', cardHTML);
        expect(cardHTML).toContain('style="color: #FF6B6B"');

        // Проверяем стили span
        const spanStyles = await page.evaluate(() => {
            const questionEl = document.getElementById('learn-question');
            const span = questionEl?.querySelector('span[style*="color"]');
            if (span) {
                const styles = window.getComputedStyle(span);
                return {
                    display: styles.display,
                    color: styles.color
                };
            }
            return null;
        });

        console.log('Стили span на карточке:', spanStyles);
        expect(spanStyles).toBeTruthy();
        expect(spanStyles.display).toBe('inline');
    });
});
