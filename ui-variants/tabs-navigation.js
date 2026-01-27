// Вариант 3: Табы для категорий и карточки для подкатегорий

// Импортируем данные и генератор категорий
import { uniqueQaData } from '../all-data.js';
import { buildCategoriesFromData } from '../computed-categories.js';
import { setNormalizationDisabled } from '../load-json-data.js';

// Глобальные флаги/состояния для режима редактирования и логина
let editMode = (typeof localStorage !== 'undefined' && localStorage.getItem('qaEditMode') === 'true') ? true : false;
let currentContextKey = 'all';
let currentQuestions = [];
let resultsListRef = null;
// Кэш корзины на стороне сервера (не используем localStorage для удалённых карточек)
let serverTrashSet = new Set();
let serverTrashItems = [];
// Конфигурируемый URL бэкенда (можно задать через localStorage ключ 'qaBackendUrl')
// По умолчанию используем порт 8765, так как локальный сервер запущен там
const BACKEND_URL = (typeof localStorage !== 'undefined' && localStorage.getItem('qaBackendUrl')) || window.location.origin;

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
    const base = uniqueQaData.map(item => ({ ...item }));
    const overrides = getOverrides();
    const newItems = getNewItems();
    const deleted = getDeletedItems();
    // Применяем overrides (категория/подкатегория/вопрос/ответ)
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
    const exists = (q) => uniqueQaData.some(i => i.question === q) || getNewItems().some(i => i.question === q);
    let i = 1; let candidate = `${baseQ} (копия)`;
    while (exists(candidate)) { candidate = `${baseQ} (копия ${i++})`; }
    return candidate;
}
// Плейсхолдеры для отображаемых названий подкатегорий (по категориям)
function getSubcategoryPlaceholders() { return getLS('qaSubcategoryPlaceholders', '{}'); }
function setSubcategoryPlaceholders(obj) { setLS('qaSubcategoryPlaceholders', obj); }

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

