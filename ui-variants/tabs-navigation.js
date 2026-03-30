// Р вЂ™Р В°РЎР‚Р С‘Р В°Р Р…РЎвЂљ 3: Р СћР В°Р В±РЎвЂ№ Р Т‘Р В»РЎРЏ Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р в„– Р С‘ Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р С‘ Р Т‘Р В»РЎРЏ Р С—Р С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р в„–
console.log('[TABS-NAVIGATION] Module loaded');

// Р ВР СР С—Р С•РЎР‚РЎвЂљР С‘РЎР‚РЎС“Р ВµР С Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р Вµ Р С‘ Р С–Р ВµР Р…Р ВµРЎР‚Р В°РЎвЂљР С•РЎР‚ Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р в„–
import { uniqueQaData } from '../all-data.js';
import { buildCategoriesFromData } from '../computed-categories.js';
import { setNormalizationDisabled } from '../load-json-data.js';
import { getProgressMap } from '../srs/stats-utils.js';
import { getDifficultyLevel, getLevelProgress } from '../srs/algorithm.js';
import { applyFormatting, createEmptyFormatting, convertHtmlToTextAndFormatting, renderFormattingInEditor } from '../srs/text-formatter.js';
import { createFormatToolbar, initFormatToolbar } from '../srs/format-toolbar.js';

console.log('[TABS-NAVIGATION] Imports completed');

// Р вЂњР В»Р С•Р В±Р В°Р В»РЎРЉР Р…РЎвЂ№Р Вµ РЎвЂћР В»Р В°Р С–Р С‘/РЎРѓР С•РЎРѓРЎвЂљР С•РЎРЏР Р…Р С‘РЎРЏ Р Т‘Р В»РЎРЏ РЎР‚Р ВµР В¶Р С‘Р СР В° РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ Р С‘ Р В»Р С•Р С–Р С‘Р Р…Р В°
let editMode = (typeof localStorage !== 'undefined' && localStorage.getItem('qaEditMode') === 'true') ? true : false;
let currentContextKey = 'all';
let currentQuestions = [];
let sortMode = 'default'; // Global sort state
let resultsListRef = null;
// Р С™РЎРЊРЎв‚¬ Р С”Р С•РЎР‚Р В·Р С‘Р Р…РЎвЂ№ Р Р…Р В° РЎРѓРЎвЂљР С•РЎР‚Р С•Р Р…Р Вµ РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚Р В° (Р Р…Р Вµ Р С‘РЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р ВµР С localStorage Р Т‘Р В»РЎРЏ РЎС“Р Т‘Р В°Р В»РЎвЂР Р…Р Р…РЎвЂ№РЎвЂ¦ Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР ВµР С”)
let serverTrashSet = new Set();
let serverTrashItems = [];
// Р С™Р С•Р Р…РЎвЂћР С‘Р С–РЎС“РЎР‚Р С‘РЎР‚РЎС“Р ВµР СРЎвЂ№Р в„– URL Р В±РЎРЊР С”Р ВµР Р…Р Т‘Р В° (Р СР С•Р В¶Р Р…Р С• Р В·Р В°Р Т‘Р В°РЎвЂљРЎРЉ РЎвЂЎР ВµРЎР‚Р ВµР В· localStorage Р С”Р В»РЎР‹РЎвЂЎ 'qaBackendUrl')
// Р СџР С• РЎС“Р СР С•Р В»РЎвЂЎР В°Р Р…Р С‘РЎР‹ Р С‘РЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р ВµР С Р С—Р С•РЎР‚РЎвЂљ 8765, РЎвЂљР В°Р С” Р С”Р В°Р С” Р В»Р С•Р С”Р В°Р В»РЎРЉР Р…РЎвЂ№Р в„– РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚ Р В·Р В°Р С—РЎС“РЎвЂ°Р ВµР Р… РЎвЂљР В°Р С
const BACKEND_URL = (typeof localStorage !== 'undefined' && localStorage.getItem('qaBackendUrl')) || window.location.origin;

// СЂСџвЂќвЂ™ HELPER: User-specific localStorage keys (Р ВР РЋР СџР В Р С’Р вЂ™Р вЂєР вЂўР СњР ВР вЂў: РЎС“ Р С”Р В°Р В¶Р Т‘Р С•Р С–Р С• Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЏ РЎРѓР Р†Р С•Р в„– Р С”Р В»РЎР‹РЎвЂЎ)
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

// Р вЂєР С•Р С”Р В°Р В»РЎРЉР Р…РЎвЂ№Р Вµ РЎвЂ¦Р ВµР В»Р С—Р ВµРЎР‚РЎвЂ№ Р Т‘Р В»РЎРЏ storage
function getLS(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || fallback); } catch { return JSON.parse(fallback); }
}
function setLS(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function getOrderForContext(ctx) { const o = getLS('qaOrderOverrides', '{}'); return o[ctx] || null; }
function setOrderForContext(ctx, orderArr) { const o = getLS('qaOrderOverrides', '{}'); o[ctx] = orderArr; setLS('qaOrderOverrides', o); }
function getOverrides() { return getLS('qaAdminOverrides', '{}'); }
// Р Р€РЎРѓРЎвЂљР В°Р Р…Р В°Р Р†Р В»Р С‘Р Р†Р В°Р ВµР С overrides Р Р† localStorage (Р Т‘Р В»РЎРЏ РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘РЎРЏ Р С‘Р В·Р СР ВµР Р…Р ВµР Р…Р С‘Р в„– Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР ВµР С”)
function setOverrides(map) { setLS('qaAdminOverrides', map); }
function getNewItems() { return getLS('qaNewItems', '[]'); }
function getDeletedItems() { return getLS('qaDeletedItems', '{}'); }
function setDeletedItems(map) { setLS('qaDeletedItems', map); }

// Р СџР С•Р В»РЎС“РЎвЂЎР ВµР Р…Р С‘Р Вµ Р В°Р С”РЎвЂљРЎС“Р В°Р В»РЎРЉР Р…РЎвЂ№РЎвЂ¦ Р Т‘Р В°Р Р…Р Р…РЎвЂ№РЎвЂ¦ РЎРѓ РЎС“РЎвЂЎР ВµРЎвЂљР С•Р С РЎС“Р Т‘Р В°Р В»Р ВµР Р…Р Р…РЎвЂ№РЎвЂ¦
function getRuntimeData() {
    // Р РЋР Р…Р В°РЎвЂЎР В°Р В»Р В° Р С—РЎР‚Р С•Р В±РЎС“Р ВµР С Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С‘РЎвЂљРЎРЉ Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р Вµ Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЏ Р С‘Р В· localStorage
    let baseData = uniqueQaData;
    try {
        const userCards = getQaUserCards();
        if (userCards && Array.isArray(userCards) && userCards.length > 0) {
            baseData = userCards;
        }
    } catch (e) {
        console.warn('[getRuntimeData] Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С”Р С‘ userCards:', e);
    }

    const base = baseData.map(item => ({ ...item }));
    const overrides = getOverrides();
    const newItems = getNewItems();
    const deleted = getDeletedItems();
    // Р СџРЎР‚Р С‘Р СР ВµР Р…РЎРЏР ВµР С overrides (Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏ/Р С—Р С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏ/Р Р†Р С•Р С—РЎР‚Р С•РЎРѓ/Р С•РЎвЂљР Р†Р ВµРЎвЂљ/РЎвЂћР С•РЎР‚Р СР В°РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘Р Вµ)
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
            if (ov.formatting) updated.formatting = ov.formatting;  // СЂСџвЂќТђ Р СџРЎР‚Р С‘Р СР ВµР Р…РЎРЏР ВµР С РЎвЂћР С•РЎР‚Р СР В°РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘Р Вµ
            // Р вЂўРЎРѓР В»Р С‘ Р С‘Р В·Р СР ВµР Р…Р С‘Р В»Р С•РЎРѓРЎРЉ Р С”Р В»РЎР‹РЎвЂЎР ВµР Р†Р С•Р Вµ Р С—Р С•Р В»Р Вµ Р Р†Р С•Р С—РЎР‚Р С•РЎРѓР В° РІР‚вЂќ Р С•Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С Р С”Р В»РЎР‹РЎвЂЎ Р Р† Map
            if (ov.question && ov.question !== origQ) {
                byQuestion.delete(origQ);
                byQuestion.set(updated.question, updated);
            } else {
                byQuestion.set(origQ, updated);
            }
        } else {
            // Р вЂўРЎРѓР В»Р С‘ Р С‘РЎРѓРЎвЂ¦Р С•Р Т‘Р Р…Р С•Р С–Р С• Р Р†Р С•Р С—РЎР‚Р С•РЎРѓР В° Р Р…Р ВµРЎвЂљ Р Р† Р В±Р В°Р В·Р Вµ, РЎР‚Р В°РЎРѓРЎРѓР СР В°РЎвЂљРЎР‚Р С‘Р Р†Р В°Р ВµР С Р С”Р В°Р С” Р Р…Р С•Р Р†РЎвЂ№Р в„– РЎРЊР В»Р ВµР СР ВµР Р…РЎвЂљ
            byQuestion.set(ov.question || origQ, {
                question: ov.question || origQ,
                answer: ov.answer || '',
                category: ov.category || 'Р вЂР ВµР В· Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р С‘',
                subcategory: ov.subcategory || 'Р С›Р В±РЎвЂ°Р ВµР Вµ',
                formatting: ov.formatting || createEmptyFormatting()  // СЂСџвЂќТђ Р В¤Р С•РЎР‚Р СР В°РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘Р Вµ Р Т‘Р В»РЎРЏ Р Р…Р С•Р Р†РЎвЂ№РЎвЂ¦ Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР ВµР С”
            });
        }
    });
    // Р вЂќР С•Р В±Р В°Р Р†Р В»РЎРЏР ВµР С Р Р…Р С•Р Р†РЎвЂ№Р Вµ РЎРЊР В»Р ВµР СР ВµР Р…РЎвЂљРЎвЂ№
    newItems.forEach(ni => {
        if (!byQuestion.has(ni.question)) byQuestion.set(ni.question, { ...ni });
    });
    // Р ВРЎРѓР С”Р В»РЎР‹РЎвЂЎР В°Р ВµР С РЎС“Р Т‘Р В°Р В»РЎвЂР Р…Р Р…РЎвЂ№Р Вµ
    const merged = Array.from(byQuestion.values()).filter(i => !deleted[i.question] && !serverTrashSet.has(i.question));
    return merged;
}

// СЂСџвЂќТђ Р В¤РЎС“Р Р…Р С”РЎвЂ Р С‘РЎРЏ Р С‘РЎРѓР С—РЎР‚Р В°Р Р†Р В»Р ВµР Р…Р С‘РЎРЏ Р С”Р С•Р Т‘Р С‘РЎР‚Р С•Р Р†Р С”Р С‘ Р Р† Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р В°РЎвЂ¦
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

        // СЂСџвЂќВ§ Р ВРЎРѓР С—РЎР‚Р В°Р Р†Р В»РЎРЏР ВµР С Р С‘РЎРѓР С”Р В°Р В¶РЎвЂР Р…Р Р…РЎС“РЎР‹ Р С”Р С•Р Т‘Р С‘РЎР‚Р С•Р Р†Р С”РЎС“ Р Р† category
        if (card.category === 'Р вЂќР С•Р С”РЎС“Р СР ВµР Р…РЎвЂљР В°РЎвЂ Р С‘РЎРЏ' || card.category === 'Р вЂќР С”РЎС“Р СР ВµР Р…РЎвЂљР В°РЎвЂ Р С‘РЎРЏ' || card.category === 'Р вЂќР С”РЎС“Р СР ВµР Р…РЎвЂљР В°РЎвЂ Р С‘РЎРЏ') {
            card.category = 'Р вЂќР С•Р С”РЎС“Р СР ВµР Р…РЎвЂљР В°РЎвЂ Р С‘РЎРЏ';
            changed = true;
        }

        // СЂСџвЂќВ§ Р ВРЎРѓР С—РЎР‚Р В°Р Р†Р В»РЎРЏР ВµР С Р С‘РЎРѓР С”Р В°Р В¶РЎвЂР Р…Р Р…РЎС“РЎР‹ Р С”Р С•Р Т‘Р С‘РЎР‚Р С•Р Р†Р С”РЎС“ Р Р† subcategory
        if (card.subcategory === 'Р СћР С‘Р С—РЎвЂ№ РЎвЂљРЎР‚Р ВµР В±Р С•Р Р†Р В°Р Р…Р С‘Р в„–' || card.subcategory === 'Р СћР С‘Р С—РЎвЂ№ РЎвЂљРЎР‚Р ВµР С•Р Р†Р В°Р Р…Р С‘Р в„–' || card.subcategory === 'Р СћР С‘Р С—РЎвЂ№ РЎвЂљРЎР‚Р ВµР С•Р Р†Р В°Р Р…Р С‘Р в„–') {
            card.subcategory = 'Р СћР С‘Р С—РЎвЂ№ РЎвЂљРЎР‚Р ВµР В±Р С•Р Р†Р В°Р Р…Р С‘Р в„–';
            changed = true;
        }

        return card;
    });

    if (changed) {
        // Р СџР С•Р Т‘РЎРѓРЎвЂЎР С‘РЎвЂљРЎвЂ№Р Р†Р В°Р ВµР С РЎРѓР С”Р С•Р В»РЎРЉР С”Р С• Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР ВµР С” Р В±РЎвЂ№Р В»Р С• Р С‘РЎРѓР С—РЎР‚Р В°Р Р†Р В»Р ВµР Р…Р С•
        const fixedCount = userCards.filter((c, i) =>
            c.category !== fixedCards[i].category || c.subcategory !== fixedCards[i].subcategory
        ).length;

        setQaUserCards(fixedCards);
        // СЂСџвЂќТђ Р СњР вЂў Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р В»РЎРЏР ВµР С Р Р…Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚ Р В°Р Р†РЎвЂљР С•Р СР В°РЎвЂљР С‘РЎвЂЎР ВµРЎРѓР С”Р С‘ РІР‚вЂќ Р С‘РЎРѓР С—РЎР‚Р В°Р Р†Р В»Р ВµР Р…Р С‘РЎРЏ РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏРЎвЂљРЎРѓРЎРЏ Р С—РЎР‚Р С‘ РЎРѓР В»Р ВµР Т‘РЎС“РЎР‹РЎвЂ°Р ВµР С РЎРЏР Р†Р Р…Р С•Р С РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘Р С‘
        console.log('[fixEncodingIssues] Р ВРЎРѓР С—РЎР‚Р В°Р Р†Р В»Р ВµР Р…Р С• Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР ВµР С”:', fixedCount, '(РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏРЎвЂљРЎРѓРЎРЏ Р С—РЎР‚Р С‘ РЎРѓР В»Р ВµР Т‘РЎС“РЎР‹РЎвЂ°Р ВµР С РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘Р С‘)');
    }
}

function getCategoryPlaceholders() { return getLS('qaCategoryPlaceholders', '{}'); }
function setCategoryPlaceholders(obj) { setLS('qaCategoryPlaceholders', obj); }
// Р СџР С•РЎР‚РЎРЏР Т‘Р С•Р С” Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р в„–: РЎвЂ¦РЎР‚Р В°Р Р…Р С‘РЎвЂљРЎРѓРЎРЏ Р С”Р В°Р С” Р СР В°РЎРѓРЎРѓР С‘Р Р† Р С‘Р СРЎвЂР Р… Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р в„–
function getCategoryOrder() { return getLS('qaCategoryOrder', '[]'); }
function setCategoryOrder(arr) { setLS('qaCategoryOrder', Array.isArray(arr) ? arr : []); }
// Р СџР С•РЎР‚РЎРЏР Т‘Р С•Р С” Р С—Р С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р в„– Р С—Р С• Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏР С
function getSubcategoryOrderMap() { return getLS('qaSubcategoryOrder', '{}'); }
function setSubcategoryOrderMap(map) { setLS('qaSubcategoryOrder', map); }
function getSubcategoryOrderFor(categoryName) { const m = getSubcategoryOrderMap(); return m[categoryName] || []; }
function setSubcategoryOrderFor(categoryName, arr) { const m = getSubcategoryOrderMap(); m[categoryName] = Array.isArray(arr) ? arr : []; setSubcategoryOrderMap(m); }

// Р ВР Р…Р Т‘Р С‘Р С”Р В°РЎвЂљР С•РЎР‚ Р С‘Р Р…Р В»Р В°Р в„–Р Р…-РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘РЎРЏ Р Р…Р В° РЎРѓРЎвЂљРЎР‚Р С•Р С”Р Вµ Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р С‘
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
    const texts = { saving: 'Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘Р ВµРІР‚В¦', success: 'Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С•', error: 'Р С›РЎв‚¬Р С‘Р В±Р С”Р В°' };
    badge.textContent = message || texts[status] || '';
    badge.style.background = colors[status] || '#444';
    badge.style.color = '#eee';
    badge.style.border = '1px solid #333';
    if (status !== 'saving') {
        setTimeout(() => { if (badge && badge.parentNode === rowEl) badge.remove(); }, 1500);
    }
}

// Р вЂњР ВµР Р…Р ВµРЎР‚Р В°РЎвЂљР С•РЎР‚ РЎС“Р Р…Р С‘Р С”Р В°Р В»РЎРЉР Р…Р С•Р С–Р С• РЎвЂљР ВµР С”РЎРѓРЎвЂљР В° Р Р†Р С•Р С—РЎР‚Р С•РЎРѓР В° Р Т‘Р В»РЎРЏ Р С”Р С•Р С—Р С‘Р в„–
function genUniqueQuestionGlobal(baseQ) {
    // Р С›РЎвЂЎР С‘РЎвЂ°Р В°Р ВµР С Р В±Р В°Р В·Р С•Р Р†РЎвЂ№Р в„– Р Р†Р С•Р С—РЎР‚Р С•РЎРѓ Р С•РЎвЂљ РЎРѓРЎС“РЎвЂћРЎвЂћР С‘Р С”РЎРѓР С•Р Р† Р С”Р С•Р С—Р С‘Р в„–
    const cleanBase = baseQ.replace(/ \(Р С”Р С•Р С—Р С‘РЎРЏ( \d+)?\)$/, '');

    const exists = (q) => {
        // Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЏР ВµР С Р Р† uniqueQaData
        if (uniqueQaData.some(i => i.question === q)) return true;
        // Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЏР ВµР С Р Р† newItems
        if (getNewItems().some(i => i.question === q)) return true;
        // Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЏР ВµР С Р Р† qaUserCards
        try {
            const userCardsRaw = localStorage.getItem('qaUserCards');
            if (userCardsRaw) {
                const userCards = JSON.parse(userCardsRaw);
                if (Array.isArray(userCards) && userCards.some(i => i.question === q)) return true;
            }
        } catch (e) { }
        return false;
    };

    // Р ВРЎвЂ°Р ВµР С Р Р†РЎРѓР Вµ РЎРѓРЎС“РЎвЂ°Р ВµРЎРѓРЎвЂљР Р†РЎС“РЎР‹РЎвЂ°Р С‘Р Вµ Р С”Р С•Р С—Р С‘Р С‘
    let i = 1;
    let candidate = `${cleanBase} (Р С”Р С•Р С—Р С‘РЎРЏ)`;
    while (exists(candidate)) {
        i++;
        candidate = `${cleanBase} (Р С”Р С•Р С—Р С‘РЎРЏ ${i})`;
    }
    return candidate;
}
// Р СџР В»Р ВµР в„–РЎРѓРЎвЂ¦Р С•Р В»Р Т‘Р ВµРЎР‚РЎвЂ№ Р Т‘Р В»РЎРЏ Р С•РЎвЂљР С•Р В±РЎР‚Р В°Р В¶Р В°Р ВµР СРЎвЂ№РЎвЂ¦ Р Р…Р В°Р В·Р Р†Р В°Р Р…Р С‘Р в„– Р С—Р С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р в„– (Р С—Р С• Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏР С)
function getSubcategoryPlaceholders() { return getLS('qaSubcategoryPlaceholders', '{}'); }
function setSubcategoryPlaceholders(obj) { setLS('qaSubcategoryPlaceholders', obj); }

// Global helper function for authenticated fetch requests (NO TOKEN - username/password only)
async function fetchWithAuth(url, options = {}) {
    const user = loggedInUser;

    // Р вЂќР С•Р В±Р В°Р Р†Р В»РЎРЏР ВµР С username Р Р† query Р С—Р В°РЎР‚Р В°Р СР ВµРЎвЂљРЎР‚РЎвЂ№
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
    // Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЏР ВµР С, Р ВµРЎРѓРЎвЂљРЎРЉ Р В»Р С‘ Р В°Р С”РЎвЂљР С‘Р Р†Р Р…Р В°РЎРЏ РЎРѓР ВµРЎРѓРЎРѓР С‘РЎРЏ
    const sessionUserRaw = localStorage.getItem('qaSessionUser');
    if (!sessionUserRaw) {
        return;
    }

    let username = null;
    try {
        const u = JSON.parse(sessionUserRaw);
        if (u && u.username) username = u.username;
    } catch (e) {
        console.error('[AutoLoad] Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р С—Р В°РЎР‚РЎРѓР С‘Р Р…Р С–Р В° qaSessionUser:', e);
        return;
    }

    if (!username) {
        return;
    }

    // Р вЂ”Р В°Р С–РЎР‚РЎС“Р В¶Р В°Р ВµР С Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р Вµ РЎвЂЎР ВµРЎР‚Р ВµР В· srs/storage.js
    // СЂСџвЂќТђ forceReload=true Р Т‘Р В»РЎРЏ Р С–Р В°РЎР‚Р В°Р Р…РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р Р…Р С•Р в„– РЎРѓР С‘Р Р…РЎвЂ¦РЎР‚Р С•Р Р…Р С‘Р В·Р В°РЎвЂ Р С‘Р С‘ Р СР ВµР В¶Р Т‘РЎС“ РЎС“РЎРѓРЎвЂљРЎР‚Р С•Р в„–РЎРѓРЎвЂљР Р†Р В°Р СР С‘
    try {
        const { loadFromServer } = await import('../srs/storage.js?v=6.20.8');
        await loadFromServer(true);
    } catch (e) {
        console.error('[AutoLoad] Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р В°Р Р†РЎвЂљР С•Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С”Р С‘:', e);
    }
}

// Р СџРЎР‚Р С•РЎРѓРЎвЂљР ВµР в„–РЎв‚¬Р В°РЎРЏ Р В·Р В°Р С–Р В»РЎС“РЎв‚¬Р С”Р В° Р В»Р С•Р С–Р С‘Р Р…Р В° РІР‚вЂќ Р В·Р В°Р СР ВµР Р…Р С‘РЎвЂљР Вµ verifyCredentialsWithSupabase Р Р…Р В° РЎР‚Р ВµР В°Р В»РЎРЉР Р…РЎС“РЎР‹ Р С—РЎР‚Р С•Р Р†Р ВµРЎР‚Р С”РЎС“
let loggedInUser = null;
function verifyCredentialsWithSupabase(email, password) {
    // TODO: Р В·Р Т‘Р ВµРЎРѓРЎРЉ Р С—Р С•Р Т‘Р С”Р В»РЎР‹РЎвЂЎР ВµР Р…Р С‘Р Вµ Р С” Supabase (REST/JS SDK) Р С‘ Р С—РЎР‚Р С•Р Р†Р ВµРЎР‚Р С”Р В° РЎвЂ¦Р ВµРЎв‚¬Р В° Р С—Р В°РЎР‚Р С•Р В»РЎРЏ
    // Р СџР С•Р С”Р В° Р Т‘Р С•Р С—РЎС“РЎРѓР С”Р В°Р ВµР С Р В»РЎР‹Р В±Р С•Р в„– Р Р…Р ВµР С—РЎС“РЎРѓРЎвЂљР С•Р в„– Р В»Р С•Р С–Р С‘Р Р…
    return true;
}

// Р В¤РЎС“Р Р…Р С”РЎвЂ Р С‘РЎРЏ Р Т‘Р В»РЎРЏ Р С‘Р Р…Р С‘РЎвЂ Р С‘Р В°Р В»Р С‘Р В·Р В°РЎвЂ Р С‘Р С‘ Р Р…Р В°Р Р†Р С‘Р С–Р В°РЎвЂ Р С‘Р С‘ РЎРѓ РЎвЂљР В°Р В±Р В°Р СР С‘
// Р вЂњР В»Р С•Р В±Р В°Р В»РЎРЉР Р…РЎвЂ№Р в„– Р С‘Р Р…Р Т‘Р С‘Р С”Р В°РЎвЂљР С•РЎР‚ РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘РЎРЏ (РЎРЊР В»Р ВµР СР ВµР Р…РЎвЂљ Р Р†Р ВµРЎР‚РЎвЂ¦Р Р…Р ВµР в„– Р С—Р В°Р Р…Р ВµР В»Р С‘)
let globalSaveStatusEl = null;

