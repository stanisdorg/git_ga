/**
 * Автотесты для проверки перехода на страницу статистики из тренировки
 * 
 * Запуск: открыть index.html в браузере и выполнить в консоли:
 * await import('./tests/stats-navigation.test.js')
 */

// ========================================
// УТИЛИТЫ ДЛЯ ТЕСТОВ
// ========================================

function log(message, data = null) {
    const prefix = `[TEST] ${message}`;
    if (data !== null) {
        console.log(prefix, data);
    } else {
        console.log(prefix);
    }
}

function assert(condition, message) {
    if (!condition) {
        console.error(`❌ ASSERT FAILED: ${message}`);
        throw new Error(`Assertion failed: ${message}`);
    }
    console.log(`✅ ${message}`);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// ТЕСТ 1: Проверка существования контейнеров ДО перехода
// ========================================

export async function testContainersBeforeNavigation() {
    log('=== ТЕСТ 1: Контейнеры ДО перехода на статистику ===');
    
    const mainContainer = document.querySelector('.container');
    const learnContainer = document.getElementById('learn-container');
    const statsContainer = document.getElementById('stats-container');
    const sidebar = document.querySelector('.sidebar');
    
    log('mainContainer exists:', !!mainContainer);
    log('learnContainer exists:', !!learnContainer);
    log('statsContainer exists:', !!statsContainer);
    log('sidebar exists:', !!sidebar);
    
    if (mainContainer) {
        log('mainContainer.style.display:', mainContainer.style.display);
        log('mainContainer computed display:', getComputedStyle(mainContainer).display);
    }
    
    if (sidebar) {
        log('sidebar.style.display:', sidebar.style.display);
        log('sidebar computed display:', getComputedStyle(sidebar).display);
    }
    
    return { mainContainer, learnContainer, statsContainer, sidebar };
}

// ========================================
// ТЕСТ 2: Проверка состояния ПОСЛЕ инициализации статистики
// ========================================

export async function testStatsPageInitialization() {
    log('=== ТЕСТ 2: Инициализация страницы статистики ===');
    
    const { initStatsPage } = await import('../srs/stats-ui.js');
    const appVersion = window.currentAppVersion || 'test';
    
    // Вызываем инициализацию
    initStatsPage(appVersion);
    await sleep(100);
    
    // Проверяем результат
    const statsContainer = document.getElementById('stats-container');
    const mainContainer = document.querySelector('.container');
    const sidebar = document.querySelector('.sidebar');
    const learnContainer = document.getElementById('learn-container');
    
    log('После initStatsPage:');
    log('- stats-container exists:', !!statsContainer);
    log('- stats-container.style.display:', statsContainer?.style.display);
    log('- stats-container computed display:', statsContainer ? getComputedStyle(statsContainer).display : 'N/A');
    
    if (mainContainer) {
        log('- mainContainer.style.display:', mainContainer.style.display);
        log('- mainContainer computed display:', getComputedStyle(mainContainer).display);
    }
    
    if (sidebar) {
        log('- sidebar.style.display:', sidebar.style.display);
        log('- sidebar computed display:', getComputedStyle(sidebar).display);
    }
    
    if (learnContainer) {
        log('- learnContainer.style.display:', learnContainer.style.display);
    }
    
    // Ассерты
    assert(statsContainer !== null, 'stats-container должен существовать');
    assert(statsContainer.style.display === 'block', 'stats-container должен быть видимым (display: block)');
    
    if (mainContainer) {
        assert(mainContainer.style.display === 'none', 'mainContainer должен быть скрыт (display: none)');
    }
    
    if (sidebar) {
        assert(sidebar.style.display === 'none', 'sidebar должен быть скрыт (display: none)');
    }
    
    if (learnContainer) {
        assert(learnContainer.style.display === 'none', 'learnContainer должен быть скрыт');
    }
    
    return { statsContainer, mainContainer, sidebar, learnContainer };
}

// ========================================
// ТЕСТ 3: Проверка перехода из режима обучения
// ========================================

export async function testNavigationFromLearnMode() {
    log('=== ТЕСТ 3: Переход на статистику из режима обучения ===');
    
    // Симулируем состояние обучения
    document.body.classList.add('learning-mode');
    const learnContainer = document.getElementById('learn-container');
    if (learnContainer) {
        learnContainer.style.display = 'block';
    }
    
    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) {
        bottomNav.style.display = 'none';
    }
    
    log('До перехода:');
    log('- body.classList.contains("learning-mode"):', document.body.classList.contains('learning-mode'));
    log('- learnContainer.style.display:', learnContainer?.style.display);
    log('- bottomNav.style.display:', bottomNav?.style.display);
    
    // Вызываем инициализацию статистики
    const { initStatsPage } = await import('../srs/stats-ui.js');
    initStatsPage(window.currentAppVersion || 'test');
    await sleep(100);
    
    log('После перехода:');
    log('- body.classList.contains("learning-mode"):', document.body.classList.contains('learning-mode'));
    log('- learnContainer.style.display:', learnContainer?.style.display);
    log('- bottomNav.style.display:', bottomNav?.style.display);
    
    const statsContainer = document.getElementById('stats-container');
    assert(statsContainer !== null, 'stats-container должен существовать после перехода из обучения');
    assert(statsContainer.style.display === 'block', 'stats-container должен быть видимым');
    
    // Очищаем симуляцию
    document.body.classList.remove('learning-mode');
    
    return { statsContainer, learnContainer, bottomNav };
}

