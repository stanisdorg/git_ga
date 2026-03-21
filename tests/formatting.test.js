/**
 * @fileoverview Тесты для форматирования текста в карточках
 */

const { test, expect, describe, beforeAll, afterAll } = require('@playwright/test');
const path = require('path');

const BASE_URL = 'http://localhost:8085';

describe('Форматирование текста в карточках', () => {
    let page;

    beforeAll(async ({ browser }) => {
        page = await browser.newPage();
        await page.goto(BASE_URL);
        
        // Логин
        await page.click('.login-main-btn');
        await page.fill('input[name="username"]', 'admin');
        await page.fill('input[name="password"]', 'admin');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(1000);
    });

    afterAll(async () => {
        await page?.close();
    });

    test('1. text-formatter.js: applyFormatting генерирует правильный HTML', async () => {
        const result = await page.evaluate(() => {
            // Импортируем функцию напрямую
            return {
                test1: window.applyFormatting?.('Привет мир', [
                    { start: 0, end: 6, color: '#FF6B6B' }
                ]),
                test2: window.applyFormatting?.('Привет мир', [
                    { start: 0, end: 6, color: '#FF6B6B' },
                    { start: 7, end: 10, bold: true }
                ]),
                test3: window.applyFormatting?.('Тест', [])
            };
        });

        console.log('applyFormatting результаты:', result);

        expect(result.test1).toContain('style="color: #FF6B6B"');
        expect(result.test3).toBe('Тест');
    });

    test('2. Редактор: форматирование применяется в редакторе', async () => {
        // Открываем обучение
        await page.goto(`${BASE_URL}/#/stats`);
        await page.waitForTimeout(500);
        await page.click('button:has-text("Ежедневная сессия")');
        await page.waitForTimeout(1000);

        // Открываем редактор
        await page.click('.learn-edit-btn');
        await page.waitForTimeout(500);

        // Проверяем, что редактор существует
        const questionEditor = await page.$('#edit-question-editor');
        const answerEditor = await page.$('#edit-answer-editor');
        
        expect(questionEditor).toBeTruthy();
        expect(answerEditor).toBeTruthy();

        // Выделяем текст в вопросе
        await page.focus('#edit-question-editor');
        await page.evaluate(() => {
            const editor = document.getElementById('edit-question-editor');
            const range = document.createRange();
            const selection = window.getSelection();
            
            // Получаем текст и выделяем первые 5 символов
            const textNode = editor.childNodes[0];
            if (textNode && textNode.textContent.length >= 5) {
                range.setStart(textNode, 0);
                range.setEnd(textNode, 5);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        });

        await page.waitForTimeout(300);

        // Нажимаем кнопку цвета
        const colorBtn = await page.$('.format-text-color-btn[data-color="#FF6B6B"]');
        expect(colorBtn).toBeTruthy();
        await colorBtn.click();
        await page.waitForTimeout(500);

        // Проверяем, что HTML изменился
        const innerHTML = await page.evaluate(() => {
            return document.getElementById('edit-question-editor').innerHTML;
        });

        console.log('Editor innerHTML после форматирования:', innerHTML);
        expect(innerHTML).toContain('style="color: #FF6B6B"');

        // Закрываем редактор без сохранения
        await page.click('#edit-cancel-btn');
        await page.waitForTimeout(300);
    });

    test('3. Карточка: форматирование отображается на лицевой стороне', async () => {
        // Сохраняем карточку с форматированием
        await page.click('.learn-edit-btn');
        await page.waitForTimeout(500);

        // Выделяем текст
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

        // Сохраняем
        await page.click('#edit-save-btn');
        await page.waitForTimeout(1000);

        // Проверяем, что форматирование есть в session.currentCard
        const cardFormatting = await page.evaluate(() => {
            return window.session?.currentCard?.formatting;
        });

        console.log('Форматирование карточки:', cardFormatting);
        expect(cardFormatting?.question).toBeTruthy();
        expect(cardFormatting.question.length).toBeGreaterThan(0);

        // Проверяем HTML вопроса
        const questionHTML = await page.evaluate(() => {
            return document.getElementById('learn-question')?.innerHTML;
        });

        console.log('HTML вопроса на карточке:', questionHTML);
        expect(questionHTML).toContain('style="color: #FF6B6B"');

        // Проверяем вычисленные стили для span
        const spanStyles = await page.evaluate(() => {
            const questionEl = document.getElementById('learn-question');
            const span = questionEl?.querySelector('span[style*="color"]');
            if (span) {
                const styles = window.getComputedStyle(span);
                return {
                    display: styles.display,
                    color: styles.color,
                    visibility: styles.visibility
                };
            }
            return null;
        });

        console.log('Стили span:', spanStyles);
        expect(spanStyles).toBeTruthy();
        expect(spanStyles.display).toBe('inline');
    });

    test('4. Карточка: форматирование отображается на обратной стороне', async () => {
        // Переворачиваем карточку
        await page.click('.flashcard');
        await page.waitForTimeout(600);

        // Проверяем HTML ответа
        const answerHTML = await page.evaluate(() => {
            return document.getElementById('learn-answer')?.innerHTML;
        });

        console.log('HTML ответа на карточке:', answerHTML);

        // Проверяем стили
        const answerSpanStyles = await page.evaluate(() => {
            const answerEl = document.getElementById('learn-answer');
            const span = answerEl?.querySelector('span[style]');
            if (span) {
                const styles = window.getComputedStyle(span);
                return {
                    display: styles.display,
                    visibility: styles.visibility
                };
            }
            return null;
        });

        console.log('Стили span на ответе:', answerSpanStyles);
        expect(answerSpanStyles).toBeTruthy();
        expect(answerSpanStyles.display).toBe('inline');
    });

    test('5. CSS: проверка правил для .flashcard-content span', async () => {
        const cssRules = await page.evaluate(() => {
            const rules = [];
            for (const sheet of document.styleSheets) {
                try {
                    for (const rule of sheet.cssRules) {
                        if (rule.selectorText?.includes('flashcard-content') && 
                            rule.selectorText?.includes('span')) {
                            rules.push({
                                selector: rule.selectorText,
                                display: rule.style.display,
                                cssText: rule.cssText.substring(0, 200)
                            });
                        }
                    }
                } catch (e) {
                    // CORS
                }
            }
            return rules;
        });

        console.log('CSS правила для span:', cssRules);
        
        // Должно быть правило с display: inline
        const hasInlineRule = cssRules.some(r => 
            r.selectorText.includes('span') && 
            r.display === 'inline'
        );
        
        expect(hasInlineRule).toBe(true);
    });

    test('6. DOM: проверка структуры .flashcard-front .flashcard-content', async () => {
        const domStructure = await page.evaluate(() => {
            const front = document.querySelector('.flashcard-front');
            const content = document.querySelector('.flashcard-front .flashcard-content');
            
            return {
                frontExists: !!front,
                contentExists: !!content,
                frontDisplay: front ? window.getComputedStyle(front).display : null,
                frontFlexDirection: front ? window.getComputedStyle(front).flexDirection : null,
                contentDisplay: content ? window.getComputedStyle(content).display : null,
                contentChildren: content ? content.children.length : 0,
                contentInnerHTML: content ? content.innerHTML.substring(0, 200) : null
            };
        });

        console.log('DOM структура:', domStructure);
        
        expect(domStructure.frontExists).toBe(true);
        expect(domStructure.contentExists).toBe(true);
        expect(domStructure.contentDisplay).toBe('block');
    });
});
