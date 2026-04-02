/**
 * Подсветка поисковых запросов в карточках
 * 
 * Добавляет выделение совпадений в вопросах и ответах
 */

// Глобальная переменная для текущего поискового запроса
window.currentSearchQuery = '';

/**
 * Экранирование специальных символов для RegExp
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Подсветка поискового запроса в тексте
 * @param {string} text - Исходный текст
 * @param {string} query - Поисковый запрос
 * @returns {string} - HTML с подсветкой
 */
function highlightSearchQuery(text, query) {
    if (!query || !text) return text;
    
    // Разбиваем запрос на слова (по пробелам)
    const words = query.trim().split(/\s+/).filter(w => w.length > 0);
    
    if (words.length === 0) return text;
    
    // Создаем RegExp для всех слов (case-insensitive)
    const pattern = words.map(escapeRegExp).join('|');
    const regex = new RegExp(`(${pattern})`, 'gi');
    
    // Заменяем совпадения на выделенные
    return text.replace(regex, '<mark class="search-highlight">$1</mark>');
}

/**
 * Обновление текущего поискового запроса
 */
window.setSearchQuery = function(query) {
    window.currentSearchQuery = query || '';
};

/**
 * Получение текущего поискового запроса
 */
window.getSearchQuery = function() {
    return window.currentSearchQuery || '';
};

console.log('[Search Highlight] Module loaded');