// ========== Р В¤РЎС“Р Р…Р С”РЎвЂ Р С‘Р С‘ РЎС“Р С—РЎР‚Р В°Р Р†Р В»Р ВµР Р…Р С‘РЎРЏ Р В°Р Р…Р С‘Р СР В°РЎвЂ Р С‘Р ВµР в„– Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С”Р С‘ ==========
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
    // Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЏР ВµР С, Р Р…Р Вµ Р С•РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљР В° Р В»Р С‘ РЎРѓРЎвЂљРЎР‚Р В°Р Р…Р С‘РЎвЂ Р В° РЎРѓРЎвЂљР В°РЎвЂљР С‘РЎРѓРЎвЂљР С‘Р С”Р С‘
    const isStatsPage = location.hash === '#/stats';
    console.log('[initTabsNavigation] Called! isStatsPage:', isStatsPage, 'location.hash:', location.hash);

    // Р СџР С•Р С”Р В°Р В·РЎвЂ№Р Р†Р В°Р ВµР С Р В°Р Р…Р С‘Р СР В°РЎвЂ Р С‘РЎР‹ Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С”Р С‘ Р С—РЎР‚Р С‘ РЎРѓРЎвЂљР В°РЎР‚РЎвЂљР Вµ
    showLoading();

    try {
        const container = document.querySelector('.container');
        // Р вЂњР В°РЎР‚Р В°Р Р…РЎвЂљР С‘РЎР‚РЎС“Р ВµР С Р Р†Р С‘Р Т‘Р С‘Р СР С•РЎРѓРЎвЂљРЎРЉ Р С”Р С•Р Р…РЎвЂљР ВµР в„–Р Р…Р ВµРЎР‚Р С•Р Р† (Р Р…Р В° РЎРѓР В»РЎС“РЎвЂЎР В°Р в„– Р ВµРЎРѓР В»Р С‘ Р С•Р Р…Р С‘ Р В±РЎвЂ№Р В»Р С‘ РЎРѓР С”РЎР‚РЎвЂ№РЎвЂљРЎвЂ№ РЎРѓРЎвЂљРЎР‚Р В°Р Р…Р С‘РЎвЂ Р ВµР в„– РЎРѓРЎвЂљР В°РЎвЂљР С‘РЎРѓРЎвЂљР С‘Р С”Р С‘)
        // Р СњР С› Р СњР вЂў Р Т‘Р В»РЎРЏ РЎРѓРЎвЂљРЎР‚Р В°Р Р…Р С‘РЎвЂ РЎвЂ№ РЎРѓРЎвЂљР В°РЎвЂљР С‘РЎРѓРЎвЂљР С‘Р С”Р С‘!
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
        // Р РЋР С™Р В Р В«Р вЂ™Р С’Р вЂўР Сљ РЎРѓРЎвЂљРЎР‚Р С•Р С”РЎС“ Р С—Р С•Р С‘РЎРѓР С”Р В° Р Т‘Р В»РЎРЏ РЎРѓРЎвЂљРЎР‚Р В°Р Р…Р С‘РЎвЂ РЎвЂ№ РЎРѓРЎвЂљР В°РЎвЂљР С‘РЎРѓРЎвЂљР С‘Р С”Р С‘!
        if (searchContainer) {
            // Р вЂќР В»РЎРЏ РЎРѓРЎвЂљР В°РЎвЂљР С‘РЎРѓРЎвЂљР С‘Р С”Р С‘ Р С•РЎРѓРЎвЂљР В°Р Р†Р В»РЎРЏР ВµР С display:none, Р Т‘Р В»РЎРЏ Р С•РЎРѓРЎвЂљР В°Р В»РЎРЉР Р…РЎвЂ№РЎвЂ¦ РЎРѓРЎвЂљРЎР‚Р В°Р Р…Р С‘РЎвЂ  Р С—Р С•Р С”Р В°Р В·РЎвЂ№Р Р†Р В°Р ВµР С
            if (!isStatsPage) {
                searchContainer.style.display = '';
                console.log('[initTabsNavigation] search-container display reset');
            } else {
                searchContainer.style.display = 'none';
                console.log('[initTabsNavigation] search-container hidden (stats page)');
            }
        }
        // Р Р€Р Т‘Р В°Р В»РЎРЏР ВµР С РЎРѓРЎвЂљР В°РЎР‚РЎС“РЎР‹ Р В°Р Т‘Р СР С‘Р Р…-Р С—Р В°Р Р…Р ВµР В»РЎРЉ Р С‘Р В· DOM (Р Р…Р С•Р Р†Р В°РЎРЏ Р В»Р С•Р С–Р С‘Р С”Р В° РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ РЎРѓР Р†Р ВµРЎР‚РЎвЂ¦РЎС“)
        const legacyAdminPanel = document.querySelector('.admin-panel');
        if (legacyAdminPanel) legacyAdminPanel.remove();

        // Р РЋР С•Р В·Р Т‘Р В°Р ВµР С Р С”Р С•Р Р…РЎвЂљР ВµР в„–Р Р…Р ВµРЎР‚ Р Т‘Р В»РЎРЏ Р Р…Р В°Р Р†Р С‘Р С–Р В°РЎвЂ Р С‘Р С‘
        const navigationContainer = document.createElement('div');
        navigationContainer.className = 'tabs-navigation';

        // Р С™Р С•Р Р…РЎвЂљР ВµР в„–Р Р…Р ВµРЎР‚ Р Т‘Р В»РЎРЏ Р Р†Р ВµРЎР‚РЎвЂ¦Р Р…Р С‘РЎвЂ¦ Р Т‘Р ВµР в„–РЎРѓРЎвЂљР Р†Р С‘Р в„– (РЎРѓРЎвЂљР В°РЎвЂљР С‘РЎРѓРЎвЂљР С‘Р С”Р В°, Р В°Р Т‘Р СР С‘Р Р…Р С”Р В°)
        const topActions = document.createElement('div');
        topActions.className = 'top-actions-bar';
        // Р РЋР С™Р В Р В«Р вЂ™Р С’Р вЂўР Сљ top-actions-bar Р Т‘Р В»РЎРЏ РЎРѓРЎвЂљРЎР‚Р В°Р Р…Р С‘РЎвЂ РЎвЂ№ РЎРѓРЎвЂљР В°РЎвЂљР С‘РЎРѓРЎвЂљР С‘Р С”Р С‘!
        topActions.style.display = isStatsPage ? 'none' : 'flex';
        topActions.style.alignItems = 'center';
        topActions.style.justifyContent = 'flex-start';
        topActions.style.padding = '4px 0';

        // Р РЋР С•Р В·Р Т‘Р В°РЎвЂР С MutationObserver Р Т‘Р В»РЎРЏ Р С•РЎвЂљРЎРѓР В»Р ВµР В¶Р С‘Р Р†Р В°Р Р…Р С‘РЎРЏ Р С‘Р В·Р СР ВµР Р…Р ВµР Р…Р С‘Р в„– display
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

        // Р вЂ™Р ВµРЎР‚РЎРѓР С‘РЎРЏ Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘РЎРЏ
        const verEl = document.createElement('div');
        verEl.textContent = `v${appVersion}`;
        verEl.className = 'app-version-display';
        verEl.style.fontSize = '11px';
        verEl.style.color = '#555';
        verEl.style.fontWeight = 'bold';
        verEl.style.marginLeft = '10px';

        // Р С™Р С•Р Р…РЎвЂљР ВµР в„–Р Р…Р ВµРЎР‚ Р Т‘Р В»РЎРЏ Р С—РЎР‚Р В°Р Р†Р С•Р в„– РЎвЂЎР В°РЎРѓРЎвЂљР С‘ (Р Р€РЎР‚Р С•Р Р†Р ВµР Р…РЎРЉ + Р РЋРЎвЂљРЎР‚Р С‘Р С”)
        const levelContainer = document.createElement('div');
        levelContainer.className = 'level-container-right';
        levelContainer.style.marginLeft = 'auto';
        levelContainer.style.display = 'flex';
        levelContainer.style.alignItems = 'center';

        // Р СџР С•Р С”Р В°Р В·РЎвЂ№Р Р†Р В°Р ВµР С Р Р†РЎРѓР Вµ Р Р†Р С•Р С—РЎР‚Р С•РЎРѓРЎвЂ№ Р С—РЎР‚Р С‘ Р С‘Р Р…Р С‘РЎвЂ Р С‘Р В°Р В»Р С‘Р В·Р В°РЎвЂ Р С‘Р С‘
        showAllQuestions();

        // Р С’Р Р†РЎвЂљР С•Р СР В°РЎвЂљР С‘РЎвЂЎР ВµРЎРѓР С”Р В°РЎРЏ Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С”Р В° РЎРѓ РЎС“РЎвЂЎРЎвЂРЎвЂљР С•Р С РЎвЂљР ВµР С”РЎС“РЎвЂ°Р ВµР С–Р С• Р С”Р С•Р Р…РЎвЂљР ВµР С”РЎРѓРЎвЂљР В°
        // Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С Р С”Р С•Р Р…РЎвЂљР ВµР С”РЎРѓРЎвЂљ РЎвЂЎР ВµРЎР‚Р ВµР В· 100Р СРЎРѓ (Р С—Р С•РЎРѓР В»Р Вµ Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С”Р С‘ Р Т‘Р В°Р Р…Р Р…РЎвЂ№РЎвЂ¦ Р С‘Р В· all-data.js)
        setTimeout(() => {
            refreshCurrentContext();

            // Р вЂєР С•Р С–Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘Р Вµ РЎР‚Р В°Р В·Р СР ВµРЎР‚Р С•Р Р† Р Т‘Р В»РЎРЏ Р С•РЎвЂљР В»Р В°Р Т‘Р С”Р С‘
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

        // Р РЋР В»РЎС“РЎв‚¬Р В°Р ВµР С Р С•Р В±Р Р…Р С•Р Р†Р В»Р ВµР Р…Р С‘Р Вµ Р С‘Р В·Р В±РЎР‚Р В°Р Р…Р Р…Р С•Р С–Р С• Р С‘Р В· Р С•Р В±Р В»Р В°Р С”Р В°
        window.addEventListener('favoritesUpdated', () => {
            refreshCurrentContext();
        });

        // Р РЋР В»РЎС“РЎв‚¬Р В°Р ВµР С dataLoaded Р С•РЎвЂљ all-data.js Р Т‘Р В»РЎРЏ Р С•Р В±Р Р…Р С•Р Р†Р В»Р ВµР Р…Р С‘РЎРЏ Р С—Р С•РЎРѓР В»Р Вµ Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С”Р С‘ Р Т‘Р В°Р Р…Р Р…РЎвЂ№РЎвЂ¦
        document.addEventListener('dataLoaded', (e) => {
            const data = e.detail?.data;

            // Р РЋР С”РЎР‚РЎвЂ№Р Р†Р В°Р ВµР С Р В°Р Р…Р С‘Р СР В°РЎвЂ Р С‘РЎР‹ Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С”Р С‘
            hideLoading();

            if (data && data.length > 0) {
                // Р СџР ВµРЎР‚Р ВµРЎРѓРЎвЂљРЎР‚Р В°Р С‘Р Р†Р В°Р ВµР С РЎвЂљР В°Р В±РЎвЂ№ Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р в„– РЎРѓ Р Р…Р С•Р Р†РЎвЂ№Р СР С‘ Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р СР С‘
                refreshCategoriesTabs();
                // Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С РЎвЂљР ВµР С”РЎС“РЎвЂ°Р С‘Р в„– Р С”Р С•Р Р…РЎвЂљР ВµР С”РЎРѓРЎвЂљ
                refreshCurrentContext();
            }
        });

        // СЂСџвЂќТђ Р ВР РЋР СџР В Р С’Р вЂ™Р вЂєР вЂўР СњР ВР вЂў Р С™Р С›Р вЂќР ВР В Р С›Р вЂ™Р С™Р В: Р СџР С•РЎРѓР В»Р Вµ Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С”Р С‘ Р Т‘Р В°Р Р…Р Р…РЎвЂ№РЎвЂ¦ РЎРѓ РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚Р В°
        // Р вЂ™РЎвЂ№Р В·РЎвЂ№Р Р†Р В°Р ВµР С Р С—Р С•РЎРѓР В»Р Вµ loadFromServer, Р С”Р С•Р С–Р Т‘Р В° Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р Вµ РЎС“Р В¶Р Вµ Р Р† localStorage
        window.addEventListener('qaDataLoadedFromServer', () => {
            fixEncodingIssues();
            refreshCategoriesTabs();
            refreshCurrentContext();
        });

        // Р РЋРЎвЂљРЎР‚Р С•Р С‘Р С Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р С‘ Р С—Р С• Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р С (РЎРѓ РЎС“РЎвЂЎРЎвЂРЎвЂљР С•Р С Р В»Р С•Р С”Р В°Р В»РЎРЉР Р…РЎвЂ№РЎвЂ¦ Р С—РЎР‚Р В°Р Р†Р С•Р С”/Р Р…Р С•Р Р†РЎвЂ№РЎвЂ¦ РЎРЊР В»Р ВµР СР ВµР Р…РЎвЂљР С•Р Р†/РЎС“Р Т‘Р В°Р В»Р ВµР Р…Р С‘Р в„–)
        let categories = buildCategoriesFromData(getRuntimeData());

        // Р РЋР С•Р В·Р Т‘Р В°Р ВµР С Р С”Р С•Р Р…РЎвЂљР ВµР в„–Р Р…Р ВµРЎР‚ Р Т‘Р В»РЎРЏ РЎвЂљР В°Р В±Р С•Р Р†
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'tabs-container';
        console.log('[TABS-NAVIGATION] tabsContainer created:', tabsContainer);
        console.log('[TABS-NAVIGATION] tabs-container parent will be:', document.querySelector('.tabs-header'));

        // Р РЋР С•Р В·Р Т‘Р В°Р ВµР С РЎвЂљР В°Р В± "Р вЂ™РЎРѓР Вµ Р Р†Р С•Р С—РЎР‚Р С•РЎРѓРЎвЂ№"
        const allTab = document.createElement('div');
        allTab.className = 'tab';
        allTab.dataset.category = 'all';
        allTab.textContent = 'Р вЂ™РЎРѓР Вµ Р Р†Р С•Р С—РЎР‚Р С•РЎРѓРЎвЂ№';
        tabsContainer.appendChild(allTab);
        // Р РЋР С•Р В·Р Т‘Р В°Р ВµР С РЎвЂљР В°Р В± "Р ВР В·Р В±РЎР‚Р В°Р Р…Р Р…Р С•Р Вµ"
        const favTab = document.createElement('div');
        favTab.className = 'tab';
        favTab.dataset.category = 'favorites';
        // Р ВР С”Р С•Р Р…Р С”Р В° Р С‘Р В·Р В±РЎР‚Р В°Р Р…Р Р…Р С•Р С–Р С•: Р В·Р Р†Р ВµР В·Р Т‘Р В° (SVG)
        favTab.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style="vertical-align: middle;">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                style="fill: #fb923c; stroke: #fb923c; stroke-width: 2px;"
            />
        </svg>
    `;
        tabsContainer.appendChild(favTab);

        // Р вЂќР С•Р В±Р В°Р Р†Р В»РЎРЏР ВµР С РЎвЂљР В°Р В±РЎвЂ№ Р Т‘Р В»РЎРЏ Р Р†РЎРѓР ВµРЎвЂ¦ Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р в„–
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

        // Р РЋР С•Р В·Р Т‘Р В°Р ВµР С Р С”Р С•Р Р…РЎвЂљР ВµР в„–Р Р…Р ВµРЎР‚ Р Т‘Р В»РЎРЏ Р С—Р С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р в„–
        const subcategoriesContainer = document.createElement('div');
        subcategoriesContainer.className = 'subcategories-container';
        subcategoriesContainer.style.display = 'none';

        // Р вЂ™Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р В°Р Р†Р В»Р С‘Р Р†Р В°Р ВµР С Р С—Р С•Р Т‘РЎРѓР Р†Р ВµРЎвЂљР С”РЎС“ Р В°Р С”РЎвЂљР С‘Р Р†Р Р…Р С•Р С–Р С• РЎвЂљР В°Р В±Р В° Р С‘Р В· РЎвЂљР ВµР С”РЎС“РЎвЂ°Р ВµР С–Р С• Р С”Р С•Р Р…РЎвЂљР ВµР С”РЎРѓРЎвЂљР В°
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
                    // Р СџР С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р С‘ Р В±РЎС“Р Т‘РЎС“РЎвЂљ Р С—Р ВµРЎР‚Р ВµРЎРѓРЎвЂљРЎР‚Р С•Р ВµР Р…РЎвЂ№ Р С—РЎР‚Р С‘ render/refresh; Р В·Р Т‘Р ВµРЎРѓРЎРЉ РЎвЂљР С•Р В»РЎРЉР С”Р С• Р Р†Р С‘Р В·РЎС“Р В°Р В»РЎРЉР Р…Р С• Р С—Р С•Р С”Р В°Р В·РЎвЂ№Р Р†Р В°Р ВµР С Р В±Р В»Р С•Р С”
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

        // Р вЂќР С•Р В±Р В°Р Р†Р В»РЎРЏР ВµР С Р С•Р В±РЎР‚Р В°Р В±Р С•РЎвЂљРЎвЂЎР С‘Р С”Р С‘ Р С”Р В»Р С‘Р С”Р В° Р С—Р С• РЎвЂљР В°Р В±Р В°Р С
        tabsContainer.addEventListener('click', function (e) {
            console.log('[TABS-NAVIGATION] Click on tabsContainer, target:', e.target);
            if (e.target.classList.contains('tab')) {
                console.log('[TABS-NAVIGATION] Tab clicked:', e.target);
                console.log('[TABS-NAVIGATION] Tab computed styles before active:', {
                    transform: window.getComputedStyle(e.target).transform,
                    zIndex: window.getComputedStyle(e.target).zIndex,
                    position: window.getComputedStyle(e.target).position
                });

                // Р Р€Р Т‘Р В°Р В»РЎРЏР ВµР С Р С”Р В»Р В°РЎРѓРЎРѓ active РЎС“ Р Р†РЎРѓР ВµРЎвЂ¦ РЎвЂљР В°Р В±Р С•Р Р†
                const tabs = tabsContainer.querySelectorAll('.tab');
                tabs.forEach(tab => tab.classList.remove('active'));

                // Р вЂќР С•Р В±Р В°Р Р†Р В»РЎРЏР ВµР С Р С”Р В»Р В°РЎРѓРЎРѓ active Р Р†РЎвЂ№Р В±РЎР‚Р В°Р Р…Р Р…Р С•Р СРЎС“ РЎвЂљР В°Р В±РЎС“
                e.target.classList.add('active');

                console.log('[TABS-NAVIGATION] Tab after active:', {
                    transform: window.getComputedStyle(e.target).transform,
                    zIndex: window.getComputedStyle(e.target).zIndex,
                    position: window.getComputedStyle(e.target).position
                });

                const categoryId = e.target.dataset.category;

                if (categoryId === 'all') {
                    // Р вЂўРЎРѓР В»Р С‘ Р Р†РЎвЂ№Р В±РЎР‚Р В°Р Р…РЎвЂ№ Р Р†РЎРѓР Вµ Р Р†Р С•Р С—РЎР‚Р С•РЎРѓРЎвЂ№, РЎРѓР С”РЎР‚РЎвЂ№Р Р†Р В°Р ВµР С Р С”Р С•Р Р…РЎвЂљР ВµР в„–Р Р…Р ВµРЎР‚ Р С—Р С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р в„–
                    subcategoriesContainer.style.display = 'none';
                    showAllQuestions();
                } else if (categoryId === 'favorites') {
                    // Р ВР В·Р В±РЎР‚Р В°Р Р…Р Р…Р С•Р Вµ Р В±Р ВµР В· Р С—Р С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р в„–
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

        // Р вЂќР С•Р В±Р В°Р Р†Р В»РЎРЏР ВµР С Р С•Р В±РЎР‚Р В°Р В±Р С•РЎвЂљРЎвЂЎР С‘Р С”Р С‘ Р С”Р В»Р С‘Р С”Р В° Р С—Р С• Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р В°Р С Р С—Р С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р в„–
        subcategoriesContainer.addEventListener('click', function (e) {
            if (e.target.classList.contains('subcategory-card')) {
                // Р Р€Р Т‘Р В°Р В»РЎРЏР ВµР С Р С”Р В»Р В°РЎРѓРЎРѓ active РЎС“ Р Р†РЎРѓР ВµРЎвЂ¦ Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР ВµР С”
                const cards = subcategoriesContainer.querySelectorAll('.subcategory-card');
                cards.forEach(card => card.classList.remove('active'));

                // Р вЂќР С•Р В±Р В°Р Р†Р В»РЎРЏР ВµР С Р С”Р В»Р В°РЎРѓРЎРѓ active Р Р†РЎвЂ№Р В±РЎР‚Р В°Р Р…Р Р…Р С•Р в„– Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р Вµ
                e.target.classList.add('active');

                const subcategoryId = e.target.dataset.subcategory;
                const categoryId = e.target.dataset.category || tabsContainer.querySelector('.tab.active').dataset.category;

                if (subcategoryId === 'all') {
                    // Р вЂўРЎРѓР В»Р С‘ Р Р†РЎвЂ№Р В±РЎР‚Р В°Р Р…РЎвЂ№ Р Р†РЎРѓР Вµ Р С—Р С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р С‘, РЎвЂћР С‘Р В»РЎРЉРЎвЂљРЎР‚РЎС“Р ВµР С РЎвЂљР С•Р В»РЎРЉР С”Р С• Р С—Р С• Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р С‘
                    const selectedCategory = categories.find(cat => cat.id == categoryId);
                    filterQuestionsByCategory(selectedCategory.name);
                } else {
                    // Р вЂўРЎРѓР В»Р С‘ Р Р†РЎвЂ№Р В±РЎР‚Р В°Р Р…Р В° Р С”Р С•Р Р…Р С”РЎР‚Р ВµРЎвЂљР Р…Р В°РЎРЏ Р С—Р С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏ, РЎвЂћР С‘Р В»РЎРЉРЎвЂљРЎР‚РЎС“Р ВµР С Р С—Р С• Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р С‘ Р С‘ Р С—Р С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р С‘
                    const selectedCategory = categories.find(cat => cat.id == categoryId);
                    const selectedSubcategory = selectedCategory.subcategories.find(
                        subcat => subcat.id == subcategoryId
                    );

                    filterQuestionsBySubcategory(selectedCategory.name, selectedSubcategory.name);
                }
            }
        });

        // Р ВР Р…РЎвЂљР ВµР С–РЎР‚Р С‘РЎР‚РЎС“Р ВµР С Р С”Р Р…Р С•Р С—Р С”РЎС“ РЎвЂћР С‘Р В»РЎРЉРЎвЂљРЎР‚Р С•Р Р† Р Р†Р Р…РЎС“РЎвЂљРЎР‚РЎРЉ РЎРѓР С—Р С‘РЎРѓР С”Р В° РЎвЂљР В°Р В±Р С•Р Р† Р С”Р В°Р С” Р С—Р ВµРЎР‚Р Р†РЎвЂ№Р в„– РЎРЊР В»Р ВµР СР ВµР Р…РЎвЂљ (sticky left)
        const filtersBtn = document.createElement('button');
        filtersBtn.className = 'tab';
        filtersBtn.title = 'Р В¤Р С‘Р В»РЎРЉРЎвЂљРЎР‚РЎвЂ№';
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

        // Р вЂ™РЎРѓРЎвЂљР В°Р Р†Р В»РЎРЏР ВµР С Р С”Р Р…Р С•Р С—Р С”РЎС“ РЎвЂћР С‘Р В»РЎРЉРЎвЂљРЎР‚Р С•Р Р† Р С—Р ВµРЎР‚Р ВµР Т‘ Р С•РЎРѓРЎвЂљР В°Р В»РЎРЉР Р…РЎвЂ№Р СР С‘ РЎвЂљР В°Р В±Р В°Р СР С‘
        tabsContainer.insertBefore(filtersBtn, tabsContainer.firstChild);

        // Р С™Р Р…Р С•Р С—Р С”Р В° РЎР‚Р ВµР В¶Р С‘Р СР В° Р С•Р В±РЎС“РЎвЂЎР ВµР Р…Р С‘РЎРЏ (РЎРѓР С”РЎР‚РЎвЂ№РЎвЂљР В° Р Р…Р В° Р СР С•Р В±Р С‘Р В»РЎРЉР Р…РЎвЂ№РЎвЂ¦ РЎвЂЎР ВµРЎР‚Р ВµР В· CSS .learn-main-btn)
        const learnBtn = document.createElement('button');
        learnBtn.title = 'Р СњР В°РЎвЂЎР В°РЎвЂљРЎРЉ Р С•Р В±РЎС“РЎвЂЎР ВµР Р…Р С‘Р Вµ';
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
                    alert('Р вЂ™ РЎвЂљР ВµР С”РЎС“РЎвЂ°Р ВµР С РЎРѓР С—Р С‘РЎРѓР С”Р Вµ Р Р…Р ВµРЎвЂљ Р Р†Р С•Р С—РЎР‚Р С•РЎРѓР С•Р Р† Р Т‘Р В»РЎРЏ Р С‘Р В·РЎС“РЎвЂЎР ВµР Р…Р С‘РЎРЏ. Р вЂ™РЎвЂ№Р В±Р ВµРЎР‚Р С‘РЎвЂљР Вµ Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎР‹ Р С‘Р В»Р С‘ "Р вЂ™РЎРѓР Вµ Р Р†Р С•Р С—РЎР‚Р С•РЎРѓРЎвЂ№".');
                    return;
                }

                let module;
                try {
                    module = await import('../srs/learn-ui.js?v=6.20.8);
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
                alert('Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р В·Р В°Р С—РЎС“РЎРѓРЎвЂљР С‘РЎвЂљРЎРЉ РЎР‚Р ВµР В¶Р С‘Р С Р С•Р В±РЎС“РЎвЂЎР ВµР Р…Р С‘РЎРЏ: ' + err.message);
            }
        });

        // Р С™Р Р…Р С•Р С—Р С”Р В° РЎРѓРЎвЂљР В°РЎвЂљР С‘РЎРѓРЎвЂљР С‘Р С”Р С‘
        const statsBtn = document.createElement('button');
        statsBtn.className = 'nav-icon-btn tab';
        statsBtn.title = 'Р РЋРЎвЂљР В°РЎвЂљР С‘РЎРѓРЎвЂљР С‘Р С”Р В°';
        statsBtn.style.minWidth = 'auto';
        statsBtn.style.padding = '0 10px';
        statsBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="4" height="18" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="17" y="13" width="4" height="8" rx="1"/></svg>`;
        statsBtn.addEventListener('click', async () => {
            // Р С›РЎвЂЎР С‘РЎвЂ°Р В°Р ВµР С РЎРѓР С•РЎРѓРЎвЂљР С•РЎРЏР Р…Р С‘Р Вµ Р С•Р В±РЎС“РЎвЂЎР ВµР Р…Р С‘РЎРЏ Р СџР вЂўР В Р вЂўР вЂќ Р С—Р ВµРЎР‚Р ВµРЎвЂ¦Р С•Р Т‘Р С•Р С Р Р…Р В° РЎРѓРЎвЂљР В°РЎвЂљР С‘РЎРѓРЎвЂљР С‘Р С”РЎС“
            if (window.__lastCandidates) {
                window.__lastCandidates = null;
            }
            const { initStatsPage } = await import('../srs/stats-ui.js?v=6.20.8);
            location.hash = '#/stats';
            initStatsPage(appVersion);
        });

        // Р С›Р В±РЎР‚Р В°Р В±Р С•РЎвЂљРЎвЂЎР С‘Р С” Р С‘Р В·Р СР ВµР Р…Р ВµР Р…Р С‘РЎРЏ hash (Р Т‘Р В»РЎРЏ Р С—Р ВµРЎР‚Р ВµРЎвЂ¦Р С•Р Т‘Р В° Р С‘Р В· Р СР С•Р Т‘Р В°Р В»Р С”Р С‘)
        window.addEventListener('hashchange', async () => {
            // Р РЋР СњР С’Р В§Р С’Р вЂєР С’ Р С•РЎвЂљР С”Р В»РЎР‹РЎвЂЎР В°Р ВµР С MutationObserver!
            if (window.__statsTopActionsObserver) {
                window.__statsTopActionsObserver.disconnect();
                window.__statsTopActionsObserver = null;
            }

            if (location.hash === '#/stats') {
                // Р СџР В Р С›Р вЂ™Р вЂўР В Р Р‡Р вЂўР Сљ: РЎРѓРЎС“РЎвЂ°Р ВµРЎРѓРЎвЂљР Р†РЎС“Р ВµРЎвЂљ Р В»Р С‘ stats-container
                const statsContainerExists = document.getElementById('stats-container');

                // Р вЂўРЎРѓР В»Р С‘ stats-container Р СњР вЂў РЎРѓРЎС“РЎвЂ°Р ВµРЎРѓРЎвЂљР Р†РЎС“Р ВµРЎвЂљ, РЎРѓР С•Р В·Р Т‘Р В°Р ВµР С Р ВµР С–Р С•
                if (!statsContainerExists) {
                    const { initStatsPage } = await import('../srs/stats-ui.js?v=6.20.8);
                    initStatsPage(appVersion);
                }

                // Р РЋР С”РЎР‚РЎвЂ№Р Р†Р В°Р ВµР С Р С–Р В»Р В°Р Р†Р Р…РЎвЂ№Р в„– Р С”Р С•Р Р…РЎвЂљР ВµР в„–Р Р…Р ВµРЎР‚ Р С‘ sidebar
                const mainContainer = document.querySelector('.container');
                if (mainContainer) {
                    mainContainer.style.display = 'none';
                }
                const sidebar = document.querySelector('.sidebar');
                if (sidebar) {
                    sidebar.style.display = 'none';
                }
            } else if (location.hash === '' || location.hash === '#/' || location.hash === '#') {
                // Р СџР ВµРЎР‚Р ВµРЎвЂ¦Р С•Р Т‘ Р Р…Р В° Р С–Р В»Р В°Р Р†Р Р…РЎС“РЎР‹ - Р В·Р В°Р С”РЎР‚РЎвЂ№Р Р†Р В°Р ВµР С РЎРѓРЎвЂљР В°РЎвЂљР С‘РЎРѓРЎвЂљР С‘Р С”РЎС“ Р ВµРЎРѓР В»Р С‘ Р С•РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљР В°
                console.log('[HASHCHANGE #/] Navigating to home page...');

                // Р С›РЎвЂЎР С‘РЎвЂ°Р В°Р ВµР С РЎРѓР С•РЎРѓРЎвЂљР С•РЎРЏР Р…Р С‘Р Вµ Р С•Р В±РЎС“РЎвЂЎР ВµР Р…Р С‘РЎРЏ Р ВµРЎРѓР В»Р С‘ Р ВµРЎРѓРЎвЂљРЎРЉ
                if (window.__lastCandidates) {
                    window.__lastCandidates = null;
                    console.log('[HASHCHANGE #/] Cleared __lastCandidates');
                }

                // Р вЂ”Р В°Р С”РЎР‚РЎвЂ№Р Р†Р В°Р ВµР С РЎРѓРЎвЂљР В°РЎвЂљР С‘РЎРѓРЎвЂљР С‘Р С”РЎС“ Р ВµРЎРѓР В»Р С‘ Р С•РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљР В°
                const statsContainer = document.getElementById('stats-container');
                if (statsContainer) {
                    statsContainer.remove();
                    console.log('[HASHCHANGE #/] Removed stats-container');
                }

                // Р СџР С•Р С”Р В°Р В·РЎвЂ№Р Р†Р В°Р ВµР С Р С–Р В»Р В°Р Р†Р Р…РЎвЂ№Р в„– Р С”Р С•Р Р…РЎвЂљР ВµР в„–Р Р…Р ВµРЎР‚
                const mainContainer = document.querySelector('.container');
                if (mainContainer) {
                    mainContainer.style.display = 'block';
                    console.log('[HASHCHANGE #/] mainContainer display set to block');
                }

                // Р вЂ™Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р В°Р Р†Р В»Р С‘Р Р†Р В°Р ВµР С sidebar
                const sidebar = document.querySelector('.sidebar');
                if (sidebar) {
                    sidebar.style.display = '';
                    console.log('[HASHCHANGE #/] sidebar display reset');
                } else {
                    console.warn('[HASHCHANGE #/] sidebar NOT FOUND!');
                }

                // Р вЂ™Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р В°Р Р†Р В»Р С‘Р Р†Р В°Р ВµР С top-actions-bar
                const topActionsBar = document.querySelector('.top-actions-bar');
                if (topActionsBar) {
                    topActionsBar.style.display = 'flex';
                    console.log('[HASHCHANGE #/] top-actions-bar display set to flex');
                } else {
                    console.warn('[HASHCHANGE #/] top-actions-bar NOT FOUND!');
                }

                // Р вЂ™Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р В°Р Р†Р В»Р С‘Р Р†Р В°Р ВµР С search-container
                const searchContainer = document.querySelector('.search-container');
                if (searchContainer) {
                    searchContainer.style.display = '';
                    console.log('[HASHCHANGE #/] search-container display reset');
                } else {
                    console.warn('[HASHCHANGE #/] search-container NOT FOUND!');
                }

                // Р С›РЎвЂљР С”Р В»РЎР‹РЎвЂЎР В°Р ВµР С MutationObserver Р Т‘Р В»РЎРЏ top-actions-bar
                if (window.__statsTopActionsObserver) {
                    window.__statsTopActionsObserver.disconnect();
                    window.__statsTopActionsObserver = null;
                    console.log('[HASHCHANGE #/] Disconnected __statsTopActionsObserver');
                }

                // Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С РЎвЂљР ВµР С”РЎС“РЎвЂ°Р С‘Р в„– Р С”Р С•Р Р…РЎвЂљР ВµР С”РЎРѓРЎвЂљ
                refreshCurrentContext();
                console.log('[HASHCHANGE #] Home page setup complete');
            }
        });

        // Р С™Р Р…Р С•Р С—Р С”Р В° Р С—РЎР‚Р С•РЎвЂћР С‘Р В»РЎРЏ / Р вЂ™Р С•Р в„–РЎвЂљР С‘
        const loginMainBtn = document.createElement('button');
        loginMainBtn.className = 'nav-icon-btn login-main-btn tab';
        loginMainBtn.style.minWidth = 'auto';
        loginMainBtn.style.padding = '0 10px';
        loginMainBtn.style.backgroundColor = 'var(--color-card)';

        const userIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
        loginMainBtn.innerHTML = userIconSvg;
        loginMainBtn.title = 'Р вЂ™Р С•Р в„–РЎвЂљР С‘';
        ensureDefaultUsers();
        loginMainBtn.addEventListener('click', () => {
            if (loggedInUser) {
                const username = loggedInUser.username || loggedInUser.email || 'Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЉ';
                if (confirm(`Р вЂ™РЎвЂ№Р в„–РЎвЂљР С‘ Р С‘Р В· Р В°Р С”Р С”Р В°РЎС“Р Р…РЎвЂљР В° ${username}?`)) {
                    window.qaAuth.logout();
                }
            } else {
                openLoginModal();
            }
        });

        const editToggleBtn = document.createElement('button');
        editToggleBtn.title = 'Р В Р ВµР В¶Р С‘Р С РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ';
        editToggleBtn.className = 'nav-icon-btn edit-mode-btn';
        editToggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;
        editToggleBtn.style.display = 'none';

        // Р С™Р Р…Р С•Р С—Р С”Р В° Р В°Р Т‘Р СР С‘Р Р…Р С‘РЎРѓРЎвЂљРЎР‚Р В°РЎвЂљР С•РЎР‚Р В° Р Т‘Р В»РЎРЏ Р Т‘Р С•Р В±Р В°Р Р†Р В»Р ВµР Р…Р С‘РЎРЏ Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»Р ВµР в„– (Р С—Р С•РЎРЏР Р†Р В»РЎРЏР ВµРЎвЂљРЎРѓРЎРЏ Р С—Р С•РЎРѓР В»Р Вµ Р Р†РЎвЂ¦Р С•Р Т‘Р В° Р В°Р Т‘Р СР С‘Р Р…Р В°)
        const adminUsersBtn = document.createElement('button');
        adminUsersBtn.className = 'nav-icon-btn tab';
        adminUsersBtn.title = 'Р вЂќР С•Р В±Р В°Р Р†Р С‘РЎвЂљРЎРЉ Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЏ';
        adminUsersBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
        adminUsersBtn.style.display = 'none';
        adminUsersBtn.style.minWidth = 'auto';
        adminUsersBtn.style.padding = window.innerWidth <= 420 ? '0 6px' : '0 10px';
        adminUsersBtn.addEventListener('click', openAdminUsersPanel);

        const cloudBtn = document.createElement('button');
        cloudBtn.title = 'Р С›Р В±Р В»Р В°Р С”Р С•';
        cloudBtn.textContent = 'Р С›Р В±Р В»Р В°Р С”Р С•';
        cloudBtn.className = 'tab';
        cloudBtn.style.display = 'none';
        cloudBtn.style.width = 'auto';
        // Removed manual styles to match app style
        cloudBtn.addEventListener('click', openCloudOverview);

        // Р вЂќР С•Р В±Р В°Р Р†Р В»РЎРЏР ВµР С Р С”Р Р…Р С•Р С—Р С”Р С‘: Р Р…Р В° Р СР С•Р В±Р С‘Р В»РЎРЉР Р…РЎвЂ№РЎвЂ¦ Р Р† topActions, Р Р…Р В° desktop РЎвЂљР С•Р В¶Р Вµ Р Р† topActions
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        const isTablet = window.matchMedia('(min-width: 769px) and (max-width: 1024px)').matches;

        // СЂСџвЂќТђ Р вЂ™Р РЋР вЂўР вЂњР вЂќР С’ Р Т‘Р С•Р В±Р В°Р Р†Р В»РЎРЏР ВµР С Р С”Р Р…Р С•Р С—Р С”Р С‘ Р Р† topActions (Р С‘ mobile, Р С‘ desktop)
        topActions.appendChild(loginMainBtn); /* Р вЂ™РЎвЂ¦Р С•Р Т‘/Р вЂ™РЎвЂ№РЎвЂ¦Р С•Р Т‘ - Р С—Р ВµРЎР‚Р Р†РЎвЂ№Р в„– */
        topActions.appendChild(statsBtn); /* Р РЋРЎвЂљР В°РЎвЂљР С‘РЎРѓРЎвЂљР С‘Р С”Р В° - Р Р†РЎвЂљР С•РЎР‚Р С•Р в„– */
        topActions.appendChild(learnBtn); /* Р С›Р В±РЎС“РЎвЂЎР ВµР Р…Р С‘Р Вµ - РЎвЂљРЎР‚Р ВµРЎвЂљР С‘Р в„– */
        topActions.appendChild(levelContainer);

        if (isMobile) {
            // Mobile: Р Т‘Р С•Р С—Р С•Р В»Р Р…Р С‘РЎвЂљР ВµР В»РЎРЉР Р…РЎвЂ№Р Вµ Р С”Р Р…Р С•Р С—Р С”Р С‘ Р Р† topActions
            loginMainBtn.style.position = 'sticky';
            loginMainBtn.style.right = '0';
            loginMainBtn.style.zIndex = '10';
            loginMainBtn.style.borderLeft = '1px solid var(--color-border)';

            // Р вЂ™Р ВµРЎР‚РЎРѓР С‘РЎРЏ Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘РЎРЏ (Р С”Р С•Р СР С—Р В°Р С”РЎвЂљР Р…Р В°РЎРЏ)
            topActions.appendChild(verEl);

            // Р С™Р Р…Р С•Р С—Р С”Р В° РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ (Р Т‘Р В»РЎРЏ admin Р С‘ editor)
            topActions.appendChild(editToggleBtn);

            // Р С™Р Р…Р С•Р С—Р С”Р В° Р Т‘Р С•Р В±Р В°Р Р†Р В»Р ВµР Р…Р С‘РЎРЏ Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЏ (РЎвЂљР С•Р В»РЎРЉР С”Р С• admin)
            topActions.appendChild(adminUsersBtn);

            // СЂСџвЂќТђ Р РЋР В Р С’Р вЂ”Р Р€ Р С—РЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЏР ВµР С Р С—РЎР‚Р В°Р Р†Р В° Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р В° Р С—Р С•РЎРѓР В»Р Вµ Р Т‘Р С•Р В±Р В°Р Р†Р В»Р ВµР Р…Р С‘РЎРЏ Р С”Р Р…Р С•Р С—Р С•Р С” Р Р† DOM
            setTimeout(() => {
                try {
                    const user = JSON.parse(localStorage.getItem('qaSessionUser') || 'null');

                    // Р С™Р Р…Р С•Р С—Р С”Р В° РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ: admin Р С‘ editor
                    if (user && ['admin', 'editor'].includes(user.role)) {
                        editToggleBtn.style.setProperty('display', 'inline-block', 'important');
                    } else {
                        editToggleBtn.style.setProperty('display', 'none', 'important');
                    }

                    // Р С™Р Р…Р С•Р С—Р С”Р В° Р Т‘Р С•Р В±Р В°Р Р†Р В»Р ВµР Р…Р С‘РЎРЏ Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЏ: РЎвЂљР С•Р В»РЎРЉР С”Р С• admin
                    if (user && user.role === 'admin') {
                        adminUsersBtn.style.setProperty('display', 'inline-block', 'important');
                    } else {
                        adminUsersBtn.style.setProperty('display', 'none', 'important');
                    }
                } catch (e) {
                    console.error('[MOBILE ACCESS] Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р С—РЎР‚Р С•Р Р†Р ВµРЎР‚Р С”Р С‘ Р С—РЎР‚Р В°Р Р†:', e);
                    // Р СџР С• РЎС“Р СР С•Р В»РЎвЂЎР В°Р Р…Р С‘РЎР‹ РЎРѓР С”РЎР‚РЎвЂ№Р Р†Р В°Р ВµР С Р С”Р Р…Р С•Р С—Р С”Р С‘
                    editToggleBtn.style.setProperty('display', 'none', 'important');
                    adminUsersBtn.style.setProperty('display', 'none', 'important');
                }
            }, 50);
        } else {
            // Desktop: Р Т‘Р С•Р С—Р С•Р В»Р Р…Р С‘РЎвЂљР ВµР В»РЎРЉР Р…РЎвЂ№Р Вµ Р С”Р Р…Р С•Р С—Р С”Р С‘ Р Р† topActions
            // Order: Stats -> Learn -> Login -> Version -> Edit -> Cloud -> Admin -> Level (Right Aligned)
            topActions.appendChild(verEl);
            topActions.appendChild(editToggleBtn);
            topActions.appendChild(cloudBtn);
            topActions.appendChild(adminUsersBtn);
        }

        // Р вЂќР С•Р В±Р В°Р Р†Р В»РЎРЏР ВµР С Р С”Р С•Р Р…РЎвЂљР ВµР в„–Р Р…Р ВµРЎР‚ РЎвЂљР В°Р В±Р С•Р Р† Р Р† Р Р…Р В°Р Р†Р С‘Р С–Р В°РЎвЂ Р С‘РЎР‹ Р Р…Р В°Р С—РЎР‚РЎРЏР СРЎС“РЎР‹
        navigationContainer.appendChild(tabsContainer);

        // Bottom sheet РЎвЂћР С‘Р В»РЎРЉРЎвЂљРЎР‚Р С•Р Р†
        let activeFilters = { status: null, ef: null };
        const sheet = document.getElementById('filters-sheet');

        if (sheet) {
            const overlay = document.getElementById('sheet-overlay');

            // Р СџРЎР‚Р С‘Р Р†РЎРЏР В·РЎвЂ№Р Р†Р В°Р ВµР С Р С•Р В±РЎР‚Р В°Р В±Р С•РЎвЂљРЎвЂЎР С‘Р С”Р С‘ Р С” РЎРѓРЎС“РЎвЂ°Р ВµРЎРѓРЎвЂљР Р†РЎС“РЎР‹РЎвЂ°Р С‘Р С РЎРЊР В»Р ВµР СР ВµР Р…РЎвЂљР В°Р С Р С‘Р В· index.html
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
                // Р РЋР В±РЎР‚Р С•РЎРѓ Р Р†Р С‘Р В·РЎС“Р В°Р В»РЎРЉР Р…Р С•Р С–Р С• РЎРѓР С•РЎРѓРЎвЂљР С•РЎРЏР Р…Р С‘РЎРЏ РЎвЂЎР С‘Р С—Р С•Р Р†
                sheet.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            });

            if (applyBtn) applyBtn.addEventListener('click', () => {
                applyFilters();
                closeSheet();
            });

            // Р С›РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљР С‘Р Вµ Р С—Р С• Р С”Р Р…Р С•Р С—Р С”Р Вµ РЎвЂћР С‘Р В»РЎРЉРЎвЂљРЎР‚Р С•Р Р†
            filtersBtn.addEventListener('click', openSheet);

            // Р С›Р В±РЎР‚Р В°Р В±Р С•РЎвЂљР С”Р В° Р С”Р В»Р С‘Р С”Р С•Р Р† Р С—Р С• РЎвЂЎР С‘Р С—Р В°Р С
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

                    // Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С Р Р†Р С‘Р В·РЎС“Р В°Р В»РЎРЉР Р…Р С•Р Вµ РЎРѓР С•РЎРѓРЎвЂљР С•РЎРЏР Р…Р С‘Р Вµ
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

        // Р Р€Р Т‘Р В°Р В»РЎвЂР Р… Р С—РЎР‚Р ВµР В¶Р Р…Р С‘Р в„– Р С•Р С–Р С•Р Р…РЎвЂР С” Р Т‘Р С• Р Р†Р С‘Р Т‘Р В¶Р ВµРЎвЂљР В° РЎС“РЎР‚Р С•Р Р†Р Р…РЎРЏ РІР‚вЂќ Р С—Р ВµРЎР‚Р ВµР Р…Р ВµРЎРѓРЎвЂР Р… Р В±Р В»Р С‘Р В¶Р Вµ Р С” РЎв‚¬Р С”Р В°Р В»Р Вµ

        // Logic to update icon/tooltip on login change
        function updateLoginBtnState() {
            loginMainBtn.title = loggedInUser ? 'Р вЂ™РЎвЂ№Р в„–РЎвЂљР С‘' : 'Р вЂ™Р С•Р в„–РЎвЂљР С‘';
            const exitIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M10 17l1.41-1.41L8.83 13H17v-2H8.83l2.58-2.59L10 7l-5 5 5 5z"/><path d="M19 3h-8c-1.1 0-2 .9-2 2v4h2V5h8v14h-8v-4H9v4c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>`;
            loginMainBtn.innerHTML = loggedInUser ? exitIconSvg : userIconSvg;
            // loginMainBtn.style.color = '#d0d0d0';
            // try { statsBtn.style.color = '#d0d0d0'; } catch {}
        }
        if (!window.qaAuth) window.qaAuth = {};
        window.qaAuth.getUser = () => loggedInUser;
        window.qaAuth.openLogin = () => openLoginModal();
        window.qaAuth.logout = async () => {
            // СЂСџвЂќТђ Р С›РЎвЂЎР С‘РЎвЂ°Р В°Р ВµР С Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р Вµ Telegram OAuth Р С—Р ВµРЎР‚Р ВµР Т‘ Р Р†РЎвЂ№РЎвЂ¦Р С•Р Т‘Р С•Р С
            sessionStorage.removeItem('tgAuthUser');

            await setLoggedUser(null);
            window.location.reload();
        };
        // Р СџР В»Р В°РЎв‚¬Р С”Р В° РЎС“РЎР‚Р С•Р Р†Р Р…РЎРЏ Р С‘ XP
        import('../srs/stats-utils.js').then(({ getCurrentLevel }) => {
            // Р вЂќР С•Р В±Р В°Р Р†Р В»РЎРЏР ВµР С Р С‘Р СРЎРЏ Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЏ
            const usernameSpan = document.createElement('span');
            usernameSpan.className = 'username-display';
            usernameSpan.style.marginRight = '8px';
            usernameSpan.style.fontSize = '13px';
            usernameSpan.style.color = '#4ec9b0';
            usernameSpan.style.fontWeight = '600';

            // Р СџР С•Р В»РЎС“РЎвЂЎР В°Р ВµР С Р С‘Р СРЎРЏ Р С‘Р В· РЎРѓР ВµРЎРѓРЎРѓР С‘Р С‘
            try {
                const sessionUserRaw = localStorage.getItem('qaSessionUser');
                if (sessionUserRaw) {
                    const user = JSON.parse(sessionUserRaw);
                    if (user && user.username) {
                        usernameSpan.textContent = user.username;
                    } else {
                        usernameSpan.textContent = 'Р вЂњР С•РЎРѓРЎвЂљРЎРЉ';
                        usernameSpan.style.color = '#808080';
                    }
                } else {
                    usernameSpan.textContent = 'Р вЂњР С•РЎРѓРЎвЂљРЎРЉ';
                    usernameSpan.style.color = '#808080';
                }
            } catch (e) {
                usernameSpan.textContent = 'Р вЂњР С•РЎРѓРЎвЂљРЎРЉ';
                usernameSpan.style.color = '#808080';
            }

            levelContainer.appendChild(usernameSpan);

            const box = document.createElement('div');
            box.className = 'level-inline';
            box.style.cursor = 'pointer';
            box.style.transition = 'all 0.2s ease';
            box.style.padding = '4px 8px';
            box.style.borderRadius = '8px';
            box.title = 'Р Р€РЎР‚Р С•Р Р†Р Р…Р С‘ Р С‘ XP';
            box.onclick = () => {
                // Р РЋР Р…Р В°РЎвЂЎР В°Р В»Р В° Р С—РЎР‚Р С•Р В±РЎС“Р ВµР С РЎвЂЎР ВµРЎР‚Р ВµР В· window (Р ВµРЎРѓР В»Р С‘ stats-ui Р В·Р В°Р С–РЎР‚РЎС“Р В¶Р ВµР Р…)
                if (window.openLevelInfoModal) {
                    window.openLevelInfoModal();
                } else {
                    // Р ВР Р…Р В°РЎвЂЎР Вµ Р В·Р В°Р С–РЎР‚РЎС“Р В¶Р В°Р ВµР С stats-ui
                    import('../srs/stats-ui.js?v=6.20.8).then(() => {
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
            // Р С›Р С–Р С•Р Р…РЎвЂР С” РЎРѓРЎвЂљРЎР‚Р С‘Р С”Р В° РЎР‚РЎРЏР Т‘Р С•Р С РЎРѓР С• РЎв‚¬Р С”Р В°Р В»Р С•Р в„– РЎС“РЎР‚Р С•Р Р†Р Р…РЎРЏ
            const streakRaw = localStorage.getItem('studyStreak') || '{}';
            let streakVal = 0;
            try { const s = JSON.parse(streakRaw); streakVal = s.current || 0; } catch { }
            if (streakVal > 0) {
                const flame = document.createElement('span');
                flame.textContent = `СЂСџвЂќТђ ${streakVal}`;
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

                    // Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С Р С‘Р СРЎРЏ Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЏ
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
                                    usernameSpan.textContent = 'Р вЂњР С•РЎРѓРЎвЂљРЎРЉ';
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

        // Р ВР Р…Р С‘РЎвЂ Р С‘Р В°Р В»Р С‘Р В·Р В°РЎвЂ Р С‘РЎРЏ РЎРѓР С•РЎРѓРЎвЂљР С•РЎРЏР Р…Р С‘РЎРЏ Р С”Р Р…Р С•Р С—Р С•Р С” Р С—Р С• РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎвЂР Р…Р Р…Р С•Р СРЎС“ Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎР‹
        try { setLoggedUser(loggedInUser); } catch { }

        // Р СџР В°Р Р…Р ВµР В»РЎРЉ Р С”Р С•РЎР‚Р В·Р С‘Р Р…РЎвЂ№ (Р Р†Р С‘Р Т‘Р Р…Р В° РЎвЂљР С•Р В»РЎРЉР С”Р С• Р Р† РЎР‚Р ВµР В¶Р С‘Р СР Вµ РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ)
        const trashPanel = document.createElement('div');
        trashPanel.className = 'trash-panel';
        trashPanel.style.display = 'none';
        trashPanel.style.border = '1px solid #444';
        trashPanel.style.borderRadius = '6px';
        trashPanel.style.padding = '8px';
        trashPanel.style.marginBottom = '8px';
        // Р вЂ™Р С”Р В»РЎР‹РЎвЂЎР В°Р ВµР С Р С—РЎР‚Р С•Р С”РЎР‚РЎС“РЎвЂљР С”РЎС“ Р Р…Р ВµР В·Р В°Р Р†Р С‘РЎРѓР С‘Р СР С• Р С•РЎвЂљ РЎР‚Р ВµР В¶Р С‘Р СР В°
        trashPanel.style.overflowY = 'auto';
        // trashPanel.style.maxHeight РЎС“Р Т‘Р В°Р В»Р ВµР Р…, РЎС“Р С—РЎР‚Р В°Р Р†Р В»РЎРЏР ВµРЎвЂљРЎРѓРЎРЏ CSS
        trashPanel.innerHTML = '<div id="trash-categories" style="margin-top:6px"></div><div id="trash-cards" style="margin-top:6px"></div>';

        // Р вЂќР С•Р В±Р В°Р Р†Р В»РЎРЏР ВµР С РЎРЊР В»Р ВµР СР ВµР Р…РЎвЂљРЎвЂ№ Р Р† Р С”Р С•Р Р…РЎвЂљР ВµР в„–Р Р…Р ВµРЎР‚ Р Р…Р В°Р Р†Р С‘Р С–Р В°РЎвЂ Р С‘Р С‘
        navigationContainer.appendChild(topActions);
        navigationContainer.appendChild(tabsContainer);
        navigationContainer.appendChild(subcategoriesContainer);

        // Р вЂ™РЎРѓРЎвЂљР В°Р Р†Р В»РЎРЏР ВµР С Р С”Р С•Р Р…РЎвЂљР ВµР в„–Р Р…Р ВµРЎР‚ Р Р…Р В°Р Р†Р С‘Р С–Р В°РЎвЂ Р С‘Р С‘ Р С—Р ВµРЎР‚Р ВµР Т‘ Р С”Р С•Р Р…РЎвЂљР ВµР в„–Р Р…Р ВµРЎР‚Р С•Р С Р С—Р С•Р С‘РЎРѓР С”Р В°
        // Р вЂ™РЎРѓРЎвЂљР В°Р Р†Р В»РЎРЏР ВµР С Р Р†Р ВµРЎР‚РЎвЂ¦Р Р…РЎР‹РЎР‹ Р С—Р В°Р Р…Р ВµР В»РЎРЉ Р С‘ Р С”Р С•РЎР‚Р В·Р С‘Р Р…РЎС“ Р С—Р ВµРЎР‚Р ВµР Т‘ Р Р…Р В°Р Р†Р С‘Р С–Р В°РЎвЂ Р С‘Р ВµР в„–
        // container.insertBefore(topControls, searchContainer); // Р Р€Р Т‘Р В°Р В»Р ВµР Р…Р С•

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

        // Р РЋР В»РЎС“РЎв‚¬Р В°Р ВµР С dataLoaded Р Т‘Р В»РЎРЏ Р С•Р В±Р Р…Р С•Р Р†Р В»Р ВµР Р…Р С‘РЎРЏ Р С”Р С•РЎР‚Р В·Р С‘Р Р…РЎвЂ№ Р С—Р С•РЎРѓР В»Р Вµ Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С”Р С‘ Р Т‘Р В°Р Р…Р Р…РЎвЂ№РЎвЂ¦
        document.addEventListener('dataLoaded', () => {
            refreshServerTrash();
        });

        // Р вЂќР ВµР В»Р В°Р ВµР С refreshServerTrash Р С–Р В»Р С•Р В±Р В°Р В»РЎРЉР Р…Р С• Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р Р…Р С•Р в„–
        window.refreshServerTrash = refreshServerTrash;

        // Р СџРЎР‚Р С‘Р Р†РЎРЏР В·РЎвЂ№Р Р†Р В°Р ВµР С Р С–Р В»Р С•Р В±Р В°Р В»РЎРЉР Р…РЎС“РЎР‹ РЎРѓРЎРѓРЎвЂ№Р В»Р С”РЎС“ Р Р…Р В° Р С‘Р Р…Р Т‘Р С‘Р С”Р В°РЎвЂљР С•РЎР‚ РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘РЎРЏ
        // globalSaveStatusEl = saveStatus; // Removed in favor of global toast

        (async () => {
            try {
                const meta = await getServerMetadata();
                if (Array.isArray(meta.categoryOrder)) setCategoryOrder(meta.categoryOrder);
                if (meta.subcategoryOrder && typeof meta.subcategoryOrder === 'object') setSubcategoryOrderMap(meta.subcategoryOrder);
                if (meta.orderOverrides && typeof meta.orderOverrides === 'object') setLS('qaOrderOverrides', meta.orderOverrides);
                // refreshServerTrash() Р Р†РЎвЂ№Р В·РЎвЂ№Р Р†Р В°Р ВµРЎвЂљРЎРѓРЎРЏ Р СџР С›Р РЋР вЂєР вЂў Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С”Р С‘ Р Т‘Р В°Р Р…Р Р…РЎвЂ№РЎвЂ¦ РЎРѓ РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚Р В° (Р Р† loadFromServer)
                refreshCategoriesTabs();
            } catch { }
        })();

        // Р СџРЎР‚Р С‘Р СР ВµР Р…РЎРЏР ВµР С РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎвЂР Р…Р Р…РЎвЂ№Р в„– РЎР‚Р ВµР В¶Р С‘Р С РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ Р С—РЎР‚Р С‘ Р С‘Р Р…Р С‘РЎвЂ Р С‘Р В°Р В»Р С‘Р В·Р В°РЎвЂ Р С‘Р С‘
        if (editMode) {
            // СЂСџвЂќТђ Р вЂќР С•Р В±Р В°Р Р†Р В»РЎРЏР ВµР С Р С”Р В»Р В°РЎРѓРЎРѓ on Р С”Р Р…Р С•Р С—Р С”Р Вµ РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ
            editToggleBtn.classList.add('on');
            editToggleBtn.title = 'Р вЂ™РЎвЂ№Р С”Р В»РЎР‹РЎвЂЎР С‘РЎвЂљРЎРЉ РЎР‚Р ВµР В¶Р С‘Р С РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ';

            try {
                const sidebar = document.querySelector('.sidebar');
                if (sidebar) sidebar.classList.remove('collapsed'); // Р С’Р Р†РЎвЂљР С•Р СР В°РЎвЂљР С‘РЎвЂЎР ВµРЎРѓР С”Р С‘ РЎР‚Р В°Р В·Р Р†Р С•РЎР‚Р В°РЎвЂЎР С‘Р Р†Р В°Р ВµР С Р С—РЎР‚Р С‘ РЎРѓРЎвЂљР В°РЎР‚РЎвЂљР Вµ Р Р† РЎР‚Р ВµР В¶Р С‘Р СР Вµ РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ
                const sidebarButtons = sidebar ? sidebar.querySelector('.sidebar-mode-buttons') : null;
                const searchHistory = sidebar ? sidebar.querySelector('#search-history') : null;
                const existingTrashBtn = sidebarButtons ? sidebarButtons.querySelector('#trash-mode-button') : null;
                if (!existingTrashBtn && sidebarButtons) {
                    const trashBtn = document.createElement('button');
                    trashBtn.id = 'trash-mode-button';
                    trashBtn.title = 'Р С™Р С•РЎР‚Р В·Р С‘Р Р…Р В°';
                    trashBtn.setAttribute('aria-label', 'Р С™Р С•РЎР‚Р В·Р С‘Р Р…Р В°');
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

        // ===== Р вЂєР С•Р С”Р В°Р В»РЎРЉР Р…Р В°РЎРЏ Р В°Р Р†РЎвЂљР С•РЎР‚Р С‘Р В·Р В°РЎвЂ Р С‘РЎРЏ =====
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
            // Р СџР ВµРЎР‚Р ВµР С”Р В»РЎР‹РЎвЂЎР ВµР Р…Р С‘Р Вµ Guest -> User (Login)
            if (!loggedInUser && user) {
                // Р вЂРЎРЊР С”Р В°Р С— Р Т‘Р В°Р Р…Р Р…РЎвЂ№РЎвЂ¦ Р С–Р С•РЎРѓРЎвЂљРЎРЏ
                const backup = {};
                DATA_KEYS.forEach(k => backup[k] = localStorage.getItem(k));
                localStorage.setItem('guest_backup', JSON.stringify(backup));

                // Р С›РЎвЂЎР С‘РЎвЂ°Р В°Р ВµР С Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р Вµ, РЎвЂЎРЎвЂљР С•Р В±РЎвЂ№ Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С‘РЎвЂљРЎРЉ Р С—РЎР‚Р С•РЎвЂћР С‘Р В»РЎРЉ Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЏ Р Р…Р В°РЎвЂЎР С‘РЎРѓРЎвЂљР С•
                DATA_KEYS.forEach(k => localStorage.removeItem(k));
                localStorage.removeItem('localDataTimestamp');

                // Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏР ВµР С РЎвЂљР С•Р С”Р ВµР Р… Р ВµРЎРѓР В»Р С‘ Р ВµРЎРѓРЎвЂљРЎРЉ
                if (token) {
                    localStorage.setItem('sessionToken', token);
                }
            }

            // Р СџР ВµРЎР‚Р ВµР С”Р В»РЎР‹РЎвЂЎР ВµР Р…Р С‘Р Вµ User -> Guest (Logout)
            if (loggedInUser && !user) {
                console.log('[LOGOUT] === Р СњР С’Р В§Р С’Р вЂєР С› Р вЂ™Р В«Р ТђР С›Р вЂќР С’ ===');

                // СЂСџвЂќТђ Р С›РЎвЂЎР С‘РЎвЂ°Р В°Р ВµР С Р С”Р В»РЎР‹РЎвЂЎР С‘ Telegram Р В°Р Р†РЎвЂљР С•РЎР‚Р С‘Р В·Р В°РЎвЂ Р С‘Р С‘ Р Р† localStorage
                localStorage.removeItem('qaUsername');
                localStorage.removeItem('qaAuthType');

                // СЂСџвЂќТђ Р С›РЎвЂЎР С‘РЎвЂ°Р В°Р ВµР С Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р Вµ Telegram OAuth Р Р† sessionStorage
                sessionStorage.removeItem('tgAuthUser');

                // СЂСџвЂќТђ Р С›РЎвЂЎР С‘РЎвЂ°Р В°Р ВµР С РЎРѓР ВµРЎРѓРЎРѓР С‘РЎР‹ Telegram (Р ВµРЎРѓР В»Р С‘ Р Р†Р Т‘РЎР‚РЎС“Р С– Р С•РЎРѓРЎвЂљР В°Р В»Р В°РЎРѓРЎРЉ)
                sessionStorage.removeItem('telegramUser');

                // РІС™В РїС‘РЏ Р вЂ™Р С’Р вЂ“Р СњР С›: Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏР ВµР С Р вЂ™Р РЋР вЂў Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р Вµ Р Р…Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚ Р СџР вЂўР В Р вЂўР вЂќ Р Р†РЎвЂ№РЎвЂ¦Р С•Р Т‘Р С•Р С
                // СЂСџвЂќТђ Р ВР РЋР СџР В Р С’Р вЂ™Р вЂєР вЂўР СњР ВР вЂў: Р СњР Вµ РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏР ВµР С Р ВµРЎРѓР В»Р С‘ Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р Вµ РЎС“Р В¶Р Вµ РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…РЎвЂ№ (qaNewItems Р С—РЎС“РЎРѓРЎвЂљ)
                const newItems = getNewItems();
                const deletedItems = getDeletedItems();
                const hasUnsavedChanges = (newItems && newItems.length > 0) ||
                    (deletedItems && Object.keys(deletedItems).length > 0);

                console.log('[LOGOUT] Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЏР ВµР С Р ВµРЎРѓРЎвЂљРЎРЉ Р В»Р С‘ Р Р…Р ВµРЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎвЂР Р…Р Р…РЎвЂ№Р Вµ Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р Вµ:', {
                    hasUnsavedChanges,
                    newItemsCount: newItems?.length || 0,
                    deletedCount: Object.keys(deletedItems || {}).length
                });

                if (hasUnsavedChanges) {
                    console.log('[LOGOUT] Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏР ВµР С Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р Вµ Р Р…Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚Р Вµ Р С—Р ВµРЎР‚Р ВµР Т‘ Р Р†РЎвЂ№РЎвЂ¦Р С•Р Т‘Р С•Р С...');
                    try {
                        await saveMergedToServer();
                    } catch (e) {
                        console.error('[Logout] Failed to save data before logout:', e);
                    }
                } else {
                    console.log('[LOGOUT] Р вЂ™РЎРѓР Вµ Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р Вµ РЎС“Р В¶Р Вµ РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…РЎвЂ№, Р С—РЎР‚Р С•Р С—РЎС“РЎРѓР С”Р В°Р ВµР С saveMergedToServer');
                }

                // РІС™В РїС‘РЏ Р вЂ™Р С’Р вЂ“Р СњР С›: Р СџР С•Р В»Р Р…Р С•РЎРѓРЎвЂљРЎРЉРЎР‹ Р С•РЎвЂЎР С‘РЎвЂ°Р В°Р ВµР С localStorage Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЏ
                // Р вЂќР В°Р Р…Р Р…РЎвЂ№Р Вµ РЎС“Р В¶Р Вµ РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…РЎвЂ№ Р Р…Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚Р Вµ, Р С—РЎР‚Р С‘ РЎРѓР В»Р ВµР Т‘РЎС“РЎР‹РЎвЂ°Р ВµР С Р Р†РЎвЂ¦Р С•Р Т‘Р Вµ Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С‘Р С Р С•РЎвЂљРЎвЂљРЎС“Р Т‘Р В°
                const DATA_KEYS_TO_CLEAR = [
                    // Р С™Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р С‘, Р С‘Р В·Р В±РЎР‚Р В°Р Р…Р Р…Р С•Р Вµ, Р С”Р С•РЎР‚Р В·Р С‘Р Р…Р В°
                    'qaUserCards_admin', 'qaUserCards_jeff', 'qaUserCards_stas',
                    'qaFavorites_admin', 'qaFavorites_jeff', 'qaFavorites_stas',
                    'qaUserTrash_admin', 'qaUserTrash_jeff', 'qaUserTrash_stas',
                    'qaUserCards_guest', 'qaFavorites_guest', 'qaUserTrash_guest',
                    // Р С’Р Т‘Р СР С‘Р Р…Р С”Р В° Р С‘ overrides
                    'qaAdminOverrides', 'qaNewItems', 'qaDeletedItems',
                    'qaCategoryPlaceholders', 'qaCategoryOrder', 'qaOrderOverrides',
                    // Р РЋР ВµРЎРѓРЎРѓР С‘РЎРЏ
                    'localDataTimestamp', 'qaSessionUser', 'sessionToken', 'currentUser',
                    // СЂСџвЂќТђ Р СџР В Р С›Р вЂњР В Р вЂўР РЋР РЋ Р В Р вЂќР С›Р РЋР СћР ВР вЂ“Р вЂўР СњР ВР Р‡ (РЎвЂЎРЎвЂљР С•Р В±РЎвЂ№ Р С–Р С•РЎРѓРЎвЂљРЎРЉ Р Р…Р Вµ Р Р†Р С‘Р Т‘Р ВµР В» Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р Вµ Р В°Р Т‘Р СР С‘Р Р…Р В°)
                    'srsProgress', 'studyAchievements', 'studyStreak',
                    'dailyPoints', 'dailyBonusPoints', 'dailyDayBonusPoints',
                    'studyStats'
                ];
                DATA_KEYS_TO_CLEAR.forEach(key => localStorage.removeItem(key));

                console.log('[LOGOUT] localStorage Р С•РЎвЂЎР С‘РЎвЂ°Р ВµР Р…, Р С”Р В»РЎР‹РЎвЂЎР С‘:', DATA_KEYS_TO_CLEAR);

                // Р СћР В°Р С”Р В¶Р Вµ Р С•РЎвЂЎР С‘РЎвЂ°Р В°Р ВµР С РЎРѓРЎвЂљР В°РЎР‚РЎвЂ№Р Вµ Р С”Р В»РЎР‹РЎвЂЎР С‘ Р В±Р ВµР В· РЎРѓРЎС“РЎвЂћРЎвЂћР С‘Р С”РЎРѓР С•Р Р†
                ['qaUserCards', 'qaFavorites', 'qaUserTrash'].forEach(key => localStorage.removeItem(key));

                // СЂСџвЂќТђ Р вЂќР С•Р С—Р С•Р В»Р Р…Р С‘РЎвЂљР ВµР В»РЎРЉР Р…Р С• Р С•РЎвЂЎР С‘РЎвЂ°Р В°Р ВµР С Р С—РЎР‚Р С•Р С–РЎР‚Р ВµРЎРѓРЎРѓ Р В±Р ВµР В· РЎРѓРЎС“РЎвЂћРЎвЂћР С‘Р С”РЎРѓР С•Р Р†
                ['srsProgress', 'studyAchievements', 'studyStreak', 'dailyPoints', 'dailyBonusPoints', 'dailyDayBonusPoints', 'studyStats']
                    .forEach(key => localStorage.removeItem(key));

                // РІС™В РїС‘РЏ Р вЂ™Р С’Р вЂ“Р СњР С›: Р Р€Р Т‘Р В°Р В»РЎРЏР ВµР С РЎРѓР ВµРЎРѓРЎРѓР С‘РЎР‹ Р С—Р С•Р В»Р Р…Р С•РЎРѓРЎвЂљРЎРЉРЎР‹
                clearQaUserCards();

                console.log('[LOGOUT] === Р вЂ™Р В«Р ТђР С›Р вЂќ Р вЂ”Р С’Р вЂ™Р вЂўР В Р РЃР вЂўР Сњ ===');
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
            // Р СџР С•Р С”Р В°Р В·Р В°РЎвЂљРЎРЉ/РЎРѓР С”РЎР‚РЎвЂ№РЎвЂљРЎРЉ Р В°Р Т‘Р СР С‘Р Р…РЎРѓР С”Р С‘Р Вµ Р С”Р Р…Р С•Р С—Р С”Р С‘ Р Р† Р В·Р В°Р Р†Р С‘РЎРѓР С‘Р СР С•РЎРѓРЎвЂљР С‘ Р С•РЎвЂљ РЎР‚Р С•Р В»Р С‘
            try {
                adminUsersBtn.style.display = (user && user.role === 'admin') ? 'inline-block' : 'none';  // Р СћР С•Р В»РЎРЉР С”Р С• admin Р СР С•Р В¶Р ВµРЎвЂљ РЎРѓР С•Р В·Р Т‘Р В°Р Р†Р В°РЎвЂљРЎРЉ Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»Р ВµР в„–
                // editToggleBtn Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р ВµР Р… admin Р С‘ editor
                editToggleBtn.style.display = (user && ['admin', 'editor'].includes(user.role)) ? 'inline-block' : 'none';
                // genStatsBtn Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р ВµР Р… РЎвЂљР С•Р В»РЎРЉР С”Р С• admin
                genStatsBtn.style.display = (user && user.role === 'admin') ? 'inline-block' : 'none';
            } catch { }
            try { migrateDeviceRecordsToUser(); } catch { }
            if (user) {
                import('../srs/storage.js').then(mod => {
                    if (mod && typeof mod.hydrateLocalFromSupabase === 'function') {
                        mod.hydrateLocalFromSupabase().then(() => {
                            const evt = new Event('xpUpdated'); window.dispatchEvent(evt);
                            // Р СћР В°Р С”Р В¶Р Вµ Р С•Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С Р С‘Р В·Р В±РЎР‚Р В°Р Р…Р Р…Р С•Р Вµ
                            window.dispatchEvent(new Event('favoritesUpdated'));
                            // Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С UI РЎвЂљР В°Р В±Р С•Р Р† Р С—Р С•РЎРѓР В»Р Вµ Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С”Р С‘ Р Т‘Р В°Р Р…Р Р…РЎвЂ№РЎвЂ¦
                            window.dispatchEvent(new Event('dataLoaded'));
                        }).catch(() => { });
                    }
                }).catch(() => { });
            } else {
                // Р вЂўРЎРѓР В»Р С‘ Р Р†РЎвЂ№РЎв‚¬Р В»Р С‘ (Guest), РЎвЂљР С•Р В¶Р Вµ Р С•Р В±Р Р…Р С•Р Р†Р С‘Р С UI
                window.dispatchEvent(new Event('xpUpdated'));
                window.dispatchEvent(new Event('favoritesUpdated'));
                // Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С Р С‘Р СРЎРЏ Р Р…Р В° "Р вЂњР С•РЎРѓРЎвЂљРЎРЉ"
                const usernameSpan = document.querySelector('.username-display');
                if (usernameSpan) {
                    usernameSpan.textContent = 'Р вЂњР С•РЎРѓРЎвЂљРЎРЉ';
                    usernameSpan.style.color = '#808080';
                }
            }
        }

        // Make setLoggedUser available globally for autoLoadUserData
        window.setLoggedUser = setLoggedUser;

        // Auto-load user data on page load if credentials are saved
        // Р вЂ™РЎвЂ№Р В·РЎвЂ№Р Р†Р В°Р ВµР С РЎРѓ Р В·Р В°Р Т‘Р ВµРЎР‚Р В¶Р С”Р С•Р в„– РЎвЂЎРЎвЂљР С•Р В±РЎвЂ№ Р Р†РЎРѓР Вµ РЎвЂћРЎС“Р Р…Р С”РЎвЂ Р С‘Р С‘ Р В±РЎвЂ№Р В»Р С‘ Р С•Р С—РЎР‚Р ВµР Т‘Р ВµР В»Р ВµР Р…РЎвЂ№
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
                    <!-- Р вЂР В»Р С‘Р С” РЎРѓР Р†Р ВµРЎР‚РЎвЂ¦РЎС“ -->
                    <div style="
                        position: absolute;
                        top: 0; left: 0; right: 0;
                        height: 1px;
                        background: linear-gradient(90deg, 
                            transparent, 
                            rgba(255,255,255,0.4), 
                            transparent);
                    "></div>
                    
                    <div style="font-weight:600;margin-bottom:16px;color:#fff;font-size:18px;letter-spacing:-0.3px;text-align:center">Р вЂ™РЎвЂ¦Р С•Р Т‘</div>
                    <form id="login-form" autocomplete="on" style="display:flex;flex-direction:column;gap:10px">
                        <input id="login-username" name="username" autocomplete="username" placeholder="Р вЂєР С•Р С–Р С‘Р Р…" style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:#fff;font-size:14px;transition:all 0.2s"/>
                        <div style="position:relative;display:block">
                            <input id="login-password" name="password" autocomplete="current-password" placeholder="Р СџР В°РЎР‚Р С•Р В»РЎРЉ" type="password" style="width:100%;box-sizing:border-box;padding:10px 36px 10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:#fff;font-size:14px;transition:all 0.2s"/>
                            <button type="button" id="login-pass-eye" title="Р СџР С•Р С”Р В°Р В·Р В°РЎвЂљРЎРЉ Р С—Р В°РЎР‚Р С•Р В»РЎРЉ" aria-label="Р СџР С•Р С”Р В°Р В·Р В°РЎвЂљРЎРЉ Р С—Р В°РЎР‚Р С•Р В»РЎРЉ" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);padding:0;border:none;background:transparent;color:rgba(255,255,255,0.6);width:22px;height:22px;cursor:pointer;transition:color 0.2s">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                            </button>
                        </div>
                        <label style="display:flex;gap:8px;align-items:center;font-size:12px;color:rgba(255,255,255,0.6)">
                            <input type="checkbox" id="login-remember" checked style="accent-color:rgba(255,255,255,0.3)"/>
                            Р С›РЎРѓРЎвЂљР В°Р Р†Р В°РЎвЂљРЎРЉРЎРѓРЎРЏ Р Р† РЎРѓР С‘РЎРѓРЎвЂљР ВµР СР Вµ
                        </label>
                        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
                            <button id="login-cancel" type="button" style="padding:10px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.8);font-size:14px;cursor:pointer;transition:all 0.2s">Р С›РЎвЂљР СР ВµР Р…Р В°</button>
                            <button id="login-submit" type="submit" style="padding:10px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.3);background:linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%);color:#fff;font-weight:600;font-size:14px;cursor:pointer;transition:all 0.2s">Р вЂ™Р С•Р в„–РЎвЂљР С‘</button>
                        </div>
                        <div style="margin-top:16px;border-top:1px solid rgba(255,255,255,0.15);padding-top:16px;display:flex;flex-direction:column;align-items:center;gap:10px">
                            <div style="font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.5px">Р ВР В»Р С‘ Р Р†Р С•Р в„–РЎвЂљР С‘ РЎвЂЎР ВµРЎР‚Р ВµР В·</div>
                            <div style="display:flex;gap:12px;justify-content:center;align-items:center">
                                <!-- Google -->
                                <button id="google-login-btn" type="button" title="Р вЂ™Р С•Р в„–РЎвЂљР С‘ РЎвЂЎР ВµРЎР‚Р ВµР В· Google" style="width:44px;height:44px;border-radius:12px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                                </button>
                                <!-- GitHub -->
                                <button id="github-login-btn" type="button" title="Р вЂ™Р С•Р в„–РЎвЂљР С‘ РЎвЂЎР ВµРЎР‚Р ВµР В· GitHub" style="width:44px;height:44px;border-radius:12px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                                </button>
                            </div>
                            <!-- Telegram Login Widget - Р Р†Р С‘Р Т‘Р С‘Р СРЎвЂ№Р в„– -->
                            <div id="tg-widget-container" style="margin-top:12px;display:flex;justify-content:center;"></div>
                        </div>
                    </form>
                </div>
            `;
                document.body.appendChild(ov);

                // Р вЂќР С•Р В±Р В°Р Р†Р В»РЎРЏР ВµР С РЎРѓРЎвЂљР С‘Р В»Р С‘ Р Т‘Р В»РЎРЏ hover-РЎРЊРЎвЂћРЎвЂћР ВµР С”РЎвЂљР С•Р Р†
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
                    /* Р С™Р Р…Р С•Р С—Р С”Р С‘ РЎРѓР С•РЎвЂ РЎРѓР ВµРЎвЂљР ВµР в„– */
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

                // === Р С›Р вЂР В Р С’Р вЂР С›Р СћР В§Р ВР С™Р В Р вЂќР вЂєР Р‡ Р С™Р СњР С›Р СџР С›Р С™ Р РЋР С›Р В¦Р РЋР вЂўР СћР вЂўР в„ў ===

                // Google Р С”Р Р…Р С•Р С—Р С”Р В°
                const googleBtn = ov.querySelector('#google-login-btn');
                if (googleBtn) {
                    googleBtn.addEventListener('click', function () {
                        console.log('[Google Auth] Button clicked');
                        // Р вЂ”Р В°Р С–РЎР‚РЎС“Р В¶Р В°Р ВµР С Google OAuth РЎРѓР С”РЎР‚Р С‘Р С—РЎвЂљ
                        const script = document.createElement('script');
                        script.src = 'https://accounts.google.com/gsi/client';
                        script.onload = function () {
                            console.log('[Google Auth] Script loaded, initializing...');
                            // Р ВР Р…Р С‘РЎвЂ Р С‘Р В°Р В»Р С‘Р В·Р С‘РЎР‚РЎС“Р ВµР С Google OAuth РЎРѓ redirect mode (Р Р…Р В°Р Т‘РЎвЂР В¶Р Р…Р ВµР Вµ Р В±Р ВµР В· FedCM)
                            google.accounts.id.initialize({
                                client_id: '862467912934-pjug7gt80qcp3t4rmtjvvu78fa6nukuf.apps.googleusercontent.com',
                                callback: handleGoogleSignIn,
                                auto_select: false,
                                ux_mode: 'redirect'  // Redirect Р Р†Р СР ВµРЎРѓРЎвЂљР С• popup (Р Р…Р В°Р Т‘РЎвЂР В¶Р Р…Р ВµР Вµ)
                            });
                            console.log('[Google Auth] Initialized, redirecting to Google...');
                            // Р СџР ВµРЎР‚Р ВµР Р…Р В°Р С—РЎР‚Р В°Р Р†Р В»РЎРЏР ВµР С Р Р…Р В° Google
                            google.accounts.id.prompt();
                        };
                        script.onerror = function () {
                            console.error('[Google Auth] Script failed to load');
                        };
                        document.body.appendChild(script);
                    });
                }

                // GitHub Р С”Р Р…Р С•Р С—Р С”Р В° - OAuth РЎвЂЎР ВµРЎР‚Р ВµР В· popup
                const githubBtn = ov.querySelector('#github-login-btn');
                if (githubBtn) {
                    githubBtn.addEventListener('click', function () {
                        console.log('[GitHub Auth] Button clicked');
                        // Р С›РЎвЂљР С”РЎР‚РЎвЂ№Р Р†Р В°Р ВµР С GitHub OAuth Р Р† popup Р С•Р С”Р Р…Р Вµ
                        const popup = window.open(
                            `${BACKEND_URL}/api/auth/github`,
                            'GitHub Auth',
                            'width=600,height=400,left=' + (screen.width / 2 - 300) + ',top=' + (screen.height / 2 - 200)
                        );

                        // Р РЋР В»РЎС“РЎв‚¬Р В°Р ВµР С РЎРѓР С•Р С•Р В±РЎвЂ°Р ВµР Р…Р С‘Р Вµ Р С•РЎвЂљ popup
                        const handleMessage = (event) => {
                            if (event.data && event.data.type === 'github-auth') {
                                console.log('[GitHub Auth] Success:', event.data);
                                // Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏР ВµР С Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р Вµ
                                localStorage.setItem('qaUsername', event.data.username);
                                localStorage.setItem('qaAuthType', 'github');
                                setLoggedUser({ username: event.data.username, role: event.data.role });
                                // Р вЂ”Р В°Р С”РЎР‚РЎвЂ№Р Р†Р В°Р ВµР С Р СР С•Р Т‘Р В°Р В»РЎРЉР Р…Р С•Р Вµ Р С•Р С”Р Р…Р С•
                                const ov = document.getElementById('login-overlay');
                                if (ov) ov.remove();
                                // Р СџР ВµРЎР‚Р ВµР В·Р В°Р С–РЎР‚РЎС“Р В¶Р В°Р ВµР С РЎРѓРЎвЂљРЎР‚Р В°Р Р…Р С‘РЎвЂ РЎС“
                                window.location.reload();
                                // Р Р€Р Т‘Р В°Р В»РЎРЏР ВµР С РЎРѓР В»РЎС“РЎв‚¬Р В°РЎвЂљР ВµР В»РЎРЉ
                                window.removeEventListener('message', handleMessage);
                            }
                        };

                        window.addEventListener('message', handleMessage);

                        // Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЏР ВµР С Р В·Р В°Р С”РЎР‚РЎвЂ№РЎвЂљР С‘Р Вµ popup
                        const checkClosed = setInterval(() => {
                            if (popup.closed) {
                                clearInterval(checkClosed);
                                window.removeEventListener('message', handleMessage);
                            }
                        }, 500);
                    });
                }

                // Telegram Login Widget - Р В·Р В°Р С–РЎР‚РЎС“Р В¶Р В°Р ВµР С РЎРѓРЎР‚Р В°Р В·РЎС“
                const widgetContainer = ov.querySelector('#tg-widget-container');
                console.log('[TG DEBUG] Р С™Р С•Р Р…РЎвЂљР ВµР в„–Р Р…Р ВµРЎР‚ Р Р†Р С‘Р Т‘Р В¶Р ВµРЎвЂљР В° Р Р…Р В°Р в„–Р Т‘Р ВµР Р…:', !!widgetContainer);

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
                        console.log('[TG Auth] РІСљвЂ¦ Р вЂ™Р С‘Р Т‘Р В¶Р ВµРЎвЂљ Telegram Р В·Р В°Р С–РЎР‚РЎС“Р В¶Р ВµР Р…');
                    };

                    widgetContainer.appendChild(script);
                }

                // Р вЂњР В»Р С•Р В±Р В°Р В»РЎРЉР Р…РЎвЂ№Р в„– Р С”Р С•Р В»Р В»Р В±РЎРЊР С” Р Т‘Р В»РЎРЏ Google OAuth
                window.handleGoogleSignIn = async function (response) {
                    console.log('[Google Auth] === RESPONSE RECEIVED ===');
                    console.log('[Google Auth] Full response:', JSON.stringify(response, null, 2));

                    try {
                        // Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЏР ВµР С РЎвЂЎРЎвЂљР С• credential РЎРѓРЎС“РЎвЂ°Р ВµРЎРѓРЎвЂљР Р†РЎС“Р ВµРЎвЂљ
                        if (!response || !response.credential) {
                            console.error('[Google Auth] No credential in response');
                            alert('Р С›РЎв‚¬Р С‘Р В±Р С”Р В°: Google Р Р…Р Вµ Р Р†Р ВµРЎР‚Р Р…РЎС“Р В» РЎвЂљР С•Р С”Р ВµР Р…. Р СџР С•Р С—РЎР‚Р С•Р В±РЎС“Р в„–РЎвЂљР Вµ Р ВµРЎвЂ°РЎвЂ РЎР‚Р В°Р В·.');
                            return;
                        }

                        console.log('[Google Auth] Credential received');

                        // Р В Р В°Р В·Р Т‘Р ВµР В»РЎРЏР ВµР С JWT Р Р…Р В° РЎвЂЎР В°РЎРѓРЎвЂљР С‘
                        const parts = response.credential.split('.');

                        // Google Р С‘РЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р ВµРЎвЂљ URL-safe base64, Р Р…РЎС“Р В¶Р Р…Р С• Р В·Р В°Р СР ВµР Р…Р С‘РЎвЂљРЎРЉ - Р Р…Р В° + Р С‘ _ Р Р…Р В° /
                        let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                        const userInfo = JSON.parse(atob(base64));

                        console.log('[Google Auth] User info:', userInfo);

                        // Р С›Р СћР СџР В Р С’Р вЂ™Р вЂєР Р‡Р вЂўР Сљ Р вЂєР С›Р вЂњР В Р СњР С’ Р РЋР вЂўР В Р вЂ™Р вЂўР В 
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

                        // Р С›РЎвЂљР С—РЎР‚Р В°Р Р†Р В»РЎРЏР ВµР С Р Р…Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚ Р Т‘Р В»РЎРЏ Р В°Р Р†РЎвЂљР С•РЎР‚Р С‘Р В·Р В°РЎвЂ Р С‘Р С‘
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
                            // Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏР ВµР С Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р Вµ Р Т‘Р В»РЎРЏ Р В°Р Р†РЎвЂљР С•Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С”Р С‘
                            localStorage.setItem('qaUsername', data.username);
                            localStorage.setItem('qaAuthType', 'google');
                            setLoggedUser({ username: data.username, role: data.role });

                            // Р вЂ”Р В°Р С”РЎР‚РЎвЂ№Р Р†Р В°Р ВµР С Р СР С•Р Т‘Р В°Р В»РЎРЉР Р…Р С•Р Вµ Р С•Р С”Р Р…Р С•
                            const ov = document.getElementById('login-overlay');
                            if (ov) ov.remove();

                            // Р СџР ВµРЎР‚Р ВµР В·Р В°Р С–РЎР‚РЎС“Р В¶Р В°Р ВµР С РЎРѓРЎвЂљРЎР‚Р В°Р Р…Р С‘РЎвЂ РЎС“
                            window.location.reload();
                        } else {
                            console.error('[Google Auth] Server error:', data.error);
                            alert('Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р В°Р Р†РЎвЂљР С•РЎР‚Р С‘Р В·Р В°РЎвЂ Р С‘Р С‘: ' + (data.error || 'Р СњР ВµР С‘Р В·Р Р†Р ВµРЎРѓРЎвЂљР Р…Р В°РЎРЏ Р С•РЎв‚¬Р С‘Р В±Р С”Р В°'));
                        }
                    } catch (e) {
                        console.error('[Google Auth] === ERROR ===');
                        console.error('[Google Auth] Error type:', e.name);
                        console.error('[Google Auth] Error message:', e.message);
                        console.error('[Google Auth] Stack:', e.stack);
                        alert('Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р В°Р Р†РЎвЂљР С•РЎР‚Р С‘Р В·Р В°РЎвЂ Р С‘Р С‘: ' + e.message);
                    }
                };

                // Р вЂњР В»Р С•Р В±Р В°Р В»РЎРЉР Р…РЎвЂ№Р в„– Р С”Р С•Р В»Р В»Р В±РЎРЊР С” Р Т‘Р В»РЎРЏ Р Р†Р С‘Р Т‘Р В¶Р ВµРЎвЂљР В° Telegram
                window.onTelegramAuth = async function (user) {
                    console.log('[TG Auth] Р вЂќР В°Р Р…Р Р…РЎвЂ№Р Вµ Р С•РЎвЂљ Telegram:', user);

                    const authUrl = `${BACKEND_URL}/api/auth/telegram`;

                    try {
                        const res = await fetch(authUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(user)
                        });

                        const data = await res.json();
                        console.log('[TG Auth] Р С›РЎвЂљР Р†Р ВµРЎвЂљ РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚Р В°:', data);

                        if (res.ok && data.ok) {
                            // СЂСџвЂќТђ Р СњР вЂў РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏР ВµР С Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р Вµ Р Т‘Р В»РЎРЏ Р В°Р Р†РЎвЂљР С•Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С”Р С‘ - Р С—РЎР‚Р С•РЎРѓРЎвЂљР С• Р Р†РЎвЂ¦Р С•Р Т‘Р С‘Р С
                            setLoggedUser({ username: data.username, role: data.role });
                            ov.remove();
                            window.location.reload();
                        } else {
                            // Р СџР С•Р С”Р В°Р В·РЎвЂ№Р Р†Р В°Р ВµР С Р С•РЎв‚¬Р С‘Р В±Р С”РЎС“
                            if (data.error === 'not_subscribed') {
                                alert('РІСњвЂ” Р вЂќР В»РЎРЏ Р Р†РЎвЂ¦Р С•Р Т‘Р В° Р Р…Р ВµР С•Р В±РЎвЂ¦Р С•Р Т‘Р С‘Р СР С• Р С—Р С•Р Т‘Р С—Р С‘РЎРѓР В°РЎвЂљРЎРЉРЎРѓРЎРЏ Р Р…Р В° Р С”Р В°Р Р…Р В°Р В»:\n' + TELEGRAM_CHANNEL_ID);
                            } else {
                                alert('Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р В°Р Р†РЎвЂљР С•РЎР‚Р С‘Р В·Р В°РЎвЂ Р С‘Р С‘: ' + (data.error || 'Р СњР ВµР С‘Р В·Р Р†Р ВµРЎРѓРЎвЂљР Р…Р В°РЎРЏ Р С•РЎв‚¬Р С‘Р В±Р С”Р В°'));
                            }
                        }
                    } catch (e) {
                        console.error('[TG Auth] Error:', e);
                        alert('Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р В°Р Р†РЎвЂљР С•РЎР‚Р С‘Р В·Р В°РЎвЂ Р С‘Р С‘: ' + e.message);
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

                        // Local auth only (Р В»Р С•Р С”Р В°Р В»РЎРЉР Р…РЎвЂ№Р в„– РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚)
                        try {
                            // Р СџРЎР‚Р С•Р В±РЎС“Р ВµР С Р Р†Р С•Р в„–РЎвЂљР С‘ РЎвЂЎР ВµРЎР‚Р ВµР В· Р В»Р С•Р С”Р В°Р В»РЎРЉР Р…РЎвЂ№Р в„– API
                            const loginRes = await fetch(`${BACKEND_URL} /api/login`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ username: u, password: p })
                            });

                            if (loginRes.ok) {
                                const loginData = await loginRes.json();
                                if (loginData.ok) {
                                    // Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏР ВµР С username/password Р Т‘Р В»РЎРЏ Р С—Р С•РЎРѓР В»Р ВµР Т‘РЎС“РЎР‹РЎвЂ°Р ВµР в„– Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С”Р С‘ Р Т‘Р В°Р Р…Р Р…РЎвЂ№РЎвЂ¦
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
                            // Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏР ВµР С credentials Р Т‘Р В»РЎРЏ Р В°Р Р†РЎвЂљР С•Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С”Р С‘
                            if (remember) {
                                localStorage.setItem('qaUsername', u);
                                localStorage.setItem('qaPassword', p);
                            }
                            ov.remove();
                        } else {
                            alert('Р СњР ВµР Р†Р ВµРЎР‚Р Р…РЎвЂ№Р в„– Р В»Р С•Р С–Р С‘Р Р… Р С‘Р В»Р С‘ Р С—Р В°РЎР‚Р С•Р В»РЎРЉ');
                        }
                    } catch {
                        alert('Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р Р†РЎвЂ¦Р С•Р Т‘Р В°');
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
                    <div style="font-weight:600;margin-bottom:10px">Р вЂќР С•Р В±Р В°Р Р†Р С‘РЎвЂљРЎРЉ Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЏ</div>
                    <div style="display:flex;flex-direction:column;gap:8px">
                        <input id="new-username" placeholder="Р вЂєР С•Р С–Р С‘Р Р…" style="padding:8px;border-radius:6px;border:1px solid #444;background:#1f1f1f;color:#fff"/>
                        <input id="new-password" placeholder="Р СџР В°РЎР‚Р С•Р В»РЎРЉ" type="password" style="padding:8px;border-radius:6px;border:1px solid #444;background:#1f1f1f;color:#fff"/>
                        <select id="new-role" style="padding:8px;border-radius:6px;border:1px solid #444;background:#1f1f1f;color:#fff">
                            <option value="user">Р СџР С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЉ</option>
                            <option value="editor">Р В Р ВµР Т‘Р В°Р С”РЎвЂљР С•РЎР‚</option>
                            <option value="admin">Р С’Р Т‘Р СР С‘Р Р…Р С‘РЎРѓРЎвЂљРЎР‚Р В°РЎвЂљР С•РЎР‚</option>
                        </select>
                        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">
                            <button id="admin-cancel" style="padding:8px 12px;border-radius:6px;border:1px solid #555;background:#1f1f1f;color:#fff">Р С›РЎвЂљР СР ВµР Р…Р В°</button>
                            <button id="admin-add" style="padding:8px 12px;border-radius:6px;border:1px solid #3b82f6;background:#3b82f6;color:#fff">Р вЂќР С•Р В±Р В°Р Р†Р С‘РЎвЂљРЎРЉ</button>
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
                    if (!u || !p) { alert('Р вЂєР С•Р С–Р С‘Р Р… Р С‘ Р С—Р В°РЎР‚Р С•Р В»РЎРЉ Р С•Р В±РЎРЏР В·Р В°РЎвЂљР ВµР В»РЎРЉР Р…РЎвЂ№'); return; }
                    const client = window.__supabaseClient;
                    (async () => {
                        if (client) {
                            try {
                                const { error } = await client.from('users').upsert({ username: u, password: p, role: r }, { onConflict: 'username' });
                                if (error) throw error;
                                ov.remove();
                                alert('Р СџР С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЉ Р Т‘Р С•Р В±Р В°Р Р†Р В»Р ВµР Р…');
                                return;
                            } catch { }
                        }
                        const raw = localStorage.getItem('usersDB') || '[]';
                        let users = [];
                        try { users = JSON.parse(raw); } catch { }
                        if (users.find(x => x.username === u)) { alert('Р СћР В°Р С”Р С•Р в„– Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЉ РЎС“Р В¶Р Вµ РЎРѓРЎС“РЎвЂ°Р ВµРЎРѓРЎвЂљР Р†РЎС“Р ВµРЎвЂљ'); return; }
                        users.push({ username: u, password: p, role: r });
                        localStorage.setItem('usersDB', JSON.stringify(users));
                        ov.remove();
                        alert('Р СџР С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЉ Р Т‘Р С•Р В±Р В°Р Р†Р В»Р ВµР Р…');
                    })();
                });
            }
        }

        function openCloudOverview() {
            const client = window.__supabaseClient;
            if (!client) { alert('Supabase Р Р…Р ВµР Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р ВµР Р…'); return; }
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
                        <div style="font-weight:600">Supabase Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р Вµ</div>
                        <button id="cloud-close" style="padding:6px 10px;border:1px solid #444;background:#111;color:#ddd;border-radius:6px">Р вЂ”Р В°Р С”РЎР‚РЎвЂ№РЎвЂљРЎРЉ</button>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                        <div>
                            <div style="font-weight:600;margin-bottom:6px">Р СџР С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»Р С‘</div>
                            <div id="cloud-users" style="max-height:260px;overflow:auto;border:1px solid #333;border-radius:6px;padding:8px"></div>
                        </div>
                        <div>
                            <div style="font-weight:600;margin-bottom:6px">Р вЂќР С•РЎРѓРЎвЂљР С‘Р В¶Р ВµР Р…Р С‘РЎРЏ (daily_stats)</div>
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
            usersEl.textContent = 'Р вЂ”Р В°Р С–РЎР‚РЎС“Р В·Р С”Р В°...';
            statsEl.textContent = 'Р вЂ”Р В°Р С–РЎР‚РЎС“Р В·Р С”Р В°...';
            client.from('users').select('*').then(({ data, error }) => {
                if (error) { usersEl.textContent = 'Р С›РЎв‚¬Р С‘Р В±Р С”Р В°'; return; }
                usersEl.innerHTML = (data || []).map(u => `< div > ${u.username} РІР‚Сћ РЎР‚Р С•Р В»РЎРЉ: ${u.role || 'user'}</div > `).join('') || '<div>Р СџРЎС“РЎРѓРЎвЂљР С•</div>';
            }).catch(() => { usersEl.textContent = 'Р С›РЎв‚¬Р С‘Р В±Р С”Р В°'; });
            const loadStats = () => {
                client.from('daily_stats').select('*').order('date', { ascending: false }).limit(50).then(({ data, error }) => {
                    if (error) { statsEl.textContent = 'Р С›РЎв‚¬Р С‘Р В±Р С”Р В°'; return; }
                    const list = data || [];
                    const hasDevices = list.some(s => String(s.user_id || '').startsWith('device_'));
                    const btn = document.createElement('button');
                    btn.textContent = 'Р СџРЎР‚Р С‘Р Р†РЎРЏР В·Р В°РЎвЂљРЎРЉ device_* Р С” РЎвЂљР ВµР С”РЎС“РЎвЂ°Р ВµР СРЎС“ Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎР‹';
                    btn.style.cssText = 'margin-bottom:8px;padding:6px 10px;border:1px solid #444;background:#111;color:#ddd;border-radius:6px';
                    statsEl.innerHTML = '';
                    if (hasDevices) {
                        statsEl.appendChild(btn);
                        btn.addEventListener('click', async () => {
                            btn.disabled = true;
                            btn.textContent = 'Р СљР С‘Р С–РЎР‚Р В°РЎвЂ Р С‘РЎРЏ...';
                            let result = null;
                            try { result = await migrateDeviceRecordsToUser(); } catch { }
                            btn.disabled = false;
                            const d = (result && typeof result.daily === 'number') ? result.daily : 0;
                            const c = (result && typeof result.cards === 'number') ? result.cards : 0;
                            window.__cloudLastMigration = { daily: d, cards: c, at: Date.now() };
                            btn.textContent = `Р вЂњР С•РЎвЂљР С•Р Р†Р С•: Р Т‘Р С•РЎРѓРЎвЂљР С‘Р В¶Р ВµР Р…Р С‘РЎРЏ ${d}, Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р С‘ ${c} `;
                            setTimeout(() => { btn.textContent = 'Р СџРЎР‚Р С‘Р Р†РЎРЏР В·Р В°РЎвЂљРЎРЉ device_* Р С” РЎвЂљР ВµР С”РЎС“РЎвЂ°Р ВµР СРЎС“ Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎР‹'; }, 1800);
                            loadStats();
                        });
                    }
                    if (window.__cloudLastMigration && typeof window.__cloudLastMigration.daily === 'number') {
                        const info = document.createElement('div');
                        info.style.cssText = 'margin:6px 0;padding:6px 10px;border:1px solid #444;background:#222;color:#ddd;border-radius:6px';
                        info.textContent = `Р СџР С•РЎРѓР В»Р ВµР Т‘Р Р…РЎРЏРЎРЏ Р СР С‘Р С–РЎР‚Р В°РЎвЂ Р С‘РЎРЏ: Р Т‘Р С•РЎРѓРЎвЂљР С‘Р В¶Р ВµР Р…Р С‘РЎРЏ ${window.__cloudLastMigration.daily}, Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р С‘ ${window.__cloudLastMigration.cards} `;
                        statsEl.appendChild(info);
                        // Р С•РЎвЂЎР С‘РЎРѓРЎвЂљР С‘РЎвЂљРЎРЉ РЎвЂЎР ВµРЎР‚Р ВµР В· Р С”Р С•РЎР‚Р С•РЎвЂљР С”Р С•Р Вµ Р Р†РЎР‚Р ВµР СРЎРЏ, РЎвЂЎРЎвЂљР С•Р В±РЎвЂ№ Р Р…Р Вµ Р СР ВµРЎв‚¬Р В°Р В»Р С•
                        setTimeout(() => { try { delete window.__cloudLastMigration; } catch { } }, 2500);
                    }
                    const rows = list.map(s => `< div > ${s.user_id} РІР‚Сћ ${s.date} РІР‚Сћ xp:${s.xp} РІР‚Сћ Р В±Р С•Р Р…РЎС“РЎРѓ:${s.bonus} РІР‚Сћ Р Т‘Р ВµР Р…РЎРЉ:${s.day_bonus} РІР‚Сћ РЎРѓРЎвЂљРЎР‚Р С‘Р С”:${s.streak}</div > `).join('');
                    statsEl.innerHTML += rows || '<div>Р СџРЎС“РЎРѓРЎвЂљР С•</div>';
                }).catch(() => { statsEl.textContent = 'Р С›РЎв‚¬Р С‘Р В±Р С”Р В°'; });
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
        // Р В¤РЎС“Р Р…Р С”РЎвЂ Р С‘Р С‘ Р СР ВµР Р…РЎР‹ Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р в„– Р Р† РЎР‚Р ВµР В¶Р С‘Р СР Вµ РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ
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
                btn.title = 'Р СљР ВµР Р…РЎР‹ Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р С‘';
                btn.textContent = 'РІвЂ№В®';
                // Р РЋРЎвЂљР С‘Р В»Р С‘ Р С—Р ВµРЎР‚Р ВµР Р…Р ВµРЎРѓР ВµР Р…РЎвЂ№ Р Р† CSS
                tab.appendChild(btn);
                btn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    openCategoryMenu(tab, cId);
                });
            });
        }

        // Р СџР ВµРЎР‚Р ВµРЎР‚Р С‘РЎРѓР С•Р Р†Р С”Р В° РЎвЂљР В°Р В±Р С•Р Р† Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р в„–
        function refreshCategoriesTabs(oldName = null, newName = null) {
            // СЂСџвЂќТђ Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С categories Р С‘Р В· Р В°Р С”РЎвЂљРЎС“Р В°Р В»РЎРЉР Р…РЎвЂ№РЎвЂ¦ Р Т‘Р В°Р Р…Р Р…РЎвЂ№РЎвЂ¦
            categories = buildCategoriesFromData(getRuntimeData());

            const active = tabsContainer.querySelector('.tab.active');
            const activeId = active?.dataset?.category || 'all';
            tabsContainer.innerHTML = '';
            const allTab = document.createElement('div');
            allTab.className = 'tab';
            allTab.dataset.category = 'all';
            allTab.textContent = 'Р вЂ™РЎРѓР Вµ Р Р†Р С•Р С—РЎР‚Р С•РЎРѓРЎвЂ№';
            tabsContainer.appendChild(allTab);
            const favTab = document.createElement('div');
            favTab.className = 'tab';
            favTab.dataset.category = 'favorites';
            favTab.textContent = 'РІВвЂ¦';
            tabsContainer.appendChild(favTab);
            const cats = buildCategoriesFromData(getRuntimeData());
            // Р СџРЎР‚Р С‘Р СР ВµР Р…РЎРЏР ВµР С РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎвЂР Р…Р Р…РЎвЂ№Р в„– Р С—Р С•РЎР‚РЎРЏР Т‘Р С•Р С” Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р в„–, Р ВµРЎРѓР В»Р С‘ Р С•Р Р… Р ВµРЎРѓРЎвЂљРЎРЉ
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
            // Р вЂ™Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р В°Р Р†Р В»Р С‘Р Р†Р В°Р ВµР С Р В°Р С”РЎвЂљР С‘Р Р†Р Р…РЎвЂ№Р в„– РЎвЂљР В°Р В±, Р ВµРЎРѓР В»Р С‘ Р Р†Р С•Р В·Р СР С•Р В¶Р Р…Р С•
            const toActivate = tabsContainer.querySelector(`.tab[data-category="${activeId}"]`) || allTab;
            toActivate.classList.add('active');
            // Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С Р СР ВµР Р…РЎР‹ РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ
            refreshCategoryEditMenus();
            // Р вЂ™Р С”Р В»РЎР‹РЎвЂЎР В°Р ВµР С Р С—Р ВµРЎР‚Р ВµРЎвЂљР В°РЎРѓР С”Р С‘Р Р†Р В°Р Р…Р С‘Р Вµ Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р в„– Р Р† РЎР‚Р ВµР В¶Р С‘Р СР Вµ РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ
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
                            setSaveStatus('saving', 'Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘Р Вµ Р С—Р С•РЎР‚РЎРЏР Т‘Р С”Р В° Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р в„–...');
                            const meta = await getServerMetadata();
                            meta.categoryOrder = names;
                            const ok = await updateServerMetadata(meta);
                            setSaveStatus(ok ? 'success' : 'error', ok ? 'Р СџР С•РЎР‚РЎРЏР Т‘Р С•Р С” РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎвЂР Р…' : 'Р С›РЎв‚¬Р С‘Р В±Р С”Р В° РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘РЎРЏ');
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
            < button data - act="rename" > Р СџР ВµРЎР‚Р ВµР С‘Р СР ВµР Р…Р С•Р Р†Р В°РЎвЂљРЎРЉ</button >
            <button data-act="duplicate">Р вЂќРЎС“Р В±Р В»Р С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉ</button>
            <button data-act="delete">Р Р€Р Т‘Р В°Р В»Р С‘РЎвЂљРЎРЉ</button>
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
                    const newName = prompt('Р СњР С•Р Р†Р С•Р Вµ Р Р…Р В°Р В·Р Р†Р В°Р Р…Р С‘Р Вµ Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р С‘:', catObj.name);
                    if (newName && newName !== catObj.name) {
                        const ov = getOverrides();
                        uniqueQaData.forEach(it => { if (it.category === catObj.name) { ov[it.question] = { ...ov[it.question], category: newName }; } });
                        setLS('qaAdminOverrides', ov);
                        // Р С’Р Р†РЎвЂљР С•РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘Р Вµ
                        saveMergedToServer();
                        // Р СџР ВµРЎР‚Р ВµРЎР‚Р С‘РЎРѓР С•Р Р†РЎвЂ№Р Р†Р В°Р ВµР С РЎвЂљР В°Р В±РЎвЂ№, РЎвЂЎРЎвЂљР С•Р В±РЎвЂ№ РЎРѓРЎР‚Р В°Р В·РЎС“ РЎС“Р Р†Р С‘Р Т‘Р ВµРЎвЂљРЎРЉ Р Р…Р С•Р Р†Р С•Р Вµ Р С‘Р СРЎРЏ
                        refreshCategoriesTabs(catObj.name, newName);
                        setSaveStatus('success', 'Р С™Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏ Р С—Р ВµРЎР‚Р ВµР С‘Р СР ВµР Р…Р С•Р Р†Р В°Р Р…Р В°');
                    }
                } else if (act === 'duplicate') {
                    const dupName = prompt('Р СњР В°Р В·Р Р†Р В°Р Р…Р С‘Р Вµ Р С”Р С•Р С—Р С‘Р С‘ Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р С‘:', `${catObj.name} (Р С”Р С•Р С—Р С‘РЎРЏ)`);
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
                    // Р СџР ВµРЎР‚Р ВµРЎР‚Р С‘РЎРѓР С•Р Р†РЎвЂ№Р Р†Р В°Р ВµР С РЎвЂљР В°Р В±РЎвЂ№, РЎвЂЎРЎвЂљР С•Р В±РЎвЂ№ РЎРѓРЎР‚Р В°Р В·РЎС“ Р С—Р С•РЎРЏР Р†Р С‘Р В»Р В°РЎРѓРЎРЉ Р Р…Р С•Р Р†Р В°РЎРЏ Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏ
                    refreshCategoriesTabs();
                    setSaveStatus('success', 'Р С™Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏ Р Т‘РЎС“Р В±Р В»Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р В°');
                } else if (act === 'delete') {
                    if (!confirm('Р Р€Р Т‘Р В°Р В»Р С‘РЎвЂљРЎРЉ Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎР‹ Р Р† Р С”Р С•РЎР‚Р В·Р С‘Р Р…РЎС“?')) return;
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
                    setSaveStatus('success', 'Р С™Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏ РЎС“Р Т‘Р В°Р В»Р ВµР Р…Р В° Р Р† Р С”Р С•РЎР‚Р В·Р С‘Р Р…РЎС“');
                }
                menu.remove();
            });
        }

        // Р СљР ВµР Р…РЎР‹ Р С—Р С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р в„– Р Р† РЎР‚Р ВµР В¶Р С‘Р СР Вµ РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ
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
                btn.title = 'Р СљР ВµР Р…РЎР‹ Р С—Р С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р С‘';
                btn.textContent = 'РІвЂ№В®';
                btn.style.marginLeft = '8px';
                // Р СћРЎвЂР СР Р…Р С•-РЎРѓР ВµРЎР‚РЎвЂ№Р в„– РЎРѓРЎвЂљР С‘Р В»РЎРЉ
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
            < button data - act="rename" > Р СџР ВµРЎР‚Р ВµР С‘Р СР ВµР Р…Р С•Р Р†Р В°РЎвЂљРЎРЉ</button >
            <button data-act="duplicate">Р вЂќРЎС“Р В±Р В»Р С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉ</button>
            <button data-act="delete">Р Р€Р Т‘Р В°Р В»Р С‘РЎвЂљРЎРЉ</button>
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
                    const newName = prompt('Р СњР С•Р Р†Р С•Р Вµ Р Р…Р В°Р В·Р Р†Р В°Р Р…Р С‘Р Вµ Р С—Р С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р С‘:', subcatName);
                    if (newName && newName !== subcatName) {
                        const scPlaceholders = getSubcategoryPlaceholders();
                        if (!scPlaceholders[categoryName]) scPlaceholders[categoryName] = {};
                        scPlaceholders[categoryName][subcatName] = { displayName: newName };
                        setSubcategoryPlaceholders(scPlaceholders);
                        // Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С Р Р†РЎРѓР Вµ Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р С‘ РЎРЊРЎвЂљР С•Р в„– Р С—Р С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р С‘ РЎвЂЎР ВµРЎР‚Р ВµР В· overrides
                        const ov = getOverrides();
                        getRuntimeData().forEach(it => {
                            if (it.category === categoryName && it.subcategory === subcatName) {
                                ov[it.question] = { ...ov[it.question], subcategory: newName };
                            }
                        });
                        setLS('qaAdminOverrides', ov);
                        rebuildSubcategoriesForCategory(categoryName);
                        saveMergedToServer();
                        setSaveStatus('success', 'Р СџР С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏ Р С—Р ВµРЎР‚Р ВµР С‘Р СР ВµР Р…Р С•Р Р†Р В°Р Р…Р В°');
                    }
                } else if (act === 'duplicate') {
                    const dupName = prompt('Р СњР В°Р В·Р Р†Р В°Р Р…Р С‘Р Вµ Р С”Р С•Р С—Р С‘Р С‘ Р С—Р С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р С‘:', `${subcatName} (Р С”Р С•Р С—Р С‘РЎРЏ)`);
                    if (!dupName) return;
                    const newItemsArr = getNewItems();
                    getRuntimeData().filter(it => it.category === categoryName && it.subcategory === subcatName)
                        .forEach(it => {
                            const newQuestion = genUniqueQuestionGlobal(it.question);
                            newItemsArr.push({ ...it, subcategory: dupName, question: newQuestion });
                        });
                    setLS('qaNewItems', newItemsArr);
                    // Р вЂќР С•Р В±Р В°Р Р†Р В»РЎРЏР ВµР С Р С—Р В»Р ВµР в„–РЎРѓРЎвЂ¦Р С•Р В»Р Т‘Р ВµРЎР‚ Р С•РЎвЂљР С•Р В±РЎР‚Р В°Р В¶Р ВµР Р…Р С‘РЎРЏ
                    const scPlaceholders = getSubcategoryPlaceholders();
                    if (!scPlaceholders[categoryName]) scPlaceholders[categoryName] = {};
                    scPlaceholders[categoryName][dupName] = { displayName: dupName };
                    setSubcategoryPlaceholders(scPlaceholders);

                    // Force full refresh to ensure data visibility
                    refreshCategoriesTabs();
                    rebuildSubcategoriesForCategory(categoryName);

                    saveMergedToServer();
                    setSaveStatus('success', 'Р СџР С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏ Р Т‘РЎС“Р В±Р В»Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р В°');
                } else if (act === 'delete') {
                    if (!confirm('Р Р€Р Т‘Р В°Р В»Р С‘РЎвЂљРЎРЉ Р С—Р С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎР‹ Р Р† Р С”Р С•РЎР‚Р В·Р С‘Р Р…РЎС“?')) { menu.remove(); return; }
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
                    setSaveStatus('success', 'Р СџР С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏ РЎС“Р Т‘Р В°Р В»Р ВµР Р…Р В° Р Р† Р С”Р С•РЎР‚Р В·Р С‘Р Р…РЎС“');
                }
                menu.remove();
            });
        }

        // Р СџР ВµРЎР‚Р ВµРЎРѓРЎвЂљРЎР‚Р С•Р С‘РЎвЂљРЎРЉ РЎРѓР С—Р С‘РЎРѓР С•Р С” Р С—Р С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р в„– Р Т‘Р В»РЎРЏ Р Р†РЎвЂ№Р В±РЎР‚Р В°Р Р…Р Р…Р С•Р в„– Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р С‘
        function rebuildSubcategoriesForCategory(categoryName) {
            const allCats = buildCategoriesFromData(getRuntimeData());
            const catObj = allCats.find(c => c.name === categoryName);
            if (!catObj) return;
            subcategoriesContainer.style.display = 'flex';
            subcategoriesContainer.innerHTML = '';
            const allCard = document.createElement('div');
            allCard.className = 'subcategory-card active';
            allCard.dataset.subcategory = 'all';
            allCard.textContent = 'Р вЂ™РЎРѓР Вµ Р С—Р С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р С‘';
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
                            setSaveStatus('saving', 'Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘Р Вµ Р С—Р С•РЎР‚РЎРЏР Т‘Р С”Р В° Р С—Р С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р в„–...');
                            const meta = await getServerMetadata();
                            meta.subcategoryOrder = meta.subcategoryOrder || {};
                            meta.subcategoryOrder[categoryName] = names;
                            const ok = await updateServerMetadata(meta);
                            setSaveStatus(ok ? 'success' : 'error', ok ? 'Р СџР С•РЎР‚РЎРЏР Т‘Р С•Р С” РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎвЂР Р…' : 'Р С›РЎв‚¬Р С‘Р В±Р С”Р В° РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘РЎРЏ');
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
            catDiv.innerHTML = '<div><strong>Р С™Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р С‘:</strong></div><div>Р СџРЎС“РЎРѓРЎвЂљР С•</div>';
            // Р РЋР С—Р С‘РЎРѓР С•Р С” РЎС“Р Т‘Р В°Р В»РЎвЂР Р…Р Р…РЎвЂ№РЎвЂ¦ Р Р†Р С•Р С—РЎР‚Р С•РЎРѓР С•Р Р† + РЎРѓР С•РЎР‚РЎвЂљР С‘РЎР‚Р С•Р Р†Р С”Р В° Р С—Р С• Р С•РЎР‚Р С‘Р С–Р С‘Р Р…Р В°Р В»РЎРЉР Р…Р С•Р СРЎС“ Р С—Р С•РЎР‚РЎРЏР Т‘Р С”РЎС“ ("Р вЂ™РЎРѓР Вµ Р Р†Р С•Р С—РЎР‚Р С•РЎРѓРЎвЂ№")
            const deletedCards = serverTrashItems.map(t => t.item?.question).filter(Boolean);
            const baseOrder = getOrderForContext('all') || getRuntimeData().map(i => i.question);
            const idxMap = new Map(baseOrder.map((q, i) => [q, i]));
            const sortedTrash = [...serverTrashItems].sort((a, b) =>
                (idxMap.get(a.item?.question) ?? 1e9) - (idxMap.get(b.item?.question) ?? 1e9)
            );
            // Header + grid container
            cardDiv.innerHTML = '';
            const header = document.createElement('div');
            header.innerHTML = '<strong>Р С™Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р С‘:</strong>' + (deletedCards.length ? '' : ' <span>Р СџРЎС“РЎРѓРЎвЂљР С•</span>');
            cardDiv.appendChild(header);
            const grid = document.createElement('div');
            grid.className = 'trash-cards-grid';
            cardDiv.appendChild(grid);

            sortedTrash.forEach(entry => {
                const q = entry.item?.question;
                const it = entry.item || uniqueQaData.find(i => i.question === q) || getNewItems().find(i => i.question === q);
                const mini = document.createElement('div');
                mini.className = 'result-item trash-mini';

                // Р вЂ™Р ВµРЎР‚РЎвЂ¦Р Р…РЎРЏРЎРЏ Р В·Р С•Р Р…Р В°: РЎвЂљР ВµР С–Р С‘ (Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏ, Р С—Р С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏ)
                const meta = document.createElement('div');
                meta.className = 'trash-meta';
                meta.style.display = 'flex';
                meta.style.flexWrap = 'wrap';
                meta.style.gap = '6px';
                const catBadge = document.createElement('span'); catBadge.className = 'category-badge'; catBadge.textContent = (it && it.category) ? it.category : '';
                const subBadge = document.createElement('span'); subBadge.className = 'subcategory-badge'; subBadge.textContent = (it && it.subcategory) ? it.subcategory : '';
                meta.appendChild(catBadge); meta.appendChild(subBadge);

                // Р вЂ™Р С•Р С—РЎР‚Р С•РЎРѓ - Р С—РЎР‚Р С‘Р СР ВµР Р…РЎРЏР ВµР С РЎвЂћР С•РЎР‚Р СР В°РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘Р Вµ
                const qText = document.createElement('div');
                qText.className = 'question';
                const questionFormatting = it?.formatting?.question || [];
                qText.innerHTML = applyFormatting(it?.question || q, questionFormatting);
                qText.style.marginTop = '6px';

                // Р С›РЎвЂљР Р†Р ВµРЎвЂљ - Р С—РЎР‚Р С‘Р СР ВµР Р…РЎРЏР ВµР С РЎвЂћР С•РЎР‚Р СР В°РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘Р Вµ
                const aEl = document.createElement('div');
                aEl.className = 'answer';
                const answerFormatting = it?.formatting?.answer || [];
                aEl.innerHTML = applyFormatting(it?.answer || '', answerFormatting);
                aEl.style.marginTop = '6px';

                // Р вЂќР ВµР в„–РЎРѓРЎвЂљР Р†Р С‘РЎРЏ (Р Р†Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р С‘РЎвЂљРЎРЉ / РЎС“Р Т‘Р В°Р В»Р С‘РЎвЂљРЎРЉ Р Р…Р В°Р Р†РЎРѓР ВµР С–Р Т‘Р В°) Р Р†Р Р…Р С‘Р В·РЎС“
                const actions = document.createElement('div');
                actions.className = 'trash-actions';
                actions.style.display = 'flex';
                actions.style.gap = '8px';
                actions.style.marginTop = '8px';
                const restoreBtn = document.createElement('button'); restoreBtn.className = 'restore-btn'; restoreBtn.textContent = 'Р вЂ™Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р С‘РЎвЂљРЎРЉ';
                const purgeBtn = document.createElement('button'); purgeBtn.className = 'purge-btn'; purgeBtn.textContent = 'Р Р€Р Т‘Р В°Р В»Р С‘РЎвЂљРЎРЉ Р Р…Р В°Р Р†РЎРѓР ВµР С–Р Т‘Р В°';
                actions.appendChild(restoreBtn);
                actions.appendChild(purgeBtn);

                mini.appendChild(meta);
                mini.appendChild(qText);
                mini.appendChild(aEl);
                mini.appendChild(actions);

                // Р С›Р С—РЎвЂљР С‘Р СР С‘РЎРѓРЎвЂљР С‘РЎвЂЎР Р…Р С•Р Вµ Р Р†Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р В»Р ВµР Р…Р С‘Р Вµ РЎРѓ РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘Р ВµР С Р Р…Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚
                restoreBtn.addEventListener('click', async () => {
                    restoreBtn.textContent = 'Р вЂ™Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р В»Р ВµР Р…Р С‘Р Вµ...'; restoreBtn.disabled = true;

                    // Р СњР В°РЎвЂ¦Р С•Р Т‘Р С‘Р С Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”РЎС“ Р Р† serverTrashItems, РЎвЂЎРЎвЂљР С•Р В±РЎвЂ№ Р С—Р С•Р В»РЎС“РЎвЂЎР С‘РЎвЂљРЎРЉ Р ВµРЎвЂ Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р Вµ
                    const trashItem = serverTrashItems.find(t => t.item?.question === q);
                    const itemData = trashItem?.item;

                    // Р Р€Р Т‘Р В°Р В»РЎРЏР ВµР С Р С‘Р В· Р В»Р С•Р С”Р В°Р В»РЎРЉР Р…Р С•Р С–Р С• Р С”РЎРЊРЎв‚¬Р В° Р С”Р С•РЎР‚Р В·Р С‘Р Р…РЎвЂ№ РЎРѓРЎР‚Р В°Р В·РЎС“
                    serverTrashSet.delete(q);
                    serverTrashItems = serverTrashItems.filter(t => t.item?.question !== q);
                    // Р С›РЎвЂЎР С‘РЎвЂ°Р В°Р ВµР С Р В»Р С•Р С”Р В°Р В»РЎРЉР Р…РЎС“РЎР‹ Р С”Р В°РЎР‚РЎвЂљРЎС“ РЎС“Р Т‘Р В°Р В»Р ВµР Р…Р С‘Р в„– Р Т‘Р В»РЎРЏ РЎРЊРЎвЂљР С•Р в„– Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р С‘, Р ВµРЎРѓР В»Р С‘ Р В±РЎвЂ№Р В»Р В° Р С—Р С•Р СР ВµРЎвЂЎР ВµР Р…Р В°
                    const delMap = getDeletedItems();
                    if (delMap && delMap[q]) { delete delMap[q]; setDeletedItems(delMap); }

                    // СЂСџвЂќТђ Р вЂ™Р С’Р вЂ“Р СњР С›: Р вЂўРЎРѓР В»Р С‘ Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р С‘ Р Р…Р ВµРЎвЂљ Р Р† uniqueQaData (Р Т‘РЎС“Р В±Р В»Р С‘Р С”Р В°РЎвЂљ), Р Т‘Р С•Р В±Р В°Р Р†Р В»РЎРЏР ВµР С Р ВµРЎвЂ Р Р† qaNewItems
                    const isInUnique = !!uniqueQaData.find(i => i.question === q);
                    if (!isInUnique && itemData) {
                        const newItems = getNewItems();
                        // Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЏР ВµР С, Р Р…Р ВµРЎвЂљ Р В»Р С‘ РЎС“Р В¶Р Вµ РЎвЂљР В°Р С”Р С•Р в„– Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р С‘ Р Р† newItems
                        if (!newItems.some(n => n.question === q)) {
                            newItems.push(itemData);
                            localStorage.setItem('qaNewItems', JSON.stringify(newItems));
                        }
                    }

                    // СЂСџвЂќТђ Р вЂ™Р С›Р вЂ”Р вЂ™Р В Р С’Р В©Р С’Р вЂўР Сљ Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”РЎС“ Р Р† qaUserCards Р ВµРЎРѓР В»Р С‘ Р С•Р Р…Р В° Р В±РЎвЂ№Р В»Р В° РЎС“Р Т‘Р В°Р В»Р ВµР Р…Р В°
                    const userCards = getQaUserCards();
                    if (userCards && !userCards.some(c => c.question === q) && itemData) {
                        // Р ВРЎвЂ°Р ВµР С Р С—Р С•Р В·Р С‘РЎвЂ Р С‘РЎР‹ Р С–Р Т‘Р Вµ Р В±РЎвЂ№Р В»Р В° Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р В° (Р С—Р С• Р С‘Р Р…Р Т‘Р ВµР С”РЎРѓРЎС“ Р Р† serverTrashItems)
                        const trashIndex = serverTrashItems.findIndex(t => t.item?.question === q);
                        if (trashIndex >= 0) {
                            // Р вЂ™РЎРѓРЎвЂљР В°Р Р†Р В»РЎРЏР ВµР С Р Р…Р В° Р С—РЎР‚Р С‘Р СР ВµРЎР‚Р Р…РЎС“РЎР‹ Р С—Р С•Р В·Р С‘РЎвЂ Р С‘РЎР‹
                            userCards.push(itemData);
                            setQaUserCards(userCards);
                        }
                    }

                    renderTrashPanel();
                    // Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С Р В±Р ВµР В· РЎРѓР В±РЎР‚Р С•РЎРѓР В° Р С”Р С•Р Р…РЎвЂљР ВµР С”РЎРѓРЎвЂљР В°
                    refreshCurrentContext();
                    // Р СџРЎвЂ№РЎвЂљР В°Р ВµР СРЎРѓРЎРЏ Р Р†Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р С‘РЎвЂљРЎРЉ Р Р…Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚Р Вµ
                    let restoreOk = false;
                    try { restoreOk = await restoreFromServerTrash([q]); } catch (_) { restoreOk = false; }
                    if (!restoreOk) {
                        // Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С Р С”Р С•РЎР‚Р В·Р С‘Р Р…РЎС“ РЎРѓ РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚Р В° Р Р…Р В° РЎРѓР В»РЎС“РЎвЂЎР В°Р в„– РЎР‚Р В°РЎРѓРЎРѓР С‘Р Р…РЎвЂ¦РЎР‚Р С•Р Р…Р С‘Р В·Р В°РЎвЂ Р С‘Р С‘
                        try { await refreshServerTrash(); } catch (_) { }
                        setSaveStatus('error', 'Р РЋР ВµРЎР‚Р Р†Р ВµРЎР‚ Р Р†Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р В»Р ВµР Р…Р С‘РЎРЏ Р Р…Р ВµР Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р ВµР Р…');
                        restoreBtn.textContent = 'Р вЂ™Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р С‘РЎвЂљРЎРЉ'; restoreBtn.disabled = false;
                    } else {
                        // Р С™Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р В° РЎС“Р В¶Р Вµ Р Р†Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р В»Р ВµР Р…Р В°
                        setSaveStatus('success', 'Р С™Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р В° Р Р†Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р В»Р ВµР Р…Р В°');
                        restoreBtn.textContent = 'Р вЂњР С•РЎвЂљР С•Р Р†Р С•'; setTimeout(() => { restoreBtn.textContent = 'Р вЂ™Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р С‘РЎвЂљРЎРЉ'; restoreBtn.disabled = false; }, 1500);
                    }
                });

                // Р С›Р С”Р С•Р Р…РЎвЂЎР В°РЎвЂљР ВµР В»РЎРЉР Р…Р С•Р Вµ РЎС“Р Т‘Р В°Р В»Р ВµР Р…Р С‘Р Вµ
                purgeBtn.addEventListener('click', async () => {
                    purgeBtn.textContent = 'Р Р€Р Т‘Р В°Р В»Р ВµР Р…Р С‘Р Вµ...'; purgeBtn.disabled = true;

                    // СЂСџвЂќвЂ™ Р СџР С•Р В»РЎС“РЎвЂЎР В°Р ВµР С username
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
                            // Р Р€Р Т‘Р В°Р В»РЎРЏР ВµР С Р С‘Р В· РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚Р Р…Р С•Р в„– Р С”Р С•РЎР‚Р В·Р С‘Р Р…РЎвЂ№ Р С‘ Р В»Р С•Р С”Р В°Р В»РЎРЉР Р…РЎвЂ№РЎвЂ¦ Р С”РЎРЊРЎв‚¬Р ВµР в„–
                            serverTrashSet.delete(q);
                            serverTrashItems = serverTrashItems.filter(t => t.item?.question !== q);
                            // Р СџР С•Р СР ВµРЎвЂЎР В°Р ВµР С Р С”Р В°Р С” РЎС“Р Т‘Р В°Р В»РЎвЂР Р…Р Р…РЎвЂ№Р в„– Р В»Р С•Р С”Р В°Р В»РЎРЉР Р…Р С•
                            const delMap = getDeletedItems(); delMap[q] = true; setDeletedItems(delMap);
                            // Р вЂўРЎРѓР В»Р С‘ Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р В° Р В±РЎвЂ№Р В»Р В° РЎРѓРЎР‚Р ВµР Т‘Р С‘ Р Р…Р С•Р Р†РЎвЂ№РЎвЂ¦, РЎС“Р Т‘Р В°Р В»Р С‘Р С Р ВµРЎвЂ
                            const newArr = getNewItems().filter(i => i.question !== q); setLS('qaNewItems', newArr);

                            // СЂСџвЂќвЂ™ Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С localStorage РЎРѓ Р С”Р С•РЎР‚Р В·Р С‘Р Р…Р С•Р в„–
                            const localTrash = localStorage.getItem('qaUserTrash');
                            if (localTrash) {
                                const trash = JSON.parse(localTrash);
                                const newTrash = trash.filter(t => t.item?.question !== q);
                                localStorage.setItem('qaUserTrash', JSON.stringify(newTrash));
                            }

                            // Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С UI
                            renderTrashPanel();
                            refreshCurrentContext();
                            try { await saveMergedToServer(); } catch { }
                            setSaveStatus('success', 'Р С™Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р В° РЎС“Р Т‘Р В°Р В»Р ВµР Р…Р В° Р Р…Р В°Р Р†РЎРѓР ВµР С–Р Т‘Р В°');
                        } else {
                            const error = await resp.text();
                            console.error('[delete-permanent] Р С›РЎв‚¬Р С‘Р В±Р С”Р В°:', resp.status, error);
                            setSaveStatus('error', 'Р С›РЎв‚¬Р С‘Р В±Р С”Р В°: ' + error);
                        }
                    } catch (e) {
                        console.error('[delete-permanent] Р С›РЎв‚¬Р С‘Р В±Р С”Р В°:', e);
                        setSaveStatus('error', 'Р РЋР ВµРЎР‚Р Р†Р ВµРЎР‚ РЎС“Р Т‘Р В°Р В»Р ВµР Р…Р С‘РЎРЏ Р Р…Р ВµР Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р ВµР Р…');
                    }
                    purgeBtn.textContent = 'Р Р€Р Т‘Р В°Р В»Р С‘РЎвЂљРЎРЉ Р Р…Р В°Р Р†РЎРѓР ВµР С–Р Т‘Р В°'; purgeBtn.disabled = false;
                });

                grid.appendChild(mini);
            });
        }

        // Р Р€Р Т‘Р В°Р В»Р ВµР Р…Р В° РЎРѓРЎвЂљР В°РЎР‚Р В°РЎРЏ Р В»Р С•Р С–Р С‘Р С”Р В° Р Р†РЎвЂљР С•РЎР‚Р С•Р С–Р С• Р СР С•Р Т‘Р В°Р В»РЎРЉР Р…Р С•Р С–Р С• Р С•Р С”Р Р…Р В° Р Р†РЎвЂ¦Р С•Р Т‘Р В°

        editToggleBtn.addEventListener('click', () => {
            editMode = !editMode;

            // СЂСџвЂќТђ Р СџР ВµРЎР‚Р ВµР С”Р В»РЎР‹РЎвЂЎР В°Р ВµР С Р Р†Р С‘Р В·РЎС“Р В°Р В»РЎРЉР Р…РЎвЂ№Р в„– РЎРѓРЎвЂљР С‘Р В»РЎРЉ Р С”Р Р…Р С•Р С—Р С”Р С‘
            if (editMode) {
                editToggleBtn.classList.add('on');
                editToggleBtn.title = 'Р вЂ™РЎвЂ№Р С”Р В»РЎР‹РЎвЂЎР С‘РЎвЂљРЎРЉ РЎР‚Р ВµР В¶Р С‘Р С РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ';
            } else {
                editToggleBtn.classList.remove('on');
                editToggleBtn.title = 'Р вЂ™Р С”Р В»РЎР‹РЎвЂЎР С‘РЎвЂљРЎРЉ РЎР‚Р ВµР В¶Р С‘Р С РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ';
            }

            // Р вЂ™ РЎР‚Р ВµР В¶Р С‘Р СР Вµ РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ Р С•РЎвЂљР С”Р В»РЎР‹РЎвЂЎР В°Р ВµР С Р В°Р Р†РЎвЂљР С•-Р Р…Р С•РЎР‚Р СР В°Р В»Р С‘Р В·Р В°РЎвЂ Р С‘РЎР‹ Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р в„– Р С—РЎР‚Р С‘ Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С”Р Вµ
            try { setNormalizationDisabled(editMode); } catch { }
            // Р СџР С•Р В·Р С‘РЎвЂ Р С‘РЎРЏ Р С”Р Р…Р С•Р С—Р С•Р С” РІСљР‹ Р С‘ Р вЂ™РЎвЂ¦Р С•Р Т‘ Р СњР вЂў Р СР ВµР Р…РЎРЏР ВµРЎвЂљРЎРѓРЎРЏ РІР‚вЂќ Р С•РЎРѓРЎвЂљР В°РЎР‹РЎвЂљРЎРѓРЎРЏ Р Р…Р В°Р Т‘ Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏР СР С‘
            // Р СџР С•Р С”Р В°Р В·Р В°РЎвЂљРЎРЉ/РЎРѓР С”РЎР‚РЎвЂ№РЎвЂљРЎРЉ Р С—Р В°Р Р…Р ВµР В»РЎРЉ Р С”Р С•РЎР‚Р В·Р С‘Р Р…РЎвЂ№ Р С‘ Р С—Р ВµРЎР‚Р ВµР Р…Р ВµРЎРѓРЎвЂљР С‘ Р ВµРЎвЂ Р Р† Р В»Р ВµР Р†РЎС“РЎР‹ Р В±Р С•Р С”Р С•Р Р†РЎС“РЎР‹ Р С—Р В°Р Р…Р ВµР В»РЎРЉ
            const sidebar = document.querySelector('.sidebar');
            const sidebarButtons = sidebar ? sidebar.querySelector('.sidebar-mode-buttons') : null;
            const searchHistory = sidebar ? sidebar.querySelector('#search-history') : null;
            if (editMode) {
                if (sidebar) sidebar.classList.remove('collapsed'); // Р С’Р Р†РЎвЂљР С•Р СР В°РЎвЂљР С‘РЎвЂЎР ВµРЎРѓР С”Р С‘ РЎР‚Р В°Р В·Р Р†Р С•РЎР‚Р В°РЎвЂЎР С‘Р Р†Р В°Р ВµР С Р С—РЎР‚Р С‘ Р Р†Р С”Р В»РЎР‹РЎвЂЎР ВµР Р…Р С‘Р С‘ РЎР‚Р ВµР В¶Р С‘Р СР В°
                trashPanel.style.display = 'block';
                // Р Т‘Р С•Р В±Р В°Р Р†Р С‘РЎвЂљРЎРЉ Р С”Р Р†Р В°Р Т‘РЎР‚Р В°РЎвЂљ РЎРѓ Р С‘Р С”Р С•Р Р…Р С”Р С•Р в„– Р СРЎС“РЎРѓР С•РЎР‚Р Р…Р С•Р С–Р С• Р Р†Р ВµР Т‘РЎР‚Р В° Р Р† Р В·Р В°Р С–Р С•Р В»Р С•Р Р†Р С•Р С” Р В±Р С•Р С”Р С•Р Р†Р С•Р в„– Р С—Р В°Р Р…Р ВµР В»Р С‘
                if (sidebarButtons && !sidebarButtons.querySelector('#trash-mode-button')) {
                    const trashBtn = document.createElement('button');
                    trashBtn.id = 'trash-mode-button';
                    trashBtn.title = 'Р С™Р С•РЎР‚Р В·Р С‘Р Р…Р В°';
                    trashBtn.setAttribute('aria-label', 'Р С™Р С•РЎР‚Р В·Р С‘Р Р…Р В°');
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
                // Р С—Р ВµРЎР‚Р ВµР Р…Р ВµРЎРѓРЎвЂљР С‘ РЎРѓР В°Р СРЎС“ Р С—Р В°Р Р…Р ВµР В»РЎРЉ Р С”Р С•РЎР‚Р В·Р С‘Р Р…РЎвЂ№ Р Р† Р В»Р ВµР Р†РЎС“РЎР‹ Р С—Р В°Р Р…Р ВµР В»РЎРЉ, РЎРѓРЎР‚Р В°Р В·РЎС“ Р С—Р С•Р Т‘ Р В·Р В°Р С–Р С•Р В»Р С•Р Р†Р С”Р С•Р С
                if (sidebar && searchHistory) {
                    try { sidebar.insertBefore(trashPanel, searchHistory); } catch { }
                }
                container.classList.add('edit-mode');
            } else {
                trashPanel.style.display = 'none';
                // РЎС“Р В±РЎР‚Р В°РЎвЂљРЎРЉ Р С‘Р Р…Р Т‘Р С‘Р С”Р В°РЎвЂљР С•РЎР‚ Р С”Р С•РЎР‚Р В·Р С‘Р Р…РЎвЂ№ Р С‘Р В· Р В·Р В°Р С–Р С•Р В»Р С•Р Р†Р С”Р В° Р В±Р С•Р С”Р С•Р Р†Р С•Р в„– Р С—Р В°Р Р…Р ВµР В»Р С‘
                const existingTrashBtn = sidebarButtons ? sidebarButtons.querySelector('#trash-mode-button') : null;
                if (existingTrashBtn) existingTrashBtn.remove();
                container.classList.remove('edit-mode');
            }
            try { localStorage.setItem('qaEditMode', editMode ? 'true' : 'false'); } catch { }
            refreshCategoryEditMenus();
            // Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С Р Р†Р С”Р В»Р В°Р Т‘Р С”Р С‘ Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р в„–, РЎвЂЎРЎвЂљР С•Р В±РЎвЂ№ Р Р†Р С”Р В»РЎР‹РЎвЂЎР С‘РЎвЂљРЎРЉ/Р С•РЎвЂљР С”Р В»РЎР‹РЎвЂЎР С‘РЎвЂљРЎРЉ Р С—Р ВµРЎР‚Р ВµРЎвЂљР В°РЎРѓР С”Р С‘Р Р†Р В°Р Р…Р С‘Р Вµ
            refreshCategoriesTabs();
            renderTrashPanel();
            refreshCurrentContext();
        });

        // Р С›Р В±РЎР‚Р В°Р В±Р С•РЎвЂљРЎвЂЎР С‘Р С”Р С‘ Р С—Р В°Р Р…Р ВµР В»Р С‘ РЎС“Р С—РЎР‚Р В°Р Р†Р В»Р ВµР Р…Р С‘РЎРЏ - РЎС“Р Т‘Р В°Р В»Р ВµР Р…РЎвЂ№ (legacy)


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
                statusEl.textContent = msg || 'Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘Р Вµ...';
            } else if (state === 'success') {
                statusEl.style.display = 'block';
                statusEl.style.background = 'rgba(29, 95, 42, 0.9)'; // Р вЂ”Р ВµР В»Р ВµР Р…РЎвЂ№Р в„– РЎвЂћР С•Р Р…
                statusEl.style.color = '#ffffff';
                statusEl.style.border = '1px solid #2a6b2a';
                statusEl.textContent = msg || 'Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С•';
                setTimeout(() => { statusEl.style.display = 'none'; }, 1500);
            } else if (state === 'error') {
                statusEl.style.display = 'block';
                statusEl.style.background = 'rgba(122, 26, 26, 0.9)'; // Р С™РЎР‚Р В°РЎРѓР Р…РЎвЂ№Р в„– РЎвЂћР С•Р Р…
                statusEl.style.color = '#ffffff';
                statusEl.style.border = '1px solid #8b2a2a';
                statusEl.textContent = msg || 'Р С›РЎв‚¬Р С‘Р В±Р С”Р В° РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘РЎРЏ';
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
                // Р вЂР В°Р В·Р С•Р Р†РЎвЂ№Р Вµ РЎРЊР В»Р ВµР СР ВµР Р…РЎвЂљРЎвЂ№ + overrides
                uniqueQaData.forEach(item => {
                    if (deletedMap[item.question] || serverTrashSet.has(item.question)) return;
                    const ov = overrides[item.question];
                    const mergedItem = ov ? { ...item, ...ov } : item;
                    merged.push(mergedItem);
                    seen.add(item.question);
                });
                // Р СњР С•Р Р†РЎвЂ№Р Вµ РЎРЊР В»Р ВµР СР ВµР Р…РЎвЂљРЎвЂ№ + Р С‘РЎвЂ¦ Р Р†Р С•Р В·Р СР С•Р В¶Р Р…РЎвЂ№Р Вµ overrides
                newItems.forEach(n => {
                    if (!seen.has(n.question) && !deletedMap[n.question] && !serverTrashSet.has(n.question)) {
                        const ov = overrides[n.question];
                        merged.push(ov ? { ...n, ...ov } : n);
                        seen.add(n.question);
                    }
                });
                // Р С›РЎвЂљР С—РЎР‚Р В°Р Р†Р С”Р В° Р Р…Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚
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
                    // Р РЋР ВµРЎР‚Р Р†Р ВµРЎР‚ Р СР С•Р С– Р Р†Р ВµРЎР‚Р Р…РЎС“РЎвЂљРЎРЉ Р С—РЎС“РЎРѓРЎвЂљР С•Р в„– Р С•РЎвЂљР Р†Р ВµРЎвЂљ РІР‚вЂќ Р С•РЎР‚Р С‘Р ВµР Р…РЎвЂљР С‘РЎР‚РЎС“Р ВµР СРЎРѓРЎРЏ РЎвЂљР С•Р В»РЎРЉР С”Р С• Р Р…Р В° РЎРѓРЎвЂљР В°РЎвЂљРЎС“РЎРѓ
                }
                if (!ok) throw new Error('Р РЋР ВµРЎР‚Р Р†Р ВµРЎР‚ Р Р†Р ВµРЎР‚Р Р…РЎС“Р В» Р С•РЎв‚¬Р С‘Р В±Р С”РЎС“ Р С—РЎР‚Р С‘ РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘Р С‘');

                // Р Р€РЎРѓР С—Р ВµРЎв‚¬Р Р…Р С• РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р С‘Р В»Р С‘ РІР‚вЂќ РЎС“Р Р†Р ВµР Т‘Р С•Р СР В»РЎРЏР ВµР С Р С‘ Р С—РЎР‚Р С‘Р Р…РЎС“Р Т‘Р С‘РЎвЂљР ВµР В»РЎРЉР Р…Р С• Р С—Р ВµРЎР‚Р ВµР В·Р В°Р С–РЎР‚РЎС“Р В¶Р В°Р ВµР С Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р Вµ Р С‘Р В· JSON
                setSaveStatus('success');
                // Р вЂќР В°Р Т‘Р С‘Р С UI РЎвЂЎРЎС“РЎвЂљРЎРЉ Р С•Р В±Р Р…Р С•Р Р†Р С‘РЎвЂљРЎРЉ РЎРѓР С•РЎРѓРЎвЂљР С•РЎРЏР Р…Р С‘Р Вµ, Р В·Р В°РЎвЂљР ВµР С Р С‘Р Р…Р С‘РЎвЂ Р С‘Р С‘РЎР‚РЎС“Р ВµР С Р С—Р ВµРЎР‚Р ВµР В·Р В°Р С–РЎР‚РЎС“Р В·Р С”РЎС“
                setTimeout(() => {
                    window.dispatchEvent(new Event('forceReloadData'));
                }, 50);
                return true;
            } catch (e) {
                console.error('Save failed:', e);
                setSaveStatus('error', 'Р С›РЎв‚¬Р С‘Р В±Р С”Р В°: ' + e.message);
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
                // Р СџР С•Р В»РЎС“РЎвЂЎР В°Р ВµР С username Р С‘Р В· РЎРѓР ВµРЎРѓРЎРѓР С‘Р С‘
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
            const name = prompt('Р СњР В°Р В·Р Р†Р В°Р Р…Р С‘Р Вµ Р Р…Р С•Р Р†Р С•Р в„– Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р С‘:');
            if (!name) return;
            const placeholders = getCategoryPlaceholders();
            const id = Math.max(0, ...Object.values(placeholders).map(v => v._cid || 0)) + 1;
            if (!placeholders[name]) placeholders[name] = { _cid: id, sub: [] };
            setCategoryPlaceholders(placeholders);
            alert('Р С™Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏ Р Т‘Р С•Р В±Р В°Р Р†Р В»Р ВµР Р…Р В°. Р СџР С•РЎРЏР Р†Р С‘РЎвЂљРЎРѓРЎРЏ Р Р† Р СР ВµР Р…РЎР‹.');
        }
        function deleteCategoryFlow() {
            const name = prompt('Р СњР В°Р В·Р Р†Р В°Р Р…Р С‘Р Вµ Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р С‘ Р Т‘Р В»РЎРЏ РЎС“Р Т‘Р В°Р В»Р ВµР Р…Р С‘РЎРЏ:');
            if (!name) return;
            if (!confirm(`Р Р€Р Т‘Р В°Р В»Р С‘РЎвЂљРЎРЉ Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎР‹ "${name}" Р С‘ Р Р†РЎРѓР Вµ Р ВµРЎвЂ Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р С‘?`)) return;
            const placeholders = getCategoryPlaceholders();
            delete placeholders[name];
            setCategoryPlaceholders(placeholders);
            const del = getDeletedItems();
            uniqueQaData.forEach(item => {
                if (item.category === name) del[item.question] = true;
            });
            setDeletedItems(del);
            alert('Р С™Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏ Р С•РЎвЂљР СР ВµРЎвЂЎР ВµР Р…Р В° Р С”Р В°Р С” РЎС“Р Т‘Р В°Р В»РЎвЂР Р…Р Р…Р В°РЎРЏ. Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…Р С‘РЎвЂљР Вµ, РЎвЂЎРЎвЂљР С•Р В±РЎвЂ№ Р С—РЎР‚Р С‘Р СР ВµР Р…Р С‘РЎвЂљРЎРЉ.');
        }
        function addSubcategoryFlow() {
            const cat = prompt('Р С™Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏ:');
            if (!cat) return;
            const sub = prompt('Р СњР В°Р В·Р Р†Р В°Р Р…Р С‘Р Вµ Р Р…Р С•Р Р†Р С•Р в„– Р С—Р С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р С‘:');
            if (!sub) return;
            const placeholders = getCategoryPlaceholders();
            if (!placeholders[cat]) placeholders[cat] = { _cid: Date.now(), sub: [] };
            const id = Math.max(0, ...placeholders[cat].sub.map(s => s._sid || 0)) + 1;
            placeholders[cat].sub.push({ name: sub, _sid: id });
            setCategoryPlaceholders(placeholders);
            alert('Р СџР С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏ Р Т‘Р С•Р В±Р В°Р Р†Р В»Р ВµР Р…Р В°. Р СџР С•РЎРЏР Р†Р С‘РЎвЂљРЎРѓРЎРЏ Р Р† Р СР ВµР Р…РЎР‹.');
        }
        function deleteSubcategoryFlow() {
            const cat = prompt('Р С™Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏ:');
            if (!cat) return;
            const sub = prompt('Р СџР С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏ Р Т‘Р В»РЎРЏ РЎС“Р Т‘Р В°Р В»Р ВµР Р…Р С‘РЎРЏ:');
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
            alert('Р СџР С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏ Р С•РЎвЂљР СР ВµРЎвЂЎР ВµР Р…Р В° Р С”Р В°Р С” РЎС“Р Т‘Р В°Р В»РЎвЂР Р…Р Р…Р В°РЎРЏ. Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…Р С‘РЎвЂљР Вµ, РЎвЂЎРЎвЂљР С•Р В±РЎвЂ№ Р С—РЎР‚Р С‘Р СР ВµР Р…Р С‘РЎвЂљРЎРЉ.');
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
        errDiv.textContent = 'Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р С‘Р Р…Р С‘РЎвЂ Р С‘Р В°Р В»Р С‘Р В·Р В°РЎвЂ Р С‘Р С‘ Р Р…Р В°Р Р†Р С‘Р С–Р В°РЎвЂ Р С‘Р С‘: ' + e.message;
        const c = document.querySelector('.container');
        if (c) c.prepend(errDiv);
        else document.body.prepend(errDiv);
    }
}

