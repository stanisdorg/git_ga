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
export function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Подсветка поискового запроса в тексте
 * @param {string} text - Исходный текст
 * @param {string} query - Поисковый запрос
 * @returns {string} - HTML с подсветкой
 */
export function highlightSearchQuery(text, query) {
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
export function setSearchQuery(query) {
    window.currentSearchQuery = query || '';
    window.dispatchEvent(new CustomEvent('searchquerychange', { detail: query }));
}

/**
 * Получение текущего поискового запроса
 */
export function getSearchQuery() {
    return window.currentSearchQuery || '';
}

// Экспортируем также в window для доступа из других модулей
window.setSearchQuery = setSearchQuery;
window.getSearchQuery = getSearchQuery;
window.escapeRegExp = escapeRegExp;
window.highlightSearchQuery = highlightSearchQuery;
