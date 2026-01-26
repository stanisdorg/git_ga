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

let syncDebounceTimer = null;

export async function syncWithServer() {
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);

    syncDebounceTimer = setTimeout(async () => {
        // Collect all data
        const data = {
            srsProgress: JSON.parse(localStorage.getItem('srsProgress') || '{}'),
            studyStats: JSON.parse(localStorage.getItem('studyStats') || '{}'),
            studyStreak: JSON.parse(localStorage.getItem('studyStreak') || '{}'),
            dailyPoints: JSON.parse(localStorage.getItem('dailyPoints') || '{}'),
            dailyBonusPoints: JSON.parse(localStorage.getItem('dailyBonusPoints') || '{}'),
            dailyDayBonusPoints: JSON.parse(localStorage.getItem('dailyDayBonusPoints') || '{}'),
            qaFavorites: JSON.parse(localStorage.getItem('qaFavorites') || '[]'),
            studyAchievements: JSON.parse(localStorage.getItem('studyAchievements') || '{}'),
            updatedAt: Date.now()
        };

        try {
            window.dispatchEvent(new Event('sync-start'));
            const res = await fetch('/api/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                console.error('Failed to sync with server');
                window.dispatchEvent(new Event('sync-error'));
            } else {
                localStorage.setItem('localDataTimestamp', data.updatedAt);
                window.dispatchEvent(new Event('sync-success'));
            }
        } catch (e) {
            console.error('Error syncing with server:', e);
            window.dispatchEvent(new Event('sync-error'));
        }
    }, 1000);
}

export async function loadFromServer() {
    try {
        const res = await fetch('/api/progress');
        if (!res.ok) return;
        const data = await res.json();
        
        if (!data || Object.keys(data).length === 0) return;

        // Check if server data is newer than local last sync
        const localTS = parseInt(localStorage.getItem('localDataTimestamp') || '0');
        if (data.updatedAt && data.updatedAt <= localTS) {
            // Local data is fresher or equal, do not overwrite
            return;
        }
        if (data.updatedAt) localStorage.setItem('localDataTimestamp', data.updatedAt);

        // Restore keys
        if (data.srsProgress) localStorage.setItem('srsProgress', JSON.stringify(data.srsProgress));
        if (data.studyStats) localStorage.setItem('studyStats', JSON.stringify(data.studyStats));
        if (data.studyStreak) localStorage.setItem('studyStreak', JSON.stringify(data.studyStreak));
        if (data.dailyPoints) localStorage.setItem('dailyPoints', JSON.stringify(data.dailyPoints));
        if (data.dailyBonusPoints) localStorage.setItem('dailyBonusPoints', JSON.stringify(data.dailyBonusPoints));
        if (data.dailyDayBonusPoints) localStorage.setItem('dailyDayBonusPoints', JSON.stringify(data.dailyDayBonusPoints));
        if (data.qaFavorites) localStorage.setItem('qaFavorites', JSON.stringify(data.qaFavorites));
        if (data.studyAchievements) localStorage.setItem('studyAchievements', JSON.stringify(data.studyAchievements));

        // Dispatch events to update UI
        window.dispatchEvent(new Event('xpUpdated'));
        window.dispatchEvent(new Event('favoritesUpdated'));
    } catch (e) {
        console.error('Error loading from server:', e);
    }
}

export async function syncCardProgress(question, progress) {
    syncWithServer(); // Sync with local server
}

export async function syncDailyStats(date, xp, bonus, dayBonus, streak) {
    syncWithServer(); // Sync with local server
}

export async function syncFavorite(question, isFav) {
    syncWithServer(); // Sync with local server
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