// Р вЂњР В»Р С•Р В±Р В°Р В»РЎРЉР Р…Р В°РЎРЏ Р Р†Р ВµРЎР‚РЎРѓР С‘РЎРЏ Р С‘Р Р…Р Т‘Р С‘Р С”Р В°РЎвЂљР С•РЎР‚Р В° РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘РЎРЏ Р Т‘Р В»РЎРЏ Р Р†РЎвЂ№Р В·Р С•Р Р†Р С•Р Р† Р Р†Р Р…Р Вµ initTabsNavigation
function setSaveStatus(state, msg) {
    // Р СџР С•Р С—РЎР‚Р С•Р В±РЎС“Р ВµР С Р Р…Р В°Р в„–РЎвЂљР С‘ РЎРЊР В»Р ВµР СР ВµР Р…РЎвЂљ, Р ВµРЎРѓР В»Р С‘ Р ВµРЎвЂ°РЎвЂ Р Р…Р Вµ Р С—РЎР‚Р С‘Р Р†РЎРЏР В·Р В°Р Р…
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
        saveStatus.textContent = msg || 'Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘Р Вµ...';
    } else if (state === 'success') {
        saveStatus.style.display = 'inline-block';
        saveStatus.style.background = 'rgba(0, 128, 0, 0.3)';
        saveStatus.style.color = '#cfe9cf';
        saveStatus.style.border = '1px solid #2a6b2a';
        saveStatus.textContent = msg || 'Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С•';
        setTimeout(() => { saveStatus.style.display = 'none'; }, 1500);
    } else if (state === 'error') {
        saveStatus.style.display = 'inline-block';
        saveStatus.style.background = 'rgba(128, 0, 0, 0.3)';
        saveStatus.style.color = '#f1c7c7';
        saveStatus.style.border = '1px solid #6b2a2a';
        saveStatus.textContent = msg || 'Р С›РЎв‚¬Р С‘Р В±Р С”Р В° РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘РЎРЏ';
        setTimeout(() => { saveStatus.style.display = 'none'; }, 4000);
    }
}

