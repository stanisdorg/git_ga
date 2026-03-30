// Р’Р°СЂРёР°РЅС‚ 3: РўР°Р±С‹ РґР»СЏ РєР°С‚РµРіРѕСЂРёР№ Рё РєР°СЂС‚РѕС‡РєРё РґР»СЏ РїРѕРґРєР°С‚РµРіРѕСЂРёР№
console.log('[TABS-NAVIGATION] Module loaded');

// РРјРїРѕСЂС‚РёСЂСѓРµРј РґР°РЅРЅС‹Рµ Рё РіРµРЅРµСЂР°С‚РѕСЂ РєР°С‚РµРіРѕСЂРёР№
import { uniqueQaData } from '../all-data.js';
import { buildCategoriesFromData } from '../computed-categories.js';
import { setNormalizationDisabled } from '../load-json-data.js';
import { getProgressMap } from '../srs/stats-utils.js';
import { getDifficultyLevel, getLevelProgress } from '../srs/algorithm.js';
import { applyFormatting, createEmptyFormatting, convertHtmlToTextAndFormatting, renderFormattingInEditor } from '../srs/text-formatter.js';
import { createFormatToolbar, initFormatToolbar } from '../srs/format-toolbar.js';

console.log('[TABS-NAVIGATION] Imports completed');

// Р“Р»РѕР±Р°Р»СЊРЅС‹Рµ С„Р»Р°РіРё/СЃРѕСЃС‚РѕСЏРЅРёСЏ РґР»СЏ СЂРµР¶РёРјР° СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ Рё Р»РѕРіРёРЅР°
let editMode = (typeof localStorage !== 'undefined' && localStorage.getItem('qaEditMode') === 'true') ? true : false;
let currentContextKey = 'all';
let currentQuestions = [];
let sortMode = 'default'; // Global sort state
let resultsListRef = null;
// РљСЌС€ РєРѕСЂР·РёРЅС‹ РЅР° СЃС‚РѕСЂРѕРЅРµ СЃРµСЂРІРµСЂР° (РЅРµ РёСЃРїРѕР»СЊР·СѓРµРј localStorage РґР»СЏ СѓРґР°Р»С‘РЅРЅС‹С… РєР°СЂС‚РѕС‡РµРє)
let serverTrashSet = new Set();
let serverTrashItems = [];
// РљРѕРЅС„РёРіСѓСЂРёСЂСѓРµРјС‹Р№ URL Р±СЌРєРµРЅРґР° (РјРѕР¶РЅРѕ Р·Р°РґР°С‚СЊ С‡РµСЂРµР· localStorage РєР»СЋС‡ 'qaBackendUrl')
// РџРѕ СѓРјРѕР»С‡Р°РЅРёСЋ РёСЃРїРѕР»СЊР·СѓРµРј РїРѕСЂС‚ 8765, С‚Р°Рє РєР°Рє Р»РѕРєР°Р»СЊРЅС‹Р№ СЃРµСЂРІРµСЂ Р·Р°РїСѓС‰РµРЅ С‚Р°Рј
const BACKEND_URL = (typeof localStorage !== 'undefined' && localStorage.getItem('qaBackendUrl')) || window.location.origin;

// рџ”’ HELPER: User-specific localStorage keys (РРЎРџР РђР’Р›Р•РќРР•: Сѓ РєР°Р¶РґРѕРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ СЃРІРѕР№ РєР»СЋС‡)
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

// Р›РѕРєР°Р»СЊРЅС‹Рµ С…РµР»РїРµСЂС‹ РґР»СЏ storage
function getLS(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || fallback); } catch { return JSON.parse(fallback); }
}
function setLS(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function getOrderForContext(ctx) { const o = getLS('qaOrderOverrides', '{}'); return o[ctx] || null; }
function setOrderForContext(ctx, orderArr) { const o = getLS('qaOrderOverrides', '{}'); o[ctx] = orderArr; setLS('qaOrderOverrides', o); }
function getOverrides() { return getLS('qaAdminOverrides', '{}'); }
// РЈСЃС‚Р°РЅР°РІР»РёРІР°РµРј overrides РІ localStorage (РґР»СЏ СЃРѕС…СЂР°РЅРµРЅРёСЏ РёР·РјРµРЅРµРЅРёР№ РєР°СЂС‚РѕС‡РµРє)
function setOverrides(map) { setLS('qaAdminOverrides', map); }
function getNewItems() { return getLS('qaNewItems', '[]'); }
function getDeletedItems() { return getLS('qaDeletedItems', '{}'); }
function setDeletedItems(map) { setLS('qaDeletedItems', map); }

// РџРѕР»СѓС‡РµРЅРёРµ Р°РєС‚СѓР°Р»СЊРЅС‹С… РґР°РЅРЅС‹С… СЃ СѓС‡РµС‚РѕРј СѓРґР°Р»РµРЅРЅС‹С…
function getRuntimeData() {
    // РЎРЅР°С‡Р°Р»Р° РїСЂРѕР±СѓРµРј Р·Р°РіСЂСѓР·РёС‚СЊ РґР°РЅРЅС‹Рµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РёР· localStorage
    let baseData = uniqueQaData;
    try {
        const userCards = getQaUserCards();
        if (userCards && Array.isArray(userCards) && userCards.length > 0) {
            baseData = userCards;
        }
    } catch (e) {
        console.warn('[getRuntimeData] РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё userCards:', e);
    }

    const base = baseData.map(item => ({ ...item }));
    const overrides = getOverrides();
    const newItems = getNewItems();
    const deleted = getDeletedItems();
    // РџСЂРёРјРµРЅСЏРµРј overrides (РєР°С‚РµРіРѕСЂРёСЏ/РїРѕРґРєР°С‚РµРіРѕСЂРёСЏ/РІРѕРїСЂРѕСЃ/РѕС‚РІРµС‚/С„РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµ)
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
            if (ov.formatting) updated.formatting = ov.formatting;  // рџ”Ґ РџСЂРёРјРµРЅСЏРµРј С„РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµ
            // Р•СЃР»Рё РёР·РјРµРЅРёР»РѕСЃСЊ РєР»СЋС‡РµРІРѕРµ РїРѕР»Рµ РІРѕРїСЂРѕСЃР° вЂ” РѕР±РЅРѕРІР»СЏРµРј РєР»СЋС‡ РІ Map
            if (ov.question && ov.question !== origQ) {
                byQuestion.delete(origQ);
                byQuestion.set(updated.question, updated);
            } else {
                byQuestion.set(origQ, updated);
            }
        } else {
            // Р•СЃР»Рё РёСЃС…РѕРґРЅРѕРіРѕ РІРѕРїСЂРѕСЃР° РЅРµС‚ РІ Р±Р°Р·Рµ, СЂР°СЃСЃРјР°С‚СЂРёРІР°РµРј РєР°Рє РЅРѕРІС‹Р№ СЌР»РµРјРµРЅС‚
            byQuestion.set(ov.question || origQ, {
                question: ov.question || origQ,
                answer: ov.answer || '',
                category: ov.category || 'Р‘РµР· РєР°С‚РµРіРѕСЂРёРё',
                subcategory: ov.subcategory || 'РћР±С‰РµРµ',
                formatting: ov.formatting || createEmptyFormatting()  // рџ”Ґ Р¤РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµ РґР»СЏ РЅРѕРІС‹С… РєР°СЂС‚РѕС‡РµРє
            });
        }
    });
    // Р”РѕР±Р°РІР»СЏРµРј РЅРѕРІС‹Рµ СЌР»РµРјРµРЅС‚С‹
    newItems.forEach(ni => {
        if (!byQuestion.has(ni.question)) byQuestion.set(ni.question, { ...ni });
    });
    // РСЃРєР»СЋС‡Р°РµРј СѓРґР°Р»С‘РЅРЅС‹Рµ
    const merged = Array.from(byQuestion.values()).filter(i => !deleted[i.question] && !serverTrashSet.has(i.question));
    return merged;
}

// рџ”Ґ Р¤СѓРЅРєС†РёСЏ РёСЃРїСЂР°РІР»РµРЅРёСЏ РєРѕРґРёСЂРѕРІРєРё РІ РєР°СЂС‚РѕС‡РєР°С…
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

        // рџ”§ РСЃРїСЂР°РІР»СЏРµРј РёСЃРєР°Р¶С‘РЅРЅСѓСЋ РєРѕРґРёСЂРѕРІРєСѓ РІ category
        if (card.category === 'Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ' || card.category === 'Р”РєСѓРјРµРЅС‚Р°С†РёСЏ' || card.category === 'Р”РєСѓРјРµРЅС‚Р°С†РёСЏ') {
            card.category = 'Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ';
            changed = true;
        }

        // рџ”§ РСЃРїСЂР°РІР»СЏРµРј РёСЃРєР°Р¶С‘РЅРЅСѓСЋ РєРѕРґРёСЂРѕРІРєСѓ РІ subcategory
        if (card.subcategory === 'РўРёРїС‹ С‚СЂРµР±РѕРІР°РЅРёР№' || card.subcategory === 'РўРёРїС‹ С‚СЂРµРѕРІР°РЅРёР№' || card.subcategory === 'РўРёРїС‹ С‚СЂРµРѕРІР°РЅРёР№') {
            card.subcategory = 'РўРёРїС‹ С‚СЂРµР±РѕРІР°РЅРёР№';
            changed = true;
        }

        return card;
    });

    if (changed) {
        // РџРѕРґСЃС‡РёС‚С‹РІР°РµРј СЃРєРѕР»СЊРєРѕ РєР°СЂС‚РѕС‡РµРє Р±С‹Р»Рѕ РёСЃРїСЂР°РІР»РµРЅРѕ
        const fixedCount = userCards.filter((c, i) =>
            c.category !== fixedCards[i].category || c.subcategory !== fixedCards[i].subcategory
        ).length;

        setQaUserCards(fixedCards);
        // рџ”Ґ РќР• РѕС‚РїСЂР°РІР»СЏРµРј РЅР° СЃРµСЂРІРµСЂ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё вЂ” РёСЃРїСЂР°РІР»РµРЅРёСЏ СЃРѕС…СЂР°РЅСЏС‚СЃСЏ РїСЂРё СЃР»РµРґСѓСЋС‰РµРј СЏРІРЅРѕРј СЃРѕС…СЂР°РЅРµРЅРёРё
        console.log('[fixEncodingIssues] РСЃРїСЂР°РІР»РµРЅРѕ РєР°СЂС‚РѕС‡РµРє:', fixedCount, '(СЃРѕС…СЂР°РЅСЏС‚СЃСЏ РїСЂРё СЃР»РµРґСѓСЋС‰РµРј СЃРѕС…СЂР°РЅРµРЅРёРё)');
    }
}

function getCategoryPlaceholders() { return getLS('qaCategoryPlaceholders', '{}'); }
function setCategoryPlaceholders(obj) { setLS('qaCategoryPlaceholders', obj); }
// РџРѕСЂСЏРґРѕРє РєР°С‚РµРіРѕСЂРёР№: С…СЂР°РЅРёС‚СЃСЏ РєР°Рє РјР°СЃСЃРёРІ РёРјС‘РЅ РєР°С‚РµРіРѕСЂРёР№
function getCategoryOrder() { return getLS('qaCategoryOrder', '[]'); }
function setCategoryOrder(arr) { setLS('qaCategoryOrder', Array.isArray(arr) ? arr : []); }
// РџРѕСЂСЏРґРѕРє РїРѕРґРєР°С‚РµРіРѕСЂРёР№ РїРѕ РєР°С‚РµРіРѕСЂРёСЏРј
function getSubcategoryOrderMap() { return getLS('qaSubcategoryOrder', '{}'); }
function setSubcategoryOrderMap(map) { setLS('qaSubcategoryOrder', map); }
function getSubcategoryOrderFor(categoryName) { const m = getSubcategoryOrderMap(); return m[categoryName] || []; }
function setSubcategoryOrderFor(categoryName, arr) { const m = getSubcategoryOrderMap(); m[categoryName] = Array.isArray(arr) ? arr : []; setSubcategoryOrderMap(m); }

// РРЅРґРёРєР°С‚РѕСЂ РёРЅР»Р°Р№РЅ-СЃРѕС…СЂР°РЅРµРЅРёСЏ РЅР° СЃС‚СЂРѕРєРµ РєР°СЂС‚РѕС‡РєРё
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
    const texts = { saving: 'РЎРѕС…СЂР°РЅРµРЅРёРµвЂ¦', success: 'РЎРѕС…СЂР°РЅРµРЅРѕ', error: 'РћС€РёР±РєР°' };
    badge.textContent = message || texts[status] || '';
    badge.style.background = colors[status] || '#444';
    badge.style.color = '#eee';
    badge.style.border = '1px solid #333';
    if (status !== 'saving') {
        setTimeout(() => { if (badge && badge.parentNode === rowEl) badge.remove(); }, 1500);
    }
}

// Р“РµРЅРµСЂР°С‚РѕСЂ СѓРЅРёРєР°Р»СЊРЅРѕРіРѕ С‚РµРєСЃС‚Р° РІРѕРїСЂРѕСЃР° РґР»СЏ РєРѕРїРёР№
function genUniqueQuestionGlobal(baseQ) {
    // РћС‡РёС‰Р°РµРј Р±Р°Р·РѕРІС‹Р№ РІРѕРїСЂРѕСЃ РѕС‚ СЃСѓС„С„РёРєСЃРѕРІ РєРѕРїРёР№
    const cleanBase = baseQ.replace(/ \(РєРѕРїРёСЏ( \d+)?\)$/, '');

    const exists = (q) => {
        // РџСЂРѕРІРµСЂСЏРµРј РІ uniqueQaData
        if (uniqueQaData.some(i => i.question === q)) return true;
        // РџСЂРѕРІРµСЂСЏРµРј РІ newItems
        if (getNewItems().some(i => i.question === q)) return true;
        // РџСЂРѕРІРµСЂСЏРµРј РІ qaUserCards
        try {
            const userCardsRaw = localStorage.getItem('qaUserCards');
            if (userCardsRaw) {
                const userCards = JSON.parse(userCardsRaw);
                if (Array.isArray(userCards) && userCards.some(i => i.question === q)) return true;
            }
        } catch (e) { }
        return false;
    };

    // РС‰РµРј РІСЃРµ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ РєРѕРїРёРё
    let i = 1;
    let candidate = `${cleanBase} (РєРѕРїРёСЏ)`;
    while (exists(candidate)) {
        i++;
        candidate = `${cleanBase} (РєРѕРїРёСЏ ${i})`;
    }
    return candidate;
}
// РџР»РµР№СЃС…РѕР»РґРµСЂС‹ РґР»СЏ РѕС‚РѕР±СЂР°Р¶Р°РµРјС‹С… РЅР°Р·РІР°РЅРёР№ РїРѕРґРєР°С‚РµРіРѕСЂРёР№ (РїРѕ РєР°С‚РµРіРѕСЂРёСЏРј)
function getSubcategoryPlaceholders() { return getLS('qaSubcategoryPlaceholders', '{}'); }
function setSubcategoryPlaceholders(obj) { setLS('qaSubcategoryPlaceholders', obj); }

// Global helper function for authenticated fetch requests (NO TOKEN - username/password only)
async function fetchWithAuth(url, options = {}) {
    const user = loggedInUser;

    // Р”РѕР±Р°РІР»СЏРµРј username РІ query РїР°СЂР°РјРµС‚СЂС‹
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
    // РџСЂРѕРІРµСЂСЏРµРј, РµСЃС‚СЊ Р»Рё Р°РєС‚РёРІРЅР°СЏ СЃРµСЃСЃРёСЏ
    const sessionUserRaw = localStorage.getItem('qaSessionUser');
    if (!sessionUserRaw) {
        return;
    }

    let username = null;
    try {
        const u = JSON.parse(sessionUserRaw);
        if (u && u.username) username = u.username;
    } catch (e) {
        console.error('[AutoLoad] РћС€РёР±РєР° РїР°СЂСЃРёРЅРіР° qaSessionUser:', e);
        return;
    }

    if (!username) {
        return;
    }

    // Р—Р°РіСЂСѓР¶Р°РµРј РґР°РЅРЅС‹Рµ С‡РµСЂРµР· srs/storage.js
    // рџ”Ґ forceReload=true РґР»СЏ РіР°СЂР°РЅС‚РёСЂРѕРІР°РЅРЅРѕР№ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё РјРµР¶РґСѓ СѓСЃС‚СЂРѕР№СЃС‚РІР°РјРё
    try {
        const { loadFromServer } = await import('../srs/storage.js?v=6.20.8');
        await loadFromServer(true);
    } catch (e) {
        console.error('[AutoLoad] РћС€РёР±РєР° Р°РІС‚РѕР·Р°РіСЂСѓР·РєРё:', e);
    }
}

// РџСЂРѕСЃС‚РµР№С€Р°СЏ Р·Р°РіР»СѓС€РєР° Р»РѕРіРёРЅР° вЂ” Р·Р°РјРµРЅРёС‚Рµ verifyCredentialsWithSupabase РЅР° СЂРµР°Р»СЊРЅСѓСЋ РїСЂРѕРІРµСЂРєСѓ
let loggedInUser = null;
function verifyCredentialsWithSupabase(email, password) {
    // TODO: Р·РґРµСЃСЊ РїРѕРґРєР»СЋС‡РµРЅРёРµ Рє Supabase (REST/JS SDK) Рё РїСЂРѕРІРµСЂРєР° С…РµС€Р° РїР°СЂРѕР»СЏ
    // РџРѕРєР° РґРѕРїСѓСЃРєР°РµРј Р»СЋР±РѕР№ РЅРµРїСѓСЃС‚РѕР№ Р»РѕРіРёРЅ
    return true;
}

// Р¤СѓРЅРєС†РёСЏ РґР»СЏ РёРЅРёС†РёР°Р»РёР·Р°С†РёРё РЅР°РІРёРіР°С†РёРё СЃ С‚Р°Р±Р°РјРё
// Р“Р»РѕР±Р°Р»СЊРЅС‹Р№ РёРЅРґРёРєР°С‚РѕСЂ СЃРѕС…СЂР°РЅРµРЅРёСЏ (СЌР»РµРјРµРЅС‚ РІРµСЂС…РЅРµР№ РїР°РЅРµР»Рё)
let globalSaveStatusEl = null;

