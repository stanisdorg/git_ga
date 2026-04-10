import { calculateNextReview, canUseEasy } from './algorithm.js';
import { updateCardProgress, syncDailyStats } from './storage.js';

// Вспомогательные функции для получения локального времени устройства
function getLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getLocalHours(date) {
    return date.getHours();
}

/**
 * Manages the learning session state.
 */
export class LearningSession {
    /**
     * @param {Array<{item: Object, progress: Object, isNew: boolean}>} dueCards 
     * @param {Function} onUpdateUI - Callback to render UI
     * @param {Function} onComplete - Callback when session ends
     * @param {Object} options - Session options (mode, etc.)
     */
    constructor(dueCards, onUpdateUI, onComplete, options = {}) {
        this.queue = this.shuffle(dueCards);
        this.currentIndex = 0;
        this.currentCard = null;
        this.isFlipped = false;
        this.onUpdateUI = onUpdateUI;
        this.onComplete = onComplete;
        this.options = options;
        this.mode = options.mode || 'standard';
        this.modeTimer = null;

        this.stats = {
            total: this.queue.length,
            reviewed: 0,
            again: 0,
            hard: 0,
            good: 0,
            easy: 0,
            pointsEarned: 0
        };
        const sRaw = localStorage.getItem('studyStats') || '{}';
        const sObj = (() => { try { return JSON.parse(sRaw); } catch { return {}; } })();
        this.startXP = sObj.points || 0;
        this.results = []; // per-card grades

        // Smart Pause & Timer Logic
        this.sessionStartTime = Date.now();
        this.lastPauseTime = Date.now();
        this.recentGrades = []; // Track recent performance for adaptive pauses
    }