// --- Global helpers (accessible from outside initTabsNavigation) ---
// These mirror the inner helpers so that actions in displayQuestions can call them.

// Р В¤Р В»Р В°Р С– Р Т‘Р В»РЎРЏ Р С—РЎР‚Р ВµР Т‘Р С•РЎвЂљР Р†РЎР‚Р В°РЎвЂ°Р ВµР Р…Р С‘РЎРЏ РЎвЂ Р С‘Р С”Р В»Р С‘РЎвЂЎР ВµРЎРѓР С”Р С•Р в„– РЎРѓР С‘Р Р…РЎвЂ¦РЎР‚Р С•Р Р…Р С‘Р В·Р В°РЎвЂ Р С‘Р С‘
let isSyncing = false;

async function saveMergedToServer(skipReload = false) {
    // Р вЂ”Р В°РЎвЂ°Р С‘РЎвЂљР В° Р С•РЎвЂљ РЎР‚Р ВµР С”РЎС“РЎР‚РЎРѓР С‘Р Р†Р Р…РЎвЂ№РЎвЂ¦ Р Р†РЎвЂ№Р В·Р С•Р Р†Р С•Р Р†
    if (isSyncing) {
        return false;
    }

    try {
        isSyncing = true;
        // Р С›РЎвЂљР С—РЎР‚Р В°Р Р†Р В»РЎРЏР ВµР С РЎРѓР С•Р В±РЎвЂ№РЎвЂљР С‘Р Вµ Р Р…Р В°РЎвЂЎР В°Р В»Р В° РЎРѓР С‘Р Р…РЎвЂ¦РЎР‚Р С•Р Р…Р С‘Р В·Р В°РЎвЂ Р С‘Р С‘
        window.dispatchEvent(new Event('sync-start'));

        console.log('[saveMergedToServer] === Р СњР С’Р В§Р С’Р вЂєР С› Р РЋР ВР СњР ТђР В Р С›Р СњР ВР вЂ”Р С’Р В¦Р ВР В === skipReload:', skipReload);

        // СЂСџвЂќРЊ Р ВР РЋР СџР В Р С’Р вЂ™Р вЂєР вЂўР СњР ВР вЂў Р С™Р С›Р вЂќР ВР В Р С›Р вЂ™Р С™Р В Р СџР вЂўР В Р вЂўР вЂќ Р С›Р СћР СџР В Р С’Р вЂ™Р С™Р С›Р в„ў
        const fixEncoding = (text) => {
            if (!text || typeof text !== 'string') return text;
            return text
                .replace(/\uFFFD/g, '?')  // U+FFFD РІвЂ вЂ™ ?
                .replace(/Р вЂќ\?{1,10}Р С”РЎС“Р СР ВµР Р…РЎвЂљР В°РЎвЂ Р С‘РЎРЏ/g, 'Р вЂќР С•Р С”РЎС“Р СР ВµР Р…РЎвЂљР В°РЎвЂ Р С‘РЎРЏ')
                .replace(/Р С‘Р Р…РЎвЂћРЎС“ Р С•\? РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚Р В°/g, 'Р С‘Р Р…РЎвЂћРЎС“ Р С•РЎвЂљ РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚Р В°')
                .replace(/Р С—Р С•Р В»РЎС“РЎвЂЎР В°\?Р С/g, 'Р С—Р С•Р В»РЎС“РЎвЂЎР В°Р ВµР С')
                .replace(/РЎРѓР Вµ\?{1,5}Р Р†Р С‘РЎРѓРЎвЂ№/g, 'РЎРѓР ВµРЎР‚Р Р†Р С‘РЎРѓРЎвЂ№');
        };

        // Р ВРЎРѓР С—РЎР‚Р В°Р Р†Р В»РЎРЏР ВµР С overrides Р С—Р ВµРЎР‚Р ВµР Т‘ Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р С”Р С•Р в„–
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
            console.warn('[saveMergedToServer] РІС™В РїС‘РЏ Р вЂќР В°Р Р…Р Р…РЎвЂ№Р Вµ Р В±РЎвЂ№Р В»Р С‘ Р С‘РЎРѓР С—РЎР‚Р В°Р Р†Р В»Р ВµР Р…РЎвЂ№ Р С—Р ВµРЎР‚Р ВµР Т‘ Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р С”Р С•Р в„– (Р С—Р С•Р Р†РЎР‚Р ВµР В¶Р Т‘Р ВµР Р…Р Р…Р В°РЎРЏ Р С”Р С•Р Т‘Р С‘РЎР‚Р С•Р Р†Р С”Р В°)');
            setOverrides(fixedOverrides);
        }

        const newItems = getNewItems();
        const deletedMap = getDeletedItems();
        const merged = [];
        const seen = new Set();

        // Р РЋР Р…Р В°РЎвЂЎР В°Р В»Р В° Р Т‘Р С•Р В±Р В°Р Р†Р В»РЎРЏР ВµР С Р В±Р В°Р В·Р С•Р Р†РЎвЂ№Р Вµ Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р С‘ Р С‘Р В· global.json
        uniqueQaData.forEach(item => {
            if (deletedMap[item.question] || serverTrashSet.has(item.question)) return;
            const ov = overrides[item.question];
            const mergedItem = ov ? { ...item, ...ov } : item;
            merged.push(mergedItem);
            seen.add(item.question);
        });

        // Р вЂќР С•Р В±Р В°Р Р†Р В»РЎРЏР ВµР С Р Р…Р С•Р Р†РЎвЂ№Р Вµ РЎРЊР В»Р ВµР СР ВµР Р…РЎвЂљРЎвЂ№ (Р Т‘РЎС“Р В±Р В»Р С‘Р С”Р В°РЎвЂљРЎвЂ№, РЎРѓР С•Р В·Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р Вµ Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»Р ВµР С)
        // Р вЂ™Р В°Р В¶Р Р…Р С•: Р С—РЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЏР ВµР С Р С—Р С• РЎвЂљР С•РЎвЂЎР Р…Р С•Р СРЎС“ РЎРѓР С•Р Р†Р С—Р В°Р Т‘Р ВµР Р…Р С‘РЎР‹ Р Р†Р С•Р С—РЎР‚Р С•РЎРѓР В°, РЎвЂЎРЎвЂљР С•Р В±РЎвЂ№ Р Р…Р Вµ Р С—Р С•РЎвЂљР ВµРЎР‚РЎРЏРЎвЂљРЎРЉ Р Т‘РЎС“Р В±Р В»Р С‘Р С”Р В°РЎвЂљРЎвЂ№
        newItems.forEach(n => {
            const isDeleted = deletedMap[n.question] || serverTrashSet.has(n.question);
            const isAlreadyAdded = seen.has(n.question);

            // Р СџРЎР‚Р С•Р С—РЎС“РЎРѓР С”Р В°Р ВµР С РЎС“Р Т‘Р В°Р В»РЎвЂР Р…Р Р…РЎвЂ№Р Вµ Р С‘ РЎС“Р В¶Р Вµ Р Т‘Р С•Р В±Р В°Р Р†Р В»Р ВµР Р…Р Р…РЎвЂ№Р Вµ
            if (isDeleted || isAlreadyAdded) return;

            // Р вЂќР С•Р В±Р В°Р Р†Р В»РЎРЏР ВµР С Р Р…Р С•Р Р†РЎвЂ№Р в„– РЎРЊР В»Р ВµР СР ВµР Р…РЎвЂљ РЎРѓ Р С—РЎР‚Р С‘Р СР ВµР Р…РЎвЂР Р…Р Р…РЎвЂ№Р СР С‘ overrides
            const ov = overrides[n.question];
            merged.push(ov ? { ...n, ...ov } : n);
            seen.add(n.question);
        });

        // Р СћР В°Р С”Р В¶Р Вµ Р С—РЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЏР ВµР С qaUserCards Р Р…Р В° Р Р…Р В°Р В»Р С‘РЎвЂЎР С‘Р Вµ РЎРЊР В»Р ВµР СР ВµР Р…РЎвЂљР С•Р Р†, Р С”Р С•РЎвЂљР С•РЎР‚РЎвЂ№РЎвЂ¦ Р Р…Р ВµРЎвЂљ Р Р…Р С‘ Р Р† base, Р Р…Р С‘ Р Р† newItems
        // Р В­РЎвЂљР С• Р Р…РЎС“Р В¶Р Р…Р С• Р Т‘Р В»РЎРЏ РЎРѓР В»РЎС“РЎвЂЎР В°Р ВµР Р†, Р С”Р С•Р С–Р Т‘Р В° Р Т‘РЎС“Р В±Р В»Р С‘Р С”Р В°РЎвЂљРЎвЂ№ РЎС“Р В¶Р Вµ РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…РЎвЂ№ Р Р† localStorage
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
                            // СЂСџвЂќТђ Р ВР РЋР СџР В Р С’Р вЂ™Р вЂєР вЂўР СњР ВР вЂў: Р вЂќРЎС“Р В±Р В»Р С‘Р С”Р В°РЎвЂљРЎвЂ№ (РЎРѓ "Р С”Р С•Р С—Р С‘РЎРЏ" Р Р† Р Р…Р В°Р В·Р Р†Р В°Р Р…Р С‘Р С‘) Р Р…Р Вµ Р Т‘Р С•Р В»Р В¶Р Р…РЎвЂ№ РЎРѓРЎвЂЎР С‘РЎвЂљР В°РЎвЂљРЎРЉРЎРѓРЎРЏ РЎС“Р Т‘Р В°Р В»РЎвЂР Р…Р Р…РЎвЂ№Р СР С‘
                            // Р ВµРЎРѓР В»Р С‘ Р С•Р Р…Р С‘ РЎвЂљР С•Р В»РЎРЉР С”Р С• РЎвЂЎРЎвЂљР С• РЎРѓР С•Р В·Р Т‘Р В°Р Р…РЎвЂ№ Р С‘ Р С‘РЎвЂ¦ Р Р…Р ВµРЎвЂљ Р Р† deletedMap
                            const isInServerTrash = serverTrashSet.has(uc.question);
                            const isInLocalDeleted = deletedMap[uc.question];
                            const isDeleted = isInLocalDeleted || (isInServerTrash && !uc.question.includes('Р С”Р С•Р С—Р С‘РЎРЏ'));

                            const isAlreadyAdded = seen.has(uc.question);
                            const isInBase = uniqueQaData.some(b => b.question === uc.question);
                            const isNewItem = newItems.some(n => n.question === uc.question);

                            // Р РЋРЎвЂЎР С‘РЎвЂљР В°Р ВµР С Р Т‘РЎС“Р В±Р В»Р С‘Р С”Р В°РЎвЂљРЎвЂ№
                            if (uc.question.includes('Р С”Р С•Р С—Р С‘РЎРЏ')) {
                                duplicatesFound++;
                                console.log('[saveMergedToServer] Р СњР В°Р в„–Р Т‘Р ВµР Р… Р Т‘РЎС“Р В±Р В»Р С‘Р С”Р В°РЎвЂљ Р Р† qaUserCards:', {
                                    question: uc.question.substring(0, 50),
                                    isAlreadyAdded,
                                    isInBase,
                                    isNewItem,
                                    isDeleted
                                });
                            }

                            // Р вЂќР С•Р В±Р В°Р Р†Р В»РЎРЏР ВµР С РЎвЂљР С•Р В»РЎРЉР С”Р С• Р ВµРЎРѓР В»Р С‘ РЎРЊРЎвЂљР С• Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЉРЎРѓР С”Р В°РЎРЏ Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р В°, Р С”Р С•РЎвЂљР С•РЎР‚Р С•Р в„– Р Р…Р ВµРЎвЂљ Р Р† Р В±Р В°Р В·Р Вµ Р С‘ Р Р…Р С•Р Р†РЎвЂ№РЎвЂ¦ РЎРЊР В»Р ВµР СР ВµР Р…РЎвЂљР В°РЎвЂ¦
                            if (!isDeleted && !isAlreadyAdded && !isInBase && !isNewItem) {
                                const ov = overrides[uc.question];
                                merged.push(ov ? { ...uc, ...ov } : uc);
                                seen.add(uc.question);
                                addedCount++;
                            }
                        });

                        console.log('[saveMergedToServer] Р С›Р В±РЎР‚Р В°Р В±Р С•РЎвЂљР В°Р Р…Р С• qaUserCards:', {
                            checkedCount,
                            duplicatesFound,
                            addedCount,
                            mergedCount: merged.length
                        });
                    }
                }
            }
        } catch (e) {
            console.warn('[saveMergedToServer] Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р Т‘Р С•Р В±Р В°Р Р†Р С‘РЎвЂљРЎРЉ Р Т‘Р С•Р С—Р С•Р В»Р Р…Р С‘РЎвЂљР ВµР В»РЎРЉР Р…РЎвЂ№Р Вµ Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р С‘:', e);
        }
        const lastRestored = typeof window !== 'undefined' ? window.__lastRestoredQuestion : null;

        // Р СџР С•Р В»РЎС“РЎвЂЎР В°Р ВµР С username Р Т‘Р В»РЎРЏ Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р С”Р С‘ Р Р…Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚
        let username = null;
        try {
            const sessionUserRaw = localStorage.getItem('qaSessionUser');
            const u = JSON.parse(sessionUserRaw);
            if (u && u.username) username = u.username;
        } catch { }

        // СЂСџвЂќРЊ Р В¤Р ВР СњР С’Р вЂєР В¬Р СњР С›Р вЂў Р ВР РЋР СџР В Р С’Р вЂ™Р вЂєР вЂўР СњР ВР вЂў Р С™Р С›Р вЂќР ВР В Р С›Р вЂ™Р С™Р В Р СџР вЂўР В Р вЂўР вЂќ Р С›Р СћР СџР В Р С’Р вЂ™Р С™Р С›Р в„ў
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
                console.warn(`[saveMergedToServer] Р ВРЎРѓР С—РЎР‚Р В°Р Р†Р В»Р ВµР Р…Р В° Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р В°: ${card.question?.substring(0, 30)}...`);
            }
            return fixedCard;
        });

        const url = `${BACKEND_URL}/save?user=${encodeURIComponent(username || 'guest')}`;

        console.log('[saveMergedToServer] Р С›РЎвЂљР С—РЎР‚Р В°Р Р†Р В»РЎРЏР ВµР С Р Р…Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚:', {
            mergedCount: merged.length,
            newItemsCount: newItems.length,
            deletedCount: Object.keys(deletedMap).length,
            username,
            bodyLength: JSON.stringify(fixedMerged).length
        });

        // СЂСџвЂќРЊ Р вЂєР С›Р вЂњ: Р С—Р ВµРЎР‚Р Р†РЎвЂ№Р Вµ 3 Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р С‘ Р Т‘Р В»РЎРЏ Р С—РЎР‚Р С•Р Р†Р ВµРЎР‚Р С”Р С‘
        const first3 = merged.slice(0, 3).map(c => ({
            question: c.question?.substring(0, 50),
            hasCopy: c.question?.includes('Р С”Р С•Р С—Р С‘РЎРЏ'),
            category: c.category,
            subcategory: c.subcategory
        }));
        console.log('[saveMergedToServer] Р СџР ВµРЎР‚Р Р†РЎвЂ№Р Вµ 3 Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р С‘:', first3);

        // СЂСџвЂќРЊ Р вЂєР С›Р вЂњ: Р С—Р С•Р С‘РЎРѓР С” Р Т‘РЎС“Р В±Р В»Р С‘Р С”Р В°РЎвЂљР В° Р Р†Р С• Р Р†РЎРѓРЎвЂР С Р СР В°РЎРѓРЎРѓР С‘Р Р†Р Вµ
        const dupIndex = merged.findIndex(c => c.question?.includes('Р С”Р С•Р С—Р С‘РЎРЏ'));
        console.log('[saveMergedToServer] Р вЂќРЎС“Р В±Р В»Р С‘Р С”Р В°РЎвЂљ Р Р…Р В°Р в„–Р Т‘Р ВµР Р… Р Р…Р В° Р С‘Р Р…Р Т‘Р ВµР С”РЎРѓР Вµ:', dupIndex);
        if (dupIndex >= 0) {
            console.log('[saveMergedToServer] Р вЂќРЎС“Р В±Р В»Р С‘Р С”Р В°РЎвЂљ:', {
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

        console.log('[saveMergedToServer] Р С›РЎвЂљР Р†Р ВµРЎвЂљ РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚Р В°:', {
            status: resp.status,
            ok: resp.ok,
            statusText: resp.statusText
        });
        let ok = resp.ok;
        let responseJson = null;
        try {
            responseJson = await resp.json();
            console.log('[saveMergedToServer] Р СџР С›Р вЂєР Р€Р В§Р вЂўР СњР С› Р С›Р Сћ Р РЋР вЂўР В Р вЂ™Р вЂўР В Р С’:', responseJson);
            if (typeof responseJson?.ok === 'boolean') ok = ok && responseJson.ok;
        } catch (parseErr) {
            console.warn('[saveMergedToServer] Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ РЎР‚Р В°РЎРѓР С—Р В°РЎР‚РЎРѓР С‘РЎвЂљРЎРЉ Р С•РЎвЂљР Р†Р ВµРЎвЂљ:', parseErr);
        }

        if (!ok) {
            console.error('[saveMergedToServer] Р РЋР ВµРЎР‚Р Р†Р ВµРЎР‚ Р Р†Р ВµРЎР‚Р Р…РЎС“Р В» Р С•РЎв‚¬Р С‘Р В±Р С”РЎС“');
            throw new Error('Р РЋР ВµРЎР‚Р Р†Р ВµРЎР‚ Р Р†Р ВµРЎР‚Р Р…РЎС“Р В» Р С•РЎв‚¬Р С‘Р В±Р С”РЎС“ Р С—РЎР‚Р С‘ РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘Р С‘');
        }

        // Р Р€РЎРѓР С—Р ВµРЎв‚¬Р Р…Р С•Р Вµ РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘Р Вµ
        setSaveStatus('success');

        console.log('[saveMergedToServer] Р РЋР ВµРЎР‚Р Р†Р ВµРЎР‚ Р С•РЎвЂљР Р†Р ВµРЎвЂљР С‘Р В»:', { ok, responseJson });

        // СЂСџвЂќТђ Р С›Р вЂР СњР С›Р вЂ™Р вЂєР Р‡Р вЂўР Сљ localDataTimestamp Р С—Р С•РЎРѓР В»Р Вµ РЎС“РЎРѓР С—Р ВµРЎв‚¬Р Р…Р С•Р С–Р С• РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘РЎРЏ Р Р…Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚
        // Р В­РЎвЂљР С• Р Р…РЎС“Р В¶Р Р…Р С• Р Т‘Р В»РЎРЏ Р С”Р С•РЎР‚РЎР‚Р ВµР С”РЎвЂљР Р…Р С•Р в„– РЎРѓР С‘Р Р…РЎвЂ¦РЎР‚Р С•Р Р…Р С‘Р В·Р В°РЎвЂ Р С‘Р С‘ Р СР ВµР В¶Р Т‘РЎС“ РЎС“РЎРѓРЎвЂљРЎР‚Р С•Р в„–РЎРѓРЎвЂљР Р†Р В°Р СР С‘
        const serverTimestamp = responseJson?.updatedAt || Date.now();
        localStorage.setItem('localDataTimestamp', serverTimestamp.toString());
        console.log('[saveMergedToServer] localDataTimestamp Р С•Р В±Р Р…Р С•Р Р†Р В»РЎвЂР Р…:', serverTimestamp);

        // Р С›РЎвЂљР С—РЎР‚Р В°Р Р†Р В»РЎРЏР ВµР С РЎРѓР С•Р В±РЎвЂ№РЎвЂљР С‘Р Вµ РЎС“РЎРѓР С—Р ВµРЎв‚¬Р Р…Р С•Р в„– РЎРѓР С‘Р Р…РЎвЂ¦РЎР‚Р С•Р Р…Р С‘Р В·Р В°РЎвЂ Р С‘Р С‘
        window.dispatchEvent(new Event('sync-success'));

        // Р С›Р вЂР СњР С›Р вЂ™Р вЂєР Р‡Р вЂўР Сљ qaUserCards Р Р† localStorage
        try {
            setQaUserCards(merged);
            console.log('[saveMergedToServer] setQaUserCards Р Р†РЎвЂ№Р В·Р Р†Р В°Р Р…:', {
                mergedLength: merged.length,
                savedCards: merged.length
            });

            // СЂСџвЂќРЊ Р СџР В Р С›Р вЂ™Р вЂўР В Р Р‡Р вЂўР Сљ РЎвЂЎРЎвЂљР С• Р В·Р В°Р С—Р С‘РЎРѓР В°Р В»Р С•РЎРѓРЎРЉ Р Р† localStorage
            const verifyCards = getQaUserCards();
            console.log('[saveMergedToServer] Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚Р С”Р В° localStorage:', {
                cardsInLocalStorage: verifyCards?.length || 0
            });

            // СЂСџвЂќТђ Р С›Р вЂР СњР С›Р вЂ™Р вЂєР Р‡Р вЂўР Сљ uniqueQaData Р Р† Р С—Р В°Р СРЎРЏРЎвЂљР С‘ Р С‘Р В· localStorage
            // Р В­РЎвЂљР С• Р Р…РЎС“Р В¶Р Р…Р С• РЎвЂЎРЎвЂљР С•Р В±РЎвЂ№ РЎРѓР В»Р ВµР Т‘РЎС“РЎР‹РЎвЂ°Р С‘Р Вµ Р Т‘РЎС“Р В±Р В»Р С‘Р С”Р В°РЎвЂљРЎвЂ№ Р С‘РЎРѓР С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°Р В»Р С‘ Р В°Р С”РЎвЂљРЎС“Р В°Р В»РЎРЉР Р…РЎвЂ№Р Вµ Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р Вµ
            // Р ВР СР С—Р С•РЎР‚РЎвЂљР С‘РЎР‚РЎС“Р ВµР С setUniqueQaData Р С‘Р В· all-data.js
            const { setUniqueQaData } = await import('../all-data.js');
            if (typeof setUniqueQaData === 'function' && verifyCards && verifyCards.length > 0) {
                setUniqueQaData(verifyCards);
                console.log('[saveMergedToServer] uniqueQaData Р С•Р В±Р Р…Р С•Р Р†Р В»РЎвЂР Р…:', {
                    newLength: verifyCards.length
                });
            }

            // Р С›РЎвЂЎР С‘РЎвЂ°Р В°Р ВµР С qaNewItems Р С—Р С•РЎРѓР В»Р Вµ РЎС“РЎРѓР С—Р ВµРЎв‚¬Р Р…Р С•Р в„– РЎРѓР С‘Р Р…РЎвЂ¦РЎР‚Р С•Р Р…Р С‘Р В·Р В°РЎвЂ Р С‘Р С‘, РЎвЂЎРЎвЂљР С•Р В±РЎвЂ№ Р Т‘РЎС“Р В±Р В»Р С‘Р С”Р В°РЎвЂљРЎвЂ№ Р Р…Р Вµ Р Т‘Р С•Р В±Р В°Р Р†Р В»РЎРЏР В»Р С‘РЎРѓРЎРЉ Р С—Р С•Р Р†РЎвЂљР С•РЎР‚Р Р…Р С•
            const newItems = getNewItems();
            console.log('[saveMergedToServer] Р С›РЎвЂЎР С‘РЎвЂ°Р В°Р ВµР С qaNewItems:', newItems.length, 'РЎРЊР В»Р ВµР СР ВµР Р…РЎвЂљР С•Р Р†');
            if (Array.isArray(newItems) && newItems.length > 0) {
                localStorage.setItem('qaNewItems', JSON.stringify([]));
            }

            // Р С›РЎвЂЎР С‘РЎвЂ°Р В°Р ВµР С qaDeletedItems Р С—Р С•РЎРѓР В»Р Вµ РЎС“РЎРѓР С—Р ВµРЎв‚¬Р Р…Р С•Р в„– РЎРѓР С‘Р Р…РЎвЂ¦РЎР‚Р С•Р Р…Р С‘Р В·Р В°РЎвЂ Р С‘Р С‘
            const deletedItems = getDeletedItems();
            if (Object.keys(deletedItems).length > 0) {
                localStorage.setItem('qaDeletedItems', JSON.stringify({}));
            }
        } catch (e) {
            console.warn('[saveMergedToServer] Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р С•Р В±Р Р…Р С•Р Р†Р С‘РЎвЂљРЎРЉ localStorage:', e);
        }

        // Р СџРЎР‚Р С‘Р Р…РЎС“Р Т‘Р С‘РЎвЂљР ВµР В»РЎРЉР Р…Р В°РЎРЏ Р С—Р ВµРЎР‚Р ВµР В·Р В°Р С–РЎР‚РЎС“Р В·Р С”Р В° Р Т‘Р В°Р Р…Р Р…РЎвЂ№РЎвЂ¦ РЎвЂЎР ВµРЎР‚Р ВµР В· 50Р СРЎРѓ
        console.log('[saveMergedToServer] Dispatch forceReloadData:', !skipReload);
        setTimeout(() => {
            if (!skipReload) window.dispatchEvent(new Event('forceReloadData'));
        }, 50);

        return true;
    } catch (e) {
        console.error('[saveMergedToServer] Р С›РЎв‚¬Р С‘Р В±Р С”Р В° РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘РЎРЏ:', e);
        setSaveStatus('error', 'Р С›РЎв‚¬Р С‘Р В±Р С”Р В°: ' + e.message);
        // Р С›РЎвЂљР С—РЎР‚Р В°Р Р†Р В»РЎРЏР ВµР С РЎРѓР С•Р В±РЎвЂ№РЎвЂљР С‘Р Вµ Р С•РЎв‚¬Р С‘Р В±Р С”Р С‘ РЎРѓР С‘Р Р…РЎвЂ¦РЎР‚Р С•Р Р…Р С‘Р В·Р В°РЎвЂ Р С‘Р С‘
        window.dispatchEvent(new Event('sync-error'));
        return false;
    } finally {
        // Р РЋР В±РЎР‚Р В°РЎРѓРЎвЂ№Р Р†Р В°Р ВµР С РЎвЂћР В»Р В°Р С– РЎРѓР С‘Р Р…РЎвЂ¦РЎР‚Р С•Р Р…Р С‘Р В·Р В°РЎвЂ Р С‘Р С‘
        isSyncing = false;
    }
}

async function moveToServerTrash(items) {
    try {
        // Р СџР С•Р В»РЎС“РЎвЂЎР В°Р ВµР С username Р Т‘Р В»РЎРЏ Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р С”Р С‘ Р Р…Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚
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
            console.error('[moveToServerTrash] Р С›РЎв‚¬Р С‘Р В±Р С”Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚Р В°:', resp.status, error);
        }

        return resp.ok;
    } catch (e) {
        console.error('[moveToServerTrash] Р С›РЎв‚¬Р С‘Р В±Р С”Р В°:', e);
        return false;
    }
}

