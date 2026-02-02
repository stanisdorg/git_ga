
import { getProgressMap } from './stats-utils.js?v=6';

const GOAL_DAYS = 60;
const START_DATE_KEY = 'srsStartDate';

/**
 * Manages the 45-day learning schedule.
 */
export class Scheduler {
    constructor(totalCardsCount) {
        this.totalCardsCount = totalCardsCount;
        this.initStartDate();
    }

    initStartDate() {
        let start = localStorage.getItem(START_DATE_KEY);
        if (!start) {
            start = new Date().toISOString();
            localStorage.setItem(START_DATE_KEY, start);
        }
        this.startDate = new Date(start);
    }

    getScheduleStatus() {
        const now = new Date();
        const diffTime = Math.abs(now - this.startDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
        const dayNumber = diffDays + 1;
        
        const progressMap = getProgressMap();
        const learnedCount = Object.values(progressMap).filter(p => p.repetitions > 0).length;
        const masteredCount = Object.values(progressMap).filter(p => p.state === 'mastered').length;
        const unseenCount = Math.max(0, this.totalCardsCount - learnedCount);
        
        const daysRemaining = Math.max(1, GOAL_DAYS - diffDays);
        
        // Dynamic Goal: Distribute remaining new cards over remaining days
        let dailyNewGoal = Math.ceil(unseenCount / daysRemaining);
        dailyNewGoal = Math.min(15, Math.max(10, dailyNewGoal)); // Min 10, Max 15 (User requested bigger blocks)

        // If we are ahead (unseenCount is low), we can relax
        if (unseenCount === 0) dailyNewGoal = 0;

        return {
            dayNumber,
            totalDays: GOAL_DAYS,
            learnedCount,
            masteredCount,
            unseenCount,
            dailyNewGoal,
            daysRemaining,
            progressPercent: Math.round((learnedCount / this.totalCardsCount) * 100)
        };
    }
}
