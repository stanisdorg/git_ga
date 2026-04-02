// Вариант 3: Табы для категорий и карточки для подкатегорий
console.log('[TABS-NAVIGATION] Module loaded');

// Импортируем данные и генератор категорий
import { uniqueQaData } from '../all-data.js';
import { buildCategoriesFromData } from '../computed-categories.js';
import { setNormalizationDisabled } from '../load-json-data.js';
import { getProgressMap } from '../srs/stats-utils.js';
import { getDifficultyLevel, getLevelProgress } from '../srs/algorithm.js';
import { applyFormatting, createEmptyFormatting, convertHtmlToTextAndFormatting, renderFormattingInEditor } from '../srs/text-formatter.js';
import { createFormatToolbar, initFormatToolbar } from '../srs/format-toolbar.js';

console.log('[TABS-NAVIGATION] Imports completed');

// Глобальные флаги/состояния для режима редактирования и логина
let editMode = (typeof localStorage !== 'undefined' && localStorage.getItem('qaEditMode') === 'true') ? true : false;
let currentContextKey = 'all';
let currentQuestions = [];
let sortMode = 'default'; // Global sort state
let resultsListRef = null;
// Кэш корзины на стороне сервера (не используем localStorage для удалённых карточек)
let serverTrashSet = new Set();
let serverTrashItems = [];
// Конфигурируемый URL бэкенда (можно задать через localStorage ключ 'qaBackendUrl')
// По умолчанию используем порт 8765, так как локальный сервер запущен там
const BACKEND_URL = (typeof localStorage !== 'undefined' && localStorage.getItem('qaBackendUrl')) || window.location.origin;

// 🔒 HELPER: User-specific localStorage keys (ИСПРАВЛЕНИЕ: у каждого пользователя свой ключ)
function getQaUserCardsKey() {
    try {
        const sessionUserRaw = localStorage.getItem('qaSessionUser');
        if (sessionUserRaw) {
            const user = JSON.parse(sessionUserRaw);
            if (user && user.username) {
                return `qaUserCards_${user.username}`;
            }
        }
    } catch (e) { }
    return 'qaUserCards_guest';
}

function getQaUserCards() {
    try {
        const key = getQaUserCardsKey();
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        return null;
    }
}

function setQaUserCards(cards) {
    try {
        const key = getQaUserCardsKey();
        localStorage.setItem(key, JSON.stringify(cards));
    } catch (e) {
        console.error('[setQaUserCards] Error:', e);
    }
}

function clearQaUserCards() {
    try {
        const key = getQaUserCardsKey();
        localStorage.removeItem(key);
        localStorage.removeItem('qaUserCards'); // Clean up old shared key
    } catch (e) {
        console.error('[clearQaUserCards] Error:', e);
    }
}

// Локальные хелперы для storage
function getLS(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || fallback); } catch { return JSON.parse(fallback); }
}
function setLS(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function getOrderForContext(ctx) { const o = getLS('qaOrderOverrides', '{}'); return o[ctx] || null; }
function setOrderForContext(ctx, orderArr) { const o = getLS('qaOrderOverrides', '{}'); o[ctx] = orderArr; setLS('qaOrderOverrides', o); }
function getOverrides() { return getLS('qaAdminOverrides', '{}'); }
// Устанавливаем overrides в localStorage (для сохранения изменений карточек)
function setOverrides(map) { setLS('qaAdminOverrides', map); }
function getNewItems() { return getLS('qaNewItems', '[]'); }
function getDeletedItems() { return getLS('qaDeletedItems', '{}'); }
function setDeletedItems(map) { setLS('qaDeletedItems', map); }

// Получение актуальных данных с учетом удаленных
function getRuntimeData() {
    // Сначала пробуем загрузить данные пользователя из localStorage
    let baseData = uniqueQaData;
    try {
        const userCards = getQaUserCards();
        if (userCards && Array.isArray(userCards) && userCards.length > 0) {
            baseData = userCards;
        }
    } catch (e) {
        console.warn('[getRuntimeData] Ошибка загрузки userCards:', e);
    }

    const base = baseData.map(item => ({ ...item }));
    const overrides = getOverrides();
    const newItems = getNewItems();
    const deleted = getDeletedItems();
    // Применяем overrides (категория/подкатегория/вопрос/ответ/форматирование)
    const byQuestion = new Map(base.map(i => [i.question, i]));
    Object.keys(overrides).forEach(origQ => {
        const ov = overrides[origQ];
        if (!ov) return;
        if (byQuestion.has(origQ)) {
            const it = byQuestion.get(origQ);
            const updated = { ...it };
            if (ov.category) updated.category = ov.category;
            if (ov.subcategory) updated.subcategory = ov.subcategory;
            if (ov.question) updated.question = ov.question;
            if (ov.answer) updated.answer = ov.answer;
            if (ov.formatting) updated.formatting = ov.formatting;  // 🔥 Применяем форматирование
            // Если изменилось ключевое поле вопроса — обновляем ключ в Map
            if (ov.question && ov.question !== origQ) {
                byQuestion.delete(origQ);
                byQuestion.set(updated.question, updated);
            } else {
                byQuestion.set(origQ, updated);
            }
        } else {
            // Если исходного вопроса нет в базе, рассматриваем как новый элемент
            byQuestion.set(ov.question || origQ, {
                question: ov.question || origQ,
                answer: ov.answer || '',
                category: ov.category || 'Без категории',
                subcategory: ov.subcategory || 'Общее',
                formatting: ov.formatting || createEmptyFormatting()  // 🔥 Форматирование для новых карточек
            });
        }
    });
    // Добавляем новые элементы
    newItems.forEach(ni => {
        if (!byQuestion.has(ni.question)) byQuestion.set(ni.question, { ...ni });
    });
    // Исключаем удалённые
    const merged = Array.from(byQuestion.values()).filter(i => !deleted[i.question] && !serverTrashSet.has(i.question));
    return merged;
}

// 🔥 Функция исправления кодировки в карточках
function fixEncodingIssues(data) {
    const sessionUserRaw = localStorage.getItem('qaSessionUser');
    if (!sessionUserRaw) return;

    const userCardsRaw = localStorage.getItem('qaUserCards');
    if (!userCardsRaw) return;

    let userCards = [];
    try {
        userCards = JSON.parse(userCardsRaw);
    } catch (e) {
        return;
    }

    let changed = false;
    const fixedCards = userCards.map(card => {
        const originalCategory = card.category;
        const originalSubcategory = card.subcategory;

        // 🔧 Исправляем искажённую кодировку в category
        if (card.category === 'Документация' || card.category === 'Дкументация' || card.category === 'Дкументация') {
            card.category = 'Документация';
            changed = true;
        }

        // 🔧 Исправляем искажённую кодировку в subcategory
        if (card.subcategory === 'Типы требований' || card.subcategory === 'Типы треований' || card.subcategory === 'Типы треований') {
            card.subcategory = 'Типы требований';
            changed = true;
        }

        return card;
    });

    if (changed) {
        // Подсчитываем сколько карточек было исправлено
        const fixedCount = userCards.filter((c, i) =>
            c.category !== fixedCards[i].category || c.subcategory !== fixedCards[i].subcategory
        ).length;

        setQaUserCards(fixedCards);
        // 🔥 НЕ отправляем на сервер автоматически — исправления сохранятся при следующем явном сохранении
        console.log('[fixEncodingIssues] Исправлено карточек:', fixedCount, '(сохранятся при следующем сохранении)');
    }
}

function getCategoryPlaceholders() { return getLS('qaCategoryPlaceholders', '{}'); }
function setCategoryPlaceholders(obj) { setLS('qaCategoryPlaceholders', obj); }
// Порядок категорий: хранится как массив имён категорий
function getCategoryOrder() { return getLS('qaCategoryOrder', '[]'); }
function setCategoryOrder(arr) { setLS('qaCategoryOrder', Array.isArray(arr) ? arr : []); }
// Порядок подкатегорий по категориям
function getSubcategoryOrderMap() { return getLS('qaSubcategoryOrder', '{}'); }
function setSubcategoryOrderMap(map) { setLS('qaSubcategoryOrder', map); }
function getSubcategoryOrderFor(categoryName) { const m = getSubcategoryOrderMap(); return m[categoryName] || []; }
function setSubcategoryOrderFor(categoryName, arr) { const m = getSubcategoryOrderMap(); m[categoryName] = Array.isArray(arr) ? arr : []; setSubcategoryOrderMap(m); }

// Индикатор инлайн-сохранения на строке карточки
function setInlineSaveStatus(rowEl, status, message = '') {
    if (!rowEl) return;
    let badge = rowEl.querySelector('.inline-save-status');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'inline-save-status';
        badge.style.marginLeft = '8px';
        badge.style.fontSize = '12px';
        badge.style.padding = '2px 6px';
        badge.style.borderRadius = '4px';
        rowEl.appendChild(badge);
    }
    const colors = { saving: '#444', success: '#2e7d32', error: '#c62828' };
    const texts = { saving: 'Сохранение…', success: 'Сохранено', error: 'Ошибка' };
    badge.textContent = message || texts[status] || '';
    badge.style.background = colors[status] || '#444';
    badge.style.color = '#eee';
    badge.style.border = '1px solid #333';
    if (status !== 'saving') {
        setTimeout(() => { if (badge && badge.parentNode === rowEl) badge.remove(); }, 1500);
    }
}

// Генератор уникального текста вопроса для копий
function genUniqueQuestionGlobal(baseQ) {
    // Очищаем базовый вопрос от суффиксов копий
    const cleanBase = baseQ.replace(/ \(копия( \d+)?\)$/, '');

    const exists = (q) => {
        // Проверяем в uniqueQaData
        if (uniqueQaData.some(i => i.question === q)) return true;
        // Проверяем в newItems
        if (getNewItems().some(i => i.question === q)) return true;
        // Проверяем в qaUserCards
        try {
            const userCardsRaw = localStorage.getItem('qaUserCards');
            if (userCardsRaw) {
                const userCards = JSON.parse(userCardsRaw);
                if (Array.isArray(userCards) && userCards.some(i => i.question === q)) return true;
            }
        } catch (e) { }
        return false;
    };

    // Ищем все существующие копии
    let i = 1;
    let candidate = `${cleanBase} (копия)`;
    while (exists(candidate)) {
        i++;
        candidate = `${cleanBase} (копия ${i})`;
    }
    return candidate;
}
// Плейсхолдеры для отображаемых названий подкатегорий (по категориям)
function getSubcategoryPlaceholders() { return getLS('qaSubcategoryPlaceholders', '{}'); }
function setSubcategoryPlaceholders(obj) { setLS('qaSubcategoryPlaceholders', obj); }

// Global helper function for authenticated fetch requests (NO TOKEN - username/password only)
async function fetchWithAuth(url, options = {}) {
    const user = loggedInUser;

    // Добавляем username в query параметры
    const urlObj = new URL(url, BACKEND_URL);
    if (user && user.username) {
        urlObj.searchParams.set('user', user.username);
    }
    // token removed - using username only for development

    const fetchOptions = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    };

    return fetch(urlObj.toString(), fetchOptions);
}

// Auto-load user data on page load if user is logged in (qaSessionUser exists)
async function autoLoadUserData() {
    // Проверяем, есть ли активная сессия
    const sessionUserRaw = localStorage.getItem('qaSessionUser');
    if (!sessionUserRaw) {
        return;
    }

    let username = null;
    try {
        const u = JSON.parse(sessionUserRaw);
        if (u && u.username) username = u.username;
    } catch (e) {
        console.error('[AutoLoad] Ошибка парсинга qaSessionUser:', e);
        return;
    }

    if (!username) {
        return;
    }

    // Загружаем данные через srs/storage.js
    // 🔥 forceReload=true для гарантированной синхронизации между устройствами
    try {
        const { loadFromServer } = await import('../srs/storage.js?v=6.24.0');
        await loadFromServer(true);
    } catch (e) {
        console.error('[AutoLoad] Ошибка автозагрузки:', e);
    }
}

// Простейшая заглушка логина — замените verifyCredentialsWithSupabase на реальную проверку
let loggedInUser = null;
function verifyCredentialsWithSupabase(email, password) {
    // TODO: здесь подключение к Supabase (REST/JS SDK) и проверка хеша пароля
    // Пока допускаем любой непустой логин
    return true;
}

// Функция для инициализации навигации с табами
// Глобальный индикатор сохранения (элемент верхней панели)
let globalSaveStatusEl = null;

// ========== Функции управления анимацией загрузки ==========
function showLoading() {
    const loadingContainer = document.getElementById('loading-container');
    const resultsList = document.getElementById('results-list');
    if (loadingContainer) loadingContainer.style.display = 'flex';
    if (resultsList) resultsList.classList.add('loading');
}

function hideLoading() {
    const loadingContainer = document.getElementById('loading-container');
    const resultsList = document.getElementById('results-list');
    if (loadingContainer) loadingContainer.style.display = 'none';
    if (resultsList) resultsList.classList.remove('loading');
}
// ===========================================================

