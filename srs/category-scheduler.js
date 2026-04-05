import { getProgressMap } from './stats-utils.js?v=6.49.0';
import { getStudyStats } from './stats-utils.js?v=6.49.0';

/**
 * Implements "Contextual Cognitive Linking" for session generation.
 */

// Кэш для предотвращения повторных вычислений сессии
let sessionCache = {
    date: null,
    progressHash: null,
    result: null
};

/**
 * Сбрасывает кэш сессии (вызывать при изменении прогресса)
 */
export function invalidateSessionCache() {
    sessionCache.date = null;
    sessionCache.progressHash = null;
    sessionCache.result = null;
}

// Helper to get day difference
function getDaysDiff(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    return Math.floor((d1 - d2) / (1000 * 60 * 60 * 24));
}

/**
 * Main function to generate the daily session.
 * @param {Array} allQuestions - Full list of questions from JSON
 * @returns {Array} List of questions for today's session
 */
export function getTodaysSession(allQuestions) {
    const today = new Date();
    const todayStr = today.getFullYear() + '-' +
        String(today.getMonth() + 1).padStart(2, '0') + '-' +
        String(today.getDate()).padStart(2, '0');

    // Создаём хэш из прогресса для проверки изменений
    const progressMap = getProgressMap();
    // Включаем в хэш количество прогресса И количество пройденных сегодня
    const todayReviewed = Object.values(progressMap).filter(p => p.lastReviewed === todayStr).length;
    const progressHash = `${Object.keys(progressMap).length}_${todayReviewed}_${todayStr}`;

    console.log('[SESSION] Cache check:', {
        cachedDate: sessionCache.date,
        cachedHash: sessionCache.progressHash,
        currentDate: todayStr,
        currentHash: progressHash,
        hasResult: !!sessionCache.result
    });

    // Возвращаем кэш, если дата и прогресс не изменились
    if (sessionCache.date === todayStr && sessionCache.progressHash === progressHash && sessionCache.result) {
        console.log('[SESSION] Returning cached session');
        return sessionCache.result;
    }

    console.log('[SESSION] Cache miss, generating new session');

    const now = Date.now();
    const stats = getStudyStats();
    const accuracy = (stats.total && stats.total > 0) ? (stats.correct / stats.total) : 0;

    console.log('[SESSION] progressMap size:', Object.keys(progressMap).length);
    console.log('[SESSION] todayStr:', todayStr);
    console.log('[SESSION] Всего вопросов для анализа:', allQuestions.length);

    // 1. Identify DUE cards and NEW cards (исключая уже пройденные сегодня)
    const dueCards = [];
    const newCards = [];
    let skippedToday = 0;

    allQuestions.forEach(q => {
        const progress = progressMap[q.question];
        if (progress) {
            // Пропускаем карточки, уже пройденные сегодня
            if (progress.lastReviewed === todayStr) {
                skippedToday++;
                return;
            }

            // Check if due
            // Compatible with both timestamp (nextReviewDate) and ISO string (dueDate)
            let dueDate = progress.nextReviewDate;
            if (!dueDate && progress.dueDate) {
                dueDate = new Date(progress.dueDate).getTime();
            }

            if (!dueDate || dueDate <= now) {
                dueCards.push({ item: q, progress, isNew: false });
            }
        } else {
            newCards.push({ item: q, progress: null, isNew: true });
        }
    });

    console.log('[SESSION] Пропущено сегодня:', skippedToday);
    console.log('[SESSION] Due cards (повторения):', dueCards.length);
    console.log('[SESSION] New cards (новые):', newCards.length);

    // Sort due by hardest first (lowest EF), then by most overdue
    dueCards.sort((a, b) => {
        const efA = a.progress && typeof a.progress.easeFactor === 'number' ? a.progress.easeFactor : 2.5;
        const efB = b.progress && typeof b.progress.easeFactor === 'number' ? b.progress.easeFactor : 2.5;
        if (efA !== efB) return efA - efB;
        const da = a.progress && a.progress.dueDate ? new Date(a.progress.dueDate).getTime() : 0;
        const db = b.progress && b.progress.dueDate ? new Date(b.progress.dueDate).getTime() : 0;
        return da - db;
    });

    // 2. Group by Category/Subcategory
    const grouped = groupByCategoryAndSubcategory([...dueCards, ...newCards]);

    // 3. Calculate Mastery per Category (for prioritization)
    calculateCategoryMastery(grouped, progressMap);

    // 4. Select Cards for Session
    const sessionCards = [];

    // A. Priority: Weakest Categories (Contextual Linking)
    // Find categories with lowest mastery
    const sortedCategories = Object.keys(grouped).sort((a, b) => {
        return (grouped[a].mastery || 0) - (grouped[b].mastery || 0);
    });

    // Problem cards: take 3-5 with lowest EF
    const PROBLEM_TAKE = Math.min(5, Math.max(3, dueCards.length > 0 ? 5 : 0));
    if (PROBLEM_TAKE > 0) {
        sessionCards.push(...dueCards.slice(0, PROBLEM_TAKE));
    }
    // Take remaining due cards from weakest categories first
    sortedCategories.forEach(cat => {
        const catCards = grouped[cat].cards.filter(c => !c.isNew); // Due reviews
        sessionCards.push(...catCards);
    });

    // Remove duplicates if any logic added them (currently safe)

    // B. New Cards: Contextual Injection
    // Add new cards from "Active" categories (those being reviewed) to reinforce context
    // Limit new cards per day

    // Determine limits based on user's daily study time preference
    // Default: 60 minutes → ~15-20 new cards + reviews
    // Formula: ~1.5 min per card (average), +15% buffer
    const settings = (typeof window !== 'undefined' && window.appSettings) || { dailyStudyTime: 60 };
    const dailyMinutes = settings.dailyStudyTime || 60;
    const avgTimePerCard = 1.5; // minutes per card (average)
    const buffer = 1.15; // +15% buffer
    const totalCardsAllowed = Math.floor((dailyMinutes * buffer) / avgTimePerCard);

    // Calculate how many cards are reviews vs new
    const reviewCount = sessionCards.filter(c => !c.isNew).length;

    // New cards limit: remaining capacity after reviews
    let DAILY_NEW_LIMIT = Math.max(5, Math.min(30, totalCardsAllowed - reviewCount));

    // Max session: total capacity
    let MAX_SESSION = Math.max(15, Math.min(60, totalCardsAllowed));

    // Phase-based adjustments (for users without settings yet)
    const studiedCount = Object.values(progressMap).filter(p => (p.repetitionCount || p.repetitions || 0) > 0).length;
    if (studiedCount < 40 && dailyMinutes >= 60) {
        // Day 1 with 60+ min → allow up to 20 new
        DAILY_NEW_LIMIT = Math.min(DAILY_NEW_LIMIT, 20);
        MAX_SESSION = Math.max(MAX_SESSION, 25);
    } else if (studiedCount < 40 && dailyMinutes < 60) {
        // Day 1 with 30-45 min → gentle start
        DAILY_NEW_LIMIT = Math.min(DAILY_NEW_LIMIT, 12);
        MAX_SESSION = Math.max(MAX_SESSION, 15);
    }

    let addedNew = 0;
    sortedCategories.forEach(cat => {
        if (addedNew >= DAILY_NEW_LIMIT) return;
        const catNew = grouped[cat].cards.filter(c => c.isNew);
        const take = Math.min(catNew.length, Math.max(3, Math.min(8, DAILY_NEW_LIMIT - addedNew)));
        if (take > 0) {
            sessionCards.push(...catNew.slice(0, take));
            addedNew += take;
        }
    });
    if (addedNew < DAILY_NEW_LIMIT) {
        const remainingNew = newCards.filter(c => !sessionCards.includes(c));
        const needed = DAILY_NEW_LIMIT - addedNew;
        sessionCards.push(...remainingNew.slice(0, needed));
    }

    // 5. Apply Daily Load Limit (Adaptive)
    let result;
    if (sessionCards.length > MAX_SESSION) {
        const reviews = sessionCards.filter(c => !c.isNew);
        const news = sessionCards.filter(c => c.isNew);
        if (reviews.length >= MAX_SESSION) {
            result = ensureCategoryDiversity(reviews.slice(0, MAX_SESSION));
        } else {
            result = ensureCategoryDiversity([...reviews, ...news.slice(0, MAX_SESSION - reviews.length)]);
        }
    } else {
        result = ensureCategoryDiversity(sessionCards);
    }

    // Сохраняем в кэш
    sessionCache.date = todayStr;
    sessionCache.progressHash = progressHash;
    sessionCache.result = result;

    return result;
}