export function initTabsNavigation() {
    console.log('Initializing Tabs Navigation...');
    try {
        const container = document.querySelector('.container');
    // Гарантируем видимость контейнеров (на случай если они были скрыты страницей статистики)
    if (container) container.style.display = '';
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.style.display = '';

    const searchContainer = document.querySelector('.search-container');
    // Удаляем старую админ-панель из DOM (новая логика редактирования сверху)
    const legacyAdminPanel = document.querySelector('.admin-panel');
    if (legacyAdminPanel) legacyAdminPanel.remove();
    
    // Создаем контейнер для навигации
    const navigationContainer = document.createElement('div');
    navigationContainer.className = 'tabs-navigation';
    
    // Автоматическая загрузка с учётом текущего контекста
    // Раньше здесь был безусловный вызов showAllQuestions(), который
    // сбрасывал контекст после перезагрузки данных (например, после восстановления из корзины).
    // Теперь используем refreshCurrentContext(), чтобы сохранить выбранную категорию/подкатегорию/избранное.
    setTimeout(() => refreshCurrentContext(), 100);

    // Слушаем обновление избранного из облака
    window.addEventListener('favoritesUpdated', () => {
        refreshCurrentContext();
    });
    
    // Строим категории по данным (с учётом локальных правок/новых элементов/удалений)
    const categories = buildCategoriesFromData(getRuntimeData());

    // Создаем контейнер для табов
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'tabs-container';
    
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
    // Иконка избранного: звезда
    favTab.textContent = '★';
    tabsContainer.appendChild(favTab);
    
    // Добавляем табы для всех категорий
    categories.forEach(category => {
        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.dataset.category = category.id;
        tab.textContent = category.displayName || category.name;
        tabsContainer.appendChild(tab);
    });
    
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
    tabsContainer.addEventListener('click', function(e) {
        if (e.target.classList.contains('tab')) {
            // Удаляем класс active у всех табов
            const tabs = tabsContainer.querySelectorAll('.tab');
            tabs.forEach(tab => tab.classList.remove('active'));
            
            // Добавляем класс active выбранному табу
            e.target.classList.add('active');
            
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
    subcategoriesContainer.addEventListener('click', function(e) {
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
    
    // Создаем верхнюю строку навигации: табы + кнопки действий
    const tabsHeader = document.createElement('div');
    tabsHeader.className = 'tabs-header';
    tabsHeader.appendChild(tabsContainer);

    // Верхняя панель действий над карточками
    const topActions = document.createElement('div');
    topActions.className = 'top-actions';
    
    // Кнопка режима обучения
    const learnBtn = document.createElement('button');
    learnBtn.title = 'Режим обучения';
    learnBtn.textContent = 'Учить';
    learnBtn.className = 'learn-main-btn';
    learnBtn.addEventListener('click', async () => {
        try {
            console.log('[Learn] Button clicked');
            
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
                module = await import('../srs/learn-ui.js?v=7');
            } catch (e1) {
                console.warn('[Learn] Import v7 failed, trying plain import', e1);
                try {
                    module = await import('../srs/learn-ui.js');
                } catch (e2) {
                    throw new Error(`Failed to load learn-ui.js: ${e2.message}`);
                }
            }

            const { startLearnSession } = module;
            if (typeof startLearnSession !== 'function') {
                throw new Error('startLearnSession export is missing');
            }
            
            console.log('[Learn] Starting session with', currentQuestions.length, 'questions');
            startLearnSession(currentQuestions);
        } catch (err) {
            console.error('[Learn] Error:', err);
            alert('Не удалось запустить режим обучения: ' + err.message);
        }
    });

    // Кнопка статистики
    const statsBtn = document.createElement('button');
    statsBtn.title = 'Статистика';
    statsBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="4" height="18" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="17" y="13" width="4" height="8" rx="1"/></svg>`;
    statsBtn.style.color = '#fff';
    statsBtn.addEventListener('click', async () => {
        const { initStatsPage } = await import('../srs/stats-ui.js?v=6');
        location.hash = '#/stats';
        initStatsPage();
    });

    const editToggleBtn = document.createElement('button');
    editToggleBtn.title = 'Режим редактирования';
    editToggleBtn.textContent = '✎';
    // Стили перенесены в CSS (.tabs-actions button)
    editToggleBtn.style.display = 'none';

    const loginMainBtn = document.createElement('button');
    const userIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
    loginMainBtn.innerHTML = userIconSvg;
    loginMainBtn.title = 'Войти';
    loginMainBtn.style.color = '#fff';
    ensureDefaultUsers();
    loginMainBtn.addEventListener('click', () => {
        if (loggedInUser) {
            if (confirm('Выйти из аккаунта?')) {
                setLoggedUser(null);
                loginMainBtn.title = 'Войти';
            }
        } else {
            openLoginModal();
        }
    });
    
    topActions.appendChild(loginMainBtn);
    topActions.appendChild(learnBtn);
    topActions.appendChild(statsBtn);
    topActions.appendChild(editToggleBtn);
    navigationContainer.appendChild(topActions);
    tabsHeader.appendChild(tabsContainer);

    // Удалён прежний огонёк до виджета уровня — перенесён ближе к шкале

    // Logic to update icon/tooltip on login change
    function updateLoginBtnState() {
        loginMainBtn.title = loggedInUser ? 'Выйти' : 'Войти';
        const exitIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M10 17l1.41-1.41L8.83 13H17v-2H8.83l2.58-2.59L10 7l-5 5 5 5z"/><path d="M19 3h-8c-1.1 0-2 .9-2 2v4h2V5h8v14h-8v-4H9v4c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>`;
        loginMainBtn.innerHTML = loggedInUser ? exitIconSvg : userIconSvg;
        loginMainBtn.style.color = '#d0d0d0';
        try { statsBtn.style.color = '#d0d0d0'; } catch {}
    }
    if (!window.qaAuth) window.qaAuth = {};
    window.qaAuth.getUser = () => loggedInUser;
    window.qaAuth.openLogin = () => openLoginModal();
    window.qaAuth.logout = () => setLoggedUser(null);
    // Плашка уровня и XP
    import('../srs/stats-utils.js').then(({ getCurrentLevel }) => {
        const box = document.createElement('div');
        box.className = 'level-inline';
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
        const xpLeft = document.createElement('span');
        xpLeft.className = 'level-inline-xp';
        xpLeft.textContent = `XP:${data.xp}`;
        const xpRight = document.createElement('span');
        xpRight.className = 'level-inline-progress';
        xpRight.textContent = `${currentInLevel}/${totalForLevel}`;
        txt.appendChild(xpLeft);
        txt.appendChild(xpRight);
        bar.appendChild(fill); bar.appendChild(txt);
        box.appendChild(label); box.appendChild(bar);
        topActions.appendChild(box);
        // Огонёк стрика рядом со шкалой уровня
        const streakRaw = localStorage.getItem('studyStreak') || '{}';
        let streakVal = 0;
        try { const s = JSON.parse(streakRaw); streakVal = s.current || 0; } catch {}
        if (streakVal > 0) {
            const flame = document.createElement('span');
            flame.textContent = `🔥 ${streakVal}`;
            flame.className = 'streak-flame';
            flame.style.fontSize = '12px';
            flame.style.marginLeft = '4px';
            topActions.appendChild(flame);
        }
        function updateLevelInline() {
            import('../srs/stats-utils.js').then(({ getCurrentLevel }) => {
                const d = getCurrentLevel();
                const cont = topActions.querySelector('.level-inline');
                if (!cont) return;
                const lbl = cont.querySelector('.lv-label');
                const fl = cont.querySelector('.level-inline-fill');
                const tx = cont.querySelector('.level-inline-text');
                if (lbl) lbl.textContent = `LV:${d.level}`;
                const p = Math.round((d.progress || 0) * 100);
                if (fl) fl.style.width = `${p}%`;
                const cur = Math.max(0, Math.round((d.xp - d.prevThreshold)));
                const tot = d.nextThreshold === Infinity ? cur : Math.round(d.nextThreshold - d.prevThreshold);
                if (tx) tx.textContent = `XP:${d.xp}  ${cur}/${tot}`;
            }).catch(()=>{});
        }
        window.addEventListener('xpUpdated', updateLevelInline);
        window.addEventListener('statsClosed', updateLevelInline);
    }).catch(()=>{});

    // Кнопка для генерации тестовой статистики (админская фича)
    const genStatsBtn = document.createElement('button');
    genStatsBtn.textContent = 'Gen Stats';
    genStatsBtn.style.display = 'none';
    genStatsBtn.style.width = 'auto';
    genStatsBtn.style.background = '#111';
    genStatsBtn.style.border = '1px solid #444';
    genStatsBtn.style.color = '#d0d0d0';
    genStatsBtn.style.marginLeft = '8px';
    genStatsBtn.addEventListener('click', async () => {
         if (confirm('Сгенерировать тестовую статистику в SUPABASE за 6 месяцев? Это перезапишет данные в облаке для вашего пользователя.')) {
             try {
                 const { generateTestStats } = await import('../admin-data-generator.js');
                 generateTestStats();
             } catch (e) {
                 console.error(e);
                 alert('Ошибка при загрузке модуля генератора: ' + e.message);
             }
         }
    });
    
    topActions.appendChild(genStatsBtn);

    // Кнопка администратора для добавления пользователей (появляется после входа админа)
    const adminUsersBtn = document.createElement('button');
    adminUsersBtn.className = 'admin-users-btn';
    adminUsersBtn.textContent = 'Добавить пользователя';
    adminUsersBtn.style.display = 'none';
    adminUsersBtn.style.width = 'auto';
    adminUsersBtn.style.background = '#111';
    adminUsersBtn.style.border = '1px solid #444';
    adminUsersBtn.style.color = '#d0d0d0';
    adminUsersBtn.addEventListener('click', openAdminUsersPanel);
    topActions.appendChild(adminUsersBtn);

    const cloudBtn = document.createElement('button');
    cloudBtn.title = 'Облако';
    cloudBtn.textContent = 'Облако';
    cloudBtn.style.display = 'none';
    cloudBtn.style.width = 'auto';
    cloudBtn.style.background = '#111';
    cloudBtn.style.border = '1px solid #444';
    cloudBtn.style.color = '#d0d0d0';
    cloudBtn.addEventListener('click', openCloudOverview);
    topActions.insertBefore(cloudBtn, adminUsersBtn);
    // Инициализация состояния кнопок по сохранённому пользователю
    try { setLoggedUser(loggedInUser); } catch {}

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
    trashPanel.innerHTML = '<strong>Корзина</strong><div id="trash-categories" style="margin-top:6px"></div><div id="trash-cards" style="margin-top:6px"></div>';

    // Добавляем элементы в контейнер навигации
    // navigationContainer.appendChild(tabsContainer);
    navigationContainer.appendChild(tabsHeader);
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

    // Привязываем глобальную ссылку на индикатор сохранения
    // globalSaveStatusEl = saveStatus; // Removed in favor of global toast

    (async () => {
        try {
            const meta = await getServerMetadata();
            if (Array.isArray(meta.categoryOrder)) setCategoryOrder(meta.categoryOrder);
            if (meta.subcategoryOrder && typeof meta.subcategoryOrder === 'object') setSubcategoryOrderMap(meta.subcategoryOrder);
            if (meta.orderOverrides && typeof meta.orderOverrides === 'object') setLS('qaOrderOverrides', meta.orderOverrides);
            await refreshServerTrash();
            refreshCategoriesTabs();
        } catch {}
    })();

    // Применяем сохранённый режим редактирования при инициализации
    if (editMode) {
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
                trashBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path d="M9 3h6l1 2h4v2H4V5h4l1-2z" fill="currentColor" />
                        <path d="M6 9h12l-1 10a2 2 0 0 1-2 2H9a 2 2 0 0 1-2-2L6 9z" fill="currentColor" />
                    </svg>`;
                sidebarButtons.appendChild(trashBtn);
            }
            trashPanel.style.display = 'block';
            if (sidebar && searchHistory) {
                try { sidebar.insertBefore(trashPanel, searchHistory); } catch {}
            }
            container.classList.add('edit-mode');
            renderTrashPanel();
            refreshCategoryEditMenus();
        } catch {}
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
            try { loggedInUser = JSON.parse(currentRaw); } catch {}
        }
        updateLoginBtnState();
    }

    const DATA_KEYS = [
        'srsProgress', 'studyStats', 'studyStreak', 'dailyPoints', 
        'dailyBonusPoints', 'dailyDayBonusPoints', 'qaFavorites', 'studyAchievements'
    ];

    function setLoggedUser(user) {
        // Переключение Guest -> User (Login)
        if (!loggedInUser && user) {
            // Бэкап данных гостя
            const backup = {};
            DATA_KEYS.forEach(k => backup[k] = localStorage.getItem(k));
            localStorage.setItem('guest_backup', JSON.stringify(backup));
            
            // Очищаем данные, чтобы загрузить профиль пользователя начисто
            DATA_KEYS.forEach(k => localStorage.removeItem(k));
            localStorage.removeItem('localDataTimestamp'); 
        }

        // Переключение User -> Guest (Logout)
        if (loggedInUser && !user) {
            // Восстанавливаем данные гостя
            const raw = localStorage.getItem('guest_backup');
            if (raw) {
                try {
                    const backup = JSON.parse(raw);
                    DATA_KEYS.forEach(k => {
                        if (backup[k] !== null) localStorage.setItem(k, backup[k]);
                        else localStorage.removeItem(k);
                    });
                } catch {}
            } else {
                // Если бэкапа нет (странно), чистим, чтобы не оставить данные админа
                DATA_KEYS.forEach(k => localStorage.removeItem(k));
            }
            localStorage.removeItem('localDataTimestamp');
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
        } catch {}
        updateLoginBtnState();
        // Показать/скрыть админские кнопки в зависимости от роли
        try {
            adminUsersBtn.style.display = (user && user.role === 'admin') ? 'inline-block' : 'none';
            editToggleBtn.style.display = (user && user.role === 'admin') ? 'inline-block' : 'none';
            genStatsBtn.style.display = (user && user.role === 'admin') ? 'inline-block' : 'none';
        } catch {}
        try { migrateDeviceRecordsToUser(); } catch {}
        if (user) {
            import('../srs/storage.js').then(mod => {
                if (mod && typeof mod.hydrateLocalFromSupabase === 'function') {
                    mod.hydrateLocalFromSupabase().then(() => {
                        const evt = new Event('xpUpdated'); window.dispatchEvent(evt);
                        // Также обновляем избранное
                         window.dispatchEvent(new Event('favoritesUpdated'));
                    }).catch(()=>{});
                }
            }).catch(()=>{});
        } else {
             // Если вышли (Guest), тоже обновим UI
             window.dispatchEvent(new Event('xpUpdated'));
             window.dispatchEvent(new Event('favoritesUpdated'));
        }
    }

    function openLoginModal() {
        let ov = document.getElementById('login-overlay');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'login-overlay';
            ov.style.position = 'fixed';
            ov.style.inset = '0';
            ov.style.background = 'rgba(0,0,0,0.6)';
            ov.style.display = 'flex';
            ov.style.alignItems = 'center';
            ov.style.justifyContent = 'center';
            ov.style.zIndex = '5000';
            ov.innerHTML = `
                <div style="background:#2a2a2a;color:#fff;padding:16px 20px;border-radius:10px;width:360px;box-shadow:0 8px 24px rgba(0,0,0,0.35)">
                    <div style="font-weight:600;margin-bottom:10px">Вход</div>
                    <form id="login-form" autocomplete="on" style="display:flex;flex-direction:column;gap:8px">
                        <input id="login-username" name="username" autocomplete="username" placeholder="Логин" style="width:100%;box-sizing:border-box;padding:8px;border-radius:6px;border:1px solid #444;background:#1f1f1f;color:#fff"/>
                        <div style="position:relative;display:block">
                            <input id="login-password" name="password" autocomplete="current-password" placeholder="Пароль" type="password" style="width:100%;box-sizing:border-box;padding:8px 36px 8px 8px;border-radius:6px;border:1px solid #444;background:#1f1f1f;color:#fff"/>
                            <button type="button" id="login-pass-eye" title="Показать пароль" aria-label="Показать пароль" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);padding:0;border:none;background:transparent;color:#ccc;width:22px;height:22px">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                            </button>
                        </div>
                        <label style="display:flex;gap:8px;align-items:center;font-size:12px;color:#ddd">
                            <input type="checkbox" id="login-remember" checked />
                            Оставаться в системе
                        </label>
                        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">
                            <button id="login-cancel" type="button" style="padding:8px 12px;border-radius:6px;border:1px solid #555;background:#1f1f1f;color:#fff">Отмена</button>
                            <button id="login-submit" type="submit" style="padding:8px 12px;border-radius:6px;border:1px solid #e0b000;background:#ffd54f;color:#111;font-weight:700">Войти</button>
                        </div>
                    </form>
                </div>
            `;
            document.body.appendChild(ov);
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
                    // Try Supabase auth first if available
                    let authed = null;
                    const client = window.__supabaseClient;
                    if (client) {
                        const { data, error } = await client.auth.signInWithPassword({ email: u, password: p });
                        if (!error && data && data.user) {
                            const user = data.user;
                            const role = (user.user_metadata && user.user_metadata.role) || 'user';
                            authed = { id: user.id, email: user.email, role };
                        }
                        if (!authed) {
                            try {
                                const { data: row, error: e2 } = await client.from('users').select('*').eq('username', u).eq('password', p).single();
                                if (!e2 && row) {
                                    authed = { id: row.id || row.username, email: row.username, role: row.role || 'user' };
                                }
                            } catch {}
                        }
                    }
                    if (authed) {
                        setLoggedUser(authed); // remember ignored in setLoggedUser currently, but that is fine
                        ov.remove();
                    } else {
                        // Fallback to local users (legacy)
                        const raw = localStorage.getItem('usersDB') || '[]';
                        const users = JSON.parse(raw);
                        const match = users.find(x => x.username === u && x.password === p);
                        if (match) {
                            setLoggedUser({ username: match.username, role: match.role });
                            ov.remove();
                        } else {
                            alert('Неверный логин или пароль');
                        }
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
                <div style="background:#2a2a2a;color:#fff;padding:16px 20px;border-radius:10px;width:360px;box-shadow:0 8px 24px rgba(0,0,0,0.35)">
                    <div style="font-weight:600;margin-bottom:10px">Добавить пользователя</div>
                    <div style="display:flex;flex-direction:column;gap:8px">
                        <input id="new-username" placeholder="Логин" style="padding:8px;border-radius:6px;border:1px solid #444;background:#1f1f1f;color:#fff"/>
                        <input id="new-password" placeholder="Пароль" type="password" style="padding:8px;border-radius:6px;border:1px solid #444;background:#1f1f1f;color:#fff"/>
                        <select id="new-role" style="padding:8px;border-radius:6px;border:1px solid #444;background:#1f1f1f;color:#fff">
                            <option value="user">Пользователь</option>
                            <option value="admin">Администратор</option>
                        </select>
                        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">
                            <button id="admin-cancel" style="padding:8px 12px;border-radius:6px;border:1px solid #555;background:#1f1f1f;color:#fff">Отмена</button>
                            <button id="admin-add" style="padding:8px 12px;border-radius:6px;border:1px solid #3b82f6;background:#3b82f6;color:#fff">Добавить</button>
                        </div>
                    </div>
                </div>
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
                        } catch {}
                    }
                    const raw = localStorage.getItem('usersDB') || '[]';
                    let users = [];
                    try { users = JSON.parse(raw); } catch {}
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
                <div style="background:#1f1f1f;color:#fff;padding:16px 20px;border-radius:10px;width:560px;max-width:90vw;box-shadow:0 8px 24px rgba(0,0,0,0.35)">
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
                </div>
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
            usersEl.innerHTML = (data || []).map(u => `<div>${u.username} • роль: ${u.role || 'user'}</div>`).join('') || '<div>Пусто</div>';
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
                        try { result = await migrateDeviceRecordsToUser(); } catch {}
                        btn.disabled = false;
                        const d = (result && typeof result.daily === 'number') ? result.daily : 0;
                        const c = (result && typeof result.cards === 'number') ? result.cards : 0;
                        window.__cloudLastMigration = { daily: d, cards: c, at: Date.now() };
                        btn.textContent = `Готово: достижения ${d}, карточки ${c}`;
                        setTimeout(() => { btn.textContent = 'Привязать device_* к текущему пользователю'; }, 1800);
                        loadStats();
                    });
                }
                if (window.__cloudLastMigration && typeof window.__cloudLastMigration.daily === 'number') {
                    const info = document.createElement('div');
                    info.style.cssText = 'margin:6px 0;padding:6px 10px;border:1px solid #444;background:#222;color:#ddd;border-radius:6px';
                    info.textContent = `Последняя миграция: достижения ${window.__cloudLastMigration.daily}, карточки ${window.__cloudLastMigration.cards}`;
                    statsEl.appendChild(info);
                    // очистить через короткое время, чтобы не мешало
                    setTimeout(() => { try { delete window.__cloudLastMigration; } catch {} }, 2500);
                }
                const rows = list.map(s => `<div>${s.user_id} • ${s.date} • xp:${s.xp} • бонус:${s.bonus} • день:${s.day_bonus} • стрик:${s.streak}</div>`).join('');
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
                } catch {}
                try { await client.from('daily_stats').delete().eq('user_id', row.user_id).eq('date', row.date); } catch {}
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
                } catch {}
                try { await client.from('card_progress').delete().eq('user_id', row.user_id).eq('question', row.question); } catch {}
            }
            return { daily: dailyMigrated, cards: cardsMigrated };
        } catch {}
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
        } catch {}
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
        menu.style.position = 'absolute';
        menu.style.background = '#222';
        menu.style.color = '#ddd';
        menu.style.border = '1px solid #444';
        menu.style.borderRadius = '6px';
        menu.style.padding = '6px';
        menu.style.zIndex = '1000';
        menu.innerHTML = `
            <button data-act="rename">Переименовать</button>
            <button data-act="duplicate">Дублировать</button>
            <button data-act="delete">Удалить</button>
        `;
        document.body.appendChild(menu);
        const rect = tabEl.getBoundingClientRect();
        menu.style.left = `${rect.right + 6}px`;
        menu.style.top = `${rect.top}px`;
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
                } catch {}
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
        menu.style.position = 'absolute';
        menu.style.background = '#222';
        menu.style.color = '#ddd';
        menu.style.border = '1px solid #444';
        menu.style.borderRadius = '6px';
        menu.style.padding = '6px';
        menu.style.zIndex = '1000';
        menu.innerHTML = `
            <button data-act="rename">Переименовать</button>
            <button data-act="duplicate">Дублировать</button>
            <button data-act="delete">Удалить</button>
        `;
        document.body.appendChild(menu);
        const rect = cardEl.getBoundingClientRect();
        menu.style.left = `${rect.right + 6}px`;
        menu.style.top = `${rect.top}px`;
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
                } catch {}
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
        } catch {}
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

            // Вопрос
            const qText = document.createElement('div');
            qText.className = 'question';
            qText.textContent = it?.question || q;
            qText.style.marginTop = '6px';

            // Ответ
            const aEl = document.createElement('div');
            aEl.className = 'answer';
            aEl.textContent = it?.answer || '';
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
                console.log('[restore-click(inner)] Запрошено восстановление', {
                    question: q,
                    inUnique: !!uniqueQaData.find(i => i.question === q),
                    inNewItems: !!getNewItems().find(i => i.question === q),
                    inServerTrashSet: serverTrashSet.has(q),
                    wasDeletedLocally: !!getDeletedItems()[q]
                });
                restoreBtn.textContent = 'Восстановление...'; restoreBtn.disabled = true;
                // Удаляем из локального кэша корзины сразу
                serverTrashSet.delete(q);
                serverTrashItems = serverTrashItems.filter(t => t.item?.question !== q);
                // Очищаем локальную карту удалений для этой карточки, если была помечена
                const delMap = getDeletedItems();
                if (delMap && delMap[q]) { delete delMap[q]; setDeletedItems(delMap); }
                console.log('[restore-click(inner)] Локальные кеши обновлены', {
                    serverTrashSetSize: serverTrashSet.size,
                    delMapSize: Object.keys(getDeletedItems()).length
                });
                renderTrashPanel();
                // Обновляем без сброса контекста
                refreshCurrentContext();
                // Пытаемся восстановить на сервере
                let restoreOk = false;
                try { restoreOk = await restoreFromServerTrash([q]); } catch (_) { restoreOk = false; }
                if (!restoreOk) {
                    // Обновляем корзину с сервера на случай рассинхронизации
                    try { await refreshServerTrash(); } catch (_) {}
                    setSaveStatus('error', 'Сервер восстановления недоступен');
                    restoreBtn.textContent = 'Восстановить'; restoreBtn.disabled = false;
                } else {
                    try { await refreshServerTrash(); } catch (_) {}
                    // Если восстановленной карточки нет в базовом наборе и среди новых — добавим в новые для сохранения
                    const baseHas = !!uniqueQaData.find(i => i.question === q);
                    const newItemsArr = getNewItems();
                    const newHas = !!newItemsArr.find(i => i.question === q);
                    if (!baseHas && !newHas && it) {
                        newItemsArr.push({ ...it });
                        setLS('qaNewItems', newItemsArr);
                        console.log('[restore-click(inner)] Карточка добавлена в qaNewItems для сохранения', { question: q });
                    } else {
                        console.log('[restore-click(inner)] Карточка уже присутствует, добавление в qaNewItems не требуется', { question: q, baseHas, newHas });
                    }
                    try { window.__lastRestoredQuestion = q; } catch (_) {}
                    // Сохраняем объединённые данные на сервер, чтобы восстановленная карточка стала частью основного файла
                    try {
                        const saved = await saveMergedToServer();
                        console.log('[restore-click(inner)] Сохранение после восстановления завершено', { ok: saved });
                    } catch (e) {
                        console.error('[restore-click(inner)] Ошибка сохранения после восстановления', e);
                    }
                    setSaveStatus('success', 'Карточка восстановлена');
                    restoreBtn.textContent = 'Готово'; setTimeout(() => { restoreBtn.textContent = 'Восстановить'; restoreBtn.disabled = false; }, 1500);
                }
            });

            // Окончательное удаление
            purgeBtn.addEventListener('click', async () => {
                purgeBtn.textContent = 'Удаление...'; purgeBtn.disabled = true;
                try {
                    const resp = await fetch(`${BACKEND_URL}/delete-permanent`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ questions: [q] })
                    });
                    if (resp.ok) {
                        // Удаляем из серверной корзины и локальных кэшей
                        serverTrashSet.delete(q);
                        serverTrashItems = serverTrashItems.filter(t => t.item?.question !== q);
                        // Помечаем как удалённый локально, чтобы не вернулся после очистки корзины
                        const delMap = getDeletedItems(); delMap[q] = true; setDeletedItems(delMap);
                        // Если карточка была среди новых, удалим её
                        const newArr = getNewItems().filter(i => i.question !== q); setLS('qaNewItems', newArr);
                        renderTrashPanel();
                        refreshCurrentContext();
                        try { await saveMergedToServer(); } catch {}
                        setSaveStatus('success', 'Карточка удалена навсегда');
                    } else {
                        setSaveStatus('error', 'Ошибка окончательного удаления');
                    }
                } catch (e) {
                    setSaveStatus('error', 'Сервер удаления недоступен');
                }
                purgeBtn.textContent = 'Удалить навсегда'; purgeBtn.disabled = false;
            });

            grid.appendChild(mini);
        });
    }

    // Удалена старая логика второго модального окна входа

    editToggleBtn.style.background = '#111';
    editToggleBtn.style.border = '1px solid #444';
    editToggleBtn.style.color = '#d0d0d0';
    editToggleBtn.addEventListener('click', () => {
        editMode = !editMode;
        // В режиме редактирования отключаем авто-нормализацию категорий при загрузке
        try { setNormalizationDisabled(editMode); } catch {}
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
                trashBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path d="M9 3h6l1 2h4v2H4V5h4l1-2z" fill="currentColor" />
                        <path d="M6 9h12l-1 10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 9z" fill="currentColor" />
                    </svg>`;
                sidebarButtons.appendChild(trashBtn);
            }
            // перенести саму панель корзины в левую панель, сразу под заголовком
            if (sidebar && searchHistory) {
                try { sidebar.insertBefore(trashPanel, searchHistory); } catch {}
            }
            container.classList.add('edit-mode');
        } else {
            trashPanel.style.display = 'none';
            // убрать индикатор корзины из заголовка боковой панели
            const existingTrashBtn = sidebarButtons ? sidebarButtons.querySelector('#trash-mode-button') : null;
            if (existingTrashBtn) existingTrashBtn.remove();
            container.classList.remove('edit-mode');
        }
        try { localStorage.setItem('qaEditMode', editMode ? 'true' : 'false'); } catch {}
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
            const resp = await fetch(`${BACKEND_URL}/save`, {
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
            const resp = await fetch(`${BACKEND_URL}/trash`, {
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
            const resp = await fetch(`${BACKEND_URL}/restore`, {
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
            const resp = await fetch('http://localhost:8085/duplicate', {
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

async function saveMergedToServer() {
    try {
        const overrides = getOverrides();
        const newItems = getNewItems();
        const deletedMap = getDeletedItems();
        const merged = [];
        const seen = new Set();
        console.log('[saveMergedToServer] Старт', {
            baseCount: uniqueQaData.length,
            overridesCount: Object.keys(overrides || {}).length,
            newItemsCount: Array.isArray(newItems) ? newItems.length : 0,
            deletedCount: Object.keys(deletedMap || {}).length,
            serverTrashCount: serverTrashSet.size
        });

        uniqueQaData.forEach(item => {
            if (deletedMap[item.question] || serverTrashSet.has(item.question)) return;
            const ov = overrides[item.question];
            const mergedItem = ov ? { ...item, ...ov } : item;
            merged.push(mergedItem);
            seen.add(item.question);
        });

        newItems.forEach(n => {
            if (!seen.has(n.question) && !deletedMap[n.question] && !serverTrashSet.has(n.question)) {
                const ov = overrides[n.question];
                merged.push(ov ? { ...n, ...ov } : n);
                seen.add(n.question);
            }
        });
        const lastRestored = typeof window !== 'undefined' ? window.__lastRestoredQuestion : null;
        console.log('[saveMergedToServer] Перед отправкой', {
            mergedCount: merged.length,
            containsLastRestored: lastRestored ? merged.some(i => i.question === lastRestored) : 'n/a',
        });

        const resp = await fetch(`${BACKEND_URL}/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(merged)
        });
        let ok = resp.ok;
        let responseJson = null;
        try {
            responseJson = await resp.json();
            if (typeof responseJson?.ok === 'boolean') ok = ok && responseJson.ok;
        } catch (_) {}
        console.log('[saveMergedToServer] Ответ сервера', { ok, responseJson });
        if (!ok) throw new Error('Сервер вернул ошибку при сохранении');

        setSaveStatus('success');
        setTimeout(() => { window.dispatchEvent(new Event('forceReloadData')); }, 50);
        return true;
    } catch (e) {
        console.error('Save failed:', e);
        setSaveStatus('error', 'Ошибка: ' + e.message);
        return false;
    }
}

async function moveToServerTrash(items) {
    try {
        const resp = await fetch(`${BACKEND_URL}/trash`, {
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
        const resp = await fetch(`${BACKEND_URL}/restore`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questions: questions })
        });
        let ok = resp.ok;
        let jsonResp = null;
        try { jsonResp = await resp.json(); if (typeof jsonResp?.ok === 'boolean') ok = ok && jsonResp.ok; } catch (_) {}
        try { window.__lastRestoredQuestion = Array.isArray(questions) ? questions[0] : null; } catch (_) {}
        console.log('[restoreFromServerTrash] Результат', { ok, restored_count: jsonResp?.restored_count, questions });
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
        const resp = await fetch(`${BACKEND_URL}/metadata`);
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
        const resp = await fetch(`${BACKEND_URL}/metadata`);
        if (resp.ok) {
            const data = await resp.json();
            const bin = Array.isArray(data.trash_bin) ? data.trash_bin : [];
            serverTrashItems = bin;
            serverTrashSet = new Set(bin.map(t => t.item?.question).filter(Boolean));
            console.log('[refreshServerTrash] Обновлено', { size: serverTrashSet.size });
        }
    } catch (e) {
        console.error('Failed to refresh server trash:', e);
    }
}

async function updateServerMetadata(metadata) {
    try {
        // Преобразуем ключи клиента (camelCase) в серверные (snake_case)
        const payload = {};
        if (Array.isArray(metadata.categoryOrder)) payload.category_order = metadata.categoryOrder;
        if (metadata.subcategoryOrder && typeof metadata.subcategoryOrder === 'object') payload.subcategory_order = metadata.subcategoryOrder;
        if (metadata.orderOverrides && typeof metadata.orderOverrides === 'object') payload.card_order = metadata.orderOverrides;
        const resp = await fetch(`${BACKEND_URL}/metadata`, {
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

            // Вопрос
            const qEl = document.createElement('div'); qEl.className = 'question'; qEl.textContent = it?.question || q || '';
            qEl.style.marginTop = '6px';

            // Ответ
            const aEl = document.createElement('div'); aEl.className = 'answer'; aEl.textContent = it?.answer || '';
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
                console.log('[restore-click] Запрошено восстановление', {
                    question: q,
                    inUnique: !!uniqueQaData.find(i => i.question === q),
                    inNewItems: !!getNewItems().find(i => i.question === q),
                    inServerTrashSet: serverTrashSet.has(q),
                    wasDeletedLocally: !!getDeletedItems()[q]
                });
                restoreBtn.textContent = 'Восстановление...'; restoreBtn.disabled = true;
                // Удаляем из локального кэша корзины сразу
                serverTrashSet.delete(q);
                serverTrashItems = serverTrashItems.filter(t => t.item?.question !== q);
                // Если карта локальных удалений помечала эту карточку как удалённую — очистим
                const delMap = getDeletedItems();
                if (delMap && delMap[q]) { delete delMap[q]; setDeletedItems(delMap); }
                console.log('[restore-click] Локальные кеши обновлены', {
                    serverTrashSetSize: serverTrashSet.size,
                    delMapSize: Object.keys(getDeletedItems()).length
                });
                renderTrashPanel();
                // Обновляем текущий список в зависимости от активного таба
                // Обновляем без сброса контекста
                refreshCurrentContext();
                // Пытаемся восстановить на сервере
                let ok = false; try { ok = await restoreFromServerTrash([q]); } catch (e) { console.error('[restore-click] Ошибка запроса к серверу /restore', e); ok = false; }
                if (ok) {
                    try { await refreshServerTrash(); } catch (_) {}
                    // Если восстановленной карточки нет в текущем базовом наборе (uniqueQaData)
                    // и она не числится среди новых элементов — добавим её в новые для последующего сохранения.
                    const baseHas = !!uniqueQaData.find(i => i.question === q);
                    const newItemsArr = getNewItems();
                    const newHas = !!newItemsArr.find(i => i.question === q);
                    if (!baseHas && !newHas && it) {
                        newItemsArr.push({ ...it });
                        setLS('qaNewItems', newItemsArr);
                        console.log('[restore-click] Карточка добавлена в qaNewItems для сохранения', { question: q });
                    } else {
                        console.log('[restore-click] Карточка уже присутствует в данных, добавление в qaNewItems не требуется', { question: q, baseHas, newHas });
                    }
                    try { window.__lastRestoredQuestion = q; } catch (_) {}
                    // После успешного восстановления сразу сохраняем объединённые данные на сервер,
                    // чтобы карточка не пропадала после очистки данных сайта.
                    try { const saved = await saveMergedToServer(); console.log('[restore-click] Сохранение после восстановления завершено', { ok: saved }); } catch (e) { console.error('[restore-click] Ошибка сохранения после восстановления', e); }
                    setSaveStatus('success', 'Карточка восстановлена');
                    restoreBtn.textContent = 'Готово'; setTimeout(() => { restoreBtn.textContent = 'Восстановить'; restoreBtn.disabled = false; }, 1500);
                } else {
                    try { await refreshServerTrash(); } catch (_) {}
                    setSaveStatus('error', 'Ошибка восстановления на сервере');
                    restoreBtn.textContent = 'Восстановить'; restoreBtn.disabled = false;
                }
            });

            // Окончательное удаление (вторая ветка)
            purgeBtn2.addEventListener('click', async () => {
                purgeBtn2.textContent = 'Удаление...'; purgeBtn2.disabled = true;
                try {
                    const resp = await fetch(`${BACKEND_URL}/delete-permanent`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ questions: [q] })
                    });
                    if (resp.ok) {
                        serverTrashSet.delete(q);
                        serverTrashItems = serverTrashItems.filter(t => t.item?.question !== q);
                        const delMap = getDeletedItems(); delMap[q] = true; setDeletedItems(delMap);
                        const newArr = getNewItems().filter(i => i.question !== q); setLS('qaNewItems', newArr);
                        renderTrashPanel();
                        refreshCurrentContext();
                        try { await saveMergedToServer(); } catch {}
                        setSaveStatus('success', 'Карточка удалена навсегда');
                    } else {
                        setSaveStatus('error', 'Ошибка окончательного удаления');
                    }
                } catch (e) {
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
    } catch (_) {
        showAllQuestions();
    }
}

// Функция для отображения вопросов
function displayQuestions(questions, title) {
    const resultsList = document.getElementById('results-list');
    resultsList.innerHTML = '';
    resultsListRef = resultsList;
    currentQuestions = [...questions];

    // Применяем порядок, если задан
    const order = getOrderForContext(currentContextKey);
    if (order) {
        const idx = new Map(order.map((q, i) => [q, i]));
        currentQuestions.sort((a, b) => (idx.get(a.question) ?? 1e9) - (idx.get(b.question) ?? 1e9));
    }
    
    // Обновляем счетчик результатов (вынесен из grid)
    let countContainer = document.getElementById('results-count-container');
    if (!countContainer) {
        countContainer = document.createElement('div');
        countContainer.id = 'results-count-container';
        countContainer.className = 'results-header'; // Use existing class for style
        countContainer.style.padding = '0 20px 10px 20px';
        countContainer.style.marginBottom = '0';
        resultsList.parentNode.insertBefore(countContainer, resultsList);
    }
    countContainer.innerHTML = `<p class="results-count" style="margin:0">Найдено: ${questions.length}</p>`;
    
    // Добавляем вопросы
    currentQuestions.forEach((item, index) => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';
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
        const favorites = JSON.parse(localStorage.getItem('qaFavorites') || '[]');
        const isFav = favorites.includes(item.question);
        const favClass = isFav ? 'fav-active' : '';

        // Отображаем бейджи с учётом плейсхолдеров
        const catPlaceholders = getCategoryPlaceholders();
        const scPlaceholders = getSubcategoryPlaceholders();
        const dispCat = (catPlaceholders[item.category] && catPlaceholders[item.category].displayName) || item.category || '';
        const dispSub = (scPlaceholders[item.category] && scPlaceholders[item.category][item.subcategory] && scPlaceholders[item.category][item.subcategory].displayName) || item.subcategory || '';

        const starSvg = (filled) => `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                    style="fill: ${filled ? '#ffd700' : 'none'}; stroke: ${filled ? '#ffd700' : 'currentColor'}; stroke-width: 2px;"
                />
            </svg>
        `;
        resultItem.innerHTML = `
            <div class="question-row">
                <span class="category-badge">${dispCat}</span>
                <span class="subcategory-badge">${dispSub}</span>
            </div>
            <button class="fav-btn ${favClass}" title="В избранное" style="position:absolute;top:10px;right:10px;width:24px;height:24px;background:none;border:none;cursor:pointer;padding:0;z-index:999;display:block !important;opacity:1 !important;">${starSvg(isFav)}</button>
            <div class="question">${item.question}</div>
            <div class="answer">${item.answer}</div>
        `;

        // Обработчик избранного
        const favBtn = resultItem.querySelector('.fav-btn');
        favBtn.addEventListener('click', () => {
            const current = new Set(JSON.parse(localStorage.getItem('qaFavorites') || '[]'));
            if (current.has(item.question)) {
                current.delete(item.question);
                favBtn.classList.remove('fav-active');
                favBtn.innerHTML = starSvg(false);
                import('../srs/storage.js').then(({ syncFavorite }) => { try { syncFavorite(item.question, false); } catch {} }).catch(()=>{});
            } else {
                current.add(item.question);
                favBtn.classList.add('fav-active');
                favBtn.innerHTML = starSvg(true);
                import('../srs/storage.js').then(({ syncFavorite }) => { try { syncFavorite(item.question, true); } catch {} }).catch(()=>{});
            }
            localStorage.setItem('qaFavorites', JSON.stringify(Array.from(current)));
        });

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

            const launchEditor = () => {
                const categoriesData = buildCategoriesFromData(getRuntimeData());
                const categoryOptions = categoriesData.map(cat => `<option value="${cat.name}" ${item.category === cat.name ? 'selected' : ''}>${cat.name}</option>`).join('');
                const selectedCategory = categoriesData.find(cat => cat.name === item.category);
                const subcategoryOptions = selectedCategory ? selectedCategory.subcategories.map(sub => `<option value="${sub.name}" ${item.subcategory === sub.name ? 'selected' : ''}>${sub.name}</option>`).join('') : '';
                resultItem.innerHTML = `
                    <div class="question-row">
                        <label>Категория: <select class="edit-category">${categoryOptions}</select></label>
                        <label>Подкатегория: <select class="edit-subcategory">${subcategoryOptions}</select></label>
                        <button class="save-inline" title="Сохранить">✓</button>
                    </div>
                    <div><label>Вопрос:<br><textarea class="edit-question" style="width:100%">${item.question}</textarea></label></div>
                    <div><label>Ответ:<br><textarea class="edit-answer" style="width:100%">${item.answer}</textarea></label></div>
                `;
                const editCategory = resultItem.querySelector('.edit-category');
                const editSubcategory = resultItem.querySelector('.edit-subcategory');
                const editQuestion = resultItem.querySelector('.edit-question');
                const editAnswer = resultItem.querySelector('.edit-answer');
                setTimeout(() => {
                    editQuestion.focus();
                    const qLen = editQuestion.value.length;
                    editQuestion.setSelectionRange(qLen, qLen);
                }, 0);
                editCategory.addEventListener('change', () => {
                    const newCategory = editCategory.value;
                    const newSubs = (categoriesData.find(cat => cat.name === newCategory)?.subcategories || []).map(sub => `<option value="${sub.name}">${sub.name}</option>`).join('');
                    editSubcategory.innerHTML = newSubs;
                });
                resultItem.querySelector('.save-inline').addEventListener('click', async () => {
                    const newCategory = editCategory.value;
                    const newSubcategory = editSubcategory.value;
                    const newQuestion = editQuestion.value.trim();
                    const newAnswer = editAnswer.value.trim();
                    if (!newQuestion || !newAnswer) { alert('Вопрос и ответ не могут быть пустыми'); return; }
                    const overrides = getOverrides();
                    // Храним override под ключом исходного вопроса, чтобы лоадер корректно применил замену
                    overrides[item.question] = { category: newCategory, subcategory: newSubcategory, question: newQuestion, answer: newAnswer };
                    setOverrides(overrides);
                    // После сохранения — перерисовка с карандашом и меню
                    displayQuestions(currentQuestions.map(q => q.question === item.question ? { ...q, category: newCategory, subcategory: newSubcategory, question: newQuestion, answer: newAnswer } : q), title);
                    const rowEl = resultItem.querySelector('.question-row');
                    setInlineSaveStatus(rowEl, 'saving');
                    const ok = await saveMergedToServer();
                    setInlineSaveStatus(rowEl, ok ? 'success' : 'error');
                });
            };

            // Кнопка карандаша удалена: редактирование доступно через меню ⋮

            const genUniqueQuestion = (baseQ) => {
                const exists = (q) => uniqueQaData.some(i => i.question === q) || getNewItems().some(i => i.question === q);
                let i = 1; let candidate = `${baseQ} (копия)`;
                while (exists(candidate)) { candidate = `${baseQ} (копия ${i++})`; }
                return candidate;
            };

            kebabBtn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                document.querySelectorAll('.popup-menu').forEach(m => m.remove());
                const menu = document.createElement('div');
                menu.className = 'popup-menu';
                menu.style.position = 'absolute';
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
                                } catch (_) {}

                                // Убедимся, что панель корзины видна в режиме редактирования
                                const tp = document.querySelector('.trash-panel');
                                if (tp && editMode) { tp.style.display = 'block'; }

                                // Перерисовываем панель корзины и текущий контекст
                                renderTrashPanel();
                                refreshCurrentContext();

                                // Пытаемся синхронизировать с серверной корзиной (не блокирует UI)
                                try { await refreshServerTrash(); } catch (_) {}

                                setInlineSaveStatus(rowEl, 'success');
                                setSaveStatus('success', 'Карточка перемещена в корзину');

                                // Сохраняем объединённые данные на сервер
                                saveMergedToServer().then(saveOk => {
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
                        
                        const newItems = getNewItems();
                        const copyQ = genUniqueQuestion(item.question);
                        const duplicatedItem = { ...item, question: copyQ };
                        
                        // Track duplication on server first
                        trackServerDuplication(item.question, copyQ).then(trackOk => {
                            if (trackOk) {
                                // Then update local state
                                newItems.push(duplicatedItem);
                                setLS('qaNewItems', newItems);
                                
                        // Update UI, сохраняя текущую категорию
                        const activeTab = tabsContainer.querySelector('.tab.active');
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
                                
                                // Save to server
                                saveMergedToServer().then(saveOk => {
                                    if (!saveOk) {
                                        setInlineSaveStatus(rowEl, 'error', 'Ошибка сохранения');
                                    }
                                });
                            } else {
                                setInlineSaveStatus(rowEl, 'error', 'Ошибка дублирования');
                            }
                        });
                    } else if (act === 'edit') {
                        const categoriesData = buildCategoriesFromData(getRuntimeData());
                        const categoryOptions = categoriesData.map(cat => `<option value="${cat.name}" ${item.category === cat.name ? 'selected' : ''}>${cat.name}</option>`).join('');
                        const selectedCategory = categoriesData.find(cat => cat.name === item.category);
                        const subcategoryOptions = selectedCategory ? selectedCategory.subcategories.map(sub => `<option value="${sub.name}" ${item.subcategory === sub.name ? 'selected' : ''}>${sub.name}</option>`).join('') : '';
                        resultItem.innerHTML = `
                            <div class="question-row">
                                <label>Категория: <select class="edit-category">${categoryOptions}</select></label>
                                <label>Подкатегория: <select class="edit-subcategory">${subcategoryOptions}</select></label>
                                <button class="save-inline" title="Сохранить">✓</button>
                            </div>
                            <div><label>Вопрос:<br><textarea class="edit-question" style="width:100%">${item.question}</textarea></label></div>
                            <div><label>Ответ:<br><textarea class="edit-answer" style="width:100%">${item.answer}</textarea></label></div>
                        `;
                        const editCategory = resultItem.querySelector('.edit-category');
                        const editSubcategory = resultItem.querySelector('.edit-subcategory');
                        const editQuestion = resultItem.querySelector('.edit-question');
                        const editAnswer = resultItem.querySelector('.edit-answer');
                        // Каретка по умолчанию в конце текста и возможность свободно позиционировать
                        setTimeout(() => {
                            editQuestion.focus();
                            const qLen = editQuestion.value.length;
                            editQuestion.setSelectionRange(qLen, qLen);
                        }, 0);
                        editCategory.addEventListener('change', () => {
                            const newCategory = editCategory.value;
                            const newSubs = (categoriesData.find(cat => cat.name === newCategory)?.subcategories || []).map(sub => `<option value="${sub.name}">${sub.name}</option>`).join('');
                            editSubcategory.innerHTML = newSubs;
                        });
                        resultItem.querySelector('.save-inline').addEventListener('click', async () => {
                            const newCategory = editCategory.value;
                            const newSubcategory = editSubcategory.value;
                            const newQuestion = editQuestion.value.trim();
                            const newAnswer = editAnswer.value.trim();
                            if (!newQuestion || !newAnswer) { alert('Вопрос и ответ не могут быть пустыми'); return; }
                            const overrides = getOverrides();
                            // Сохраняем override по исходному ключу вопроса
                            overrides[item.question] = { category: newCategory, subcategory: newSubcategory, question: newQuestion, answer: newAnswer };
                            setOverrides(overrides);
                            displayQuestions(currentQuestions.map(q => q.question === item.question ? { ...q, category: newCategory, subcategory: newSubcategory, question: newQuestion, answer: newAnswer } : q), title);
                            const rowEl = resultItem.querySelector('.question-row');
                            setInlineSaveStatus(rowEl, 'saving');
                            const ok = await saveMergedToServer();
                            setInlineSaveStatus(rowEl, ok ? 'success' : 'error');
                        });
                    }
                    menu.remove();
                });
            });
        }

        resultsList.appendChild(resultItem);
    });
}