    shuffle(array) {
        // Fisher-Yates shuffle
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    start() {
        if (this.queue.length === 0) {
            this.onComplete(this.stats, this.results, this.queue.length);
            return;
        }
        this.loadCurrentCard();
    }

    goTo(index) {
        const n = this.queue.length;
        if (n === 0) {
            this.onComplete(this.stats, this.results, this.queue.length);
            return;
        }
        const i = Math.max(0, Math.min(n - 1, Number(index) || 0));
        this.currentIndex = i;
        this.loadCurrentCard();
    }

    loadCurrentCard() {
        if (this.currentIndex >= this.queue.length) {
            this.onComplete(this.stats, this.results, this.queue.length);
            return;
        }
        this.currentCard = this.queue[this.currentIndex];
        this.isFlipped = false;
        this.cardStartTime = Date.now();

        const pauseRec = this.checkSmartPause();

        this.onUpdateUI({
            card: this.currentCard.item,
            cardProgress: this.currentCard.progress,
            progress: this.currentIndex + 1,
            total: this.queue.length,
            isFlipped: false,
            results: this.results,
            pauseRecommendation: pauseRec,
            mode: this.mode,
            timeLeft: this.mode === 'time_attack' ? 5 : null
        });

        if (this.mode === 'time_attack') {
            this.startModeTimer(5);
        }
    }

    startModeTimer(seconds) {
        if (this.modeTimer) clearInterval(this.modeTimer);
        this.timeLeft = seconds;
        this.modeTimer = setInterval(() => {
            this.timeLeft--;
            this.onUpdateUI({
                card: this.currentCard.item,
                cardProgress: this.currentCard.progress,
                progress: this.currentIndex + 1,
                total: this.queue.length,
                isFlipped: false,
                results: this.results,
                mode: this.mode,
                timeLeft: this.timeLeft
            });

            if (this.timeLeft <= 0) {
                clearInterval(this.modeTimer);
                this.finishGame('time_out');
            }
        }, 1000);
    }

    finishGame(reason) {
        if (this.modeTimer) clearInterval(this.modeTimer);
        this.onComplete(this.stats, this.results, this.queue.length, { reason });
    }

    flip() {
        if (this.isFlipped) return;
        if (this.modeTimer) clearInterval(this.modeTimer);

        this.isFlipped = true;
        this.onUpdateUI({
            card: this.currentCard.item,
            cardProgress: this.currentCard.progress,
            progress: this.currentIndex + 1,
            total: this.queue.length,
            isFlipped: true,
            results: this.results,
            mode: this.mode
        });
    }

    /**
     * Rate the current card
     * @param {0|1|2|3} grade
     */
    async rate(grade) {
        if (!this.currentCard) {
            console.warn('[SESSION.RATE] currentCard is null!');
            return;
        }

        // Check for Game Over conditions
        if ((this.mode === 'sudden_death' || this.mode === 'time_attack') && grade === 0) {
            this.finishGame('wrong_answer');
            return;
        }

        // Apply restriction if grade is Easy (3 in UI)
        if (grade === 3) {
            const progress = this.currentCard.progress || { easeFactor: 2.5 };
            if (!canUseEasy(progress)) {
                grade = 2; // Downgrade to Good (2 in UI)
            }
        }

        if (grade === 0) this.stats.again++;
        else if (grade === 1) this.stats.hard++;
        else if (grade === 2) this.stats.good++;
        else if (grade === 3) this.stats.easy++;
        this.stats.reviewed++;

        // Сохраняем результат с привязкой к индексу карточки в очереди
        while (this.results.length <= this.currentIndex) {
            this.results.push(null);
        }
        this.results[this.currentIndex] = grade;

        // Track recent performance
        this.recentGrades.push(grade);
        if (this.recentGrades.length > 15) this.recentGrades.shift();

        // Track time spent (cap at 5 mins per card to avoid idle time)
        const elapsed = Date.now() - (this.cardStartTime || Date.now());
        const safeElapsed = elapsed > 0 && elapsed < 300000 ? elapsed : 0;
        const safeElapsedSec = Math.round(safeElapsed / 1000);

        const newProgress = calculateNextReview(this.currentCard.progress, grade, safeElapsedSec);
        const now = new Date();
        // Сохраняем дату и время локального времени устройства
        const localDate = getLocalDate(now);
        const localHours = getLocalHours(now);

        newProgress.lastReviewed = localDate;
        newProgress.lastReviewedTime = localHours;

        // Сохраняем длительность прохождения карточки (в секундах)
        newProgress.lastReviewedDuration = safeElapsedSec;

        updateCardProgress(this.currentCard.item.question, newProgress);

        const statsRaw = localStorage.getItem('studyStats') || '{}';
        const stats = (() => { try { return JSON.parse(statsRaw); } catch { return {}; } })();
        stats.total = (stats.total || 0) + 1;

        if (safeElapsed > 0) {
            stats.timeSpent = (stats.timeSpent || 0) + safeElapsed;
        }

        if (grade >= 2) stats.correct = (stats.correct || 0) + 1;
        const pointsMap = [0, 5, 10, 15];
        const points = pointsMap[grade] || 0;
        stats.points = (stats.points || 0) + points;
        this.stats.pointsEarned += points;
        localStorage.setItem('studyStats', JSON.stringify(stats));
        try { window.dispatchEvent(new Event('xpUpdated')); } catch { }
        // Per-day points
        // 🔥 ИСПОЛЬЗУЕМ ЛОКАЛЬНОЕ ВРЕМЯ УСТРОЙСТВА (как в stats-utils.js)
        const todayKey = getLocalDate(new Date());
        const dpRaw = localStorage.getItem('dailyPoints') || '{}';
        const daily = (() => { try { return JSON.parse(dpRaw); } catch { return {}; } })();
        daily[todayKey] = (daily[todayKey] || 0) + points;
        localStorage.setItem('dailyPoints', JSON.stringify(daily));

        console.log(`[SESSION] ✅ Rate: grade=${grade}, points=${points}, date=${todayKey}, dailyPoints now:`, daily);
        // Track bonus separately for histogram breakdown (added later in overlay)
        const dbRaw = localStorage.getItem('dailyBonusPoints') || '{}';
        const dailyBonus = (() => { try { return JSON.parse(dbRaw); } catch { return {}; } })();
        dailyBonus[todayKey] = dailyBonus[todayKey] || 0;
        localStorage.setItem('dailyBonusPoints', JSON.stringify(dailyBonus));
        // Стрик теперь считается автоматически по dailyPoints в getStudyStreak()
        // updateStreak() удалён для избежания дублирования логики
        // Синхронизация уже происходит в updateCardProgress -> syncCardProgress

        // Re-queue if interval is 0 (Again/Hard on new cards)
        if (newProgress.interval === 0) {
            this.queue.push({
                item: this.currentCard.item,
                progress: newProgress,
                isNew: false
            });
        }

        this.currentIndex++;
        this.loadCurrentCard();
    }

    checkSmartPause() {
        const now = Date.now();
        const duration = (now - this.lastPauseTime) / 60000; // minutes

        // Minimum 15 mins before any pause suggestion
        if (duration < 15) return null;

        // Calculate recent accuracy (last 10-15 cards)
        const recentCorrect = this.recentGrades.filter(g => g >= 2).length;
        const recentTotal = this.recentGrades.length;
        const recentAccuracy = recentTotal > 0 ? (recentCorrect / recentTotal) : 1;

        // Fatigue check: Low accuracy (<60%) after 20 mins -> Suggest break
        if (duration > 20 && recentAccuracy < 0.6) {
            return {
                type: 'fatigue',
                reason: 'Снижение концентрации',
                duration: Math.round(duration),
                accuracy: Math.round(recentAccuracy * 100)
            };
        }

        // Standard flow: 25-40 mins
        // If performing well (>80%), extend up to 40 mins (Flow state)
        // Otherwise, suggest break at 30 mins
        const maxTime = recentAccuracy > 0.8 ? 40 : 30;

        if (duration > maxTime) {
            return {
                type: 'time',
                reason: 'Оптимальное время для перерыва',
                duration: Math.round(duration),
                accuracy: Math.round(recentAccuracy * 100)
            };
        }

        return null;
    }

    resumeFromPause() {
        this.lastPauseTime = Date.now();
        this.recentGrades = []; // Reset recent context
    }
}