// ========== Р¤СѓРЅРєС†РёРё СѓРїСЂР°РІР»РµРЅРёСЏ Р°РЅРёРјР°С†РёРµР№ Р·Р°РіСЂСѓР·РєРё ==========
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
    // РџСЂРѕРІРµСЂСЏРµРј, РЅРµ РѕС‚РєСЂС‹С‚Р° Р»Рё СЃС‚СЂР°РЅРёС†Р° СЃС‚Р°С‚РёСЃС‚РёРєРё
    const isStatsPage = location.hash === '#/stats';
    console.log('[initTabsNavigation] Called! isStatsPage:', isStatsPage, 'location.hash:', location.hash);

    // РџРѕРєР°Р·С‹РІР°РµРј Р°РЅРёРјР°С†РёСЋ Р·Р°РіСЂСѓР·РєРё РїСЂРё СЃС‚Р°СЂС‚Рµ
    showLoading();

    try {
        const container = document.querySelector('.container');
        // Р“Р°СЂР°РЅС‚РёСЂСѓРµРј РІРёРґРёРјРѕСЃС‚СЊ РєРѕРЅС‚РµР№РЅРµСЂРѕРІ (РЅР° СЃР»СѓС‡Р°Р№ РµСЃР»Рё РѕРЅРё Р±С‹Р»Рё СЃРєСЂС‹С‚С‹ СЃС‚СЂР°РЅРёС†РµР№ СЃС‚Р°С‚РёСЃС‚РёРєРё)
        // РќРћ РќР• РґР»СЏ СЃС‚СЂР°РЅРёС†С‹ СЃС‚Р°С‚РёСЃС‚РёРєРё!
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
        // РЎРљР Р«Р’РђР•Рњ СЃС‚СЂРѕРєСѓ РїРѕРёСЃРєР° РґР»СЏ СЃС‚СЂР°РЅРёС†С‹ СЃС‚Р°С‚РёСЃС‚РёРєРё!
        if (searchContainer) {
            // Р”Р»СЏ СЃС‚Р°С‚РёСЃС‚РёРєРё РѕСЃС‚Р°РІР»СЏРµРј display:none, РґР»СЏ РѕСЃС‚Р°Р»СЊРЅС‹С… СЃС‚СЂР°РЅРёС† РїРѕРєР°Р·С‹РІР°РµРј
            if (!isStatsPage) {
                searchContainer.style.display = '';
                console.log('[initTabsNavigation] search-container display reset');
            } else {
                searchContainer.style.display = 'none';
                console.log('[initTabsNavigation] search-container hidden (stats page)');
            }
        }
        // РЈРґР°Р»СЏРµРј СЃС‚Р°СЂСѓСЋ Р°РґРјРёРЅ-РїР°РЅРµР»СЊ РёР· DOM (РЅРѕРІР°СЏ Р»РѕРіРёРєР° СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ СЃРІРµСЂС…Сѓ)
        const legacyAdminPanel = document.querySelector('.admin-panel');
        if (legacyAdminPanel) legacyAdminPanel.remove();

        // РЎРѕР·РґР°РµРј РєРѕРЅС‚РµР№РЅРµСЂ РґР»СЏ РЅР°РІРёРіР°С†РёРё
        const navigationContainer = document.createElement('div');
        navigationContainer.className = 'tabs-navigation';

        // РљРѕРЅС‚РµР№РЅРµСЂ РґР»СЏ РІРµСЂС…РЅРёС… РґРµР№СЃС‚РІРёР№ (СЃС‚Р°С‚РёСЃС‚РёРєР°, Р°РґРјРёРЅРєР°)
        const topActions = document.createElement('div');
        topActions.className = 'top-actions-bar';
        // РЎРљР Р«Р’РђР•Рњ top-actions-bar РґР»СЏ СЃС‚СЂР°РЅРёС†С‹ СЃС‚Р°С‚РёСЃС‚РёРєРё!
        topActions.style.display = isStatsPage ? 'none' : 'flex';
        topActions.style.alignItems = 'center';
        topActions.style.justifyContent = 'flex-start';
        topActions.style.padding = '4px 0';

        // РЎРѕР·РґР°С‘Рј MutationObserver РґР»СЏ РѕС‚СЃР»РµР¶РёРІР°РЅРёСЏ РёР·РјРµРЅРµРЅРёР№ display
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

        // Р’РµСЂСЃРёСЏ РїСЂРёР»РѕР¶РµРЅРёСЏ
        const verEl = document.createElement('div');
        verEl.textContent = `v${appVersion}`;
        verEl.className = 'app-version-display';
        verEl.style.fontSize = '11px';
        verEl.style.color = '#555';
        verEl.style.fontWeight = 'bold';
        verEl.style.marginLeft = '10px';

        // РљРѕРЅС‚РµР№РЅРµСЂ РґР»СЏ РїСЂР°РІРѕР№ С‡Р°СЃС‚Рё (РЈСЂРѕРІРµРЅСЊ + РЎС‚СЂРёРє)
        const levelContainer = document.createElement('div');
        levelContainer.className = 'level-container-right';
        levelContainer.style.marginLeft = 'auto';
        levelContainer.style.display = 'flex';
        levelContainer.style.alignItems = 'center';

        // РџРѕРєР°Р·С‹РІР°РµРј РІСЃРµ РІРѕРїСЂРѕСЃС‹ РїСЂРё РёРЅРёС†РёР°Р»РёР·Р°С†РёРё
        showAllQuestions();

        // РђРІС‚РѕРјР°С‚РёС‡РµСЃРєР°СЏ Р·Р°РіСЂСѓР·РєР° СЃ СѓС‡С‘С‚РѕРј С‚РµРєСѓС‰РµРіРѕ РєРѕРЅС‚РµРєСЃС‚Р°
        // РћР±РЅРѕРІР»СЏРµРј РєРѕРЅС‚РµРєСЃС‚ С‡РµСЂРµР· 100РјСЃ (РїРѕСЃР»Рµ Р·Р°РіСЂСѓР·РєРё РґР°РЅРЅС‹С… РёР· all-data.js)
        setTimeout(() => {
            refreshCurrentContext();

            // Р›РѕРіРёСЂРѕРІР°РЅРёРµ СЂР°Р·РјРµСЂРѕРІ РґР»СЏ РѕС‚Р»Р°РґРєРё
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

        // РЎР»СѓС€Р°РµРј РѕР±РЅРѕРІР»РµРЅРёРµ РёР·Р±СЂР°РЅРЅРѕРіРѕ РёР· РѕР±Р»Р°РєР°
        window.addEventListener('favoritesUpdated', () => {
            refreshCurrentContext();
        });

        // РЎР»СѓС€Р°РµРј dataLoaded РѕС‚ all-data.js РґР»СЏ РѕР±РЅРѕРІР»РµРЅРёСЏ РїРѕСЃР»Рµ Р·Р°РіСЂСѓР·РєРё РґР°РЅРЅС‹С…
        document.addEventListener('dataLoaded', (e) => {
            const data = e.detail?.data;

            // РЎРєСЂС‹РІР°РµРј Р°РЅРёРјР°С†РёСЋ Р·Р°РіСЂСѓР·РєРё
            hideLoading();

            if (data && data.length > 0) {
                // РџРµСЂРµСЃС‚СЂР°РёРІР°РµРј С‚Р°Р±С‹ РєР°С‚РµРіРѕСЂРёР№ СЃ РЅРѕРІС‹РјРё РґР°РЅРЅС‹РјРё
                refreshCategoriesTabs();
                // РћР±РЅРѕРІР»СЏРµРј С‚РµРєСѓС‰РёР№ РєРѕРЅС‚РµРєСЃС‚
                refreshCurrentContext();
            }
        });

        // рџ”Ґ РРЎРџР РђР’Р›Р•РќРР• РљРћР”РР РћР’РљР: РџРѕСЃР»Рµ Р·Р°РіСЂСѓР·РєРё РґР°РЅРЅС‹С… СЃ СЃРµСЂРІРµСЂР°
        // Р’С‹Р·С‹РІР°РµРј РїРѕСЃР»Рµ loadFromServer, РєРѕРіРґР° РґР°РЅРЅС‹Рµ СѓР¶Рµ РІ localStorage
        window.addEventListener('qaDataLoadedFromServer', () => {
            fixEncodingIssues();
            refreshCategoriesTabs();
            refreshCurrentContext();
        });

        // РЎС‚СЂРѕРёРј РєР°С‚РµРіРѕСЂРёРё РїРѕ РґР°РЅРЅС‹Рј (СЃ СѓС‡С‘С‚РѕРј Р»РѕРєР°Р»СЊРЅС‹С… РїСЂР°РІРѕРє/РЅРѕРІС‹С… СЌР»РµРјРµРЅС‚РѕРІ/СѓРґР°Р»РµРЅРёР№)
        let categories = buildCategoriesFromData(getRuntimeData());

        // РЎРѕР·РґР°РµРј РєРѕРЅС‚РµР№РЅРµСЂ РґР»СЏ С‚Р°Р±РѕРІ
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'tabs-container';
        console.log('[TABS-NAVIGATION] tabsContainer created:', tabsContainer);
        console.log('[TABS-NAVIGATION] tabs-container parent will be:', document.querySelector('.tabs-header'));

        // РЎРѕР·РґР°РµРј С‚Р°Р± "Р’СЃРµ РІРѕРїСЂРѕСЃС‹"
        const allTab = document.createElement('div');
        allTab.className = 'tab';
        allTab.dataset.category = 'all';
        allTab.textContent = 'Р’СЃРµ РІРѕРїСЂРѕСЃС‹';
        tabsContainer.appendChild(allTab);
        // РЎРѕР·РґР°РµРј С‚Р°Р± "РР·Р±СЂР°РЅРЅРѕРµ"
        const favTab = document.createElement('div');
        favTab.className = 'tab';
        favTab.dataset.category = 'favorites';
        // РРєРѕРЅРєР° РёР·Р±СЂР°РЅРЅРѕРіРѕ: Р·РІРµР·РґР° (SVG)
        favTab.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style="vertical-align: middle;">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                style="fill: #fb923c; stroke: #fb923c; stroke-width: 2px;"
            />
        </svg>
    `;
        tabsContainer.appendChild(favTab);

        // Р”РѕР±Р°РІР»СЏРµРј С‚Р°Р±С‹ РґР»СЏ РІСЃРµС… РєР°С‚РµРіРѕСЂРёР№
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

        // РЎРѕР·РґР°РµРј РєРѕРЅС‚РµР№РЅРµСЂ РґР»СЏ РїРѕРґРєР°С‚РµРіРѕСЂРёР№
        const subcategoriesContainer = document.createElement('div');
        subcategoriesContainer.className = 'subcategories-container';
        subcategoriesContainer.style.display = 'none';

        // Р’РѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµРј РїРѕРґСЃРІРµС‚РєСѓ Р°РєС‚РёРІРЅРѕРіРѕ С‚Р°Р±Р° РёР· С‚РµРєСѓС‰РµРіРѕ РєРѕРЅС‚РµРєСЃС‚Р°
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
                    // РџРѕРґРєР°С‚РµРіРѕСЂРёРё Р±СѓРґСѓС‚ РїРµСЂРµСЃС‚СЂРѕРµРЅС‹ РїСЂРё render/refresh; Р·РґРµСЃСЊ С‚РѕР»СЊРєРѕ РІРёР·СѓР°Р»СЊРЅРѕ РїРѕРєР°Р·С‹РІР°РµРј Р±Р»РѕРє
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

        // Р”РѕР±Р°РІР»СЏРµРј РѕР±СЂР°Р±РѕС‚С‡РёРєРё РєР»РёРєР° РїРѕ С‚Р°Р±Р°Рј
        tabsContainer.addEventListener('click', function (e) {
            console.log('[TABS-NAVIGATION] Click on tabsContainer, target:', e.target);
            if (e.target.classList.contains('tab')) {
                console.log('[TABS-NAVIGATION] Tab clicked:', e.target);
                console.log('[TABS-NAVIGATION] Tab computed styles before active:', {
                    transform: window.getComputedStyle(e.target).transform,
                    zIndex: window.getComputedStyle(e.target).zIndex,
                    position: window.getComputedStyle(e.target).position
                });

                // РЈРґР°Р»СЏРµРј РєР»Р°СЃСЃ active Сѓ РІСЃРµС… С‚Р°Р±РѕРІ
                const tabs = tabsContainer.querySelectorAll('.tab');
                tabs.forEach(tab => tab.classList.remove('active'));

                // Р”РѕР±Р°РІР»СЏРµРј РєР»Р°СЃСЃ active РІС‹Р±СЂР°РЅРЅРѕРјСѓ С‚Р°Р±Сѓ
                e.target.classList.add('active');

                console.log('[TABS-NAVIGATION] Tab after active:', {
                    transform: window.getComputedStyle(e.target).transform,
                    zIndex: window.getComputedStyle(e.target).zIndex,
                    position: window.getComputedStyle(e.target).position
                });

                const categoryId = e.target.dataset.category;

                if (categoryId === 'all') {
                    // Р•СЃР»Рё РІС‹Р±СЂР°РЅС‹ РІСЃРµ РІРѕРїСЂРѕСЃС‹, СЃРєСЂС‹РІР°РµРј РєРѕРЅС‚РµР№РЅРµСЂ РїРѕРґРєР°С‚РµРіРѕСЂРёР№
                    subcategoriesContainer.style.display = 'none';
                    showAllQuestions();
                } else if (categoryId === 'favorites') {
                    // РР·Р±СЂР°РЅРЅРѕРµ Р±РµР· РїРѕРґРєР°С‚РµРіРѕСЂРёР№
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

        // Р”РѕР±Р°РІР»СЏРµРј РѕР±СЂР°Р±РѕС‚С‡РёРєРё РєР»РёРєР° РїРѕ РєР°СЂС‚РѕС‡РєР°Рј РїРѕРґРєР°С‚РµРіРѕСЂРёР№
        subcategoriesContainer.addEventListener('click', function (e) {
            if (e.target.classList.contains('subcategory-card')) {
                // РЈРґР°Р»СЏРµРј РєР»Р°СЃСЃ active Сѓ РІСЃРµС… РєР°СЂС‚РѕС‡РµРє
                const cards = subcategoriesContainer.querySelectorAll('.subcategory-card');
                cards.forEach(card => card.classList.remove('active'));

                // Р”РѕР±Р°РІР»СЏРµРј РєР»Р°СЃСЃ active РІС‹Р±СЂР°РЅРЅРѕР№ РєР°СЂС‚РѕС‡РєРµ
                e.target.classList.add('active');

                const subcategoryId = e.target.dataset.subcategory;
                const categoryId = e.target.dataset.category || tabsContainer.querySelector('.tab.active').dataset.category;

                if (subcategoryId === 'all') {
                    // Р•СЃР»Рё РІС‹Р±СЂР°РЅС‹ РІСЃРµ РїРѕРґРєР°С‚РµРіРѕСЂРёРё, С„РёР»СЊС‚СЂСѓРµРј С‚РѕР»СЊРєРѕ РїРѕ РєР°С‚РµРіРѕСЂРёРё
                    const selectedCategory = categories.find(cat => cat.id == categoryId);
                    filterQuestionsByCategory(selectedCategory.name);
                } else {
                    // Р•СЃР»Рё РІС‹Р±СЂР°РЅР° РєРѕРЅРєСЂРµС‚РЅР°СЏ РїРѕРґРєР°С‚РµРіРѕСЂРёСЏ, С„РёР»СЊС‚СЂСѓРµРј РїРѕ РєР°С‚РµРіРѕСЂРёРё Рё РїРѕРґРєР°С‚РµРіРѕСЂРёРё
                    const selectedCategory = categories.find(cat => cat.id == categoryId);
                    const selectedSubcategory = selectedCategory.subcategories.find(
                        subcat => subcat.id == subcategoryId
                    );

                    filterQuestionsBySubcategory(selectedCategory.name, selectedSubcategory.name);
                }
            }
        });

        // РРЅС‚РµРіСЂРёСЂСѓРµРј РєРЅРѕРїРєСѓ С„РёР»СЊС‚СЂРѕРІ РІРЅСѓС‚СЂСЊ СЃРїРёСЃРєР° С‚Р°Р±РѕРІ РєР°Рє РїРµСЂРІС‹Р№ СЌР»РµРјРµРЅС‚ (sticky left)
        const filtersBtn = document.createElement('button');
        filtersBtn.className = 'tab';
        filtersBtn.title = 'Р¤РёР»СЊС‚СЂС‹';
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

        // Р’СЃС‚Р°РІР»СЏРµРј РєРЅРѕРїРєСѓ С„РёР»СЊС‚СЂРѕРІ РїРµСЂРµРґ РѕСЃС‚Р°Р»СЊРЅС‹РјРё С‚Р°Р±Р°РјРё
        tabsContainer.insertBefore(filtersBtn, tabsContainer.firstChild);

        // РљРЅРѕРїРєР° СЂРµР¶РёРјР° РѕР±СѓС‡РµРЅРёСЏ (СЃРєСЂС‹С‚Р° РЅР° РјРѕР±РёР»СЊРЅС‹С… С‡РµСЂРµР· CSS .learn-main-btn)
        const learnBtn = document.createElement('button');
        learnBtn.title = 'РќР°С‡Р°С‚СЊ РѕР±СѓС‡РµРЅРёРµ';
        learnBtn.className = 'nav-icon-btn tab';
        learnBtn.style.padding = '0 10px';
        learnBtn.style.minWidth = 'auto';
        learnBtn.style.setProperty('color', '#fb923c', 'important'); // Orange icon (matches Level)
        learnBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3L1 9l11 6 9-4.91V17h2V9M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/></svg>';
        learnBtn.addEventListener('click', async () => {
            try {
                // Fallback: if currentQuestions is empty, try to use all data
                if ((!currentQuestions || currentQuestions.length === 0) && uniqueQaData && uniqueQaData.length > 0) {
                    console.warn('[Learn] currentQuestions empty, using uniqueQaData fallback');
                    currentQuestions = [...uniqueQaData];
                }

                if (!currentQuestions || currentQuestions.length === 0) {
                    console.warn('[Learn] No questions in current context');
                    alert('Р’ С‚РµРєСѓС‰РµРј СЃРїРёСЃРєРµ РЅРµС‚ РІРѕРїСЂРѕСЃРѕРІ РґР»СЏ РёР·СѓС‡РµРЅРёСЏ. Р’С‹Р±РµСЂРёС‚Рµ РєР°С‚РµРіРѕСЂРёСЋ РёР»Рё "Р’СЃРµ РІРѕРїСЂРѕСЃС‹".');
                    return;
                }

                let module;
                try {
                    module = await import('../srs/learn-ui.js?v=6.09');
                } catch (e1) {
                    console.warn('[Learn] Import v2.42 failed, trying plain import', e1);
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

                startLearnSession(currentQuestions);
            } catch (err) {
                console.error('[Learn] Error:', err);
                alert('РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РїСѓСЃС‚РёС‚СЊ СЂРµР¶РёРј РѕР±СѓС‡РµРЅРёСЏ: ' + err.message);
            }
        });

        // РљРЅРѕРїРєР° СЃС‚Р°С‚РёСЃС‚РёРєРё
        const statsBtn = document.createElement('button');
        statsBtn.className = 'nav-icon-btn tab';
        statsBtn.title = 'РЎС‚Р°С‚РёСЃС‚РёРєР°';
        statsBtn.style.minWidth = 'auto';
        statsBtn.style.padding = '0 10px';
        statsBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="4" height="18" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="17" y="13" width="4" height="8" rx="1"/></svg>`;
        statsBtn.addEventListener('click', async () => {
            // РћС‡РёС‰Р°РµРј СЃРѕСЃС‚РѕСЏРЅРёРµ РѕР±СѓС‡РµРЅРёСЏ РџР•Р Р•Р” РїРµСЂРµС…РѕРґРѕРј РЅР° СЃС‚Р°С‚РёСЃС‚РёРєСѓ
            if (window.__lastCandidates) {
                window.__lastCandidates = null;
            }
            const { initStatsPage } = await import('../srs/stats-ui.js?v=6.09');
            location.hash = '#/stats';
            initStatsPage(appVersion);
        });

        // РћР±СЂР°Р±РѕС‚С‡РёРє РёР·РјРµРЅРµРЅРёСЏ hash (РґР»СЏ РїРµСЂРµС…РѕРґР° РёР· РјРѕРґР°Р»РєРё)
        window.addEventListener('hashchange', async () => {
            // РЎРќРђР§РђР›Рђ РѕС‚РєР»СЋС‡Р°РµРј MutationObserver!
            if (window.__statsTopActionsObserver) {
                window.__statsTopActionsObserver.disconnect();
                window.__statsTopActionsObserver = null;
            }

            if (location.hash === '#/stats') {
                // РџР РћР’Р•Р РЇР•Рњ: СЃСѓС‰РµСЃС‚РІСѓРµС‚ Р»Рё stats-container
                const statsContainerExists = document.getElementById('stats-container');

                // Р•СЃР»Рё stats-container РќР• СЃСѓС‰РµСЃС‚РІСѓРµС‚, СЃРѕР·РґР°РµРј РµРіРѕ
                if (!statsContainerExists) {
                    const { initStatsPage } = await import('../srs/stats-ui.js?v=6.09');
                    initStatsPage(appVersion);
                }

                // РЎРєСЂС‹РІР°РµРј РіР»Р°РІРЅС‹Р№ РєРѕРЅС‚РµР№РЅРµСЂ Рё sidebar
                const mainContainer = document.querySelector('.container');
                if (mainContainer) {
                    mainContainer.style.display = 'none';
                }
                const sidebar = document.querySelector('.sidebar');
                if (sidebar) {
                    sidebar.style.display = 'none';
                }
            } else if (location.hash === '' || location.hash === '#/' || location.hash === '#') {
                // РџРµСЂРµС…РѕРґ РЅР° РіР»Р°РІРЅСѓСЋ - Р·Р°РєСЂС‹РІР°РµРј СЃС‚Р°С‚РёСЃС‚РёРєСѓ РµСЃР»Рё РѕС‚РєСЂС‹С‚Р°
                console.log('[HASHCHANGE #/] Navigating to home page...');

                // РћС‡РёС‰Р°РµРј СЃРѕСЃС‚РѕСЏРЅРёРµ РѕР±СѓС‡РµРЅРёСЏ РµСЃР»Рё РµСЃС‚СЊ
                if (window.__lastCandidates) {
                    window.__lastCandidates = null;
                    console.log('[HASHCHANGE #/] Cleared __lastCandidates');
                }

                // Р—Р°РєСЂС‹РІР°РµРј СЃС‚Р°С‚РёСЃС‚РёРєСѓ РµСЃР»Рё РѕС‚РєСЂС‹С‚Р°
                const statsContainer = document.getElementById('stats-container');
                if (statsContainer) {
                    statsContainer.remove();
                    console.log('[HASHCHANGE #/] Removed stats-container');
                }

                // РџРѕРєР°Р·С‹РІР°РµРј РіР»Р°РІРЅС‹Р№ РєРѕРЅС‚РµР№РЅРµСЂ
                const mainContainer = document.querySelector('.container');
                if (mainContainer) {
                    mainContainer.style.display = 'block';
                    console.log('[HASHCHANGE #/] mainContainer display set to block');
                }

                // Р’РѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµРј sidebar
                const sidebar = document.querySelector('.sidebar');
                if (sidebar) {
                    sidebar.style.display = '';
                    console.log('[HASHCHANGE #/] sidebar display reset');
                } else {
                    console.warn('[HASHCHANGE #/] sidebar NOT FOUND!');
                }

                // Р’РѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµРј top-actions-bar
                const topActionsBar = document.querySelector('.top-actions-bar');
                if (topActionsBar) {
                    topActionsBar.style.display = 'flex';
                    console.log('[HASHCHANGE #/] top-actions-bar display set to flex');
                } else {
                    console.warn('[HASHCHANGE #/] top-actions-bar NOT FOUND!');
                }

                // Р’РѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµРј search-container
                const searchContainer = document.querySelector('.search-container');
                if (searchContainer) {
                    searchContainer.style.display = '';
                    console.log('[HASHCHANGE #/] search-container display reset');
                } else {
                    console.warn('[HASHCHANGE #/] search-container NOT FOUND!');
                }

                // РћС‚РєР»СЋС‡Р°РµРј MutationObserver РґР»СЏ top-actions-bar
                if (window.__statsTopActionsObserver) {
                    window.__statsTopActionsObserver.disconnect();
                    window.__statsTopActionsObserver = null;
                    console.log('[HASHCHANGE #/] Disconnected __statsTopActionsObserver');
                }

                // РћР±РЅРѕРІР»СЏРµРј С‚РµРєСѓС‰РёР№ РєРѕРЅС‚РµРєСЃС‚
                refreshCurrentContext();
                console.log('[HASHCHANGE #] Home page setup complete');
            }
        });

        // РљРЅРѕРїРєР° РїСЂРѕС„РёР»СЏ / Р’РѕР№С‚Рё
        const loginMainBtn = document.createElement('button');
        loginMainBtn.className = 'nav-icon-btn login-main-btn tab';
        loginMainBtn.style.minWidth = 'auto';
        loginMainBtn.style.padding = '0 10px';
        loginMainBtn.style.backgroundColor = 'var(--color-card)';

        const userIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
        loginMainBtn.innerHTML = userIconSvg;
        loginMainBtn.title = 'Р’РѕР№С‚Рё';
        ensureDefaultUsers();
        loginMainBtn.addEventListener('click', () => {
            if (loggedInUser) {
                const username = loggedInUser.username || loggedInUser.email || 'РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ';
                if (confirm(`Р’С‹Р№С‚Рё РёР· Р°РєРєР°СѓРЅС‚Р° ${username}?`)) {
                    window.qaAuth.logout();
                }
            } else {
                openLoginModal();
            }
        });

        const editToggleBtn = document.createElement('button');
        editToggleBtn.title = 'Р РµР¶РёРј СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ';
        editToggleBtn.className = 'nav-icon-btn edit-mode-btn';
        editToggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;
        editToggleBtn.style.display = 'none';

        // РљРЅРѕРїРєР° Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР° РґР»СЏ РґРѕР±Р°РІР»РµРЅРёСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ (РїРѕСЏРІР»СЏРµС‚СЃСЏ РїРѕСЃР»Рµ РІС…РѕРґР° Р°РґРјРёРЅР°)
        const adminUsersBtn = document.createElement('button');
        adminUsersBtn.className = 'nav-icon-btn tab';
        adminUsersBtn.title = 'Р”РѕР±Р°РІРёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ';
        adminUsersBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
        adminUsersBtn.style.display = 'none';
        adminUsersBtn.style.minWidth = 'auto';
        adminUsersBtn.style.padding = window.innerWidth <= 420 ? '0 6px' : '0 10px';
        adminUsersBtn.addEventListener('click', openAdminUsersPanel);

        const cloudBtn = document.createElement('button');
        cloudBtn.title = 'РћР±Р»Р°РєРѕ';
        cloudBtn.textContent = 'РћР±Р»Р°РєРѕ';
        cloudBtn.className = 'tab';
        cloudBtn.style.display = 'none';
        cloudBtn.style.width = 'auto';
        // Removed manual styles to match app style
        cloudBtn.addEventListener('click', openCloudOverview);

        // Р”РѕР±Р°РІР»СЏРµРј РєРЅРѕРїРєРё: РЅР° РјРѕР±РёР»СЊРЅС‹С… РІ topActions, РЅР° desktop С‚РѕР¶Рµ РІ topActions
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        const isTablet = window.matchMedia('(min-width: 769px) and (max-width: 1024px)').matches;

        // рџ”Ґ Р’РЎР•Р“Р”Рђ РґРѕР±Р°РІР»СЏРµРј РєРЅРѕРїРєРё РІ topActions (Рё mobile, Рё desktop)
        topActions.appendChild(loginMainBtn); /* Р’С…РѕРґ/Р’С‹С…РѕРґ - РїРµСЂРІС‹Р№ */
        topActions.appendChild(statsBtn); /* РЎС‚Р°С‚РёСЃС‚РёРєР° - РІС‚РѕСЂРѕР№ */
        topActions.appendChild(learnBtn); /* РћР±СѓС‡РµРЅРёРµ - С‚СЂРµС‚РёР№ */
        topActions.appendChild(levelContainer);

        if (isMobile) {
            // Mobile: РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅС‹Рµ РєРЅРѕРїРєРё РІ topActions
            loginMainBtn.style.position = 'sticky';
            loginMainBtn.style.right = '0';
            loginMainBtn.style.zIndex = '10';
            loginMainBtn.style.borderLeft = '1px solid var(--color-border)';

            // Р’РµСЂСЃРёСЏ РїСЂРёР»РѕР¶РµРЅРёСЏ (РєРѕРјРїР°РєС‚РЅР°СЏ)
            topActions.appendChild(verEl);

            // РљРЅРѕРїРєР° СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ (РґР»СЏ admin Рё editor)
            topActions.appendChild(editToggleBtn);

            // РљРЅРѕРїРєР° РґРѕР±Р°РІР»РµРЅРёСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ (С‚РѕР»СЊРєРѕ admin)
            topActions.appendChild(adminUsersBtn);

            // рџ”Ґ РЎР РђР—РЈ РїСЂРѕРІРµСЂСЏРµРј РїСЂР°РІР° РґРѕСЃС‚СѓРїР° РїРѕСЃР»Рµ РґРѕР±Р°РІР»РµРЅРёСЏ РєРЅРѕРїРѕРє РІ DOM
            setTimeout(() => {
                try {
                    const user = JSON.parse(localStorage.getItem('qaSessionUser') || 'null');

                    // РљРЅРѕРїРєР° СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ: admin Рё editor
                    if (user && ['admin', 'editor'].includes(user.role)) {
                        editToggleBtn.style.setProperty('display', 'inline-block', 'important');
                    } else {
                        editToggleBtn.style.setProperty('display', 'none', 'important');
                    }

                    // РљРЅРѕРїРєР° РґРѕР±Р°РІР»РµРЅРёСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ: С‚РѕР»СЊРєРѕ admin
                    if (user && user.role === 'admin') {
                        adminUsersBtn.style.setProperty('display', 'inline-block', 'important');
                    } else {
                        adminUsersBtn.style.setProperty('display', 'none', 'important');
                    }
                } catch (e) {
                    console.error('[MOBILE ACCESS] РћС€РёР±РєР° РїСЂРѕРІРµСЂРєРё РїСЂР°РІ:', e);
                    // РџРѕ СѓРјРѕР»С‡Р°РЅРёСЋ СЃРєСЂС‹РІР°РµРј РєРЅРѕРїРєРё
                    editToggleBtn.style.setProperty('display', 'none', 'important');
                    adminUsersBtn.style.setProperty('display', 'none', 'important');
                }
            }, 50);
        } else {
            // Desktop: РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅС‹Рµ РєРЅРѕРїРєРё РІ topActions
            // Order: Stats -> Learn -> Login -> Version -> Edit -> Cloud -> Admin -> Level (Right Aligned)
            topActions.appendChild(verEl);
            topActions.appendChild(editToggleBtn);
            topActions.appendChild(cloudBtn);
            topActions.appendChild(adminUsersBtn);
        }

        // Р”РѕР±Р°РІР»СЏРµРј РєРѕРЅС‚РµР№РЅРµСЂ С‚Р°Р±РѕРІ РІ РЅР°РІРёРіР°С†РёСЋ РЅР°РїСЂСЏРјСѓСЋ
        navigationContainer.appendChild(tabsContainer);

        // Bottom sheet С„РёР»СЊС‚СЂРѕРІ
        let activeFilters = { status: null, ef: null };
        const sheet = document.getElementById('filters-sheet');

        if (sheet) {
            const overlay = document.getElementById('sheet-overlay');

            // РџСЂРёРІСЏР·С‹РІР°РµРј РѕР±СЂР°Р±РѕС‚С‡РёРєРё Рє СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРј СЌР»РµРјРµРЅС‚Р°Рј РёР· index.html
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
                // РЎР±СЂРѕСЃ РІРёР·СѓР°Р»СЊРЅРѕРіРѕ СЃРѕСЃС‚РѕСЏРЅРёСЏ С‡РёРїРѕРІ
                sheet.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            });

            if (applyBtn) applyBtn.addEventListener('click', () => {
                applyFilters();
                closeSheet();
            });

            // РћС‚РєСЂС‹С‚РёРµ РїРѕ РєРЅРѕРїРєРµ С„РёР»СЊС‚СЂРѕРІ
            filtersBtn.addEventListener('click', openSheet);

            // РћР±СЂР°Р±РѕС‚РєР° РєР»РёРєРѕРІ РїРѕ С‡РёРїР°Рј
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

                    // РћР±РЅРѕРІР»СЏРµРј РІРёР·СѓР°Р»СЊРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ
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

        // РЈРґР°Р»С‘РЅ РїСЂРµР¶РЅРёР№ РѕРіРѕРЅС‘Рє РґРѕ РІРёРґР¶РµС‚Р° СѓСЂРѕРІРЅСЏ вЂ” РїРµСЂРµРЅРµСЃС‘РЅ Р±Р»РёР¶Рµ Рє С€РєР°Р»Рµ

        // Logic to update icon/tooltip on login change
        function updateLoginBtnState() {
            loginMainBtn.title = loggedInUser ? 'Р’С‹Р№С‚Рё' : 'Р’РѕР№С‚Рё';
            const exitIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M10 17l1.41-1.41L8.83 13H17v-2H8.83l2.58-2.59L10 7l-5 5 5 5z"/><path d="M19 3h-8c-1.1 0-2 .9-2 2v4h2V5h8v14h-8v-4H9v4c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>`;
            loginMainBtn.innerHTML = loggedInUser ? exitIconSvg : userIconSvg;
            // loginMainBtn.style.color = '#d0d0d0';
            // try { statsBtn.style.color = '#d0d0d0'; } catch {}
        }
        if (!window.qaAuth) window.qaAuth = {};
        window.qaAuth.getUser = () => loggedInUser;
        window.qaAuth.openLogin = () => openLoginModal();
        window.qaAuth.logout = async () => {
            // рџ”Ґ РћС‡РёС‰Р°РµРј РґР°РЅРЅС‹Рµ Telegram OAuth РїРµСЂРµРґ РІС‹С…РѕРґРѕРј
            sessionStorage.removeItem('tgAuthUser');

            await setLoggedUser(null);
            window.location.reload();
        };
        // РџР»Р°С€РєР° СѓСЂРѕРІРЅСЏ Рё XP
        import('../srs/stats-utils.js').then(({ getCurrentLevel }) => {
            // Р”РѕР±Р°РІР»СЏРµРј РёРјСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
            const usernameSpan = document.createElement('span');
            usernameSpan.className = 'username-display';
            usernameSpan.style.marginRight = '8px';
            usernameSpan.style.fontSize = '13px';
            usernameSpan.style.color = '#4ec9b0';
            usernameSpan.style.fontWeight = '600';

            // РџРѕР»СѓС‡Р°РµРј РёРјСЏ РёР· СЃРµСЃСЃРёРё
            try {
                const sessionUserRaw = localStorage.getItem('qaSessionUser');
                if (sessionUserRaw) {
                    const user = JSON.parse(sessionUserRaw);
                    if (user && user.username) {
                        usernameSpan.textContent = user.username;
                    } else {
                        usernameSpan.textContent = 'Р“РѕСЃС‚СЊ';
                        usernameSpan.style.color = '#808080';
                    }
                } else {
                    usernameSpan.textContent = 'Р“РѕСЃС‚СЊ';
                    usernameSpan.style.color = '#808080';
                }
            } catch (e) {
                usernameSpan.textContent = 'Р“РѕСЃС‚СЊ';
                usernameSpan.style.color = '#808080';
            }

            levelContainer.appendChild(usernameSpan);

            const box = document.createElement('div');
            box.className = 'level-inline';
            box.style.cursor = 'pointer';
            box.style.transition = 'all 0.2s ease';
            box.style.padding = '4px 8px';
            box.style.borderRadius = '8px';
            box.title = 'РЈСЂРѕРІРЅРё Рё XP';
            box.onclick = () => {
                // РЎРЅР°С‡Р°Р»Р° РїСЂРѕР±СѓРµРј С‡РµСЂРµР· window (РµСЃР»Рё stats-ui Р·Р°РіСЂСѓР¶РµРЅ)
                if (window.openLevelInfoModal) {
                    window.openLevelInfoModal();
                } else {
                    // РРЅР°С‡Рµ Р·Р°РіСЂСѓР¶Р°РµРј stats-ui
                    import('../srs/stats-ui.js?v=6.09').then(() => {
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
            // РћРіРѕРЅС‘Рє СЃС‚СЂРёРєР° СЂСЏРґРѕРј СЃРѕ С€РєР°Р»РѕР№ СѓСЂРѕРІРЅСЏ
            const streakRaw = localStorage.getItem('studyStreak') || '{}';
            let streakVal = 0;
            try { const s = JSON.parse(streakRaw); streakVal = s.current || 0; } catch { }
            if (streakVal > 0) {
                const flame = document.createElement('span');
                flame.textContent = `рџ”Ґ ${streakVal}`;
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

                    // РћР±РЅРѕРІР»СЏРµРј РёРјСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
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
                                    usernameSpan.textContent = 'Р“РѕСЃС‚СЊ';
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

        // РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ СЃРѕСЃС‚РѕСЏРЅРёСЏ РєРЅРѕРїРѕРє РїРѕ СЃРѕС…СЂР°РЅС‘РЅРЅРѕРјСѓ РїРѕР»СЊР·РѕРІР°С‚РµР»СЋ
        try { setLoggedUser(loggedInUser); } catch { }

        // РџР°РЅРµР»СЊ РєРѕСЂР·РёРЅС‹ (РІРёРґРЅР° С‚РѕР»СЊРєРѕ РІ СЂРµР¶РёРјРµ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ)
        const trashPanel = document.createElement('div');
        trashPanel.className = 'trash-panel';
        trashPanel.style.display = 'none';
        trashPanel.style.border = '1px solid #444';
        trashPanel.style.borderRadius = '6px';
        trashPanel.style.padding = '8px';
        trashPanel.style.marginBottom = '8px';
        // Р’РєР»СЋС‡Р°РµРј РїСЂРѕРєСЂСѓС‚РєСѓ РЅРµР·Р°РІРёСЃРёРјРѕ РѕС‚ СЂРµР¶РёРјР°
        trashPanel.style.overflowY = 'auto';
        // trashPanel.style.maxHeight СѓРґР°Р»РµРЅ, СѓРїСЂР°РІР»СЏРµС‚СЃСЏ CSS
        trashPanel.innerHTML = '<div id="trash-categories" style="margin-top:6px"></div><div id="trash-cards" style="margin-top:6px"></div>';

        // Р”РѕР±Р°РІР»СЏРµРј СЌР»РµРјРµРЅС‚С‹ РІ РєРѕРЅС‚РµР№РЅРµСЂ РЅР°РІРёРіР°С†РёРё
        navigationContainer.appendChild(topActions);
        navigationContainer.appendChild(tabsContainer);
        navigationContainer.appendChild(subcategoriesContainer);

        // Р’СЃС‚Р°РІР»СЏРµРј РєРѕРЅС‚РµР№РЅРµСЂ РЅР°РІРёРіР°С†РёРё РїРµСЂРµРґ РєРѕРЅС‚РµР№РЅРµСЂРѕРј РїРѕРёСЃРєР°
        // Р’СЃС‚Р°РІР»СЏРµРј РІРµСЂС…РЅСЋСЋ РїР°РЅРµР»СЊ Рё РєРѕСЂР·РёРЅСѓ РїРµСЂРµРґ РЅР°РІРёРіР°С†РёРµР№
        // container.insertBefore(topControls, searchContainer); // РЈРґР°Р»РµРЅРѕ

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

        // РЎР»СѓС€Р°РµРј dataLoaded РґР»СЏ РѕР±РЅРѕРІР»РµРЅРёСЏ РєРѕСЂР·РёРЅС‹ РїРѕСЃР»Рµ Р·Р°РіСЂСѓР·РєРё РґР°РЅРЅС‹С…
        document.addEventListener('dataLoaded', () => {
            refreshServerTrash();
        });

        // Р”РµР»Р°РµРј refreshServerTrash РіР»РѕР±Р°Р»СЊРЅРѕ РґРѕСЃС‚СѓРїРЅРѕР№
        window.refreshServerTrash = refreshServerTrash;

        // РџСЂРёРІСЏР·С‹РІР°РµРј РіР»РѕР±Р°Р»СЊРЅСѓСЋ СЃСЃС‹Р»РєСѓ РЅР° РёРЅРґРёРєР°С‚РѕСЂ СЃРѕС…СЂР°РЅРµРЅРёСЏ
        // globalSaveStatusEl = saveStatus; // Removed in favor of global toast

        (async () => {
            try {
                const meta = await getServerMetadata();
                if (Array.isArray(meta.categoryOrder)) setCategoryOrder(meta.categoryOrder);
                if (meta.subcategoryOrder && typeof meta.subcategoryOrder === 'object') setSubcategoryOrderMap(meta.subcategoryOrder);
                if (meta.orderOverrides && typeof meta.orderOverrides === 'object') setLS('qaOrderOverrides', meta.orderOverrides);
                // refreshServerTrash() РІС‹Р·С‹РІР°РµС‚СЃСЏ РџРћРЎР›Р• Р·Р°РіСЂСѓР·РєРё РґР°РЅРЅС‹С… СЃ СЃРµСЂРІРµСЂР° (РІ loadFromServer)
                refreshCategoriesTabs();
            } catch { }
        })();

        // РџСЂРёРјРµРЅСЏРµРј СЃРѕС…СЂР°РЅС‘РЅРЅС‹Р№ СЂРµР¶РёРј СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ РїСЂРё РёРЅРёС†РёР°Р»РёР·Р°С†РёРё
        if (editMode) {
            // рџ”Ґ Р”РѕР±Р°РІР»СЏРµРј РєР»Р°СЃСЃ on РєРЅРѕРїРєРµ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ
            editToggleBtn.classList.add('on');
            editToggleBtn.title = 'Р’С‹РєР»СЋС‡РёС‚СЊ СЂРµР¶РёРј СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ';

            try {
                const sidebar = document.querySelector('.sidebar');
                if (sidebar) sidebar.classList.remove('collapsed'); // РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРё СЂР°Р·РІРѕСЂР°С‡РёРІР°РµРј РїСЂРё СЃС‚Р°СЂС‚Рµ РІ СЂРµР¶РёРјРµ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ
                const sidebarButtons = sidebar ? sidebar.querySelector('.sidebar-mode-buttons') : null;
                const searchHistory = sidebar ? sidebar.querySelector('#search-history') : null;
                const existingTrashBtn = sidebarButtons ? sidebarButtons.querySelector('#trash-mode-button') : null;
                if (!existingTrashBtn && sidebarButtons) {
                    const trashBtn = document.createElement('button');
                    trashBtn.id = 'trash-mode-button';
                    trashBtn.title = 'РљРѕСЂР·РёРЅР°';
                    trashBtn.setAttribute('aria-label', 'РљРѕСЂР·РёРЅР°');
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

        // ===== Р›РѕРєР°Р»СЊРЅР°СЏ Р°РІС‚РѕСЂРёР·Р°С†РёСЏ =====
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
            // РџРµСЂРµРєР»СЋС‡РµРЅРёРµ Guest -> User (Login)
            if (!loggedInUser && user) {
                // Р‘СЌРєР°Рї РґР°РЅРЅС‹С… РіРѕСЃС‚СЏ
                const backup = {};
                DATA_KEYS.forEach(k => backup[k] = localStorage.getItem(k));
                localStorage.setItem('guest_backup', JSON.stringify(backup));

                // РћС‡РёС‰Р°РµРј РґР°РЅРЅС‹Рµ, С‡С‚РѕР±С‹ Р·Р°РіСЂСѓР·РёС‚СЊ РїСЂРѕС„РёР»СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РЅР°С‡РёСЃС‚Рѕ
                DATA_KEYS.forEach(k => localStorage.removeItem(k));
                localStorage.removeItem('localDataTimestamp');

                // РЎРѕС…СЂР°РЅСЏРµРј С‚РѕРєРµРЅ РµСЃР»Рё РµСЃС‚СЊ
                if (token) {
                    localStorage.setItem('sessionToken', token);
                }
            }

            // РџРµСЂРµРєР»СЋС‡РµРЅРёРµ User -> Guest (Logout)
            if (loggedInUser && !user) {
                console.log('[LOGOUT] === РќРђР§РђР›Рћ Р’Р«РҐРћР”Рђ ===');

                // рџ”Ґ РћС‡РёС‰Р°РµРј РєР»СЋС‡Рё Telegram Р°РІС‚РѕСЂРёР·Р°С†РёРё РІ localStorage
                localStorage.removeItem('qaUsername');
                localStorage.removeItem('qaAuthType');

                // рџ”Ґ РћС‡РёС‰Р°РµРј РґР°РЅРЅС‹Рµ Telegram OAuth РІ sessionStorage
                sessionStorage.removeItem('tgAuthUser');

                // рџ”Ґ РћС‡РёС‰Р°РµРј СЃРµСЃСЃРёСЋ Telegram (РµСЃР»Рё РІРґСЂСѓРі РѕСЃС‚Р°Р»Р°СЃСЊ)
                sessionStorage.removeItem('telegramUser');

                // вљ пёЏ Р’РђР–РќРћ: РЎРѕС…СЂР°РЅСЏРµРј Р’РЎР• РґР°РЅРЅС‹Рµ РЅР° СЃРµСЂРІРµСЂ РџР•Р Р•Р” РІС‹С…РѕРґРѕРј
                // рџ”Ґ РРЎРџР РђР’Р›Р•РќРР•: РќРµ СЃРѕС…СЂР°РЅСЏРµРј РµСЃР»Рё РґР°РЅРЅС‹Рµ СѓР¶Рµ СЃРѕС…СЂР°РЅРµРЅС‹ (qaNewItems РїСѓСЃС‚)
                const newItems = getNewItems();
                const deletedItems = getDeletedItems();
                const hasUnsavedChanges = (newItems && newItems.length > 0) ||
                    (deletedItems && Object.keys(deletedItems).length > 0);

                console.log('[LOGOUT] РџСЂРѕРІРµСЂСЏРµРј РµСЃС‚СЊ Р»Рё РЅРµСЃРѕС…СЂР°РЅС‘РЅРЅС‹Рµ РґР°РЅРЅС‹Рµ:', {
                    hasUnsavedChanges,
                    newItemsCount: newItems?.length || 0,
                    deletedCount: Object.keys(deletedItems || {}).length
                });

                if (hasUnsavedChanges) {
                    console.log('[LOGOUT] РЎРѕС…СЂР°РЅСЏРµРј РґР°РЅРЅС‹Рµ РЅР° СЃРµСЂРІРµСЂРµ РїРµСЂРµРґ РІС‹С…РѕРґРѕРј...');
                    try {
                        await saveMergedToServer();
                    } catch (e) {
                        console.error('[Logout] Failed to save data before logout:', e);
                    }
                } else {
                    console.log('[LOGOUT] Р’СЃРµ РґР°РЅРЅС‹Рµ СѓР¶Рµ СЃРѕС…СЂР°РЅРµРЅС‹, РїСЂРѕРїСѓСЃРєР°РµРј saveMergedToServer');
                }

                // вљ пёЏ Р’РђР–РќРћ: РџРѕР»РЅРѕСЃС‚СЊСЋ РѕС‡РёС‰Р°РµРј localStorage РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
                // Р”Р°РЅРЅС‹Рµ СѓР¶Рµ СЃРѕС…СЂР°РЅРµРЅС‹ РЅР° СЃРµСЂРІРµСЂРµ, РїСЂРё СЃР»РµРґСѓСЋС‰РµРј РІС…РѕРґРµ Р·Р°РіСЂСѓР·РёРј РѕС‚С‚СѓРґР°
                const DATA_KEYS_TO_CLEAR = [
                    // РљР°СЂС‚РѕС‡РєРё, РёР·Р±СЂР°РЅРЅРѕРµ, РєРѕСЂР·РёРЅР°
                    'qaUserCards_admin', 'qaUserCards_jeff', 'qaUserCards_stas',
                    'qaFavorites_admin', 'qaFavorites_jeff', 'qaFavorites_stas',
                    'qaUserTrash_admin', 'qaUserTrash_jeff', 'qaUserTrash_stas',
                    'qaUserCards_guest', 'qaFavorites_guest', 'qaUserTrash_guest',
                    // РђРґРјРёРЅРєР° Рё overrides
                    'qaAdminOverrides', 'qaNewItems', 'qaDeletedItems',
                    'qaCategoryPlaceholders', 'qaCategoryOrder', 'qaOrderOverrides',
                    // РЎРµСЃСЃРёСЏ
                    'localDataTimestamp', 'qaSessionUser', 'sessionToken', 'currentUser',
                    // рџ”Ґ РџР РћР“Р Р•РЎРЎ Р Р”РћРЎРўРР–Р•РќРРЇ (С‡С‚РѕР±С‹ РіРѕСЃС‚СЊ РЅРµ РІРёРґРµР» РґР°РЅРЅС‹Рµ Р°РґРјРёРЅР°)
                    'srsProgress', 'studyAchievements', 'studyStreak',
                    'dailyPoints', 'dailyBonusPoints', 'dailyDayBonusPoints',
                    'studyStats'
                ];
                DATA_KEYS_TO_CLEAR.forEach(key => localStorage.removeItem(key));

                console.log('[LOGOUT] localStorage РѕС‡РёС‰РµРЅ, РєР»СЋС‡Рё:', DATA_KEYS_TO_CLEAR);

                // РўР°РєР¶Рµ РѕС‡РёС‰Р°РµРј СЃС‚Р°СЂС‹Рµ РєР»СЋС‡Рё Р±РµР· СЃСѓС„С„РёРєСЃРѕРІ
                ['qaUserCards', 'qaFavorites', 'qaUserTrash'].forEach(key => localStorage.removeItem(key));

                // рџ”Ґ Р”РѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕ РѕС‡РёС‰Р°РµРј РїСЂРѕРіСЂРµСЃСЃ Р±РµР· СЃСѓС„С„РёРєСЃРѕРІ
                ['srsProgress', 'studyAchievements', 'studyStreak', 'dailyPoints', 'dailyBonusPoints', 'dailyDayBonusPoints', 'studyStats']
                    .forEach(key => localStorage.removeItem(key));

                // вљ пёЏ Р’РђР–РќРћ: РЈРґР°Р»СЏРµРј СЃРµСЃСЃРёСЋ РїРѕР»РЅРѕСЃС‚СЊСЋ
                clearQaUserCards();

                console.log('[LOGOUT] === Р’Р«РҐРћР” Р—РђР’Р•Р РЁР•Рќ ===');
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
            // РџРѕРєР°Р·Р°С‚СЊ/СЃРєСЂС‹С‚СЊ Р°РґРјРёРЅСЃРєРёРµ РєРЅРѕРїРєРё РІ Р·Р°РІРёСЃРёРјРѕСЃС‚Рё РѕС‚ СЂРѕР»Рё
            try {
                adminUsersBtn.style.display = (user && user.role === 'admin') ? 'inline-block' : 'none';  // РўРѕР»СЊРєРѕ admin РјРѕР¶РµС‚ СЃРѕР·РґР°РІР°С‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№
                // editToggleBtn РґРѕСЃС‚СѓРїРµРЅ admin Рё editor
                editToggleBtn.style.display = (user && ['admin', 'editor'].includes(user.role)) ? 'inline-block' : 'none';
                // genStatsBtn РґРѕСЃС‚СѓРїРµРЅ С‚РѕР»СЊРєРѕ admin
                genStatsBtn.style.display = (user && user.role === 'admin') ? 'inline-block' : 'none';
            } catch { }
            try { migrateDeviceRecordsToUser(); } catch { }
            if (user) {
                import('../srs/storage.js').then(mod => {
                    if (mod && typeof mod.hydrateLocalFromSupabase === 'function') {
                        mod.hydrateLocalFromSupabase().then(() => {
                            const evt = new Event('xpUpdated'); window.dispatchEvent(evt);
                            // РўР°РєР¶Рµ РѕР±РЅРѕРІР»СЏРµРј РёР·Р±СЂР°РЅРЅРѕРµ
                            window.dispatchEvent(new Event('favoritesUpdated'));
                            // РћР±РЅРѕРІР»СЏРµРј UI С‚Р°Р±РѕРІ РїРѕСЃР»Рµ Р·Р°РіСЂСѓР·РєРё РґР°РЅРЅС‹С…
                            window.dispatchEvent(new Event('dataLoaded'));
                        }).catch(() => { });
                    }
                }).catch(() => { });
            } else {
                // Р•СЃР»Рё РІС‹С€Р»Рё (Guest), С‚РѕР¶Рµ РѕР±РЅРѕРІРёРј UI
                window.dispatchEvent(new Event('xpUpdated'));
                window.dispatchEvent(new Event('favoritesUpdated'));
                // РћР±РЅРѕРІР»СЏРµРј РёРјСЏ РЅР° "Р“РѕСЃС‚СЊ"
                const usernameSpan = document.querySelector('.username-display');
                if (usernameSpan) {
                    usernameSpan.textContent = 'Р“РѕСЃС‚СЊ';
                    usernameSpan.style.color = '#808080';
                }
            }
        }

        // Make setLoggedUser available globally for autoLoadUserData
        window.setLoggedUser = setLoggedUser;

        // Auto-load user data on page load if credentials are saved
        // Р’С‹Р·С‹РІР°РµРј СЃ Р·Р°РґРµСЂР¶РєРѕР№ С‡С‚РѕР±С‹ РІСЃРµ С„СѓРЅРєС†РёРё Р±С‹Р»Рё РѕРїСЂРµРґРµР»РµРЅС‹
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
                    <!-- Р‘Р»РёРє СЃРІРµСЂС…Сѓ -->
                    <div style="
                        position: absolute;
                        top: 0; left: 0; right: 0;
                        height: 1px;
                        background: linear-gradient(90deg, 
                            transparent, 
                            rgba(255,255,255,0.4), 
                            transparent);
                    "></div>
                    
                    <div style="font-weight:600;margin-bottom:16px;color:#fff;font-size:18px;letter-spacing:-0.3px;text-align:center">Р’С…РѕРґ</div>
                    <form id="login-form" autocomplete="on" style="display:flex;flex-direction:column;gap:10px">
                        <input id="login-username" name="username" autocomplete="username" placeholder="Р›РѕРіРёРЅ" style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:#fff;font-size:14px;transition:all 0.2s"/>
                        <div style="position:relative;display:block">
                            <input id="login-password" name="password" autocomplete="current-password" placeholder="РџР°СЂРѕР»СЊ" type="password" style="width:100%;box-sizing:border-box;padding:10px 36px 10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:#fff;font-size:14px;transition:all 0.2s"/>
                            <button type="button" id="login-pass-eye" title="РџРѕРєР°Р·Р°С‚СЊ РїР°СЂРѕР»СЊ" aria-label="РџРѕРєР°Р·Р°С‚СЊ РїР°СЂРѕР»СЊ" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);padding:0;border:none;background:transparent;color:rgba(255,255,255,0.6);width:22px;height:22px;cursor:pointer;transition:color 0.2s">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                            </button>
                        </div>
                        <label style="display:flex;gap:8px;align-items:center;font-size:12px;color:rgba(255,255,255,0.6)">
                            <input type="checkbox" id="login-remember" checked style="accent-color:rgba(255,255,255,0.3)"/>
                            РћСЃС‚Р°РІР°С‚СЊСЃСЏ РІ СЃРёСЃС‚РµРјРµ
                        </label>
                        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
                            <button id="login-cancel" type="button" style="padding:10px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.8);font-size:14px;cursor:pointer;transition:all 0.2s">РћС‚РјРµРЅР°</button>
                            <button id="login-submit" type="submit" style="padding:10px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.3);background:linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%);color:#fff;font-weight:600;font-size:14px;cursor:pointer;transition:all 0.2s">Р’РѕР№С‚Рё</button>
                        </div>
                        <div style="margin-top:16px;border-top:1px solid rgba(255,255,255,0.15);padding-top:16px;display:flex;flex-direction:column;align-items:center;gap:10px">
                            <div style="font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.5px">РР»Рё РІРѕР№С‚Рё С‡РµСЂРµР·</div>
                            <div style="display:flex;gap:12px;justify-content:center;align-items:center">
                                <!-- Google -->
                                <button id="google-login-btn" type="button" title="Р’РѕР№С‚Рё С‡РµСЂРµР· Google" style="width:44px;height:44px;border-radius:12px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                                </button>
                                <!-- GitHub -->
                                <button id="github-login-btn" type="button" title="Р’РѕР№С‚Рё С‡РµСЂРµР· GitHub" style="width:44px;height:44px;border-radius:12px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                                </button>
                            </div>
                            <!-- Telegram Login Widget - РІРёРґРёРјС‹Р№ -->
                            <div id="tg-widget-container" style="margin-top:12px;display:flex;justify-content:center;"></div>
                        </div>
                    </form>
                </div>
            `;
                document.body.appendChild(ov);

                // Р”РѕР±Р°РІР»СЏРµРј СЃС‚РёР»Рё РґР»СЏ hover-СЌС„С„РµРєС‚РѕРІ
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
                    /* РљРЅРѕРїРєРё СЃРѕС†СЃРµС‚РµР№ */
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

                // === РћР‘Р РђР‘РћРўР§РРљР Р”Р›РЇ РљРќРћРџРћРљ РЎРћР¦РЎР•РўР•Р™ ===

                // Google РєРЅРѕРїРєР°
                const googleBtn = ov.querySelector('#google-login-btn');
                if (googleBtn) {
                    googleBtn.addEventListener('click', function () {
                        console.log('[Google Auth] Button clicked');
                        // Р—Р°РіСЂСѓР¶Р°РµРј Google OAuth СЃРєСЂРёРїС‚
                        const script = document.createElement('script');
                        script.src = 'https://accounts.google.com/gsi/client';
                        script.onload = function () {
                            console.log('[Google Auth] Script loaded, initializing...');
                            // РРЅРёС†РёР°Р»РёР·РёСЂСѓРµРј Google OAuth СЃ redirect mode (РЅР°РґС‘Р¶РЅРµРµ Р±РµР· FedCM)
                            google.accounts.id.initialize({
                                client_id: '862467912934-pjug7gt80qcp3t4rmtjvvu78fa6nukuf.apps.googleusercontent.com',
                                callback: handleGoogleSignIn,
                                auto_select: false,
                                ux_mode: 'redirect'  // Redirect РІРјРµСЃС‚Рѕ popup (РЅР°РґС‘Р¶РЅРµРµ)
                            });
                            console.log('[Google Auth] Initialized, redirecting to Google...');
                            // РџРµСЂРµРЅР°РїСЂР°РІР»СЏРµРј РЅР° Google
                            google.accounts.id.prompt();
                        };
                        script.onerror = function () {
                            console.error('[Google Auth] Script failed to load');
                        };
                        document.body.appendChild(script);
                    });
                }

                // GitHub РєРЅРѕРїРєР° - OAuth С‡РµСЂРµР· popup
                const githubBtn = ov.querySelector('#github-login-btn');
                if (githubBtn) {
                    githubBtn.addEventListener('click', function () {
                        console.log('[GitHub Auth] Button clicked');
                        // РћС‚РєСЂС‹РІР°РµРј GitHub OAuth РІ popup РѕРєРЅРµ
                        const popup = window.open(
                            `${BACKEND_URL}/api/auth/github`,
                            'GitHub Auth',
                            'width=600,height=400,left=' + (screen.width / 2 - 300) + ',top=' + (screen.height / 2 - 200)
                        );

                        // РЎР»СѓС€Р°РµРј СЃРѕРѕР±С‰РµРЅРёРµ РѕС‚ popup
                        const handleMessage = (event) => {
                            if (event.data && event.data.type === 'github-auth') {
                                console.log('[GitHub Auth] Success:', event.data);
                                // РЎРѕС…СЂР°РЅСЏРµРј РґР°РЅРЅС‹Рµ
                                localStorage.setItem('qaUsername', event.data.username);
                                localStorage.setItem('qaAuthType', 'github');
                                setLoggedUser({ username: event.data.username, role: event.data.role });
                                // Р—Р°РєСЂС‹РІР°РµРј РјРѕРґР°Р»СЊРЅРѕРµ РѕРєРЅРѕ
                                const ov = document.getElementById('login-overlay');
                                if (ov) ov.remove();
                                // РџРµСЂРµР·Р°РіСЂСѓР¶Р°РµРј СЃС‚СЂР°РЅРёС†Сѓ
                                window.location.reload();
                                // РЈРґР°Р»СЏРµРј СЃР»СѓС€Р°С‚РµР»СЊ
                                window.removeEventListener('message', handleMessage);
                            }
                        };

                        window.addEventListener('message', handleMessage);

                        // РџСЂРѕРІРµСЂСЏРµРј Р·Р°РєСЂС‹С‚РёРµ popup
                        const checkClosed = setInterval(() => {
                            if (popup.closed) {
                                clearInterval(checkClosed);
                                window.removeEventListener('message', handleMessage);
                            }
                        }, 500);
                    });
                }

                // Telegram Login Widget - Р·Р°РіСЂСѓР¶Р°РµРј СЃСЂР°Р·Сѓ
                const widgetContainer = ov.querySelector('#tg-widget-container');
                console.log('[TG DEBUG] РљРѕРЅС‚РµР№РЅРµСЂ РІРёРґР¶РµС‚Р° РЅР°Р№РґРµРЅ:', !!widgetContainer);

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
                        console.log('[TG Auth] вњ… Р’РёРґР¶РµС‚ Telegram Р·Р°РіСЂСѓР¶РµРЅ');
                    };

                    widgetContainer.appendChild(script);
                }

                // Р“Р»РѕР±Р°Р»СЊРЅС‹Р№ РєРѕР»Р»Р±СЌРє РґР»СЏ Google OAuth
                window.handleGoogleSignIn = async function (response) {
                    console.log('[Google Auth] === RESPONSE RECEIVED ===');
                    console.log('[Google Auth] Full response:', JSON.stringify(response, null, 2));

                    try {
                        // РџСЂРѕРІРµСЂСЏРµРј С‡С‚Рѕ credential СЃСѓС‰РµСЃС‚РІСѓРµС‚
                        if (!response || !response.credential) {
                            console.error('[Google Auth] No credential in response');
                            alert('РћС€РёР±РєР°: Google РЅРµ РІРµСЂРЅСѓР» С‚РѕРєРµРЅ. РџРѕРїСЂРѕР±СѓР№С‚Рµ РµС‰С‘ СЂР°Р·.');
                            return;
                        }

                        console.log('[Google Auth] Credential received');

                        // Р Р°Р·РґРµР»СЏРµРј JWT РЅР° С‡Р°СЃС‚Рё
                        const parts = response.credential.split('.');

                        // Google РёСЃРїРѕР»СЊР·СѓРµС‚ URL-safe base64, РЅСѓР¶РЅРѕ Р·Р°РјРµРЅРёС‚СЊ - РЅР° + Рё _ РЅР° /
                        let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                        const userInfo = JSON.parse(atob(base64));

                        console.log('[Google Auth] User info:', userInfo);

                        // РћРўРџР РђР’Р›РЇР•Рњ Р›РћР“Р РќРђ РЎР•Р Р’Р•Р 
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

                        // РћС‚РїСЂР°РІР»СЏРµРј РЅР° СЃРµСЂРІРµСЂ РґР»СЏ Р°РІС‚РѕСЂРёР·Р°С†РёРё
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
                            // РЎРѕС…СЂР°РЅСЏРµРј РґР°РЅРЅС‹Рµ РґР»СЏ Р°РІС‚РѕР·Р°РіСЂСѓР·РєРё
                            localStorage.setItem('qaUsername', data.username);
                            localStorage.setItem('qaAuthType', 'google');
                            setLoggedUser({ username: data.username, role: data.role });

                            // Р—Р°РєСЂС‹РІР°РµРј РјРѕРґР°Р»СЊРЅРѕРµ РѕРєРЅРѕ
                            const ov = document.getElementById('login-overlay');
                            if (ov) ov.remove();

                            // РџРµСЂРµР·Р°РіСЂСѓР¶Р°РµРј СЃС‚СЂР°РЅРёС†Сѓ
                            window.location.reload();
                        } else {
                            console.error('[Google Auth] Server error:', data.error);
                            alert('РћС€РёР±РєР° Р°РІС‚РѕСЂРёР·Р°С†РёРё: ' + (data.error || 'РќРµРёР·РІРµСЃС‚РЅР°СЏ РѕС€РёР±РєР°'));
                        }
                    } catch (e) {
                        console.error('[Google Auth] === ERROR ===');
                        console.error('[Google Auth] Error type:', e.name);
                        console.error('[Google Auth] Error message:', e.message);
                        console.error('[Google Auth] Stack:', e.stack);
                        alert('РћС€РёР±РєР° Р°РІС‚РѕСЂРёР·Р°С†РёРё: ' + e.message);
                    }
                };

                // Р“Р»РѕР±Р°Р»СЊРЅС‹Р№ РєРѕР»Р»Р±СЌРє РґР»СЏ РІРёРґР¶РµС‚Р° Telegram
                window.onTelegramAuth = async function (user) {
                    console.log('[TG Auth] Р”Р°РЅРЅС‹Рµ РѕС‚ Telegram:', user);

                    const authUrl = `${BACKEND_URL}/api/auth/telegram`;

                    try {
                        const res = await fetch(authUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(user)
                        });

                        const data = await res.json();
                        console.log('[TG Auth] РћС‚РІРµС‚ СЃРµСЂРІРµСЂР°:', data);

                        if (res.ok && data.ok) {
                            // рџ”Ґ РќР• СЃРѕС…СЂР°РЅСЏРµРј РґР°РЅРЅС‹Рµ РґР»СЏ Р°РІС‚РѕР·Р°РіСЂСѓР·РєРё - РїСЂРѕСЃС‚Рѕ РІС…РѕРґРёРј
                            setLoggedUser({ username: data.username, role: data.role });
                            ov.remove();
                            window.location.reload();
                        } else {
                            // РџРѕРєР°Р·С‹РІР°РµРј РѕС€РёР±РєСѓ
                            if (data.error === 'not_subscribed') {
                                alert('вќ— Р”Р»СЏ РІС…РѕРґР° РЅРµРѕР±С…РѕРґРёРјРѕ РїРѕРґРїРёСЃР°С‚СЊСЃСЏ РЅР° РєР°РЅР°Р»:\n' + TELEGRAM_CHANNEL_ID);
                            } else {
                                alert('РћС€РёР±РєР° Р°РІС‚РѕСЂРёР·Р°С†РёРё: ' + (data.error || 'РќРµРёР·РІРµСЃС‚РЅР°СЏ РѕС€РёР±РєР°'));
                            }
                        }
                    } catch (e) {
                        console.error('[TG Auth] Error:', e);
                        alert('РћС€РёР±РєР° Р°РІС‚РѕСЂРёР·Р°С†РёРё: ' + e.message);
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

                        // Local auth only (Р»РѕРєР°Р»СЊРЅС‹Р№ СЃРµСЂРІРµСЂ)
                        try {
                            // РџСЂРѕР±СѓРµРј РІРѕР№С‚Рё С‡РµСЂРµР· Р»РѕРєР°Р»СЊРЅС‹Р№ API
                            const loginRes = await fetch(`${BACKEND_URL} /api/login`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ username: u, password: p })
                            });

                            if (loginRes.ok) {
                                const loginData = await loginRes.json();
                                if (loginData.ok) {
                                    // РЎРѕС…СЂР°РЅСЏРµРј username/password РґР»СЏ РїРѕСЃР»РµРґСѓСЋС‰РµР№ Р·Р°РіСЂСѓР·РєРё РґР°РЅРЅС‹С…
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
                            // РЎРѕС…СЂР°РЅСЏРµРј credentials РґР»СЏ Р°РІС‚РѕР·Р°РіСЂСѓР·РєРё
                            if (remember) {
                                localStorage.setItem('qaUsername', u);
                                localStorage.setItem('qaPassword', p);
                            }
                            ov.remove();
                        } else {
                            alert('РќРµРІРµСЂРЅС‹Р№ Р»РѕРіРёРЅ РёР»Рё РїР°СЂРѕР»СЊ');
                        }
                    } catch {
                        alert('РћС€РёР±РєР° РІС…РѕРґР°');
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
                    <div style="font-weight:600;margin-bottom:10px">Р”РѕР±Р°РІРёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ</div>
                    <div style="display:flex;flex-direction:column;gap:8px">
                        <input id="new-username" placeholder="Р›РѕРіРёРЅ" style="padding:8px;border-radius:6px;border:1px solid #444;background:#1f1f1f;color:#fff"/>
                        <input id="new-password" placeholder="РџР°СЂРѕР»СЊ" type="password" style="padding:8px;border-radius:6px;border:1px solid #444;background:#1f1f1f;color:#fff"/>
                        <select id="new-role" style="padding:8px;border-radius:6px;border:1px solid #444;background:#1f1f1f;color:#fff">
                            <option value="user">РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ</option>
                            <option value="editor">Р РµРґР°РєС‚РѕСЂ</option>
                            <option value="admin">РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ</option>
                        </select>
                        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">
                            <button id="admin-cancel" style="padding:8px 12px;border-radius:6px;border:1px solid #555;background:#1f1f1f;color:#fff">РћС‚РјРµРЅР°</button>
                            <button id="admin-add" style="padding:8px 12px;border-radius:6px;border:1px solid #3b82f6;background:#3b82f6;color:#fff">Р”РѕР±Р°РІРёС‚СЊ</button>
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
                    if (!u || !p) { alert('Р›РѕРіРёРЅ Рё РїР°СЂРѕР»СЊ РѕР±СЏР·Р°С‚РµР»СЊРЅС‹'); return; }
                    const client = window.__supabaseClient;
                    (async () => {
                        if (client) {
                            try {
                                const { error } = await client.from('users').upsert({ username: u, password: p, role: r }, { onConflict: 'username' });
                                if (error) throw error;
                                ov.remove();
                                alert('РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РґРѕР±Р°РІР»РµРЅ');
                                return;
                            } catch { }
                        }
                        const raw = localStorage.getItem('usersDB') || '[]';
                        let users = [];
                        try { users = JSON.parse(raw); } catch { }
                        if (users.find(x => x.username === u)) { alert('РўР°РєРѕР№ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚'); return; }
                        users.push({ username: u, password: p, role: r });
                        localStorage.setItem('usersDB', JSON.stringify(users));
                        ov.remove();
                        alert('РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РґРѕР±Р°РІР»РµРЅ');
                    })();
                });
            }
        }

        function openCloudOverview() {
            const client = window.__supabaseClient;
            if (!client) { alert('Supabase РЅРµРґРѕСЃС‚СѓРїРµРЅ'); return; }
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
                        <div style="font-weight:600">Supabase РґР°РЅРЅС‹Рµ</div>
                        <button id="cloud-close" style="padding:6px 10px;border:1px solid #444;background:#111;color:#ddd;border-radius:6px">Р—Р°РєСЂС‹С‚СЊ</button>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                        <div>
                            <div style="font-weight:600;margin-bottom:6px">РџРѕР»СЊР·РѕРІР°С‚РµР»Рё</div>
                            <div id="cloud-users" style="max-height:260px;overflow:auto;border:1px solid #333;border-radius:6px;padding:8px"></div>
                        </div>
                        <div>
                            <div style="font-weight:600;margin-bottom:6px">Р”РѕСЃС‚РёР¶РµРЅРёСЏ (daily_stats)</div>
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
            usersEl.textContent = 'Р—Р°РіСЂСѓР·РєР°...';
            statsEl.textContent = 'Р—Р°РіСЂСѓР·РєР°...';
            client.from('users').select('*').then(({ data, error }) => {
                if (error) { usersEl.textContent = 'РћС€РёР±РєР°'; return; }
                usersEl.innerHTML = (data || []).map(u => `< div > ${u.username} вЂў СЂРѕР»СЊ: ${u.role || 'user'}</div > `).join('') || '<div>РџСѓСЃС‚Рѕ</div>';
            }).catch(() => { usersEl.textContent = 'РћС€РёР±РєР°'; });
            const loadStats = () => {
                client.from('daily_stats').select('*').order('date', { ascending: false }).limit(50).then(({ data, error }) => {
                    if (error) { statsEl.textContent = 'РћС€РёР±РєР°'; return; }
                    const list = data || [];
                    const hasDevices = list.some(s => String(s.user_id || '').startsWith('device_'));
                    const btn = document.createElement('button');
                    btn.textContent = 'РџСЂРёРІСЏР·Р°С‚СЊ device_* Рє С‚РµРєСѓС‰РµРјСѓ РїРѕР»СЊР·РѕРІР°С‚РµР»СЋ';
                    btn.style.cssText = 'margin-bottom:8px;padding:6px 10px;border:1px solid #444;background:#111;color:#ddd;border-radius:6px';
                    statsEl.innerHTML = '';
                    if (hasDevices) {
                        statsEl.appendChild(btn);
                        btn.addEventListener('click', async () => {
                            btn.disabled = true;
                            btn.textContent = 'РњРёРіСЂР°С†РёСЏ...';
                            let result = null;
                            try { result = await migrateDeviceRecordsToUser(); } catch { }
                            btn.disabled = false;
                            const d = (result && typeof result.daily === 'number') ? result.daily : 0;
                            const c = (result && typeof result.cards === 'number') ? result.cards : 0;
                            window.__cloudLastMigration = { daily: d, cards: c, at: Date.now() };
                            btn.textContent = `Р“РѕС‚РѕРІРѕ: РґРѕСЃС‚РёР¶РµРЅРёСЏ ${d}, РєР°СЂС‚РѕС‡РєРё ${c} `;
                            setTimeout(() => { btn.textContent = 'РџСЂРёРІСЏР·Р°С‚СЊ device_* Рє С‚РµРєСѓС‰РµРјСѓ РїРѕР»СЊР·РѕРІР°С‚РµР»СЋ'; }, 1800);
                            loadStats();
                        });
                    }
                    if (window.__cloudLastMigration && typeof window.__cloudLastMigration.daily === 'number') {
                        const info = document.createElement('div');
                        info.style.cssText = 'margin:6px 0;padding:6px 10px;border:1px solid #444;background:#222;color:#ddd;border-radius:6px';
                        info.textContent = `РџРѕСЃР»РµРґРЅСЏСЏ РјРёРіСЂР°С†РёСЏ: РґРѕСЃС‚РёР¶РµРЅРёСЏ ${window.__cloudLastMigration.daily}, РєР°СЂС‚РѕС‡РєРё ${window.__cloudLastMigration.cards} `;
                        statsEl.appendChild(info);
                        // РѕС‡РёСЃС‚РёС‚СЊ С‡РµСЂРµР· РєРѕСЂРѕС‚РєРѕРµ РІСЂРµРјСЏ, С‡С‚РѕР±С‹ РЅРµ РјРµС€Р°Р»Рѕ
                        setTimeout(() => { try { delete window.__cloudLastMigration; } catch { } }, 2500);
                    }
                    const rows = list.map(s => `< div > ${s.user_id} вЂў ${s.date} вЂў xp:${s.xp} вЂў Р±РѕРЅСѓСЃ:${s.bonus} вЂў РґРµРЅСЊ:${s.day_bonus} вЂў СЃС‚СЂРёРє:${s.streak}</div > `).join('');
                    statsEl.innerHTML += rows || '<div>РџСѓСЃС‚Рѕ</div>';
                }).catch(() => { statsEl.textContent = 'РћС€РёР±РєР°'; });
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
        // Р¤СѓРЅРєС†РёРё РјРµРЅСЋ РєР°С‚РµРіРѕСЂРёР№ РІ СЂРµР¶РёРјРµ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ
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
                btn.title = 'РњРµРЅСЋ РєР°С‚РµРіРѕСЂРёРё';
                btn.textContent = 'в‹®';
                // РЎС‚РёР»Рё РїРµСЂРµРЅРµСЃРµРЅС‹ РІ CSS
                tab.appendChild(btn);
                btn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    openCategoryMenu(tab, cId);
                });
            });
        }

        // РџРµСЂРµСЂРёСЃРѕРІРєР° С‚Р°Р±РѕРІ РєР°С‚РµРіРѕСЂРёР№
        function refreshCategoriesTabs(oldName = null, newName = null) {
            // рџ”Ґ РћР±РЅРѕРІР»СЏРµРј categories РёР· Р°РєС‚СѓР°Р»СЊРЅС‹С… РґР°РЅРЅС‹С…
            categories = buildCategoriesFromData(getRuntimeData());

            const active = tabsContainer.querySelector('.tab.active');
            const activeId = active?.dataset?.category || 'all';
            tabsContainer.innerHTML = '';
            const allTab = document.createElement('div');
            allTab.className = 'tab';
            allTab.dataset.category = 'all';
            allTab.textContent = 'Р’СЃРµ РІРѕРїСЂРѕСЃС‹';
            tabsContainer.appendChild(allTab);
            const favTab = document.createElement('div');
            favTab.className = 'tab';
            favTab.dataset.category = 'favorites';
            favTab.textContent = 'в…';
            tabsContainer.appendChild(favTab);
            const cats = buildCategoriesFromData(getRuntimeData());
            // РџСЂРёРјРµРЅСЏРµРј СЃРѕС…СЂР°РЅС‘РЅРЅС‹Р№ РїРѕСЂСЏРґРѕРє РєР°С‚РµРіРѕСЂРёР№, РµСЃР»Рё РѕРЅ РµСЃС‚СЊ
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
            // Р’РѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµРј Р°РєС‚РёРІРЅС‹Р№ С‚Р°Р±, РµСЃР»Рё РІРѕР·РјРѕР¶РЅРѕ
            const toActivate = tabsContainer.querySelector(`.tab[data-category="${activeId}"]`) || allTab;
            toActivate.classList.add('active');
            // РћР±РЅРѕРІР»СЏРµРј РјРµРЅСЋ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ
            refreshCategoryEditMenus();
            // Р’РєР»СЋС‡Р°РµРј РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРµ РєР°С‚РµРіРѕСЂРёР№ РІ СЂРµР¶РёРјРµ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ
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
                            setSaveStatus('saving', 'РЎРѕС…СЂР°РЅРµРЅРёРµ РїРѕСЂСЏРґРєР° РєР°С‚РµРіРѕСЂРёР№...');
                            const meta = await getServerMetadata();
                            meta.categoryOrder = names;
                            const ok = await updateServerMetadata(meta);
                            setSaveStatus(ok ? 'success' : 'error', ok ? 'РџРѕСЂСЏРґРѕРє СЃРѕС…СЂР°РЅС‘РЅ' : 'РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ');
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
            < button data - act="rename" > РџРµСЂРµРёРјРµРЅРѕРІР°С‚СЊ</button >
            <button data-act="duplicate">Р”СѓР±Р»РёСЂРѕРІР°С‚СЊ</button>
            <button data-act="delete">РЈРґР°Р»РёС‚СЊ</button>
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
                    const newName = prompt('РќРѕРІРѕРµ РЅР°Р·РІР°РЅРёРµ РєР°С‚РµРіРѕСЂРёРё:', catObj.name);
                    if (newName && newName !== catObj.name) {
                        const ov = getOverrides();
                        uniqueQaData.forEach(it => { if (it.category === catObj.name) { ov[it.question] = { ...ov[it.question], category: newName }; } });
                        setLS('qaAdminOverrides', ov);
                        // РђРІС‚РѕСЃРѕС…СЂР°РЅРµРЅРёРµ
                        saveMergedToServer();
                        // РџРµСЂРµСЂРёСЃРѕРІС‹РІР°РµРј С‚Р°Р±С‹, С‡С‚РѕР±С‹ СЃСЂР°Р·Сѓ СѓРІРёРґРµС‚СЊ РЅРѕРІРѕРµ РёРјСЏ
                        refreshCategoriesTabs(catObj.name, newName);
                        setSaveStatus('success', 'РљР°С‚РµРіРѕСЂРёСЏ РїРµСЂРµРёРјРµРЅРѕРІР°РЅР°');
                    }
                } else if (act === 'duplicate') {
                    const dupName = prompt('РќР°Р·РІР°РЅРёРµ РєРѕРїРёРё РєР°С‚РµРіРѕСЂРёРё:', `${catObj.name} (РєРѕРїРёСЏ)`);
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
                    // РџРµСЂРµСЂРёСЃРѕРІС‹РІР°РµРј С‚Р°Р±С‹, С‡С‚РѕР±С‹ СЃСЂР°Р·Сѓ РїРѕСЏРІРёР»Р°СЃСЊ РЅРѕРІР°СЏ РєР°С‚РµРіРѕСЂРёСЏ
                    refreshCategoriesTabs();
                    setSaveStatus('success', 'РљР°С‚РµРіРѕСЂРёСЏ РґСѓР±Р»РёСЂРѕРІР°РЅР°');
                } else if (act === 'delete') {
                    if (!confirm('РЈРґР°Р»РёС‚СЊ РєР°С‚РµРіРѕСЂРёСЋ РІ РєРѕСЂР·РёРЅСѓ?')) return;
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
                    setSaveStatus('success', 'РљР°С‚РµРіРѕСЂРёСЏ СѓРґР°Р»РµРЅР° РІ РєРѕСЂР·РёРЅСѓ');
                }
                menu.remove();
            });
        }

        // РњРµРЅСЋ РїРѕРґРєР°С‚РµРіРѕСЂРёР№ РІ СЂРµР¶РёРјРµ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ
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
                btn.title = 'РњРµРЅСЋ РїРѕРґРєР°С‚РµРіРѕСЂРёРё';
                btn.textContent = 'в‹®';
                btn.style.marginLeft = '8px';
                // РўС‘РјРЅРѕ-СЃРµСЂС‹Р№ СЃС‚РёР»СЊ
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
            < button data - act="rename" > РџРµСЂРµРёРјРµРЅРѕРІР°С‚СЊ</button >
            <button data-act="duplicate">Р”СѓР±Р»РёСЂРѕРІР°С‚СЊ</button>
            <button data-act="delete">РЈРґР°Р»РёС‚СЊ</button>
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
                    const newName = prompt('РќРѕРІРѕРµ РЅР°Р·РІР°РЅРёРµ РїРѕРґРєР°С‚РµРіРѕСЂРёРё:', subcatName);
                    if (newName && newName !== subcatName) {
                        const scPlaceholders = getSubcategoryPlaceholders();
                        if (!scPlaceholders[categoryName]) scPlaceholders[categoryName] = {};
                        scPlaceholders[categoryName][subcatName] = { displayName: newName };
                        setSubcategoryPlaceholders(scPlaceholders);
                        // РћР±РЅРѕРІР»СЏРµРј РІСЃРµ РєР°СЂС‚РѕС‡РєРё СЌС‚РѕР№ РїРѕРґРєР°С‚РµРіРѕСЂРёРё С‡РµСЂРµР· overrides
                        const ov = getOverrides();
                        getRuntimeData().forEach(it => {
                            if (it.category === categoryName && it.subcategory === subcatName) {
                                ov[it.question] = { ...ov[it.question], subcategory: newName };
                            }
                        });
                        setLS('qaAdminOverrides', ov);
                        rebuildSubcategoriesForCategory(categoryName);
                        saveMergedToServer();
                        setSaveStatus('success', 'РџРѕРґРєР°С‚РµРіРѕСЂРёСЏ РїРµСЂРµРёРјРµРЅРѕРІР°РЅР°');
                    }
                } else if (act === 'duplicate') {
                    const dupName = prompt('РќР°Р·РІР°РЅРёРµ РєРѕРїРёРё РїРѕРґРєР°С‚РµРіРѕСЂРёРё:', `${subcatName} (РєРѕРїРёСЏ)`);
                    if (!dupName) return;
                    const newItemsArr = getNewItems();
                    getRuntimeData().filter(it => it.category === categoryName && it.subcategory === subcatName)
                        .forEach(it => {
                            const newQuestion = genUniqueQuestionGlobal(it.question);
                            newItemsArr.push({ ...it, subcategory: dupName, question: newQuestion });
                        });
                    setLS('qaNewItems', newItemsArr);
                    // Р”РѕР±Р°РІР»СЏРµРј РїР»РµР№СЃС…РѕР»РґРµСЂ РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ
                    const scPlaceholders = getSubcategoryPlaceholders();
                    if (!scPlaceholders[categoryName]) scPlaceholders[categoryName] = {};
                    scPlaceholders[categoryName][dupName] = { displayName: dupName };
                    setSubcategoryPlaceholders(scPlaceholders);

                    // Force full refresh to ensure data visibility
                    refreshCategoriesTabs();
                    rebuildSubcategoriesForCategory(categoryName);

                    saveMergedToServer();
                    setSaveStatus('success', 'РџРѕРґРєР°С‚РµРіРѕСЂРёСЏ РґСѓР±Р»РёСЂРѕРІР°РЅР°');
                } else if (act === 'delete') {
                    if (!confirm('РЈРґР°Р»РёС‚СЊ РїРѕРґРєР°С‚РµРіРѕСЂРёСЋ РІ РєРѕСЂР·РёРЅСѓ?')) { menu.remove(); return; }
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
                    setSaveStatus('success', 'РџРѕРґРєР°С‚РµРіРѕСЂРёСЏ СѓРґР°Р»РµРЅР° РІ РєРѕСЂР·РёРЅСѓ');
                }
                menu.remove();
            });
        }

        // РџРµСЂРµСЃС‚СЂРѕРёС‚СЊ СЃРїРёСЃРѕРє РїРѕРґРєР°С‚РµРіРѕСЂРёР№ РґР»СЏ РІС‹Р±СЂР°РЅРЅРѕР№ РєР°С‚РµРіРѕСЂРёРё
        function rebuildSubcategoriesForCategory(categoryName) {
            const allCats = buildCategoriesFromData(getRuntimeData());
            const catObj = allCats.find(c => c.name === categoryName);
            if (!catObj) return;
            subcategoriesContainer.style.display = 'flex';
            subcategoriesContainer.innerHTML = '';
            const allCard = document.createElement('div');
            allCard.className = 'subcategory-card active';
            allCard.dataset.subcategory = 'all';
            allCard.textContent = 'Р’СЃРµ РїРѕРґРєР°С‚РµРіРѕСЂРёРё';
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
                            setSaveStatus('saving', 'РЎРѕС…СЂР°РЅРµРЅРёРµ РїРѕСЂСЏРґРєР° РїРѕРґРєР°С‚РµРіРѕСЂРёР№...');
                            const meta = await getServerMetadata();
                            meta.subcategoryOrder = meta.subcategoryOrder || {};
                            meta.subcategoryOrder[categoryName] = names;
                            const ok = await updateServerMetadata(meta);
                            setSaveStatus(ok ? 'success' : 'error', ok ? 'РџРѕСЂСЏРґРѕРє СЃРѕС…СЂР°РЅС‘РЅ' : 'РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ');
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
            catDiv.innerHTML = '<div><strong>РљР°С‚РµРіРѕСЂРёРё:</strong></div><div>РџСѓСЃС‚Рѕ</div>';
            // РЎРїРёСЃРѕРє СѓРґР°Р»С‘РЅРЅС‹С… РІРѕРїСЂРѕСЃРѕРІ + СЃРѕСЂС‚РёСЂРѕРІРєР° РїРѕ РѕСЂРёРіРёРЅР°Р»СЊРЅРѕРјСѓ РїРѕСЂСЏРґРєСѓ ("Р’СЃРµ РІРѕРїСЂРѕСЃС‹")
            const deletedCards = serverTrashItems.map(t => t.item?.question).filter(Boolean);
            const baseOrder = getOrderForContext('all') || getRuntimeData().map(i => i.question);
            const idxMap = new Map(baseOrder.map((q, i) => [q, i]));
            const sortedTrash = [...serverTrashItems].sort((a, b) =>
                (idxMap.get(a.item?.question) ?? 1e9) - (idxMap.get(b.item?.question) ?? 1e9)
            );
            // Header + grid container
            cardDiv.innerHTML = '';
            const header = document.createElement('div');
            header.innerHTML = '<strong>РљР°СЂС‚РѕС‡РєРё:</strong>' + (deletedCards.length ? '' : ' <span>РџСѓСЃС‚Рѕ</span>');
            cardDiv.appendChild(header);
            const grid = document.createElement('div');
            grid.className = 'trash-cards-grid';
            cardDiv.appendChild(grid);

            sortedTrash.forEach(entry => {
                const q = entry.item?.question;
                const it = entry.item || uniqueQaData.find(i => i.question === q) || getNewItems().find(i => i.question === q);
                const mini = document.createElement('div');
                mini.className = 'result-item trash-mini';

                // Р’РµСЂС…РЅСЏСЏ Р·РѕРЅР°: С‚РµРіРё (РєР°С‚РµРіРѕСЂРёСЏ, РїРѕРґРєР°С‚РµРіРѕСЂРёСЏ)
                const meta = document.createElement('div');
                meta.className = 'trash-meta';
                meta.style.display = 'flex';
                meta.style.flexWrap = 'wrap';
                meta.style.gap = '6px';
                const catBadge = document.createElement('span'); catBadge.className = 'category-badge'; catBadge.textContent = (it && it.category) ? it.category : '';
                const subBadge = document.createElement('span'); subBadge.className = 'subcategory-badge'; subBadge.textContent = (it && it.subcategory) ? it.subcategory : '';
                meta.appendChild(catBadge); meta.appendChild(subBadge);

                // Р’РѕРїСЂРѕСЃ - РїСЂРёРјРµРЅСЏРµРј С„РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµ
                const qText = document.createElement('div');
                qText.className = 'question';
                const questionFormatting = it?.formatting?.question || [];
                qText.innerHTML = applyFormatting(it?.question || q, questionFormatting);
                qText.style.marginTop = '6px';

                // РћС‚РІРµС‚ - РїСЂРёРјРµРЅСЏРµРј С„РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµ
                const aEl = document.createElement('div');
                aEl.className = 'answer';
                const answerFormatting = it?.formatting?.answer || [];
                aEl.innerHTML = applyFormatting(it?.answer || '', answerFormatting);
                aEl.style.marginTop = '6px';

                // Р”РµР№СЃС‚РІРёСЏ (РІРѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ / СѓРґР°Р»РёС‚СЊ РЅР°РІСЃРµРіРґР°) РІРЅРёР·Сѓ
                const actions = document.createElement('div');
                actions.className = 'trash-actions';
                actions.style.display = 'flex';
                actions.style.gap = '8px';
                actions.style.marginTop = '8px';
                const restoreBtn = document.createElement('button'); restoreBtn.className = 'restore-btn'; restoreBtn.textContent = 'Р’РѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ';
                const purgeBtn = document.createElement('button'); purgeBtn.className = 'purge-btn'; purgeBtn.textContent = 'РЈРґР°Р»РёС‚СЊ РЅР°РІСЃРµРіРґР°';
                actions.appendChild(restoreBtn);
                actions.appendChild(purgeBtn);

                mini.appendChild(meta);
                mini.appendChild(qText);
                mini.appendChild(aEl);
                mini.appendChild(actions);

                // РћРїС‚РёРјРёСЃС‚РёС‡РЅРѕРµ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ СЃ СЃРѕС…СЂР°РЅРµРЅРёРµРј РЅР° СЃРµСЂРІРµСЂ
                restoreBtn.addEventListener('click', async () => {
                    restoreBtn.textContent = 'Р’РѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ...'; restoreBtn.disabled = true;

                    // РќР°С…РѕРґРёРј РєР°СЂС‚РѕС‡РєСѓ РІ serverTrashItems, С‡С‚РѕР±С‹ РїРѕР»СѓС‡РёС‚СЊ РµС‘ РґР°РЅРЅС‹Рµ
                    const trashItem = serverTrashItems.find(t => t.item?.question === q);
                    const itemData = trashItem?.item;

                    // РЈРґР°Р»СЏРµРј РёР· Р»РѕРєР°Р»СЊРЅРѕРіРѕ РєСЌС€Р° РєРѕСЂР·РёРЅС‹ СЃСЂР°Р·Сѓ
                    serverTrashSet.delete(q);
                    serverTrashItems = serverTrashItems.filter(t => t.item?.question !== q);
                    // РћС‡РёС‰Р°РµРј Р»РѕРєР°Р»СЊРЅСѓСЋ РєР°СЂС‚Сѓ СѓРґР°Р»РµРЅРёР№ РґР»СЏ СЌС‚РѕР№ РєР°СЂС‚РѕС‡РєРё, РµСЃР»Рё Р±С‹Р»Р° РїРѕРјРµС‡РµРЅР°
                    const delMap = getDeletedItems();
                    if (delMap && delMap[q]) { delete delMap[q]; setDeletedItems(delMap); }

                    // рџ”Ґ Р’РђР–РќРћ: Р•СЃР»Рё РєР°СЂС‚РѕС‡РєРё РЅРµС‚ РІ uniqueQaData (РґСѓР±Р»РёРєР°С‚), РґРѕР±Р°РІР»СЏРµРј РµС‘ РІ qaNewItems
                    const isInUnique = !!uniqueQaData.find(i => i.question === q);
                    if (!isInUnique && itemData) {
                        const newItems = getNewItems();
                        // РџСЂРѕРІРµСЂСЏРµРј, РЅРµС‚ Р»Рё СѓР¶Рµ С‚Р°РєРѕР№ РєР°СЂС‚РѕС‡РєРё РІ newItems
                        if (!newItems.some(n => n.question === q)) {
                            newItems.push(itemData);
                            localStorage.setItem('qaNewItems', JSON.stringify(newItems));
                        }
                    }

                    // рџ”Ґ Р’РћР—Р’Р РђР©РђР•Рњ РєР°СЂС‚РѕС‡РєСѓ РІ qaUserCards РµСЃР»Рё РѕРЅР° Р±С‹Р»Р° СѓРґР°Р»РµРЅР°
                    const userCards = getQaUserCards();
                    if (userCards && !userCards.some(c => c.question === q) && itemData) {
                        // РС‰РµРј РїРѕР·РёС†РёСЋ РіРґРµ Р±С‹Р»Р° РєР°СЂС‚РѕС‡РєР° (РїРѕ РёРЅРґРµРєСЃСѓ РІ serverTrashItems)
                        const trashIndex = serverTrashItems.findIndex(t => t.item?.question === q);
                        if (trashIndex >= 0) {
                            // Р’СЃС‚Р°РІР»СЏРµРј РЅР° РїСЂРёРјРµСЂРЅСѓСЋ РїРѕР·РёС†РёСЋ
                            userCards.push(itemData);
                            setQaUserCards(userCards);
                        }
                    }

                    renderTrashPanel();
                    // РћР±РЅРѕРІР»СЏРµРј Р±РµР· СЃР±СЂРѕСЃР° РєРѕРЅС‚РµРєСЃС‚Р°
                    refreshCurrentContext();
                    // РџС‹С‚Р°РµРјСЃСЏ РІРѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ РЅР° СЃРµСЂРІРµСЂРµ
                    let restoreOk = false;
                    try { restoreOk = await restoreFromServerTrash([q]); } catch (_) { restoreOk = false; }
                    if (!restoreOk) {
                        // РћР±РЅРѕРІР»СЏРµРј РєРѕСЂР·РёРЅСѓ СЃ СЃРµСЂРІРµСЂР° РЅР° СЃР»СѓС‡Р°Р№ СЂР°СЃСЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё
                        try { await refreshServerTrash(); } catch (_) { }
                        setSaveStatus('error', 'РЎРµСЂРІРµСЂ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ РЅРµРґРѕСЃС‚СѓРїРµРЅ');
                        restoreBtn.textContent = 'Р’РѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ'; restoreBtn.disabled = false;
                    } else {
                        // РљР°СЂС‚РѕС‡РєР° СѓР¶Рµ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅР°
                        setSaveStatus('success', 'РљР°СЂС‚РѕС‡РєР° РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅР°');
                        restoreBtn.textContent = 'Р“РѕС‚РѕРІРѕ'; setTimeout(() => { restoreBtn.textContent = 'Р’РѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ'; restoreBtn.disabled = false; }, 1500);
                    }
                });

                // РћРєРѕРЅС‡Р°С‚РµР»СЊРЅРѕРµ СѓРґР°Р»РµРЅРёРµ
                purgeBtn.addEventListener('click', async () => {
                    purgeBtn.textContent = 'РЈРґР°Р»РµРЅРёРµ...'; purgeBtn.disabled = true;

                    // рџ”’ РџРѕР»СѓС‡Р°РµРј username
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
                            // РЈРґР°Р»СЏРµРј РёР· СЃРµСЂРІРµСЂРЅРѕР№ РєРѕСЂР·РёРЅС‹ Рё Р»РѕРєР°Р»СЊРЅС‹С… РєСЌС€РµР№
                            serverTrashSet.delete(q);
                            serverTrashItems = serverTrashItems.filter(t => t.item?.question !== q);
                            // РџРѕРјРµС‡Р°РµРј РєР°Рє СѓРґР°Р»С‘РЅРЅС‹Р№ Р»РѕРєР°Р»СЊРЅРѕ
                            const delMap = getDeletedItems(); delMap[q] = true; setDeletedItems(delMap);
                            // Р•СЃР»Рё РєР°СЂС‚РѕС‡РєР° Р±С‹Р»Р° СЃСЂРµРґРё РЅРѕРІС‹С…, СѓРґР°Р»РёРј РµС‘
                            const newArr = getNewItems().filter(i => i.question !== q); setLS('qaNewItems', newArr);

                            // рџ”’ РћР±РЅРѕРІР»СЏРµРј localStorage СЃ РєРѕСЂР·РёРЅРѕР№
                            const localTrash = localStorage.getItem('qaUserTrash');
                            if (localTrash) {
                                const trash = JSON.parse(localTrash);
                                const newTrash = trash.filter(t => t.item?.question !== q);
                                localStorage.setItem('qaUserTrash', JSON.stringify(newTrash));
                            }

                            // РћР±РЅРѕРІР»СЏРµРј UI
                            renderTrashPanel();
                            refreshCurrentContext();
                            try { await saveMergedToServer(); } catch { }
                            setSaveStatus('success', 'РљР°СЂС‚РѕС‡РєР° СѓРґР°Р»РµРЅР° РЅР°РІСЃРµРіРґР°');
                        } else {
                            const error = await resp.text();
                            console.error('[delete-permanent] РћС€РёР±РєР°:', resp.status, error);
                            setSaveStatus('error', 'РћС€РёР±РєР°: ' + error);
                        }
                    } catch (e) {
                        console.error('[delete-permanent] РћС€РёР±РєР°:', e);
                        setSaveStatus('error', 'РЎРµСЂРІРµСЂ СѓРґР°Р»РµРЅРёСЏ РЅРµРґРѕСЃС‚СѓРїРµРЅ');
                    }
                    purgeBtn.textContent = 'РЈРґР°Р»РёС‚СЊ РЅР°РІСЃРµРіРґР°'; purgeBtn.disabled = false;
                });

                grid.appendChild(mini);
            });
        }

        // РЈРґР°Р»РµРЅР° СЃС‚Р°СЂР°СЏ Р»РѕРіРёРєР° РІС‚РѕСЂРѕРіРѕ РјРѕРґР°Р»СЊРЅРѕРіРѕ РѕРєРЅР° РІС…РѕРґР°

        editToggleBtn.addEventListener('click', () => {
            editMode = !editMode;

            // рџ”Ґ РџРµСЂРµРєР»СЋС‡Р°РµРј РІРёР·СѓР°Р»СЊРЅС‹Р№ СЃС‚РёР»СЊ РєРЅРѕРїРєРё
            if (editMode) {
                editToggleBtn.classList.add('on');
                editToggleBtn.title = 'Р’С‹РєР»СЋС‡РёС‚СЊ СЂРµР¶РёРј СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ';
            } else {
                editToggleBtn.classList.remove('on');
                editToggleBtn.title = 'Р’РєР»СЋС‡РёС‚СЊ СЂРµР¶РёРј СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ';
            }

            // Р’ СЂРµР¶РёРјРµ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ РѕС‚РєР»СЋС‡Р°РµРј Р°РІС‚Рѕ-РЅРѕСЂРјР°Р»РёР·Р°С†РёСЋ РєР°С‚РµРіРѕСЂРёР№ РїСЂРё Р·Р°РіСЂСѓР·РєРµ
            try { setNormalizationDisabled(editMode); } catch { }
            // РџРѕР·РёС†РёСЏ РєРЅРѕРїРѕРє вњЋ Рё Р’С…РѕРґ РќР• РјРµРЅСЏРµС‚СЃСЏ вЂ” РѕСЃС‚Р°СЋС‚СЃСЏ РЅР°Рґ РєР°С‚РµРіРѕСЂРёСЏРјРё
            // РџРѕРєР°Р·Р°С‚СЊ/СЃРєСЂС‹С‚СЊ РїР°РЅРµР»СЊ РєРѕСЂР·РёРЅС‹ Рё РїРµСЂРµРЅРµСЃС‚Рё РµС‘ РІ Р»РµРІСѓСЋ Р±РѕРєРѕРІСѓСЋ РїР°РЅРµР»СЊ
            const sidebar = document.querySelector('.sidebar');
            const sidebarButtons = sidebar ? sidebar.querySelector('.sidebar-mode-buttons') : null;
            const searchHistory = sidebar ? sidebar.querySelector('#search-history') : null;
            if (editMode) {
                if (sidebar) sidebar.classList.remove('collapsed'); // РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРё СЂР°Р·РІРѕСЂР°С‡РёРІР°РµРј РїСЂРё РІРєР»СЋС‡РµРЅРёРё СЂРµР¶РёРјР°
                trashPanel.style.display = 'block';
                // РґРѕР±Р°РІРёС‚СЊ РєРІР°РґСЂР°С‚ СЃ РёРєРѕРЅРєРѕР№ РјСѓСЃРѕСЂРЅРѕРіРѕ РІРµРґСЂР° РІ Р·Р°РіРѕР»РѕРІРѕРє Р±РѕРєРѕРІРѕР№ РїР°РЅРµР»Рё
                if (sidebarButtons && !sidebarButtons.querySelector('#trash-mode-button')) {
                    const trashBtn = document.createElement('button');
                    trashBtn.id = 'trash-mode-button';
                    trashBtn.title = 'РљРѕСЂР·РёРЅР°';
                    trashBtn.setAttribute('aria-label', 'РљРѕСЂР·РёРЅР°');
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
                // РїРµСЂРµРЅРµСЃС‚Рё СЃР°РјСѓ РїР°РЅРµР»СЊ РєРѕСЂР·РёРЅС‹ РІ Р»РµРІСѓСЋ РїР°РЅРµР»СЊ, СЃСЂР°Р·Сѓ РїРѕРґ Р·Р°РіРѕР»РѕРІРєРѕРј
                if (sidebar && searchHistory) {
                    try { sidebar.insertBefore(trashPanel, searchHistory); } catch { }
                }
                container.classList.add('edit-mode');
            } else {
                trashPanel.style.display = 'none';
                // СѓР±СЂР°С‚СЊ РёРЅРґРёРєР°С‚РѕСЂ РєРѕСЂР·РёРЅС‹ РёР· Р·Р°РіРѕР»РѕРІРєР° Р±РѕРєРѕРІРѕР№ РїР°РЅРµР»Рё
                const existingTrashBtn = sidebarButtons ? sidebarButtons.querySelector('#trash-mode-button') : null;
                if (existingTrashBtn) existingTrashBtn.remove();
                container.classList.remove('edit-mode');
            }
            try { localStorage.setItem('qaEditMode', editMode ? 'true' : 'false'); } catch { }
            refreshCategoryEditMenus();
            // РћР±РЅРѕРІР»СЏРµРј РІРєР»Р°РґРєРё РєР°С‚РµРіРѕСЂРёР№, С‡С‚РѕР±С‹ РІРєР»СЋС‡РёС‚СЊ/РѕС‚РєР»СЋС‡РёС‚СЊ РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРµ
            refreshCategoriesTabs();
            renderTrashPanel();
            refreshCurrentContext();
        });

        // РћР±СЂР°Р±РѕС‚С‡РёРєРё РїР°РЅРµР»Рё СѓРїСЂР°РІР»РµРЅРёСЏ - СѓРґР°Р»РµРЅС‹ (legacy)


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
                statusEl.textContent = msg || 'РЎРѕС…СЂР°РЅРµРЅРёРµ...';
            } else if (state === 'success') {
                statusEl.style.display = 'block';
                statusEl.style.background = 'rgba(29, 95, 42, 0.9)'; // Р—РµР»РµРЅС‹Р№ С„РѕРЅ
                statusEl.style.color = '#ffffff';
                statusEl.style.border = '1px solid #2a6b2a';
                statusEl.textContent = msg || 'РЎРѕС…СЂР°РЅРµРЅРѕ';
                setTimeout(() => { statusEl.style.display = 'none'; }, 1500);
            } else if (state === 'error') {
                statusEl.style.display = 'block';
                statusEl.style.background = 'rgba(122, 26, 26, 0.9)'; // РљСЂР°СЃРЅС‹Р№ С„РѕРЅ
                statusEl.style.color = '#ffffff';
                statusEl.style.border = '1px solid #8b2a2a';
                statusEl.textContent = msg || 'РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ';
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
                // Р‘Р°Р·РѕРІС‹Рµ СЌР»РµРјРµРЅС‚С‹ + overrides
                uniqueQaData.forEach(item => {
                    if (deletedMap[item.question] || serverTrashSet.has(item.question)) return;
                    const ov = overrides[item.question];
                    const mergedItem = ov ? { ...item, ...ov } : item;
                    merged.push(mergedItem);
                    seen.add(item.question);
                });
                // РќРѕРІС‹Рµ СЌР»РµРјРµРЅС‚С‹ + РёС… РІРѕР·РјРѕР¶РЅС‹Рµ overrides
                newItems.forEach(n => {
                    if (!seen.has(n.question) && !deletedMap[n.question] && !serverTrashSet.has(n.question)) {
                        const ov = overrides[n.question];
                        merged.push(ov ? { ...n, ...ov } : n);
                        seen.add(n.question);
                    }
                });
                // РћС‚РїСЂР°РІРєР° РЅР° СЃРµСЂРІРµСЂ
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
                    // РЎРµСЂРІРµСЂ РјРѕРі РІРµСЂРЅСѓС‚СЊ РїСѓСЃС‚РѕР№ РѕС‚РІРµС‚ вЂ” РѕСЂРёРµРЅС‚РёСЂСѓРµРјСЃСЏ С‚РѕР»СЊРєРѕ РЅР° СЃС‚Р°С‚СѓСЃ
                }
                if (!ok) throw new Error('РЎРµСЂРІРµСЂ РІРµСЂРЅСѓР» РѕС€РёР±РєСѓ РїСЂРё СЃРѕС…СЂР°РЅРµРЅРёРё');

                // РЈСЃРїРµС€РЅРѕ СЃРѕС…СЂР°РЅРёР»Рё вЂ” СѓРІРµРґРѕРјР»СЏРµРј Рё РїСЂРёРЅСѓРґРёС‚РµР»СЊРЅРѕ РїРµСЂРµР·Р°РіСЂСѓР¶Р°РµРј РґР°РЅРЅС‹Рµ РёР· JSON
                setSaveStatus('success');
                // Р”Р°РґРёРј UI С‡СѓС‚СЊ РѕР±РЅРѕРІРёС‚СЊ СЃРѕСЃС‚РѕСЏРЅРёРµ, Р·Р°С‚РµРј РёРЅРёС†РёРёСЂСѓРµРј РїРµСЂРµР·Р°РіСЂСѓР·РєСѓ
                setTimeout(() => {
                    window.dispatchEvent(new Event('forceReloadData'));
                }, 50);
                return true;
            } catch (e) {
                console.error('Save failed:', e);
                setSaveStatus('error', 'РћС€РёР±РєР°: ' + e.message);
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
                // РџРѕР»СѓС‡Р°РµРј username РёР· СЃРµСЃСЃРёРё
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
            const name = prompt('РќР°Р·РІР°РЅРёРµ РЅРѕРІРѕР№ РєР°С‚РµРіРѕСЂРёРё:');
            if (!name) return;
            const placeholders = getCategoryPlaceholders();
            const id = Math.max(0, ...Object.values(placeholders).map(v => v._cid || 0)) + 1;
            if (!placeholders[name]) placeholders[name] = { _cid: id, sub: [] };
            setCategoryPlaceholders(placeholders);
            alert('РљР°С‚РµРіРѕСЂРёСЏ РґРѕР±Р°РІР»РµРЅР°. РџРѕСЏРІРёС‚СЃСЏ РІ РјРµРЅСЋ.');
        }
        function deleteCategoryFlow() {
            const name = prompt('РќР°Р·РІР°РЅРёРµ РєР°С‚РµРіРѕСЂРёРё РґР»СЏ СѓРґР°Р»РµРЅРёСЏ:');
            if (!name) return;
            if (!confirm(`РЈРґР°Р»РёС‚СЊ РєР°С‚РµРіРѕСЂРёСЋ "${name}" Рё РІСЃРµ РµС‘ РєР°СЂС‚РѕС‡РєРё?`)) return;
            const placeholders = getCategoryPlaceholders();
            delete placeholders[name];
            setCategoryPlaceholders(placeholders);
            const del = getDeletedItems();
            uniqueQaData.forEach(item => {
                if (item.category === name) del[item.question] = true;
            });
            setDeletedItems(del);
            alert('РљР°С‚РµРіРѕСЂРёСЏ РѕС‚РјРµС‡РµРЅР° РєР°Рє СѓРґР°Р»С‘РЅРЅР°СЏ. РЎРѕС…СЂР°РЅРёС‚Рµ, С‡С‚РѕР±С‹ РїСЂРёРјРµРЅРёС‚СЊ.');
        }
        function addSubcategoryFlow() {
            const cat = prompt('РљР°С‚РµРіРѕСЂРёСЏ:');
            if (!cat) return;
            const sub = prompt('РќР°Р·РІР°РЅРёРµ РЅРѕРІРѕР№ РїРѕРґРєР°С‚РµРіРѕСЂРёРё:');
            if (!sub) return;
            const placeholders = getCategoryPlaceholders();
            if (!placeholders[cat]) placeholders[cat] = { _cid: Date.now(), sub: [] };
            const id = Math.max(0, ...placeholders[cat].sub.map(s => s._sid || 0)) + 1;
            placeholders[cat].sub.push({ name: sub, _sid: id });
            setCategoryPlaceholders(placeholders);
            alert('РџРѕРґРєР°С‚РµРіРѕСЂРёСЏ РґРѕР±Р°РІР»РµРЅР°. РџРѕСЏРІРёС‚СЃСЏ РІ РјРµРЅСЋ.');
        }
        function deleteSubcategoryFlow() {
            const cat = prompt('РљР°С‚РµРіРѕСЂРёСЏ:');
            if (!cat) return;
            const sub = prompt('РџРѕРґРєР°С‚РµРіРѕСЂРёСЏ РґР»СЏ СѓРґР°Р»РµРЅРёСЏ:');
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
            alert('РџРѕРґРєР°С‚РµРіРѕСЂРёСЏ РѕС‚РјРµС‡РµРЅР° РєР°Рє СѓРґР°Р»С‘РЅРЅР°СЏ. РЎРѕС…СЂР°РЅРёС‚Рµ, С‡С‚РѕР±С‹ РїСЂРёРјРµРЅРёС‚СЊ.');
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
        errDiv.textContent = 'РћС€РёР±РєР° РёРЅРёС†РёР°Р»РёР·Р°С†РёРё РЅР°РІРёРіР°С†РёРё: ' + e.message;
        const c = document.querySelector('.container');
        if (c) c.prepend(errDiv);
        else document.body.prepend(errDiv);
    }
}

