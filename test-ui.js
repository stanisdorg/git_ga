// UI для автотестов - отображает результаты прямо на странице

(function initTestUI() {
    // Создаём UI элемент
    const testUI = document.createElement('div');
    testUI.id = 'qa-test-ui';
    testUI.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #1a1a1a;
        border: 2px solid #333;
        border-radius: 8px;
        padding: 15px;
        z-index: 9999;
        max-width: 400px;
        font-family: monospace;
        font-size: 12px;
        color: #fff;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    `;
    
    testUI.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <strong style="color: #4CAF50;">🧪 QA Tests</strong>
            <button id="run-tests-btn" style="background: #2196F3; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;">Run Tests</button>
        </div>
        <div id="test-results" style="max-height: 300px; overflow-y: auto;">
            <div style="color: #888;">Click "Run Tests" to start...</div>
        </div>
        <div style="margin-top: 10px; display: flex; gap: 5px;">
            <button id="clear-tests-btn" style="background: #f44336; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; flex: 1;">Clear</button>
            <button id="export-tests-btn" style="background: #FF9800; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; flex: 1;">Export</button>
        </div>
    `;
    
    document.body.appendChild(testUI);
    
    // Кнопка запуска тестов
    document.getElementById('run-tests-btn').addEventListener('click', function() {
        // Проверяем что все скрипты загрузились
        if (!window.QATests) {
            document.getElementById('test-results').innerHTML = '<div style="color: #f44336;">Error: Tests not loaded yet. Wait 3 seconds and try again.</div>';
            return;
        }
        if (!window.UserSystem) {
            document.getElementById('test-results').innerHTML = '<div style="color: #f44336;">Error: UserSystem not initialized. Refresh page.</div>';
            return;
        }
        
        document.getElementById('test-results').innerHTML = '<div style="color: #2196F3;">Running tests...</div>';
        window.QATests.run().then(function(results) {
            displayResults(results);
        });
    });
    
    // Кнопка очистки
    document.getElementById('clear-tests-btn').addEventListener('click', function() {
        if (window.QATests) {
            window.QATests.clearResults();
            document.getElementById('test-results').innerHTML = '<div style="color: #888;">Results cleared</div>';
        }
    });
    
    // Кнопка экспорта
    document.getElementById('export-tests-btn').addEventListener('click', function() {
        const results = window.QATests ? window.QATests.results() : [];
        const logs = window.QALogs ? window.QALogs.getLogs() : [];
        
        const exportData = {
            timestamp: new Date().toISOString(),
            results,
            logs
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qa-test-results-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });
    
    // Отображение результатов
    function displayResults(results) {
        const passed = results.filter(r => r.passed).length;
        const total = results.length;
        
        let html = `
            <div style="margin-bottom: 10px; padding: 5px; background: ${passed === total ? 'rgba(76,175,80,0.2)' : 'rgba(244,67,54,0.2)'}; border-radius: 4px;">
                <strong>Results: ${passed}/${total} passed</strong>
            </div>
        `;
        
        results.forEach(r => {
            const color = r.passed ? '#4CAF50' : '#f44336';
            const icon = r.passed ? '✅' : '❌';
            html += `
                <div style="margin-bottom: 8px; padding: 5px; border-left: 3px solid ${color}; background: rgba(0,0,0,0.2);">
                    <div style="font-weight: bold; color: ${color};">${icon} ${r.name}</div>
                    <div style="color: #888; font-size: 10px; margin-top: 3px;">${escapeHtml(JSON.stringify(r.details))}</div>
                </div>
            `;
        });
        
        document.getElementById('test-results').innerHTML = html;
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Автозапуск при загрузке
    window.addEventListener('load', function() {
        // Ждём 3 секунды чтобы все скрипты загрузились
        setTimeout(function() {
            // Проверяем что UserSystem инициализирован
            if (!window.UserSystem) {
                console.log('[TestUI] UserSystem not ready, waiting...');
                setTimeout(arguments.callee, 1000);
                return;
            }
            
            if (window.QATests) {
                console.log('[TestUI] Auto-running tests...');
                document.getElementById('test-results').innerHTML = '<div style="color: #2196F3;">Auto-running tests...</div>';
                window.QATests.run().then(function(results) {
                    console.log('[TestUI] Tests completed:', results.passed + '/' + results.total + ' passed');
                    displayResults(results);
                    
                    // Сохраняем для экспорта
                    localStorage.setItem('qaLastTestResults', JSON.stringify(results));
                });
            } else {
                console.log('[TestUI] QATests not loaded');
                document.getElementById('test-results').innerHTML = '<div style="color: #f44336;">Tests not loaded. Refresh page.</div>';
            }
        }, 3000);
    });
    
    console.log('[TestUI] QA Test UI initialized');
})();
