// Автоматическое логирование действий пользователя
// Все логи сохраняются в localStorage

(function initAutoLogger() {
    const LOG_KEY = 'qaAutoLogs';
    const MAX_LOGS = 100; // Храним последние 100 записей

    // Функция для добавления лога
    function addLog(category, message, data = null) {
        const logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
        
        const logEntry = {
            timestamp: new Date().toISOString(),
            category,
            message,
            data,
            userAgent: navigator.userAgent
        };
        
        logs.push(logEntry);
        
        // Удаляем старые логи если больше MAX_LOGS
        if (logs.length > MAX_LOGS) {
            logs.shift();
        }
        
        localStorage.setItem(LOG_KEY, JSON.stringify(logs));
        console.log(`[AutoLog] ${category}: ${message}`, data);
    }

    // Логирование действий UserSystem
    if (window.UserSystem) {
        const originalLogin = window.UserSystem.login;
        window.UserSystem.login = function(username, password) {
            const result = originalLogin.call(this, username, password);
            addLog('AUTH', `Login attempt: ${username}`, { 
                success: result.success, 
                role: result.user?.role 
            });
            return result;
        };

        const originalLogout = window.UserSystem.logout;
        window.UserSystem.logout = function() {
            const user = this.getCurrentUser();
            addLog('AUTH', 'Logout', { username: user?.username });
            return originalLogout.call(this);
        };

        const originalSaveCards = window.UserSystem.saveCards;
        window.UserSystem.saveCards = function(cards) {
            const user = this.getCurrentUser();
            const result = originalSaveCards.call(this, cards);
            addLog('CARDS', 'Save cards', { 
                username: user?.username, 
                role: user?.role,
                cardsCount: cards.length,
                result 
            });
            return result;
        };

        const originalUpdateCard = window.UserSystem.updateCard;
        window.UserSystem.updateCard = function(oldQuestion, newCard) {
            const user = this.getCurrentUser();
            const result = originalUpdateCard.call(this, oldQuestion, newCard);
            addLog('CARDS', 'Update card', { 
                username: user?.username,
                oldQuestion: oldQuestion?.substring(0, 50),
                result 
            });
            return result;
        };
    }

    // Логирование изменений localStorage
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
        if (key.includes('qaAdmin') || key.includes('qaNew') || key.includes('qaDeleted') || key.includes('user_')) {
            addLog('STORAGE', `SetItem: ${key}`, { 
                valueLength: value?.length,
                valuePreview: value?.substring(0, 100)
            });
        }
        return originalSetItem.call(this, key, value);
    };

    // Логирование инициализации
    addLog('INIT', 'AutoLogger initialized');

    // Экспорт функции для просмотра логов
    window.QALogs = {
        view: function() {
            const logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
            console.table(logs.map(l => ({
                time: l.timestamp.split('T')[1].split('.')[0],
                category: l.category,
                message: l.message,
                data: JSON.stringify(l.data)
            })));
            return logs;
        },
        clear: function() {
            localStorage.removeItem(LOG_KEY);
            console.log('[AutoLog] Logs cleared');
        },
        export: function() {
            const logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
            const blob = new Blob([JSON.stringify(logs, null, 2)], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `qa-logs-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
    };

    console.log('[AutoLog] Use window.QALogs.view() to see logs, .clear() to clear, .export() to download');
})();
