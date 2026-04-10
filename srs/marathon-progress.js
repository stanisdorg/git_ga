// Marathon progress storage and sync
const MARATHON_STORAGE_KEY = 'marathonProgress';

// Get marathon progress from localStorage
export function getMarathonProgress() {
    try {
        const raw = localStorage.getItem(MARATHON_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        console.error('[Marathon] Failed to parse progress:', e);
        return null;
    }
}

// Save marathon progress to localStorage and sync with server
export function saveMarathonProgress(progress) {
    try {
        progress.lastUpdated = Date.now();
        localStorage.setItem(MARATHON_STORAGE_KEY, JSON.stringify(progress));

        // Sync with server if user is logged in
        if (typeof window !== 'undefined' && window.currentUsername) {
            syncMarathonProgressToServer(progress);
        }
    } catch (e) {
        console.error('[Marathon] Failed to save progress:', e);
    }
}

// Clear marathon progress from localStorage and server
export function clearMarathonProgress() {
    try {
        localStorage.removeItem(MARATHON_STORAGE_KEY);

        // Clear on server if user is logged in
        if (typeof window !== 'undefined' && window.currentUsername) {
            clearMarathonProgressOnServer();
        }
    } catch (e) {
        console.error('[Marathon] Failed to clear progress:', e);
    }
}

// Check if there's an active marathon session
export function hasActiveMarathon() {
    const progress = getMarathonProgress();
    return progress && progress.sessionId && progress.currentIndex < progress.totalCards;
}

// Create new marathon session
export function createMarathonSession(totalCards, questions = []) {
    const progress = {
        sessionId: `marathon_${Date.now()}`,
        totalCards: totalCards,
        currentIndex: 0,
        completedCards: [],
        questions: questions, // Store questions for recovery
        startedAt: Date.now(),
        lastUpdated: Date.now()
    };
    saveMarathonProgress(progress);
    return progress;
}

// Update progress after rating a card
export function updateMarathonProgress(cardIndex, question, grade) {
    const progress = getMarathonProgress();
    if (!progress) return;

    progress.currentIndex = cardIndex + 1;
    progress.completedCards.push({
        question: question,
        grade: grade,
        timestamp: Date.now()
    });

    saveMarathonProgress(progress);
}

// Load marathon progress from server and merge with local
export async function loadMarathonProgressFromServer() {
    if (!window.currentUsername) return null;

    try {
        const response = await fetch(`/api/marathon-progress?username=${encodeURIComponent(window.currentUsername)}`);
        if (!response.ok) return null;

        const data = await response.json();
        if (data.ok && data.progress) {
            const serverProgress = data.progress;
            const localProgress = getMarathonProgress();

            // Если есть и локальный и серверный — берём более новый
            if (localProgress && localProgress.lastUpdated) {
                if (serverProgress.lastUpdated && serverProgress.lastUpdated > localProgress.lastUpdated) {
                    localStorage.setItem(MARATHON_STORAGE_KEY, JSON.stringify(serverProgress));
                    console.log('[Marathon] Loaded newer server progress');
                    return serverProgress;
                } else {
                    // Локальный новее — отправим на сервер
                    syncMarathonProgressToServer(localProgress);
                    console.log('[Marathon] Local progress is newer, synced to server');
                    return localProgress;
                }
            } else {
                localStorage.setItem(MARATHON_STORAGE_KEY, JSON.stringify(serverProgress));
                console.log('[Marathon] Loaded server progress');
                return serverProgress;
            }
        }
        return null;
    } catch (e) {
        console.error('[Marathon] Failed to load from server:', e);
        return null;
    }
}

// Загружаем марафон с сервера при загрузке модуля
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            loadMarathonProgressFromServer();
        }, 2000); // Ждём 2 секунды чтобы currentUsername был установлен
    });
}

// Sync marathon progress to server
async function syncMarathonProgressToServer(progress) {
    if (!window.currentUsername) return;

    try {
        const response = await fetch(`/api/marathon-progress?username=${encodeURIComponent(window.currentUsername)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ progress })
        });

        if (!response.ok) {
            console.warn('[Marathon] Server sync failed:', response.status);
        }
    } catch (e) {
        console.error('[Marathon] Sync error:', e);
    }
}

// Clear marathon progress on server
async function clearMarathonProgressOnServer() {
    if (!window.currentUsername) return;

    try {
        const response = await fetch(`/api/marathon-progress?username=${encodeURIComponent(window.currentUsername)}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            console.warn('[Marathon] Server clear failed:', response.status);
        }
    } catch (e) {
        console.error('[Marathon] Clear error:', e);
    }
}
