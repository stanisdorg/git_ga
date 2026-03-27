// Файл для управления UI вариантами

// Импортируем только функцию инициализации табов и карточек
import { initTabsNavigation } from './ui-variants/tabs-navigation.js';
import { initStatsPage, hideStatsPage } from './srs/stats-ui.js';
import { loadFromServer } from './srs/storage.js';
import { initSyncIndicator } from './srs/sync-ui.js';

export const APP_VERSION = '6.14.2';

let uiInitialized = false;

// Функция для инициализации UI
export function initUI() {
    console.log('initUI called');

    // Скрываем строку поиска СРАЗУ если это страница статистики
    const isStats = location.hash && location.hash.includes('stats');
    if (isStats) {
        console.log('[initUI] Stats page detected, hiding search container immediately...');
        const searchContainer = document.querySelector('.search-container');
        if (searchContainer) {
            searchContainer.style.display = 'none';
            console.log('[initUI] searchContainer hidden');
        }
    }

    // Защита от повторной инициализации
    if (uiInitialized) {
        console.log('initUI: уже инициализировано, пропускаем');
        return;
    }
    uiInitialized = true;

    // Удаляем существующие элементы навигации, если они есть
    removeExistingNavigation();

    // Роутинг: хэш-маршрут для статистики (устраняет 404 при обновлении)

    // Always initialize main app to ensure Auth and logic availability
    initTabsNavigation(APP_VERSION);

    if (isStats) {
        initStatsPage(APP_VERSION);
    }

    // Добавляем стили для табов и карточек
    addStyles();
    // createBottomNav(); // Убрали нижнюю навигацию
    initSyncIndicator();

    // Скрываем splash screen после загрузки приложения
    if (typeof window.hideSplashScreen === 'function') {
        // Небольшая задержка для плавного перехода
        setTimeout(() => {
            window.hideSplashScreen();
            console.log('[Splash Screen] Hidden after UI init');
        }, 500);
    }

    // Загружаем прогресс с локального сервера ПОСЛЕ инициализации табов
    // dataLoaded не диспатчим здесь — loadFromServer сам диспатчит
    // forceReload=true для принудительной перезаписи с правильной кодировкой
    loadFromServer(true).catch(e => console.error('Failed to load progress:', e));

    // Обновляем UI при изменении данных (только для админских изменений)
    const reinit = () => {
        console.log('reinit: перерисовка UI');
        removeExistingNavigation();

        // Always init main app
        initTabsNavigation(APP_VERSION);

        const isStats = location.hash && location.hash.includes('stats');
        if (isStats) {
            initStatsPage(APP_VERSION);
        } else {
            hideStatsPage();
        }
        // createBottomNav() убран
        initSyncIndicator();
    };
    // Убрали dataLoaded из списка, чтобы не было дублей
    window.addEventListener('adminItemAdded', reinit);
    window.addEventListener('adminOverridesChanged', reinit);

    // Убрана интеграция Netlify Identity/Auth0. Используется локальная авторизация.
}

// Функция для удаления существующих элементов навигации
function removeExistingNavigation() {
    const tabsNav = document.querySelector('.tabs-navigation');
    if (tabsNav) tabsNav.remove();
    const topControls = document.querySelector('.top-controls');
    if (topControls) topControls.remove();
    const trashPanel = document.querySelector('.trash-panel');
    if (trashPanel) trashPanel.remove();
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
            flex-wrap: wrap;
            overflow-x: visible !important;
            overflow-y: visible !important;
            background: transparent;
            border-radius: 12px;
            border: none !important;
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
            background-color: #a0a0a0;
            color: white;
        }

        /* Избранное таб — тёмно-оранжевое сердечко */
        .tab[data-category="favorites"] {
            display: flex;
            align-items: center;
            justify-content: center;
        }

        /* Верхняя панель с кнопками */
        .top-controls {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            margin-bottom: 8px;
            height: var(--header-fixed-height);
            align-items: flex-start;
        }
        
        .subcategories-container {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            padding: 6px;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 8px;
            margin-bottom: 4px;
        }
        
        .subcategory-card {
            padding: 6px 12px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 8px;
            cursor: pointer;
            font-size: 13px;
            color: #aaa;
            transition: all 0.3s ease;
            white-space: nowrap;
        }

        .subcategory-card:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(0, 217, 255, 0.5);
        }
        
        .subcategory-card.active {
            background: rgba(0, 217, 255, 0.2);
            border-color: #00d9ff;
            color: #00d9ff;
        }

        /* Кнопки избранного и редактирования */
        .question-row {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 4px;
        }
        .fav-btn, .edit-btn {
            border: none; /* убираем серую обводку для избранного */
            background-color: transparent;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px; /* сердечко чуть больше */
            padding: 2px 6px;
        }
        .fav-btn svg { display: block; }
        .fav-btn svg path { fill: none; stroke: #d0d0d0; stroke-width: 1.6; }
        .fav-btn.fav-active svg path { fill: #d0d0d0; stroke: #d0d0d0; }
    `;

    document.head.appendChild(stylesheet);
}

// Функция createBottomNav удалена - нижняя навигация больше не используется
/*
function createBottomNav() {
    try {
        const existing = document.getElementById('bottom-nav');
        if (existing) {
            console.log('[createBottomNav] Уже существует, пропускаем');
            return; // Не удаляем, просто выходим
        }

        const nav = document.createElement('div');
        nav.id = 'bottom-nav';
        nav.className = 'bottom-nav';
        const mkBtn = (id, label, svg) => {
            const b = document.createElement('button');
            b.id = id;
            b.innerHTML = `${svg}<span>${label}</span>`;
            return b;
        };
        const homeSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3l9 8-1.5 1.5L12 6 4.5 12.5 3 11z"/><path d="M5 13v8h6v-6h2v6h6v-8l-7-6z"/></svg>';
        const statsSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="4" height="18" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="17" y="13" width="4" height="8" rx="1"/></svg>';
        const userSvg  = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4z"/><path d="M4 20v-2c0-3.3 4.7-5 8-5s8 1.7 8 5v2H4z"/></svg>';
        const home = mkBtn('bn-home', 'Главная', homeSvg);
        const stats = mkBtn('bn-stats', 'Статистика', statsSvg);
        const profile = mkBtn('bn-profile', 'Профиль', userSvg);
        nav.appendChild(home); nav.appendChild(stats); nav.appendChild(profile);

        document.body.appendChild(nav);

        const setActive = () => {
            [home, stats, profile].forEach(b => b.classList.remove('active'));
            if (location.hash && location.hash.includes('stats')) stats.classList.add('active');
            else home.classList.add('active');
        };
        setActive();
        home.addEventListener('click', () => {
            location.hash = '';
            removeExistingNavigation();
            hideStatsPage();
            initTabsNavigation(APP_VERSION);
            setActive();
        });
        stats.addEventListener('click', () => {
            location.hash = '#/stats';
            removeExistingNavigation();
            initStatsPage(APP_VERSION);
            setActive();
        });
        profile.addEventListener('click', () => {
            if (window.qaAuth && typeof window.qaAuth.openLogin === 'function') {
                window.qaAuth.openLogin();
            } else {
                alert('Окно входа недоступно');
            }
        });
    } catch (e) {
        console.warn('Bottom nav init failed:', e);
    }
}
*/