// Р“Р»РѕР±Р°Р»СЊРЅР°СЏ РІРµСЂСЃРёСЏ РёРЅРґРёРєР°С‚РѕСЂР° СЃРѕС…СЂР°РЅРµРЅРёСЏ РґР»СЏ РІС‹Р·РѕРІРѕРІ РІРЅРµ initTabsNavigation
function setSaveStatus(state, msg) {
    // РџРѕРїСЂРѕР±СѓРµРј РЅР°Р№С‚Рё СЌР»РµРјРµРЅС‚, РµСЃР»Рё РµС‰С‘ РЅРµ РїСЂРёРІСЏР·Р°РЅ
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
        saveStatus.textContent = msg || 'РЎРѕС…СЂР°РЅРµРЅРёРµ...';
    } else if (state === 'success') {
        saveStatus.style.display = 'inline-block';
        saveStatus.style.background = 'rgba(0, 128, 0, 0.3)';
        saveStatus.style.color = '#cfe9cf';
        saveStatus.style.border = '1px solid #2a6b2a';
        saveStatus.textContent = msg || 'РЎРѕС…СЂР°РЅРµРЅРѕ';
        setTimeout(() => { saveStatus.style.display = 'none'; }, 1500);
    } else if (state === 'error') {
        saveStatus.style.display = 'inline-block';
        saveStatus.style.background = 'rgba(128, 0, 0, 0.3)';
        saveStatus.style.color = '#f1c7c7';
        saveStatus.style.border = '1px solid #6b2a2a';
        saveStatus.textContent = msg || 'РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ';
        setTimeout(() => { saveStatus.style.display = 'none'; }, 4000);
    }
}

