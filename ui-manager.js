// Файл для управления UI вариантами

// Импортируем только функцию инициализации табов и карточек
import { initTabsNavigation } from './ui-variants/tabs-navigation.js';

// Функция для инициализации UI
export function initUI() {
    // Удаляем существующие элементы навигации, если они есть
    removeExistingNavigation();
    
    // Инициализируем табы и карточки
    initTabsNavigation();
    
    // Добавляем стили для табов и карточек
    addStyles();
}

// Функция для удаления существующих элементов навигации
function removeExistingNavigation() {
    const tabsNav = document.querySelector('.tabs-navigation');
    if (tabsNav) tabsNav.remove();
}

// Функция для добавления стилей для табов и карточек
function addStyles() {
    // Удаляем существующие стили для UI вариантов
    const existingStylesheet = document.getElementById('ui-variant-styles');
    if (existingStylesheet) existingStylesheet.remove();
    
    // Создаем новый элемент style
    const stylesheet = document.createElement('style');
    stylesheet.id = 'ui-variant-styles';
    
    // Добавляем общие стили с измененными параметрами для span элементов
    stylesheet.textContent = `
        /* Общие стили */
        .category-badge, .subcategory-badge, .result-category, .result-subcategory {
            display: inline-block !important;
            padding: 1px 4px !important;
            border-radius: 5px !important;
            font-size: 9px !important;
            margin-right: 4px !important;
            opacity: 0.4 !important;
            background-color: #000000 !important;
            color: #ffffff !important;
            border: 1px solid #333333 !important;
            text-transform: lowercase !important;
        }
        
        .mic-button {
            position: absolute !important;
            right: 0 !important;
            margin-right: 0 !important;
            float: right !important;
            background-color: #333333 !important;
        }
        
        .subcategory-badge {
            background-color: #2196F3;
            color: white;
        }
        
        .reset-button {
            padding: 8px 10px; /* компактнее */
            background-color: #e53935; /* ярко-красная */
            color: white;
            border: none;
            border-radius: 8px; /* квадратная со скруглениями */
            cursor: pointer;
            font-size: 14px;
            margin-top: 0; /* убираем верхний отступ */
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
        }
        
        .reset-button:hover {
            background-color: #d32f2f;
        }
        
        .results-header {
            margin: 8px 0; /* меньше места */
            padding: 0; /* без нижней границы */
            border: none;
            grid-column: 1 / -1;
        }
        
        .results-header .results-count {
            font-size: 12px; /* мельче шрифт */
            color: #aaa;
        }
    `;
    
    // Добавляем стили для табов и карточек
    stylesheet.textContent += `
        /* Стили для табов */
        .tabs-navigation {
            margin-bottom: 8px; /* ближе к полю ввода */
        }
        
        .tabs-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 6px;
        }
        
        .tabs-container {
            display: flex;
            overflow-x: auto;
            background-color: #252525;
            border-radius: 5px;
            border: 1px solid #444;
        }
        
        .tab {
            padding: 8px 12px; /* компактнее */
            cursor: pointer;
            white-space: nowrap;
            color: #e0e0e0;
            border-right: 1px solid #444;
            font-size: 14px; /* компактнее */
        }
        
        .tab:hover {
            background-color: #333;
        }
        
        .tab.active {
            background-color: #3498db;
            color: white;
        }
        
        .subcategories-container {
            display: grid;
            grid-template-columns: repeat(3, 1fr); /* три столбца подкатегорий */
            gap: 6px; /* компактнее */
            padding: 6px;
            background-color: #1e1e1e;
            border-radius: 5px;
            margin-bottom: 4px; /* ближе к полю */
        }
        
        .subcategory-card {
            padding: 6px 8px;
            background-color: #2a2a2a;
            border: 1px solid #3a3a3a;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            white-space: nowrap;
        }
        
        .subcategory-card.active {
            background-color: #3498db;
            color: white;
        }
    `;
    
    document.head.appendChild(stylesheet);
}