export function initTabsNavigation(appVersion) {
    // Проверяем, не открыта ли страница статистики
    const isStatsPage = location.hash === '#/stats';
    console.log('[initTabsNavigation] Called! isStatsPage:', isStatsPage, 'location.hash:', location.hash);

    // Показываем анимацию загрузки при старте
    showLoading();

    try {
        const container = document.querySelector('.container');
        // Гарантируем видимость контейнеров (на случай если они были скрыты страницей статистики)
        // НО НЕ для страницы статистики!
        if (container && !isStatsPage) {
            container.style.display = '';
            console.log('[initTabsNavigation] container display reset');
        }
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && !isStatsPage) {
            sidebar.style.display = '';
            console.log('[initTabsNavigation] sidebar display reset');
        }

        const searchContainer = document.querySelector('.search-container');
        // СКРЫВАЕМ строку поиска для страницы статистики!
        if (searchContainer) {
            // Для статистики оставляем display:none, для остальных страниц показываем
            if (!isStatsPage) {
                searchContainer.style.display = '';
                console.log('[initTabsNavigation] search-container display reset');
            } else {
                searchContainer.style.display = 'none';
                console.log('[initTabsNavigation] search-container hidden (stats page)');
            }
        }
        // Удаляем старую админ-панель из DOM (новая логика редактирования сверху)
        const legacyAdminPanel = document.querySelector('.admin-panel');
        if (legacyAdminPanel) legacyAdminPanel.remove();

        // Создаем контейнер для навигации
        const navigationContainer = document.createElement('div');
        navigationContainer.className = 'tabs-navigation';

        // Контейнер для верхних действий (статистика, админка)
        const topActions = document.createElement('div');
        topActions.className = 'top-actions-bar';
        // СКРЫВАЕМ top-actions-bar для страницы статистики!
        topActions.style.display = isStatsPage ? 'none' : 'flex';
        topActions.style.alignItems = 'center';
        topActions.style.justifyContent = 'flex-start';
        topActions.style.padding = '4px 0';

        // Создаём MutationObserver для отслеживания изменений display
        if (isStatsPage) {
            window.__statsTopActionsObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                        const currentDisplay = topActions.style.display;
                        if (currentDisplay !== 'none') {
                            topActions.style.display = 'none';
                        }
                    }
                });
            });
            window.__statsTopActionsObserver.observe(topActions, { attributes: true });
        }

        // Версия приложения
        const verEl = document.createElement('div');
        verEl.textContent = `v${appVersion}`;
        verEl.className = 'app-version-display';
        verEl.style.fontSize = '11px';
        verEl.style.color = '#555';
        verEl.style.fontWeight = 'bold';
        verEl.style.marginLeft = '10px';

        // Контейнер для правой части (Уровень + Стрик)
        const levelContainer = document.createElement('div');
        levelContainer.className = 'level-container-right';
        levelContainer.style.marginLeft = 'auto';
        levelContainer.style.display = 'flex';
        levelContainer.style.alignItems = 'center';

        // Показываем все вопросы при инициализации
        showAllQuestions();

        // Автоматическая загрузка с учётом текущего контекста
        // Обновляем контекст через 100мс (после загрузки данных из all-data.js)
        setTimeout(() => {
            refreshCurrentContext();

            // Логирование размеров для отладки
            /* DEBUG
            const topBar = document.querySelector('.top-actions-bar');
            const container = document.querySelector('.container');
            const sidebar = document.querySelector('.sidebar');
            if (topBar && container && sidebar) {
                const topRect = topBar.getBoundingClientRect();
                const contRect = container.getBoundingClientRect();
                const sideRect = sidebar.getBoundingClientRect();
                console.log('[LAYOUT DEBUG]:', {
                    'Sidebar collapsed': sidebar.classList.contains('collapsed'),
                    'Sidebar width': sideRect.width,
                    'Sidebar right': sideRect.right,
                    'Sidebar left': sideRect.left,
                    'Top bar left': topRect.left,
                    'Top bar right': topRect.right,
                    'Top bar width': topRect.width,
                    'Container left': contRect.left,
                    'Container right': contRect.right,
                    'Container width': contRect.width,
                    'Container margin-left': getComputedStyle(container).marginLeft,
                    'Container margin-right': getComputedStyle(container).marginRight,
                    'Match (top vs container)': topRect.width === contRect.width
                });
            }
            */
        }, 100);

        // Слушаем обновление избранного из облака
        window.addEventListener('favoritesUpdated', () => {
            refreshCurrentContext();
        });

        // Слушаем dataLoaded от all-data.js для обновления после загрузки данных
        document.addEventListener('dataLoaded', (e) => {
            const data = e.detail?.data;

            // Скрываем анимацию загрузки
            hideLoading();

            if (data && data.length > 0) {
                // Перестраиваем табы категорий с новыми данными
                refreshCategoriesTabs();
                // Обновляем текущий контекст
                refreshCurrentContext();
            }
        });

        // 🔥 ИСПРАВЛЕНИЕ КОДИРОВКИ: После загрузки данных с сервера
        // Вызываем после loadFromServer, когда данные уже в localStorage
        window.addEventListener('qaDataLoadedFromServer', () => {
            fixEncodingIssues();
            refreshCategoriesTabs();
            refreshCurrentContext();
        });

        // Строим категории по данным (с учётом локальных правок/новых элементов/удалений)
        let categories = buildCategoriesFromData(getRuntimeData());

        // Создаем контейнер для табов
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'tabs-container';
        console.log('[TABS-NAVIGATION] tabsContainer created:', tabsContainer);
        console.log('[TABS-NAVIGATION] tabs-container parent will be:', document.querySelector('.tabs-header'));

        // Создаем таб "Все вопросы"
        const allTab = document.createElement('div');
        allTab.className = 'tab';
        allTab.dataset.category = 'all';
        allTab.textContent = 'Все вопросы';
        tabsContainer.appendChild(allTab);
        // Создаем таб "Избранное"
        const favTab = document.createElement('div');
        favTab.className = 'tab';
        favTab.dataset.category = 'favorites';
        // Иконка избранного: звезда (SVG)
        favTab.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style="vertical-align: middle;">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                style="fill: #fb923c; stroke: #fb923c; stroke-width: 2px;"
            />
        </svg>
    `;
        tabsContainer.appendChild(favTab);

        // Добавляем табы для всех категорий
        categories.forEach((category, index) => {
            const tab = document.createElement('div');
            tab.className = 'tab';
            tab.dataset.category = category.id;
            tab.textContent = category.displayName || category.name;
            tabsContainer.appendChild(tab);
            if (index < 3) {
                console.log('[TABS-NAVIGATION] Tab', index, 'created:', tab);
            }
        });

        console.log('[TABS-NAVIGATION] All tabs created, total:', tabsContainer.querySelectorAll('.tab').length);

        // Создаем контейнер для подкатегорий
        const subcategoriesContainer = document.createElement('div');
        subcategoriesContainer.className = 'subcategories-container';
        subcategoriesContainer.style.display = 'none';

        // Восстанавливаем подсветку активного таба из текущего контекста
        try {
            const key = currentContextKey || 'all';
            tabsContainer.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            if (key === 'all') {
                allTab.classList.add('active');
                subcategoriesContainer.style.display = 'none';
            } else if (key === 'favorites') {
                favTab.classList.add('active');
                subcategoriesContainer.style.display = 'none';
            } else if (key.startsWith('category:') || key.startsWith('subcategory:')) {
                const payload = key.startsWith('category:') ? key.slice('category:'.length) : key.slice('subcategory:'.length).split('#')[0];
                const selectedCategory = categories.find(c => c.name === payload || (c.displayName && c.displayName === payload));
                if (selectedCategory) {
                    const tabEl = tabsContainer.querySelector(`.tab[data-category="${selectedCategory.id}"]`);
                    if (tabEl) tabEl.classList.add('active');
                    subcategoriesContainer.style.display = 'flex';
                    // Подкатегории будут перестроены при render/refresh; здесь только визуально показываем блок
                } else {
                    allTab.classList.add('active');
                    subcategoriesContainer.style.display = 'none';
                }
            } else {
                allTab.classList.add('active');
                subcategoriesContainer.style.display = 'none';
            }
        } catch (_) {
            allTab.classList.add('active');
            subcategoriesContainer.style.display = 'none';
        }

        // Добавляем обработчики клика по табам
        tabsContainer.addEventListener('click', function (e) {
            console.log('[TABS-NAVIGATION] Click on tabsContainer, target:', e.target);
            if (e.target.classList.contains('tab')) {
                console.log('[TABS-NAVIGATION] Tab clicked:', e.target);
                console.log('[TABS-NAVIGATION] Tab computed styles before active:', {
                    transform: window.getComputedStyle(e.target).transform,
                    zIndex: window.getComputedStyle(e.target).zIndex,
                    position: window.getComputedStyle(e.target).position
                });

                // Удаляем класс active у всех табов
                const tabs = tabsContainer.querySelectorAll('.tab');
                tabs.forEach(tab => tab.classList.remove('active'));

                // Добавляем класс active выбранному табу
                e.target.classList.add('active');

                console.log('[TABS-NAVIGATION] Tab after active:', {
                    transform: window.getComputedStyle(e.target).transform,
                    zIndex: window.getComputedStyle(e.target).zIndex,
                    position: window.getComputedStyle(e.target).position
                });

                const categoryId = e.target.dataset.category;

                if (categoryId === 'all') {
                    // Если выбраны все вопросы, скрываем контейнер подкатегорий
                    subcategoriesContainer.style.display = 'none';
                    showAllQuestions();
                } else if (categoryId === 'favorites') {
                    // Избранное без подкатегорий
                    subcategoriesContainer.style.display = 'none';
                    showFavorites();
                } else {
                    const selectedCategory = categories.find(cat => cat.id == categoryId);
                    subcategoriesContainer.style.display = 'flex';
                    subcategoriesContainer.innerHTML = '';
                    rebuildSubcategoriesForCategory(selectedCategory.name);
                    filterQuestionsByCategory(selectedCategory.name);
                }
            }
        });

        // Добавляем обработчики клика по карточкам подкатегорий
        subcategoriesContainer.addEventListener('click', function (e) {
            if (e.target.classList.contains('subcategory-card')) {
                // Удаляем класс active у всех карточек
                const cards = subcategoriesContainer.querySelectorAll('.subcategory-card');
                cards.forEach(card => card.classList.remove('active'));

                // Добавляем класс active выбранной карточке
                e.target.classList.add('active');

                const subcategoryId = e.target.dataset.subcategory;
                const categoryId = e.target.dataset.category || tabsContainer.querySelector('.tab.active').dataset.category;

                if (subcategoryId === 'all') {
                    // Если выбраны все подкатегории, фильтруем только по категории
                    const selectedCategory = categories.find(cat => cat.id == categoryId);
                    filterQuestionsByCategory(selectedCategory.name);
                } else {
                    // Если выбрана конкретная подкатегория, фильтруем по категории и подкатегории
                    const selectedCategory = categories.find(cat => cat.id == categoryId);
                    const selectedSubcategory = selectedCategory.subcategories.find(
                        subcat => subcat.id == subcategoryId
                    );

                    filterQuestionsBySubcategory(selectedCategory.name, selectedSubcategory.name);
                }
            }
        });

        // Интегрируем кнопку фильтров внутрь списка табов как первый элемент (sticky left)
        const filtersBtn = document.createElement('button');
        filtersBtn.className = 'tab';
        filtersBtn.title = 'Фильтры';
        filtersBtn.style.padding = '0 10px';
        filtersBtn.style.minWidth = 'auto';
        filtersBtn.style.position = 'sticky';
        filtersBtn.style.left = '0';
        filtersBtn.style.zIndex = '10';
        filtersBtn.style.marginRight = '4px';
        filtersBtn.style.backgroundColor = 'var(--color-card)'; // Ensure background covers scrolling content
        filtersBtn.style.border = '1px solid var(--color-border)';
        filtersBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5h18v2l-7 7v4l-4 2v-6L3 7z"/></svg>';
        filtersBtn.addEventListener('click', () => {
            const sheet = document.getElementById('filters-sheet');
            if (sheet) {
                sheet.style.bottom = '0';
            }
        });

        // Вставляем кнопку фильтров перед остальными табами
        tabsContainer.insertBefore(filtersBtn, tabsContainer.firstChild);

        // Кнопка режима обучения (скрыта на мобильных через CSS .learn-main-btn)
        const learnBtn = document.createElement('button');
        learnBtn.title = 'Начать обучение';
        learnBtn.className = 'nav-icon-btn tab';
        learnBtn.style.padding = '0 10px';
        learnBtn.style.minWidth = 'auto';
        learnBtn.style.setProperty('color', '#fb923c', 'important'); // Orange icon (matches Level)
        learnBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3L1 9l11 6 9-4.91V17h2V9M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/></svg>';
        learnBtn.addEventListener('click', async () => {
            try {
                // 🔧 Очищаем состояние обучения ПЕРЕД запуском
                if (window.__lastCandidates) {
                    window.__lastCandidates = null;
                }
                if (window._learnTimerStartTimeout) {
                    clearTimeout(window._learnTimerStartTimeout);
                    window._learnTimerStartTimeout = null;
                }

                // Fallback: if currentQuestions is empty, try to use all data
                if ((!currentQuestions || currentQuestions.length === 0) && uniqueQaData && uniqueQaData.length > 0) {
                    console.warn('[Learn] currentQuestions empty, using uniqueQaData fallback');
                    currentQuestions = [...uniqueQaData];
                }

                if (!currentQuestions || currentQuestions.length === 0) {
                    console.warn('[Learn] No questions in current context');
                    alert('В текущем списке нет вопросов для изучения. Выберите категорию или "Все вопросы".');
                    return;
                }

                let module;
                try {
                    module = await import('../srs/learn-ui.js?v=6.24.0');
                } catch (e1) {
                    console.warn('[Learn] Import v6.09.5 failed, trying plain import', e1);
                    try {
                        module = await import('../srs/learn-ui.js?v=6.24.0');
                    } catch (e2) {
                        throw new Error(`Failed to load learn-ui.js: ${e2.message}`);
                    }
                }

                const { startLearnSession } = module;
                if (typeof startLearnSession !== 'function') {
                    throw new Error('startLearnSession export is missing');
                }

                startLearnSession(currentQuestions);
            } catch (err) {
                console.error('[Learn] Error:', err);
                alert('Не удалось запустить режим обучения: ' + err.message);
            }
        });

        // Кнопка статистики
        const statsBtn = document.createElement('button');
        statsBtn.className = 'nav-icon-btn tab';
        statsBtn.title = 'Статистика';
        statsBtn.style.minWidth = 'auto';
        statsBtn.style.padding = '0 10px';
        statsBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="4" height="18" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="17" y="13" width="4" height="8" rx="1"/></svg>`;
        statsBtn.addEventListener('click', async () => {
            // Очищаем состояние обучения ПЕРЕД переходом на статистику
            if (window.__lastCandidates) {
                window.__lastCandidates = null;
            }
            const { initStatsPage } = await import('../srs/stats-ui.js?v=6.24.0');
            location.hash = '#/stats';
            initStatsPage(appVersion);
        });

        // Обработчик изменения hash (для перехода из модалки)
        window.addEventListener('hashchange', async () => {
            // СНАЧАЛА отключаем MutationObserver!
            if (window.__statsTopActionsObserver) {
                window.__statsTopActionsObserver.disconnect();
                window.__statsTopActionsObserver = null;
            }

            if (location.hash === '#/stats') {
                // ПРОВЕРЯЕМ: существует ли stats-container
                const statsContainerExists = document.getElementById('stats-container');

                // Если stats-container НЕ существует, создаем его
                if (!statsContainerExists) {
                    const { initStatsPage } = await import('../srs/stats-ui.js?v=6.24.0');
                    initStatsPage(appVersion);
                }

                // Скрываем главный контейнер и sidebar
                const mainContainer = document.querySelector('.container');
                if (mainContainer) {
                    mainContainer.style.display = 'none';
                }
                const sidebar = document.querySelector('.sidebar');
                if (sidebar) {
                    sidebar.style.display = 'none';
                }
            } else if (location.hash === '' || location.hash === '#/' || location.hash === '#') {
                // Переход на главную - закрываем статистику если открыта
                console.log('[HASHCHANGE #/] Navigating to home page...');

                // Очищаем состояние обучения если есть
                if (window.__lastCandidates) {
                    window.__lastCandidates = null;
                    console.log('[HASHCHANGE #/] Cleared __lastCandidates');
                }

                // Закрываем статистику если открыта
                const statsContainer = document.getElementById('stats-container');
                if (statsContainer) {
                    statsContainer.remove();
                    console.log('[HASHCHANGE #/] Removed stats-container');
                }

                // Показываем главный контейнер
                const mainContainer = document.querySelector('.container');
                if (mainContainer) {
                    mainContainer.style.display = 'block';
                    console.log('[HASHCHANGE #/] mainContainer display set to block');
                }

                // Восстанавливаем sidebar
                const sidebar = document.querySelector('.sidebar');
                if (sidebar) {
                    sidebar.style.display = '';
                    console.log('[HASHCHANGE #/] sidebar display reset');
                } else {
                    console.warn('[HASHCHANGE #/] sidebar NOT FOUND!');
                }

                // Восстанавливаем top-actions-bar
                const topActionsBar = document.querySelector('.top-actions-bar');
                if (topActionsBar) {
                    topActionsBar.style.display = 'flex';
                    console.log('[HASHCHANGE #/] top-actions-bar display set to flex');
                } else {
                    console.warn('[HASHCHANGE #/] top-actions-bar NOT FOUND!');
                }

                // Восстанавливаем search-container
                const searchContainer = document.querySelector('.search-container');
                if (searchContainer) {
                    searchContainer.style.display = '';
                    console.log('[HASHCHANGE #/] search-container display reset');
                } else {
                    console.warn('[HASHCHANGE #/] search-container NOT FOUND!');
                }

                // Отключаем MutationObserver для top-actions-bar
                if (window.__statsTopActionsObserver) {
                    window.__statsTopActionsObserver.disconnect();
                    window.__statsTopActionsObserver = null;
                    console.log('[HASHCHANGE #/] Disconnected __statsTopActionsObserver');
                }

                // Обновляем текущий контекст
                refreshCurrentContext();
                console.log('[HASHCHANGE #] Home page setup complete');
            }
        });

        // Кнопка профиля / Войти
        const loginMainBtn = document.createElement('button');
        loginMainBtn.className = 'nav-icon-btn login-main-btn tab';
        loginMainBtn.style.minWidth = 'auto';
        loginMainBtn.style.padding = '0 10px';
        loginMainBtn.style.backgroundColor = 'var(--color-card)';

        const userIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
        loginMainBtn.innerHTML = userIconSvg;
        loginMainBtn.title = 'Войти';
        ensureDefaultUsers();
        loginMainBtn.addEventListener('click', () => {
            if (loggedInUser) {
                const username = loggedInUser.username || loggedInUser.email || 'пользователь';
                if (confirm(`Выйти из аккаунта ${username}?`)) {
                    window.qaAuth.logout();
                }
            } else {
                openLoginModal();
            }
        });

        const editToggleBtn = document.createElement('button');
        editToggleBtn.title = 'Режим редактирования';
        editToggleBtn.className = 'nav-icon-btn edit-mode-btn';
        editToggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;
        editToggleBtn.style.display = 'none';

        // Кнопка администратора для добавления пользователей (появляется после входа админа)
        const adminUsersBtn = document.createElement('button');
        adminUsersBtn.className = 'nav-icon-btn tab';
        adminUsersBtn.title = 'Добавить пользователя';
        adminUsersBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
        adminUsersBtn.style.display = 'none';
        adminUsersBtn.style.minWidth = 'auto';
        adminUsersBtn.style.padding = window.innerWidth <= 420 ? '0 6px' : '0 10px';
        adminUsersBtn.addEventListener('click', openAdminUsersPanel);

        const cloudBtn = document.createElement('button');
        cloudBtn.title = 'Облако';
        cloudBtn.textContent = 'Облако';
        cloudBtn.className = 'tab';
        cloudBtn.style.display = 'none';
        cloudBtn.style.width = 'auto';
        // Removed manual styles to match app style
        cloudBtn.addEventListener('click', openCloudOverview);

        // Добавляем кнопки: на мобильных в topActions, на desktop тоже в topActions
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        const isTablet = window.matchMedia('(min-width: 769px) and (max-width: 1024px)').matches;

        // 🔥 ВСЕГДА добавляем кнопки в topActions (и mobile, и desktop)
        topActions.appendChild(loginMainBtn); /* Вход/Выход - первый */
        topActions.appendChild(statsBtn); /* Статистика - второй */
        topActions.appendChild(learnBtn); /* Обучение - третий */
        topActions.appendChild(levelContainer);

        if (isMobile) {
            // Mobile: дополнительные кнопки в topActions
            loginMainBtn.style.position = 'sticky';
            loginMainBtn.style.right = '0';
            loginMainBtn.style.zIndex = '10';
            loginMainBtn.style.borderLeft = '1px solid var(--color-border)';

            // Версия приложения (компактная)
            topActions.appendChild(verEl);

            // Кнопка редактирования (для admin и editor)
            topActions.appendChild(editToggleBtn);

            // Кнопка добавления пользователя (только admin)
            topActions.appendChild(adminUsersBtn);

            // 🔥 СРАЗУ проверяем права доступа после добавления кнопок в DOM
            setTimeout(() => {
                try {
                    const user = JSON.parse(localStorage.getItem('qaSessionUser') || 'null');

                    // Кнопка редактирования: admin и editor
                    if (user && ['admin', 'editor'].includes(user.role)) {
                        editToggleBtn.style.setProperty('display', 'inline-block', 'important');
                    } else {
                        editToggleBtn.style.setProperty('display', 'none', 'important');
                    }

                    // Кнопка добавления пользователя: только admin
                    if (user && user.role === 'admin') {
                        adminUsersBtn.style.setProperty('display', 'inline-block', 'important');
                    } else {
                        adminUsersBtn.style.setProperty('display', 'none', 'important');
                    }
                } catch (e) {
                    console.error('[MOBILE ACCESS] Ошибка проверки прав:', e);
                    // По умолчанию скрываем кнопки
                    editToggleBtn.style.setProperty('display', 'none', 'important');
                    adminUsersBtn.style.setProperty('display', 'none', 'important');
                }
            }, 50);
        } else {
            // Desktop: дополнительные кнопки в topActions
            // Order: Stats -> Learn -> Login -> Version -> Edit -> Cloud -> Admin -> Level (Right Aligned)
            topActions.appendChild(verEl);
            topActions.appendChild(editToggleBtn);
            topActions.appendChild(cloudBtn);
            topActions.appendChild(adminUsersBtn);
        }

        // Добавляем контейнер табов в навигацию напрямую
        navigationContainer.appendChild(tabsContainer);

        // Bottom sheet фильтров
        let activeFilters = { status: null, ef: null };
        const sheet = document.getElementById('filters-sheet');

        if (sheet) {
            const overlay = document.getElementById('sheet-overlay');

            // Привязываем обработчики к существующим элементам из index.html
            const closeBtn = document.getElementById('close-filters');
            const resetBtn = document.getElementById('reset-filters');
            const applyBtn = document.getElementById('apply-filters');

            function closeSheet() {
                sheet.classList.remove('active');
                if (overlay) overlay.classList.remove('active');
            }

            function openSheet() {
                sheet.classList.add('active');
                if (overlay) overlay.classList.add('active');
            }

            if (closeBtn) closeBtn.addEventListener('click', closeSheet);
            if (overlay) overlay.addEventListener('click', closeSheet);

            if (resetBtn) resetBtn.addEventListener('click', () => {
                activeFilters = { status: null, ef: null };
                refreshCurrentContext();
                closeSheet();
                // Сброс визуального состояния чипов
                sheet.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            });

            if (applyBtn) applyBtn.addEventListener('click', () => {
                applyFilters();
                closeSheet();
            });

            // Открытие по кнопке фильтров
            filtersBtn.addEventListener('click', openSheet);

            // Обработка кликов по чипам
            sheet.querySelectorAll('.filter-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    const filterData = chip.dataset.filter; // "status:new" or "difficulty:easy"
                    if (!filterData) return;

                    const [type, value] = filterData.split(':');

                    // Toggle logic
                    if (type === 'status') {
                        activeFilters.status = activeFilters.status === value ? null : value;
                    } else if (type === 'difficulty') {
                        activeFilters.ef = activeFilters.ef === value ? null : value;
                    }

                    // Обновляем визуальное состояние
                    updateChipsVisuals();
                });
            });

            function updateChipsVisuals() {
                sheet.querySelectorAll('.filter-chip').forEach(c => {
                    const fd = c.dataset.filter;
                    if (!fd) return;
                    const [t, v] = fd.split(':');
                    const isActive = (t === 'status' && activeFilters.status === v) ||
                        (t === 'difficulty' && activeFilters.ef === v);

                    if (isActive) c.classList.add('active');
                    else c.classList.remove('active');
                });
            }
        }

        function applyFilters() {
            const data = getRuntimeData();
            let progMap = {};
            try { progMap = getProgressMap(); } catch { }

            const byStatus = (q) => {
                const p = progMap[q.question];
                if (!activeFilters.status) return true;

                if (activeFilters.status === 'new') return !p || p.easeFactor === undefined;
                if (activeFilters.status === 'learning') return !!p && (p.easeFactor !== undefined) && p.easeFactor < 2.1;
                if (activeFilters.status === 'review') return !!p && (p.easeFactor !== undefined) && p.easeFactor >= 2.1;
                return true;
            };

            const byEf = (q) => {
                const p = progMap[q.question];
                const ef = (p && p.easeFactor !== undefined) ? p.easeFactor : null;

                if (!activeFilters.ef) return true;

                // Mapping difficulty values from chips to EF ranges
                // easy: >= 2.4
                // medium: 2.1 - 2.4
                // hard: < 2.1

                if (ef === null) return false; // Hard/Medium/Easy imply studied cards

                if (activeFilters.ef === 'easy') return ef >= 2.4;
                if (activeFilters.ef === 'medium') return ef >= 1.7 && ef < 2.4;
                if (activeFilters.ef === 'hard') return ef < 1.7;

                return true;
            };

            const filtered = data.filter(q => byStatus(q) && byEf(q));
            displayQuestions(filtered, '');
        }

        // Удалён прежний огонёк до виджета уровня — перенесён ближе к шкале

        // Logic to update icon/tooltip on login change
        function updateLoginBtnState() {
            loginMainBtn.title = loggedInUser ? 'Выйти' : 'Войти';
            const exitIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M10 17l1.41-1.41L8.83 13H17v-2H8.83l2.58-2.59L10 7l-5 5 5 5z"/><path d="M19 3h-8c-1.1 0-2 .9-2 2v4h2V5h8v14h-8v-4H9v4c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>`;
            loginMainBtn.innerHTML = loggedInUser ? exitIconSvg : userIconSvg;
            // loginMainBtn.style.color = '#d0d0d0';
            // try { statsBtn.style.color = '#d0d0d0'; } catch {}
        }
        if (!window.qaAuth) window.qaAuth = {};
        window.qaAuth.getUser = () => loggedInUser;
        window.qaAuth.openLogin = () => openLoginModal();
        window.qaAuth.logout = async () => {
            // 🔥 Очищаем данные Telegram OAuth перед выходом
            sessionStorage.removeItem('tgAuthUser');

            await setLoggedUser(null);
            window.location.reload();
        };
        // Плашка уровня и XP
        import('../srs/stats-utils.js').then(({ getCurrentLevel }) => {
            // Добавляем имя пользователя
            const usernameSpan = document.createElement('span');
            usernameSpan.className = 'username-display';
            usernameSpan.style.marginRight = '8px';
            usernameSpan.style.fontSize = '13px';
            usernameSpan.style.color = '#4ec9b0';
            usernameSpan.style.fontWeight = '600';

            // Получаем имя из сессии
            try {
                const sessionUserRaw = localStorage.getItem('qaSessionUser');
                if (sessionUserRaw) {
                    const user = JSON.parse(sessionUserRaw);
                    if (user && user.username) {
                        usernameSpan.textContent = user.username;
                    } else {
                        usernameSpan.textContent = 'Гость';
                        usernameSpan.style.color = '#808080';
                    }
                } else {
                    usernameSpan.textContent = 'Гость';
                    usernameSpan.style.color = '#808080';
                }
            } catch (e) {
                usernameSpan.textContent = 'Гость';
                usernameSpan.style.color = '#808080';
            }

            levelContainer.appendChild(usernameSpan);

            const box = document.createElement('div');
            box.className = 'level-inline';
            box.style.cursor = 'pointer';
            box.style.transition = 'all 0.2s ease';
            box.style.padding = '4px 8px';
            box.style.borderRadius = '8px';
            box.title = 'Уровни и XP';
            box.onclick = () => {
                // Сначала пробуем через window (если stats-ui загружен)
                if (window.openLevelInfoModal) {
                    window.openLevelInfoModal();
                } else {
                    // Иначе загружаем stats-ui
                    import('../srs/stats-ui.js?v=6.24.0').then(() => {
                        if (window.openLevelInfoModal) {
                            window.openLevelInfoModal();
                        } else {
                            console.error('openLevelInfoModal not available');
                        }
                    }).catch(err => {
                        console.error('Failed to load stats-ui.js:', err);
                    });
                }
            };
            box.onmouseover = () => {
                box.style.background = 'rgba(255,159,28,0.15)';
                box.style.boxShadow = '0 0 12px rgba(255,159,28,0.4)';
                box.style.transform = 'translateX(2px)';
                const bar = box.querySelector('.level-inline-bar');
                if (bar) {
                    bar.style.borderColor = 'var(--st-prim)';
                    bar.style.boxShadow = '0 0 8px rgba(255,159,28,0.3)';
                }
            };
            box.onmouseout = () => {
                box.style.background = '';
                box.style.boxShadow = '';
                box.style.transform = '';
                const bar = box.querySelector('.level-inline-bar');
                if (bar) {
                    bar.style.borderColor = '';
                    bar.style.boxShadow = '';
                }
            };
            const data = getCurrentLevel();
            const label = document.createElement('div');
            label.className = 'lv-label';
            label.textContent = `LV:${data.level}`;
            const bar = document.createElement('div');
            bar.className = 'level-inline-bar';
            const fill = document.createElement('div');
            fill.className = 'level-inline-fill';
            const pct = Math.round((data.progress || 0) * 100);
            fill.style.width = `${pct}%`;
            const txt = document.createElement('div');
            txt.className = 'level-inline-text';
            const currentInLevel = Math.max(0, Math.round((data.xp - data.prevThreshold)));
            const totalForLevel = data.nextThreshold === Infinity ? currentInLevel : Math.round(data.nextThreshold - data.prevThreshold);
            txt.textContent = `${currentInLevel}/${totalForLevel}`;
            bar.appendChild(fill); bar.appendChild(txt);
            box.appendChild(label); box.appendChild(bar);
            levelContainer.appendChild(box);
            // Огонёк стрика рядом со шкалой уровня
            const streakRaw = localStorage.getItem('studyStreak') || '{}';
            let streakVal = 0;
            try { const s = JSON.parse(streakRaw); streakVal = s.current || 0; } catch { }
            if (streakVal > 0) {
                const flame = document.createElement('span');
                flame.textContent = `🔥 ${streakVal}`;
                flame.className = 'streak-flame';
                flame.style.fontSize = '12px';
                flame.style.marginLeft = '4px';
                levelContainer.appendChild(flame);
            }
            function updateLevelInline() {
                import('../srs/stats-utils.js').then(({ getCurrentLevel }) => {
                    const d = getCurrentLevel();
                    const cont = levelContainer.querySelector('.level-inline');
                    if (!cont) return;
                    const lbl = cont.querySelector('.lv-label');
                    const fl = cont.querySelector('.level-inline-fill');
                    const tx = cont.querySelector('.level-inline-text');
                    if (lbl) lbl.textContent = `LV:${d.level}`;
                    const p = Math.round((d.progress || 0) * 100);
                    if (fl) fl.style.width = `${p}%`;
                    const cur = Math.max(0, Math.round((d.xp - d.prevThreshold)));
                    const tot = d.nextThreshold === Infinity ? cur : Math.round(d.nextThreshold - d.prevThreshold);
                    if (tx) tx.textContent = `${cur}/${tot}`;

                    // Обновляем имя пользователя
                    const usernameSpan = levelContainer.querySelector('.username-display');
                    if (usernameSpan) {
                        try {
                            const sessionUserRaw = localStorage.getItem('qaSessionUser');
                            if (sessionUserRaw) {
                                const user = JSON.parse(sessionUserRaw);
                                if (user && user.username) {
                                    usernameSpan.textContent = user.username;
                                    usernameSpan.style.color = '#4ec9b0';
                                } else {
                                    usernameSpan.textContent = 'Гость';
                                    usernameSpan.style.color = '#808080';
                                }
                            }
                        } catch (e) { }
                    }
                }).catch(() => { });
            }
            window.addEventListener('xpUpdated', updateLevelInline);
            window.addEventListener('statsClosed', updateLevelInline);
        }).catch(() => { });

        // Инициализация состояния кнопок по сохранённому пользователю
        try { setLoggedUser(loggedInUser); } catch { }

        // Панель корзины (видна только в режиме редактирования)
        const trashPanel = document.createElement('div');
        trashPanel.className = 'trash-panel';
        trashPanel.style.display = 'none';
        trashPanel.style.border = '1px solid #444';
        trashPanel.style.borderRadius = '6px';
        trashPanel.style.padding = '8px';
        trashPanel.style.marginBottom = '8px';
        // Включаем прокрутку независимо от режима
        trashPanel.style.overflowY = 'auto';
        // trashPanel.style.maxHeight удален, управляется CSS
        trashPanel.innerHTML = '<div id="trash-categories" style="margin-top:6px"></div><div id="trash-cards" style="margin-top:6px"></div>';

        // Добавляем элементы в контейнер навигации
        navigationContainer.appendChild(topActions);
        navigationContainer.appendChild(tabsContainer);
        navigationContainer.appendChild(subcategoriesContainer);

        // Вставляем контейнер навигации перед контейнером поиска
        // Вставляем верхнюю панель и корзину перед навигацией
        // container.insertBefore(topControls, searchContainer); // Удалено

        if (container) {
            if (searchContainer && searchContainer.parentNode === container) {
                container.insertBefore(navigationContainer, searchContainer);
            } else {
                console.warn('Search container not found or not in container, appending navigation');
                container.appendChild(navigationContainer);
            }
        } else {
            console.error('Main container not found, cannot insert navigation');
        }

        // Слушаем dataLoaded для обновления корзины после загрузки данных
        document.addEventListener('dataLoaded', () => {
            refreshServerTrash();
        });

        // Делаем refreshServerTrash глобально доступной
        window.refreshServerTrash = refreshServerTrash;

        // Привязываем глобальную ссылку на индикатор сохранения
        // globalSaveStatusEl = saveStatus; // Removed in favor of global toast

        (async () => {
            try {
                const meta = await getServerMetadata();
                if (Array.isArray(meta.categoryOrder)) setCategoryOrder(meta.categoryOrder);
                if (meta.subcategoryOrder && typeof meta.subcategoryOrder === 'object') setSubcategoryOrderMap(meta.subcategoryOrder);
                if (meta.orderOverrides && typeof meta.orderOverrides === 'object') setLS('qaOrderOverrides', meta.orderOverrides);
                // refreshServerTrash() вызывается ПОСЛЕ загрузки данных с сервера (в loadFromServer)
                refreshCategoriesTabs();
            } catch { }
        })();

        // Применяем сохранённый режим редактирования при инициализации
        if (editMode) {
            // 🔥 Добавляем класс on кнопке редактирования
            editToggleBtn.classList.add('on');
            editToggleBtn.title = 'Выключить режим редактирования';

            try {
                const sidebar = document.querySelector('.sidebar');
                if (sidebar) sidebar.classList.remove('collapsed'); // Автоматически разворачиваем при старте в режиме редактирования
                const sidebarButtons = sidebar ? sidebar.querySelector('.sidebar-mode-buttons') : null;
                const searchHistory = sidebar ? sidebar.querySelector('#search-history') : null;
                const existingTrashBtn = sidebarButtons ? sidebarButtons.querySelector('#trash-mode-button') : null;
                if (!existingTrashBtn && sidebarButtons) {
                    const trashBtn = document.createElement('button');
                    trashBtn.id = 'trash-mode-button';
                    trashBtn.title = 'Корзина';
                    trashBtn.setAttribute('aria-label', 'Корзина');
                    trashBtn.className = 'nav-icon-btn';
                    trashBtn.style.padding = '6px';
                    trashBtn.style.minWidth = 'auto';
                    trashBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                        <path d="M9 3h6l1 2h4v2H4V5h4l1-2z" fill="currentColor" />
                        <path d="M6 9h12l-1 10a2 2 0 0 1-2 2H9a 2 2 0 0 1-2-2L6 9z" fill="currentColor" />
                    </svg>`;
                    sidebarButtons.appendChild(trashBtn);
                }
                trashPanel.style.display = 'block';
                if (sidebar && searchHistory) {
                    try { sidebar.insertBefore(trashPanel, searchHistory); } catch { }
                }
                container.classList.add('edit-mode');
                renderTrashPanel();
                refreshCategoryEditMenus();
            } catch { }
        }

        // ===== Локальная авторизация =====
        function ensureDefaultUsers() {
            const raw = localStorage.getItem('usersDB') || '[]';
            let users;
            try { users = JSON.parse(raw); } catch { users = []; }
            if (!Array.isArray(users)) users = [];

            const upsert = (username, password, role) => {
                const idx = users.findIndex(u => u.username === username);
                if (idx >= 0) {
                    users[idx].password = password;
                    users[idx].role = role;
                } else {
                    users.push({ username, password, role });
                }
            };

            upsert('admin', 'admin', 'admin');
            upsert('stas', 'admin', 'user');

            localStorage.setItem('usersDB', JSON.stringify(users));
            const currentRaw = localStorage.getItem('qaSessionUser');
            if (currentRaw) {
                try { loggedInUser = JSON.parse(currentRaw); } catch { }
            }
            updateLoginBtnState();
        }

        const DATA_KEYS = [
            'srsProgress', 'studyStats', 'studyStreak', 'dailyPoints',
            'dailyBonusPoints', 'dailyDayBonusPoints', 'qaFavorites', 'studyAchievements'
        ];

        async function setLoggedUser(user, token = null) {
            // Переключение Guest -> User (Login)
            if (!loggedInUser && user) {
                // Бэкап данных гостя
                const backup = {};
                DATA_KEYS.forEach(k => backup[k] = localStorage.getItem(k));
                localStorage.setItem('guest_backup', JSON.stringify(backup));

                // Очищаем данные, чтобы загрузить профиль пользователя начисто
                DATA_KEYS.forEach(k => localStorage.removeItem(k));
                localStorage.removeItem('localDataTimestamp');

                // Сохраняем токен если есть
                if (token) {
                    localStorage.setItem('sessionToken', token);
                }
            }

            // Переключение User -> Guest (Logout)
            if (loggedInUser && !user) {
                console.log('[LOGOUT] === НАЧАЛО ВЫХОДА ===');

                // 🔥 Очищаем ключи Telegram авторизации в localStorage
                localStorage.removeItem('qaUsername');
                localStorage.removeItem('qaAuthType');

                // 🔥 Очищаем данные Telegram OAuth в sessionStorage
                sessionStorage.removeItem('tgAuthUser');

                // 🔥 Очищаем сессию Telegram (если вдруг осталась)
                sessionStorage.removeItem('telegramUser');

                // ⚠️ ВАЖНО: Сохраняем ВСЕ данные на сервер ПЕРЕД выходом
                // 🔥 ИСПРАВЛЕНИЕ: Не сохраняем если данные уже сохранены (qaNewItems пуст)
                const newItems = getNewItems();
                const deletedItems = getDeletedItems();
                const hasUnsavedChanges = (newItems && newItems.length > 0) ||
                    (deletedItems && Object.keys(deletedItems).length > 0);

                console.log('[LOGOUT] Проверяем есть ли несохранённые данные:', {
                    hasUnsavedChanges,
                    newItemsCount: newItems?.length || 0,
                    deletedCount: Object.keys(deletedItems || {}).length
                });

                if (hasUnsavedChanges) {
                    console.log('[LOGOUT] Сохраняем данные на сервере перед выходом...');
                    try {
                        await saveMergedToServer();
                    } catch (e) {
                        console.error('[Logout] Failed to save data before logout:', e);
                    }
                } else {
                    console.log('[LOGOUT] Все данные уже сохранены, пропускаем saveMergedToServer');
                }

                // ⚠️ ВАЖНО: Полностью очищаем localStorage пользователя
                // Данные уже сохранены на сервере, при следующем входе загрузим оттуда
                const DATA_KEYS_TO_CLEAR = [
                    // Карточки, избранное, корзина
                    'qaUserCards_admin', 'qaUserCards_jeff', 'qaUserCards_stas',
                    'qaFavorites_admin', 'qaFavorites_jeff', 'qaFavorites_stas',
                    'qaUserTrash_admin', 'qaUserTrash_jeff', 'qaUserTrash_stas',
                    'qaUserCards_guest', 'qaFavorites_guest', 'qaUserTrash_guest',
                    // Админка и overrides
                    'qaAdminOverrides', 'qaNewItems', 'qaDeletedItems',
                    'qaCategoryPlaceholders', 'qaCategoryOrder', 'qaOrderOverrides',
                    // Сессия
                    'localDataTimestamp', 'qaSessionUser', 'sessionToken', 'currentUser',
                    // 🔥 ПРОГРЕСС И ДОСТИЖЕНИЯ (чтобы гость не видел данные админа)
                    'srsProgress', 'studyAchievements', 'studyStreak',
                    'dailyPoints', 'dailyBonusPoints', 'dailyDayBonusPoints',
                    'studyStats'
                ];
                DATA_KEYS_TO_CLEAR.forEach(key => localStorage.removeItem(key));

                console.log('[LOGOUT] localStorage очищен, ключи:', DATA_KEYS_TO_CLEAR);

                // Также очищаем старые ключи без суффиксов
                ['qaUserCards', 'qaFavorites', 'qaUserTrash'].forEach(key => localStorage.removeItem(key));

                // 🔥 Дополнительно очищаем прогресс без суффиксов
                ['srsProgress', 'studyAchievements', 'studyStreak', 'dailyPoints', 'dailyBonusPoints', 'dailyDayBonusPoints', 'studyStats']
                    .forEach(key => localStorage.removeItem(key));

                // ⚠️ ВАЖНО: Удаляем сессию полностью
                clearQaUserCards();

                console.log('[LOGOUT] === ВЫХОД ЗАВЕРШЕН ===');
            }

            loggedInUser = user;
            try {
                const s = JSON.stringify(user);
                if (user) { // Only save if user exists
                    localStorage.setItem('qaSessionUser', s);
                    sessionStorage.removeItem('qaSessionUser');
                } else {
                    localStorage.removeItem('qaSessionUser');
                    sessionStorage.removeItem('qaSessionUser');
                }
            } catch { }
            updateLoginBtnState();
            // Показать/скрыть админские кнопки в зависимости от роли
            try {
                adminUsersBtn.style.display = (user && user.role === 'admin') ? 'inline-block' : 'none';  // Только admin может создавать пользователей
                // editToggleBtn доступен admin и editor
                editToggleBtn.style.display = (user && ['admin', 'editor'].includes(user.role)) ? 'inline-block' : 'none';
                // genStatsBtn доступен только admin
                genStatsBtn.style.display = (user && user.role === 'admin') ? 'inline-block' : 'none';
            } catch { }
            try { migrateDeviceRecordsToUser(); } catch { }
            if (user) {
                import('../srs/storage.js').then(mod => {
                    if (mod && typeof mod.hydrateLocalFromSupabase === 'function') {
                        mod.hydrateLocalFromSupabase().then(() => {
                            const evt = new Event('xpUpdated'); window.dispatchEvent(evt);
                            // Также обновляем избранное
                            window.dispatchEvent(new Event('favoritesUpdated'));
                            // Обновляем UI табов после загрузки данных
                            window.dispatchEvent(new Event('dataLoaded'));
                        }).catch(() => { });
                    }
                }).catch(() => { });
            } else {
                // Если вышли (Guest), тоже обновим UI
                window.dispatchEvent(new Event('xpUpdated'));
                window.dispatchEvent(new Event('favoritesUpdated'));
                // Обновляем имя на "Гость"
                const usernameSpan = document.querySelector('.username-display');
                if (usernameSpan) {
                    usernameSpan.textContent = 'Гость';
                    usernameSpan.style.color = '#808080';
                }
            }
        }

        // Make setLoggedUser available globally for autoLoadUserData
        window.setLoggedUser = setLoggedUser;

        // Auto-load user data on page load if credentials are saved
        // Вызываем с задержкой чтобы все функции были определены
        setTimeout(() => autoLoadUserData(), 1000);

        function openLoginModal() {
            let ov = document.getElementById('login-overlay');
            if (!ov) {
                ov = document.createElement('div');
                ov.id = 'login-overlay';
                ov.style.position = 'fixed';
                ov.style.inset = '0';
                ov.style.background = 'rgba(0, 0, 0, 0.2)';
                ov.style.backdropFilter = 'blur(8px)';
                ov.style.webkitBackdropFilter = 'blur(8px)';
                ov.style.display = 'flex';
                ov.style.alignItems = 'center';
                ov.style.justifyContent = 'center';
                ov.style.zIndex = '5000';
                ov.innerHTML = `
                <div class="glass-card" style="
                    position: relative;
                    background: linear-gradient(135deg, 
                        rgba(255,255,255,0.1) 0%, 
                        rgba(255,255,255,0.05) 50%, 
                        rgba(255,255,255,0.02) 100%);
                    backdrop-filter: blur(40px) saturate(180%);
                    -webkit-backdrop-filter: blur(40px) saturate(180%);
                    padding: 24px 28px;
                    border-radius: 20px;
                    width: 360px;
                    box-shadow: 
                        0 20px 60px rgba(0, 0, 0, 0.3),
                        inset 0 1px 0 rgba(255,255,255,0.2),
                        inset 0 -1px 0 rgba(0,0,0,0.1);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    border-top: 1px solid rgba(255, 255, 255, 0.3);
                    border-left: 1px solid rgba(255, 255, 255, 0.2);
                    overflow: hidden;
                ">
                    <!-- Блик сверху -->
                    <div style="
                        position: absolute;
                        top: 0; left: 0; right: 0;
                        height: 1px;
                        background: linear-gradient(90deg, 
                            transparent, 
                            rgba(255,255,255,0.4), 
                            transparent);
                    "></div>
                    
                    <div style="font-weight:600;margin-bottom:16px;color:#fff;font-size:18px;letter-spacing:-0.3px;text-align:center">Вход</div>
                    <form id="login-form" autocomplete="on" style="display:flex;flex-direction:column;gap:10px">
                        <input id="login-username" name="username" autocomplete="username" placeholder="Логин" style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:#fff;font-size:14px;transition:all 0.2s"/>
                        <div style="position:relative;display:block">
                            <input id="login-password" name="password" autocomplete="current-password" placeholder="Пароль" type="password" style="width:100%;box-sizing:border-box;padding:10px 36px 10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:#fff;font-size:14px;transition:all 0.2s"/>
                            <button type="button" id="login-pass-eye" title="Показать пароль" aria-label="Показать пароль" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);padding:0;border:none;background:transparent;color:rgba(255,255,255,0.6);width:22px;height:22px;cursor:pointer;transition:color 0.2s">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                            </button>
                        </div>
                        <label style="display:flex;gap:8px;align-items:center;font-size:12px;color:rgba(255,255,255,0.6)">
                            <input type="checkbox" id="login-remember" checked style="accent-color:rgba(255,255,255,0.3)"/>
                            Оставаться в системе
                        </label>
                        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
                            <button id="login-cancel" type="button" style="padding:10px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.8);font-size:14px;cursor:pointer;transition:all 0.2s">Отмена</button>
                            <button id="login-submit" type="submit" style="padding:10px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.3);background:linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%);color:#fff;font-weight:600;font-size:14px;cursor:pointer;transition:all 0.2s">Войти</button>
                        </div>
                        <div style="margin-top:16px;border-top:1px solid rgba(255,255,255,0.15);padding-top:16px;display:flex;flex-direction:column;align-items:center;gap:10px">
                            <div style="font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.5px">Или войти через</div>
                            <div style="display:flex;gap:12px;justify-content:center;align-items:center">
                                <!-- Google -->
                                <button id="google-login-btn" type="button" title="Войти через Google" style="width:44px;height:44px;border-radius:12px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                                </button>
                                <!-- GitHub -->
                                <button id="github-login-btn" type="button" title="Войти через GitHub" style="width:44px;height:44px;border-radius:12px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                                </button>
                            </div>
                            <!-- Telegram Login Widget - видимый -->
                            <div id="tg-widget-container" style="margin-top:12px;display:flex;justify-content:center;"></div>
                        </div>
                    </form>
                </div>
            `;
                document.body.appendChild(ov);

                // Добавляем стили для hover-эффектов
                const loginStyles = document.createElement('style');
                loginStyles.textContent = `
                    #login-username:hover,
                    #login-password:hover {
                        background: rgba(255,255,255,0.12) !important;
                        border-color: rgba(255,255,255,0.3) !important;
                    }
                    #login-username:focus,
                    #login-password:focus {
                        background: rgba(255,255,255,0.15) !important;
                        border-color: rgba(255,255,255,0.4) !important;
                        outline: none;
                        box-shadow: 0 0 0 3px rgba(255,255,255,0.1);
                    }
                    #login-pass-eye:hover {
                        color: rgba(255,255,255,0.9) !important;
                    }
                    #login-cancel:hover {
                        background: rgba(255,255,255,0.15) !important;
                        border-color: rgba(255,255,255,0.3) !important;
                        color: #fff !important;
                    }
                    #login-submit:hover {
                        background: linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.2) 100%) !important;
                        border-color: rgba(255,255,255,0.4) !important;
                    }
                    #login-submit:active {
                        transform: scale(0.98);
                    }
                    /* Кнопки соцсетей */
                    #google-login-btn:hover,
                    #github-login-btn:hover,
                    #telegram-login-btn:hover {
                        background: rgba(255,255,255,0.15) !important;
                        border-color: rgba(255,255,255,0.3) !important;
                        transform: translateY(-2px);
                        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    }
                    #google-login-btn:active,
                    #github-login-btn:active,
                    #telegram-login-btn:active {
                        transform: translateY(0) scale(0.95);
                    }
                `;
                document.head.appendChild(loginStyles);

                // === ОБРАБОТЧИКИ ДЛЯ КНОПОК СОЦСЕТЕЙ ===

                // Google кнопка
                const googleBtn = ov.querySelector('#google-login-btn');
                if (googleBtn) {
                    googleBtn.addEventListener('click', function () {
                        console.log('[Google Auth] Button clicked');
                        // Загружаем Google OAuth скрипт
                        const script = document.createElement('script');
                        script.src = 'https://accounts.google.com/gsi/client';
                        script.onload = function () {
                            console.log('[Google Auth] Script loaded, initializing...');
                            // Инициализируем Google OAuth с redirect mode (надёжнее без FedCM)
                            google.accounts.id.initialize({
                                client_id: '862467912934-pjug7gt80qcp3t4rmtjvvu78fa6nukuf.apps.googleusercontent.com',
                                callback: handleGoogleSignIn,
                                auto_select: false,
                                ux_mode: 'redirect'  // Redirect вместо popup (надёжнее)
                            });
                            console.log('[Google Auth] Initialized, redirecting to Google...');
                            // Перенаправляем на Google
                            google.accounts.id.prompt();
                        };
                        script.onerror = function () {
                            console.error('[Google Auth] Script failed to load');
                        };
                        document.body.appendChild(script);
                    });
                }

                // GitHub кнопка - OAuth через popup
                const githubBtn = ov.querySelector('#github-login-btn');
                if (githubBtn) {
                    githubBtn.addEventListener('click', function () {
                        console.log('[GitHub Auth] Button clicked');
                        // Открываем GitHub OAuth в popup окне
                        const popup = window.open(
                            `${BACKEND_URL}/api/auth/github`,
                            'GitHub Auth',
                            'width=600,height=400,left=' + (screen.width / 2 - 300) + ',top=' + (screen.height / 2 - 200)
                        );

                        // Слушаем сообщение от popup
                        const handleMessage = (event) => {
                            if (event.data && event.data.type === 'github-auth') {
                                console.log('[GitHub Auth] Success:', event.data);
                                // Сохраняем данные
                                localStorage.setItem('qaUsername', event.data.username);
                                localStorage.setItem('qaAuthType', 'github');
                                setLoggedUser({ username: event.data.username, role: event.data.role });
                                // Закрываем модальное окно
                                const ov = document.getElementById('login-overlay');
                                if (ov) ov.remove();
                                // Перезагружаем страницу
                                window.location.reload();
                                // Удаляем слушатель
                                window.removeEventListener('message', handleMessage);
                            }
                        };

                        window.addEventListener('message', handleMessage);

                        // Проверяем закрытие popup
                        const checkClosed = setInterval(() => {
                            if (popup.closed) {
                                clearInterval(checkClosed);
                                window.removeEventListener('message', handleMessage);
                            }
                        }, 500);
                    });
                }

                // Telegram Login Widget - загружаем сразу
                const widgetContainer = ov.querySelector('#tg-widget-container');
                console.log('[TG DEBUG] Контейнер виджета найден:', !!widgetContainer);

                if (widgetContainer) {
                    const script = document.createElement('script');
                    script.async = true;
                    script.src = 'https://telegram.org/js/telegram-widget.js?22';
                    script.setAttribute('data-telegram-login', 'ByteCards_bot');
                    script.setAttribute('data-size', 'medium');
                    script.setAttribute('data-radius', '12');
                    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
                    script.setAttribute('data-request-access', 'write');

                    script.onload = () => {
                        console.log('[TG Auth] ✅ Виджет Telegram загружен');
                    };

                    widgetContainer.appendChild(script);
                }

                // Глобальный коллбэк для Google OAuth
                window.handleGoogleSignIn = async function (response) {
                    console.log('[Google Auth] === RESPONSE RECEIVED ===');
                    console.log('[Google Auth] Full response:', JSON.stringify(response, null, 2));

                    try {
                        // Проверяем что credential существует
                        if (!response || !response.credential) {
                            console.error('[Google Auth] No credential in response');
                            alert('Ошибка: Google не вернул токен. Попробуйте ещё раз.');
                            return;
                        }

                        console.log('[Google Auth] Credential received');

                        // Разделяем JWT на части
                        const parts = response.credential.split('.');

                        // Google использует URL-safe base64, нужно заменить - на + и _ на /
                        let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                        const userInfo = JSON.parse(atob(base64));

                        console.log('[Google Auth] User info:', userInfo);

                        // ОТПРАВЛЯЕМ ЛОГИ НА СЕРВЕР
                        console.log('[Google Auth] Sending logs to server...');
                        await fetch('/api/iphone-logs', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                userAgent: navigator.userAgent,
                                url: window.location.href,
                                timestamp: new Date().toISOString(),
                                logs: [
                                    '[Google Auth] === RESPONSE RECEIVED ===',
                                    '[Google Auth] User: ' + userInfo.email,
                                    '[Google Auth] Name: ' + userInfo.name,
                                    '[Google Auth] Google ID: ' + userInfo.sub
                                ]
                            })
                        }).catch(err => console.error('[Google Auth] Failed to send logs:', err));

                        // Отправляем на сервер для авторизации
                        const authUrl = `${BACKEND_URL}/api/auth/google`;
                        console.log('[Google Auth] Sending to:', authUrl);
                        const res = await fetch(authUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                email: userInfo.email,
                                name: userInfo.name,
                                picture: userInfo.picture,
                                googleId: userInfo.sub
                            })
                        });

                        console.log('[Google Auth] Response status:', res.status);
                        const data = await res.json();
                        console.log('[Google Auth] Response data:', data);

                        if (res.ok && data.ok) {
                            console.log('[Google Auth] SUCCESS! Username:', data.username);
                            // Сохраняем данные для автозагрузки
                            localStorage.setItem('qaUsername', data.username);
                            localStorage.setItem('qaAuthType', 'google');
                            setLoggedUser({ username: data.username, role: data.role });

                            // Закрываем модальное окно
                            const ov = document.getElementById('login-overlay');
                            if (ov) ov.remove();

                            // Перезагружаем страницу
                            window.location.reload();
                        } else {
                            console.error('[Google Auth] Server error:', data.error);
                            alert('Ошибка авторизации: ' + (data.error || 'Неизвестная ошибка'));
                        }
                    } catch (e) {
                        console.error('[Google Auth] === ERROR ===');
                        console.error('[Google Auth] Error type:', e.name);
                        console.error('[Google Auth] Error message:', e.message);
                        console.error('[Google Auth] Stack:', e.stack);
                        alert('Ошибка авторизации: ' + e.message);
                    }
                };

                // Глобальный коллбэк для виджета Telegram
                window.onTelegramAuth = async function (user) {
                    console.log('[TG Auth] Данные от Telegram:', user);

                    const authUrl = `${BACKEND_URL}/api/auth/telegram`;

                    try {
                        const res = await fetch(authUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(user)
                        });

                        const data = await res.json();
                        console.log('[TG Auth] Ответ сервера:', data);

                        if (res.ok && data.ok) {
                            // 🔥 НЕ сохраняем данные для автозагрузки - просто входим
                            setLoggedUser({ username: data.username, role: data.role });
                            ov.remove();
                            window.location.reload();
                        } else {
                            // Показываем ошибку
                            if (data.error === 'not_subscribed') {
                                alert('❗ Для входа необходимо подписаться на канал:\n' + TELEGRAM_CHANNEL_ID);
                            } else {
                                alert('Ошибка авторизации: ' + (data.error || 'Неизвестная ошибка'));
                            }
                        }
                    } catch (e) {
                        console.error('[TG Auth] Error:', e);
                        alert('Ошибка авторизации: ' + e.message);
                    }
                };

                ov.querySelector('#login-cancel').addEventListener('click', () => ov.remove());
                ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
                ov.querySelector('#login-pass-eye').addEventListener('click', () => {
                    const inp = ov.querySelector('#login-password');
                    const isPwd = inp.type === 'password';
                    inp.type = isPwd ? 'text' : 'password';
                });
                ov.querySelector('#login-form').addEventListener('submit', async (evt) => {
                    evt.preventDefault();
                    try {
                        const u = ov.querySelector('#login-username').value.trim();
                        const p = ov.querySelector('#login-password').value;
                        const remember = ov.querySelector('#login-remember')?.checked;

                        // Local auth only (локальный сервер)
                        try {
                            // Пробуем войти через локальный API
                            const loginRes = await fetch(`${BACKEND_URL} /api/login`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ username: u, password: p })
                            });

                            if (loginRes.ok) {
                                const loginData = await loginRes.json();
                                if (loginData.ok) {
                                    // Сохраняем username/password для последующей загрузки данных
                                    if (remember) {
                                        localStorage.setItem('qaUsername', u);
                                        localStorage.setItem('qaPassword', p);
                                    }
                                    setLoggedUser({ username: loginData.username, role: loginData.role });
                                    ov.remove();
                                    return;
                                }
                            }
                        } catch (e) {
                        }

                        // Fallback to local users (legacy)
                        const raw = localStorage.getItem('usersDB') || '[]';
                        const users = JSON.parse(raw);
                        const match = users.find(x => x.username === u && x.password === p);
                        if (match) {
                            setLoggedUser({ username: match.username, role: match.role });
                            // Сохраняем credentials для автозагрузки
                            if (remember) {
                                localStorage.setItem('qaUsername', u);
                                localStorage.setItem('qaPassword', p);
                            }
                            ov.remove();
                        } else {
                            alert('Неверный логин или пароль');
                        }
                    } catch {
                        alert('Ошибка входа');
                    }
                });
                // Enter to submit
                const inputs = ov.querySelectorAll('#login-username, #login-password');
                inputs.forEach(inp => {
                    inp.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            ov.querySelector('#login-submit').click();
                        }
                    });
                });
            }
        }

        function openAdminUsersPanel() {
            let ov = document.getElementById('admin-users-overlay');
            if (!ov) {
                ov = document.createElement('div');
                ov.id = 'admin-users-overlay';
                ov.style.position = 'fixed';
                ov.style.inset = '0';
                ov.style.background = 'rgba(0,0,0,0.6)';
                ov.style.display = 'flex';
                ov.style.alignItems = 'center';
                ov.style.justifyContent = 'center';
                ov.style.zIndex = '5000';
                ov.innerHTML = `
            < div style = "background:#2a2a2a;color:#fff;padding:16px 20px;border-radius:10px;width:360px;box-shadow:0 8px 24px rgba(0,0,0,0.35)" >
                    <div style="font-weight:600;margin-bottom:10px">Добавить пользователя</div>
                    <div style="display:flex;flex-direction:column;gap:8px">
                        <input id="new-username" placeholder="Логин" style="padding:8px;border-radius:6px;border:1px solid #444;background:#1f1f1f;color:#fff"/>
                        <input id="new-password" placeholder="Пароль" type="password" style="padding:8px;border-radius:6px;border:1px solid #444;background:#1f1f1f;color:#fff"/>
                        <select id="new-role" style="padding:8px;border-radius:6px;border:1px solid #444;background:#1f1f1f;color:#fff">
                            <option value="user">Пользователь</option>
                            <option value="editor">Редактор</option>
                            <option value="admin">Администратор</option>
                        </select>
                        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">
                            <button id="admin-cancel" style="padding:8px 12px;border-radius:6px;border:1px solid #555;background:#1f1f1f;color:#fff">Отмена</button>
                            <button id="admin-add" style="padding:8px 12px;border-radius:6px;border:1px solid #3b82f6;background:#3b82f6;color:#fff">Добавить</button>
                        </div>
                    </div>
                </div >
            `;
                document.body.appendChild(ov);
                ov.querySelector('#admin-cancel').addEventListener('click', () => ov.remove());
                ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
                ov.querySelector('#admin-add').addEventListener('click', () => {
                    const u = ov.querySelector('#new-username').value.trim();
                    const p = ov.querySelector('#new-password').value;
                    const r = ov.querySelector('#new-role').value;
                    if (!u || !p) { alert('Логин и пароль обязательны'); return; }
                    const client = window.__supabaseClient;
                    (async () => {
                        if (client) {
                            try {
                                const { error } = await client.from('users').upsert({ username: u, password: p, role: r }, { onConflict: 'username' });
                                if (error) throw error;
                                ov.remove();
                                alert('Пользователь добавлен');
                                return;
                            } catch { }
                        }
                        const raw = localStorage.getItem('usersDB') || '[]';
                        let users = [];
                        try { users = JSON.parse(raw); } catch { }
                        if (users.find(x => x.username === u)) { alert('Такой пользователь уже существует'); return; }
                        users.push({ username: u, password: p, role: r });
                        localStorage.setItem('usersDB', JSON.stringify(users));
                        ov.remove();
                        alert('Пользователь добавлен');
                    })();
                });
            }
        }

        function openCloudOverview() {
            const client = window.__supabaseClient;
            if (!client) { alert('Supabase недоступен'); return; }
            let ov = document.getElementById('cloud-overview-overlay');
            if (!ov) {
                ov = document.createElement('div');
                ov.id = 'cloud-overview-overlay';
                ov.style.position = 'fixed';
                ov.style.inset = '0';
                ov.style.background = 'rgba(0,0,0,0.6)';
                ov.style.display = 'flex';
                ov.style.alignItems = 'center';
                ov.style.justifyContent = 'center';
                ov.style.zIndex = '5000';
                ov.innerHTML = `
            < div style = "background:#1f1f1f;color:#fff;padding:16px 20px;border-radius:10px;width:560px;max-width:90vw;box-shadow:0 8px 24px rgba(0,0,0,0.35)" >
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                        <div style="font-weight:600">Supabase данные</div>
                        <button id="cloud-close" style="padding:6px 10px;border:1px solid #444;background:#111;color:#ddd;border-radius:6px">Закрыть</button>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                        <div>
                            <div style="font-weight:600;margin-bottom:6px">Пользователи</div>
                            <div id="cloud-users" style="max-height:260px;overflow:auto;border:1px solid #333;border-radius:6px;padding:8px"></div>
                        </div>
                        <div>
                            <div style="font-weight:600;margin-bottom:6px">Достижения (daily_stats)</div>
                            <div id="cloud-stats" style="max-height:260px;overflow:auto;border:1px solid #333;border-radius:6px;padding:8px"></div>
                        </div>
                    </div>
                </div >
            `;
                document.body.appendChild(ov);
                ov.querySelector('#cloud-close').addEventListener('click', () => ov.remove());
                ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
            }
            const usersEl = ov.querySelector('#cloud-users');
            const statsEl = ov.querySelector('#cloud-stats');
            usersEl.textContent = 'Загрузка...';
            statsEl.textContent = 'Загрузка...';
            client.from('users').select('*').then(({ data, error }) => {
                if (error) { usersEl.textContent = 'Ошибка'; return; }
                usersEl.innerHTML = (data || []).map(u => `< div > ${u.username} • роль: ${u.role || 'user'}</div > `).join('') || '<div>Пусто</div>';
            }).catch(() => { usersEl.textContent = 'Ошибка'; });
            const loadStats = () => {
                client.from('daily_stats').select('*').order('date', { ascending: false }).limit(50).then(({ data, error }) => {
                    if (error) { statsEl.textContent = 'Ошибка'; return; }
                    const list = data || [];
                    const hasDevices = list.some(s => String(s.user_id || '').startsWith('device_'));
                    const btn = document.createElement('button');
                    btn.textContent = 'Привязать device_* к текущему пользователю';
                    btn.style.cssText = 'margin-bottom:8px;padding:6px 10px;border:1px solid #444;background:#111;color:#ddd;border-radius:6px';
                    statsEl.innerHTML = '';
                    if (hasDevices) {
                        statsEl.appendChild(btn);
                        btn.addEventListener('click', async () => {
                            btn.disabled = true;
                            btn.textContent = 'Миграция...';
                            let result = null;
                            try { result = await migrateDeviceRecordsToUser(); } catch { }
                            btn.disabled = false;
                            const d = (result && typeof result.daily === 'number') ? result.daily : 0;
                            const c = (result && typeof result.cards === 'number') ? result.cards : 0;
                            window.__cloudLastMigration = { daily: d, cards: c, at: Date.now() };
                            btn.textContent = `Готово: достижения ${d}, карточки ${c} `;
                            setTimeout(() => { btn.textContent = 'Привязать device_* к текущему пользователю'; }, 1800);
                            loadStats();
                        });
                    }
                    if (window.__cloudLastMigration && typeof window.__cloudLastMigration.daily === 'number') {
                        const info = document.createElement('div');
                        info.style.cssText = 'margin:6px 0;padding:6px 10px;border:1px solid #444;background:#222;color:#ddd;border-radius:6px';
                        info.textContent = `Последняя миграция: достижения ${window.__cloudLastMigration.daily}, карточки ${window.__cloudLastMigration.cards} `;
                        statsEl.appendChild(info);
                        // очистить через короткое время, чтобы не мешало
                        setTimeout(() => { try { delete window.__cloudLastMigration; } catch { } }, 2500);
                    }
                    const rows = list.map(s => `< div > ${s.user_id} • ${s.date} • xp:${s.xp} • бонус:${s.bonus} • день:${s.day_bonus} • стрик:${s.streak}</div > `).join('');
                    statsEl.innerHTML += rows || '<div>Пусто</div>';
                }).catch(() => { statsEl.textContent = 'Ошибка'; });
            };
            loadStats();
        }

        async function migrateDeviceRecordsToUser() {
            try {
                const client = window.__supabaseClient;
                if (!client) return { daily: 0, cards: 0 };
                if (!loggedInUser) { return { daily: 0, cards: 0 }; }
                const targetId = loggedInUser.id || loggedInUser.email || loggedInUser.username;
                if (!targetId) return { daily: 0, cards: 0 };
                const { data: ds } = await client.from('daily_stats').select('user_id,date,xp,bonus,day_bonus,streak').like('user_id', 'device_%');
                let dailyMigrated = 0;
                for (const row of ds || []) {
                    try {
                        const { error } = await client.from('daily_stats').upsert({
                            user_id: targetId,
                            date: row.date,
                            xp: row.xp,
                            bonus: row.bonus,
                            day_bonus: row.day_bonus,
                            streak: row.streak
                        }, { onConflict: 'user_id,date' });
                        if (!error) dailyMigrated++;
                    } catch { }
                    try { await client.from('daily_stats').delete().eq('user_id', row.user_id).eq('date', row.date); } catch { }
                }
                const { data: cp } = await client.from('card_progress').select('user_id,question,due_date,interval,repetitions,ease_factor,last_reviewed,last_reviewed_time').like('user_id', 'device_%');
                let cardsMigrated = 0;
                for (const row of cp || []) {
                    try {
                        const { error } = await client.from('card_progress').upsert({
                            user_id: targetId,
                            question: row.question,
                            due_date: row.due_date,
                            interval: row.interval,
                            repetitions: row.repetitions,
                            ease_factor: row.ease_factor,
                            last_reviewed: row.last_reviewed,
                            last_reviewed_time: row.last_reviewed_time
                        }, { onConflict: 'user_id,question' });
                        if (!error) cardsMigrated++;
                    } catch { }
                    try { await client.from('card_progress').delete().eq('user_id', row.user_id).eq('question', row.question); } catch { }
                }
                return { daily: dailyMigrated, cards: cardsMigrated };
            } catch { }
            return { daily: 0, cards: 0 };
        }
        // Функции меню категорий в режиме редактирования
        function refreshCategoryEditMenus() {
            const tabs = tabsContainer.querySelectorAll('.tab');
            tabs.forEach(tab => {
                const cId = tab.dataset.category;
                if (cId === 'all' || cId === 'favorites') return;
                const prevBtn = tab.querySelector('.cat-menu-btn');
                if (prevBtn) prevBtn.remove();
                if (!editMode) return;
                const btn = document.createElement('button');
                btn.className = 'cat-menu-btn';
                btn.title = 'Меню категории';
                btn.textContent = '⋮';
                // Стили перенесены в CSS
                tab.appendChild(btn);
                btn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    openCategoryMenu(tab, cId);
                });
            });
        }

        // Перерисовка табов категорий
        function refreshCategoriesTabs(oldName = null, newName = null) {
            // 🔥 Обновляем categories из актуальных данных
            categories = buildCategoriesFromData(getRuntimeData());

            const active = tabsContainer.querySelector('.tab.active');
            const activeId = active?.dataset?.category || 'all';
            tabsContainer.innerHTML = '';
            const allTab = document.createElement('div');
            allTab.className = 'tab';
            allTab.dataset.category = 'all';
            allTab.textContent = 'Все вопросы';
            tabsContainer.appendChild(allTab);
            const favTab = document.createElement('div');
            favTab.className = 'tab';
            favTab.dataset.category = 'favorites';
            favTab.textContent = '★';
            tabsContainer.appendChild(favTab);
            const cats = buildCategoriesFromData(getRuntimeData());
            // Применяем сохранённый порядок категорий, если он есть
            try {
                const order = getCategoryOrder();
                if (order && order.length) {
                    const idx = new Map(order.map((name, i) => [name, i]));
                    cats.sort((a, b) => (idx.get(a.name) ?? 1e9) - (idx.get(b.name) ?? 1e9));
                }
            } catch { }
            cats.forEach(category => {
                const tab = document.createElement('div');
                tab.className = 'tab';
                tab.dataset.category = category.id;
                tab.textContent = category.displayName || category.name;
                tabsContainer.appendChild(tab);
            });
            // Восстанавливаем активный таб, если возможно
            const toActivate = tabsContainer.querySelector(`.tab[data-category="${activeId}"]`) || allTab;
            toActivate.classList.add('active');
            // Обновляем меню редактирования
            refreshCategoryEditMenus();
            // Включаем перетаскивание категорий в режиме редактирования
            if (editMode) {
                const catsNow = Array.from(tabsContainer.querySelectorAll('.tab'))
                    .filter(el => el.dataset.category !== 'all' && el.dataset.category !== 'favorites');
                const nameById = new Map();
                buildCategoriesFromData(getRuntimeData()).forEach(c => nameById.set(String(c.id), c.name));
                const currentOrder = catsNow.map(el => nameById.get(String(el.dataset.category))).filter(Boolean);
                catsNow.forEach((el) => {
                    el.setAttribute('draggable', 'true');
                    el.addEventListener('dragstart', (ev) => {
                        ev.dataTransfer.setData('text/plain', el.dataset.category);
                    });
                    el.addEventListener('dragover', (ev) => { ev.preventDefault(); });
                    el.addEventListener('drop', (ev) => {
                        ev.preventDefault();
                        const fromCatId = ev.dataTransfer.getData('text/plain');
                        const toCatId = el.dataset.category;
                        if (!fromCatId || !toCatId || fromCatId === toCatId) return;
                        const fromName = nameById.get(String(fromCatId));
                        const toName = nameById.get(String(toCatId));
                        if (!fromName || !toName) return;
                        const names = [...currentOrder];
                        const fromIdx = names.indexOf(fromName);
                        const toIdx = names.indexOf(toName);
                        if (fromIdx < 0 || toIdx < 0) return;
                        const [moved] = names.splice(fromIdx, 1);
                        names.splice(toIdx, 0, moved);
                        setCategoryOrder(names);
                        (async () => {
                            setSaveStatus('saving', 'Сохранение порядка категорий...');
                            const meta = await getServerMetadata();
                            meta.categoryOrder = names;
                            const ok = await updateServerMetadata(meta);
                            setSaveStatus(ok ? 'success' : 'error', ok ? 'Порядок сохранён' : 'Ошибка сохранения');
                            refreshCategoriesTabs();
                        })();
                    });
                });
            }
        }

        function openCategoryMenu(tabEl, categoryId) {
            const categoriesList = buildCategoriesFromData(getRuntimeData());
            const catObj = categoriesList.find(c => String(c.id) === String(categoryId));
            if (!catObj) return;
            document.querySelectorAll('.popup-menu').forEach(m => m.remove());
            const menu = document.createElement('div');
            menu.className = 'popup-menu';
            menu.style.position = 'fixed';
            menu.style.background = '#222';
            menu.style.color = '#ddd';
            menu.style.border = '1px solid #444';
            menu.style.borderRadius = '6px';
            menu.style.padding = '6px';
            menu.style.zIndex = '1000';
            menu.innerHTML = `
            < button data - act="rename" > Переименовать</button >
            <button data-act="duplicate">Дублировать</button>
            <button data-act="delete">Удалить</button>
        `;
            document.body.appendChild(menu);
            const rect = tabEl.getBoundingClientRect();
            menu.style.left = `${rect.right + 6} px`;
            menu.style.top = `${rect.top} px`;
            const onDocClick = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', onDocClick); } };
            document.addEventListener('click', onDocClick);
            menu.addEventListener('click', async (e) => {
                const act = e.target?.dataset?.act;
                if (!act) return;
                e.stopPropagation();
                if (act === 'rename') {
                    const newName = prompt('Новое название категории:', catObj.name);
                    if (newName && newName !== catObj.name) {
                        const ov = getOverrides();
                        uniqueQaData.forEach(it => { if (it.category === catObj.name) { ov[it.question] = { ...ov[it.question], category: newName }; } });
                        setLS('qaAdminOverrides', ov);
                        // Автосохранение
                        saveMergedToServer();
                        // Перерисовываем табы, чтобы сразу увидеть новое имя
                        refreshCategoriesTabs(catObj.name, newName);
                        setSaveStatus('success', 'Категория переименована');
                    }
                } else if (act === 'duplicate') {
                    const dupName = prompt('Название копии категории:', `${catObj.name} (копия)`);
                    if (!dupName) return;
                    const placeholders = getCategoryPlaceholders();
                    if (!placeholders[dupName]) placeholders[dupName] = { _cid: Date.now(), sub: [] };
                    const newItemsArr = getNewItems();
                    getRuntimeData().filter(it => it.category === catObj.name).forEach(it => {
                        const newQuestion = genUniqueQuestionGlobal(it.question);
                        newItemsArr.push({ ...it, category: dupName, question: newQuestion });
                    });
                    setLS('qaNewItems', newItemsArr);
                    setCategoryPlaceholders(placeholders);
                    saveMergedToServer();
                    // Перерисовываем табы, чтобы сразу появилась новая категория
                    refreshCategoriesTabs();
                    setSaveStatus('success', 'Категория дублирована');
                } else if (act === 'delete') {
                    if (!confirm('Удалить категорию в корзину?')) return;
                    const trashCats = getLS('qaTrashCategories', '{}');
                    trashCats[catObj.name] = true;
                    setLS('qaTrashCategories', trashCats);
                    const delMap = getDeletedItems();
                    const itemsToTrash = getRuntimeData().filter(it => it.category === catObj.name);
                    itemsToTrash.forEach(it => { delMap[it.question] = true; });
                    setDeletedItems(delMap);
                    try {
                        const ok = await moveToServerTrash(itemsToTrash);
                        if (ok) {
                            itemsToTrash.forEach(it => serverTrashSet.add(it.question));
                            await refreshServerTrash();
                        }
                    } catch { }
                    renderTrashPanel();
                    saveMergedToServer();
                    refreshCategoriesTabs();
                    setSaveStatus('success', 'Категория удалена в корзину');
                }
                menu.remove();
            });
        }

        // Меню подкатегорий в режиме редактирования
        function refreshSubcategoryEditMenus(categoryName) {
            const cards = subcategoriesContainer.querySelectorAll('.subcategory-card');
            cards.forEach(card => {
                const subId = card.dataset.subcategory;
                if (subId === 'all') return;
                const prevBtn = card.querySelector('.subcat-menu-btn');
                if (prevBtn) prevBtn.remove();
                if (!editMode) return;
                const btn = document.createElement('button');
                btn.className = 'subcat-menu-btn';
                btn.title = 'Меню подкатегории';
                btn.textContent = '⋮';
                btn.style.marginLeft = '8px';
                // Тёмно-серый стиль
                btn.style.background = '#444';
                btn.style.color = '#eee';
                btn.style.border = '1px solid #333';
                btn.style.borderRadius = '4px';
                btn.style.padding = '2px 6px';
                btn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    const originalName = card.dataset.subcatOriginalName || card.textContent;
                    openSubcategoryMenu(card, categoryName, originalName);
                });
                card.appendChild(btn);
            });
        }

        function openSubcategoryMenu(cardEl, categoryName, subcatName) {
            document.querySelectorAll('.popup-menu').forEach(m => m.remove());
            const menu = document.createElement('div');
            menu.className = 'popup-menu';
            menu.style.position = 'fixed';
            menu.style.background = '#222';
            menu.style.color = '#ddd';
            menu.style.border = '1px solid #444';
            menu.style.borderRadius = '6px';
            menu.style.padding = '6px';
            menu.style.zIndex = '1000';
            menu.innerHTML = `
            < button data - act="rename" > Переименовать</button >
            <button data-act="duplicate">Дублировать</button>
            <button data-act="delete">Удалить</button>
        `;
            document.body.appendChild(menu);
            const rect = cardEl.getBoundingClientRect();
            menu.style.left = `${rect.right + 6} px`;
            menu.style.top = `${rect.top} px`;
            const onDocClick = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', onDocClick); } };
            document.addEventListener('click', onDocClick);
            menu.addEventListener('click', async (e) => {
                const act = e.target?.dataset?.act; if (!act) return;
                e.stopPropagation();
                if (act === 'rename') {
                    const newName = prompt('Новое название подкатегории:', subcatName);
                    if (newName && newName !== subcatName) {
                        const scPlaceholders = getSubcategoryPlaceholders();
                        if (!scPlaceholders[categoryName]) scPlaceholders[categoryName] = {};
                        scPlaceholders[categoryName][subcatName] = { displayName: newName };
                        setSubcategoryPlaceholders(scPlaceholders);
                        // Обновляем все карточки этой подкатегории через overrides
                        const ov = getOverrides();
                        getRuntimeData().forEach(it => {
                            if (it.category === categoryName && it.subcategory === subcatName) {
                                ov[it.question] = { ...ov[it.question], subcategory: newName };
                            }
                        });
                        setLS('qaAdminOverrides', ov);
                        rebuildSubcategoriesForCategory(categoryName);
                        saveMergedToServer();
                        setSaveStatus('success', 'Подкатегория переименована');
                    }
                } else if (act === 'duplicate') {
                    const dupName = prompt('Название копии подкатегории:', `${subcatName} (копия)`);
                    if (!dupName) return;
                    const newItemsArr = getNewItems();
                    getRuntimeData().filter(it => it.category === categoryName && it.subcategory === subcatName)
                        .forEach(it => {
                            const newQuestion = genUniqueQuestionGlobal(it.question);
                            newItemsArr.push({ ...it, subcategory: dupName, question: newQuestion });
                        });
                    setLS('qaNewItems', newItemsArr);
                    // Добавляем плейсхолдер отображения
                    const scPlaceholders = getSubcategoryPlaceholders();
                    if (!scPlaceholders[categoryName]) scPlaceholders[categoryName] = {};
                    scPlaceholders[categoryName][dupName] = { displayName: dupName };
                    setSubcategoryPlaceholders(scPlaceholders);

                    // Force full refresh to ensure data visibility
                    refreshCategoriesTabs();
                    rebuildSubcategoriesForCategory(categoryName);

                    saveMergedToServer();
                    setSaveStatus('success', 'Подкатегория дублирована');
                } else if (act === 'delete') {
                    if (!confirm('Удалить подкатегорию в корзину?')) { menu.remove(); return; }
                    const delMap = getDeletedItems();
                    const itemsToTrash = getRuntimeData().filter(it => it.category === categoryName && it.subcategory === subcatName);
                    itemsToTrash.forEach(it => { delMap[it.question] = true; });
                    setDeletedItems(delMap);
                    try {
                        const ok = await moveToServerTrash(itemsToTrash);
                        if (ok) {
                            itemsToTrash.forEach(it => serverTrashSet.add(it.question));
                            await refreshServerTrash();
                        }
                    } catch { }
                    renderTrashPanel();
                    saveMergedToServer();
                    rebuildSubcategoriesForCategory(categoryName);
                    setSaveStatus('success', 'Подкатегория удалена в корзину');
                }
                menu.remove();
            });
        }

        // Перестроить список подкатегорий для выбранной категории
        function rebuildSubcategoriesForCategory(categoryName) {
            const allCats = buildCategoriesFromData(getRuntimeData());
            const catObj = allCats.find(c => c.name === categoryName);
            if (!catObj) return;
            subcategoriesContainer.style.display = 'flex';
            subcategoriesContainer.innerHTML = '';
            const allCard = document.createElement('div');
            allCard.className = 'subcategory-card active';
            allCard.dataset.subcategory = 'all';
            allCard.textContent = 'Все подкатегории';
            subcategoriesContainer.appendChild(allCard);
            const scPlaceholders = getSubcategoryPlaceholders();
            try {
                const scOrder = getSubcategoryOrderFor(categoryName);
                if (scOrder && scOrder.length) {
                    const idx = new Map(scOrder.map((name, i) => [name, i]));
                    catObj.subcategories.sort((a, b) => (idx.get(a.name) ?? 1e9) - (idx.get(b.name) ?? 1e9));
                }
            } catch { }
            catObj.subcategories.forEach(subcategory => {
                const card = document.createElement('div');
                card.className = 'subcategory-card';
                card.dataset.subcategory = subcategory.id;
                const activeTab = tabsContainer.querySelector('.tab.active');
                card.dataset.category = activeTab?.dataset?.category || '';
                const displayName = (scPlaceholders[categoryName] && scPlaceholders[categoryName][subcategory.name] && scPlaceholders[categoryName][subcategory.name].displayName) || subcategory.name;
                card.dataset.subcatOriginalName = subcategory.name;
                card.textContent = displayName;
                subcategoriesContainer.appendChild(card);
            });
            refreshSubcategoryEditMenus(categoryName);
            if (editMode) {
                const cards = Array.from(subcategoriesContainer.querySelectorAll('.subcategory-card')).filter(c => c.dataset.subcategory !== 'all');
                const currentOrder = cards.map(c => c.dataset.subcatOriginalName);
                cards.forEach(el => {
                    el.setAttribute('draggable', 'true');
                    el.addEventListener('dragstart', (ev) => {
                        ev.dataTransfer.setData('text/plain', el.dataset.subcatOriginalName);
                    });
                    el.addEventListener('dragover', (ev) => { ev.preventDefault(); });
                    el.addEventListener('drop', (ev) => {
                        ev.preventDefault();
                        const fromName = ev.dataTransfer.getData('text/plain');
                        const toName = el.dataset.subcatOriginalName;
                        if (!fromName || !toName || fromName === toName) return;
                        const names = [...currentOrder];
                        const fromIdx = names.indexOf(fromName);
                        const toIdx = names.indexOf(toName);
                        if (fromIdx < 0 || toIdx < 0) return;
                        const [moved] = names.splice(fromIdx, 1);
                        names.splice(toIdx, 0, moved);
                        setSubcategoryOrderFor(categoryName, names);
                        (async () => {
                            setSaveStatus('saving', 'Сохранение порядка подкатегорий...');
                            const meta = await getServerMetadata();
                            meta.subcategoryOrder = meta.subcategoryOrder || {};
                            meta.subcategoryOrder[categoryName] = names;
                            const ok = await updateServerMetadata(meta);
                            setSaveStatus(ok ? 'success' : 'error', ok ? 'Порядок сохранён' : 'Ошибка сохранения');
                            rebuildSubcategoriesForCategory(categoryName);
                        })();
                    });
                });
            }
        }

        function renderTrashPanel() {
            if (!editMode) return;
            const catDiv = trashPanel.querySelector('#trash-categories');
            const cardDiv = trashPanel.querySelector('#trash-cards');
            catDiv.innerHTML = '<div><strong>Категории:</strong></div><div>Пусто</div>';
            // Список удалённых вопросов + сортировка по оригинальному порядку ("Все вопросы")
            const deletedCards = serverTrashItems.map(t => t.item?.question).filter(Boolean);
            const baseOrder = getOrderForContext('all') || getRuntimeData().map(i => i.question);
            const idxMap = new Map(baseOrder.map((q, i) => [q, i]));
            const sortedTrash = [...serverTrashItems].sort((a, b) =>
                (idxMap.get(a.item?.question) ?? 1e9) - (idxMap.get(b.item?.question) ?? 1e9)
            );
            // Header + grid container
            cardDiv.innerHTML = '';
            const header = document.createElement('div');
            header.innerHTML = '<strong>Карточки:</strong>' + (deletedCards.length ? '' : ' <span>Пусто</span>');
            cardDiv.appendChild(header);
            const grid = document.createElement('div');
            grid.className = 'trash-cards-grid';
            cardDiv.appendChild(grid);

            sortedTrash.forEach(entry => {
                const q = entry.item?.question;
                const it = entry.item || uniqueQaData.find(i => i.question === q) || getNewItems().find(i => i.question === q);
                const mini = document.createElement('div');
                mini.className = 'result-item trash-mini';

                // Верхняя зона: теги (категория, подкатегория)
                const meta = document.createElement('div');
                meta.className = 'trash-meta';
                meta.style.display = 'flex';
                meta.style.flexWrap = 'wrap';
                meta.style.gap = '6px';
                const catBadge = document.createElement('span'); catBadge.className = 'category-badge'; catBadge.textContent = (it && it.category) ? it.category : '';
                const subBadge = document.createElement('span'); subBadge.className = 'subcategory-badge'; subBadge.textContent = (it && it.subcategory) ? it.subcategory : '';
                meta.appendChild(catBadge); meta.appendChild(subBadge);

                // Вопрос - применяем форматирование
                const qText = document.createElement('div');
                qText.className = 'question';
                const questionFormatting = it?.formatting?.question || [];
                qText.innerHTML = applyFormatting(it?.question || q, questionFormatting);
                qText.style.marginTop = '6px';

                // Ответ - применяем форматирование
                const aEl = document.createElement('div');
                aEl.className = 'answer';
                const answerFormatting = it?.formatting?.answer || [];
                aEl.innerHTML = applyFormatting(it?.answer || '', answerFormatting);
                aEl.style.marginTop = '6px';

                // Действия (восстановить / удалить навсегда) внизу
                const actions = document.createElement('div');
                actions.className = 'trash-actions';
                actions.style.display = 'flex';
                actions.style.gap = '8px';
                actions.style.marginTop = '8px';
                const restoreBtn = document.createElement('button'); restoreBtn.className = 'restore-btn'; restoreBtn.textContent = 'Восстановить';
                const purgeBtn = document.createElement('button'); purgeBtn.className = 'purge-btn'; purgeBtn.textContent = 'Удалить навсегда';
                actions.appendChild(restoreBtn);
                actions.appendChild(purgeBtn);

                mini.appendChild(meta);
                mini.appendChild(qText);
                mini.appendChild(aEl);
                mini.appendChild(actions);

                // Оптимистичное восстановление с сохранением на сервер
                restoreBtn.addEventListener('click', async () => {
                    restoreBtn.textContent = 'Восстановление...'; restoreBtn.disabled = true;

                    // Находим карточку в serverTrashItems, чтобы получить её данные
                    const trashItem = serverTrashItems.find(t => t.item?.question === q);
                    const itemData = trashItem?.item;

                    // Удаляем из локального кэша корзины сразу
                    serverTrashSet.delete(q);
                    serverTrashItems = serverTrashItems.filter(t => t.item?.question !== q);
                    // Очищаем локальную карту удалений для этой карточки, если была помечена
                    const delMap = getDeletedItems();
                    if (delMap && delMap[q]) { delete delMap[q]; setDeletedItems(delMap); }

                    // 🔥 ВАЖНО: Если карточки нет в uniqueQaData (дубликат), добавляем её в qaNewItems
                    const isInUnique = !!uniqueQaData.find(i => i.question === q);
                    if (!isInUnique && itemData) {
                        const newItems = getNewItems();
                        // Проверяем, нет ли уже такой карточки в newItems
                        if (!newItems.some(n => n.question === q)) {
                            newItems.push(itemData);
                            localStorage.setItem('qaNewItems', JSON.stringify(newItems));
                        }
                    }

                    // 🔥 ВОЗВРАЩАЕМ карточку в qaUserCards если она была удалена
                    const userCards = getQaUserCards();
                    if (userCards && !userCards.some(c => c.question === q) && itemData) {
                        // Ищем позицию где была карточка (по индексу в serverTrashItems)
                        const trashIndex = serverTrashItems.findIndex(t => t.item?.question === q);
                        if (trashIndex >= 0) {
                            // Вставляем на примерную позицию
                            userCards.push(itemData);
                            setQaUserCards(userCards);
                        }
                    }

                    renderTrashPanel();
                    // Обновляем без сброса контекста
                    refreshCurrentContext();
                    // Пытаемся восстановить на сервере
                    let restoreOk = false;
                    try { restoreOk = await restoreFromServerTrash([q]); } catch (_) { restoreOk = false; }
                    if (!restoreOk) {
                        // Обновляем корзину с сервера на случай рассинхронизации
                        try { await refreshServerTrash(); } catch (_) { }
                        setSaveStatus('error', 'Сервер восстановления недоступен');
                        restoreBtn.textContent = 'Восстановить'; restoreBtn.disabled = false;
                    } else {
                        // Карточка уже восстановлена
                        setSaveStatus('success', 'Карточка восстановлена');
                        restoreBtn.textContent = 'Готово'; setTimeout(() => { restoreBtn.textContent = 'Восстановить'; restoreBtn.disabled = false; }, 1500);
                    }
                });

                // Окончательное удаление
                purgeBtn.addEventListener('click', async () => {
                    purgeBtn.textContent = 'Удаление...'; purgeBtn.disabled = true;

                    // 🔒 Получаем username
                    const sessionUserRaw = localStorage.getItem('qaSessionUser');
                    let username = 'guest';
                    try {
                        const u = JSON.parse(sessionUserRaw);
                        if (u && u.username) username = u.username;
                    } catch { }

                    try {
                        const resp = await fetch(`${BACKEND_URL}/delete-permanent?user=${encodeURIComponent(username)}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ questions: [q] })
                        });
                        if (resp.ok) {
                            // Удаляем из серверной корзины и локальных кэшей
                            serverTrashSet.delete(q);
                            serverTrashItems = serverTrashItems.filter(t => t.item?.question !== q);
                            // Помечаем как удалённый локально
                            const delMap = getDeletedItems(); delMap[q] = true; setDeletedItems(delMap);
                            // Если карточка была среди новых, удалим её
                            const newArr = getNewItems().filter(i => i.question !== q); setLS('qaNewItems', newArr);

                            // 🔒 Обновляем localStorage с корзиной
                            const localTrash = localStorage.getItem('qaUserTrash');
                            if (localTrash) {
                                const trash = JSON.parse(localTrash);
                                const newTrash = trash.filter(t => t.item?.question !== q);
                                localStorage.setItem('qaUserTrash', JSON.stringify(newTrash));
                            }

                            // Обновляем UI
                            renderTrashPanel();
                            refreshCurrentContext();
                            try { await saveMergedToServer(); } catch { }
                            setSaveStatus('success', 'Карточка удалена навсегда');
                        } else {
                            const error = await resp.text();
                            console.error('[delete-permanent] Ошибка:', resp.status, error);
                            setSaveStatus('error', 'Ошибка: ' + error);
                        }
                    } catch (e) {
                        console.error('[delete-permanent] Ошибка:', e);
                        setSaveStatus('error', 'Сервер удаления недоступен');
                    }
                    purgeBtn.textContent = 'Удалить навсегда'; purgeBtn.disabled = false;
                });

                grid.appendChild(mini);
            });
        }

        // Удалена старая логика второго модального окна входа

        editToggleBtn.addEventListener('click', () => {
            editMode = !editMode;

            // 🔥 Переключаем визуальный стиль кнопки
            if (editMode) {
                editToggleBtn.classList.add('on');
                editToggleBtn.title = 'Выключить режим редактирования';
            } else {
                editToggleBtn.classList.remove('on');
                editToggleBtn.title = 'Включить режим редактирования';
            }

            // В режиме редактирования отключаем авто-нормализацию категорий при загрузке
            try { setNormalizationDisabled(editMode); } catch { }
            // Позиция кнопок ✎ и Вход НЕ меняется — остаются над категориями
            // Показать/скрыть панель корзины и перенести её в левую боковую панель
            const sidebar = document.querySelector('.sidebar');
            const sidebarButtons = sidebar ? sidebar.querySelector('.sidebar-mode-buttons') : null;
            const searchHistory = sidebar ? sidebar.querySelector('#search-history') : null;
            if (editMode) {
                if (sidebar) sidebar.classList.remove('collapsed'); // Автоматически разворачиваем при включении режима
                trashPanel.style.display = 'block';
                // добавить квадрат с иконкой мусорного ведра в заголовок боковой панели
                if (sidebarButtons && !sidebarButtons.querySelector('#trash-mode-button')) {
                    const trashBtn = document.createElement('button');
                    trashBtn.id = 'trash-mode-button';
                    trashBtn.title = 'Корзина';
                    trashBtn.setAttribute('aria-label', 'Корзина');
                    trashBtn.className = 'nav-icon-btn';
                    trashBtn.style.padding = '6px';
                    trashBtn.style.minWidth = 'auto';
                    trashBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                        <path d="M9 3h6l1 2h4v2H4V5h4l1-2z" fill="currentColor" />
                        <path d="M6 9h12l-1 10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 9z" fill="currentColor" />
                    </svg>`;
                    sidebarButtons.appendChild(trashBtn);
                }
                // перенести саму панель корзины в левую панель, сразу под заголовком
                if (sidebar && searchHistory) {
                    try { sidebar.insertBefore(trashPanel, searchHistory); } catch { }
                }
                container.classList.add('edit-mode');
            } else {
                trashPanel.style.display = 'none';
                // убрать индикатор корзины из заголовка боковой панели
                const existingTrashBtn = sidebarButtons ? sidebarButtons.querySelector('#trash-mode-button') : null;
                if (existingTrashBtn) existingTrashBtn.remove();
                container.classList.remove('edit-mode');
            }
            try { localStorage.setItem('qaEditMode', editMode ? 'true' : 'false'); } catch { }
            refreshCategoryEditMenus();
            // Обновляем вкладки категорий, чтобы включить/отключить перетаскивание
            refreshCategoriesTabs();
            renderTrashPanel();
            refreshCurrentContext();
        });

        // Обработчики панели управления - удалены (legacy)


        function setSaveStatus(state, msg) {
            const statusEl = document.getElementById('global-toast-notification') || (() => {
                const el = document.createElement('div');
                el.id = 'global-toast-notification';
                el.style.position = 'fixed';
                el.style.top = '20px';
                el.style.left = '50%';
                el.style.transform = 'translateX(-50%)';
                el.style.zIndex = '9999';
                el.style.padding = '8px 16px';
                el.style.borderRadius = '6px';
                el.style.fontSize = '14px';
                el.style.fontWeight = '500';
                el.style.display = 'none';
                el.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
                document.body.appendChild(el);
                return el;
            })();

            if (state === 'saving') {
                statusEl.style.display = 'block';
                statusEl.style.background = '#333';
                statusEl.style.color = '#eee';
                statusEl.style.border = '1px solid #444';
                statusEl.textContent = msg || 'Сохранение...';
            } else if (state === 'success') {
                statusEl.style.display = 'block';
                statusEl.style.background = 'rgba(29, 95, 42, 0.9)'; // Зеленый фон
                statusEl.style.color = '#ffffff';
                statusEl.style.border = '1px solid #2a6b2a';
                statusEl.textContent = msg || 'Сохранено';
                setTimeout(() => { statusEl.style.display = 'none'; }, 1500);
            } else if (state === 'error') {
                statusEl.style.display = 'block';
                statusEl.style.background = 'rgba(122, 26, 26, 0.9)'; // Красный фон
                statusEl.style.color = '#ffffff';
                statusEl.style.border = '1px solid #8b2a2a';
                statusEl.textContent = msg || 'Ошибка сохранения';
                setTimeout(() => { statusEl.style.display = 'none'; }, 4000);
            }
        }

        async function saveMergedToServer() {
            try {
                setSaveStatus('saving');
                const overrides = getOverrides();
                const newItems = getNewItems();
                const deletedMap = getDeletedItems();
                const merged = [];
                const seen = new Set();
                // Базовые элементы + overrides
                uniqueQaData.forEach(item => {
                    if (deletedMap[item.question] || serverTrashSet.has(item.question)) return;
                    const ov = overrides[item.question];
                    const mergedItem = ov ? { ...item, ...ov } : item;
                    merged.push(mergedItem);
                    seen.add(item.question);
                });
                // Новые элементы + их возможные overrides
                newItems.forEach(n => {
                    if (!seen.has(n.question) && !deletedMap[n.question] && !serverTrashSet.has(n.question)) {
                        const ov = overrides[n.question];
                        merged.push(ov ? { ...n, ...ov } : n);
                        seen.add(n.question);
                    }
                });
                // Отправка на сервер
                const resp = await fetchWithAuth('/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(merged)
                });
                let ok = resp.ok;
                let responseJson = null;
                try {
                    responseJson = await resp.json();
                    if (typeof responseJson?.ok === 'boolean') ok = ok && responseJson.ok;
                } catch (_) {
                    // Сервер мог вернуть пустой ответ — ориентируемся только на статус
                }
                if (!ok) throw new Error('Сервер вернул ошибку при сохранении');

                // Успешно сохранили — уведомляем и принудительно перезагружаем данные из JSON
                setSaveStatus('success');
                // Дадим UI чуть обновить состояние, затем инициируем перезагрузку
                setTimeout(() => {
                    window.dispatchEvent(new Event('forceReloadData'));
                }, 50);
                return true;
            } catch (e) {
                console.error('Save failed:', e);
                setSaveStatus('error', 'Ошибка: ' + e.message);
                return false;
            }
        }

        // New server-side helper functions
        async function moveToServerTrash(items) {
            try {
                const resp = await fetchWithAuth('/trash', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: items,
                        deleted_by: loggedInUser?.email || 'anonymous'
                    })
                });
                return resp.ok;
            } catch (e) {
                console.error('Trash operation failed:', e);
                return false;
            }
        }

        async function restoreFromServerTrash(questions) {
            try {
                const resp = await fetchWithAuth('/restore', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ questions: questions })
                });
                return resp.ok;
            } catch (e) {
                console.error('Restore operation failed:', e);
                return false;
            }
        }

        async function trackServerDuplication(originalQuestion, newQuestion) {
            try {
                // Получаем username из сессии
                const sessionUserRaw = localStorage.getItem('qaSessionUser');
                let username = 'anonymous';
                if (sessionUserRaw) {
                    try {
                        const user = JSON.parse(sessionUserRaw);
                        if (user && user.username) username = user.username;
                    } catch { }
                }

                const resp = await fetch(`/duplicate?user=${encodeURIComponent(username)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: [{
                            original_question: originalQuestion,
                            new_question: newQuestion
                        }],
                        duplicated_by: username
                    })
                });
                return resp.ok;
            } catch (e) {
                console.error('Duplicate tracking failed:', e);
                return false;
            }
        }


        function addCategoryPlaceholderFlow() {
            const name = prompt('Название новой категории:');
            if (!name) return;
            const placeholders = getCategoryPlaceholders();
            const id = Math.max(0, ...Object.values(placeholders).map(v => v._cid || 0)) + 1;
            if (!placeholders[name]) placeholders[name] = { _cid: id, sub: [] };
            setCategoryPlaceholders(placeholders);
            alert('Категория добавлена. Появится в меню.');
        }
        function deleteCategoryFlow() {
            const name = prompt('Название категории для удаления:');
            if (!name) return;
            if (!confirm(`Удалить категорию "${name}" и все её карточки?`)) return;
            const placeholders = getCategoryPlaceholders();
            delete placeholders[name];
            setCategoryPlaceholders(placeholders);
            const del = getDeletedItems();
            uniqueQaData.forEach(item => {
                if (item.category === name) del[item.question] = true;
            });
            setDeletedItems(del);
            alert('Категория отмечена как удалённая. Сохраните, чтобы применить.');
        }
        function addSubcategoryFlow() {
            const cat = prompt('Категория:');
            if (!cat) return;
            const sub = prompt('Название новой подкатегории:');
            if (!sub) return;
            const placeholders = getCategoryPlaceholders();
            if (!placeholders[cat]) placeholders[cat] = { _cid: Date.now(), sub: [] };
            const id = Math.max(0, ...placeholders[cat].sub.map(s => s._sid || 0)) + 1;
            placeholders[cat].sub.push({ name: sub, _sid: id });
            setCategoryPlaceholders(placeholders);
            alert('Подкатегория добавлена. Появится в меню.');
        }
        function deleteSubcategoryFlow() {
            const cat = prompt('Категория:');
            if (!cat) return;
            const sub = prompt('Подкатегория для удаления:');
            if (!sub) return;
            const placeholders = getCategoryPlaceholders();
            if (placeholders[cat]) {
                placeholders[cat].sub = placeholders[cat].sub.filter(s => s.name !== sub);
                setCategoryPlaceholders(placeholders);
            }
            const del = getDeletedItems();
            uniqueQaData.forEach(item => {
                if (item.category === cat && item.subcategory === sub) del[item.question] = true;
            });
            setDeletedItems(del);
            alert('Подкатегория отмечена как удалённая. Сохраните, чтобы применить.');
        }

    } catch (e) {
        console.error('CRITICAL ERROR in initTabsNavigation:', e);
        // Show visible error on screen in case console is closed
        const errDiv = document.createElement('div');
        errDiv.style.color = 'red';
        errDiv.style.padding = '20px';
        errDiv.style.border = '1px solid red';
        errDiv.style.margin = '20px';
        errDiv.style.background = '#330000';
        errDiv.textContent = 'Ошибка инициализации навигации: ' + e.message;
        const c = document.querySelector('.container');
        if (c) c.prepend(errDiv);
        else document.body.prepend(errDiv);
    }
}

// Глобальная версия индикатора сохранения для вызовов вне initTabsNavigation
function setSaveStatus(state, msg) {
    // Попробуем найти элемент, если ещё не привязан
    if (!globalSaveStatusEl) {
        const el = document.querySelector('.save-status-indicator');
        if (el) globalSaveStatusEl = el; else return;
    }
    const saveStatus = globalSaveStatusEl;
    if (state === 'saving') {
        saveStatus.style.display = 'inline-block';
        saveStatus.style.background = '#444';
        saveStatus.style.color = '#eee';
        saveStatus.style.border = '1px solid #333';
        saveStatus.textContent = msg || 'Сохранение...';
    } else if (state === 'success') {
        saveStatus.style.display = 'inline-block';
        saveStatus.style.background = 'rgba(0, 128, 0, 0.3)';
        saveStatus.style.color = '#cfe9cf';
        saveStatus.style.border = '1px solid #2a6b2a';
        saveStatus.textContent = msg || 'Сохранено';
        setTimeout(() => { saveStatus.style.display = 'none'; }, 1500);
    } else if (state === 'error') {
        saveStatus.style.display = 'inline-block';
        saveStatus.style.background = 'rgba(128, 0, 0, 0.3)';
        saveStatus.style.color = '#f1c7c7';
        saveStatus.style.border = '1px solid #6b2a2a';
        saveStatus.textContent = msg || 'Ошибка сохранения';
        setTimeout(() => { saveStatus.style.display = 'none'; }, 4000);
    }
}

// --- Global helpers (accessible from outside initTabsNavigation) ---
// These mirror the inner helpers so that actions in displayQuestions can call them.

// Флаг для предотвращения циклической синхронизации
let isSyncing = false;

async function saveMergedToServer(skipReload = false) {
    // Защита от рекурсивных вызовов
    if (isSyncing) {
        return false;
    }

    try {
        isSyncing = true;
        // Отправляем событие начала синхронизации
        window.dispatchEvent(new Event('sync-start'));

        console.log('[saveMergedToServer] === НАЧАЛО СИНХРОНИЗАЦИИ === skipReload:', skipReload);

        // 🔍 ИСПРАВЛЕНИЕ КОДИРОВКИ ПЕРЕД ОТПРАВКОЙ
        const fixEncoding = (text) => {
            if (!text || typeof text !== 'string') return text;
            return text
                .replace(/\uFFFD/g, '?')  // U+FFFD → ?
                .replace(/Д\?{1,10}кументация/g, 'Документация')
                .replace(/инфу о\? сервера/g, 'инфу от сервера')
                .replace(/получа\?м/g, 'получаем')
                .replace(/се\?{1,5}висы/g, 'сервисы');
        };

        // Исправляем overrides перед отправкой
        const overrides = getOverrides();
        const fixedOverrides = {};
        let hasFixes = false;
        for (const key in overrides) {
            const ov = overrides[key];
            const fixedOv = {};
            for (const field in ov) {
                const original = ov[field];
                const fixed = fixEncoding(original);
                fixedOv[field] = fixed;
                if (original !== fixed) hasFixes = true;
            }
            fixedOverrides[key] = fixedOv;
        }

        if (hasFixes) {
            console.warn('[saveMergedToServer] ⚠️ Данные были исправлены перед отправкой (поврежденная кодировка)');
            setOverrides(fixedOverrides);
        }

        const newItems = getNewItems();
        const deletedMap = getDeletedItems();
        const merged = [];
        const seen = new Set();

        // Сначала добавляем базовые карточки из global.json
        uniqueQaData.forEach(item => {
            if (deletedMap[item.question] || serverTrashSet.has(item.question)) return;
            const ov = overrides[item.question];
            const mergedItem = ov ? { ...item, ...ov } : item;
            merged.push(mergedItem);
            seen.add(item.question);
        });

        // Добавляем новые элементы (дубликаты, созданные пользователем)
        // Важно: проверяем по точному совпадению вопроса, чтобы не потерять дубликаты
        newItems.forEach(n => {
            const isDeleted = deletedMap[n.question] || serverTrashSet.has(n.question);
            const isAlreadyAdded = seen.has(n.question);

            // Пропускаем удалённые и уже добавленные
            if (isDeleted || isAlreadyAdded) return;

            // Добавляем новый элемент с применёнными overrides
            const ov = overrides[n.question];
            merged.push(ov ? { ...n, ...ov } : n);
            seen.add(n.question);
        });

        // Также проверяем qaUserCards на наличие элементов, которых нет ни в base, ни в newItems
        // Это нужно для случаев, когда дубликаты уже сохранены в localStorage
        try {
            const sessionUserRaw = localStorage.getItem('qaSessionUser');
            if (sessionUserRaw) {
                const userCardsRaw = localStorage.getItem('qaUserCards');
                if (userCardsRaw) {
                    const userCards = JSON.parse(userCardsRaw);
                    if (Array.isArray(userCards)) {
                        console.log('[saveMergedToServer] qaUserCards:', {
                            totalCards: userCards.length,
                            uniqueQaDataCount: uniqueQaData.length,
                            newItemsCount: newItems.length
                        });

                        let addedCount = 0;
                        let checkedCount = 0;
                        let duplicatesFound = 0;

                        userCards.forEach(uc => {
                            checkedCount++;
                            // 🔥 ИСПРАВЛЕНИЕ: Дубликаты (с "копия" в названии) не должны считаться удалёнными
                            // если они только что созданы и их нет в deletedMap
                            const isInServerTrash = serverTrashSet.has(uc.question);
                            const isInLocalDeleted = deletedMap[uc.question];
                            const isDeleted = isInLocalDeleted || (isInServerTrash && !uc.question.includes('копия'));

                            const isAlreadyAdded = seen.has(uc.question);
                            const isInBase = uniqueQaData.some(b => b.question === uc.question);
                            const isNewItem = newItems.some(n => n.question === uc.question);

                            // Считаем дубликаты
                            if (uc.question.includes('копия')) {
                                duplicatesFound++;
                                console.log('[saveMergedToServer] Найден дубликат в qaUserCards:', {
                                    question: uc.question.substring(0, 50),
                                    isAlreadyAdded,
                                    isInBase,
                                    isNewItem,
                                    isDeleted
                                });
                            }

                            // Добавляем только если это пользовательская карточка, которой нет в базе и новых элементах
                            if (!isDeleted && !isAlreadyAdded && !isInBase && !isNewItem) {
                                const ov = overrides[uc.question];
                                merged.push(ov ? { ...uc, ...ov } : uc);
                                seen.add(uc.question);
                                addedCount++;
                            }
                        });

                        console.log('[saveMergedToServer] Обработано qaUserCards:', {
                            checkedCount,
                            duplicatesFound,
                            addedCount,
                            mergedCount: merged.length
                        });
                    }
                }
            }
        } catch (e) {
            console.warn('[saveMergedToServer] Не удалось добавить дополнительные карточки:', e);
        }
        const lastRestored = typeof window !== 'undefined' ? window.__lastRestoredQuestion : null;

        // Получаем username для отправки на сервер
        let username = null;
        try {
            const sessionUserRaw = localStorage.getItem('qaSessionUser');
            const u = JSON.parse(sessionUserRaw);
            if (u && u.username) username = u.username;
        } catch { }

        // 🔍 ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ КОДИРОВКИ ПЕРЕД ОТПРАВКОЙ
        const fixedMerged = merged.map(card => {
            const fixedCard = {};
            let hasFixes = false;
            for (const key in card) {
                const original = card[key];
                if (typeof original === 'string') {
                    const fixed = fixEncoding(original);
                    fixedCard[key] = fixed;
                    if (original !== fixed) hasFixes = true;
                } else {
                    fixedCard[key] = original;
                }
            }
            if (hasFixes) {
                console.warn(`[saveMergedToServer] Исправлена карточка: ${card.question?.substring(0, 30)}...`);
            }
            return fixedCard;
        });

        const url = `${BACKEND_URL}/save?user=${encodeURIComponent(username || 'guest')}`;

        console.log('[saveMergedToServer] Отправляем на сервер:', {
            mergedCount: merged.length,
            newItemsCount: newItems.length,
            deletedCount: Object.keys(deletedMap).length,
            username,
            bodyLength: JSON.stringify(fixedMerged).length
        });

        // 🔍 ЛОГ: первые 3 карточки для проверки
        const first3 = merged.slice(0, 3).map(c => ({
            question: c.question?.substring(0, 50),
            hasCopy: c.question?.includes('копия'),
            category: c.category,
            subcategory: c.subcategory
        }));
        console.log('[saveMergedToServer] Первые 3 карточки:', first3);

        // 🔍 ЛОГ: поиск дубликата во всём массиве
        const dupIndex = merged.findIndex(c => c.question?.includes('копия'));
        console.log('[saveMergedToServer] Дубликат найден на индексе:', dupIndex);
        if (dupIndex >= 0) {
            console.log('[saveMergedToServer] Дубликат:', {
                question: merged[dupIndex].question,
                category: merged[dupIndex].category,
                subcategory: merged[dupIndex].subcategory
            });
        }

        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fixedMerged)
        });

        console.log('[saveMergedToServer] Ответ сервера:', {
            status: resp.status,
            ok: resp.ok,
            statusText: resp.statusText
        });
        let ok = resp.ok;
        let responseJson = null;
        try {
            responseJson = await resp.json();
            console.log('[saveMergedToServer] ПОЛУЧЕНО ОТ СЕРВЕРА:', responseJson);
            if (typeof responseJson?.ok === 'boolean') ok = ok && responseJson.ok;
        } catch (parseErr) {
            console.warn('[saveMergedToServer] Не удалось распарсить ответ:', parseErr);
        }

        if (!ok) {
            console.error('[saveMergedToServer] Сервер вернул ошибку');
            throw new Error('Сервер вернул ошибку при сохранении');
        }

        // Успешное сохранение
        setSaveStatus('success');

        console.log('[saveMergedToServer] Сервер ответил:', { ok, responseJson });

        // 🔥 ОБНОВЛЯЕМ localDataTimestamp после успешного сохранения на сервер
        // Это нужно для корректной синхронизации между устройствами
        const serverTimestamp = responseJson?.updatedAt || Date.now();
        localStorage.setItem('localDataTimestamp', serverTimestamp.toString());
        console.log('[saveMergedToServer] localDataTimestamp обновлён:', serverTimestamp);

        // Отправляем событие успешной синхронизации
        window.dispatchEvent(new Event('sync-success'));

        // ОБНОВЛЯЕМ qaUserCards в localStorage
        try {
            setQaUserCards(merged);
            console.log('[saveMergedToServer] setQaUserCards вызван:', {
                mergedLength: merged.length,
                savedCards: merged.length
            });

            // 🔍 ПРОВЕРЯЕМ что записалось в localStorage
            const verifyCards = getQaUserCards();
            console.log('[saveMergedToServer] Проверка localStorage:', {
                cardsInLocalStorage: verifyCards?.length || 0
            });

            // 🔥 ОБНОВЛЯЕМ uniqueQaData в памяти из localStorage
            // Это нужно чтобы следующие дубликаты использовали актуальные данные
            // Импортируем setUniqueQaData из all-data.js
            const { setUniqueQaData } = await import('../all-data.js');
            if (typeof setUniqueQaData === 'function' && verifyCards && verifyCards.length > 0) {
                setUniqueQaData(verifyCards);
                console.log('[saveMergedToServer] uniqueQaData обновлён:', {
                    newLength: verifyCards.length
                });
            }

            // Очищаем qaNewItems после успешной синхронизации, чтобы дубликаты не добавлялись повторно
            const newItems = getNewItems();
            console.log('[saveMergedToServer] Очищаем qaNewItems:', newItems.length, 'элементов');
            if (Array.isArray(newItems) && newItems.length > 0) {
                localStorage.setItem('qaNewItems', JSON.stringify([]));
            }

            // Очищаем qaDeletedItems после успешной синхронизации
            const deletedItems = getDeletedItems();
            if (Object.keys(deletedItems).length > 0) {
                localStorage.setItem('qaDeletedItems', JSON.stringify({}));
            }
        } catch (e) {
            console.warn('[saveMergedToServer] Не удалось обновить localStorage:', e);
        }

        // Принудительная перезагрузка данных через 50мс
        console.log('[saveMergedToServer] Dispatch forceReloadData:', !skipReload);
        setTimeout(() => {
            if (!skipReload) window.dispatchEvent(new Event('forceReloadData'));
        }, 50);

        return true;
    } catch (e) {
        console.error('[saveMergedToServer] Ошибка сохранения:', e);
        setSaveStatus('error', 'Ошибка: ' + e.message);
        // Отправляем событие ошибки синхронизации
        window.dispatchEvent(new Event('sync-error'));
        return false;
    } finally {
        // Сбрасываем флаг синхронизации
        isSyncing = false;
    }
}

async function moveToServerTrash(items) {
    try {
        // Получаем username для отправки на сервер
        const sessionUserRaw = localStorage.getItem('qaSessionUser');
        let username = 'guest';
        try {
            const u = JSON.parse(sessionUserRaw);
            if (u && u.username) username = u.username;
        } catch { }

        const resp = await fetch(`${BACKEND_URL}/trash?user=${encodeURIComponent(username)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: items,
                deleted_by: username
            })
        });

        if (!resp.ok) {
            const error = await resp.text();
            console.error('[moveToServerTrash] Ошибка сервера:', resp.status, error);
        }

        return resp.ok;
    } catch (e) {
        console.error('[moveToServerTrash] Ошибка:', e);
        return false;
    }
}