async function restoreFromServerTrash(questions) {
    try {
        // Р СџР С•Р В»РЎС“РЎвЂЎР В°Р ВµР С username Р Т‘Р В»РЎРЏ Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р С”Р С‘ Р Р…Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚
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
            // Р СњР С•РЎР‚Р СР В°Р В»Р С‘Р В·РЎС“Р ВµР С Р С”Р В»РЎР‹РЎвЂЎР С‘ РЎРѓ РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚Р В° (snake_case -> camelCase)
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
        // СЂСџвЂќвЂ™ Р вЂ”Р В°Р С–РЎР‚РЎС“Р В¶Р В°Р ВµР С Р С”Р С•РЎР‚Р В·Р С‘Р Р…РЎС“ РЎРѓ РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚Р В° (РЎвЂљР ВµР С—Р ВµРЎР‚РЎРЉ /metadata Р Р†Р С•Р В·Р Р†РЎР‚Р В°РЎвЂ°Р В°Р ВµРЎвЂљ trash_bin)
        const resp = await fetchWithAuth('/metadata');
        if (resp.ok) {
            const data = await resp.json();
            const bin = Array.isArray(data.trash_bin) ? data.trash_bin : [];
            serverTrashItems = bin;
            serverTrashSet = new Set(bin.map(t => t.item?.question).filter(Boolean));
            // СЂСџвЂќвЂ™ Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏР ВµР С Р Р† localStorage Р Т‘Р В»РЎРЏ Р С•РЎвЂћР В»Р В°Р в„–Р Р…-РЎР‚Р В°Р В±Р С•РЎвЂљРЎвЂ№
            localStorage.setItem('qaUserTrash', JSON.stringify(serverTrashItems));
            return;
        }

        // Р В¤Р С•Р В»Р В±РЎРЊР С”: Р ВµРЎРѓР В»Р С‘ РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚ Р Р…Р ВµР Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р ВµР Р…, Р В·Р В°Р С–РЎР‚РЎС“Р В¶Р В°Р ВµР С Р С‘Р В· localStorage
        const localTrash = localStorage.getItem('qaUserTrash');
        if (localTrash) {
            const trash = JSON.parse(localTrash);
            serverTrashItems = Array.isArray(trash) ? trash : [];
            serverTrashSet = new Set(serverTrashItems.map(t => t.item?.question).filter(Boolean));
        }
    } catch (e) {
        console.error('Failed to refresh server trash:', e);
        // Р В¤Р С•Р В»Р В±РЎРЊР С”: Р В·Р В°Р С–РЎР‚РЎС“Р В¶Р В°Р ВµР С Р С‘Р В· localStorage Р С—РЎР‚Р С‘ Р С•РЎв‚¬Р С‘Р В±Р С”Р Вµ
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
        // Р СџРЎР‚Р ВµР С•Р В±РЎР‚Р В°Р В·РЎС“Р ВµР С Р С”Р В»РЎР‹РЎвЂЎР С‘ Р С”Р В»Р С‘Р ВµР Р…РЎвЂљР В° (camelCase) Р Р† РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚Р Р…РЎвЂ№Р Вµ (snake_case)
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
    if (catDiv) catDiv.innerHTML = '<div><strong>Р С™Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р С‘:</strong></div><div>Р СџРЎС“РЎРѓРЎвЂљР С•</div>';
    const deletedCards = serverTrashItems.map(t => t.item?.question).filter(Boolean);
    if (cardDiv) {
        cardDiv.innerHTML = '';
        const header = document.createElement('div');
        header.innerHTML = '<strong>Р С™Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р С‘:</strong>' + (deletedCards.length ? '' : ' <span>Р СџРЎС“РЎРѓРЎвЂљР С•</span>');
        cardDiv.appendChild(header);
        const grid = document.createElement('div');
        grid.className = 'trash-cards-grid';
        cardDiv.appendChild(grid);

        serverTrashItems.forEach(entry => {
            const q = entry.item?.question;
            const it = entry.item || uniqueQaData.find(i => i.question === q) || getNewItems().find(i => i.question === q);
            const mini = document.createElement('div');
            mini.className = 'result-item trash-mini';

            // Р вЂ™Р ВµРЎР‚РЎвЂ¦: РЎвЂљР ВµР С–Р С‘
            const meta = document.createElement('div');
            meta.className = 'trash-meta';
            meta.style.display = 'flex';
            meta.style.flexWrap = 'wrap';
            meta.style.gap = '6px';
            const catBadge = document.createElement('span'); catBadge.className = 'category-badge'; catBadge.textContent = (it && it.category) ? it.category : '';
            const scBadge = document.createElement('span'); scBadge.className = 'subcategory-badge'; scBadge.textContent = (it && it.subcategory) ? it.subcategory : '';
            meta.appendChild(catBadge); meta.appendChild(scBadge);

            // Р вЂ™Р С•Р С—РЎР‚Р С•РЎРѓ - Р С—РЎР‚Р С‘Р СР ВµР Р…РЎРЏР ВµР С РЎвЂћР С•РЎР‚Р СР В°РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘Р Вµ
            const qEl = document.createElement('div'); qEl.className = 'question';
            const questionFormatting = it?.formatting?.question || [];
            qEl.innerHTML = applyFormatting(it?.question || q || '', questionFormatting);
            qEl.style.marginTop = '6px';

            // Р С›РЎвЂљР Р†Р ВµРЎвЂљ - Р С—РЎР‚Р С‘Р СР ВµР Р…РЎРЏР ВµР С РЎвЂћР С•РЎР‚Р СР В°РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘Р Вµ
            const aEl = document.createElement('div'); aEl.className = 'answer';
            const answerFormatting = it?.formatting?.answer || [];
            aEl.innerHTML = applyFormatting(it?.answer || '', answerFormatting);
            aEl.style.marginTop = '6px';

            // Р вЂќР ВµР в„–РЎРѓРЎвЂљР Р†Р С‘РЎРЏ
            const actions = document.createElement('div');
            actions.className = 'trash-actions';
            actions.style.display = 'flex';
            actions.style.gap = '8px';
            actions.style.marginTop = '8px';
            const restoreBtn = document.createElement('button'); restoreBtn.className = 'restore-btn'; restoreBtn.textContent = 'Р вЂ™Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р С‘РЎвЂљРЎРЉ';
            const purgeBtn2 = document.createElement('button'); purgeBtn2.className = 'purge-btn'; purgeBtn2.textContent = 'Р Р€Р Т‘Р В°Р В»Р С‘РЎвЂљРЎРЉ Р Р…Р В°Р Р†РЎРѓР ВµР С–Р Т‘Р В°';
            actions.appendChild(restoreBtn);
            actions.appendChild(purgeBtn2);

            mini.appendChild(meta);
            mini.appendChild(qEl);
            mini.appendChild(aEl);
            mini.appendChild(actions);
            grid.appendChild(mini);

            // Р С›Р С—РЎвЂљР С‘Р СР С‘РЎРѓРЎвЂљР С‘РЎвЂЎР Р…Р С•Р Вµ Р Р†Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р В»Р ВµР Р…Р С‘Р Вµ + Р С•РЎвЂЎР С‘РЎРѓРЎвЂљР С”Р В° Р В»Р С•Р С”Р В°Р В»РЎРЉР Р…Р С•Р в„– Р С”Р В°РЎР‚РЎвЂљРЎвЂ№ РЎС“Р Т‘Р В°Р В»Р ВµР Р…Р С‘Р в„–
            restoreBtn.addEventListener('click', async () => {
                restoreBtn.textContent = 'Р вЂ™Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р В»Р ВµР Р…Р С‘Р Вµ...'; restoreBtn.disabled = true;
                // Р Р€Р Т‘Р В°Р В»РЎРЏР ВµР С Р С‘Р В· Р В»Р С•Р С”Р В°Р В»РЎРЉР Р…Р С•Р С–Р С• Р С”РЎРЊРЎв‚¬Р В° Р С”Р С•РЎР‚Р В·Р С‘Р Р…РЎвЂ№ РЎРѓРЎР‚Р В°Р В·РЎС“
                serverTrashSet.delete(q);
                serverTrashItems = serverTrashItems.filter(t => t.item?.question !== q);
                // Р вЂўРЎРѓР В»Р С‘ Р С”Р В°РЎР‚РЎвЂљР В° Р В»Р С•Р С”Р В°Р В»РЎРЉР Р…РЎвЂ№РЎвЂ¦ РЎС“Р Т‘Р В°Р В»Р ВµР Р…Р С‘Р в„– Р С—Р С•Р СР ВµРЎвЂЎР В°Р В»Р В° РЎРЊРЎвЂљРЎС“ Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”РЎС“ Р С”Р В°Р С” РЎС“Р Т‘Р В°Р В»РЎвЂР Р…Р Р…РЎС“РЎР‹ РІР‚вЂќ Р С•РЎвЂЎР С‘РЎРѓРЎвЂљР С‘Р С
                const delMap = getDeletedItems();
                if (delMap && delMap[q]) { delete delMap[q]; setDeletedItems(delMap); }
                renderTrashPanel();
                // Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С РЎвЂљР ВµР С”РЎС“РЎвЂ°Р С‘Р в„– РЎРѓР С—Р С‘РЎРѓР С•Р С” Р Р† Р В·Р В°Р Р†Р С‘РЎРѓР С‘Р СР С•РЎРѓРЎвЂљР С‘ Р С•РЎвЂљ Р В°Р С”РЎвЂљР С‘Р Р†Р Р…Р С•Р С–Р С• РЎвЂљР В°Р В±Р В°
                // Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С Р В±Р ВµР В· РЎРѓР В±РЎР‚Р С•РЎРѓР В° Р С”Р С•Р Р…РЎвЂљР ВµР С”РЎРѓРЎвЂљР В°
                refreshCurrentContext();
                // Р СџРЎвЂ№РЎвЂљР В°Р ВµР СРЎРѓРЎРЏ Р Р†Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р С‘РЎвЂљРЎРЉ Р Р…Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚Р Вµ
                let ok = false; try { ok = await restoreFromServerTrash([q]); } catch (e) { console.error('[restore-click] Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р В·Р В°Р С—РЎР‚Р С•РЎРѓР В° Р С” РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚РЎС“ /restore', e); ok = false; }
                if (ok) {
                    try { await refreshServerTrash(); } catch (_) { }
                    // Р вЂўРЎРѓР В»Р С‘ Р Р†Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р В»Р ВµР Р…Р Р…Р С•Р в„– Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р С‘ Р Р…Р ВµРЎвЂљ Р Р† РЎвЂљР ВµР С”РЎС“РЎвЂ°Р ВµР С Р В±Р В°Р В·Р С•Р Р†Р С•Р С Р Р…Р В°Р В±Р С•РЎР‚Р Вµ (uniqueQaData)
                    // Р С‘ Р С•Р Р…Р В° Р Р…Р Вµ РЎвЂЎР С‘РЎРѓР В»Р С‘РЎвЂљРЎРѓРЎРЏ РЎРѓРЎР‚Р ВµР Т‘Р С‘ Р Р…Р С•Р Р†РЎвЂ№РЎвЂ¦ РЎРЊР В»Р ВµР СР ВµР Р…РЎвЂљР С•Р Р† РІР‚вЂќ Р Т‘Р С•Р В±Р В°Р Р†Р С‘Р С Р ВµРЎвЂ Р Р† Р Р…Р С•Р Р†РЎвЂ№Р Вµ Р Т‘Р В»РЎРЏ Р С—Р С•РЎРѓР В»Р ВµР Т‘РЎС“РЎР‹РЎвЂ°Р ВµР С–Р С• РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘РЎРЏ.
                    const baseHas = !!uniqueQaData.find(i => i.question === q);
                    const newItemsArr = getNewItems();
                    const newHas = !!newItemsArr.find(i => i.question === q);
                    if (!baseHas && !newHas && it) {
                        newItemsArr.push({ ...it });
                        setLS('qaNewItems', newItemsArr);
                    }
                    try { window.__lastRestoredQuestion = q; } catch (_) { }
                    // СЂСџвЂќТђ Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏР ВµР С Р Р…Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚ Р вЂР вЂўР вЂ” forceReloadData
                    saveMergedToServer(true).then(saveOk => {
                        if (saveOk) {
                            setSaveStatus('success', 'Р С™Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р В° Р Р†Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р В»Р ВµР Р…Р В°');
                            restoreBtn.textContent = 'Р вЂњР С•РЎвЂљР С•Р Р†Р С•';
                            setTimeout(() => { restoreBtn.textContent = 'Р вЂ™Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р С‘РЎвЂљРЎРЉ'; restoreBtn.disabled = false; }, 1500);
                        } else {
                            setSaveStatus('error', 'Р С›РЎв‚¬Р С‘Р В±Р С”Р В° РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘РЎРЏ');
                            restoreBtn.textContent = 'Р вЂ™Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р С‘РЎвЂљРЎРЉ'; restoreBtn.disabled = false;
                        }
                    });
                } else {
                    try { await refreshServerTrash(); } catch (_) { }
                    setSaveStatus('error', 'Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р Р†Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р В»Р ВµР Р…Р С‘РЎРЏ Р Р…Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚Р Вµ');
                    restoreBtn.textContent = 'Р вЂ™Р С•РЎРѓРЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р С‘РЎвЂљРЎРЉ'; restoreBtn.disabled = false;
                }
            });

            // Р С›Р С”Р С•Р Р…РЎвЂЎР В°РЎвЂљР ВµР В»РЎРЉР Р…Р С•Р Вµ РЎС“Р Т‘Р В°Р В»Р ВµР Р…Р С‘Р Вµ (Р Р†РЎвЂљР С•РЎР‚Р В°РЎРЏ Р Р†Р ВµРЎвЂљР С”Р В°)
            purgeBtn2.addEventListener('click', async () => {
                purgeBtn2.textContent = 'Р Р€Р Т‘Р В°Р В»Р ВµР Р…Р С‘Р Вµ...'; purgeBtn2.disabled = true;

                // СЂСџвЂќвЂ™ Р СџР С•Р В»РЎС“РЎвЂЎР В°Р ВµР С username
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

                        // СЂСџвЂќТђ Р вЂ™Р С’Р вЂ“Р СњР С›: Р вЂќР С•Р В±Р В°Р Р†Р В»РЎРЏР ВµР С Р Р† qaDeletedItems РЎвЂЎРЎвЂљР С•Р В±РЎвЂ№ Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р В° Р Р…Р Вµ Р Р†Р ВµРЎР‚Р Р…РЎС“Р В»Р В°РЎРѓРЎРЉ Р С—РЎР‚Р С‘ РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘Р С‘
                        const delMap = getDeletedItems();
                        delMap[q] = { deleted_at: new Date().toISOString(), deleted_by: username, permanent: true };
                        setDeletedItems(delMap);

                        const newArr = getNewItems().filter(i => i.question !== q);
                        setLS('qaNewItems', newArr);

                        // СЂСџвЂќвЂ™ Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С localStorage РЎРѓ Р С”Р С•РЎР‚Р В·Р С‘Р Р…Р С•Р в„–
                        const localTrash = localStorage.getItem('qaUserTrash');
                        if (localTrash) {
                            const trash = JSON.parse(localTrash);
                            const newTrash = trash.filter(t => t.item?.question !== q);
                            localStorage.setItem('qaUserTrash', JSON.stringify(newTrash));
                        }

                        renderTrashPanel();
                        refreshCurrentContext();
                        // СЂСџвЂќТђ Р СњР вЂў Р Р†РЎвЂ№Р В·РЎвЂ№Р Р†Р В°Р ВµР С saveMergedToServer() РЎвЂЎРЎвЂљР С•Р В±РЎвЂ№ Р Р…Р Вµ Р Р†Р ВµРЎР‚Р Р…РЎС“РЎвЂљРЎРЉ Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”РЎС“ Р С•Р В±РЎР‚Р В°РЎвЂљР Р…Р С•!
                        setSaveStatus('success', 'Р С™Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р В° РЎС“Р Т‘Р В°Р В»Р ВµР Р…Р В° Р Р…Р В°Р Р†РЎРѓР ВµР С–Р Т‘Р В°');
                    } else {
                        const error = await resp.text();
                        console.error('[delete-permanent] Р С›РЎв‚¬Р С‘Р В±Р С”Р В°:', resp.status, error);
                        setSaveStatus('error', 'Р С›РЎв‚¬Р С‘Р В±Р С”Р В°: ' + error);
                    }
                } catch (e) {
                    console.error('[delete-permanent] Р С›РЎв‚¬Р С‘Р В±Р С”Р В°:', e);
                    setSaveStatus('error', 'Р РЋР ВµРЎР‚Р Р†Р ВµРЎР‚ РЎС“Р Т‘Р В°Р В»Р ВµР Р…Р С‘РЎРЏ Р Р…Р ВµР Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р ВµР Р…');
                }
                purgeBtn2.textContent = 'Р Р€Р Т‘Р В°Р В»Р С‘РЎвЂљРЎРЉ Р Р…Р В°Р Р†РЎРѓР ВµР С–Р Т‘Р В°'; purgeBtn2.disabled = false;
            });
        });
    }
}

