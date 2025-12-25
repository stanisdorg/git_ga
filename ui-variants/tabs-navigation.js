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
const BACKEND_URL = (typeof localStorage !== 'undefined' && localStorage.getItem('qaBackendUrl')) || 'http://localhost:8081';

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
    return !!(email && password);
}
function ensureLoginState() {
    const raw = localStorage.getItem('qaSessionUser');
    try { loggedInUser = raw ? JSON.parse(raw) : null; } catch { loggedInUser = null; }
}
ensureLoginState();

// Функция для инициализации навигации с табами
// Глобальный индикатор сохранения (элемент верхней панели)
let globalSaveStatusEl = null;

export function initTabsNavigation() {
    const container = document.querySelector('.container');
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

    // Панель действий внутри табов (справа): Вход и Редактирование
    const tabsActions = document.createElement('div');
    tabsActions.className = 'tabs-actions';
    
    const editToggleBtn = document.createElement('button');
    editToggleBtn.title = 'Режим редактирования';
    editToggleBtn.textContent = '✎';
    // Стили перенесены в CSS (.tabs-actions button)

    const loginMainBtn = document.createElement('button');
    // Иконка человечка (черно-белая)
    const userIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
    loginMainBtn.innerHTML = userIconSvg;
    loginMainBtn.title = loggedInUser ? 'Выйти из личного кабинета' : 'Войти в личный кабинет';
    // Стили перенесены в CSS (.tabs-actions button)
    
    tabsActions.appendChild(loginMainBtn);
    tabsActions.appendChild(editToggleBtn);
    
    tabsHeader.appendChild(tabsActions);

    // Logic to update icon/tooltip on login change
    function updateLoginBtnState() {
        loginMainBtn.title = loggedInUser ? 'Выйти из личного кабинета' : 'Войти в личный кабинет';
        // Цвет иконки меняется через CSS (класс active или просто color)
        // Но здесь мы можем оставить базовую логику title
    }
    updateLoginBtnState();

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
    container.insertBefore(navigationContainer, searchContainer);

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

    // Логика кнопок Вход и ✎ (верхняя панель)
    loginMainBtn.addEventListener('click', () => {
        ensureLoginState();
        if (loggedInUser) {
            if (confirm('Выйти из аккаунта?')) {
                localStorage.removeItem('qaSessionUser'); loggedInUser = null; loginMainBtn.textContent = 'Вход';
            }
            return;
        }
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed'; overlay.style.inset = '0'; overlay.style.background = 'rgba(0,0,0,0.4)';
        overlay.style.display = 'flex'; overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center';
        const modal = document.createElement('div'); modal.style.background = '#fff'; modal.style.padding = '16px'; modal.style.borderRadius = '8px'; modal.style.minWidth = '280px';
        modal.innerHTML = `
            <h3>Вход</h3>
            <label>Email:<br><input type="email" id="login-email" style="width:100%"></label>
            <label>Пароль:<br><input type="password" id="login-pass" style="width:100%"></label>
            <div style="margin-top:12px; display:flex; gap:8px; justify-content:flex-end;">
                <button id="login-cancel">Отмена</button>
                <button id="login-ok">Войти</button>
            </div>
        `;
        overlay.appendChild(modal); document.body.appendChild(overlay);
        modal.querySelector('#login-cancel').addEventListener('click', () => overlay.remove());
        modal.querySelector('#login-ok').addEventListener('click', () => {
            const email = modal.querySelector('#login-email').value.trim();
            const pass = modal.querySelector('#login-pass').value.trim();
            if (verifyCredentialsWithSupabase(email, pass)) { localStorage.setItem('qaSessionUser', JSON.stringify({ email })); loggedInUser = { email }; loginMainBtn.textContent = 'Выход'; overlay.remove(); }
            else { alert('Неверные учетные данные'); }
        });
    });

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

    // Обработчики панели управления
    editBtnTop.addEventListener('click', () => {
        editMode = true;
        saveBtnTop.disabled = false;
        cancelBtnTop.disabled = false;
        editBtnTop.disabled = true;
        // Перерисовываем, чтобы добавить draggable
        refreshCategoriesTabs();
        refreshCurrentContext();
    });

    cancelBtnTop.addEventListener('click', () => {
        editMode = false;
        saveBtnTop.disabled = true;
        cancelBtnTop.disabled = true;
        editBtnTop.disabled = false;
        // Снимаем draggable с вкладок категорий
        refreshCategoriesTabs();
        const activeTab = tabsContainer.querySelector('.tab.active');
        if (activeTab) {
            if (activeTab.dataset.category === 'all') showAllQuestions();
            else if (activeTab.dataset.category === 'favorites') showFavorites();
            else {
                const selectedCategory = categories.find(cat => cat.id == activeTab.dataset.category);
                filterQuestionsByCategory(selectedCategory.name);
            }
        }
    });

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
            const resp = await fetch('http://localhost:8081/duplicate', {
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


    // Кнопка сохранения (если понадобится) вызывает общий автосейв
    saveBtnTop.addEventListener('click', () => { saveMergedToServer(); });

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

    addCatBtnTop.addEventListener('click', addCategoryPlaceholderFlow);
    delCatBtnTop.addEventListener('click', deleteCategoryFlow);
    addSubBtnTop.addEventListener('click', addSubcategoryFlow);
    delSubBtnTop.addEventListener('click', deleteSubcategoryFlow);

    loginBtnTop.addEventListener('click', () => {
        ensureLoginState();
        if (loggedInUser) {
            if (confirm('Выйти из аккаунта?')) {
                localStorage.removeItem('qaSessionUser');
                loggedInUser = null;
                loginBtnTop.textContent = 'Вход';
            }
            return;
        }
        // Простой попап логина
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.background = 'rgba(0,0,0,0.4)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';

        const modal = document.createElement('div');
        modal.style.background = '#fff';
        modal.style.padding = '16px';
        modal.style.borderRadius = '8px';
        modal.style.minWidth = '280px';
        modal.innerHTML = `
            <h3>Вход</h3>
            <label>Email:<br><input type="email" id="login-email" style="width:100%"></label>
            <label>Пароль:<br><input type="password" id="login-pass" style="width:100%"></label>
            <div style="margin-top:12px; display:flex; gap:8px; justify-content:flex-end;">
                <button id="login-cancel">Отмена</button>
                <button id="login-ok">Войти</button>
            </div>
        `;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        modal.querySelector('#login-cancel').addEventListener('click', () => {
            overlay.remove();
        });
        modal.querySelector('#login-ok').addEventListener('click', () => {
            const email = modal.querySelector('#login-email').value.trim();
            const pass = modal.querySelector('#login-pass').value.trim();
            if (verifyCredentialsWithSupabase(email, pass)) {
                localStorage.setItem('qaSessionUser', JSON.stringify({ email }));
                loggedInUser = { email };
                loginBtnTop.textContent = 'Выход';
                overlay.remove();
            } else {
                alert('Неверные учетные данные');
            }
        });
    });
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

        resultItem.innerHTML = `
            <div class="question-row">
                <span class="category-badge">${dispCat}</span>
                <span class="subcategory-badge">${dispSub}</span>
                <button class="fav-btn ${favClass}" title="В избранное">★</button>
            </div>
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
            } else {
                current.add(item.question);
                favBtn.classList.add('fav-active');
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
// Агрегатор данных на лету: применяет overrides, добавляет новые элементы и исключает удалённые
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