async function restoreFromServerTrash(questions) {
    try {
        // Получаем username для отправки на сервер
        const sessionUserRaw = localStorage.getItem('qaSessionUser');
        let username = null;
        try {
            const u = JSON.parse(sessionUserRaw);
            if (u && u.username) username = u.username;
        } catch { }

        const resp = await fetch(`${BACKEND_URL}/restore?user=${encodeURIComponent(username || 'guest')}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questions: questions })
        });
        let ok = resp.ok;
        let jsonResp = null;
        try { jsonResp = await resp.json(); if (typeof jsonResp?.ok === 'boolean') ok = ok && jsonResp.ok; } catch (_) { }
        try { window.__lastRestoredQuestion = Array.isArray(questions) ? questions[0] : null; } catch (_) { }
        return ok;
    } catch (e) {
        console.error('Restore operation failed:', e);
        return false;
    }
}

async function trackServerDuplication(originalQuestion, newQuestion) {
    try {
        const resp = await fetch(`${BACKEND_URL}/duplicate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: [{
                    original_question: originalQuestion,
                    new_question: newQuestion
                }],
                duplicated_by: loggedInUser?.email || 'anonymous'
            })
        });
        return resp.ok;
    } catch (e) {
        console.error('Duplicate tracking failed:', e);
        return false;
    }
}

