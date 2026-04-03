// Обработчик событий загрузки данных

// Импортируем функции инициализации UI
import { initUI } from './ui-manager.js';

// Функция для инициализации обработчиков событий данных
export function initDataEventHandlers() {
    // Обработчик события загрузки данных
    document.addEventListener('dataLoaded', function(event) {
        initUI();
    });
}

// Инициализируем обработчики событий при загрузке страницы
document.addEventListener('DOMContentLoaded', initDataEventHandlers);