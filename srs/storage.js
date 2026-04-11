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
        console.log('[syncWithServer] === НАЧАЛО СИНХРОНИЗАЦИИ ===');

        // Collect all data
        let data;
        try {
            // 🔥 Собираем карточки из ВСЕХ источников: base + newItems - deleted + overrides
            const baseCards = JSON.parse(localStorage.getItem('qaUserCards') || '[]');
            const newItems = JSON.parse(localStorage.getItem('qaNewItems') || '[]');
            const deletedMap = JSON.parse(localStorage.getItem('qaDeletedItems') || '{}');
            const overrides = JSON.parse(localStorage.getItem('qaAdminOverrides') || '{}');
            const trashCats = JSON.parse(localStorage.getItem('qaTrashCategories') || '{}');

            // Создаём Map из базовых карточек
            const cardsMap = new Map();
            baseCards.forEach(card => {
                if (!deletedMap[card.question] && !trashCats[card.category]) {
                    cardsMap.set(card.question, { ...card });
                }
            });

            // Применяем overrides
            Object.entries(overrides).forEach(([origQ, ov]) => {
                if (cardsMap.has(origQ)) {
                    const card = cardsMap.get(origQ);
                    Object.assign(card, ov);
                    // Если вопрос изменился — обновляем ключ
                    if (ov.question && ov.question !== origQ) {
                        cardsMap.delete(origQ);
                        cardsMap.set(ov.question, card);
                    }
                } else {
                    // Новый вопрос через override
                    cardsMap.set(ov.question || origQ, {
                        question: ov.question || origQ,
                        answer: ov.answer || '',
                        category: ov.category || 'Без категории',
                        subcategory: ov.subcategory || 'Общее',
                        ...ov
                    });
                }
            });

            // Добавляем newItems (дубликаты, созданные пользователем)
            newItems.forEach(ni => {
                if (!deletedMap[ni.question] && !trashCats[ni.category] && !cardsMap.has(ni.question)) {
                    cardsMap.set(ni.question, { ...ni });
                }
            });

            const mergedCards = Array.from(cardsMap.values());

            data = {
                _cards: mergedCards,
                srsProgress: JSON.parse(localStorage.getItem('srsProgress') || '{}'),
                studyStats: JSON.parse(localStorage.getItem('studyStats') || '{}'),
                studyStreak: JSON.parse(localStorage.getItem('studyStreak') || '{}'),
                dailyPoints: JSON.parse(localStorage.getItem('dailyPoints') || '{}'),
                dailyBonusPoints: JSON.parse(localStorage.getItem('dailyBonusPoints') || '{}'),
                dailyDayBonusPoints: JSON.parse(localStorage.getItem('dailyDayBonusPoints') || '{}'),
                qaFavorites: JSON.parse(localStorage.getItem('qaFavorites') || '[]'),
                studyAchievements: JSON.parse(localStorage.getItem('studyAchievements') || '{}'),
                // 🔥 Синхронизация плейсхолдеров категорий и подкатегорий
                qaCategoryPlaceholders: JSON.parse(localStorage.getItem('qaCategoryPlaceholders') || '{}'),
                qaSubcategoryPlaceholders: JSON.parse(localStorage.getItem('qaSubcategoryPlaceholders') || '{}'),
                // qaNewItems отправляем для обратной совместимости
                qaNewItems: [], // Очищаем, т.к. все уже в _cards
                updatedAt: Date.now()
            };
            console.log('[syncWithServer] Данные собраны:', {
                cardsCount: data._cards.length,
                srsProgressKeys: Object.keys(data.srsProgress).length,
                updatedAt: data.updatedAt
            });
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
            console.log('[syncWithServer] Username:', username);
            console.log('[syncWithServer] URL:', `/api/progress?username=${encodeURIComponent(username)}`);

            // Отправляем данные без сжатия (сжатие пока отключено)
            console.log('[syncWithServer] Отправка POST запроса...');
            const res = await fetch(`/api/progress?username=${encodeURIComponent(username)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: body,
                signal: AbortSignal.timeout(5000)
            });

            console.log('[syncWithServer] Получен ответ:', { status: res.status, ok: res.ok });

            // Обрабатываем результат запроса
            if (res && res.ok) {
                console.log('[syncWithServer] ✅ Синхронизация успешна!');
                localStorage.setItem('localDataTimestamp', data.updatedAt);
                lastSyncedData = JSON.parse(JSON.stringify(data)); // Глубокая копия
                window.dispatchEvent(new Event('sync-success'));
            } else if (res) {
                const errorText = await res.text().catch(() => 'неизвестная ошибка');
                console.error('[syncWithServer] ❌ Ошибка сервера:', res.status, errorText);
                console.error('[syncWithServer] Response body:', errorText);
                localStorage.setItem('localDataTimestamp', data.updatedAt);
                window.dispatchEvent(new Event('sync-error'));
            } else {
                console.error('[syncWithServer] ❌ Ответ от сервера не получен (res is null/undefined)');
                window.dispatchEvent(new Event('sync-error'));
            }
        } catch (e) {
            console.error('[syncWithServer] ❌ Исключение при синхронизации:', e);
            console.error('[syncWithServer] Stack:', e.stack);
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

        // 🔥 ВАЖНО: Не перезаписываем qaUserCards если локальные данные новее или содержат удаления
        const localCards = JSON.parse(localStorage.getItem('qaUserCards') || '[]');
        const localCardsCount = Array.isArray(localCards) ? localCards.length : 0;
        const serverCardsCount = Array.isArray(data._cards) ? data._cards.length : 0;

        // Проверяем есть ли локально категории которых нет на сервере (новые дубликаты)
        const localCatNames = new Set(localCards.map(c => c.category));
        const serverCatNames = new Set((data._cards || []).map(c => c.category));
        const hasLocalOnlyCats = [...localCatNames].some(cat => !serverCatNames.has(cat));
        // Проверяем есть ли на сервере категории которых нет локально (локальные удаления)
        const hasServerOnlyCats = [...serverCatNames].some(cat => !localCatNames.has(cat));

        if (hasLocalOnlyCats) {
            // Локально есть новые категории (дубликаты) — не перезаписываем
            console.log(`[loadFromServer] Пропускаем перезапись: есть локальные категории которых нет на сервере`);
        } else if (localCardsCount > 0 && serverCardsCount > 0 && localCardsCount < serverCardsCount && !hasServerOnlyCats) {
            // Локально меньше карточек, но все категории совпадают — значит локально что-то удалено, не перезаписываем
            console.log(`[loadFromServer] Пропускаем перезапись: локальные удаления (${localCardsCount} < ${serverCardsCount})`);
        } else if (localCardsCount >= serverCardsCount && localCardsCount > 0) {
            console.log(`[loadFromServer] Пропускаем перезапись qaUserCards: локальных=${localCardsCount}, серверных=${serverCardsCount}`);
        } else {
            // Серверные данные новее или локально пусто — загружаем
            if (data._cards && data._cards.length > 0) {
                localStorage.setItem('qaUserCards', JSON.stringify(data._cards));
                console.log(`[loadFromServer] Загружаем qaUserCards с сервера: ${data._cards.length} карточек`);

                try {
                    const { setUniqueQaData } = await import('../all-data.js');
                    if (typeof setUniqueQaData === 'function') {
                        setUniqueQaData(data._cards);
                    }
                } catch (e) {
                    console.warn('[loadFromServer] Не удалось обновить uniqueQaData:', e.message);
                }
            }
        }

        // ОБЪЕДИНЯЕМ srsProgress (не перезаписываем!)
        if (data.srsProgress) {
            try {
                const localProgress = JSON.parse(localStorage.getItem('srsProgress') || '{}');
                const serverProgress = data.srsProgress;

                // Объединяем: для каждой карточки берём более новую версию
                const merged = { ...serverProgress };
                Object.entries(localProgress).forEach(([question, localData]) => {
                    const serverData = serverProgress[question];

                    // Если нет на сервере — берём локальную
                    if (!serverData) {
                        merged[question] = localData;
                        return;
                    }

                    // Если есть и там и там — берём с более свежим lastReviewedDate или большей history
                    const localHistoryLen = Array.isArray(localData.historyArray) ? localData.historyArray.length : 0;
                    const serverHistoryLen = Array.isArray(serverData.historyArray) ? serverData.historyArray.length : 0;

                    if (localHistoryLen > serverHistoryLen) {
                        merged[question] = localData; // Локальная новее
                    } else if (serverHistoryLen > localHistoryLen) {
                        merged[question] = serverData; // Серверная новее
                    } else {
                        // Одинаковая длина истории — берём с более поздним lastReviewDate
                        const localDate = localData.lastReviewDate || 0;
                        const serverDate = serverData.lastReviewDate || 0;
                        merged[question] = localDate >= serverDate ? localData : serverData;
                    }
                });

                localStorage.setItem('srsProgress', JSON.stringify(merged));
                console.log('[loadFromServer] srsProgress объединён:', Object.keys(merged).length, 'карточек');
            } catch (e) {
                console.warn('[loadFromServer] Ошибка объединения srsProgress:', e);
                // Fallback: просто сохраняем серверные данные
                localStorage.setItem('srsProgress', JSON.stringify(data.srsProgress));
            }
        }
        if (data.studyStats) localStorage.setItem('studyStats', JSON.stringify(data.studyStats));
        if (data.studyStreak) localStorage.setItem('studyStreak', JSON.stringify(data.studyStreak));
        if (data.dailyPoints) {
            // ОБЪЕДИНЯЕМ dailyPoints (суммируем значения)
            try {
                const localDP = JSON.parse(localStorage.getItem('dailyPoints') || '{}');
                const serverDP = data.dailyPoints;

                const merged = { ...serverDP };
                Object.entries(localDP).forEach(([date, value]) => {
                    merged[date] = (merged[date] || 0) + value;
                });

                localStorage.setItem('dailyPoints', JSON.stringify(merged));
            } catch (e) {
                console.warn('[loadFromServer] Ошибка объединения dailyPoints:', e);
                localStorage.setItem('dailyPoints', JSON.stringify(data.dailyPoints));
            }
        }
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

        // 🔥 Загружаем плейсхолдеры категорий и подкатегорий
        if (data.qaCategoryPlaceholders) {
            localStorage.setItem('qaCategoryPlaceholders', JSON.stringify(data.qaCategoryPlaceholders));
            console.log('[loadFromServer] qaCategoryPlaceholders загружены:', Object.keys(data.qaCategoryPlaceholders).length, 'категорий');
        }
        if (data.qaSubcategoryPlaceholders) {
            localStorage.setItem('qaSubcategoryPlaceholders', JSON.stringify(data.qaSubcategoryPlaceholders));
            console.log('[loadFromServer] qaSubcategoryPlaceholders загружены');
        }
        if (data.qaNewItems) {
            localStorage.setItem('qaNewItems', JSON.stringify(data.qaNewItems));
            console.log('[loadFromServer] qaNewItems загружены:', data.qaNewItems.length, 'новых карточек');
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