// Р В¤РЎС“Р Р…Р С”РЎвЂ Р С‘РЎРЏ Р Т‘Р В»РЎРЏ РЎвЂћР С‘Р В»РЎРЉРЎвЂљРЎР‚Р В°РЎвЂ Р С‘Р С‘ Р Р†Р С•Р С—РЎР‚Р С•РЎРѓР С•Р Р† Р С—Р С• Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р С‘
function filterQuestionsByCategory(categoryName) {
    currentContextKey = `category:${categoryName}`;
    const data = getRuntimeData();
    // Р вЂўРЎРѓР В»Р С‘ Р С‘Р СРЎРЏ Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р С‘ РІР‚вЂќ Р С•РЎвЂљР С•Р В±РЎР‚Р В°Р В¶Р В°Р ВµР СР С•Р Вµ, Р Р…Р В°Р в„–Р Т‘Р ВµР С Р С‘РЎРѓРЎвЂ¦Р С•Р Т‘Р Р…Р С•Р Вµ Р С‘Р СРЎРЏ
    const catPlaceholders = getCategoryPlaceholders();
    const canonicalCategory = Object.entries(catPlaceholders).find(([, v]) => v?.displayName === categoryName)?.[0] || categoryName;
    const filteredData = data.filter(item => item.category === canonicalCategory || item.category === categoryName);
    displayQuestions(filteredData, `Р С™Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏ: ${categoryName}`);
}

