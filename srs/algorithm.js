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
 * @property {Array<{date: number, quality: number}>} history - Review history
 * @property {number} categoryMastery - 0-1, mastery in category
 * @property {number} subcategoryMastery - 0-1, mastery in subcategory
 */

/**
 * Calculates the next review interval using the "Adaptive Master Interval" algorithm.
 * Based on modified SM-2.
 * 
 * Quality Scale (mapped from UI):
 * 0: Fail (Again)
 * 1: Hard (Hard)
 * 2: Delayed (mapped from Good if slow?) - NOT USED DIRECTLY FROM UI YET
 * 3: Good (Good)
 * 4: Perfect (Easy)
 * 
 * @param {SRSProgress} card
 * @param {number} quality - 0-4
 * @returns {SRSProgress} Updated card
 */
export function calculateNextInterval(card, quality) {
    const now = Date.now();
    
    // Initialize defaults if missing
    if (!card.easeFactor) card.easeFactor = 2.5;
    if (!card.streak) card.streak = 0;
    if (!card.interval) card.interval = 0;
    if (!card.repetitionCount) card.repetitionCount = 0;
    if (!card.history) card.history = [];

    // Update history
    card.history.push({ date: now, quality });
    card.lastReviewDate = now;
    card.repetitionCount++;

    if (quality < 2) {
        // Fail or Hard Fail
        card.interval = 1; // Review tomorrow
        card.streak = 0;
        card.easeFactor = Math.max(1.3, card.easeFactor - 0.2);
    } else {
        // Success
        card.streak++;
        
        if (card.streak === 1) {
            card.interval = 1;
        } else if (card.streak === 2) {
            card.interval = 3;
        } else {
            // SM-2 Modified
            card.interval = Math.round(card.interval * card.easeFactor);
        }
        
        // Adjust Ease Factor
        if (quality === 2) {
            card.easeFactor = Math.max(1.3, card.easeFactor - 0.15);
        } else if (quality === 3) {
            // Good: Slight increase to reward consistency
            card.easeFactor += 0.1;
        } else if (quality === 4) {
            // Easy: Larger increase
            card.easeFactor += 0.2;
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
 * Maps existing 'grade' (0-3) to 'quality' (0-4).
 * 
 * @param {Object} currentProgress 
 * @param {number} grade 0=Again, 1=Hard, 2=Good, 3=Easy
 */
export function calculateNextReview(currentProgress, grade) {
    // Map grade 0-3 to quality 0-4
    // 0 (Again) -> 0 (Fail)
    // 1 (Hard) -> 1 (Hard/Struggle)
    // 2 (Good) -> 3 (Good)
    // 3 (Easy) -> 4 (Perfect)
    const qualityMap = {
        0: 0,
        1: 1,
        2: 3,
        3: 4
    };
    const quality = qualityMap[grade];

    // Ensure currentProgress has new structure fields
    const card = {
        ...currentProgress,
        interval: currentProgress?.interval || 0,
        easeFactor: currentProgress?.easeFactor || 2.5,
        streak: currentProgress?.streak || (currentProgress?.repetitions || 0), // Approx migration
        repetitionCount: currentProgress?.history || 0,
        history: currentProgress?.historyArray || [] // Assuming we might want to store array
    };

    const updated = calculateNextInterval(card, quality);

    // Return object compatible with existing storage expecting 'dueDate' ISO string
    return {
        ...updated,
        dueDate: new Date(updated.nextReviewDate).toISOString(),
        // Map back to existing fields for compatibility if needed
        repetitions: updated.streak,
        history: updated.repetitionCount,
        state: updated.interval > 60 ? 'mastered' : (updated.interval > 20 ? 'review' : 'learning')
    };
}