async function getServerMetadata() {
    try {
        const resp = await fetchWithAuth('/metadata');
        if (resp.ok) {
            const data = await resp.json();
            const raw = data.metadata || {};
            // Нормализуем ключи с сервера (snake_case -> camelCase)
            const normalized = {
                categoryOrder: Array.isArray(raw.category_order) ? raw.category_order : (raw.categoryOrder || []),
                subcategoryOrder: typeof raw.subcategory_order === 'object' && raw.subcategory_order !== null ? raw.subcategory_order : (raw.subcategoryOrder || {}),
                orderOverrides: typeof raw.card_order === 'object' && raw.card_order !== null ? raw.card_order : (raw.orderOverrides || {})
            };
            return normalized;
        }
        return {};
    } catch (e) {
        console.error('Failed to get server metadata:', e);
        return {};
    }
}

async function refreshServerTrash() {
    try {
        // 🔒 Загружаем корзину с сервера (теперь /metadata возвращает trash_bin)
        const resp = await fetchWithAuth('/metadata');
        if (resp.ok) {
            const data = await resp.json();
            const bin = Array.isArray(data.trash_bin) ? data.trash_bin : [];
            serverTrashItems = bin;
            serverTrashSet = new Set(bin.map(t => t.item?.question).filter(Boolean));
            // 🔒 Сохраняем в localStorage для офлайн-работы
            localStorage.setItem('qaUserTrash', JSON.stringify(serverTrashItems));
            return;
        }

        // Фолбэк: если сервер недоступен, загружаем из localStorage
        const localTrash = localStorage.getItem('qaUserTrash');
        if (localTrash) {
            const trash = JSON.parse(localTrash);
            serverTrashItems = Array.isArray(trash) ? trash : [];
            serverTrashSet = new Set(serverTrashItems.map(t => t.item?.question).filter(Boolean));
        }
    } catch (e) {
        console.error('Failed to refresh server trash:', e);
        // Фолбэк: загружаем из localStorage при ошибке
        const localTrash = localStorage.getItem('qaUserTrash');
        if (localTrash) {
            const trash = JSON.parse(localTrash);
            serverTrashItems = Array.isArray(trash) ? trash : [];
            serverTrashSet = new Set(serverTrashItems.map(t => t.item?.question).filter(Boolean));
        }
    }
}

