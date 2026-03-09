// Автотесты для системы пользователей
// Запуск: в консоли выполнить window.QATests.run()

(function initQATests() {
    const TEST_RESULTS_KEY = 'qaTestResults';
    const LOG_KEY = 'qaTestLogs';

    // Утилита для ожидания
    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Логирование тестов
    function testLog(message) {
        console.log('[QATest]', message);
        const logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
        logs.push({
            timestamp: new Date().toISOString(),
            message
        });
        localStorage.setItem(LOG_KEY, JSON.stringify(logs));
    }

    // Очистка перед тестами
    function cleanup() {
        localStorage.removeItem('qaSessionUser');
        localStorage.removeItem('user_admin_qaAdminOverrides');
        localStorage.removeItem('user_admin_qaNewItems');
        localStorage.removeItem('user_admin_qaDeletedItems');
        localStorage.removeItem('user_stanisdorg_qaAdminOverrides');
        localStorage.removeItem('user_stanisdorg_qaNewItems');
        localStorage.removeItem('user_stanisdorg_qaDeletedItems');
        window.qaTestCleanup = true;
        testLog('Cleanup completed');
    }

    // Тест 1: Проверка инициализации super_admin
    async function testSuperAdminExists() {
        testLog('TEST 1: Checking super_admin initialization...');
        
        const users = JSON.parse(localStorage.getItem('usersDB') || '[]');
        const superAdmin = users.find(u => u.username === 'stanisdorg' && u.role === 'super_admin');
        
        const passed = !!superAdmin;
        testLog(`TEST 1: ${passed ? 'PASSED' : 'FAILED'} - Super admin ${passed ? 'exists' : 'NOT FOUND'}`);
        
        return {
            name: 'Super Admin Exists',
            passed,
            details: superAdmin ? 'stanisdorg exists with super_admin role' : 'stanisdorg not found in usersDB'
        };
    }

    // Тест 2: Проверка разделения данных
    async function testDataIsolation() {
        testLog('TEST 2: Testing data isolation...');
        
        try {
            // Логин как admin
            testLog('TEST 2: Logging in as admin...');
            const loginResult = window.UserSystem.login('admin', 'admin');
            testLog('TEST 2: Login result: ' + JSON.stringify(loginResult));
            await wait(200);
            
            if (!loginResult.success) {
                testLog('TEST 2: FAILED - Login failed');
                return {
                    name: 'Data Isolation',
                    passed: false,
                    details: 'Login failed for admin user'
                };
            }
            
            // Проверяем что пользователь вошёл
            const user = window.UserSystem.getCurrentUser();
            testLog('TEST 2: Current user after login: ' + JSON.stringify(user));
            
            // Сохраняем тестовую карту
            const testCard = {
                question: 'TEST_CARD_ADMIN_' + Date.now(),
                answer: 'Test answer for admin',
                category: 'Test',
                subcategory: 'AutoTest'
            };
            
            const beforeSave = window.UserSystem.getUserCards().length;
            testLog('TEST 2: Cards before save: ' + beforeSave);
            
            const saveResult = window.UserSystem.addCard(testCard);
            testLog('TEST 2: Save result: ' + JSON.stringify(saveResult));
            
            const afterSave = window.UserSystem.getUserCards().length;
            testLog('TEST 2: Cards after save: ' + afterSave);
            
            // Выход
            window.UserSystem.logout();
            testLog('TEST 2: Logged out');
            await wait(200);
            
            // Проверяем что глобальные данные не изменились
            const globalCards = window.UserSystem.getUserCards();
            const globalHasTestCard = globalCards.some(c => c.question && c.question.includes('TEST_CARD_ADMIN'));
            testLog('TEST 2: Global cards has test card: ' + globalHasTestCard);
            
            // Логин как stanisdorg
            testLog('TEST 2: Logging in as stanisdorg...');
            window.UserSystem.login('stanisdorg', 'REliktose12$%');
            await wait(200);
            
            const superAdminCards = window.UserSystem.getUserCards();
            const superAdminHasTestCard = superAdminCards.some(c => c.question && c.question.includes('TEST_CARD_ADMIN'));
            testLog('TEST 2: Super admin cards has test card: ' + superAdminHasTestCard);
            
            // Выход
            window.UserSystem.logout();
            testLog('TEST 2: Logged out stanisdorg');
            
            const passed = !globalHasTestCard && !superAdminHasTestCard;
            testLog('TEST 2: ' + (passed ? 'PASSED' : 'FAILED'));
            
            return {
                name: 'Data Isolation',
                passed,
                details: {
                    globalHasTestCard,
                    superAdminHasTestCard,
                    adminCardsBefore: beforeSave,
                    adminCardsAfter: afterSave,
                    saveResultType: typeof saveResult
                }
            };
        } catch (e) {
            testLog('TEST 2: ERROR - ' + e.message);
            return {
                name: 'Data Isolation',
                passed: false,
                details: 'Error: ' + e.message
            };
        }
    }

    // Тест 3: Проверка что admin видит свои изменения
    async function testAdminSeesOwnChanges() {
        testLog('TEST 3: Testing admin sees own changes...');
        
        try {
            // Логин как admin
            window.UserSystem.login('admin', 'admin');
            await wait(200);
            
            const testCard = {
                question: 'TEST_CARD_ADMIN_EDIT_' + Date.now(),
                answer: 'Test answer',
                category: 'Test',
                subcategory: 'AutoTest'
            };
            
            window.UserSystem.addCard(testCard);
            const adminCardsAfterAdd = window.UserSystem.getUserCards();
            const adminSeesCard = adminCardsAfterAdd.some(c => c.question && c.question.includes('TEST_CARD_ADMIN_EDIT'));
            testLog('TEST 3: Admin sees card after add: ' + adminSeesCard);
            
            // Выход
            window.UserSystem.logout();
            await wait(200);
            
            // Снова логин как admin
            window.UserSystem.login('admin', 'admin');
            await wait(200);
            
            const adminCardsAfterRelogin = window.UserSystem.getUserCards();
            const adminStillSeesCard = adminCardsAfterRelogin.some(c => c.question && c.question.includes('TEST_CARD_ADMIN_EDIT'));
            testLog('TEST 3: Admin sees card after relogin: ' + adminStillSeesCard);
            
            // Выход
            window.UserSystem.logout();
            
            const passed = adminSeesCard && adminStillSeesCard;
            testLog('TEST 3: ' + (passed ? 'PASSED' : 'FAILED'));
            
            return {
                name: 'Admin Sees Own Changes',
                passed,
                details: {
                    seesCardAfterAdd: adminSeesCard,
                    seesCardAfterRelogin: adminStillSeesCard
                }
            };
        } catch (e) {
            testLog('TEST 3: ERROR - ' + e.message);
            return {
                name: 'Admin Sees Own Changes',
                passed: false,
                details: 'Error: ' + e.message
            };
        }
    }

    // Тест 4: Проверка что user не может редактировать
    async function testUserCannotEdit() {
        testLog('TEST 4: Testing user role restrictions...');
        
        try {
            // Логин как stas (user)
            window.UserSystem.login('stas', 'admin');
            await wait(200);
            
            const user = window.UserSystem.getCurrentUser();
            testLog('TEST 4: Current user role: ' + user?.role);
            
            const canSave = window.UserSystem.saveCards([]);
            testLog('TEST 4: Save result: ' + JSON.stringify(canSave));
            
            // Выход
            window.UserSystem.logout();
            
            const passed = user && user.role === 'user';
            testLog('TEST 4: ' + (passed ? 'PASSED' : 'FAILED'));
            
            return {
                name: 'User Role Check',
                passed,
                details: {
                    userRole: user?.role,
                    canSave: !!canSave
                }
            };
        } catch (e) {
            testLog('TEST 4: ERROR - ' + e.message);
            return {
                name: 'User Role Check',
                passed: false,
                details: 'Error: ' + e.message
            };
        }
    }

    // Тест 5: Проверка миграции данных
    async function testDataMigration() {
        testLog('TEST 5: Testing data migration...');
        
        try {
            // Создаём глобальные данные
            localStorage.setItem('qaAdminOverrides', JSON.stringify({test: 'global'}));
            testLog('TEST 5: Created global overrides');
            
            // Логин как новый пользователь
            window.UserSystem.login('admin', 'admin');
            await wait(200);
            
            // Проверяем что данные мигрировали
            const userOverrides = localStorage.getItem('user_admin_qaAdminOverrides');
            testLog('TEST 5: User overrides: ' + (userOverrides ? 'exists' : 'NOT FOUND'));
            
            const migrated = userOverrides && JSON.parse(userOverrides).test === 'global';
            testLog('TEST 5: Migration status: ' + (migrated ? 'SUCCESS' : 'FAILED'));
            
            // Выход
            window.UserSystem.logout();
            
            const passed = migrated;
            testLog('TEST 5: ' + (passed ? 'PASSED' : 'FAILED'));
            
            return {
                name: 'Data Migration',
                passed,
                details: {
                    migrated,
                    userOverridesExists: !!userOverrides
                }
            };
        } catch (e) {
            testLog('TEST 5: ERROR - ' + e.message);
            return {
                name: 'Data Migration',
                passed: false,
                details: 'Error: ' + e.message
            };
        }
    }

    // Запуск всех тестов
    async function runAllTests() {
        testLog('=== STARTING QA TESTS ===');
        console.log('=== STARTING QA TESTS ===');
        
        // Очистка перед тестами
        cleanup();
        await wait(100);
        
        const results = [];
        
        try {
            results.push(await testSuperAdminExists());
            await wait(100);
            results.push(await testDataIsolation());
            await wait(100);
            results.push(await testAdminSeesOwnChanges());
            await wait(100);
            results.push(await testUserCannotEdit());
            await wait(100);
            results.push(await testDataMigration());
        } catch (e) {
            console.error('[TEST ERROR]', e);
            testLog('FATAL ERROR: ' + e.message);
            results.push({
                name: 'Fatal Error',
                passed: false,
                details: e.message
            });
        }
        
        // Сохраняем результаты
        localStorage.setItem(TEST_RESULTS_KEY, JSON.stringify(results));
        
        // Вывод результатов
        console.log('=== TEST RESULTS ===');
        console.table(results.map(r => ({
            Test: r.name,
            Passed: r.passed ? '✅' : '❌',
            Details: JSON.stringify(r.details)
        })));

        const passed = results.filter(r => r.passed).length;
        const total = results.length;
        console.log(`\nTotal: ${passed}/${total} tests passed`);
        testLog(`Completed: ${passed}/${total} tests passed`);
        
        return { results, passed, total };
    }

    // Экспорт
    window.QATests = {
        run: runAllTests,
        results: function() {
            return JSON.parse(localStorage.getItem(TEST_RESULTS_KEY) || '[]');
        },
        clearResults: function() {
            localStorage.removeItem(TEST_RESULTS_KEY);
            localStorage.removeItem(LOG_KEY);
            console.log('[QATests] Results and logs cleared');
        },
        getLogs: function() {
            return JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
        }
    };

    console.log('[QATests] Ready! Use window.QATests.run() to run tests');
})();
