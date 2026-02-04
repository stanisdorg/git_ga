/**
 * @typedef {Object} SRSProgress
 * @property {string} id - Unique identifier (question)
 * @property {string} category
 * @property {string} subcategory
 * @property {number} interval - Days until next review
 * @property {number} easeFactor - E-Factor (multiplier, default 2.5)
 * @property {number} nextReviewDate - Timestamp of next review
 * @property {number} repetitionCount - Total repetitions
 * @property {number} streak - Consecutive correct answers
 * @property {number} lastReviewDate - Timestamp of last review
 * @property {Array<{date: number, grade: number}>} history - Review history
 * @property {number} categoryMastery - 0-1, mastery in category
 * @property {number} subcategoryMastery - 0-1, mastery in subcategory
 */

export const EF_MIN = 1.3;
export const EF_MAX = 2.9;

export const LEVEL_RANGES = {
    VERY_HARD: { min: EF_MIN, max: 1.7 },
    HARD:      { min: 1.7,    max: 2.1 },
    STANDARD:  { min: 2.1,    max: 2.4 },
    EASY:      { min: 2.4,    max: EF_MAX }
};

const EF_DELTAS = {
    AGAIN: -0.25, // Снова (1)
    HARD:  -0.15, // Трудно (2)
    GOOD:   0.05, // Хорошо (3)
    EASY:  +0.05  // Легко (4)
};

export function getDifficultyLevel(ef) {
    if (ef < 1.7) return 'VERY_HARD';
    if (ef < 2.1) return 'HARD';
    if (ef < 2.4) return 'STANDARD';
    return 'EASY';
}

export function getLevelProgress(ef, level) {
    if (!level) level = getDifficultyLevel(ef);
    const { min, max } = LEVEL_RANGES[level];
    // Clamp result between 0 and 1
    return Math.min(1, Math.max(0, (ef - min) / (max - min)));
}

export function canUseEasy(card) {
    const rc = card && typeof card.repetitionCount === 'number' ? card.repetitionCount : (card && Array.isArray(card.history) ? card.history.length : 0);
    return rc > 0;
}

/**
 * Calculates the next review interval using the new logic.
 * 
 * @param {SRSProgress} card
 * @param {number} grade - 1 (Again), 2 (Hard), 3 (Good), 4 (Easy)
 * @returns {SRSProgress} Updated card
 */
export function calculateNextInterval(card, grade) {
    const now = Date.now();
    
    // Initialize defaults if missing
    if (card.easeFactor === undefined) card.easeFactor = 2.3; // Default to Standard (was 2.5 Easy)
    if (!card.streak) card.streak = 0;
    if (!card.interval) card.interval = 0;
    if (!card.repetitionCount) card.repetitionCount = 0;
    if (!card.history) card.history = [];

    // Apply grade restriction
    if (grade === 4 && !canUseEasy(card)) {
        grade = 3; // Downgrade Easy -> Good
    }

    // Update history
    card.history.push({ date: now, grade });
    card.lastReviewDate = now;
    const prevCount = card.repetitionCount;
    card.repetitionCount++;

    let efChange = 0;

    switch (grade) {
        case 1: // AGAIN
            efChange = EF_DELTAS.AGAIN;
            card.streak = 0;
            // Interval logic for AGAIN is handled below, but usually resets to 1
            break;
        case 2: // HARD
            efChange = prevCount === 0 ? -0.35 : EF_DELTAS.HARD;
            card.streak = 0;
            break;
        case 3: // GOOD
            efChange = EF_DELTAS.GOOD;
            card.streak += 1;
            break;
        case 4: // EASY
            efChange = EF_DELTAS.EASY;
            card.streak += 1;
            break;
        default:
            // Fallback if 0 passed
             if (grade === 0) {
                 efChange = EF_DELTAS.AGAIN;
                 card.streak = 0;
             }
             break;
    }

    // Apply EF change
    card.easeFactor += efChange;
    
    // Clamp EF
    card.easeFactor = Math.max(EF_MIN, Math.min(EF_MAX, card.easeFactor));
    
    // Calculate Interval
    if (grade === 1) {
        card.interval = 1;
    } else {
        if (card.streak <= 1) {
            card.interval = 1;
        } else if (card.streak === 2) {
            card.interval = 3;
        } else {
            card.interval = Math.round(card.interval * card.easeFactor);
        }
    }
    
    // Cap interval at 180 days
    card.interval = Math.min(card.interval, 180);
    
    // Calculate next review date (start of day)
    const nextDate = new Date(now);
    nextDate.setDate(nextDate.getDate() + card.interval);
    nextDate.setHours(4, 0, 0, 0); // 4 AM next day
    card.nextReviewDate = nextDate.getTime();
    
    return card;
}

/**
 * Adapter for existing codebase compatibility.
 * Maps existing 'grade' (0-3) to new logic (1-4).
 * 
 * @param {Object} currentProgress 
 * @param {number} grade 0=Again, 1=Hard, 2=Good, 3=Easy
 */
export function calculateNextReview(currentProgress, grade) {
    // Map grade 0-3 (UI) to 1-4 (Logic)
    // 0 (Again) -> 1
    // 1 (Hard) -> 2
    // 2 (Good) -> 3
    // 3 (Easy) -> 4
    const gradeMap = {
        0: 1,
        1: 2,
        2: 3,
        3: 4
    };
    const logicGrade = gradeMap[grade];

    // Ensure currentProgress has new structure fields
    const card = {
        ...currentProgress,
        interval: currentProgress?.interval || 0,
        easeFactor: currentProgress?.easeFactor !== undefined ? currentProgress.easeFactor : 2.3,
        streak: currentProgress?.streak || (currentProgress?.repetitions || 0),
        repetitionCount: currentProgress?.repetitionCount || (currentProgress?.history || 0),
        history: Array.isArray(currentProgress?.historyArray) ? currentProgress.historyArray : [] 
    };

    const updated = calculateNextInterval(card, logicGrade);

    // Return object compatible with existing storage expecting 'dueDate' ISO string
    return {
        ...updated,
        dueDate: new Date(updated.nextReviewDate).toISOString(),
        // Map back to existing fields for compatibility
        repetitions: updated.streak, // Keeping this for backward compat if something reads it
        history: updated.repetitionCount, // This field name is confusing in old code (was count)
        historyArray: updated.history, // Persist history array
        state: updated.interval > 60 ? 'mastered' : (updated.interval > 20 ? 'review' : 'learning')
    };
}
