/**
 * АВТОТЕСТ: Проверка навигации между страницами
 * Проверяет все сценарии перехода между Обучение ↔ Статистика ↔ Главная
 */

(function() {
    console.log('========================================');
    console.log('[NAV TEST] ========== START NAVIGATION TEST ==========');
    console.log('[NAV TEST] Timestamp:', new Date().toISOString());
    console.log('========================================');

    const TEST_RESULTS = [];
    let currentStep = 0;

    function log(message) {
        console.log('[NAV TEST]', message);
    }

    function assert(condition, message) {
        const result = {
            step: currentStep,
            condition: condition,
            message: message,
            passed: !!condition,
            timestamp: new Date().toISOString()
        };
        TEST_RESULTS.push(result);
        log(result.passed ? '✅ PASS' : '❌ FAIL', '-', message);
        if (!result.passed) {
            log('  Expected:', condition);
        }
        return result.passed;
    }

    function getElement(selector) {
        return document.querySelector(selector);
    }

    function isVisible(selector) {
        const el = getElement(selector);
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }

    function clickElement(selector) {
        const el = getElement(selector);
        if (el) {
            el.click();
            log('Clicked:', selector);
            return true;
        }
        log('❌ Element not found:', selector);
        return false;
    }

    function waitFor(conditionFn, timeout = 3000) {
        return new Promise((resolve) => {
            const start = Date.now();
            const check = () => {
                if (conditionFn()) {
                    resolve(true);
                } else if (Date.now() - start > timeout) {
                    resolve(false);
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    async function runTest() {
        log('========================================');
        log('[NAV TEST] Step 1: Check initial state');
        currentStep = 1;
        
        // Ждём загрузки страницы
        await waitFor(() => getElement('#results-list'), 5000);
        await new Promise(r => setTimeout(r, 1000));
        
        assert(
            isVisible('.container'),
            'Main container should be visible initially'
        );
        assert(
            !isVisible('#stats-container'),
            'Stats container should be hidden initially'
        );
        assert(
            !getElement('#learn-container') || !isVisible('#learn-container'),
            'Learn container should be hidden initially'
        );

        log('========================================');
        log('[NAV TEST] Step 2: Start training from main page');
        currentStep = 2;
        
        // Находим и нажимаем кнопку "▶ Продолжить" или аналогичную
        const continueBtn = getElement('#st-continue-btn') || 
                           getElement('button[title*="Продолжить"]') ||
                           getElement('button[class*="btn-primary"]');
        
        if (continueBtn) {
            log('Found continue button');
            // Не нажимаем автоматически - пользователь должен сам пройти обучение
            log('[NAV TEST] ⚠️  USER ACTION REQUIRED: Complete training manually');
            log('[NAV TEST] ⚠️  After training, click "📊 Статистика" button');
        } else {
            log('❌ Continue button not found');
        }

        log('========================================');
        log('[NAV TEST] Step 3: Check training state');
        currentStep = 3;
        
        // Эти проверки пользователь должен запустить вручную после начала обучения
        window.navTestCheckTraining = function() {
            log('========================================');
            log('[NAV TEST] Manual check: Training state');
            
            assert(
                !isVisible('.container'),
                'Main container should be hidden during training'
            );
            assert(
                isVisible('#learn-container'),
                'Learn container should be visible during training'
            );
            assert(
                document.body.classList.contains('learning-mode'),
                'Body should have learning-mode class'
            );
        };

        log('========================================');
        log('[NAV TEST] Step 4: Navigate to Stats from training');
        currentStep = 4;
        
        // Проверка после нажатия на кнопку Статистика
        window.navTestCheckStatsFromTraining = function() {
            log('========================================');
            log('[NAV TEST] Manual check: Stats from training');
            
            assert(
                !isVisible('#learn-container'),
                'Learn container should be hidden after clicking Stats'
            );
            assert(
                isVisible('#stats-container'),
                'Stats container should be visible'
            );
            assert(
                !document.body.classList.contains('learning-mode'),
                'Body should NOT have learning-mode class'
            );
            assert(
                isVisible('#bottom-nav'),
                'Bottom navigation should be visible'
            );
        };

        log('========================================');
        log('[NAV TEST] Step 5: Navigate to Home from Stats');
        currentStep = 5;
        
        // Проверка после нажатия на кнопку Главная
        window.navTestCheckHomeFromStats = function() {
            log('========================================');
            log('[NAV TEST] Manual check: Home from Stats');
            
            assert(
                !isVisible('#stats-container'),
                'Stats container should be hidden'
            );
            assert(
                isVisible('.container'),
                'Main container should be visible'
            );
            assert(
                location.hash === '' || location.hash === '#/' || location.hash === '#',
                'Hash should be empty or #/'
            );
        };

        log('========================================');
        log('[NAV TEST] Instructions:');
        log('1. Click "▶ Продолжить" to start training');
        log('2. Complete 1-2 questions');
        log('3. Click "📊 Статистика" button');
        log('4. Run: window.navTestCheckTraining()');
        log('5. Click "🏠 Главная" button');
        log('6. Run: window.navTestCheckStatsFromTraining()');
        log('7. Wait for page to load');
        log('8. Run: window.navTestCheckHomeFromStats()');
        log('9. Run: window.navTestPrintResults() to see all results');
        log('========================================');

        // Автозапуск первой проверки через 2 секунды
        setTimeout(() => {
            log('[NAV TEST] Initial checks complete. Run manual checks as instructed.');
        }, 2000);
    }

    window.navTestPrintResults = function() {
        console.log('========================================');
        console.log('[NAV TEST] ========== TEST RESULTS ==========');
        const passed = TEST_RESULTS.filter(r => r.passed).length;
        const failed = TEST_RESULTS.filter(r => !r.passed).length;
        console.log(`[NAV TEST] Total: ${TEST_RESULTS.length}, Passed: ${passed}, Failed: ${failed}`);
        
        if (failed > 0) {
            console.log('[NAV TEST] ❌ FAILED TESTS:');
            TEST_RESULTS.filter(r => !r.passed).forEach(r => {
                console.log(`  Step ${r.step}: ${r.message}`);
            });
        } else {
            console.log('[NAV TEST] ✅ ALL TESTS PASSED!');
        }
        console.log('========================================');
        
        return { total: TEST_RESULTS.length, passed, failed };
    };

    // Запуск теста
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runTest);
    } else {
        runTest();
    }

    console.log('[NAV TEST] Test loaded. Run window.navTestPrintResults() to see results.');
    console.log('========================================');
})();
