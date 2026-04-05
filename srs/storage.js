import { invalidateSessionCache } from './category-scheduler.js';

const STORAGE_KEY = 'srsProgress';

function getUserId() {
    try {
        const raw = localStorage.getItem('qaSessionUser') || '';
        if (raw) {
            const u = JSON.parse(raw);
            if (u && (u.id || u.email || u.username)) return u.id || u.email || u.username;
        }
    } catch { }
    let id = localStorage.getItem('deviceId');
    if (!id) {
        id = 'device_' + Math.random().toString(36).slice(2);
        localStorage.setItem('deviceId', id);
    }
    return id;
}

let syncDebounceTimer = null;

// Отслеживаем последние отправленные данные для增量ной синхронизации
let lastSyncedData = null;

export async function syncWithServer() {
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);

    // Only sync if we have a logged-in user (not guest)
    const sessionUserRaw = localStorage.getItem('qaSessionUser');
    let username = null;
    try {
        const u = JSON.parse(sessionUserRaw);
        if (u && u.username) username = u.username;
    } catch { }

    if (!username) return; // Guest -> do not sync

    syncDebounceTimer = setTimeout(async () => {
        // Collect all data
        let data;
        try {
            data = {
                _cards: JSON.parse(localStorage.getItem('qaUserCards') || '[]'),
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
        } catch (e) {
            console.error('[syncWithServer] Ошибка чтения данных:', e);
            return;
        }

        try {
            // Пробуем отправить на сервер, но не показываем ошибку если API недоступен
            window.dispatchEvent(new Event('sync-start'));

            // Валидируем JSON перед отправкой
            const body = JSON.stringify(data);

            // Дополнительная валидация: пробуем распарсить обратно чтобы убедиться что JSON валидный
            try {
                JSON.parse(body);
            } catch (validateError) {
                console.error('[syncWithServer] Сгенерированный JSON невалидный:', validateError.message);
                console.error('[syncWithServer] Размер body:', body.length);
                console.error('[syncWithServer] Первые 200 символов:', body.substring(0, 200));
                return;
            }

            // Проверка на слишком большой payload
            if (body.length > 5 * 1024 * 1024) { // 5MB
                console.warn('[syncWithServer] Payload слишком большой:', body.length, 'байт');
                return;
            }

            console.log('[syncWithServer] Отправка данных на сервер, размер:', body.length, 'байт');

            // Используем сжатие для больших данных (>30KB)
            const COMPRESS_THRESHOLD = 30 * 1024; // 30KB
            let res;

            if (body.length > COMPRESS_THRESHOLD && typeof CompressionStream !== 'undefined') {
                // Сжимаем данные используя браузерный CompressionStream API
                console.log('[syncWithServer] Применяем сжатие...');
                try {
                    const compressedBase64 = await compressData(body);
                    console.log('[syncWithServer] Сжатый размер (base64):', compressedBase64.length, 'байт');

                    // Отправляем сжатые данные как JSON объект
                    const compressedPayload = JSON.stringify({
                        _compressed: true,
                        data: compressedBase64
                    });

                    console.log('[syncWithServer] Размер payload с обёрткой:', compressedPayload.length, 'байт');

                    res = await fetch(`/api/progress?username=${encodeURIComponent(username)}&compressed=true`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: compressedPayload,
                        signal: AbortSignal.timeout(5000)
                    });

                    // Если сервер не поддерживает сжатие (400 error), пробуем отправить без сжатия
                    if (!res.ok && res.status === 400) {
                        console.warn('[syncWithServer] Сервер не поддерживает сжатие, отправляем без сжатия');
                        res = await fetch(`/api/progress?username=${encodeURIComponent(username)}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: body,
                            signal: AbortSignal.timeout(5000)
                        });
                    }
                } catch (compressError) {
                    console.error('[syncWithServer] Ошибка сжатия:', compressError);
                    // Fallback: отправляем без сжатия
                    res = await fetch(`/api/progress?username=${encodeURIComponent(username)}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: body,
                        signal: AbortSignal.timeout(5000)
                    });
                }
            } else {
                // Данные маленькие или нет поддержки сжатия
                res = await fetch(`/api/progress?username=${encodeURIComponent(username)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: body,
                    signal: AbortSignal.timeout(5000)
                });
            }
        } catch (e) {
            console.error('[syncWithServer] Ошибка синхронизации:', e);
            localStorage.setItem('localDataTimestamp', Date.now());
        }
    }, 1000);
}

// Функция для сжатия данных используя CompressionStream API
async function compressData(data) {
    const encoder = new TextEncoder();
    const input = encoder.encode(data);

    // Используем CompressionStream API (поддерживается в современных браузерах)
    const cs = new CompressionStream('deflate');
    const writer = cs.writable.getWriter();
    writer.write(input);
    writer.close();

    const reader = cs.readable.getReader();
    const chunks = [];

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }

    // Объединяем все chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const compressed = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        compressed.set(chunk, offset);
        offset += chunk.length;
    }

    // Конвертируем в base64 для передачи как JSON
    return btoa(String.fromCharCode(...compressed));
}

export async function loadFromServer(forceReload = false) {
    // Only load if we have a logged-in user
    const sessionUserRaw = localStorage.getItem('qaSessionUser');
    let username = null;
    try {
        const u = JSON.parse(sessionUserRaw);
        if (u && u.username) username = u.username;
    } catch { }

    if (!username) {
        window.dispatchEvent(new Event('dataLoaded'));
        return;
    }

    try {
        const url = `/api/progress?username=${encodeURIComponent(username)}`;
        const res = await fetch(url);

        if (!res || !res.ok) {
            window.dispatchEvent(new Event('dataLoaded'));
            return;
        }

        const data = await res.json();

        if (!data || Object.keys(data).length === 0) {
            window.dispatchEvent(new Event('dataLoaded'));
            return;
        }

        // Check if server data is newer than local last sync
        const localTS = parseInt(localStorage.getItem('localDataTimestamp') || '0');
        const serverTS = data.updatedAt || 0;

        if (forceReload) {
        } else {
            if (serverTS && serverTS <= localTS) {
                window.dispatchEvent(new Event('dataLoaded'));
                return;
            }
        }
        if (data.updatedAt) localStorage.setItem('localDataTimestamp', data.updatedAt);

        // Restore keys
        if (data._cards && data._cards.length > 0) {
            localStorage.setItem('qaUserCards', JSON.stringify(data._cards));

            try {
                const { setUniqueQaData } = await import('../all-data.js');
                if (typeof setUniqueQaData === 'function') {
                    setUniqueQaData(data._cards);
                }
            } catch (e) {
                console.warn('[loadFromServer] Не удалось обновить uniqueQaData:', e.message);
            }
        }
        if (data.srsProgress) localStorage.setItem('srsProgress', JSON.stringify(data.srsProgress));
        if (data.studyStats) localStorage.setItem('studyStats', JSON.stringify(data.studyStats));
        if (data.studyStreak) localStorage.setItem('studyStreak', JSON.stringify(data.studyStreak));
        if (data.dailyPoints) localStorage.setItem('dailyPoints', JSON.stringify(data.dailyPoints));
        if (data.dailyBonusPoints) localStorage.setItem('dailyBonusPoints', JSON.stringify(data.dailyBonusPoints));
        if (data.dailyDayBonusPoints) localStorage.setItem('dailyDayBonusPoints', JSON.stringify(data.dailyDayBonusPoints));
        if (data.qaFavorites) {
            localStorage.setItem('qaFavorites', JSON.stringify(data.qaFavorites));
        }
        if (data.studyAchievements) localStorage.setItem('studyAchievements', JSON.stringify(data.studyAchievements));

        // 🔒 Сохраняем корзину
        if (data.userTrash) {
            localStorage.setItem('qaUserTrash', JSON.stringify(data.userTrash));
        }

        // Dispatch events to update UI
        window.dispatchEvent(new Event('xpUpdated'));
        window.dispatchEvent(new Event('favoritesUpdated'));
        window.dispatchEvent(new Event('dataLoaded'));
        window.dispatchEvent(new Event('qaDataLoadedFromServer'));

        // 🔒 Обновляем корзину ПОСЛЕ сохранения в localStorage
        setTimeout(() => {
            if (typeof refreshServerTrash === 'function') {
                refreshServerTrash();
            }
        }, 100);

    } catch (e) {
        console.error('[loadFromServer] Ошибка загрузки:', e.message);
        window.dispatchEvent(new Event('dataLoaded'));
    }
}

export const hydrateLocalFromSupabase = loadFromServer;

export async function syncCardProgress(question, progress) {
    syncWithServer(); // Sync with local server
}

export async function syncDailyStats(date, xp, bonus, dayBonus, streak) {
    syncWithServer(); // Sync with local server
}

export async function syncFavorite(question, isFav) {
    const sessionUserRaw = localStorage.getItem('qaSessionUser');
    let username = null;
    try {
        const u = JSON.parse(sessionUserRaw);
        if (u && u.username) username = u.username;
    } catch { }

    if (!username) {
        return;
    }

    const favorites = new Set(JSON.parse(localStorage.getItem('qaFavorites') || '[]'));
    if (isFav) {
        favorites.add(question);
    } else {
        favorites.delete(question);
    }
    const favArray = Array.from(favorites);
    localStorage.setItem('qaFavorites', JSON.stringify(favArray));

    try {
        const url = `/api/favorites?username=${encodeURIComponent(username)}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(favArray)
        });

        if (!res.ok) {
            console.warn('[syncFavorite] Сервер вернул ошибку:', res.status);
        }
    } catch (e) {
        console.error('[syncFavorite] Ошибка отправки на сервер:', e);
    }

    window.dispatchEvent(new Event('favoritesUpdated'));
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
    // Сбрасываем кэш сессии при изменении прогресса
    try {
        invalidateSessionCache();
    } catch (e) {
        // Игнорируем ошибки при импорте
    }
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