// Р В¤РЎС“Р Р…Р С”РЎвЂ Р С‘РЎРЏ Р Т‘Р В»РЎРЏ РЎвЂћР С‘Р В»РЎРЉРЎвЂљРЎР‚Р В°РЎвЂ Р С‘Р С‘ Р Р†Р С•Р С—РЎР‚Р С•РЎРѓР С•Р Р† Р С—Р С• Р С—Р С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р С‘
function filterQuestionsBySubcategory(categoryName, subcategoryName) {
    currentContextKey = `subcategory:${categoryName}#${subcategoryName}`;
    const data = getRuntimeData();
    const catPlaceholders = getCategoryPlaceholders();
    const scPlaceholders = getSubcategoryPlaceholders();
    const canonicalCategory = Object.entries(catPlaceholders).find(([, v]) => v?.displayName === categoryName)?.[0] || categoryName;
    const scMap = scPlaceholders[canonicalCategory] || scPlaceholders[categoryName] || {};
    const canonicalSub = Object.entries(scMap).find(([, v]) => v?.displayName === subcategoryName)?.[0] || subcategoryName;
    const filteredData = data.filter(item => (item.category === canonicalCategory || item.category === categoryName) && (item.subcategory === canonicalSub || item.subcategory === subcategoryName));
    displayQuestions(filteredData, `Р СџР С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏ: ${subcategoryName}`);
}

// Р В¤РЎС“Р Р…Р С”РЎвЂ Р С‘РЎРЏ Р Т‘Р В»РЎРЏ Р С•РЎвЂљР С•Р В±РЎР‚Р В°Р В¶Р ВµР Р…Р С‘РЎРЏ Р Р†РЎРѓР ВµРЎвЂ¦ Р Р†Р С•Р С—РЎР‚Р С•РЎРѓР С•Р Р†
function showAllQuestions() {
    currentContextKey = 'all';
    displayQuestions(getRuntimeData(), 'Р вЂ™РЎРѓР Вµ Р Р†Р С•Р С—РЎР‚Р С•РЎРѓРЎвЂ№');
}

// Р В¤РЎС“Р Р…Р С”РЎвЂ Р С‘РЎРЏ Р Т‘Р В»РЎРЏ Р С•РЎвЂљР С•Р В±РЎР‚Р В°Р В¶Р ВµР Р…Р С‘РЎРЏ Р С‘Р В·Р В±РЎР‚Р В°Р Р…Р Р…РЎвЂ№РЎвЂ¦ Р Р†Р С•Р С—РЎР‚Р С•РЎРѓР С•Р Р†
function showFavorites() {
    currentContextKey = 'favorites';
    const favorites = new Set(JSON.parse(localStorage.getItem('qaFavorites') || '[]'));
    const favData = getRuntimeData().filter(item => favorites.has(item.question));
    displayQuestions(favData, 'Р ВР В·Р В±РЎР‚Р В°Р Р…Р Р…Р С•Р Вµ');
}

