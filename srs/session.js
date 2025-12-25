import { calculateNextReview } from './algorithm.js';
import { updateCardProgress } from './storage.js';

/**
 * Manages the learning session state.
 */
export class LearningSession {
    /**
     * @param {Array<{item: Object, progress: Object, isNew: boolean}>} dueCards 
     * @param {Function} onUpdateUI - Callback to render UI
     * @param {Function} onComplete - Callback when session ends
     */
    constructor(dueCards, onUpdateUI, onComplete) {
        this.queue = this.shuffle(dueCards);
        this.currentIndex = 0;
        this.currentCard = null;
        this.isFlipped = false;
        this.onUpdateUI = onUpdateUI;
        this.onComplete = onComplete;
        
        // Session stats
        this.stats = {
            total: this.queue.length,
            reviewed: 0,
            again: 0,
            hard: 0,
            good: 0,
            easy: 0
        };
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
            this.onComplete(this.stats);
            return;
        }
        this.loadCurrentCard();
    }

    loadCurrentCard() {
        if (this.currentIndex >= this.queue.length) {
            this.onComplete(this.stats);
            return;
        }
        this.currentCard = this.queue[this.currentIndex];
        this.isFlipped = false;
        this.onUpdateUI({
            card: this.currentCard.item,
            progress: this.currentIndex + 1,
            total: this.queue.length,
            isFlipped: false
        });
    }

    flip() {
        if (this.isFlipped) return;
        this.isFlipped = true;
        this.onUpdateUI({
            card: this.currentCard.item,
            progress: this.currentIndex + 1,
            total: this.queue.length,
            isFlipped: true
        });
    }

    /**
     * Rate the current card
     * @param {0|1|2|3} grade 
     */
    rate(grade) {
        if (!this.currentCard) return;

        if (grade === 0) this.stats.again++;
        else if (grade === 1) this.stats.hard++;
        else if (grade === 2) this.stats.good++;
        else if (grade === 3) this.stats.easy++;
        this.stats.reviewed++;

        const newProgress = calculateNextReview(this.currentCard.progress, grade);
        const now = new Date();
        newProgress.lastReviewed = now.toISOString().split('T')[0];
        newProgress.lastReviewedTime = now.getHours();
        
        updateCardProgress(this.currentCard.item.question, newProgress);

        const statsRaw = localStorage.getItem('studyStats') || '{}';
        const stats = (() => { try { return JSON.parse(statsRaw); } catch { return {}; } })();
        stats.total = (stats.total || 0) + 1;
        if (grade >= 2) stats.correct = (stats.correct || 0) + 1;
        const pointsMap = [0, 5, 10, 15];
        const points = pointsMap[grade] || 0;
        stats.points = (stats.points || 0) + points;
        localStorage.setItem('studyStats', JSON.stringify(stats));
        updateStreak();
        
        this.currentIndex++;
        this.loadCurrentCard();
    }
}

function updateStreak() {
    const today = new Date().toISOString().split('T')[0];
    const raw = localStorage.getItem('studyStreak') || '{}';
    const streak = (() => { try { return JSON.parse(raw); } catch { return {}; } })();
    if (streak.lastDate === today) return;
    if (!streak.lastDate) {
        streak.current = 1;
    } else {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        const ys = y.toISOString().split('T')[0];
        streak.current = (streak.lastDate === ys) ? (streak.current || 0) + 1 : 1;
    }
    streak.best = Math.max(streak.best || 0, streak.current || 0);
    streak.lastDate = today;
    localStorage.setItem('studyStreak', JSON.stringify(streak));
}