function groupByCategoryAndSubcategory(cards) {
    const groups = {};
    cards.forEach(c => {
        const cat = c.item.category || 'Uncategorized';
        if (!groups[cat]) {
            groups[cat] = { cards: [], mastery: 0, subcategories: {} };
        }
        groups[cat].cards.push(c);

        // Subcategory
        const sub = c.item.subcategory || 'General';
        if (!groups[cat].subcategories[sub]) {
            groups[cat].subcategories[sub] = [];
        }
        groups[cat].subcategories[sub].push(c);
    });
    return groups;
}

function calculateCategoryMastery(grouped, progressMap) {
    Object.keys(grouped).forEach(cat => {
        const cards = grouped[cat].cards;
        if (cards.length === 0) return;

        let totalScore = 0;
        let learnedCount = 0;

        cards.forEach(c => {
            if (!c.isNew && c.progress) {
                // Score based on interval
                // > 30 days = 1.0 mastery
                // < 30 days = interval / 30
                const interval = c.progress.interval || 0;
                totalScore += Math.min(1, interval / 30);
                learnedCount++;
            }
        });

        // Mastery is average score of LEARNED cards (or 0 if none)
        // Penalize for unlearned cards? Maybe slight penalty.
        // Let's keep it simple: Average of all cards in category (unlearned = 0)
        grouped[cat].mastery = totalScore / cards.length;
    });
}