// ========================================
// ТЕСТ 4: Проверка hashchange обработчика
// ========================================

export async function testHashChangeHandler() {
    log('=== ТЕСТ 4: Обработчик hashchange для #/stats ===');
    
    // Сохраняем текущий hash
    const originalHash = location.hash;
    
    // Очищаем статистику если есть
    const existingStats = document.getElementById('stats-container');
    if (existingStats) {
        existingStats.remove();
    }
    
    // Показываем main container
    const mainContainer = document.querySelector('.container');
    if (mainContainer) {
        mainContainer.style.display = 'block';
    }
    
    // Меняем hash на статистику
    location.hash = '#/stats';
    await sleep(200);
    
    // Проверяем результат
    const statsContainer = document.getElementById('stats-container');
    
    log('После hashchange на #/stats:');
    log('- stats-container exists:', !!statsContainer);
    log('- mainContainer.style.display:', mainContainer?.style.display);
    
    // Восстанавливаем hash
    location.hash = originalHash;
    
    return { statsContainer, mainContainer };
}

// ========================================
// ТЕСТ 5: Проверка z-index и перекрытий
// ========================================

export async function testZIndexAndOverlaps() {
    log('=== ТЕСТ 5: Проверка z-index и перекрытий ===');
    
    const { initStatsPage } = await import('../srs/stats-ui.js');
    initStatsPage(window.currentAppVersion || 'test');
    await sleep(100);
    
    const statsContainer = document.getElementById('stats-container');
    const sidebar = document.querySelector('.sidebar');
    const mainContainer = document.querySelector('.container');
    
    log('z-index значения:');
    log('- statsContainer:', statsContainer ? getComputedStyle(statsContainer).zIndex : 'N/A');
    log('- sidebar:', sidebar ? getComputedStyle(sidebar).zIndex : 'N/A');
    log('- mainContainer:', mainContainer ? getComputedStyle(mainContainer).zIndex : 'N/A');
    
    // Проверяем rect для перекрытий
    if (statsContainer && sidebar) {
        const statsRect = statsContainer.getBoundingClientRect();
        const sidebarRect = sidebar.getBoundingClientRect();
        
        log('stats-container rect:', statsRect);
        log('sidebar rect:', sidebarRect);
        
        // Проверяем есть ли перекрытие
        const hasOverlap = !(
            statsRect.right < sidebarRect.left ||
            statsRect.left > sidebarRect.right ||
            statsRect.bottom < sidebarRect.top ||
            statsRect.top > sidebarRect.bottom
        );
        
        log('Есть перекрытие с sidebar:', hasOverlap);
    }
    
    return { statsContainer, sidebar, mainContainer };
}

// ========================================
// ТЕСТ 6: Полный сценарий перехода из тренировки
// ========================================

