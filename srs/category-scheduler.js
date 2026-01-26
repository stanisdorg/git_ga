import { getProgressMap } from './storage.js';

/**
 * Implements "Contextual Cognitive Linking" for session generation.
 */

// Helper to get day difference
function getDaysDiff(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    d1.setHours(0,0,0,0);
    d2.setHours(0,0,0,0);
    return Math.floor((d1 - d2) / (1000 * 60 * 60 * 24));
}

/**
 * Main function to generate the daily session.
 * @param {Array} allQuestions - Full list of questions from JSON
 * @returns {Array} List of questions for today's session
 */
export function getTodaysSession(allQuestions) {
    const progressMap = getProgressMap();
    const now = Date.now();

    // 1. Identify DUE cards and NEW cards
    const dueCards = [];
    const newCards = [];
    
    allQuestions.forEach(q => {
        const progress = progressMap[q.question];
        if (progress) {
            // Check if due
            // Compatible with both timestamp (nextReviewDate) and ISO string (dueDate)
            let dueDate = progress.nextReviewDate;
            if (!dueDate && progress.dueDate) {
                dueDate = new Date(progress.dueDate).getTime();
            }
            
            if (!dueDate || dueDate <= now) {
                dueCards.push({ item: q, progress, isNew: false });
            }
        } else {
            newCards.push({ item: q, progress: null, isNew: true });
        }
    });

    // 2. Group by Category/Subcategory
    const grouped = groupByCategoryAndSubcategory([...dueCards, ...newCards]);

    // 3. Calculate Mastery per Category (for prioritization)
    calculateCategoryMastery(grouped, progressMap);

    // 4. Select Cards for Session
    const sessionCards = [];

    // A. Priority: Weakest Categories (Contextual Linking)
    // Find categories with lowest mastery
    const sortedCategories = Object.keys(grouped).sort((a, b) => {
        return (grouped[a].mastery || 0) - (grouped[b].mastery || 0);
    });

    // Take due cards from weakest categories first
    sortedCategories.forEach(cat => {
        const catCards = grouped[cat].cards.filter(c => !c.isNew); // Due reviews
        // Sort by priority (e.g., longest overdue or hardest)
        // Here we just take them
        sessionCards.push(...catCards);
    });
    
    // Remove duplicates if any logic added them (currently safe)
    
    // B. New Cards: Contextual Injection
    // Add new cards from "Active" categories (those being reviewed) to reinforce context
    // Limit new cards per day
    
    // Determine limits based on "Starting Plan" (Days 1-10) specified in document
    // We infer the "Day" based on studiedCount since we don't track start date explicitly in this scope
    const studiedCount = Object.values(progressMap).filter(p => p.repetitionCount > 0).length;
    
    let DAILY_NEW_LIMIT = 20;
    let MAX_SESSION = 50;

    if (studiedCount < 40) {
        // Day 1: Target 50 new
        DAILY_NEW_LIMIT = 50;
        MAX_SESSION = 55;
    } else if (studiedCount < 210) {
        // Days 2-7: Target 30 new + reviews (Total ~80)
        DAILY_NEW_LIMIT = 30;
        MAX_SESSION = 85;
    } else if (studiedCount < 317) {
        // Days 8-10: Target 10-20 new + reviews
        DAILY_NEW_LIMIT = 20;
        MAX_SESSION = 70;
    } else {
        // Phase 3: Consolidation (Reviews only or few new)
        DAILY_NEW_LIMIT = 9999;
        MAX_SESSION = 9999;
    }

    // Override limits if user wants to study more (currently hardcoded high)
    DAILY_NEW_LIMIT = 9999;
    MAX_SESSION = 9999;

    // Override limits if user wants to study more (currently hardcoded high)
    DAILY_NEW_LIMIT = 9999;
    MAX_SESSION = 9999;

    let addedNew = 0;

    // First fill from weakest categories
    sortedCategories.forEach(cat => {
        if (addedNew >= DAILY_NEW_LIMIT) return;
        const catNew = grouped[cat].cards.filter(c => c.isNew);
        const take = Math.min(catNew.length, 8); // Increased from 5 to allow hitting 50 faster
        if (take > 0) {
            sessionCards.push(...catNew.slice(0, take));
            addedNew += take;
        }
    });

    // If limit not reached, take from any category
    if (addedNew < DAILY_NEW_LIMIT) {
        const remainingNew = newCards.filter(c => !sessionCards.includes(c));
        const needed = DAILY_NEW_LIMIT - addedNew;
        sessionCards.push(...remainingNew.slice(0, needed));
    }

    // 5. Apply Daily Load Limit (Adaptive)
    if (sessionCards.length > MAX_SESSION) {
        // Prioritize: 
        // 1. Due Reviews (Keep all if possible, or prioritize by overdue)
        // 2. New Cards (Drop these first if overload)
        
        const reviews = sessionCards.filter(c => !c.isNew);
        const news = sessionCards.filter(c => c.isNew);
        
        if (reviews.length >= MAX_SESSION) {
            return reviews.slice(0, MAX_SESSION);
        } else {
            return [...reviews, ...news.slice(0, MAX_SESSION - reviews.length)];
        }
    }

    return ensureCategoryDiversity(sessionCards);
}

function groupByCategoryAndSubcategory(cards) {
    const groups = {};
    cards.forEach(c => {
        const cat = c.item.category || 'Uncategorized';
        if (!groups[cat]) {
            groups[cat] = { cards: [], mastery: 0, subcategories: {} };
        }
        groups[cat].cards.push(c);
        
        // Subcategory
        const sub = c.item.subcategory || 'General';
        if (!groups[cat].subcategories[sub]) {
            groups[cat].subcategories[sub] = [];
        }
        groups[cat].subcategories[sub].push(c);
    });
    return groups;
}

function calculateCategoryMastery(grouped, progressMap) {
    Object.keys(grouped).forEach(cat => {
        const cards = grouped[cat].cards;
        if (cards.length === 0) return;
        
        let totalScore = 0;
        let learnedCount = 0;
        
        cards.forEach(c => {
            if (!c.isNew && c.progress) {
                // Score based on interval
                // > 30 days = 1.0 mastery
                // < 30 days = interval / 30
                const interval = c.progress.interval || 0;
                totalScore += Math.min(1, interval / 30);
                learnedCount++;
            }
        });
        
        // Mastery is average score of LEARNED cards (or 0 if none)
        // Penalize for unlearned cards? Maybe slight penalty.
        // Let's keep it simple: Average of all cards in category (unlearned = 0)
        grouped[cat].mastery = totalScore / cards.length;
    });
}

function ensureCategoryDiversity(sessionCards) {
    // Shuffle but try to avoid same category back-to-back if possible?
    // Or just simple shuffle as the text says "Ensure diversity".
    // "Smart Shuffle"
    
    // Fisher-Yates shuffle first
    for (let i = sessionCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sessionCards[i], sessionCards[j]] = [sessionCards[j], sessionCards[i]];
    }
    
    return sessionCards;
}