// Р Р€Р Р…Р С‘Р Р†Р ВµРЎР‚РЎРѓР В°Р В»РЎРЉР Р…Р В°РЎРЏ Р С—Р ВµРЎР‚Р ВµРЎР‚Р С‘РЎРѓР С•Р Р†Р С”Р В° РЎвЂљР ВµР С”РЎС“РЎвЂ°Р ВµР С–Р С• Р С”Р С•Р Р…РЎвЂљР ВµР С”РЎРѓРЎвЂљР В° Р В±Р ВµР В· РЎРѓР В±РЎР‚Р С•РЎРѓР В° Р Р…Р В° Р’В«Р вЂ™РЎРѓР Вµ Р Р†Р С•Р С—РЎР‚Р С•РЎРѓРЎвЂ№Р’В»
function refreshCurrentContext() {
    // Р СњР вЂў Р С—Р С•Р С”Р В°Р В·РЎвЂ№Р Р†Р В°Р ВµР С Р Р†Р С•Р С—РЎР‚Р С•РЎРѓРЎвЂ№ Р ВµРЎРѓР В»Р С‘ Р С•РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљР В° РЎРѓРЎвЂљРЎР‚Р В°Р Р…Р С‘РЎвЂ Р В° РЎРѓРЎвЂљР В°РЎвЂљР С‘РЎРѓРЎвЂљР С‘Р С”Р С‘!
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

// Р В¤РЎС“Р Р…Р С”РЎвЂ Р С‘РЎРЏ Р Т‘Р В»РЎРЏ Р С•РЎвЂљР С•Р В±РЎР‚Р В°Р В¶Р ВµР Р…Р С‘РЎРЏ Р Р†Р С•Р С—РЎР‚Р С•РЎРѓР С•Р Р†
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
                Р РЋР С—Р С‘РЎРѓР С•Р С” Р Р†Р С•Р С—РЎР‚Р С•РЎРѓР С•Р Р† Р С—РЎС“РЎРѓРЎвЂљ
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

        // Р СџРЎР‚Р С‘Р СР ВµР Р…РЎРЏР ВµР С Р С—Р С•РЎР‚РЎРЏР Т‘Р С•Р С”, Р ВµРЎРѓР В»Р С‘ Р В·Р В°Р Т‘Р В°Р Р…
        const order = getOrderForContext(currentContextKey);
        if (order && sortMode === 'default') {
            const idx = new Map(order.map((q, i) => [q, i]));
            currentQuestions.sort((a, b) => (idx.get(a.question) ?? 1e9) - (idx.get(b.question) ?? 1e9));
        }

        // Р СџР С•Р В»РЎС“РЎвЂЎР В°Р ВµР С Р С—РЎР‚Р С•Р С–РЎР‚Р ВµРЎРѓРЎРѓ Р Т‘Р В»РЎРЏ Р Р†РЎРѓР ВµРЎвЂ¦ Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР ВµР С” Р Т‘Р В»РЎРЏ РЎРѓР С•РЎР‚РЎвЂљР С‘РЎР‚Р С•Р Р†Р С”Р С‘ Р С‘ Р С•РЎвЂљР С•Р В±РЎР‚Р В°Р В¶Р ВµР Р…Р С‘РЎРЏ
        let progressMap = {};
        try {
            progressMap = getProgressMap();
        } catch (e) {
            console.warn('getProgressMap failed:', e);
        }

        // Р СџРЎР‚Р С‘Р СР ВµР Р…РЎРЏР ВµР С РЎРѓР С•РЎР‚РЎвЂљР С‘РЎР‚Р С•Р Р†Р С”РЎС“ Р С—Р С• EF (РЎРѓР ВµРЎР‚Р Т‘Р ВµРЎвЂЎР С”Р В°Р С), Р ВµРЎРѓР В»Р С‘ Р Р†Р С”Р В»РЎР‹РЎвЂЎР ВµР Р…Р В°
        if (sortMode !== 'default') {
            currentQuestions.sort((a, b) => {
                const efA = progressMap[a.question]?.easeFactor ?? 2.3;
                const efB = progressMap[b.question]?.easeFactor ?? 2.3;

                // 1. Р СџР ВµРЎР‚Р Р†Р С‘РЎвЂЎР Р…Р В°РЎРЏ РЎРѓР С•РЎР‚РЎвЂљР С‘РЎР‚Р С•Р Р†Р С”Р В° Р С—Р С• EF
                if (Math.abs(efA - efB) >= 0.001) {
                    // asc: Р С•РЎвЂљ Р СР ВµР Р…РЎРЉРЎв‚¬Р ВµР С–Р С• Р С” Р В±Р С•Р В»РЎРЉРЎв‚¬Р ВµР СРЎС“ (1.3 -> 2.9) - Р РЋР В°Р СРЎвЂ№Р Вµ РЎРѓР В»Р С•Р В¶Р Р…РЎвЂ№Р Вµ РЎРѓР Р…Р В°РЎвЂЎР В°Р В»Р В°
                    return sortMode === 'asc' ? efA - efB : efB - efA;
                }

                // 2. Р вЂ™РЎвЂљР С•РЎР‚Р С‘РЎвЂЎР Р…Р В°РЎРЏ РЎРѓР С•РЎР‚РЎвЂљР С‘РЎР‚Р С•Р Р†Р С”Р В° Р С—Р С• ID (Р Р†РЎРѓР ВµР С–Р Т‘Р В° ASC Р Т‘Р В»РЎРЏ РЎРѓРЎвЂљР В°Р В±Р С‘Р В»РЎРЉР Р…Р С•РЎРѓРЎвЂљР С‘)
                const idA = parseInt(a.id, 10) || 0;
                const idB = parseInt(b.id, 10) || 0;
                if (idA !== idB) {
                    return idA - idB;
                }

                // 3. Р СћРЎР‚Р ВµРЎвЂљР С‘РЎвЂЎР Р…Р В°РЎРЏ РЎРѓР С•РЎР‚РЎвЂљР С‘РЎР‚Р С•Р Р†Р С”Р В° Р С—Р С• Р В°Р В»РЎвЂћР В°Р Р†Р С‘РЎвЂљРЎС“ (Р Р†РЎРѓР ВµР С–Р Т‘Р В° ASC Р Т‘Р В»РЎРЏ РЎРѓРЎвЂљР В°Р В±Р С‘Р В»РЎРЉР Р…Р С•РЎРѓРЎвЂљР С‘)
                return a.question.localeCompare(b.question, undefined, { numeric: true, sensitivity: 'base' });
            });
        }

        // Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С РЎРѓРЎвЂЎР ВµРЎвЂљРЎвЂЎР С‘Р С” РЎР‚Р ВµР В·РЎС“Р В»РЎРЉРЎвЂљР В°РЎвЂљР С•Р Р† (Р Р†РЎвЂ№Р Р…Р ВµРЎРѓР ВµР Р… Р С‘Р В· grid)
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

        // Р ВР С”Р С•Р Р…Р С”Р С‘ РЎРѓР С•РЎР‚РЎвЂљР С‘РЎР‚Р С•Р Р†Р С”Р С‘
        const sortIcons = {
            default: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5"/></svg>',
            asc: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5" opacity="0.3"/></svg>', // Р РЋРЎвЂљРЎР‚Р ВµР В»Р С”Р В° Р Р†Р Р…Р С‘Р В· (Р Р†Р С•Р В·РЎР‚Р В°РЎРѓРЎвЂљР В°Р Р…Р С‘Р Вµ)
            desc: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 9l5-5 5 5"/><path d="M7 15l5 5 5-5" opacity="0.3"/></svg>'  // Р РЋРЎвЂљРЎР‚Р ВµР В»Р С”Р В° Р Р†Р Р†Р ВµРЎР‚РЎвЂ¦ (РЎС“Р В±РЎвЂ№Р Р†Р В°Р Р…Р С‘Р Вµ)
        };
        const sortTitle = {
            default: 'Р РЋР С•РЎР‚РЎвЂљР С‘РЎР‚Р С•Р Р†Р С”Р В°: Р СџР С• РЎС“Р СР С•Р В»РЎвЂЎР В°Р Р…Р С‘РЎР‹',
            asc: 'Р РЋР С•РЎР‚РЎвЂљР С‘РЎР‚Р С•Р Р†Р С”Р В°: Р С›РЎвЂљ РЎРѓР В»Р С•Р В¶Р Р…РЎвЂ№РЎвЂ¦ Р С” Р В»Р ВµР С–Р С”Р С‘Р С (EF РІвЂ вЂ)',
            desc: 'Р РЋР С•РЎР‚РЎвЂљР С‘РЎР‚Р С•Р Р†Р С”Р В°: Р С›РЎвЂљ Р В»Р ВµР С–Р С”Р С‘РЎвЂ¦ Р С” РЎРѓР В»Р С•Р В¶Р Р…РЎвЂ№Р С (EF РІвЂ вЂњ)'
        };

        // Р В¤Р С•РЎР‚Р СР С‘РЎР‚РЎС“Р ВµР С РЎвЂљР ВµР С”РЎРѓРЎвЂљ РЎРѓРЎвЂЎР ВµРЎвЂљРЎвЂЎР С‘Р С”Р В°
        // СЂСџвЂќвЂ™ Р ВРЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р ВµР С getRuntimeData() Р Т‘Р В»РЎРЏ Р С”Р С•Р Р…РЎРѓР С‘РЎРѓРЎвЂљР ВµР Р…РЎвЂљР Р…Р С•РЎРѓРЎвЂљР С‘
        const runtimeData = getRuntimeData();
        const totalCount = runtimeData.length;
        const isFiltered = questions.length !== totalCount;
        const countText = isFiltered
            ? `Р СњР В°Р в„–Р Т‘Р ВµР Р…Р С•: ${questions.length} Р С‘Р В· ${totalCount}`
            : `Р вЂ™РЎРѓР ВµР С–Р С• Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР ВµР С”: ${questions.length}`;

        countContainer.innerHTML = `
        <p class="results-count" style="margin:0">${countText}</p>
        <button id="sort-toggle-btn" class="nav-icon-btn" title="${sortTitle[sortMode]}" style="padding:4px 8px; border-radius:4px; border:1px solid #444; background:none; cursor:pointer; display:flex; align-items:center; justify-content:center;">
            ${sortIcons[sortMode]}
        </button>
    `;

        // Р С›Р В±РЎР‚Р В°Р В±Р С•РЎвЂљРЎвЂЎР С‘Р С” Р С”Р Р…Р С•Р С—Р С”Р С‘ РЎРѓР С•РЎР‚РЎвЂљР С‘РЎР‚Р С•Р Р†Р С”Р С‘
        const sortBtn = countContainer.querySelector('#sort-toggle-btn');
        if (sortBtn) {
            sortBtn.addEventListener('click', () => {
                if (sortMode === 'default') sortMode = 'asc';
                else if (sortMode === 'asc') sortMode = 'desc';
                else sortMode = 'default';
                displayQuestions(currentQuestions, title);
            });
        }

        // Р ТђР ВµР В»Р С—Р ВµРЎР‚ Р Т‘Р В»РЎРЏ Р С•РЎвЂљРЎР‚Р С‘РЎРѓР С•Р Р†Р С”Р С‘ РЎРѓР ВµРЎР‚Р Т‘Р ВµРЎвЂЎР ВµР С” (Р Р…Р С•Р Р†Р В°РЎРЏ Р В»Р С•Р С–Р С‘Р С”Р В° РЎРѓ Р Т‘РЎР‚Р С•Р В±Р Р…РЎвЂ№Р СР С‘)
        const renderHearts = (ef) => {
            try {
                if (typeof getDifficultyLevel !== 'function' || typeof getLevelProgress !== 'function') {
                    console.warn('SRS functions not available');
                    return '';
                }

                // Check for NEW card (ef is null or undefined)
                if (ef === null || ef === undefined) {
                    return '<div class="hearts-container" title="Р С™Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р В° Р ВµРЎвЂ°Р Вµ Р Р…Р Вµ Р С‘Р В·РЎС“РЎвЂЎР В°Р В»Р В°РЎРѓРЎРЉ" style="position:absolute; top:12px; right:40px; z-index:998;"><span class="level-label" style="font-size:10px;color:var(--color-text-secondary);font-weight:600;background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;">Р СњР С›Р вЂ™Р С’Р Р‡</span></div>';
                }

                // Р В Р В°РЎРѓРЎвЂЎР ВµРЎвЂљ Р С”Р С•Р В»Р С‘РЎвЂЎР ВµРЎРѓРЎвЂљР Р†Р В° РЎРѓР ВµРЎР‚Р Т‘Р ВµРЎвЂЎР ВµР С” (1.0 - 5.0)
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
                    'VERY_HARD': 'Р С›РЎвЂЎР ВµР Р…РЎРЉ РЎвЂљРЎР‚РЎС“Р Т‘Р Р…РЎвЂ№Р Вµ',
                    'HARD': 'Р СћРЎР‚РЎС“Р Т‘Р Р…РЎвЂ№Р Вµ',
                    'STANDARD': 'Р РЋРЎвЂљР В°Р Р…Р Т‘Р В°РЎР‚РЎвЂљ',
                    'EASY': 'Р вЂєР ВµР С–Р С”Р С‘Р Вµ'
                };
                const levelName = levelNames[level] || level;

                let html = '<div class="hearts-container" title="Р Р€РЎР‚Р С•Р Р†Р ВµР Р…РЎРЉ: ' + levelName + '\\nEF: ' + ef.toFixed(2) + '\\nР РЋР ВµРЎР‚Р Т‘Р ВµРЎвЂЎР ВµР С”: ' + heartsCount.toFixed(2) + '" style="position:absolute; top:12px; right:40px; display:flex; gap:2px; z-index:998;">';

                // Р В Р С‘РЎРѓРЎС“Р ВµР С 5 РЎРѓР ВµРЎР‚Р Т‘Р ВµРЎвЂЎР ВµР С”
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

        // Р вЂќР С•Р В±Р В°Р Р†Р В»РЎРЏР ВµР С Р Р†Р С•Р С—РЎР‚Р С•РЎРѓРЎвЂ№
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
                                setSaveStatus('saving', 'Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘Р Вµ Р С—Р С•РЎР‚РЎРЏР Т‘Р С”Р В° Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР ВµР С”...');
                                const meta = await getServerMetadata();
                                meta.orderOverrides = meta.orderOverrides || {};
                                meta.orderOverrides[currentContextKey] = currentQuestions.map(q => q.question);
                                const ok = await updateServerMetadata(meta);
                                setSaveStatus(ok ? 'success' : 'error', ok ? 'Р СџР С•РЎР‚РЎРЏР Т‘Р С•Р С” Р С‘Р В·Р СР ВµР Р…Р ВµР Р…' : 'Р С›РЎв‚¬Р С‘Р В±Р С”Р В° РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘РЎРЏ');
                            })();
                            // Р СџР ВµРЎР‚Р ВµРЎР‚Р С‘РЎРѓР С•Р Р†Р В°РЎвЂљРЎРЉ РЎвЂљР ВµР С”РЎС“РЎвЂ°Р С‘Р в„– РЎРѓР С—Р С‘РЎРѓР С•Р С”
                            displayQuestions(currentQuestions, title);
                        }
                    });
                }

                // Р ВР В·Р В±РЎР‚Р В°Р Р…Р Р…Р С•Р Вµ
                let isFav = false;
                let favClass = '';
                try {
                    const favorites = JSON.parse(localStorage.getItem('qaFavorites') || '[]');
                    isFav = favorites.includes(item.question);
                    favClass = isFav ? 'fav-active' : '';
                } catch (e) {
                    console.warn('Favorites error:', e);
                }

                // Р С›РЎвЂљР С•Р В±РЎР‚Р В°Р В¶Р В°Р ВµР С Р В±Р ВµР в„–Р Т‘Р В¶Р С‘ РЎРѓ РЎС“РЎвЂЎРЎвЂРЎвЂљР С•Р С Р С—Р В»Р ВµР в„–РЎРѓРЎвЂ¦Р С•Р В»Р Т‘Р ВµРЎР‚Р С•Р Р†
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

                // Р В Р В°РЎРѓРЎвЂЎР ВµРЎвЂљ РЎРѓР ВµРЎР‚Р Т‘Р ВµРЎвЂЎР ВµР С”
                const cardProgress = progressMap[item.question];
                // If no progress or no easeFactor, treat as NEW (pass null)
                const ef = (cardProgress && cardProgress.easeFactor !== undefined) ? cardProgress.easeFactor : null;

                // Р СџРЎР‚Р С‘Р СР ВµР Р…РЎРЏР ВµР С РЎвЂћР С•РЎР‚Р СР В°РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘Р Вµ Р С” Р Р†Р С•Р С—РЎР‚Р С•РЎРѓРЎС“ Р С‘ Р С•РЎвЂљР Р†Р ВµРЎвЂљРЎС“
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
            <button class="fav-btn ${favClass}" title="Р вЂ™ Р С‘Р В·Р В±РЎР‚Р В°Р Р…Р Р…Р С•Р Вµ" style="position:absolute;top:10px;right:10px;width:24px;height:24px;background:none;border:none;cursor:pointer;padding:0;z-index:999;display:block !important;opacity:1 !important;">${starSvg(isFav)}</button>
            <div class="question">${questionHTML}</div>
            <div class="answer">${answerHTML}</div>
        `;

                // Р С›Р В±РЎР‚Р В°Р В±Р С•РЎвЂљРЎвЂЎР С‘Р С” Р С‘Р В·Р В±РЎР‚Р В°Р Р…Р Р…Р С•Р С–Р С•
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

                // Р СљР ВµР Р…РЎР‹ Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р С‘ (РІвЂ№В®) Р Р† РЎР‚Р ВµР В¶Р С‘Р СР Вµ РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ
                if (editMode) {
                    const qRow = resultItem.querySelector('.question-row');
                    const kebabBtn = document.createElement('button');
                    kebabBtn.className = 'kebab-btn';
                    kebabBtn.title = 'Р СљР ВµР Р…РЎР‹ Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р С‘';
                    kebabBtn.textContent = 'РІвЂ№В®';
                    // Р СћРЎвЂР СР Р…Р С•-РЎРѓР ВµРЎР‚РЎвЂ№Р в„– РЎРѓРЎвЂљР С‘Р В»РЎРЉ Р С”Р Р…Р С•Р С—Р С”Р С‘ РІвЂ№В® Р Р…Р В° Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р Вµ
                    kebabBtn.style.background = '#444';
                    kebabBtn.style.color = '#eee';
                    kebabBtn.style.border = '1px solid #333';
                    kebabBtn.style.borderRadius = '4px';
                    kebabBtn.style.padding = '2px 6px';
                    qRow.appendChild(kebabBtn);

                    // СЂСџвЂќТђ Р вЂњР В»Р С•Р В±Р В°Р В»РЎРЉР Р…Р С•Р Вµ РЎРѓР С•РЎРѓРЎвЂљР С•РЎРЏР Р…Р С‘Р Вµ Р СР С•Р Т‘Р В°Р В»РЎРЉР Р…Р С•Р С–Р С• Р С•Р С”Р Р…Р В° РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ
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

                        // Р СџР С•Р В»РЎС“РЎвЂЎР В°Р ВµР С РЎвЂћР С•РЎР‚Р СР В°РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘Р Вµ Р С‘Р В· Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р С‘ Р С‘Р В»Р С‘ РЎРѓР С•Р В·Р Т‘Р В°РЎвЂР С Р С—РЎС“РЎРѓРЎвЂљР С•Р Вµ
                        const formatting = item.formatting || createEmptyFormatting();

                        // Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏР ВµР С РЎРѓР С•РЎРѓРЎвЂљР С•РЎРЏР Р…Р С‘Р Вµ
                        editModalState = {
                            originalCard: { ...item },
                            formatting: { ...formatting },
                            oldQuestion: item.question
                        };

                        // Р РЋР С•Р В·Р Т‘Р В°РЎвЂР С Р СР С•Р Т‘Р В°Р В»РЎРЉР Р…Р С•Р Вµ Р С•Р С”Р Р…Р С• РЎРѓ Р С—Р В°Р Р…Р ВµР В»РЎРЉРЎР‹ РЎвЂћР С•РЎР‚Р СР В°РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ
                        const modalHTML = `
                            <div class="edit-modal-overlay" id="edit-modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 10px;">
                                <div class="edit-modal" style="background: #1e1e1e; border-radius: 12px; padding: 16px; width: 100%; max-width: 700px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.5); box-sizing: border-box;">
                                    
                                    <!-- Р С™Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏ Р С‘ Р С—Р С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏ Р Р† 2 РЎР‚РЎРЏР Т‘Р В° -->
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
                                        <div>
                                            <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Р С™Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏ</label>
                                            <select class="edit-category" style="width: 100%; padding: 10px 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 6px; color: #fff; font-size: 13px; box-sizing: border-box;">${categoryOptions}</select>
                                        </div>
                                        <div>
                                            <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Р СџР С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏ</label>
                                            <select class="edit-subcategory" style="width: 100%; padding: 10px 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 6px; color: #fff; font-size: 13px; box-sizing: border-box;">${subcategoryOptions}</select>
                                        </div>
                                    </div>
                                    
                                    <!-- Р СџР В°Р Р…Р ВµР В»РЎРЉ РЎвЂћР С•РЎР‚Р СР В°РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ -->
                                    <div style="margin-bottom: 12px;">
                                        <div class="format-toolbar" id="main-format-toolbar" style="width: 100%; box-sizing: border-box;"></div>
                                    </div>
                                    
                                    <!-- Р вЂ™Р С•Р С—РЎР‚Р С•РЎРѓ -->
                                    <div style="margin-bottom: 12px;">
                                        <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Р вЂ™Р С•Р С—РЎР‚Р С•РЎРѓ</label>
                                        <div class="edit-field-editor" id="edit-question-editor" contenteditable="true" spellcheck="true" style="width: 100%; min-height: 80px; padding: 10px 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 6px; color: #fff; font-size: 14px; line-height: 1.5; outline: none; word-wrap: break-word; overflow-wrap: break-word; box-sizing: border-box;"></div>
                                    </div>
                                    
                                    <!-- Р С›РЎвЂљР Р†Р ВµРЎвЂљ -->
                                    <div style="margin-bottom: 16px;">
                                        <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Р С›РЎвЂљР Р†Р ВµРЎвЂљ</label>
                                        <div class="edit-field-editor" id="edit-answer-editor" contenteditable="true" spellcheck="true" style="width: 100%; min-height: 80px; padding: 10px 12px; background: #2a2a2a; border: 1px solid #444; border-radius: 6px; color: #fff; font-size: 14px; line-height: 1.5; outline: none; word-wrap: break-word; overflow-wrap: break-word; box-sizing: border-box;"></div>
                                    </div>
                                    
                                    <!-- Р С™Р Р…Р С•Р С—Р С”Р С‘ -->
                                    <div style="display: flex; gap: 12px; justify-content: flex-end; flex-wrap: wrap;">
                                        <button class="edit-modal-btn cancel" id="edit-cancel-btn" style="padding: 10px 20px; background: transparent; border: 1px solid #444; border-radius: 6px; color: #aaa; cursor: pointer; font-size: 14px; flex-shrink: 0;">Р С›РЎвЂљР СР ВµР Р…Р В°</button>
                                        <button class="edit-modal-btn save" id="edit-save-btn" style="padding: 10px 20px; background: #4CAF50; border: none; border-radius: 6px; color: #fff; cursor: pointer; font-size: 14px; flex-shrink: 0;">Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…Р С‘РЎвЂљРЎРЉ</button>
                                    </div>
                                </div>
                            </div>
                            
                            <style>
                                /* Р вЂ™РЎРѓР Вµ РЎРЊР В»Р ВµР СР ВµР Р…РЎвЂљРЎвЂ№ Р Р…Р В° 100% РЎв‚¬Р С‘РЎР‚Р С‘Р Р…РЎвЂ№ */
                                #main-format-toolbar,
                                #edit-question-editor,
                                #edit-answer-editor,
                                .edit-category,
                                .edit-subcategory {
                                    width: 100% !important;
                                    max-width: 100% !important;
                                    box-sizing: border-box !important;
                                }
                                
                                /* Р С’Р Т‘Р В°Р С—РЎвЂљР С‘Р Р†Р Р…РЎвЂ№Р Вµ РЎРѓРЎвЂљР С‘Р В»Р С‘ Р Т‘Р В»РЎРЏ Р СР С•Р Т‘Р В°Р В»РЎРЉР Р…Р С•Р С–Р С• Р С•Р С”Р Р…Р В° */
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
                                    /* Р С™Р Р…Р С•Р С—Р С”Р С‘ Р Р† РЎР‚РЎРЏР Т‘ Р Р…Р В° Р СР С•Р В±Р С‘Р В»РЎРЉР Р…Р С•Р С */
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

                        // Р ВР Р…Р С‘РЎвЂ Р С‘Р В°Р В»Р С‘Р В·Р В°РЎвЂ Р С‘РЎРЏ РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С•РЎР‚Р С•Р Р†
                        const toolbarContainer = document.getElementById('main-format-toolbar');
                        const questionEditor = document.getElementById('edit-question-editor');
                        const answerEditor = document.getElementById('edit-answer-editor');
                        const categorySelect = document.querySelector('.edit-category');
                        const subcategorySelect = document.querySelector('.edit-subcategory');

                        // Р СџРЎР‚Р С‘Р СР ВµР Р…РЎРЏР ВµР С РЎвЂћР С•РЎР‚Р СР В°РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘Р Вµ Р С” РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С•РЎР‚Р В°Р С
                        if (questionEditor) {
                            renderFormattingInEditor(questionEditor, item.question, formatting.question || []);
                        }
                        if (answerEditor) {
                            renderFormattingInEditor(answerEditor, item.answer, formatting.answer || []);
                        }

                        // Р РЋР С•Р В·Р Т‘Р В°РЎвЂР С Р С‘ Р С‘Р Р…Р С‘РЎвЂ Р С‘Р В°Р В»Р С‘Р В·Р С‘РЎР‚РЎС“Р ВµР С toolbar
                        if (toolbarContainer) {
                            const mainToolbar = createFormatToolbar('both');
                            toolbarContainer.appendChild(mainToolbar);

                            // Р ВР Р…Р С‘РЎвЂ Р С‘Р В°Р В»Р С‘Р В·Р С‘РЎР‚РЎС“Р ВµР С toolbar РЎРѓ Р С•Р В±Р С•Р С‘Р СР С‘ РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С•РЎР‚Р В°Р СР С‘
                            initFormatToolbar(mainToolbar, questionEditor, answerEditor, editModalState.formatting, (newFormatting) => {
                                editModalState.formatting = newFormatting;
                            });
                        }

                        // Р С›Р В±РЎР‚Р В°Р В±Р С•РЎвЂљРЎвЂЎР С‘Р С” РЎРѓР СР ВµР Р…РЎвЂ№ Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘Р С‘
                        categorySelect.addEventListener('change', () => {
                            const newCategory = categorySelect.value;
                            const newSubs = (categoriesData.find(cat => cat.name === newCategory)?.subcategories || []).map(sub => `<option value="${sub.name}">${sub.name}</option>`).join('');
                            subcategorySelect.innerHTML = newSubs;
                        });

                        // Р С›Р В±РЎР‚Р В°Р В±Р С•РЎвЂљРЎвЂЎР С‘Р С” Р С•РЎвЂљР СР ВµР Р…РЎвЂ№
                        document.getElementById('edit-cancel-btn').addEventListener('click', () => {
                            document.getElementById('edit-modal-overlay').remove();
                        });

                        // Р С›Р В±РЎР‚Р В°Р В±Р С•РЎвЂљРЎвЂЎР С‘Р С” РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘РЎРЏ
                        document.getElementById('edit-save-btn').addEventListener('click', async () => {
                            // Р СџР С•Р В»РЎС“РЎвЂЎР В°Р ВµР С HTML Р С‘Р В· РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С•РЎР‚Р С•Р Р†
                            const questionHTML = questionEditor.innerHTML.trim();
                            const answerHTML = answerEditor.innerHTML.trim();

                            // Р С™Р С•Р Р…Р Р†Р ВµРЎР‚РЎвЂљР С‘РЎР‚РЎС“Р ВµР С HTML Р Р† РЎвЂљР ВµР С”РЎРѓРЎвЂљ + РЎвЂћР С•РЎР‚Р СР В°РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘Р Вµ
                            const questionData = convertHtmlToTextAndFormatting(questionHTML);
                            const answerData = convertHtmlToTextAndFormatting(answerHTML);

                            const newCategory = categorySelect.value;
                            const newSubcategory = subcategorySelect.value;
                            const newQuestion = questionData.text.trim();
                            const newAnswer = answerData.text.trim();

                            if (!newQuestion || !newAnswer) {
                                alert('Р вЂ™Р С•Р С—РЎР‚Р С•РЎРѓ Р С‘ Р С•РЎвЂљР Р†Р ВµРЎвЂљ Р Р…Р Вµ Р СР С•Р С–РЎС“РЎвЂљ Р В±РЎвЂ№РЎвЂљРЎРЉ Р С—РЎС“РЎРѓРЎвЂљРЎвЂ№Р СР С‘');
                                return;
                            }

                            const oldQuestion = editModalState.oldQuestion;

                            // Р СџР С•Р В»РЎС“РЎвЂЎР В°Р ВµР С РЎвЂљР ВµР С”РЎС“РЎвЂ°Р ВµР Вµ РЎвЂћР С•РЎР‚Р СР В°РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘Р Вµ
                            const currentFormatting = editModalState.formatting || createEmptyFormatting();

                            // Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С РЎвЂћР С•РЎР‚Р СР В°РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘Р Вµ Р Р…Р С•Р Р†РЎвЂ№Р СР С‘ Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р СР С‘
                            currentFormatting.question = questionData.formatting || [];
                            currentFormatting.answer = answerData.formatting || [];

                            // Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏР ВµР С Р Р† override РЎРѓ РЎвЂћР С•РЎР‚Р СР В°РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘Р ВµР С
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

                            // Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С Р С‘Р В·Р В±РЎР‚Р В°Р Р…Р Р…Р С•Р Вµ Р ВµРЎРѓР В»Р С‘ Р Р…РЎС“Р В¶Р Р…Р С•
                            const favorites = new Set(JSON.parse(localStorage.getItem('qaFavorites') || '[]'));
                            if (favorites.has(oldQuestion)) {
                                favorites.delete(oldQuestion);
                                favorites.add(newQuestion);
                                localStorage.setItem('qaFavorites', JSON.stringify(Array.from(favorites)));

                                import('../srs/storage.js').then(({ syncFavorite }) => {
                                    try { syncFavorite(newQuestion, true); } catch (e) { }
                                }).catch(() => { });
                            }

                            // Р вЂ”Р В°Р С”РЎР‚РЎвЂ№Р Р†Р В°Р ВµР С Р СР С•Р Т‘Р В°Р В»РЎРЉР Р…Р С•Р Вµ Р С•Р С”Р Р…Р С•
                            document.getElementById('edit-modal-overlay').remove();

                            // Р СџР ВµРЎР‚Р ВµРЎР‚Р С‘РЎРѓР С•Р Р†РЎвЂ№Р Р†Р В°Р ВµР С Р Р†Р С•Р С—РЎР‚Р С•РЎРѓРЎвЂ№
                            displayQuestions(currentQuestions.map(q => q.question === oldQuestion ? { ...q, category: newCategory, subcategory: newSubcategory, question: newQuestion, answer: newAnswer, formatting: currentFormatting } : q), title);

                            // Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏР ВµР С Р Р…Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚
                            const rowEl = resultItem.querySelector('.question-row');
                            setInlineSaveStatus(rowEl, 'saving');
                            const ok = await saveMergedToServer();
                            setInlineSaveStatus(rowEl, ok ? 'success' : 'error');
                        });

                        // Р вЂ”Р В°Р С”РЎР‚РЎвЂ№РЎвЂљР С‘Р Вµ Р С—Р С• Р С”Р В»Р С‘Р С”РЎС“ Р Р…Р В° overlay
                        document.getElementById('edit-modal-overlay').addEventListener('click', (e) => {
                            if (e.target === e.currentTarget) {
                                document.getElementById('edit-modal-overlay').remove();
                            }
                        });
                    };

                    // Р С™Р Р…Р С•Р С—Р С”Р В° Р С”Р В°РЎР‚Р В°Р Р…Р Т‘Р В°РЎв‚¬Р В° РЎС“Р Т‘Р В°Р В»Р ВµР Р…Р В°: РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘Р Вµ Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р Р…Р С• РЎвЂЎР ВµРЎР‚Р ВµР В· Р СР ВµР Р…РЎР‹ РІвЂ№В®

                    // СЂСџвЂќТђ Р ВРЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р ВµР С Р С–Р В»Р С•Р В±Р В°Р В»РЎРЉР Р…РЎС“РЎР‹ РЎвЂћРЎС“Р Р…Р С”РЎвЂ Р С‘РЎР‹ РЎРѓ Р С—РЎР‚Р С•Р Р†Р ВµРЎР‚Р С”Р С•Р в„– qaUserCards
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
                    <button data-act="edit">Р ВР В·Р СР ВµР Р…Р С‘РЎвЂљРЎРЉ</button>
                    <button data-act="duplicate">Р вЂќРЎС“Р В±Р В»Р С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉ</button>
                    <button data-act="delete">Р Р€Р Т‘Р В°Р В»Р С‘РЎвЂљРЎРЉ</button>
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
                                // Р СџР С•Р С”Р В°Р В·Р В°РЎвЂљРЎРЉ Р С‘Р Р…Р Т‘Р С‘Р С”Р В°РЎвЂљР С•РЎР‚ Р С—РЎР‚Р С•Р С–РЎР‚Р ВµРЎРѓРЎРѓР В°
                                const rowEl = resultItem.querySelector('.question-row');
                                setInlineSaveStatus(rowEl, 'saving');

                                // Р СџР ВµРЎР‚Р ВµР СР ВµРЎвЂ°Р В°Р ВµР С Р Р…Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚ Р Р† Р С”Р С•РЎР‚Р В·Р С‘Р Р…РЎС“
                                moveToServerTrash([item]).then(async (trashOk) => {
                                    if (trashOk) {
                                        // Р С›Р С—РЎвЂљР С‘Р СР С‘РЎРѓРЎвЂљР С‘РЎвЂЎР Р…Р С• Р Т‘Р С•Р В±Р В°Р Р†Р В»РЎРЏР ВµР С Р Р† Р В»Р С•Р С”Р В°Р В»РЎРЉР Р…РЎвЂ№Р Вµ Р С”РЎРЊРЎв‚¬Р С‘ Р С”Р С•РЎР‚Р В·Р С‘Р Р…РЎвЂ№
                                        serverTrashSet.add(item.question);
                                        // Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С Р В»Р С•Р С”Р В°Р В»РЎРЉР Р…РЎвЂ№Р в„– РЎРѓР С—Р С‘РЎРѓР С•Р С” Р С”Р С•РЎР‚Р В·Р С‘Р Р…РЎвЂ№, РЎвЂЎРЎвЂљР С•Р В±РЎвЂ№ РЎРѓРЎР‚Р В°Р В·РЎС“ Р С—Р С•Р С”Р В°Р В·Р В°РЎвЂљРЎРЉ Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”РЎС“
                                        try {
                                            serverTrashItems = [
                                                { item: { ...item } },
                                                ...serverTrashItems.filter(t => t.item?.question !== item.question)
                                            ];
                                        } catch (_) { }

                                        // Р Р€Р В±Р ВµР Т‘Р С‘Р СРЎРѓРЎРЏ, РЎвЂЎРЎвЂљР С• Р С—Р В°Р Р…Р ВµР В»РЎРЉ Р С”Р С•РЎР‚Р В·Р С‘Р Р…РЎвЂ№ Р Р†Р С‘Р Т‘Р Р…Р В° Р Р† РЎР‚Р ВµР В¶Р С‘Р СР Вµ РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ
                                        const tp = document.querySelector('.trash-panel');
                                        if (tp && editMode) { tp.style.display = 'block'; }

                                        // Р СџР ВµРЎР‚Р ВµРЎР‚Р С‘РЎРѓР С•Р Р†РЎвЂ№Р Р†Р В°Р ВµР С Р С—Р В°Р Р…Р ВµР В»РЎРЉ Р С”Р С•РЎР‚Р В·Р С‘Р Р…РЎвЂ№ Р С‘ РЎвЂљР ВµР С”РЎС“РЎвЂ°Р С‘Р в„– Р С”Р С•Р Р…РЎвЂљР ВµР С”РЎРѓРЎвЂљ
                                        renderTrashPanel();
                                        refreshCurrentContext();

                                        // Р СџРЎвЂ№РЎвЂљР В°Р ВµР СРЎРѓРЎРЏ РЎРѓР С‘Р Р…РЎвЂ¦РЎР‚Р С•Р Р…Р С‘Р В·Р С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉ РЎРѓ РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚Р Р…Р С•Р в„– Р С”Р С•РЎР‚Р В·Р С‘Р Р…Р С•Р в„– (Р Р…Р Вµ Р В±Р В»Р С•Р С”Р С‘РЎР‚РЎС“Р ВµРЎвЂљ UI)
                                        try { await refreshServerTrash(); } catch (_) { }

                                        setInlineSaveStatus(rowEl, 'success');
                                        setSaveStatus('success', 'Р С™Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”Р В° Р С—Р ВµРЎР‚Р ВµР СР ВµРЎвЂ°Р ВµР Р…Р В° Р Р† Р С”Р С•РЎР‚Р В·Р С‘Р Р…РЎС“');

                                        // СЂСџвЂќТђ Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏР ВµР С Р Р…Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚ Р вЂР вЂўР вЂ” forceReloadData
                                        saveMergedToServer(true).then(saveOk => {
                                            if (!saveOk) setInlineSaveStatus(rowEl, 'error', 'Р С›РЎв‚¬Р С‘Р В±Р С”Р В° РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘РЎРЏ');
                                        });
                                    } else {
                                        setInlineSaveStatus(rowEl, 'error', 'Р С›РЎв‚¬Р С‘Р В±Р С”Р В° РЎС“Р Т‘Р В°Р В»Р ВµР Р…Р С‘РЎРЏ');
                                    }
                                });
                            } else if (act === 'duplicate') {
                                // Show visual indicator
                                const rowEl = resultItem.querySelector('.question-row');
                                setInlineSaveStatus(rowEl, 'saving');

                                const copyQ = genUniqueQuestion(item.question);
                                const duplicatedItem = { ...item, question: copyQ };

                                console.log('[DUPLICATE] Р РЋР С•Р В·Р Т‘Р В°Р Р… Р Т‘РЎС“Р В±Р В»Р С‘Р С”Р В°РЎвЂљ:', {
                                    original: item.question?.substring(0, 50),
                                    copy: copyQ,
                                    timestamp: Date.now()
                                });

                                // СЂСџвЂќТђ Р вЂ™РЎРѓРЎвЂљР В°Р Р†Р В»РЎРЏР ВµР С Р Т‘РЎС“Р В±Р В»Р С‘Р С”Р В°РЎвЂљ Р РЋР В Р С’Р вЂ”Р Р€ Р СџР С›Р РЋР вЂєР вЂў Р С•РЎР‚Р С‘Р С–Р С‘Р Р…Р В°Р В»Р В° Р Р† qaUserCards
                                const sessionUserRaw = localStorage.getItem('qaSessionUser');
                                if (sessionUserRaw) {
                                    const userCards = getQaUserCards();
                                    if (userCards) {
                                        // Р ВРЎвЂ°Р ВµР С Р С•РЎР‚Р С‘Р С–Р С‘Р Р…Р В°Р В» Р С—Р С• Р Р†Р С•Р С—РЎР‚Р С•РЎРѓРЎС“ (Р СР С•Р В¶Р ВµРЎвЂљ Р С•РЎвЂљР В»Р С‘РЎвЂЎР В°РЎвЂљРЎРЉРЎРѓРЎРЏ Р С•РЎвЂљ item.question Р ВµРЎРѓР В»Р С‘ Р В±РЎвЂ№Р В»Р С‘ Р С‘Р В·Р СР ВµР Р…Р ВµР Р…Р С‘РЎРЏ)
                                        const originalIndex = userCards.findIndex(c =>
                                            c.question === item.question ||
                                            (c.category === item.category && c.subcategory === item.subcategory && c.answer === item.answer)
                                        );
                                        if (originalIndex >= 0) {
                                            // Р вЂ™РЎРѓРЎвЂљР В°Р Р†Р В»РЎРЏР ВµР С Р Т‘РЎС“Р В±Р В»Р С‘Р С”Р В°РЎвЂљ Р С—Р С•РЎРѓР В»Р Вµ Р С•РЎР‚Р С‘Р С–Р С‘Р Р…Р В°Р В»Р В°
                                            userCards.splice(originalIndex + 1, 0, duplicatedItem);
                                            setQaUserCards(userCards);
                                        } else {
                                            // Р вЂўРЎРѓР В»Р С‘ Р Р…Р Вµ Р Р…Р В°РЎв‚¬Р В»Р С‘, Р Т‘Р С•Р В±Р В°Р Р†Р В»РЎРЏР ВµР С Р Р† Р С”Р С•Р Р…Р ВµРЎвЂ 
                                            userCards.push(duplicatedItem);
                                            setQaUserCards(userCards);
                                        }
                                    }

                                    // СЂСџвЂќТђ Р вЂќР С›Р вЂР С’Р вЂ™Р вЂєР Р‡Р вЂўР Сљ Р Р† qaNewItems РЎвЂЎРЎвЂљР С•Р В±РЎвЂ№ РЎРѓР С‘Р Р…РЎвЂ¦РЎР‚Р С•Р Р…Р С‘Р В·Р В°РЎвЂ Р С‘РЎРЏ Р Р†Р С‘Р Т‘Р ВµР В»Р В° Р Р…Р С•Р Р†РЎС“РЎР‹ Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР С”РЎС“
                                    const newItems = getNewItems();
                                    if (!newItems.some(n => n.question === copyQ)) {
                                        newItems.push(duplicatedItem);
                                        localStorage.setItem('qaNewItems', JSON.stringify(newItems));

                                        console.log('[DUPLICATE] Р вЂќР С•Р В±Р В°Р Р†Р В»Р ВµР Р…Р С• Р Р† qaNewItems, Р Р†РЎРѓР ВµР С–Р С•:', newItems.length);
                                    }
                                }

                                // Track duplication on server
                                trackServerDuplication(item.question, copyQ).then(trackOk => {
                                    if (trackOk) {
                                        // СЂСџвЂќТђ Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С UI РЎРѓРЎР‚Р В°Р В·РЎС“, Р В±Р ВµР В· forceReloadData, РЎвЂЎРЎвЂљР С•Р В±РЎвЂ№ РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р С‘РЎвЂљРЎРЉ Р С—Р С•РЎР‚РЎРЏР Т‘Р С•Р С” Р С”Р В°РЎР‚РЎвЂљР С•РЎвЂЎР ВµР С”
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

                                        // СЂСџвЂќТђ Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎРЏР ВµР С Р Р…Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚ Р вЂР вЂўР вЂ” forceReloadData
                                        console.log('[DUPLICATE] Р вЂ™РЎвЂ№Р В·РЎвЂ№Р Р†Р В°Р ВµР С saveMergedToServer(true)');
                                        saveMergedToServer(true).then(saveOk => {
                                            if (!saveOk) {
                                                setInlineSaveStatus(rowEl, 'error', 'Р С›РЎв‚¬Р С‘Р В±Р С”Р В° РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘РЎРЏ');
                                            }
                                        });
                                    } else {
                                        setInlineSaveStatus(rowEl, 'error', 'Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р Т‘РЎС“Р В±Р В»Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ');
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
                // Р вЂ™Р С‘Р В·РЎС“Р В°Р В»РЎРЉР Р…Р С• Р С—Р С•Р С”Р В°Р В·РЎвЂ№Р Р†Р В°Р ВµР С, РЎвЂЎРЎвЂљР С• РЎРЊР В»Р ВµР СР ВµР Р…РЎвЂљ РЎРѓР В»Р С•Р СР В°Р В»РЎРѓРЎРЏ (Р Т‘Р В»РЎРЏ Р С•РЎвЂљР В»Р В°Р Т‘Р С”Р С‘)
                try {
                    const errDiv = document.createElement('div');
                    errDiv.style.border = '1px solid red';
                    errDiv.style.color = 'red';
                    errDiv.style.padding = '10px';
                    errDiv.textContent = `Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р С•РЎвЂљР С•Р В±РЎР‚Р В°Р В¶Р ВµР Р…Р С‘РЎРЏ Р Р†Р С•Р С—РЎР‚Р С•РЎРѓР В°: ${err.message}`;
                    resultsList.appendChild(errDiv);
                } catch (_) { }
            }
        });
    } catch (e) {
        console.error('Critical error in displayQuestions:', e);
    }
}
