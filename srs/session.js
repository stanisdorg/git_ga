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

        // Update stats
        if (grade === 0) this.stats.again++;
        else if (grade === 1) this.stats.hard++;
        else if (grade === 2) this.stats.good++;
        else if (grade === 3) this.stats.easy++;
        this.stats.reviewed++;

        // Calculate new progress
        const newProgress = calculateNextReview(this.currentCard.progress, grade);
        
        // Save to storage
        updateCardProgress(this.currentCard.item.question, newProgress);

        // If "Again", requeue the card at the end of the session? 
        // Or just schedule for "now" (interval 0) and show it next time user loads session?
        // User spec: "Again: interval = 0 (show today)".
        // Usually in a session, "Again" cards are shown again *in the same session*.
        // Let's implement simple re-queueing for "Again" if we want to be strict,
        // but for MVP, let's just save it as "due now" and move to next card in queue.
        // User said: "Перейти к следующей карточке". So we just move on.
        
        this.currentIndex++;
        this.loadCurrentCard();
    }
}