// --- Global helpers (accessible from outside initTabsNavigation) ---
// These mirror the inner helpers so that actions in displayQuestions can call them.

// Р¤Р»Р°Рі РґР»СЏ РїСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёСЏ С†РёРєР»РёС‡РµСЃРєРѕР№ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё
let isSyncing = false;

async function saveMergedToServer(skipReload = false) {
    // Р—Р°С‰РёС‚Р° РѕС‚ СЂРµРєСѓСЂСЃРёРІРЅС‹С… РІС‹Р·РѕРІРѕРІ
    if (isSyncing) {
        return false;
    }

    try {
        isSyncing = true;
        // РћС‚РїСЂР°РІР»СЏРµРј СЃРѕР±С‹С‚РёРµ РЅР°С‡Р°Р»Р° СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё
        window.dispatchEvent(new Event('sync-start'));

        console.log('[saveMergedToServer] === РќРђР§РђР›Рћ РЎРРќРҐР РћРќРР—РђР¦РР === skipReload:', skipReload);

        // рџ”Ќ РРЎРџР РђР’Р›Р•РќРР• РљРћР”РР РћР’РљР РџР•Р Р•Р” РћРўРџР РђР’РљРћР™
        const fixEncoding = (text) => {
            if (!text || typeof text !== 'string') return text;
            return text
                .replace(/\uFFFD/g, '?')  // U+FFFD в†’ ?
                .replace(/Р”\?{1,10}РєСѓРјРµРЅС‚Р°С†РёСЏ/g, 'Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ')
                .replace(/РёРЅС„Сѓ Рѕ\? СЃРµСЂРІРµСЂР°/g, 'РёРЅС„Сѓ РѕС‚ СЃРµСЂРІРµСЂР°')
                .replace(/РїРѕР»СѓС‡Р°\?Рј/g, 'РїРѕР»СѓС‡Р°РµРј')
                .replace(/СЃРµ\?{1,5}РІРёСЃС‹/g, 'СЃРµСЂРІРёСЃС‹');
        };

        // РСЃРїСЂР°РІР»СЏРµРј overrides РїРµСЂРµРґ РѕС‚РїСЂР°РІРєРѕР№
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
            console.warn('[saveMergedToServer] вљ пёЏ Р”Р°РЅРЅС‹Рµ Р±С‹Р»Рё РёСЃРїСЂР°РІР»РµРЅС‹ РїРµСЂРµРґ РѕС‚РїСЂР°РІРєРѕР№ (РїРѕРІСЂРµР¶РґРµРЅРЅР°СЏ РєРѕРґРёСЂРѕРІРєР°)');
            setOverrides(fixedOverrides);
        }

        const newItems = getNewItems();
        const deletedMap = getDeletedItems();
        const merged = [];
        const seen = new Set();

        // РЎРЅР°С‡Р°Р»Р° РґРѕР±Р°РІР»СЏРµРј Р±Р°Р·РѕРІС‹Рµ РєР°СЂС‚РѕС‡РєРё РёР· global.json
        uniqueQaData.forEach(item => {
            if (deletedMap[item.question] || serverTrashSet.has(item.question)) return;
            const ov = overrides[item.question];
            const mergedItem = ov ? { ...item, ...ov } : item;
            merged.push(mergedItem);
            seen.add(item.question);
        });

        // Р”РѕР±Р°РІР»СЏРµРј РЅРѕРІС‹Рµ СЌР»РµРјРµРЅС‚С‹ (РґСѓР±Р»РёРєР°С‚С‹, СЃРѕР·РґР°РЅРЅС‹Рµ РїРѕР»СЊР·РѕРІР°С‚РµР»РµРј)
        // Р’Р°Р¶РЅРѕ: РїСЂРѕРІРµСЂСЏРµРј РїРѕ С‚РѕС‡РЅРѕРјСѓ СЃРѕРІРїР°РґРµРЅРёСЋ РІРѕРїСЂРѕСЃР°, С‡С‚РѕР±С‹ РЅРµ РїРѕС‚РµСЂСЏС‚СЊ РґСѓР±Р»РёРєР°С‚С‹
        newItems.forEach(n => {
            const isDeleted = deletedMap[n.question] || serverTrashSet.has(n.question);
            const isAlreadyAdded = seen.has(n.question);

            // РџСЂРѕРїСѓСЃРєР°РµРј СѓРґР°Р»С‘РЅРЅС‹Рµ Рё СѓР¶Рµ РґРѕР±Р°РІР»РµРЅРЅС‹Рµ
            if (isDeleted || isAlreadyAdded) return;

            // Р”РѕР±Р°РІР»СЏРµРј РЅРѕРІС‹Р№ СЌР»РµРјРµРЅС‚ СЃ РїСЂРёРјРµРЅС‘РЅРЅС‹РјРё overrides
            const ov = overrides[n.question];
            merged.push(ov ? { ...n, ...ov } : n);
            seen.add(n.question);
        });

        // РўР°РєР¶Рµ РїСЂРѕРІРµСЂСЏРµРј qaUserCards РЅР° РЅР°Р»РёС‡РёРµ СЌР»РµРјРµРЅС‚РѕРІ, РєРѕС‚РѕСЂС‹С… РЅРµС‚ РЅРё РІ base, РЅРё РІ newItems
        // Р­С‚Рѕ РЅСѓР¶РЅРѕ РґР»СЏ СЃР»СѓС‡Р°РµРІ, РєРѕРіРґР° РґСѓР±Р»РёРєР°С‚С‹ СѓР¶Рµ СЃРѕС…СЂР°РЅРµРЅС‹ РІ localStorage
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
                            // рџ”Ґ РРЎРџР РђР’Р›Р•РќРР•: Р”СѓР±Р»РёРєР°С‚С‹ (СЃ "РєРѕРїРёСЏ" РІ РЅР°Р·РІР°РЅРёРё) РЅРµ РґРѕР»Р¶РЅС‹ СЃС‡РёС‚Р°С‚СЊСЃСЏ СѓРґР°Р»С‘РЅРЅС‹РјРё
                            // РµСЃР»Рё РѕРЅРё С‚РѕР»СЊРєРѕ С‡С‚Рѕ СЃРѕР·РґР°РЅС‹ Рё РёС… РЅРµС‚ РІ deletedMap
                            const isInServerTrash = serverTrashSet.has(uc.question);
                            const isInLocalDeleted = deletedMap[uc.question];
                            const isDeleted = isInLocalDeleted || (isInServerTrash && !uc.question.includes('РєРѕРїРёСЏ'));

                            const isAlreadyAdded = seen.has(uc.question);
                            const isInBase = uniqueQaData.some(b => b.question === uc.question);
                            const isNewItem = newItems.some(n => n.question === uc.question);

                            // РЎС‡РёС‚Р°РµРј РґСѓР±Р»РёРєР°С‚С‹
                            if (uc.question.includes('РєРѕРїРёСЏ')) {
                                duplicatesFound++;
                                console.log('[saveMergedToServer] РќР°Р№РґРµРЅ РґСѓР±Р»РёРєР°С‚ РІ qaUserCards:', {
                                    question: uc.question.substring(0, 50),
                                    isAlreadyAdded,
                                    isInBase,
                                    isNewItem,
                                    isDeleted
                                });
                            }

                            // Р”РѕР±Р°РІР»СЏРµРј С‚РѕР»СЊРєРѕ РµСЃР»Рё СЌС‚Рѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєР°СЏ РєР°СЂС‚РѕС‡РєР°, РєРѕС‚РѕСЂРѕР№ РЅРµС‚ РІ Р±Р°Р·Рµ Рё РЅРѕРІС‹С… СЌР»РµРјРµРЅС‚Р°С…
                            if (!isDeleted && !isAlreadyAdded && !isInBase && !isNewItem) {
                                const ov = overrides[uc.question];
                                merged.push(ov ? { ...uc, ...ov } : uc);
                                seen.add(uc.question);
                                addedCount++;
                            }
                        });

                        console.log('[saveMergedToServer] РћР±СЂР°Р±РѕС‚Р°РЅРѕ qaUserCards:', {
                            checkedCount,
                            duplicatesFound,
                            addedCount,
                            mergedCount: merged.length
                        });
                    }
                }
            }
        } catch (e) {
            console.warn('[saveMergedToServer] РќРµ СѓРґР°Р»РѕСЃСЊ РґРѕР±Р°РІРёС‚СЊ РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅС‹Рµ РєР°СЂС‚РѕС‡РєРё:', e);
        }
        const lastRestored = typeof window !== 'undefined' ? window.__lastRestoredQuestion : null;

        // РџРѕР»СѓС‡Р°РµРј username РґР»СЏ РѕС‚РїСЂР°РІРєРё РЅР° СЃРµСЂРІРµСЂ
        let username = null;
        try {
            const sessionUserRaw = localStorage.getItem('qaSessionUser');
            const u = JSON.parse(sessionUserRaw);
            if (u && u.username) username = u.username;
        } catch { }

        // рџ”Ќ Р¤РРќРђР›Р¬РќРћР• РРЎРџР РђР’Р›Р•РќРР• РљРћР”РР РћР’РљР РџР•Р Р•Р” РћРўРџР РђР’РљРћР™
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
                console.warn(`[saveMergedToServer] РСЃРїСЂР°РІР»РµРЅР° РєР°СЂС‚РѕС‡РєР°: ${card.question?.substring(0, 30)}...`);
            }
            return fixedCard;
        });

        const url = `${BACKEND_URL}/save?user=${encodeURIComponent(username || 'guest')}`;

        console.log('[saveMergedToServer] РћС‚РїСЂР°РІР»СЏРµРј РЅР° СЃРµСЂРІРµСЂ:', {
            mergedCount: merged.length,
            newItemsCount: newItems.length,
            deletedCount: Object.keys(deletedMap).length,
            username,
            bodyLength: JSON.stringify(fixedMerged).length
        });

        // рџ”Ќ Р›РћР“: РїРµСЂРІС‹Рµ 3 РєР°СЂС‚РѕС‡РєРё РґР»СЏ РїСЂРѕРІРµСЂРєРё
        const first3 = merged.slice(0, 3).map(c => ({
            question: c.question?.substring(0, 50),
            hasCopy: c.question?.includes('РєРѕРїРёСЏ'),
            category: c.category,
            subcategory: c.subcategory
        }));
        console.log('[saveMergedToServer] РџРµСЂРІС‹Рµ 3 РєР°СЂС‚РѕС‡РєРё:', first3);

        // рџ”Ќ Р›РћР“: РїРѕРёСЃРє РґСѓР±Р»РёРєР°С‚Р° РІРѕ РІСЃС‘Рј РјР°СЃСЃРёРІРµ
        const dupIndex = merged.findIndex(c => c.question?.includes('РєРѕРїРёСЏ'));
        console.log('[saveMergedToServer] Р”СѓР±Р»РёРєР°С‚ РЅР°Р№РґРµРЅ РЅР° РёРЅРґРµРєСЃРµ:', dupIndex);
        if (dupIndex >= 0) {
            console.log('[saveMergedToServer] Р”СѓР±Р»РёРєР°С‚:', {
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

        console.log('[saveMergedToServer] РћС‚РІРµС‚ СЃРµСЂРІРµСЂР°:', {
            status: resp.status,
            ok: resp.ok,
            statusText: resp.statusText
        });
        let ok = resp.ok;
        let responseJson = null;
        try {
            responseJson = await resp.json();
            console.log('[saveMergedToServer] РџРћР›РЈР§Р•РќРћ РћРў РЎР•Р Р’Р•Р Рђ:', responseJson);
            if (typeof responseJson?.ok === 'boolean') ok = ok && responseJson.ok;
        } catch (parseErr) {
            console.warn('[saveMergedToServer] РќРµ СѓРґР°Р»РѕСЃСЊ СЂР°СЃРїР°СЂСЃРёС‚СЊ РѕС‚РІРµС‚:', parseErr);
        }

        if (!ok) {
            console.error('[saveMergedToServer] РЎРµСЂРІРµСЂ РІРµСЂРЅСѓР» РѕС€РёР±РєСѓ');
            throw new Error('РЎРµСЂРІРµСЂ РІРµСЂРЅСѓР» РѕС€РёР±РєСѓ РїСЂРё СЃРѕС…СЂР°РЅРµРЅРёРё');
        }

        // РЈСЃРїРµС€РЅРѕРµ СЃРѕС…СЂР°РЅРµРЅРёРµ
        setSaveStatus('success');

        console.log('[saveMergedToServer] РЎРµСЂРІРµСЂ РѕС‚РІРµС‚РёР»:', { ok, responseJson });

        // рџ”Ґ РћР‘РќРћР’Р›РЇР•Рњ localDataTimestamp РїРѕСЃР»Рµ СѓСЃРїРµС€РЅРѕРіРѕ СЃРѕС…СЂР°РЅРµРЅРёСЏ РЅР° СЃРµСЂРІРµСЂ
        // Р­С‚Рѕ РЅСѓР¶РЅРѕ РґР»СЏ РєРѕСЂСЂРµРєС‚РЅРѕР№ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё РјРµР¶РґСѓ СѓСЃС‚СЂРѕР№СЃС‚РІР°РјРё
        const serverTimestamp = responseJson?.updatedAt || Date.now();
        localStorage.setItem('localDataTimestamp', serverTimestamp.toString());
        console.log('[saveMergedToServer] localDataTimestamp РѕР±РЅРѕРІР»С‘РЅ:', serverTimestamp);

        // РћС‚РїСЂР°РІР»СЏРµРј СЃРѕР±С‹С‚РёРµ СѓСЃРїРµС€РЅРѕР№ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё
        window.dispatchEvent(new Event('sync-success'));

        // РћР‘РќРћР’Р›РЇР•Рњ qaUserCards РІ localStorage
        try {
            setQaUserCards(merged);
            console.log('[saveMergedToServer] setQaUserCards РІС‹Р·РІР°РЅ:', {
                mergedLength: merged.length,
                savedCards: merged.length
            });

            // рџ”Ќ РџР РћР’Р•Р РЇР•Рњ С‡С‚Рѕ Р·Р°РїРёСЃР°Р»РѕСЃСЊ РІ localStorage
            const verifyCards = getQaUserCards();
            console.log('[saveMergedToServer] РџСЂРѕРІРµСЂРєР° localStorage:', {
                cardsInLocalStorage: verifyCards?.length || 0
            });

            // рџ”Ґ РћР‘РќРћР’Р›РЇР•Рњ uniqueQaData РІ РїР°РјСЏС‚Рё РёР· localStorage
            // Р­С‚Рѕ РЅСѓР¶РЅРѕ С‡С‚РѕР±С‹ СЃР»РµРґСѓСЋС‰РёРµ РґСѓР±Р»РёРєР°С‚С‹ РёСЃРїРѕР»СЊР·РѕРІР°Р»Рё Р°РєС‚СѓР°Р»СЊРЅС‹Рµ РґР°РЅРЅС‹Рµ
            // РРјРїРѕСЂС‚РёСЂСѓРµРј setUniqueQaData РёР· all-data.js
            const { setUniqueQaData } = await import('../all-data.js');
            if (typeof setUniqueQaData === 'function' && verifyCards && verifyCards.length > 0) {
                setUniqueQaData(verifyCards);
                console.log('[saveMergedToServer] uniqueQaData РѕР±РЅРѕРІР»С‘РЅ:', {
                    newLength: verifyCards.length
                });
            }

            // РћС‡РёС‰Р°РµРј qaNewItems РїРѕСЃР»Рµ СѓСЃРїРµС€РЅРѕР№ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё, С‡С‚РѕР±С‹ РґСѓР±Р»РёРєР°С‚С‹ РЅРµ РґРѕР±Р°РІР»СЏР»РёСЃСЊ РїРѕРІС‚РѕСЂРЅРѕ
            const newItems = getNewItems();
            console.log('[saveMergedToServer] РћС‡РёС‰Р°РµРј qaNewItems:', newItems.length, 'СЌР»РµРјРµРЅС‚РѕРІ');
            if (Array.isArray(newItems) && newItems.length > 0) {
                localStorage.setItem('qaNewItems', JSON.stringify([]));
            }

            // РћС‡РёС‰Р°РµРј qaDeletedItems РїРѕСЃР»Рµ СѓСЃРїРµС€РЅРѕР№ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё
            const deletedItems = getDeletedItems();
            if (Object.keys(deletedItems).length > 0) {
                localStorage.setItem('qaDeletedItems', JSON.stringify({}));
            }
        } catch (e) {
            console.warn('[saveMergedToServer] РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ localStorage:', e);
        }

        // РџСЂРёРЅСѓРґРёС‚РµР»СЊРЅР°СЏ РїРµСЂРµР·Р°РіСЂСѓР·РєР° РґР°РЅРЅС‹С… С‡РµСЂРµР· 50РјСЃ
        console.log('[saveMergedToServer] Dispatch forceReloadData:', !skipReload);
        setTimeout(() => {
            if (!skipReload) window.dispatchEvent(new Event('forceReloadData'));
        }, 50);

        return true;
    } catch (e) {
        console.error('[saveMergedToServer] РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ:', e);
        setSaveStatus('error', 'РћС€РёР±РєР°: ' + e.message);
        // РћС‚РїСЂР°РІР»СЏРµРј СЃРѕР±С‹С‚РёРµ РѕС€РёР±РєРё СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё
        window.dispatchEvent(new Event('sync-error'));
        return false;
    } finally {
        // РЎР±СЂР°СЃС‹РІР°РµРј С„Р»Р°Рі СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё
        isSyncing = false;
    }
}

async function moveToServerTrash(items) {
    try {
        // РџРѕР»СѓС‡Р°РµРј username РґР»СЏ РѕС‚РїСЂР°РІРєРё РЅР° СЃРµСЂРІРµСЂ
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
            console.error('[moveToServerTrash] РћС€РёР±РєР° СЃРµСЂРІРµСЂР°:', resp.status, error);
        }

        return resp.ok;
    } catch (e) {
        console.error('[moveToServerTrash] РћС€РёР±РєР°:', e);
        return false;
    }
}

