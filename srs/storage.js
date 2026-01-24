const STORAGE_KEY = 'srsProgress';

function getUserId() {
    try {
        const raw = localStorage.getItem('qaSessionUser') || '';
        if (raw) {
            const u = JSON.parse(raw);
            if (u && (u.id || u.email || u.username)) return u.id || u.email || u.username;
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

export async function hydrateLocalFromSupabase() {
    const client = window.__supabaseClient;
    const userId = getUserId();
    if (!client || !userId) return false;
    try {
        const { data: ds } = await client.from('daily_stats').select('date,xp,bonus,day_bonus').eq('user_id', userId).order('date', { ascending: true });
        const dailyPoints = {};
        const dailyBonusPoints = {};
        const dailyDayBonusPoints = {};
        let totalXp = 0;
        let currentStreak = 0;
        let bestStreak = 0;
        let lastDateWithStudy = null;
        (ds || []).forEach(row => {
            const d = row.date;
            dailyPoints[d] = row.xp || 0;
            dailyBonusPoints[d] = row.bonus || 0;
            dailyDayBonusPoints[d] = row.day_bonus || 0;
            totalXp += row.xp || 0;
            if ((row.xp || 0) > 0) {
                currentStreak += 1;
                if (currentStreak > bestStreak) bestStreak = currentStreak;
                lastDateWithStudy = d;
            } else {
                currentStreak = 0;
            }
        });
        localStorage.setItem('dailyPoints', JSON.stringify(dailyPoints));
        localStorage.setItem('dailyBonusPoints', JSON.stringify(dailyBonusPoints));
        localStorage.setItem('dailyDayBonusPoints', JSON.stringify(dailyDayBonusPoints));
        const studyStatsRaw = localStorage.getItem('studyStats') || '{}';
        let studyStats = {};
        try { studyStats = JSON.parse(studyStatsRaw); } catch { studyStats = {}; }
        studyStats.points = totalXp;
        localStorage.setItem('studyStats', JSON.stringify(studyStats));
        const streak = { current: currentStreak, best: bestStreak, lastDate: lastDateWithStudy };
        localStorage.setItem('studyStreak', JSON.stringify(streak));
        
        // Favorites sync with error handling to prevent data wipe
        const { data: favs, error: favError } = await client.from('favorites').select('question').eq('user_id', userId);
        if (!favError && favs) {
            const favList = favs.map(x => x.question);
            localStorage.setItem('qaFavorites', JSON.stringify(favList));
            window.dispatchEvent(new Event('favoritesUpdated'));
        } else if (favError) {
            console.warn('Failed to fetch favorites from Supabase, keeping local data:', favError);
        }
    } catch (e) {
        console.error('Error in hydrateLocalFromSupabase:', e);
    }
    try {
        const { data: cp } = await client.from('card_progress').select('question,due_date,interval,repetitions,ease_factor,last_reviewed,last_reviewed_time').eq('user_id', userId);
        const map = {};
        (cp || []).forEach(row => {
            map[row.question] = {
                question: row.question,
                dueDate: row.due_date,
                interval: row.interval,
                repetitions: row.repetitions,
                easeFactor: row.ease_factor,
                lastReviewed: row.last_reviewed || null,
                lastReviewedTime: row.last_reviewed_time || null
            };
        });
        localStorage.setItem('srsProgress', JSON.stringify(map));
    } catch {}
    try { const evt = new Event('xpUpdated'); window.dispatchEvent(evt); } catch {}
    return true;
}

export async function syncFavorite(question, isFav) {
    const client = window.__supabaseClient;
    const user_id = getUserId();
    if (!client || !user_id) {
        console.warn('Cannot sync favorite: no client or user_id');
        return;
    }
    try {
        if (isFav) {
            const { error } = await client.from('favorites').upsert({ user_id, question }, { onConflict: 'user_id,question' });
            if (error) console.error('Error syncing favorite (add):', error);
        } else {
            const { error } = await client.from('favorites').delete().eq('user_id', user_id).eq('question', question);
            if (error) console.error('Error syncing favorite (remove):', error);
        }
    } catch (e) {
        console.error('Exception syncing favorite:', e);
    }
}

/**
 * Retrieves the full progress map from local storage.
 * @returns {Object.<string, import('./algorithm.js').ProgressRecord>}
 */
export function getProgressMap() {
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
