const STORAGE_KEY = 'srsProgress';

function getUserId() {
    try {
        const raw = localStorage.getItem('qaSessionUser') || '';
        if (raw) {
            const u = JSON.parse(raw);
            if (u && (u.id || u.email)) return u.id || u.email;
        }
    } catch {}
    let id = localStorage.getItem('deviceId');
    if (!id) {
        id = 'device_' + Math.random().toString(36).slice(2);
        localStorage.setItem('deviceId', id);
    }
    return id;
}

function enqueueSupabase(table, data) {
    try {
        const raw = localStorage.getItem('supabaseQueue') || '[]';
        const arr = JSON.parse(raw);
        arr.push({ table, data });
        localStorage.setItem('supabaseQueue', JSON.stringify(arr));
    } catch {}
}

export async function syncCardProgress(question, progress) {
    const client = window.__supabaseClient;
    const payload = {
        user_id: getUserId(),
        question,
        due_date: progress.dueDate,
        interval: progress.interval,
        repetitions: progress.repetitions,
        ease_factor: progress.easeFactor,
        last_reviewed: progress.lastReviewed || null,
        last_reviewed_time: progress.lastReviewedTime || null
    };
    if (!client) {
        enqueueSupabase('card_progress', payload);
        return;
    }
    try {
        const { error } = await client.from('card_progress').upsert(payload, { onConflict: 'user_id,question' });
        if (error) enqueueSupabase('card_progress', payload);
    } catch {
        enqueueSupabase('card_progress', payload);
    }
}

export async function syncDailyStats(date, xp, bonus, dayBonus, streak) {
    const client = window.__supabaseClient;
    const payload = {
        user_id: getUserId(),
        date,
        xp,
        bonus,
        day_bonus: dayBonus,
        streak
    };
    if (!client) {
        enqueueSupabase('daily_stats', payload);
        return;
    }
    try {
        const { error } = await client.from('daily_stats').upsert(payload, { onConflict: 'user_id,date' });
        if (error) enqueueSupabase('daily_stats', payload);
    } catch {
        enqueueSupabase('daily_stats', payload);
    }
}

/**
 * Retrieves the full progress map from local storage.
 * @returns {Object.<string, import('./algorithm.js').ProgressRecord>}
 */
function getProgressMap() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        console.error('Failed to parse SRS progress', e);
        return {};
    }
}

/**
 * Saves the progress map to local storage.
 * @param {Object} map 
 */
function saveProgressMap(map) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/**
 * Gets progress for a specific card (question text as ID).
 * @param {string} question 
 * @returns {import('./algorithm.js').ProgressRecord | null}
 */
export function getCardProgress(question) {
    const map = getProgressMap();
    return map[question] || null;
}

/**
 * Updates progress for a card.
 * @param {string} question 
 * @param {import('./algorithm.js').ProgressRecord} progress 
 */
export function updateCardProgress(question, progress) {
    const map = getProgressMap();
    map[question] = { ...progress, question };
    saveProgressMap(map);
    syncCardProgress(question, progress);
}

/**
 * Returns a list of questions that are due for review.
 * @param {Array<{question: string}>} candidateQuestions - List of questions to check (from current filter)
 * @returns {Array<{question: string, progress: import('./algorithm.js').ProgressRecord | null}>}
 */
export function getDueCards(candidateQuestions) {
    const map = getProgressMap();
    const now = new Date();
    
    return candidateQuestions.map(item => {
        const progress = map[item.question];
        if (!progress) {
            // New card
            return { question: item.question, item, progress: null, isNew: true };
        }
        
        const dueDate = new Date(progress.dueDate);
        if (dueDate <= now) {
            // Due card
            return { question: item.question, item, progress, isNew: false };
        }
        
        return null; // Not due
    }).filter(Boolean);
}
