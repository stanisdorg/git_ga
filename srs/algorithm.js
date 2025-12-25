/**
 * @typedef {Object} ProgressRecord
 * @property {string} question - Unique identifier (using question text as ID for now)
 * @property {string} dueDate - ISO date string of next review
 * @property {number} interval - Days until next review
 * @property {number} repetitions - Consecutive correct answers
 * @property {number} easeFactor - E-Factor (multiplier)
 */

/**
 * Calculates the next review schedule using a simplified SM-2 algorithm.
 * @param {ProgressRecord | null} currentProgress
 * @param {0|1|2|3} grade - 0=Again, 1=Hard, 2=Good, 3=Easy
 * @returns {ProgressRecord}
 */
export function calculateNextReview(currentProgress, grade) {
    // Default initial state
    const progress = currentProgress || {
        question: '', // Should be set by caller
        dueDate: new Date().toISOString(),
        interval: 0,
        repetitions: 0,
        easeFactor: 2.5
    };

    let { interval, repetitions, easeFactor } = progress;

    if (grade === 0) {
        // Again: Reset repetitions and interval
        repetitions = 0;
        interval = 0;
        // Decrease ease factor slightly for failure (standard SM-2 doesn't always decrease on fail, 
        // but user prompt says "easeFactor уменьшается")
        easeFactor = Math.max(1.3, easeFactor - 0.2);
    } else {
        // Correct response (Hard, Good, Easy)
        
        // Update Ease Factor
        // SM-2 Formula: EF' = EF + (0.1 - (5-q)*(0.08 + (5-q)*0.02))
        // Mapping our grades: 
        // 0 (Again) -> q=0? No, SM-2 uses 0-5. 
        // User map: 0=Again, 1=Hard, 2=Good, 3=Easy.
        // Let's approximate user request logic:
        // "Хорошо/Easy: interval = prev * ease, reps++, ease adjusts"
        
        if (grade === 1) { // Hard
            easeFactor -= 0.15;
        } else if (grade === 2) { // Good
            // ease unchanged or standard adjustment? User says "ease adjusts"
            // Standard SM-2 for grade 4 (Good): no change or small change. 
            // Let's keep it stable or slightly up?
            // User requirement: "easeFactor корректируется"
            // Let's use standard formula approach mapped to 3-5 scale?
            // Let's stick to simple rules:
            // Good: No change to ease (common variation) or small penalty if it was hard?
            // Let's use:
            // Hard: -0.15
            // Good: +0.00
            // Easy: +0.15
        } else if (grade === 3) { // Easy
            easeFactor += 0.15;
        }
        
        easeFactor = Math.max(1.3, easeFactor);

        // Update Repetitions & Interval
        repetitions++;

        if (repetitions === 1) {
            interval = 1;
        } else if (repetitions === 2) {
            interval = 6;
        } else {
            // For subsequent repetitions
            let modifier = 1;
            if (grade === 3) modifier = 1.3; // Bonus for Easy
            if (grade === 1) modifier = 0.8; // Penalty for Hard (growth is slower)
            
            // Standard: I(n) = I(n-1) * EF
            // With user constraints:
            // Hard should probably grow slower than Good.
            // Let's simply use: interval = Math.round(interval * easeFactor);
            // And maybe apply a modifier for 'Hard' to make it less than 'Good'?
            // Or just trust the easeFactor drop to handle it over time.
            
            // User logic: "interval = предыдущий_интервал * easeFactor"
            interval = Math.round(interval * easeFactor);
        }
    }

    // Calculate new Due Date
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + interval);
    // Set to start of day or keep time? Usually SRS uses start of day.
    // Let's keep it simple: exact time + interval days.
    
    return {
        question: progress.question,
        dueDate: nextDate.toISOString(),
        interval,
        repetitions,
        easeFactor
    };
}