async function restoreFromServerTrash(questions) {
    try {
        // РџРѕР»СѓС‡Р°РµРј username РґР»СЏ РѕС‚РїСЂР°РІРєРё РЅР° СЃРµСЂРІРµСЂ
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
            // РќРѕСЂРјР°Р»РёР·СѓРµРј РєР»СЋС‡Рё СЃ СЃРµСЂРІРµСЂР° (snake_case -> camelCase)
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
        // рџ”’ Р—Р°РіСЂСѓР¶Р°РµРј РєРѕСЂР·РёРЅСѓ СЃ СЃРµСЂРІРµСЂР° (С‚РµРїРµСЂСЊ /metadata РІРѕР·РІСЂР°С‰Р°РµС‚ trash_bin)
        const resp = await fetchWithAuth('/metadata');
        if (resp.ok) {
            const data = await resp.json();
            const bin = Array.isArray(data.trash_bin) ? data.trash_bin : [];
            serverTrashItems = bin;
            serverTrashSet = new Set(bin.map(t => t.item?.question).filter(Boolean));
            // рџ”’ РЎРѕС…СЂР°РЅСЏРµРј РІ localStorage РґР»СЏ РѕС„Р»Р°Р№РЅ-СЂР°Р±РѕС‚С‹
            localStorage.setItem('qaUserTrash', JSON.stringify(serverTrashItems));
            return;
        }

        // Р¤РѕР»Р±СЌРє: РµСЃР»Рё СЃРµСЂРІРµСЂ РЅРµРґРѕСЃС‚СѓРїРµРЅ, Р·Р°РіСЂСѓР¶Р°РµРј РёР· localStorage
        const localTrash = localStorage.getItem('qaUserTrash');
        if (localTrash) {
            const trash = JSON.parse(localTrash);
            serverTrashItems = Array.isArray(trash) ? trash : [];
            serverTrashSet = new Set(serverTrashItems.map(t => t.item?.question).filter(Boolean));
        }
    } catch (e) {
        console.error('Failed to refresh server trash:', e);
        // Р¤РѕР»Р±СЌРє: Р·Р°РіСЂСѓР¶Р°РµРј РёР· localStorage РїСЂРё РѕС€РёР±РєРµ
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
        // РџСЂРµРѕР±СЂР°Р·СѓРµРј РєР»СЋС‡Рё РєР»РёРµРЅС‚Р° (camelCase) РІ СЃРµСЂРІРµСЂРЅС‹Рµ (snake_case)
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
    if (catDiv) catDiv.innerHTML = '<div><strong>РљР°С‚РµРіРѕСЂРёРё:</strong></div><div>РџСѓСЃС‚Рѕ</div>';
    const deletedCards = serverTrashItems.map(t => t.item?.question).filter(Boolean);
    if (cardDiv) {
        cardDiv.innerHTML = '';
        const header = document.createElement('div');
        header.innerHTML = '<strong>РљР°СЂС‚РѕС‡РєРё:</strong>' + (deletedCards.length ? '' : ' <span>РџСѓСЃС‚Рѕ</span>');
        cardDiv.appendChild(header);
        const grid = document.createElement('div');
        grid.className = 'trash-cards-grid';
        cardDiv.appendChild(grid);

        serverTrashItems.forEach(entry => {
            const q = entry.item?.question;
            const it = entry.item || uniqueQaData.find(i => i.question === q) || getNewItems().find(i => i.question === q);
            const mini = document.createElement('div');
            mini.className = 'result-item trash-mini';

            // Р’РµСЂС…: С‚РµРіРё
            const meta = document.createElement('div');
            meta.className = 'trash-meta';
            meta.style.display = 'flex';
            meta.style.flexWrap = 'wrap';
            meta.style.gap = '6px';
            const catBadge = document.createElement('span'); catBadge.className = 'category-badge'; catBadge.textContent = (it && it.category) ? it.category : '';
            const scBadge = document.createElement('span'); scBadge.className = 'subcategory-badge'; scBadge.textContent = (it && it.subcategory) ? it.subcategory : '';
            meta.appendChild(catBadge); meta.appendChild(scBadge);

            // Р’РѕРїСЂРѕСЃ - РїСЂРёРјРµРЅСЏРµРј С„РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµ
            const qEl = document.createElement('div'); qEl.className = 'question';
            const questionFormatting = it?.formatting?.question || [];
            qEl.innerHTML = applyFormatting(it?.question || q || '', questionFormatting);
            qEl.style.marginTop = '6px';

            // РћС‚РІРµС‚ - РїСЂРёРјРµРЅСЏРµРј С„РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµ
            const aEl = document.createElement('div'); aEl.className = 'answer';
            const answerFormatting = it?.formatting?.answer || [];
            aEl.innerHTML = applyFormatting(it?.answer || '', answerFormatting);
            aEl.style.marginTop = '6px';

            // Р”РµР№СЃС‚РІРёСЏ
            const actions = document.createElement('div');
            actions.className = 'trash-actions';
            actions.style.display = 'flex';
            actions.style.gap = '8px';
            actions.style.marginTop = '8px';
            const restoreBtn = document.createElement('button'); restoreBtn.className = 'restore-btn'; restoreBtn.textContent = 'Р’РѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ';
            const purgeBtn2 = document.createElement('button'); purgeBtn2.className = 'purge-btn'; purgeBtn2.textContent = 'РЈРґР°Р»РёС‚СЊ РЅР°РІСЃРµРіРґР°';
            actions.appendChild(restoreBtn);
            actions.appendChild(purgeBtn2);

            mini.appendChild(meta);
            mini.appendChild(qEl);
            mini.appendChild(aEl);
            mini.appendChild(actions);
            grid.appendChild(mini);

            // РћРїС‚РёРјРёСЃС‚РёС‡РЅРѕРµ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ + РѕС‡РёСЃС‚РєР° Р»РѕРєР°Р»СЊРЅРѕР№ РєР°СЂС‚С‹ СѓРґР°Р»РµРЅРёР№
            restoreBtn.addEventListener('click', async () => {
                restoreBtn.textContent = 'Р’РѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ...'; restoreBtn.disabled = true;
                // РЈРґР°Р»СЏРµРј РёР· Р»РѕРєР°Р»СЊРЅРѕРіРѕ РєСЌС€Р° РєРѕСЂР·РёРЅС‹ СЃСЂР°Р·Сѓ
                serverTrashSet.delete(q);
                serverTrashItems = serverTrashItems.filter(t => t.item?.question !== q);
                // Р•СЃР»Рё РєР°СЂС‚Р° Р»РѕРєР°Р»СЊРЅС‹С… СѓРґР°Р»РµРЅРёР№ РїРѕРјРµС‡Р°Р»Р° СЌС‚Сѓ РєР°СЂС‚РѕС‡РєСѓ РєР°Рє СѓРґР°Р»С‘РЅРЅСѓСЋ вЂ” РѕС‡РёСЃС‚РёРј
                const delMap = getDeletedItems();
                if (delMap && delMap[q]) { delete delMap[q]; setDeletedItems(delMap); }
                renderTrashPanel();
                // РћР±РЅРѕРІР»СЏРµРј С‚РµРєСѓС‰РёР№ СЃРїРёСЃРѕРє РІ Р·Р°РІРёСЃРёРјРѕСЃС‚Рё РѕС‚ Р°РєС‚РёРІРЅРѕРіРѕ С‚Р°Р±Р°
                // РћР±РЅРѕРІР»СЏРµРј Р±РµР· СЃР±СЂРѕСЃР° РєРѕРЅС‚РµРєСЃС‚Р°
                refreshCurrentContext();
                // РџС‹С‚Р°РµРјСЃСЏ РІРѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ РЅР° СЃРµСЂРІРµСЂРµ
                let ok = false; try { ok = await restoreFromServerTrash([q]); } catch (e) { console.error('[restore-click] РћС€РёР±РєР° Р·Р°РїСЂРѕСЃР° Рє СЃРµСЂРІРµСЂСѓ /restore', e); ok = false; }
                if (ok) {
                    try { await refreshServerTrash(); } catch (_) { }
                    // Р•СЃР»Рё РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРЅРѕР№ РєР°СЂС‚РѕС‡РєРё РЅРµС‚ РІ С‚РµРєСѓС‰РµРј Р±Р°Р·РѕРІРѕРј РЅР°Р±РѕСЂРµ (uniqueQaData)
                    // Рё РѕРЅР° РЅРµ С‡РёСЃР»РёС‚СЃСЏ СЃСЂРµРґРё РЅРѕРІС‹С… СЌР»РµРјРµРЅС‚РѕРІ вЂ” РґРѕР±Р°РІРёРј РµС‘ РІ РЅРѕРІС‹Рµ РґР»СЏ РїРѕСЃР»РµРґСѓСЋС‰РµРіРѕ СЃРѕС…СЂР°РЅРµРЅРёСЏ.
                    const baseHas = !!uniqueQaData.find(i => i.question === q);
                    const newItemsArr = getNewItems();
                    const newHas = !!newItemsArr.find(i => i.question === q);
                    if (!baseHas && !newHas && it) {
                        newItemsArr.push({ ...it });
                        setLS('qaNewItems', newItemsArr);
                    }
                    try { window.__lastRestoredQuestion = q; } catch (_) { }
                    // рџ”Ґ РЎРѕС…СЂР°РЅСЏРµРј РЅР° СЃРµСЂРІРµСЂ Р‘Р•Р— forceReloadData
                    saveMergedToServer(true).then(saveOk => {
                        if (saveOk) {
                            setSaveStatus('success', 'РљР°СЂС‚РѕС‡РєР° РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅР°');
                            restoreBtn.textContent = 'Р“РѕС‚РѕРІРѕ';
                            setTimeout(() => { restoreBtn.textContent = 'Р’РѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ'; restoreBtn.disabled = false; }, 1500);
                        } else {
                            setSaveStatus('error', 'РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ');
                            restoreBtn.textContent = 'Р’РѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ'; restoreBtn.disabled = false;
                        }
                    });
                } else {
                    try { await refreshServerTrash(); } catch (_) { }
                    setSaveStatus('error', 'РћС€РёР±РєР° РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ РЅР° СЃРµСЂРІРµСЂРµ');
                    restoreBtn.textContent = 'Р’РѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ'; restoreBtn.disabled = false;
                }
            });

            // РћРєРѕРЅС‡Р°С‚РµР»СЊРЅРѕРµ СѓРґР°Р»РµРЅРёРµ (РІС‚РѕСЂР°СЏ РІРµС‚РєР°)
            purgeBtn2.addEventListener('click', async () => {
                purgeBtn2.textContent = 'РЈРґР°Р»РµРЅРёРµ...'; purgeBtn2.disabled = true;

                // рџ”’ РџРѕР»СѓС‡Р°РµРј username
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

                        // рџ”Ґ Р’РђР–РќРћ: Р”РѕР±Р°РІР»СЏРµРј РІ qaDeletedItems С‡С‚РѕР±С‹ РєР°СЂС‚РѕС‡РєР° РЅРµ РІРµСЂРЅСѓР»Р°СЃСЊ РїСЂРё СЃРѕС…СЂР°РЅРµРЅРёРё
                        const delMap = getDeletedItems();
                        delMap[q] = { deleted_at: new Date().toISOString(), deleted_by: username, permanent: true };
                        setDeletedItems(delMap);

                        const newArr = getNewItems().filter(i => i.question !== q);
                        setLS('qaNewItems', newArr);

                        // рџ”’ РћР±РЅРѕРІР»СЏРµРј localStorage СЃ РєРѕСЂР·РёРЅРѕР№
                        const localTrash = localStorage.getItem('qaUserTrash');
                        if (localTrash) {
                            const trash = JSON.parse(localTrash);
                            const newTrash = trash.filter(t => t.item?.question !== q);
                            localStorage.setItem('qaUserTrash', JSON.stringify(newTrash));
                        }

                        renderTrashPanel();
                        refreshCurrentContext();
                        // рџ”Ґ РќР• РІС‹Р·С‹РІР°РµРј saveMergedToServer() С‡С‚РѕР±С‹ РЅРµ РІРµСЂРЅСѓС‚СЊ РєР°СЂС‚РѕС‡РєСѓ РѕР±СЂР°С‚РЅРѕ!
                        setSaveStatus('success', 'РљР°СЂС‚РѕС‡РєР° СѓРґР°Р»РµРЅР° РЅР°РІСЃРµРіРґР°');
                    } else {
                        const error = await resp.text();
                        console.error('[delete-permanent] РћС€РёР±РєР°:', resp.status, error);
                        setSaveStatus('error', 'РћС€РёР±РєР°: ' + error);
                    }
                } catch (e) {
                    console.error('[delete-permanent] РћС€РёР±РєР°:', e);
                    setSaveStatus('error', 'РЎРµСЂРІРµСЂ СѓРґР°Р»РµРЅРёСЏ РЅРµРґРѕСЃС‚СѓРїРµРЅ');
                }
                purgeBtn2.textContent = 'РЈРґР°Р»РёС‚СЊ РЅР°РІСЃРµРіРґР°'; purgeBtn2.disabled = false;
            });
        });
    }
}

