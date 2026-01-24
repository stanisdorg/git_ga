/**
 * @typedef {Object} ProgressRecord
 * @property {string} question - Unique identifier
 * @property {string} dueDate - ISO date string of next review
 * @property {number} interval - Days until next review
 * @property {number} repetitions - Consecutive correct answers
 * @property {number} easeFactor - E-Factor (multiplier)
 * @property {number} history - Count of total attempts
 * @property {string} state - 'learning', 'review', 'relearning', 'mastered'
 */

/**
 * Calculates the next review schedule using a "PsychSRS" algorithm
 * tuned for a ~60 day mastery cycle with 2-10 repetitions per card.
 * 
 * @param {ProgressRecord | null} currentProgress
 * @param {0|1|2|3} grade - 0=Again, 1=Hard, 2=Good, 3=Easy
 * @returns {ProgressRecord}
 */
export function calculateNextReview(currentProgress, grade) {
    // Initial State
    const now = new Date();
    const progress = currentProgress || {
        question: '', 
        dueDate: now.toISOString(),
        interval: 0,
        repetitions: 0,
        easeFactor: 2.5,
        history: 0,
        state: 'learning'
    };

    let { interval, repetitions, easeFactor, history, state } = progress;
    history = (history || 0) + 1;

    // Constants for 60-day mastery
    const MIN_EASE = 1.3;
    
    // Logic Branching
    if (grade === 0) {
        // --- AGAIN (Forgot) ---
        repetitions = 0;
        interval = 0; // Review today/tomorrow
        easeFactor = Math.max(MIN_EASE, easeFactor - 0.2);
        state = 'relearning';
    } else {
        // --- SUCCESS (Hard, Good, Easy) ---
        
        // 1. Adjust Ease Factor
        if (grade === 1) { // Hard
            easeFactor -= 0.15;
            state = 'learning'; // Keep in learning/review pressure
        } else if (grade === 2) { // Good
            // Stable
        } else if (grade === 3) { // Easy
            easeFactor += 0.15;
        }
        easeFactor = Math.max(MIN_EASE, easeFactor);

        // 2. Calculate Interval
        if (repetitions === 0) {
            // First success
            if (grade === 1) {
                // Hard on new card: Keep in session, do not graduate
                interval = 0;
                // repetitions stays 0
                state = 'learning';
            } else {
                // Good or Easy
                interval = 1;
                state = 'learning';
                repetitions = 1; // Graduate to first step
            }
        } else {
            // Repetitions > 0
            if (repetitions === 1) {
                // Second success
                interval = grade === 1 ? 2 : (grade === 3 ? 4 : 3);
                state = 'review';
            } else {
                // Subsequent reviews
                if (grade === 1) {
                    // Hard: Very slow growth (Anki-style x1.2), ignore Ease
                    // This ensures "Hard" cards are seen much sooner than "Good" ones
                    interval = Math.max(interval + 1, Math.floor(interval * 1.2));
                } else {
                    // Good (2) or Easy (3)
                    let modifier = 1.0;
                    if (grade === 3) modifier = 1.3; // Easy: grow faster (bonus)
                    
                    // "Psychological" Tweak for ~60 day course:
                    // Damp growth slightly to ensure ~6-8 reps.
                    // If user wants "more repetitions", we cap growth multiplier at 1.9
                    const effectiveEase = Math.min(easeFactor, 1.9); 
                    
                    interval = Math.ceil(interval * effectiveEase * modifier);
                }
            }
            repetitions++;
        }

        // 4. Mastery Check
        // Increased threshold to ensure long-term retention
        // Cards are "Mastered" only when interval exceeds 2 months
        if (repetitions >= 12 || interval > 60) {
            state = 'mastered';
        }
    }

    // Fuzzing (prevent clumps)
    if (interval > 4) {
        const fuzz = Math.floor(interval * 0.05 * (Math.random() - 0.5));
        interval += fuzz;
    }

    // Set Due Date
    const nextDate = new Date();
    if (interval === 0) {
        nextDate.setMinutes(nextDate.getMinutes() + 10);
    } else {
        nextDate.setDate(nextDate.getDate() + interval);
        // Snap to 4 AM
        nextDate.setHours(4, 0, 0, 0);
    }

    return {
        question: progress.question,
        dueDate: nextDate.toISOString(),
        interval,
        repetitions,
        easeFactor,
        history,
        state,
        lastReviewed: new Date().toISOString()
    };
}