async function updateServerMetadata(metadata) {
    try {
        // Преобразуем ключи клиента (camelCase) в серверные (snake_case)
        const payload = {};
        if (Array.isArray(metadata.categoryOrder)) payload.category_order = metadata.categoryOrder;
        if (metadata.subcategoryOrder && typeof metadata.subcategoryOrder === 'object') payload.subcategory_order = metadata.subcategoryOrder;
        if (metadata.orderOverrides && typeof metadata.orderOverrides === 'object') payload.card_order = metadata.orderOverrides;
        const resp = await fetchWithAuth('/metadata', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return resp.ok;
    } catch (e) {
        console.error('Failed to update server metadata:', e);
        return false;
    }
}

function renderTrashPanel() {
    if (!editMode) return;
    const trashPanel = document.querySelector('.trash-panel');
    if (!trashPanel) return;
    const catDiv = trashPanel.querySelector('#trash-categories');
    const cardDiv = trashPanel.querySelector('#trash-cards');
    if (catDiv) catDiv.innerHTML = '<div><strong>Категории:</strong></div><div>Пусто</div>';
    const deletedCards = serverTrashItems.map(t => t.item?.question).filter(Boolean);
    if (cardDiv) {
        cardDiv.innerHTML = '';
        const header = document.createElement('div');
        header.innerHTML = '<strong>Карточки:</strong>' + (deletedCards.length ? '' : ' <span>Пусто</span>');
        cardDiv.appendChild(header);
        const grid = document.createElement('div');
        grid.className = 'trash-cards-grid';
        cardDiv.appendChild(grid);

        serverTrashItems.forEach(entry => {
            const q = entry.item?.question;
            const it = entry.item || uniqueQaData.find(i => i.question === q) || getNewItems().find(i => i.question === q);
            const mini = document.createElement('div');
            mini.className = 'result-item trash-mini';

            // Верх: теги
            const meta = document.createElement('div');
            meta.className = 'trash-meta';
            meta.style.display = 'flex';
            meta.style.flexWrap = 'wrap';
            meta.style.gap = '6px';
            const catBadge = document.createElement('span'); catBadge.className = 'category-badge'; catBadge.textContent = (it && it.category) ? it.category : '';
            const scBadge = document.createElement('span'); scBadge.className = 'subcategory-badge'; scBadge.textContent = (it && it.subcategory) ? it.subcategory : '';
            meta.appendChild(catBadge); meta.appendChild(scBadge);

            // Вопрос - применяем форматирование
            const qEl = document.createElement('div'); qEl.className = 'question';
            const questionFormatting = it?.formatting?.question || [];
            qEl.innerHTML = applyFormatting(it?.question || q || '', questionFormatting);
            qEl.style.marginTop = '6px';

            // Ответ - применяем форматирование
            const aEl = document.createElement('div'); aEl.className = 'answer';
            const answerFormatting = it?.formatting?.answer || [];
            aEl.innerHTML = applyFormatting(it?.answer || '', answerFormatting);
            aEl.style.marginTop = '6px';

            // Действия
            const actions = document.createElement('div');
            actions.className = 'trash-actions';
            actions.style.display = 'flex';
            actions.style.gap = '8px';
            actions.style.marginTop = '8px';
            const restoreBtn = document.createElement('button'); restoreBtn.className = 'restore-btn'; restoreBtn.textContent = 'Восстановить';
            const purgeBtn2 = document.createElement('button'); purgeBtn2.className = 'purge-btn'; purgeBtn2.textContent = 'Удалить навсегда';
            actions.appendChild(restoreBtn);
            actions.appendChild(purgeBtn2);

            mini.appendChild(meta);
            mini.appendChild(qEl);
            mini.appendChild(aEl);
            mini.appendChild(actions);
            grid.appendChild(mini);

            // Оптимистичное восстановление + очистка локальной карты удалений
            restoreBtn.addEventListener('click', async () => {
                restoreBtn.textContent = 'Восстановление...'; restoreBtn.disabled = true;
                // Удаляем из локального кэша корзины сразу
                serverTrashSet.delete(q);
                serverTrashItems = serverTrashItems.filter(t => t.item?.question !== q);
                // Если карта локальных удалений помечала эту карточку как удалённую — очистим
                const delMap = getDeletedItems();
                if (delMap && delMap[q]) { delete delMap[q]; setDeletedItems(delMap); }
                renderTrashPanel();
                // Обновляем текущий список в зависимости от активного таба
                // Обновляем без сброса контекста
                refreshCurrentContext();
                // Пытаемся восстановить на сервере
                let ok = false; try { ok = await restoreFromServerTrash([q]); } catch (e) { console.error('[restore-click] Ошибка запроса к серверу /restore', e); ok = false; }
                if (ok) {
                    try { await refreshServerTrash(); } catch (_) { }
                    // Если восстановленной карточки нет в текущем базовом наборе (uniqueQaData)
                    // и она не числится среди новых элементов — добавим её в новые для последующего сохранения.
                    const baseHas = !!uniqueQaData.find(i => i.question === q);
                    const newItemsArr = getNewItems();
                    const newHas = !!newItemsArr.find(i => i.question === q);
                    if (!baseHas && !newHas && it) {
                        newItemsArr.push({ ...it });
                        setLS('qaNewItems', newItemsArr);
                    }
                    try { window.__lastRestoredQuestion = q; } catch (_) { }
                    // 🔥 Сохраняем на сервер БЕЗ forceReloadData
                    saveMergedToServer(true).then(saveOk => {
                        if (saveOk) {
                            setSaveStatus('success', 'Карточка восстановлена');
                            restoreBtn.textContent = 'Готово';
                            setTimeout(() => { restoreBtn.textContent = 'Восстановить'; restoreBtn.disabled = false; }, 1500);
                        } else {
                            setSaveStatus('error', 'Ошибка сохранения');
                            restoreBtn.textContent = 'Восстановить'; restoreBtn.disabled = false;
                        }
                    });
                } else {
                    try { await refreshServerTrash(); } catch (_) { }
                    setSaveStatus('error', 'Ошибка восстановления на сервере');
                    restoreBtn.textContent = 'Восстановить'; restoreBtn.disabled = false;
                }
            });

            // Окончательное удаление (вторая ветка)
            purgeBtn2.addEventListener('click', async () => {
                purgeBtn2.textContent = 'Удаление...'; purgeBtn2.disabled = true;

                // 🔒 Получаем username
                const sessionUserRaw = localStorage.getItem('qaSessionUser');
                let username = 'guest';
                try {
                    const u = JSON.parse(sessionUserRaw);
                    if (u && u.username) username = u.username;
                } catch { }

                try {
                    const resp = await fetch(`${BACKEND_URL}/delete-permanent?user=${encodeURIComponent(username)}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ questions: [q] })
                    });
                    if (resp.ok) {
                        serverTrashSet.delete(q);
                        serverTrashItems = serverTrashItems.filter(t => t.item?.question !== q);

                        // 🔥 ВАЖНО: Добавляем в qaDeletedItems чтобы карточка не вернулась при сохранении
                        const delMap = getDeletedItems();
                        delMap[q] = { deleted_at: new Date().toISOString(), deleted_by: username, permanent: true };
                        setDeletedItems(delMap);

                        const newArr = getNewItems().filter(i => i.question !== q);
                        setLS('qaNewItems', newArr);

                        // 🔒 Обновляем localStorage с корзиной
                        const localTrash = localStorage.getItem('qaUserTrash');
                        if (localTrash) {
                            const trash = JSON.parse(localTrash);
                            const newTrash = trash.filter(t => t.item?.question !== q);
                            localStorage.setItem('qaUserTrash', JSON.stringify(newTrash));
                        }

                        renderTrashPanel();
                        refreshCurrentContext();
                        // 🔥 НЕ вызываем saveMergedToServer() чтобы не вернуть карточку обратно!
                        setSaveStatus('success', 'Карточка удалена навсегда');
                    } else {
                        const error = await resp.text();
                        console.error('[delete-permanent] Ошибка:', resp.status, error);
                        setSaveStatus('error', 'Ошибка: ' + error);
                    }
                } catch (e) {
                    console.error('[delete-permanent] Ошибка:', e);
                    setSaveStatus('error', 'Сервер удаления недоступен');
                }
                purgeBtn2.textContent = 'Удалить навсегда'; purgeBtn2.disabled = false;
            });
        });
    }
}

// Функция для фильтрации вопросов по категории
function filterQuestionsByCategory(categoryName) {
    currentContextKey = `category:${categoryName}`;
    const data = getRuntimeData();
    // Если имя категории — отображаемое, найдем исходное имя
    const catPlaceholders = getCategoryPlaceholders();
    const canonicalCategory = Object.entries(catPlaceholders).find(([, v]) => v?.displayName === categoryName)?.[0] || categoryName;
    const filteredData = data.filter(item => item.category === canonicalCategory || item.category === categoryName);
    displayQuestions(filteredData, `Категория: ${categoryName}`);
}

// Функция для фильтрации вопросов по подкатегории
function filterQuestionsBySubcategory(categoryName, subcategoryName) {
    currentContextKey = `subcategory:${categoryName}#${subcategoryName}`;
    const data = getRuntimeData();
    const catPlaceholders = getCategoryPlaceholders();
    const scPlaceholders = getSubcategoryPlaceholders();
    const canonicalCategory = Object.entries(catPlaceholders).find(([, v]) => v?.displayName === categoryName)?.[0] || categoryName;
    const scMap = scPlaceholders[canonicalCategory] || scPlaceholders[categoryName] || {};
    const canonicalSub = Object.entries(scMap).find(([, v]) => v?.displayName === subcategoryName)?.[0] || subcategoryName;
    const filteredData = data.filter(item => (item.category === canonicalCategory || item.category === categoryName) && (item.subcategory === canonicalSub || item.subcategory === subcategoryName));
    displayQuestions(filteredData, `Подкатегория: ${subcategoryName}`);
}

// Функция для отображения всех вопросов
function showAllQuestions() {
    currentContextKey = 'all';
    displayQuestions(getRuntimeData(), 'Все вопросы');
}

// Функция для отображения избранных вопросов
function showFavorites() {
    currentContextKey = 'favorites';
    const favorites = new Set(JSON.parse(localStorage.getItem('qaFavorites') || '[]'));
    const favData = getRuntimeData().filter(item => favorites.has(item.question));
    displayQuestions(favData, 'Избранное');
}

// Универсальная перерисовка текущего контекста без сброса на «Все вопросы»
function refreshCurrentContext() {
    // НЕ показываем вопросы если открыта страница статистики!
    if (location.hash === '#/stats') {
        return;
    }

    try {
        const key = currentContextKey || 'all';
        if (key === 'all') {
            return showAllQuestions();
        }
        if (key === 'favorites') {
            return showFavorites();
        }
        if (key.startsWith('category:')) {
            const name = key.slice('category:'.length);
            return filterQuestionsByCategory(name);
        }
        if (key.startsWith('subcategory:')) {
            const payload = key.slice('subcategory:'.length);
            const [cat, sub] = payload.split('#');
            return filterQuestionsBySubcategory(cat, sub);
        }
        // fallback
        showAllQuestions();
    } catch (e) {
        console.error('[refreshCurrentContext] Error:', e);
        showAllQuestions();
    }
}

// Функция для отображения вопросов
export function displayQuestions(questions, title) {
    // Safety check and logging
    if (!questions) {
        console.warn('displayQuestions: questions is undefined/null, defaulting to []');
        questions = [];
    }

    try {
        const resultsList = document.getElementById('results-list');
        if (!resultsList) {
            console.error('results-list element not found');
            return;
        }
        resultsList.innerHTML = '';
        resultsListRef = resultsList;

        if (questions.length === 0) {
            // DEBUG INFO
            const totalData = uniqueQaData ? uniqueQaData.length : 'N/A';
            resultsList.innerHTML = `<div style="padding: 20px; text-align: center; color: #aaa; font-style: italic;">
                Список вопросов пуст
             </div>`;
        } else {
            // Force display grid
            resultsList.style.display = 'grid';
            resultsList.style.visibility = 'visible';
            resultsList.style.opacity = '1';
            // Ensure container is visible too
            const container = resultsList.closest('.results-container');
            if (container) {
                container.style.display = 'block';
                container.style.visibility = 'visible';
                container.style.opacity = '1';
            }
        }

        currentQuestions = [...questions];

        // Применяем порядок, если задан
        const order = getOrderForContext(currentContextKey);
        if (order && sortMode === 'default') {
            const idx = new Map(order.map((q, i) => [q, i]));
            currentQuestions.sort((a, b) => (idx.get(a.question) ?? 1e9) - (idx.get(b.question) ?? 1e9));
        }

        // Получаем прогресс для всех карточек для сортировки и отображения
        let progressMap = {};
        try {
            progressMap = getProgressMap();
        } catch (e) {
            console.warn('getProgressMap failed:', e);
        }

        // Применяем сортировку по EF (сердечкам), если включена
        if (sortMode !== 'default') {
            currentQuestions.sort((a, b) => {
                const efA = progressMap[a.question]?.easeFactor ?? 2.3;
                const efB = progressMap[b.question]?.easeFactor ?? 2.3;

                // 1. Первичная сортировка по EF
                if (Math.abs(efA - efB) >= 0.001) {
                    // asc: от меньшего к большему (1.3 -> 2.9) - Самые сложные сначала
                    return sortMode === 'asc' ? efA - efB : efB - efA;
                }

                // 2. Вторичная сортировка по ID (всегда ASC для стабильности)
                const idA = parseInt(a.id, 10) || 0;
                const idB = parseInt(b.id, 10) || 0;
                if (idA !== idB) {
                    return idA - idB;
                }

                // 3. Третичная сортировка по алфавиту (всегда ASC для стабильности)
                return a.question.localeCompare(b.question, undefined, { numeric: true, sensitivity: 'base' });
            });
        }

        // Обновляем счетчик результатов (вынесен из grid)
        let countContainer = document.getElementById('results-count-container');
        if (!countContainer) {
            countContainer = document.createElement('div');
            countContainer.id = 'results-count-container';
            countContainer.className = 'results-header'; // Use existing class for style
            countContainer.style.padding = '0 20px 10px 20px';
            countContainer.style.marginBottom = '0';
            countContainer.style.display = 'flex';
            countContainer.style.alignItems = 'center';
            countContainer.style.gap = '10px';
            resultsList.parentNode.insertBefore(countContainer, resultsList);
        }

        // Иконки сортировки
        const sortIcons = {
            default: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5"/></svg>',
            asc: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5" opacity="0.3"/></svg>', // Стрелка вниз (возрастание)
            desc: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 9l5-5 5 5"/><path d="M7 15l5 5 5-5" opacity="0.3"/></svg>'  // Стрелка вверх (убывание)
        };
        const sortTitle = {
            default: 'Сортировка: По умолчанию',
            asc: 'Сортировка: От сложных к легким (EF ↑)',
            desc: 'Сортировка: От легких к сложным (EF ↓)'
        };

        // Формируем текст счетчика
        // 🔒 Используем getRuntimeData() для консистентности
        const runtimeData = getRuntimeData();
        const totalCount = runtimeData.length;
        const isFiltered = questions.length !== totalCount;
        const countText = isFiltered
            ? `Найдено: ${questions.length} из ${totalCount}`
            : `Всего карточек: ${questions.length}`;

        countContainer.innerHTML = `
        <p class="results-count" style="margin:0">${countText}</p>
        <button id="sort-toggle-btn" class="nav-icon-btn" title="${sortTitle[sortMode]}" style="padding:4px 8px; border-radius:4px; border:1px solid #444; background:none; cursor:pointer; display:flex; align-items:center; justify-content:center;">
            ${sortIcons[sortMode]}
        </button>
    `;

        // Обработчик кнопки сортировки
        const sortBtn = countContainer.querySelector('#sort-toggle-btn');
        if (sortBtn) {
            sortBtn.addEventListener('click', () => {
                if (sortMode === 'default') sortMode = 'asc';
                else if (sortMode === 'asc') sortMode = 'desc';
                else sortMode = 'default';
                displayQuestions(currentQuestions, title);
            });
        }

        // Хелпер для отрисовки сердечек (новая логика с дробными)
        const renderHearts = (ef) => {
            try {
                if (typeof getDifficultyLevel !== 'function' || typeof getLevelProgress !== 'function') {
                    console.warn('SRS functions not available');
                    return '';
                }

                // Check for NEW card (ef is null or undefined)
                if (ef === null || ef === undefined) {
                    return '<div class="hearts-container" title="Карточка еще не изучалась" style="position:absolute; top:12px; right:40px; z-index:998;"><span class="level-label" style="font-size:10px;color:var(--color-text-secondary);font-weight:600;background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;">НОВАЯ</span></div>';
                }

                // Расчет количества сердечек (1.0 - 5.0)
                let heartsCount = 0;
                if (ef < 1.7) {
                    // 1.3 -> 1.0, 1.7 -> 2.0
                    heartsCount = 1 + (ef - 1.3) / 0.4;
                } else if (ef < 2.1) {
                    // 1.7 -> 2.0, 2.1 -> 3.0
                    heartsCount = 2 + (ef - 1.7) / 0.4;
                } else if (ef < 2.4) {
                    // 2.1 -> 3.0, 2.4 -> 4.0
                    heartsCount = 3 + (ef - 2.1) / 0.3;
                } else {
                    // 2.4 -> 4.0, 2.9 -> 5.0
                    heartsCount = 4 + (ef - 2.4) / 0.5;
                }

                // Clamp to 1-5 range just in case
                heartsCount = Math.max(1, Math.min(5, heartsCount));

                const level = getDifficultyLevel(ef);
                const levelNames = {
                    'VERY_HARD': 'Очень трудные',
                    'HARD': 'Трудные',
                    'STANDARD': 'Стандарт',
                    'EASY': 'Легкие'
                };
                const levelName = levelNames[level] || level;

                let html = '<div class="hearts-container" title="Уровень: ' + levelName + '\\nEF: ' + ef.toFixed(2) + '\\nСердечек: ' + heartsCount.toFixed(2) + '" style="position:absolute; top:12px; right:40px; display:flex; gap:2px; z-index:998;">';

                // Рисуем 5 сердечек
                for (let i = 0; i < 5; i++) {
                    let fill = 0;
                    if (heartsCount >= i + 1) {
                        fill = 1;
                    } else if (heartsCount > i) {
                        fill = heartsCount - i;
                    }

                    const stopVal = Math.round(fill * 100);
                    const id = `heart-grad-${Math.random().toString(36).substr(2, 9)}`;

                    html += `
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24">
                        <defs>
                            <linearGradient id="${id}">
                                <stop offset="${stopVal}%" stop-color="#ff4d4d" />
                                <stop offset="${stopVal}%" stop-color="#444" />
                            </linearGradient>
                        </defs>
                        <path fill="url(#${id})" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                `;
                }
                html += '</div>';
                return html;
            } catch (e) {
                console.error('Error in renderHearts:', e);
                return '';
            }
        };

        // Добавляем вопросы
        currentQuestions.forEach((item, index) => {
            try {
                const resultItem = document.createElement('div');
                resultItem.className = 'result-item';

                // DEBUG STYLES - REMOVE LATER
                resultItem.style.display = 'flex';
                resultItem.style.flexDirection = 'column';
                resultItem.style.minHeight = '100px';
                resultItem.style.backgroundColor = '#242424';
                resultItem.style.border = '1px solid #444';
                resultItem.style.color = '#fff';
                // FIX WIDTH for mobile
                resultItem.style.width = '100%';
                resultItem.style.maxWidth = '100%';
                resultItem.style.boxSizing = 'border-box';
                // END DEBUG STYLES

                if (editMode) {
                    resultItem.setAttribute('draggable', 'true');
                    resultItem.dataset.index = String(index);
                    resultItem.addEventListener('dragstart', (ev) => {
                        ev.dataTransfer.setData('text/plain', resultItem.dataset.index);
                    });
                    resultItem.addEventListener('dragover', (ev) => {
                        ev.preventDefault();
                    });
                    resultItem.addEventListener('drop', (ev) => {
                        ev.preventDefault();
                        const fromIdx = parseInt(ev.dataTransfer.getData('text/plain'), 10);
                        const toIdx = parseInt(resultItem.dataset.index, 10);
                        if (Number.isInteger(fromIdx) && Number.isInteger(toIdx) && fromIdx !== toIdx) {
                            const moved = currentQuestions.splice(fromIdx, 1)[0];
                            currentQuestions.splice(toIdx, 0, moved);
                            setOrderForContext(currentContextKey, currentQuestions.map(q => q.question));
                            (async () => {
                                setSaveStatus('saving', 'Сохранение порядка карточек...');
                                const meta = await getServerMetadata();
                                meta.orderOverrides = meta.orderOverrides || {};
                                meta.orderOverrides[currentContextKey] = currentQuestions.map(q => q.question);
                                const ok = await updateServerMetadata(meta);
                                setSaveStatus(ok ? 'success' : 'error', ok ? 'Порядок изменен' : 'Ошибка сохранения');
                            })();
                            // Перерисовать текущий список
                            displayQuestions(currentQuestions, title);
                        }
                    });
                }

                // Избранное
                let isFav = false;
                let favClass = '';
                try {
                    const favorites = JSON.parse(localStorage.getItem('qaFavorites') || '[]');
                    isFav = favorites.includes(item.question);
                    favClass = isFav ? 'fav-active' : '';
                } catch (e) {
                    console.warn('Favorites error:', e);
                }

                // Отображаем бейджи с учётом плейсхолдеров
                let dispCat = item.category || '';
                let dispSub = item.subcategory || '';
                try {
                    const catPlaceholders = getCategoryPlaceholders();
                    const scPlaceholders = getSubcategoryPlaceholders();
                    dispCat = (catPlaceholders[item.category] && catPlaceholders[item.category].displayName) || item.category || '';
                    dispSub = (scPlaceholders[item.category] && scPlaceholders[item.category][item.subcategory] && scPlaceholders[item.category][item.subcategory].displayName) || item.subcategory || '';
                } catch (e) {
                    console.warn('Placeholders error:', e);
                }

                const starSvg = (filled) => `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                    style="fill: ${filled ? '#fb923c' : 'none'}; stroke: ${filled ? '#fb923c' : 'currentColor'}; stroke-width: 2px;"
                />
            </svg>
        `;

                // Расчет сердечек
                const cardProgress = progressMap[item.question];
                // If no progress or no easeFactor, treat as NEW (pass null)
                const ef = (cardProgress && cardProgress.easeFactor !== undefined) ? cardProgress.easeFactor : null;

                // Применяем форматирование к вопросу и ответу
                const questionFormatting = item.formatting?.question || [];
                const answerFormatting = item.formatting?.answer || [];
                const questionHTML = applyFormatting(item.question, questionFormatting);
                const answerHTML = applyFormatting(item.answer, answerFormatting);

                resultItem.innerHTML = `
            <div class="question-row">
                <span class="category-badge">${dispCat}</span>
                <span class="subcategory-badge">${dispSub}</span>
            </div>
            ${renderHearts(ef)}
            <button class="fav-btn ${favClass}" title="В избранное" style="position:absolute;top:10px;right:10px;width:24px;height:24px;background:none;border:none;cursor:pointer;padding:0;z-index:999;display:block !important;opacity:1 !important;">${starSvg(isFav)}</button>
            <div class="question">${questionHTML}</div>
            <div class="answer">${answerHTML}</div>
        `;

                // Обработчик избранного
                const favBtn = resultItem.querySelector('.fav-btn');
                favBtn.addEventListener('click', () => {
                    const current = new Set(JSON.parse(localStorage.getItem('qaFavorites') || '[]'));
                    if (current.has(item.question)) {
                        current.delete(item.question);
                        favBtn.classList.remove('fav-active');
                        favBtn.innerHTML = starSvg(false);
                        import('../srs/storage.js').then(({ syncFavorite }) => { try { syncFavorite(item.question, false); } catch { } }).catch(() => { });
                    } else {
                        current.add(item.question);
                        favBtn.classList.add('fav-active');
                        favBtn.innerHTML = starSvg(true);
                        import('../srs/storage.js').then(({ syncFavorite }) => { try { syncFavorite(item.question, true); } catch { } }).catch(() => { });
                    }
                    localStorage.setItem('qaFavorites', JSON.stringify(Array.from(current)));
                });

                // Обработчик клика для увеличения карточки (только для ПК версии)
                const isDesktop = window.innerWidth > 768;
                if (isDesktop) {
                    resultItem.style.cursor = 'zoom-in';
                    resultItem.addEventListener('click', (e) => {
                        // Не увеличиваем если клик по кнопке избранного или меню
                        if (e.target.closest('.fav-btn') || e.target.closest('.kebab-btn')) {
                            return;
                        }
                        openCardZoomModal(item, ef);
                    });
                }

                // Меню карточки (⋮) в режиме редактирования
                if (editMode) {
                    const qRow = resultItem.querySelector('.question-row');
                    const kebabBtn = document.createElement('button');
                    kebabBtn.className = 'kebab-btn';
                    kebabBtn.title = 'Меню карточки';
                    kebabBtn.textContent = '⋮';
                    // Тёмно-серый стиль кнопки ⋮ на карточке
                    kebabBtn.style.background = '#444';
                    kebabBtn.style.color = '#eee';
                    kebabBtn.style.border = '1px solid #333';
                    kebabBtn.style.borderRadius = '4px';
                    kebabBtn.style.padding = '2px 6px';
                    qRow.appendChild(kebabBtn);

                    // 🔥 Глобальное состояние модального окна редактирования
                    let editModalState = {
                        originalCard: null,
                        formatting: null,
                        oldQuestion: null
                    };

                    const launchEditor = () => {
                        const categoriesData = buildCategoriesFromData(getRuntimeData());
                        const categoryOptions = categoriesData.map(cat => `<option value="${cat.name}" ${item.category === cat.name ? 'selected' : ''}>${cat.name}</option>`).join('');
                        const selectedCategory = categoriesData.find(cat => cat.name === item.category);
                        const subcategoryOptions = selectedCategory ? selectedCategory.subcategories.map(sub => `<option value="${sub.name}" ${item.subcategory === sub.name ? 'selected' : ''}>${sub.name}</option>`).join('') : '';

                        // Получаем форматирование из карточки или создаём пустое
                        const formatting = item.formatting || createEmptyFormatting();

                        // Сохраняем состояние
                        editModalState = {
                            originalCard: { ...item },
                            formatting: { ...formatting },
                            oldQuestion: item.question
                        };

                        // Создаём модальное окно с панелью форматирования
                        const modalHTML = `
                            <div class="edit-modal-overlay" id="edit-modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 10px;">
                                <div class="edit-modal" style="background: #1e1e1e; border-radius: 12px; padding: 16px; width: 100%; max-width: 700px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.5); box-sizing: border-box;">
                                    
                                    <!-- Категория и подкатегория в 2 ряда -->
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
                                        <div>
                                            <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Категория</label>
                                            <select class="edit-category" style="width: 100%; padding: 10px 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 6px; color: #fff; font-size: 13px; box-sizing: border-box;">${categoryOptions}</select>
                                        </div>
                                        <div>
                                            <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Подкатегория</label>
                                            <select class="edit-subcategory" style="width: 100%; padding: 10px 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 6px; color: #fff; font-size: 13px; box-sizing: border-box;">${subcategoryOptions}</select>
                                        </div>
                                    </div>
                                    
                                    <!-- Панель форматирования -->
                                    <div style="margin-bottom: 12px;">
                                        <div class="format-toolbar" id="main-format-toolbar" style="width: 100%; box-sizing: border-box;"></div>
                                    </div>
                                    
                                    <!-- Вопрос -->
                                    <div style="margin-bottom: 12px;">
                                        <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Вопрос</label>
                                        <div class="edit-field-editor" id="edit-question-editor" contenteditable="true" spellcheck="true" style="width: 100%; min-height: 80px; padding: 10px 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 6px; color: #fff; font-size: 14px; line-height: 1.5; outline: none; word-wrap: break-word; overflow-wrap: break-word; box-sizing: border-box;"></div>
                                    </div>
                                    
                                    <!-- Ответ -->
                                    <div style="margin-bottom: 16px;">
                                        <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Ответ</label>
                                        <div class="edit-field-editor" id="edit-answer-editor" contenteditable="true" spellcheck="true" style="width: 100%; min-height: 80px; padding: 10px 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 6px; color: #fff; font-size: 14px; line-height: 1.5; outline: none; word-wrap: break-word; overflow-wrap: break-word; box-sizing: border-box;"></div>
                                    </div>
                                    
                                    <!-- Кнопки -->
                                    <div style="display: flex; gap: 12px; justify-content: flex-end; flex-wrap: wrap;">
                                        <button class="edit-modal-btn cancel" id="edit-cancel-btn" style="padding: 10px 20px; background: transparent; border: 1px solid #444; border-radius: 6px; color: #aaa; cursor: pointer; font-size: 14px; flex-shrink: 0;">Отмена</button>
                                        <button class="edit-modal-btn save" id="edit-save-btn" style="padding: 10px 20px; background: #4CAF50; border: none; border-radius: 6px; color: #fff; cursor: pointer; font-size: 14px; flex-shrink: 0;">Сохранить</button>
                                    </div>
                                </div>
                            </div>
                            
                            <style>
                                /* Все элементы на 100% ширины */
                                #main-format-toolbar,
                                #edit-question-editor,
                                #edit-answer-editor,
                                .edit-category,
                                .edit-subcategory {
                                    width: 100% !important;
                                    max-width: 100% !important;
                                    box-sizing: border-box !important;
                                }
                                
                                /* Адаптивные стили для модального окна */
                                @media (max-width: 768px) {
                                    .edit-modal {
                                        padding: 16px !important;
                                        max-width: 100% !important;
                                    }
                                    .edit-field-editor {
                                        font-size: 13px !important;
                                        min-height: 60px !important;
                                    }
                                    .format-toolbar {
                                        padding: 4px !important;
                                    }
                                    .format-btn {
                                        font-size: 12px !important;
                                    }
                                    .edit-modal-btn {
                                        padding: 10px 18px !important;
                                        font-size: 13px !important;
                                    }
                                }
                                @media (max-width: 480px) {
                                    .edit-modal-overlay {
                                        padding: 0 !important;
                                        align-items: stretch !important;
                                        padding-top: 0 !important;
                                        overflow-y: auto !important;
                                    }
                                    .edit-modal {
                                        padding: 12px !important;
                                        border-radius: 0 !important;
                                        max-height: none !important;
                                        min-height: 100vh !important;
                                        width: 100% !important;
                                        max-width: 100% !important;
                                        box-sizing: border-box !important;
                                        display: flex !important;
                                        flex-direction: column !important;
                                    }
                                    .edit-field-editor {
                                        font-size: 14px !important;
                                        min-height: 70px !important;
                                        padding: 10px 12px !important;
                                    }
                                    .format-toolbar {
                                        padding: 3px !important;
                                    }
                                    .format-toolbar-row {
                                        gap: 0 !important;
                                        width: 100% !important;
                                    }
                                    .format-btn {
                                        font-size: 11px !important;
                                    }
                                    /* Кнопки в ряд на мобильном */
                                    .edit-modal > div:last-child {
                                        display: flex !important;
                                        flex-direction: row !important;
                                        gap: 10px !important;
                                        margin-top: auto !important;
                                        padding-top: 12px !important;
                                        flex-shrink: 0 !important;
                                    }
                                    .edit-modal-btn {
                                        padding: 12px 16px !important;
                                        font-size: 14px !important;
                                        flex: 1 !important;
                                        max-width: none !important;
                                        width: auto !important;
                                    }
                                }
                                @media (max-width: 400px) {
                                    .format-btn {
                                        width: 26px !important;
                                        height: 26px !important;
                                    }
                                    .format-color-btn {
                                        width: 26px !important;
                                        height: 26px !important;
                                    }
                                }
                                @media (max-width: 370px) {
                                    .format-btn {
                                        width: 24px !important;
                                        height: 24px !important;
                                    }
                                    .format-color-btn {
                                        width: 24px !important;
                                        height: 24px !important;
                                    }
                                }
                                @media (max-width: 350px) {
                                    .format-btn {
                                        width: 22px !important;
                                        height: 22px !important;
                                    }
                                    .format-color-btn {
                                        width: 22px !important;
                                        height: 22px !important;
                                    }
                                }
                            </style>
                        `;

                        document.body.insertAdjacentHTML('beforeend', modalHTML);

                        // Инициализация редакторов
                        const toolbarContainer = document.getElementById('main-format-toolbar');
                        const questionEditor = document.getElementById('edit-question-editor');
                        const answerEditor = document.getElementById('edit-answer-editor');
                        const categorySelect = document.querySelector('.edit-category');
                        const subcategorySelect = document.querySelector('.edit-subcategory');

                        // Применяем форматирование к редакторам
                        if (questionEditor) {
                            renderFormattingInEditor(questionEditor, item.question, formatting.question || []);
                        }
                        if (answerEditor) {
                            renderFormattingInEditor(answerEditor, item.answer, formatting.answer || []);
                        }

                        // Создаём и инициализируем toolbar
                        if (toolbarContainer) {
                            const mainToolbar = createFormatToolbar('both');
                            toolbarContainer.appendChild(mainToolbar);

                            // Инициализируем toolbar с обоими редакторами
                            initFormatToolbar(mainToolbar, questionEditor, answerEditor, editModalState.formatting, (newFormatting) => {
                                editModalState.formatting = newFormatting;
                            });
                        }

                        // Обработчик смены категории
                        categorySelect.addEventListener('change', () => {
                            const newCategory = categorySelect.value;
                            const newSubs = (categoriesData.find(cat => cat.name === newCategory)?.subcategories || []).map(sub => `<option value="${sub.name}">${sub.name}</option>`).join('');
                            subcategorySelect.innerHTML = newSubs;
                        });

                        // Обработчик отмены
                        document.getElementById('edit-cancel-btn').addEventListener('click', () => {
                            document.getElementById('edit-modal-overlay').remove();
                        });

                        // Обработчик сохранения
                        document.getElementById('edit-save-btn').addEventListener('click', async () => {
                            // Получаем HTML из редакторов
                            const questionHTML = questionEditor.innerHTML.trim();
                            const answerHTML = answerEditor.innerHTML.trim();

                            // Конвертируем HTML в текст + форматирование
                            const questionData = convertHtmlToTextAndFormatting(questionHTML);
                            const answerData = convertHtmlToTextAndFormatting(answerHTML);

                            const newCategory = categorySelect.value;
                            const newSubcategory = subcategorySelect.value;
                            const newQuestion = questionData.text.trim();
                            const newAnswer = answerData.text.trim();

                            if (!newQuestion || !newAnswer) {
                                alert('Вопрос и ответ не могут быть пустыми');
                                return;
                            }

                            const oldQuestion = editModalState.oldQuestion;

                            // Получаем текущее форматирование
                            const currentFormatting = editModalState.formatting || createEmptyFormatting();

                            // Обновляем форматирование новыми данными
                            currentFormatting.question = questionData.formatting || [];
                            currentFormatting.answer = answerData.formatting || [];

                            // Сохраняем в override с форматированием
                            const overrides = getOverrides();

                            const overrideData = {
                                category: newCategory,
                                subcategory: newSubcategory,
                                question: newQuestion,
                                answer: newAnswer,
                                formatting: currentFormatting
                            };

                            if (newQuestion !== oldQuestion) {
                                delete overrides[oldQuestion];
                                overrides[newQuestion] = overrideData;
                            } else {
                                overrides[oldQuestion] = overrideData;
                            }
                            setOverrides(overrides);

                            // Обновляем избранное если нужно
                            const favorites = new Set(JSON.parse(localStorage.getItem('qaFavorites') || '[]'));
                            if (favorites.has(oldQuestion)) {
                                favorites.delete(oldQuestion);
                                favorites.add(newQuestion);
                                localStorage.setItem('qaFavorites', JSON.stringify(Array.from(favorites)));

                                import('../srs/storage.js').then(({ syncFavorite }) => {
                                    try { syncFavorite(newQuestion, true); } catch (e) { }
                                }).catch(() => { });
                            }

                            // Закрываем модальное окно
                            document.getElementById('edit-modal-overlay').remove();

                            // Перерисовываем вопросы
                            displayQuestions(currentQuestions.map(q => q.question === oldQuestion ? { ...q, category: newCategory, subcategory: newSubcategory, question: newQuestion, answer: newAnswer, formatting: currentFormatting } : q), title);

                            // Сохраняем на сервер
                            const rowEl = resultItem.querySelector('.question-row');
                            setInlineSaveStatus(rowEl, 'saving');
                            const ok = await saveMergedToServer();
                            setInlineSaveStatus(rowEl, ok ? 'success' : 'error');
                        });

                        // Закрытие по клику на overlay
                        document.getElementById('edit-modal-overlay').addEventListener('click', (e) => {
                            if (e.target === e.currentTarget) {
                                document.getElementById('edit-modal-overlay').remove();
                            }
                        });
                    };

                    // Кнопка карандаша удалена: редактирование доступно через меню ⋮

                    // 🔥 Используем глобальную функцию с проверкой qaUserCards
                    const genUniqueQuestion = (baseQ) => genUniqueQuestionGlobal(baseQ);

                    kebabBtn.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        document.querySelectorAll('.popup-menu').forEach(m => m.remove());
                        const menu = document.createElement('div');
                        menu.className = 'popup-menu';
                        menu.style.position = 'fixed';
                        menu.style.background = '#222';
                        menu.style.color = '#ddd';
                        menu.style.border = '1px solid #444';
                        menu.style.borderRadius = '6px';
                        menu.style.padding = '6px';
                        menu.style.zIndex = '1000';
                        menu.innerHTML = `
                    <button data-act="edit">Изменить</button>
                    <button data-act="duplicate">Дублировать</button>
                    <button data-act="delete">Удалить</button>
                `;
                        document.body.appendChild(menu);
                        const rect = kebabBtn.getBoundingClientRect();
                        menu.style.left = `${rect.right + 6}px`;
                        menu.style.top = `${rect.top}px`;
                        const onDocClick = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', onDocClick); } };
                        document.addEventListener('click', onDocClick);

                        menu.addEventListener('click', async (e) => {
                            const act = e.target?.dataset?.act; if (!act) return;
                            e.stopPropagation();
                            if (act === 'delete') {
                                // Показать индикатор прогресса
                                const rowEl = resultItem.querySelector('.question-row');
                                setInlineSaveStatus(rowEl, 'saving');

                                // Перемещаем на сервер в корзину
                                moveToServerTrash([item]).then(async (trashOk) => {
                                    if (trashOk) {
                                        // Оптимистично добавляем в локальные кэши корзины
                                        serverTrashSet.add(item.question);
                                        // Обновляем локальный список корзины, чтобы сразу показать карточку
                                        try {
                                            serverTrashItems = [
                                                { item: { ...item } },
                                                ...serverTrashItems.filter(t => t.item?.question !== item.question)
                                            ];
                                        } catch (_) { }

                                        // Убедимся, что панель корзины видна в режиме редактирования
                                        const tp = document.querySelector('.trash-panel');
                                        if (tp && editMode) { tp.style.display = 'block'; }

                                        // Перерисовываем панель корзины и текущий контекст
                                        renderTrashPanel();
                                        refreshCurrentContext();

                                        // Пытаемся синхронизировать с серверной корзиной (не блокирует UI)
                                        try { await refreshServerTrash(); } catch (_) { }

                                        setInlineSaveStatus(rowEl, 'success');
                                        setSaveStatus('success', 'Карточка перемещена в корзину');

                                        // 🔥 Сохраняем на сервер БЕЗ forceReloadData
                                        saveMergedToServer(true).then(saveOk => {
                                            if (!saveOk) setInlineSaveStatus(rowEl, 'error', 'Ошибка сохранения');
                                        });
                                    } else {
                                        setInlineSaveStatus(rowEl, 'error', 'Ошибка удаления');
                                    }
                                });
                            } else if (act === 'duplicate') {
                                // Show visual indicator
                                const rowEl = resultItem.querySelector('.question-row');
                                setInlineSaveStatus(rowEl, 'saving');

                                const copyQ = genUniqueQuestion(item.question);
                                const duplicatedItem = { ...item, question: copyQ };

                                console.log('[DUPLICATE] Создан дубликат:', {
                                    original: item.question?.substring(0, 50),
                                    copy: copyQ,
                                    timestamp: Date.now()
                                });

                                // 🔥 Вставляем дубликат СРАЗУ ПОСЛЕ оригинала в qaUserCards
                                const sessionUserRaw = localStorage.getItem('qaSessionUser');
                                if (sessionUserRaw) {
                                    const userCards = getQaUserCards();
                                    if (userCards) {
                                        // Ищем оригинал по вопросу (может отличаться от item.question если были изменения)
                                        const originalIndex = userCards.findIndex(c =>
                                            c.question === item.question ||
                                            (c.category === item.category && c.subcategory === item.subcategory && c.answer === item.answer)
                                        );
                                        if (originalIndex >= 0) {
                                            // Вставляем дубликат после оригинала
                                            userCards.splice(originalIndex + 1, 0, duplicatedItem);
                                            setQaUserCards(userCards);
                                        } else {
                                            // Если не нашли, добавляем в конец
                                            userCards.push(duplicatedItem);
                                            setQaUserCards(userCards);
                                        }
                                    }

                                    // 🔥 ДОБАВЛЯЕМ в qaNewItems чтобы синхронизация видела новую карточку
                                    const newItems = getNewItems();
                                    if (!newItems.some(n => n.question === copyQ)) {
                                        newItems.push(duplicatedItem);
                                        localStorage.setItem('qaNewItems', JSON.stringify(newItems));

                                        console.log('[DUPLICATE] Добавлено в qaNewItems, всего:', newItems.length);
                                    }
                                }

                                // Track duplication on server
                                trackServerDuplication(item.question, copyQ).then(trackOk => {
                                    if (trackOk) {
                                        // 🔥 Обновляем UI сразу, без forceReloadData, чтобы сохранить порядок карточек
                                        const activeTab = document.querySelector('.tabs-container .tab.active');
                                        if (activeTab) {
                                            if (activeTab.dataset.category === 'all') {
                                                showAllQuestions();
                                            } else if (activeTab.dataset.category === 'favorites') {
                                                showFavorites();
                                            } else {
                                                const selectedCategory = categories.find(cat => cat.id == activeTab.dataset.category);
                                                if (selectedCategory) {
                                                    filterQuestionsByCategory(selectedCategory.name);
                                                } else {
                                                    showAllQuestions();
                                                }
                                            }
                                        } else {
                                            showAllQuestions();
                                        }
                                        setInlineSaveStatus(rowEl, 'success');

                                        // 🔥 Сохраняем на сервер БЕЗ forceReloadData
                                        console.log('[DUPLICATE] Вызываем saveMergedToServer(true)');
                                        saveMergedToServer(true).then(saveOk => {
                                            if (!saveOk) {
                                                setInlineSaveStatus(rowEl, 'error', 'Ошибка сохранения');
                                            }
                                        });
                                    } else {
                                        setInlineSaveStatus(rowEl, 'error', 'Ошибка дублирования');
                                    }
                                });
                            } else if (act === 'edit') {
                                launchEditor();
                            }
                            menu.remove();
                        });
                    });
                }

                resultsList.appendChild(resultItem);
            } catch (err) {
                console.error('Error rendering item:', item, err);
                // Визуально показываем, что элемент сломался (для отладки)
                try {
                    const errDiv = document.createElement('div');
                    errDiv.style.border = '1px solid red';
                    errDiv.style.color = 'red';
                    errDiv.style.padding = '10px';
                    errDiv.textContent = `Ошибка отображения вопроса: ${err.message}`;
                    resultsList.appendChild(errDiv);
                } catch (_) { }
            }
        });
    } catch (e) {
        console.error('Critical error in displayQuestions:', e);
    }
}

// Функция для увеличения карточки (PC версия)
function openCardZoomModal(item, ef) {
    // Проверяем, не открыто ли уже модальное окно
    if (document.querySelector('.card-zoom-overlay')) {
        return;
    }

    // Получаем форматирование
    const questionFormatting = item.formatting?.question || [];
    const answerFormatting = item.formatting?.answer || [];
    const questionHTML = applyFormatting(item.question, questionFormatting);
    const answerHTML = applyFormatting(item.answer, answerFormatting);

    // Создаем overlay
    const overlay = document.createElement('div');
    overlay.className = 'card-zoom-overlay';
    overlay.innerHTML = `
        <div class="card-zoom-modal" onclick="event.stopPropagation()">
            <span class="zoom-category-badge">${item.category || ''}</span>
            ${item.subcategory ? `<span class="zoom-subcategory-badge">${item.subcategory}</span>` : ''}
            ${renderHeartsForZoom(ef)}
            <div class="zoom-question">${questionHTML}</div>
            <div class="zoom-answer">${answerHTML}</div>
            <div class="zoom-close-hint">Нажмите вне карточки или ESC для закрытия</div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Закрытие по клику на overlay
    overlay.addEventListener('click', () => closeCardZoomModal(overlay));

    // Закрытие по ESC
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeCardZoomModal(overlay);
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

function closeCardZoomModal(overlay) {
    overlay.classList.add('closing');
    overlay.querySelector('.card-zoom-modal')?.classList.add('closing');
    
    setTimeout(() => {
        overlay.remove();
    }, 200);
}

// Функция для рендеринга сердечек в модальном окне
function renderHeartsForZoom(ef) {
    if (ef === null || ef === undefined) {
        return '<div class="zoom-hearts-container"><span style="font-size:12px;color:rgba(255,255,255,0.5)">НОВАЯ</span></div>';
    }

    let html = '<div class="zoom-hearts-container">';
    for (let i = 0; i < 5; i++) {
        let fill = 0;
        if (ef >= 1.3 + (i + 1) * 0.32) {
            fill = 1;
        } else if (ef >= 1.3 + i * 0.32) {
            fill = (ef - (1.3 + i * 0.32)) / 0.32;
        }

        const stopVal = Math.round(fill * 100);
        const id = `zoom-heart-${Math.random().toString(36).substr(2, 9)}`;

        html += `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                <defs>
                    <linearGradient id="${id}">
                        <stop offset="${stopVal}%" stop-color="#ff4d4d" />
                        <stop offset="${stopVal}%" stop-color="#444" />
                    </linearGradient>
                </defs>
                <path fill="url(#${id})" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
        `;
    }
    html += '</div>';
    return html;
}