function ensureCategoryDiversity(sessionCards) {
    // Shuffle but try to avoid same category back-to-back if possible?
    // Or just simple shuffle as the text says "Ensure diversity".
    // "Smart Shuffle"

    // Fisher-Yates shuffle first
    for (let i = sessionCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sessionCards[i], sessionCards[j]] = [sessionCards[j], sessionCards[i]];
    }

    return sessionCards;
}

/**
 * Возвращает разбивку ОСТАВШИХСЯ вопросов на сегодня (не размер сессии!)
 * Считаем все вопросы которые ещё не пройдены сегодня
 * @param {Array} allQuestions - Полный список вопросов
 * @returns {{ dueCount: number, newCount: number, totalCount: number }}
 */
export function getTodaysSessionBreakdown(allQuestions) {
    console.log('[getTodaysSessionBreakdown] === РАСЧЁТ ОСТАВШИХСЯ ВОПРОСОВ ===');
    console.log('[getTodaysSessionBreakdown] Всего вопросов в базе:', allQuestions.length);

    const today = new Date();
    const todayStr = today.getFullYear() + '-' +
        String(today.getMonth() + 1).padStart(2, '0') + '-' +
        String(today.getDate()).padStart(2, '0');

    const progressMap = getProgressMap();
    const now = Date.now();

    let dueCount = 0;
    let newCount = 0;
    let skippedToday = 0;

    allQuestions.forEach(q => {
        const progress = progressMap[q.question];
        if (progress) {
            // Пропускаем карточки, уже пройденные сегодня
            if (progress.lastReviewed === todayStr) {
                skippedToday++;
                return;
            }

            // Проверяем является ли карточка due (время пришло)
            let dueDate = progress.nextReviewDate;
            if (!dueDate && progress.dueDate) {
                dueDate = new Date(progress.dueDate).getTime();
            }

            if (!dueDate || dueDate <= now) {
                dueCount++;
            }
        } else {
            // Новая карточка (нет прогресса)
            newCount++;
        }
    });

    console.log('[getTodaysSessionBreakdown] Пропущено сегодня:', skippedToday);
    console.log('[getTodaysSessionBreakdown] Осталось повторений (due):', dueCount);
    console.log('[getTodaysSessionBreakdown] Осталось новых (new):', newCount);
    console.log('[getTodaysSessionBreakdown] Итого осталось:', dueCount + newCount);
    console.log('[getTodaysSessionBreakdown] =========================================');

    return { dueCount, newCount, totalCount: dueCount + newCount };
}
