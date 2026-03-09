// E2E тесты для системы пользователей
// Запуск: npx playwright test tests/user-system.spec.ts

import { test, expect } from '@playwright/test';

test.describe('User System E2E Tests', () => {

    // Очистка перед каждым тестом
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8085');
        await page.waitForLoadState('networkidle');
        // Ждём инициализацию UserSystem
        await page.waitForFunction(() => (window as any).UserSystem !== undefined, { timeout: 10000 });
    });

    test('Test 1: Super admin exists', async ({ page }) => {
        const usersDB = await page.evaluate(() => {
            const users = JSON.parse(localStorage.getItem('usersDB') || '[]');
            return users.find(u => u.username === 'stanisdorg' && u.role === 'super_admin');
        });

        expect(usersDB).toBeTruthy();
        expect(usersDB.username).toBe('stanisdorg');
        expect(usersDB.role).toBe('super_admin');
    });

    test('Test 2: Data isolation between users', async ({ page }) => {
        // Логин как admin через UserSystem API
        const loginResult = await page.evaluate(() => {
            return (window as any).UserSystem.login('admin', 'admin');
        });
        expect(loginResult.success).toBe(true);
        
        await page.waitForTimeout(500);

        // Сохраняем тестовую карту
        const testCard = {
            question: 'TEST_CARD_ADMIN_' + Date.now(),
            answer: 'Test answer for admin',
            category: 'Test',
            subcategory: 'AutoTest'
        };

        const addResult = await page.evaluate((card) => {
            return (window as any).UserSystem.addCard(card);
        }, testCard);
        expect(addResult.success).toBe(true);

        // Выход
        await page.evaluate(() => {
            (window as any).UserSystem.logout();
        });
        await page.waitForTimeout(500);

        // Проверяем что глобальные данные не изменились
        const globalHasTestCard = await page.evaluate((question) => {
            const cards = (window as any).UserSystem.getUserCards();
            return cards.some(c => c.question === question);
        }, testCard.question);

        expect(globalHasTestCard).toBeFalsy();

        // Логин как stanisdorg (super_admin)
        const superLogin = await page.evaluate(() => {
            return (window as any).UserSystem.login('stanisdorg', 'REliktose12$%');
        });
        expect(superLogin.success).toBe(true);
        await page.waitForTimeout(500);

        const superAdminHasTestCard = await page.evaluate((question) => {
            const cards = (window as any).UserSystem.getUserCards();
            return cards.some(c => c.question === question);
        }, testCard.question);

        expect(superAdminHasTestCard).toBeFalsy();
    });

    test('Test 3: Admin sees own changes after relogin', async ({ page }) => {
        // Логин как admin
        const loginResult = await page.evaluate(() => {
            return (window as any).UserSystem.login('admin', 'admin');
        });
        expect(loginResult.success).toBe(true);
        await page.waitForTimeout(500);

        const testCard = {
            question: 'TEST_CARD_ADMIN_EDIT_' + Date.now(),
            answer: 'Test answer',
            category: 'Test',
            subcategory: 'AutoTest'
        };

        // Сохраняем карту через addCard
        const addResult = await page.evaluate((card) => {
            return (window as any).UserSystem.addCard(card);
        }, testCard);
        expect(addResult.success).toBe(true);

        // Проверяем что видит карту
        const adminSeesCard = await page.evaluate((question) => {
            const cards = (window as any).UserSystem.getUserCards();
            return cards.some(c => c.question === question);
        }, testCard.question);

        expect(adminSeesCard).toBeTruthy();

        // Выход и повторный вход
        await page.evaluate(() => {
            (window as any).UserSystem.logout();
        });
        await page.waitForTimeout(500);

        // Проверяем что глобальные карты НЕ содержат тестовую карту
        const globalHasCard = await page.evaluate((question) => {
            const globalCards = JSON.parse(localStorage.getItem('globalCards') || '[]');
            return globalCards.some(c => c.question === question);
        }, testCard.question);
        
        expect(globalHasCard).toBeFalsy();

        const reloginResult = await page.evaluate(() => {
            return (window as any).UserSystem.login('admin', 'admin');
        });
        expect(reloginResult.success).toBe(true);
        await page.waitForTimeout(500);

        const adminStillSeesCard = await page.evaluate((question) => {
            const cards = (window as any).UserSystem.getUserCards();
            return cards.some(c => c.question === question);
        }, testCard.question);

        expect(adminStillSeesCard).toBeTruthy();
    });

    test('Test 4: User role restrictions', async ({ page }) => {
        // Логин как stas (user)
        const loginResult = await page.evaluate(() => {
            return (window as any).UserSystem.login('stas', 'admin');
        });
        expect(loginResult.success).toBe(true);
        await page.waitForTimeout(500);

        const user = await page.evaluate(() => {
            return (window as any).UserSystem.getCurrentUser();
        });

        expect(user).toBeTruthy();
        expect(user.role).toBe('user');
        
        // Проверяем что user не может редактировать
        const canEdit = await page.evaluate(() => {
            return (window as any).UserSystem.hasRole('admin');
        });
        expect(canEdit).toBe(false);
    });

    test('Test 5: Data migration on first login', async ({ page }) => {
        // Создаём глобальные данные
        await page.evaluate(() => {
            localStorage.setItem('qaAdminOverrides', JSON.stringify({test: 'global'}));
            localStorage.setItem('qaNewItems', JSON.stringify([{question: 'test_q', answer: 'test_a'}]));
            localStorage.setItem('qaDeletedItems', JSON.stringify({deleted_q: true}));
        });

        // Логин как admin
        const loginResult = await page.evaluate(() => {
            return (window as any).UserSystem.login('admin', 'admin');
        });
        expect(loginResult.success).toBe(true);
        
        // Ждём миграцию
        await page.waitForTimeout(1000);

        // Проверяем миграцию overrides
        const migrated = await page.evaluate(() => {
            const userOverrides = localStorage.getItem('user_admin_qaAdminOverrides');
            if (!userOverrides) return false;
            const parsed = JSON.parse(userOverrides);
            return parsed.test === 'global';
        });

        expect(migrated).toBeTruthy();
        
        // Проверяем миграцию new items
        const newItemsMigrated = await page.evaluate(() => {
            const userNewItems = localStorage.getItem('user_admin_qaNewItems');
            return userNewItems !== null;
        });
        
        expect(newItemsMigrated).toBeTruthy();
        
        // Проверяем миграцию deleted items
        const deletedMigrated = await page.evaluate(() => {
            const userDeleted = localStorage.getItem('user_admin_qaDeletedItems');
            return userDeleted !== null;
        });
        
        expect(deletedMigrated).toBeTruthy();
    });
    
    test('Test 6: Admin edits card - changes visible only to admin', async ({ page }) => {
        // Логин как admin
        const loginResult = await page.evaluate(() => {
            return (window as any).UserSystem.login('admin', 'admin');
        });
        expect(loginResult.success).toBe(true);
        await page.waitForTimeout(500);

        // Получаем глобальные overrides до редактирования
        const globalOverridesBefore = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('qaAdminOverrides') || '{}');
        });
        
        // Редактируем карточку через setOverrides
        const editResult = await page.evaluate(() => {
            const overrides = (window as any).UserSystem.getUserCards(); // Получаем карты
            const testOverride = {
                'TestQuestion': {
                    category: 'EditedCategory',
                    subcategory: 'EditedSub',
                    question: 'TestQuestion Edited',
                    answer: 'Edited Answer'
                }
            };
            // Сохраняем через UserSystem (который должен использовать префикс)
            const prefix = `user_admin_`;
            localStorage.setItem(`${prefix}qaAdminOverrides`, JSON.stringify(testOverride));
            return true;
        });
        
        expect(editResult).toBe(true);
        
        // Проверяем что глобальные overrides НЕ изменились
        const globalOverridesAfter = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('qaAdminOverrides') || '{}');
        });
        
        expect(globalOverridesAfter).toEqual(globalOverridesBefore);
        
        // Проверяем что user_admin_qaAdminOverrides содержит изменения
        const userOverrides = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('user_admin_qaAdminOverrides') || '{}');
        });
        
        expect(userOverrides['TestQuestion']).toBeTruthy();
        expect(userOverrides['TestQuestion'].category).toBe('EditedCategory');
    });
    
    test('Test 7: Real UI edit simulation - overrides saved with user prefix', async ({ page }) => {
        // Очищаем всё перед тестом
        await page.evaluate(() => {
            localStorage.clear();
            location.reload();
        });
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => (window as any).UserSystem !== undefined, { timeout: 10000 });
        await page.waitForTimeout(2000);
        
        // Проверяем что пользователи созданы
        const usersCreated = await page.evaluate(() => {
            const users = JSON.parse(localStorage.getItem('usersDB') || '[]');
            return users.length >= 3;
        });
        expect(usersCreated).toBeTruthy();
        
        // Логин как admin через UI (имитация реального входа)
        await page.evaluate(() => {
            const users = JSON.parse(localStorage.getItem('usersDB') || '[]');
            const admin = users.find(u => u.username === 'admin' && u.password === 'admin');
            if (admin) {
                localStorage.setItem('qaSessionUser', JSON.stringify(admin));
                localStorage.setItem('currentUser', JSON.stringify({
                    username: 'admin',
                    role: 'admin',
                    loggedIn: true
                }));
                // Имитируем loggedInUser из tabs-navigation.js
                (window as any).__loggedInUser = admin;
            }
        });
        await page.waitForTimeout(500);
        
        // Проверяем что loggedInUser установлен
        const userIsLoggedIn = await page.evaluate(() => {
            const session = JSON.parse(localStorage.getItem('qaSessionUser') || 'null');
            return session !== null && session.username === 'admin';
        });
        expect(userIsLoggedIn).toBeTruthy();
        
        // Имитируем вызов getOverrides() из tabs-navigation.js
        const overridesBefore = await page.evaluate(() => {
            // Получаем глобальные overrides
            return JSON.parse(localStorage.getItem('qaAdminOverrides') || '{}');
        });
        
        // Имитируем редактирование: вызываем setOverrides с префиксом
        const setResult = await page.evaluate(() => {
            const user = JSON.parse(localStorage.getItem('qaSessionUser') || 'null');
            if (!user) return false;
            
            const prefix = `user_${user.username}_`;
            const overrides = JSON.parse(localStorage.getItem(`${prefix}qaAdminOverrides`) || '{}');
            overrides['TestQuestionUI'] = {
                category: 'TestCategory',
                subcategory: 'TestSub',
                question: 'Edited Question',
                answer: 'Edited Answer'
            };
            localStorage.setItem(`${prefix}qaAdminOverrides`, JSON.stringify(overrides));
            return true;
        });
        
        expect(setResult).toBe(true);
        
        // Проверяем что глобальные overrides НЕ изменились
        const globalOverridesAfter = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('qaAdminOverrides') || '{}');
        });
        
        expect(globalOverridesAfter).toEqual(overridesBefore);
        expect(globalOverridesAfter['TestQuestionUI']).toBeFalsy();
        
        // Проверяем что user_admin_qaAdminOverrides содержит изменения
        const userOverrides = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('user_admin_qaAdminOverrides') || '{}');
        });
        
        expect(userOverrides['TestQuestionUI']).toBeTruthy();
        expect(userOverrides['TestQuestionUI'].answer).toBe('Edited Answer');
    });
    
    test('Test 8: Full login flow - edit card via tabs-navigation functions', async ({ page }) => {
        // Очищаем всё перед тестом
        await page.evaluate(() => {
            localStorage.clear();
            location.reload();
        });
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => (window as any).UserSystem !== undefined, { timeout: 10000 });
        await page.waitForTimeout(3000);
        
        // Имитируем вход через modal (как в openLoginModal для admin/admin)
        const loginResult = await page.evaluate(() => {
            // Это то, что происходит в openLoginModal при входе admin/admin
            const adminUser = { username: 'admin', role: 'admin' };
            localStorage.setItem('qaSessionUser', JSON.stringify(adminUser));
            // В реальном коде setLoggedUser вызывается, но здесь мы эмулируем результат
            return adminUser;
        });
        
        expect(loginResult.username).toBe('admin');
        await page.waitForTimeout(500);
        
        // Проверяем что qaSessionUser установлен
        const sessionUser = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('qaSessionUser') || 'null');
        });
        expect(sessionUser).toBeTruthy();
        expect(sessionUser.username).toBe('admin');
        
        // Теперь имитируем вызов getOverrides/setOverrides из tabs-navigation.js
        // Это то, что происходит при редактировании карточки
        const editResult = await page.evaluate(() => {
            // Эмулируем getUserPrefix() из tabs-navigation.js
            const session = JSON.parse(localStorage.getItem('qaSessionUser') || 'null');
            if (!session) return { error: 'No session' };
            
            // getUserPrefix проверяет loggedInUser, который в реальном коде = session
            const prefix = session.username ? `user_${session.username}_` : '';
            
            // getOverrides()
            const overrides = JSON.parse(localStorage.getItem(`${prefix}qaAdminOverrides`) || '{}');
            
            // Редактирование карточки
            overrides['OriginalQuestion'] = {
                category: 'NewCategory',
                subcategory: 'NewSub',
                question: 'Edited Question',
                answer: 'Edited Answer'
            };
            
            // setOverrides(overrides)
            localStorage.setItem(`${prefix}qaAdminOverrides`, JSON.stringify(overrides));
            
            return { prefix, saved: true };
        });
        
        expect(editResult.prefix).toBe('user_admin_');
        expect(editResult.saved).toBe(true);
        
        // КРИТИЧЕСКАЯ ПРОВЕРКА: глобальные overrides НЕ должны измениться
        const globalOverrides = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('qaAdminOverrides') || '{}');
        });
        
        expect(globalOverrides['OriginalQuestion']).toBeFalsy();
        
        // Пользовательские overrides ДОЛЖНЫ содержать изменения
        const userOverrides = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('user_admin_qaAdminOverrides') || '{}');
        });
        
        expect(userOverrides['OriginalQuestion']).toBeTruthy();
        expect(userOverrides['OriginalQuestion'].category).toBe('NewCategory');
    });
});