// Р¤СѓРЅРєС†РёСЏ РґР»СЏ С„РёР»СЊС‚СЂР°С†РёРё РІРѕРїСЂРѕСЃРѕРІ РїРѕ РєР°С‚РµРіРѕСЂРёРё
function filterQuestionsByCategory(categoryName) {
    currentContextKey = `category:${categoryName}`;
    const data = getRuntimeData();
    // Р•СЃР»Рё РёРјСЏ РєР°С‚РµРіРѕСЂРёРё вЂ” РѕС‚РѕР±СЂР°Р¶Р°РµРјРѕРµ, РЅР°Р№РґРµРј РёСЃС…РѕРґРЅРѕРµ РёРјСЏ
    const catPlaceholders = getCategoryPlaceholders();
    const canonicalCategory = Object.entries(catPlaceholders).find(([, v]) => v?.displayName === categoryName)?.[0] || categoryName;
    const filteredData = data.filter(item => item.category === canonicalCategory || item.category === categoryName);
    displayQuestions(filteredData, `РљР°С‚РµРіРѕСЂРёСЏ: ${categoryName}`);
}

// Р¤СѓРЅРєС†РёСЏ РґР»СЏ С„РёР»СЊС‚СЂР°С†РёРё РІРѕРїСЂРѕСЃРѕРІ РїРѕ РїРѕРґРєР°С‚РµРіРѕСЂРёРё
function filterQuestionsBySubcategory(categoryName, subcategoryName) {
    currentContextKey = `subcategory:${categoryName}#${subcategoryName}`;
    const data = getRuntimeData();
    const catPlaceholders = getCategoryPlaceholders();
    const scPlaceholders = getSubcategoryPlaceholders();
    const canonicalCategory = Object.entries(catPlaceholders).find(([, v]) => v?.displayName === categoryName)?.[0] || categoryName;
    const scMap = scPlaceholders[canonicalCategory] || scPlaceholders[categoryName] || {};
    const canonicalSub = Object.entries(scMap).find(([, v]) => v?.displayName === subcategoryName)?.[0] || subcategoryName;
    const filteredData = data.filter(item => (item.category === canonicalCategory || item.category === categoryName) && (item.subcategory === canonicalSub || item.subcategory === subcategoryName));
    displayQuestions(filteredData, `РџРѕРґРєР°С‚РµРіРѕСЂРёСЏ: ${subcategoryName}`);
}