export async function testFullLearnToStatsFlow() {
    log('=== ТЕСТ 6: Полный сценарий: тренировка → статистика ===');
    
    // Шаг 1: Симулируем режим обучения
    log('Шаг 1: Вход в режим обучения');
    document.body.classList.add('learning-mode');
    const learnContainer = document.getElementById('learn-container');
    if (learnContainer) learnContainer.style.display = 'block';
    
    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) bottomNav.style.display = 'flex';
    
    await sleep(50);
    
    // Шаг 2: Симулируем клик по кнопке "Статистика" из модалки
    log('Шаг 2: Клик по кнопке "Статистика"');
    
    // Очищаем существующий stats-container
    const existingStats = document.getElementById('stats-container');
    if (existingStats) existingStats.remove();
    
    const { initStatsPage } = await import('../srs/stats-ui.js');
    initStatsPage(window.currentAppVersion || 'test');
    await sleep(150);
    
    // Шаг 3: Проверяем результат
    log('Шаг 3: Проверка результата');
    
    const statsContainer = document.getElementById('stats-container');
    const sidebar = document.querySelector('.sidebar');
    const mainContainerEl = document.querySelector('.container');
    
    const results = {
        statsContainerExists: !!statsContainer,
        statsContainerVisible: statsContainer?.style.display === 'block',
        mainContainerHidden: !mainContainerEl || mainContainerEl.style.display === 'none',
        sidebarHidden: !sidebar || sidebar.style.display === 'none',
        learningModeRemoved: !document.body.classList.contains('learning-mode'),
    };
    
    log('Результаты:', results);
    
    // Ассерты
    assert(results.statsContainerExists, 'stats-container должен существовать');
    assert(results.statsContainerVisible, 'stats-container должен быть видимым');
    assert(results.mainContainerHidden, 'mainContainer должен быть скрыт');
    assert(results.sidebarHidden, 'sidebar должен быть скрыт');
    
    // Очищаем
    document.body.classList.remove('learning-mode');
    if (statsContainer) statsContainer.remove();
    if (mainContainerEl) mainContainerEl.style.display = 'block';
    
    return results;
}

// ========================================
// ЗАПУСК ВСЕХ ТЕСТОВ
// ========================================

export async function runAllTests() {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║  ЗАПУСК АВТОТЕСТОВ: СТАТИСТИКА ИЗ ТРЕНИРОВКИ  ║');
    console.log('╚════════════════════════════════════════════════╝');
    console.log('\n');
    
    const results = {
        passed: 0,
        failed: 0,
        tests: []
    };
    
    const tests = [
        { name: 'Контейнеры ДО перехода', fn: testContainersBeforeNavigation },
        { name: 'Инициализация страницы статистики', fn: testStatsPageInitialization },
        { name: 'Переход из режима обучения', fn: testNavigationFromLearnMode },
        { name: 'Hashchange обработчик', fn: testHashChangeHandler },
        { name: 'Z-index и перекрытия', fn: testZIndexAndOverlaps },
        { name: 'Полный сценарий', fn: testFullLearnToStatsFlow },
    ];
    
    for (const test of tests) {
        console.log(`\n▶️  Запуск теста: ${test.name}`);
        console.log('─'.repeat(50));
        
        try {
            await test.fn();
            results.passed++;
            results.tests.push({ name: test.name, status: 'PASSED' });
            console.log(`✅ ТЕСТ ПРОЙДЕН: ${test.name}\n`);
        } catch (error) {
            results.failed++;
            results.tests.push({ name: test.name, status: 'FAILED', error: error.message });
            console.error(`❌ ТЕСТ ПРОВАЛЕН: ${test.name}`);
            console.error(`   Ошибка: ${error.message}\n`);
        }
        
        await sleep(100);
    }
    
    console.log('\n');
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║              РЕЗУЛЬТАТЫ ТЕСТОВ                 ║');
    console.log('╚════════════════════════════════════════════════╝');
    console.log(`✅ Пройдено: ${results.passed}`);
    console.log(`❌ Провалено: ${results.failed}`);
    console.log('\nДетали:');
    results.tests.forEach(t => {
        const icon = t.status === 'PASSED' ? '✅' : '❌';
        console.log(`  ${icon} ${t.name}: ${t.status}`);
        if (t.error) {
            console.log(`     Ошибка: ${t.error}`);
        }
    });
    console.log('\n');
    
    return results;
}

// Автозапуск при импорте
(async () => {
    await runAllTests();
})();