// Р¤СѓРЅРєС†РёСЏ РґР»СЏ РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ РІСЃРµС… РІРѕРїСЂРѕСЃРѕРІ
function showAllQuestions() {
    currentContextKey = 'all';
    displayQuestions(getRuntimeData(), 'Р’СЃРµ РІРѕРїСЂРѕСЃС‹');
}

// Р¤СѓРЅРєС†РёСЏ РґР»СЏ РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ РёР·Р±СЂР°РЅРЅС‹С… РІРѕРїСЂРѕСЃРѕРІ
function showFavorites() {
    currentContextKey = 'favorites';
    const favorites = new Set(JSON.parse(localStorage.getItem('qaFavorites') || '[]'));
    const favData = getRuntimeData().filter(item => favorites.has(item.question));
    displayQuestions(favData, 'РР·Р±СЂР°РЅРЅРѕРµ');
}

// РЈРЅРёРІРµСЂСЃР°Р»СЊРЅР°СЏ РїРµСЂРµСЂРёСЃРѕРІРєР° С‚РµРєСѓС‰РµРіРѕ РєРѕРЅС‚РµРєСЃС‚Р° Р±РµР· СЃР±СЂРѕСЃР° РЅР° В«Р’СЃРµ РІРѕРїСЂРѕСЃС‹В»
function refreshCurrentContext() {
    // РќР• РїРѕРєР°Р·С‹РІР°РµРј РІРѕРїСЂРѕСЃС‹ РµСЃР»Рё РѕС‚РєСЂС‹С‚Р° СЃС‚СЂР°РЅРёС†Р° СЃС‚Р°С‚РёСЃС‚РёРєРё!
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

// Р¤СѓРЅРєС†РёСЏ РґР»СЏ РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ РІРѕРїСЂРѕСЃРѕРІ
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
                РЎРїРёСЃРѕРє РІРѕРїСЂРѕСЃРѕРІ РїСѓСЃС‚
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

        // РџСЂРёРјРµРЅСЏРµРј РїРѕСЂСЏРґРѕРє, РµСЃР»Рё Р·Р°РґР°РЅ
        const order = getOrderForContext(currentContextKey);
        if (order && sortMode === 'default') {
            const idx = new Map(order.map((q, i) => [q, i]));
            currentQuestions.sort((a, b) => (idx.get(a.question) ?? 1e9) - (idx.get(b.question) ?? 1e9));
        }

        // РџРѕР»СѓС‡Р°РµРј РїСЂРѕРіСЂРµСЃСЃ РґР»СЏ РІСЃРµС… РєР°СЂС‚РѕС‡РµРє РґР»СЏ СЃРѕСЂС‚РёСЂРѕРІРєРё Рё РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ
        let progressMap = {};
        try {
            progressMap = getProgressMap();
        } catch (e) {
            console.warn('getProgressMap failed:', e);
        }

        // РџСЂРёРјРµРЅСЏРµРј СЃРѕСЂС‚РёСЂРѕРІРєСѓ РїРѕ EF (СЃРµСЂРґРµС‡РєР°Рј), РµСЃР»Рё РІРєР»СЋС‡РµРЅР°
        if (sortMode !== 'default') {
            currentQuestions.sort((a, b) => {
                const efA = progressMap[a.question]?.easeFactor ?? 2.3;
                const efB = progressMap[b.question]?.easeFactor ?? 2.3;

                // 1. РџРµСЂРІРёС‡РЅР°СЏ СЃРѕСЂС‚РёСЂРѕРІРєР° РїРѕ EF
                if (Math.abs(efA - efB) >= 0.001) {
                    // asc: РѕС‚ РјРµРЅСЊС€РµРіРѕ Рє Р±РѕР»СЊС€РµРјСѓ (1.3 -> 2.9) - РЎР°РјС‹Рµ СЃР»РѕР¶РЅС‹Рµ СЃРЅР°С‡Р°Р»Р°
                    return sortMode === 'asc' ? efA - efB : efB - efA;
                }

                // 2. Р’С‚РѕСЂРёС‡РЅР°СЏ СЃРѕСЂС‚РёСЂРѕРІРєР° РїРѕ ID (РІСЃРµРіРґР° ASC РґР»СЏ СЃС‚Р°Р±РёР»СЊРЅРѕСЃС‚Рё)
                const idA = parseInt(a.id, 10) || 0;
                const idB = parseInt(b.id, 10) || 0;
                if (idA !== idB) {
                    return idA - idB;
                }

                // 3. РўСЂРµС‚РёС‡РЅР°СЏ СЃРѕСЂС‚РёСЂРѕРІРєР° РїРѕ Р°Р»С„Р°РІРёС‚Сѓ (РІСЃРµРіРґР° ASC РґР»СЏ СЃС‚Р°Р±РёР»СЊРЅРѕСЃС‚Рё)
                return a.question.localeCompare(b.question, undefined, { numeric: true, sensitivity: 'base' });
            });
        }

        // РћР±РЅРѕРІР»СЏРµРј СЃС‡РµС‚С‡РёРє СЂРµР·СѓР»СЊС‚Р°С‚РѕРІ (РІС‹РЅРµСЃРµРЅ РёР· grid)
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

        // РРєРѕРЅРєРё СЃРѕСЂС‚РёСЂРѕРІРєРё
        const sortIcons = {
            default: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5"/></svg>',
            asc: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5" opacity="0.3"/></svg>', // РЎС‚СЂРµР»РєР° РІРЅРёР· (РІРѕР·СЂР°СЃС‚Р°РЅРёРµ)
            desc: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 9l5-5 5 5"/><path d="M7 15l5 5 5-5" opacity="0.3"/></svg>'  // РЎС‚СЂРµР»РєР° РІРІРµСЂС… (СѓР±С‹РІР°РЅРёРµ)
        };
        const sortTitle = {
            default: 'РЎРѕСЂС‚РёСЂРѕРІРєР°: РџРѕ СѓРјРѕР»С‡Р°РЅРёСЋ',
            asc: 'РЎРѕСЂС‚РёСЂРѕРІРєР°: РћС‚ СЃР»РѕР¶РЅС‹С… Рє Р»РµРіРєРёРј (EF в†‘)',
            desc: 'РЎРѕСЂС‚РёСЂРѕРІРєР°: РћС‚ Р»РµРіРєРёС… Рє СЃР»РѕР¶РЅС‹Рј (EF в†“)'
        };

        // Р¤РѕСЂРјРёСЂСѓРµРј С‚РµРєСЃС‚ СЃС‡РµС‚С‡РёРєР°
        // рџ”’ РСЃРїРѕР»СЊР·СѓРµРј getRuntimeData() РґР»СЏ РєРѕРЅСЃРёСЃС‚РµРЅС‚РЅРѕСЃС‚Рё
        const runtimeData = getRuntimeData();
        const totalCount = runtimeData.length;
        const isFiltered = questions.length !== totalCount;
        const countText = isFiltered
            ? `РќР°Р№РґРµРЅРѕ: ${questions.length} РёР· ${totalCount}`
            : `Р’СЃРµРіРѕ РєР°СЂС‚РѕС‡РµРє: ${questions.length}`;

        countContainer.innerHTML = `
        <p class="results-count" style="margin:0">${countText}</p>
        <button id="sort-toggle-btn" class="nav-icon-btn" title="${sortTitle[sortMode]}" style="padding:4px 8px; border-radius:4px; border:1px solid #444; background:none; cursor:pointer; display:flex; align-items:center; justify-content:center;">
            ${sortIcons[sortMode]}
        </button>
    `;

        // РћР±СЂР°Р±РѕС‚С‡РёРє РєРЅРѕРїРєРё СЃРѕСЂС‚РёСЂРѕРІРєРё
        const sortBtn = countContainer.querySelector('#sort-toggle-btn');
        if (sortBtn) {
            sortBtn.addEventListener('click', () => {
                if (sortMode === 'default') sortMode = 'asc';
                else if (sortMode === 'asc') sortMode = 'desc';
                else sortMode = 'default';
                displayQuestions(currentQuestions, title);
            });
        }

        // РҐРµР»РїРµСЂ РґР»СЏ РѕС‚СЂРёСЃРѕРІРєРё СЃРµСЂРґРµС‡РµРє (РЅРѕРІР°СЏ Р»РѕРіРёРєР° СЃ РґСЂРѕР±РЅС‹РјРё)
        const renderHearts = (ef) => {
            try {
                if (typeof getDifficultyLevel !== 'function' || typeof getLevelProgress !== 'function') {
                    console.warn('SRS functions not available');
                    return '';
                }

                // Check for NEW card (ef is null or undefined)
                if (ef === null || ef === undefined) {
                    return '<div class="hearts-container" title="РљР°СЂС‚РѕС‡РєР° РµС‰Рµ РЅРµ РёР·СѓС‡Р°Р»Р°СЃСЊ" style="position:absolute; top:12px; right:40px; z-index:998;"><span class="level-label" style="font-size:10px;color:var(--color-text-secondary);font-weight:600;background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;">РќРћР’РђРЇ</span></div>';
                }

                // Р Р°СЃС‡РµС‚ РєРѕР»РёС‡РµСЃС‚РІР° СЃРµСЂРґРµС‡РµРє (1.0 - 5.0)
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
                    'VERY_HARD': 'РћС‡РµРЅСЊ С‚СЂСѓРґРЅС‹Рµ',
                    'HARD': 'РўСЂСѓРґРЅС‹Рµ',
                    'STANDARD': 'РЎС‚Р°РЅРґР°СЂС‚',
                    'EASY': 'Р›РµРіРєРёРµ'
                };
                const levelName = levelNames[level] || level;

                let html = '<div class="hearts-container" title="РЈСЂРѕРІРµРЅСЊ: ' + levelName + '\\nEF: ' + ef.toFixed(2) + '\\nРЎРµСЂРґРµС‡РµРє: ' + heartsCount.toFixed(2) + '" style="position:absolute; top:12px; right:40px; display:flex; gap:2px; z-index:998;">';

                // Р РёСЃСѓРµРј 5 СЃРµСЂРґРµС‡РµРє
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

        // Р”РѕР±Р°РІР»СЏРµРј РІРѕРїСЂРѕСЃС‹
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
                                setSaveStatus('saving', 'РЎРѕС…СЂР°РЅРµРЅРёРµ РїРѕСЂСЏРґРєР° РєР°СЂС‚РѕС‡РµРє...');
                                const meta = await getServerMetadata();
                                meta.orderOverrides = meta.orderOverrides || {};
                                meta.orderOverrides[currentContextKey] = currentQuestions.map(q => q.question);
                                const ok = await updateServerMetadata(meta);
                                setSaveStatus(ok ? 'success' : 'error', ok ? 'РџРѕСЂСЏРґРѕРє РёР·РјРµРЅРµРЅ' : 'РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ');
                            })();
                            // РџРµСЂРµСЂРёСЃРѕРІР°С‚СЊ С‚РµРєСѓС‰РёР№ СЃРїРёСЃРѕРє
                            displayQuestions(currentQuestions, title);
                        }
                    });
                }

                // РР·Р±СЂР°РЅРЅРѕРµ
                let isFav = false;
                let favClass = '';
                try {
                    const favorites = JSON.parse(localStorage.getItem('qaFavorites') || '[]');
                    isFav = favorites.includes(item.question);
                    favClass = isFav ? 'fav-active' : '';
                } catch (e) {
                    console.warn('Favorites error:', e);
                }

                // РћС‚РѕР±СЂР°Р¶Р°РµРј Р±РµР№РґР¶Рё СЃ СѓС‡С‘С‚РѕРј РїР»РµР№СЃС…РѕР»РґРµСЂРѕРІ
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

                // Р Р°СЃС‡РµС‚ СЃРµСЂРґРµС‡РµРє
                const cardProgress = progressMap[item.question];
                // If no progress or no easeFactor, treat as NEW (pass null)
                const ef = (cardProgress && cardProgress.easeFactor !== undefined) ? cardProgress.easeFactor : null;

                // РџСЂРёРјРµРЅСЏРµРј С„РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµ Рє РІРѕРїСЂРѕСЃСѓ Рё РѕС‚РІРµС‚Сѓ
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
            <button class="fav-btn ${favClass}" title="Р’ РёР·Р±СЂР°РЅРЅРѕРµ" style="position:absolute;top:10px;right:10px;width:24px;height:24px;background:none;border:none;cursor:pointer;padding:0;z-index:999;display:block !important;opacity:1 !important;">${starSvg(isFav)}</button>
            <div class="question">${questionHTML}</div>
            <div class="answer">${answerHTML}</div>
        `;

                // РћР±СЂР°Р±РѕС‚С‡РёРє РёР·Р±СЂР°РЅРЅРѕРіРѕ
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

                // РњРµРЅСЋ РєР°СЂС‚РѕС‡РєРё (в‹®) РІ СЂРµР¶РёРјРµ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ
                if (editMode) {
                    const qRow = resultItem.querySelector('.question-row');
                    const kebabBtn = document.createElement('button');
                    kebabBtn.className = 'kebab-btn';
                    kebabBtn.title = 'РњРµРЅСЋ РєР°СЂС‚РѕС‡РєРё';
                    kebabBtn.textContent = 'в‹®';
                    // РўС‘РјРЅРѕ-СЃРµСЂС‹Р№ СЃС‚РёР»СЊ РєРЅРѕРїРєРё в‹® РЅР° РєР°СЂС‚РѕС‡РєРµ
                    kebabBtn.style.background = '#444';
                    kebabBtn.style.color = '#eee';
                    kebabBtn.style.border = '1px solid #333';
                    kebabBtn.style.borderRadius = '4px';
                    kebabBtn.style.padding = '2px 6px';
                    qRow.appendChild(kebabBtn);

                    // рџ”Ґ Р“Р»РѕР±Р°Р»СЊРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ РјРѕРґР°Р»СЊРЅРѕРіРѕ РѕРєРЅР° СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ
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

                        // РџРѕР»СѓС‡Р°РµРј С„РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµ РёР· РєР°СЂС‚РѕС‡РєРё РёР»Рё СЃРѕР·РґР°С‘Рј РїСѓСЃС‚РѕРµ
                        const formatting = item.formatting || createEmptyFormatting();

                        // РЎРѕС…СЂР°РЅСЏРµРј СЃРѕСЃС‚РѕСЏРЅРёРµ
                        editModalState = {
                            originalCard: { ...item },
                            formatting: { ...formatting },
                            oldQuestion: item.question
                        };

                        // РЎРѕР·РґР°С‘Рј РјРѕРґР°Р»СЊРЅРѕРµ РѕРєРЅРѕ СЃ РїР°РЅРµР»СЊСЋ С„РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёСЏ
                        const modalHTML = `
                            <div class="edit-modal-overlay" id="edit-modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 10px;">
                                <div class="edit-modal" style="background: #1e1e1e; border-radius: 12px; padding: 16px; width: 100%; max-width: 700px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.5); box-sizing: border-box;">
                                    
                                    <!-- РљР°С‚РµРіРѕСЂРёСЏ Рё РїРѕРґРєР°С‚РµРіРѕСЂРёСЏ РІ 2 СЂСЏРґР° -->
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
                                        <div>
                                            <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">РљР°С‚РµРіРѕСЂРёСЏ</label>
                                            <select class="edit-category" style="width: 100%; padding: 10px 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 6px; color: #fff; font-size: 13px; box-sizing: border-box;">${categoryOptions}</select>
                                        </div>
                                        <div>
                                            <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">РџРѕРґРєР°С‚РµРіРѕСЂРёСЏ</label>
                                            <select class="edit-subcategory" style="width: 100%; padding: 10px 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 6px; color: #fff; font-size: 13px; box-sizing: border-box;">${subcategoryOptions}</select>
                                        </div>
                                    </div>
                                    
                                    <!-- РџР°РЅРµР»СЊ С„РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёСЏ -->
                                    <div style="margin-bottom: 12px;">
                                        <div class="format-toolbar" id="main-format-toolbar" style="width: 100%; box-sizing: border-box;"></div>
                                    </div>
                                    
                                    <!-- Р’РѕРїСЂРѕСЃ -->
                                    <div style="margin-bottom: 12px;">
                                        <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Р’РѕРїСЂРѕСЃ</label>
                                        <div class="edit-field-editor" id="edit-question-editor" contenteditable="true" spellcheck="true" style="width: 100%; min-height: 80px; padding: 10px 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 6px; color: #fff; font-size: 14px; line-height: 1.5; outline: none; word-wrap: break-word; overflow-wrap: break-word; box-sizing: border-box;"></div>
                                    </div>
                                    
                                    <!-- РћС‚РІРµС‚ -->
                                    <div style="margin-bottom: 16px;">
                                        <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">РћС‚РІРµС‚</label>
                                        <div class="edit-field-editor" id="edit-answer-editor" contenteditable="true" spellcheck="true" style="width: 100%; min-height: 80px; padding: 10px 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 6px; color: #fff; font-size: 14px; line-height: 1.5; outline: none; word-wrap: break-word; overflow-wrap: break-word; box-sizing: border-box;"></div>
                                    </div>
                                    
                                    <!-- РљРЅРѕРїРєРё -->
                                    <div style="display: flex; gap: 12px; justify-content: flex-end; flex-wrap: wrap;">
                                        <button class="edit-modal-btn cancel" id="edit-cancel-btn" style="padding: 10px 20px; background: transparent; border: 1px solid #444; border-radius: 6px; color: #aaa; cursor: pointer; font-size: 14px; flex-shrink: 0;">РћС‚РјРµРЅР°</button>
                                        <button class="edit-modal-btn save" id="edit-save-btn" style="padding: 10px 20px; background: #4CAF50; border: none; border-radius: 6px; color: #fff; cursor: pointer; font-size: 14px; flex-shrink: 0;">РЎРѕС…СЂР°РЅРёС‚СЊ</button>
                                    </div>
                                </div>
                            </div>
                            
                            <style>
                                /* Р’СЃРµ СЌР»РµРјРµРЅС‚С‹ РЅР° 100% С€РёСЂРёРЅС‹ */
                                #main-format-toolbar,
                                #edit-question-editor,
                                #edit-answer-editor,
                                .edit-category,
                                .edit-subcategory {
                                    width: 100% !important;
                                    max-width: 100% !important;
                                    box-sizing: border-box !important;
                                }
                                
                                /* РђРґР°РїС‚РёРІРЅС‹Рµ СЃС‚РёР»Рё РґР»СЏ РјРѕРґР°Р»СЊРЅРѕРіРѕ РѕРєРЅР° */
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
                                    /* РљРЅРѕРїРєРё РІ СЂСЏРґ РЅР° РјРѕР±РёР»СЊРЅРѕРј */
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

                        // РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ СЂРµРґР°РєС‚РѕСЂРѕРІ
                        const toolbarContainer = document.getElementById('main-format-toolbar');
                        const questionEditor = document.getElementById('edit-question-editor');
                        const answerEditor = document.getElementById('edit-answer-editor');
                        const categorySelect = document.querySelector('.edit-category');
                        const subcategorySelect = document.querySelector('.edit-subcategory');

                        // РџСЂРёРјРµРЅСЏРµРј С„РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµ Рє СЂРµРґР°РєС‚РѕСЂР°Рј
                        if (questionEditor) {
                            renderFormattingInEditor(questionEditor, item.question, formatting.question || []);
                        }
                        if (answerEditor) {
                            renderFormattingInEditor(answerEditor, item.answer, formatting.answer || []);
                        }

                        // РЎРѕР·РґР°С‘Рј Рё РёРЅРёС†РёР°Р»РёР·РёСЂСѓРµРј toolbar
                        if (toolbarContainer) {
                            const mainToolbar = createFormatToolbar('both');
                            toolbarContainer.appendChild(mainToolbar);

                            // РРЅРёС†РёР°Р»РёР·РёСЂСѓРµРј toolbar СЃ РѕР±РѕРёРјРё СЂРµРґР°РєС‚РѕСЂР°РјРё
                            initFormatToolbar(mainToolbar, questionEditor, answerEditor, editModalState.formatting, (newFormatting) => {
                                editModalState.formatting = newFormatting;
                            });
                        }

                        // РћР±СЂР°Р±РѕС‚С‡РёРє СЃРјРµРЅС‹ РєР°С‚РµРіРѕСЂРёРё
                        categorySelect.addEventListener('change', () => {
                            const newCategory = categorySelect.value;
                            const newSubs = (categoriesData.find(cat => cat.name === newCategory)?.subcategories || []).map(sub => `<option value="${sub.name}">${sub.name}</option>`).join('');
                            subcategorySelect.innerHTML = newSubs;
                        });

                        // РћР±СЂР°Р±РѕС‚С‡РёРє РѕС‚РјРµРЅС‹
                        document.getElementById('edit-cancel-btn').addEventListener('click', () => {
                            document.getElementById('edit-modal-overlay').remove();
                        });

                        // РћР±СЂР°Р±РѕС‚С‡РёРє СЃРѕС…СЂР°РЅРµРЅРёСЏ
                        document.getElementById('edit-save-btn').addEventListener('click', async () => {
                            // РџРѕР»СѓС‡Р°РµРј HTML РёР· СЂРµРґР°РєС‚РѕСЂРѕРІ
                            const questionHTML = questionEditor.innerHTML.trim();
                            const answerHTML = answerEditor.innerHTML.trim();

                            // РљРѕРЅРІРµСЂС‚РёСЂСѓРµРј HTML РІ С‚РµРєСЃС‚ + С„РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµ
                            const questionData = convertHtmlToTextAndFormatting(questionHTML);
                            const answerData = convertHtmlToTextAndFormatting(answerHTML);

                            const newCategory = categorySelect.value;
                            const newSubcategory = subcategorySelect.value;
                            const newQuestion = questionData.text.trim();
                            const newAnswer = answerData.text.trim();

                            if (!newQuestion || !newAnswer) {
                                alert('Р’РѕРїСЂРѕСЃ Рё РѕС‚РІРµС‚ РЅРµ РјРѕРіСѓС‚ Р±С‹С‚СЊ РїСѓСЃС‚С‹РјРё');
                                return;
                            }

                            const oldQuestion = editModalState.oldQuestion;

                            // РџРѕР»СѓС‡Р°РµРј С‚РµРєСѓС‰РµРµ С„РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµ
                            const currentFormatting = editModalState.formatting || createEmptyFormatting();

                            // РћР±РЅРѕРІР»СЏРµРј С„РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµ РЅРѕРІС‹РјРё РґР°РЅРЅС‹РјРё
                            currentFormatting.question = questionData.formatting || [];
                            currentFormatting.answer = answerData.formatting || [];

                            // РЎРѕС…СЂР°РЅСЏРµРј РІ override СЃ С„РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµРј
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

                            // РћР±РЅРѕРІР»СЏРµРј РёР·Р±СЂР°РЅРЅРѕРµ РµСЃР»Рё РЅСѓР¶РЅРѕ
                            const favorites = new Set(JSON.parse(localStorage.getItem('qaFavorites') || '[]'));
                            if (favorites.has(oldQuestion)) {
                                favorites.delete(oldQuestion);
                                favorites.add(newQuestion);
                                localStorage.setItem('qaFavorites', JSON.stringify(Array.from(favorites)));

                                import('../srs/storage.js').then(({ syncFavorite }) => {
                                    try { syncFavorite(newQuestion, true); } catch (e) { }
                                }).catch(() => { });
                            }

                            // Р—Р°РєСЂС‹РІР°РµРј РјРѕРґР°Р»СЊРЅРѕРµ РѕРєРЅРѕ
                            document.getElementById('edit-modal-overlay').remove();

                            // РџРµСЂРµСЂРёСЃРѕРІС‹РІР°РµРј РІРѕРїСЂРѕСЃС‹
                            displayQuestions(currentQuestions.map(q => q.question === oldQuestion ? { ...q, category: newCategory, subcategory: newSubcategory, question: newQuestion, answer: newAnswer, formatting: currentFormatting } : q), title);

                            // РЎРѕС…СЂР°РЅСЏРµРј РЅР° СЃРµСЂРІРµСЂ
                            const rowEl = resultItem.querySelector('.question-row');
                            setInlineSaveStatus(rowEl, 'saving');
                            const ok = await saveMergedToServer();
                            setInlineSaveStatus(rowEl, ok ? 'success' : 'error');
                        });

                        // Р—Р°РєСЂС‹С‚РёРµ РїРѕ РєР»РёРєСѓ РЅР° overlay
                        document.getElementById('edit-modal-overlay').addEventListener('click', (e) => {
                            if (e.target === e.currentTarget) {
                                document.getElementById('edit-modal-overlay').remove();
                            }
                        });
                    };

                    // РљРЅРѕРїРєР° РєР°СЂР°РЅРґР°С€Р° СѓРґР°Р»РµРЅР°: СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ РґРѕСЃС‚СѓРїРЅРѕ С‡РµСЂРµР· РјРµРЅСЋ в‹®

                    // рџ”Ґ РСЃРїРѕР»СЊР·СѓРµРј РіР»РѕР±Р°Р»СЊРЅСѓСЋ С„СѓРЅРєС†РёСЋ СЃ РїСЂРѕРІРµСЂРєРѕР№ qaUserCards
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
                    <button data-act="edit">РР·РјРµРЅРёС‚СЊ</button>
                    <button data-act="duplicate">Р”СѓР±Р»РёСЂРѕРІР°С‚СЊ</button>
                    <button data-act="delete">РЈРґР°Р»РёС‚СЊ</button>
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
                                // РџРѕРєР°Р·Р°С‚СЊ РёРЅРґРёРєР°С‚РѕСЂ РїСЂРѕРіСЂРµСЃСЃР°
                                const rowEl = resultItem.querySelector('.question-row');
                                setInlineSaveStatus(rowEl, 'saving');

                                // РџРµСЂРµРјРµС‰Р°РµРј РЅР° СЃРµСЂРІРµСЂ РІ РєРѕСЂР·РёРЅСѓ
                                moveToServerTrash([item]).then(async (trashOk) => {
                                    if (trashOk) {
                                        // РћРїС‚РёРјРёСЃС‚РёС‡РЅРѕ РґРѕР±Р°РІР»СЏРµРј РІ Р»РѕРєР°Р»СЊРЅС‹Рµ РєСЌС€Рё РєРѕСЂР·РёРЅС‹
                                        serverTrashSet.add(item.question);
                                        // РћР±РЅРѕРІР»СЏРµРј Р»РѕРєР°Р»СЊРЅС‹Р№ СЃРїРёСЃРѕРє РєРѕСЂР·РёРЅС‹, С‡С‚РѕР±С‹ СЃСЂР°Р·Сѓ РїРѕРєР°Р·Р°С‚СЊ РєР°СЂС‚РѕС‡РєСѓ
                                        try {
                                            serverTrashItems = [
                                                { item: { ...item } },
                                                ...serverTrashItems.filter(t => t.item?.question !== item.question)
                                            ];
                                        } catch (_) { }

                                        // РЈР±РµРґРёРјСЃСЏ, С‡С‚Рѕ РїР°РЅРµР»СЊ РєРѕСЂР·РёРЅС‹ РІРёРґРЅР° РІ СЂРµР¶РёРјРµ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ
                                        const tp = document.querySelector('.trash-panel');
                                        if (tp && editMode) { tp.style.display = 'block'; }

                                        // РџРµСЂРµСЂРёСЃРѕРІС‹РІР°РµРј РїР°РЅРµР»СЊ РєРѕСЂР·РёРЅС‹ Рё С‚РµРєСѓС‰РёР№ РєРѕРЅС‚РµРєСЃС‚
                                        renderTrashPanel();
                                        refreshCurrentContext();

                                        // РџС‹С‚Р°РµРјСЃСЏ СЃРёРЅС…СЂРѕРЅРёР·РёСЂРѕРІР°С‚СЊ СЃ СЃРµСЂРІРµСЂРЅРѕР№ РєРѕСЂР·РёРЅРѕР№ (РЅРµ Р±Р»РѕРєРёСЂСѓРµС‚ UI)
                                        try { await refreshServerTrash(); } catch (_) { }

                                        setInlineSaveStatus(rowEl, 'success');
                                        setSaveStatus('success', 'РљР°СЂС‚РѕС‡РєР° РїРµСЂРµРјРµС‰РµРЅР° РІ РєРѕСЂР·РёРЅСѓ');

                                        // рџ”Ґ РЎРѕС…СЂР°РЅСЏРµРј РЅР° СЃРµСЂРІРµСЂ Р‘Р•Р— forceReloadData
                                        saveMergedToServer(true).then(saveOk => {
                                            if (!saveOk) setInlineSaveStatus(rowEl, 'error', 'РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ');
                                        });
                                    } else {
                                        setInlineSaveStatus(rowEl, 'error', 'РћС€РёР±РєР° СѓРґР°Р»РµРЅРёСЏ');
                                    }
                                });
                            } else if (act === 'duplicate') {
                                // Show visual indicator
                                const rowEl = resultItem.querySelector('.question-row');
                                setInlineSaveStatus(rowEl, 'saving');

                                const copyQ = genUniqueQuestion(item.question);
                                const duplicatedItem = { ...item, question: copyQ };

                                console.log('[DUPLICATE] РЎРѕР·РґР°РЅ РґСѓР±Р»РёРєР°С‚:', {
                                    original: item.question?.substring(0, 50),
                                    copy: copyQ,
                                    timestamp: Date.now()
                                });

                                // рџ”Ґ Р’СЃС‚Р°РІР»СЏРµРј РґСѓР±Р»РёРєР°С‚ РЎР РђР—РЈ РџРћРЎР›Р• РѕСЂРёРіРёРЅР°Р»Р° РІ qaUserCards
                                const sessionUserRaw = localStorage.getItem('qaSessionUser');
                                if (sessionUserRaw) {
                                    const userCards = getQaUserCards();
                                    if (userCards) {
                                        // РС‰РµРј РѕСЂРёРіРёРЅР°Р» РїРѕ РІРѕРїСЂРѕСЃСѓ (РјРѕР¶РµС‚ РѕС‚Р»РёС‡Р°С‚СЊСЃСЏ РѕС‚ item.question РµСЃР»Рё Р±С‹Р»Рё РёР·РјРµРЅРµРЅРёСЏ)
                                        const originalIndex = userCards.findIndex(c =>
                                            c.question === item.question ||
                                            (c.category === item.category && c.subcategory === item.subcategory && c.answer === item.answer)
                                        );
                                        if (originalIndex >= 0) {
                                            // Р’СЃС‚Р°РІР»СЏРµРј РґСѓР±Р»РёРєР°С‚ РїРѕСЃР»Рµ РѕСЂРёРіРёРЅР°Р»Р°
                                            userCards.splice(originalIndex + 1, 0, duplicatedItem);
                                            setQaUserCards(userCards);
                                        } else {
                                            // Р•СЃР»Рё РЅРµ РЅР°С€Р»Рё, РґРѕР±Р°РІР»СЏРµРј РІ РєРѕРЅРµС†
                                            userCards.push(duplicatedItem);
                                            setQaUserCards(userCards);
                                        }
                                    }

                                    // рџ”Ґ Р”РћР‘РђР’Р›РЇР•Рњ РІ qaNewItems С‡С‚РѕР±С‹ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ РІРёРґРµР»Р° РЅРѕРІСѓСЋ РєР°СЂС‚РѕС‡РєСѓ
                                    const newItems = getNewItems();
                                    if (!newItems.some(n => n.question === copyQ)) {
                                        newItems.push(duplicatedItem);
                                        localStorage.setItem('qaNewItems', JSON.stringify(newItems));

                                        console.log('[DUPLICATE] Р”РѕР±Р°РІР»РµРЅРѕ РІ qaNewItems, РІСЃРµРіРѕ:', newItems.length);
                                    }
                                }

                                // Track duplication on server
                                trackServerDuplication(item.question, copyQ).then(trackOk => {
                                    if (trackOk) {
                                        // рџ”Ґ РћР±РЅРѕРІР»СЏРµРј UI СЃСЂР°Р·Сѓ, Р±РµР· forceReloadData, С‡С‚РѕР±С‹ СЃРѕС…СЂР°РЅРёС‚СЊ РїРѕСЂСЏРґРѕРє РєР°СЂС‚РѕС‡РµРє
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

                                        // рџ”Ґ РЎРѕС…СЂР°РЅСЏРµРј РЅР° СЃРµСЂРІРµСЂ Р‘Р•Р— forceReloadData
                                        console.log('[DUPLICATE] Р’С‹Р·С‹РІР°РµРј saveMergedToServer(true)');
                                        saveMergedToServer(true).then(saveOk => {
                                            if (!saveOk) {
                                                setInlineSaveStatus(rowEl, 'error', 'РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ');
                                            }
                                        });
                                    } else {
                                        setInlineSaveStatus(rowEl, 'error', 'РћС€РёР±РєР° РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ');
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
                // Р’РёР·СѓР°Р»СЊРЅРѕ РїРѕРєР°Р·С‹РІР°РµРј, С‡С‚Рѕ СЌР»РµРјРµРЅС‚ СЃР»РѕРјР°Р»СЃСЏ (РґР»СЏ РѕС‚Р»Р°РґРєРё)
                try {
                    const errDiv = document.createElement('div');
                    errDiv.style.border = '1px solid red';
                    errDiv.style.color = 'red';
                    errDiv.style.padding = '10px';
                    errDiv.textContent = `РћС€РёР±РєР° РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ РІРѕРїСЂРѕСЃР°: ${err.message}`;
                    resultsList.appendChild(errDiv);
                } catch (_) { }
            }
        });
    } catch (e) {
        console.error('Critical error in displayQuestions:', e);
    }
}
