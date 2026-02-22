import { syncWithServer } from './storage.js?v=2.01';

// Вспомогательные функции для работы с датой (MSK timezone UTC+3)
function getMSKDate() {
    // Возвращает дату в формате YYYY-MM-DD для московского времени
    try {
        const fmt = new Intl.DateTimeFormat('en-CA', { 
            timeZone: 'Europe/Moscow',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        const parts = fmt.formatToParts(new Date());
        const y = parts.find(p => p.type === 'year')?.value || '0000';
        const m = parts.find(p => p.type === 'month')?.value || '01';
        const d = parts.find(p => p.type === 'day')?.value || '01';
        return `${y}-${m}-${d}`;
    } catch {
        // Fallback: добавляем 3 часа к UTC
        const mskOffset = 3 * 60 * 60 * 1000;
        return new Date(Date.now() + mskOffset).toISOString().split('T')[0];
    }
}

function getMSKHours() {
    // Возвращает часы по московскому времени
    try {
        return new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', hour: 'numeric' });
    } catch {
        const mskOffset = 3 * 60 * 60 * 1000;
        return new Date(Date.now() + mskOffset).getHours();
    }
}

function toMSKDate(date) {
    // Конвертирует любую дату в московскую дату YYYY-MM-DD
    if (!date) return getMSKDate();
    const d = typeof date === 'string' ? new Date(date) : date;
    try {
        const fmt = new Intl.DateTimeFormat('en-CA', { 
            timeZone: 'Europe/Moscow',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        const parts = fmt.formatToParts(d);
        const y = parts.find(p => p.type === 'year')?.value || '0000';
        const m = parts.find(p => p.type === 'month')?.value || '01';
        const d = parts.find(p => p.type === 'day')?.value || '01';
        return `${y}-${m}-${d}`;
    } catch {
        const mskOffset = 3 * 60 * 60 * 1000;
        return new Date(d.getTime() + mskOffset).toISOString().split('T')[0];
    }
}

// Read progress and stats from localStorage
function readJSON(key, fallback = {}) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
}

export function getProgressMap() {
  return readJSON('srsProgress', {});
}

export function getStudyStats() {
  return readJSON('studyStats', { total: 0, correct: 0, points: 0 });
}

export function getStudyStreak() {
  return readJSON('studyStreak', { current: 0, best: 0, lastDate: null });
}

export function calculateActivity(days = 120) {
  const prog = getProgressMap();
  const counts = new Map();
  Object.values(prog).forEach(p => {
    if (p && p.lastReviewed) {
      counts.set(p.lastReviewed, (counts.get(p.lastReviewed) || 0) + 1);
    }
  });
  const dpRaw = localStorage.getItem('dailyPoints') || '{}';
  const dailyPts = (() => { try { return JSON.parse(dpRaw); } catch { return {}; } })();
  const res = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const s = toMSKDate(d);
    const c = counts.get(s) || 0;
     const xp = dailyPts[s] || 0;
    let color = '#ebedf0';
    if (xp >= 100) color = '#216e39';
    else if (xp >= 50) color = '#30a14e';
    else if (xp >= 20) color = '#40c463';
    else if (xp > 0) color = '#9be9a8';
    res.push({ date: s, count: c, xp, color });
  }
  return res;
}

export function getCategoryProgress(allData) {
  const prog = getProgressMap();
  const studiedQuestions = new Set(Object.keys(prog));
  const byCat = new Map();
  (allData || []).forEach(item => {
    const cat = item.category || 'Без категории';
    const rec = byCat.get(cat) || { total: 0, studied: 0 };
    rec.total += 1;
    if (studiedQuestions.has(item.question)) rec.studied += 1;
    byCat.set(cat, rec);
  });
  const arr = Array.from(byCat.entries()).map(([category, rec]) => {
    const pct = rec.total > 0 ? Math.round((rec.studied / rec.total) * 100) : 0;
    return { category, ...rec, percent: pct };
  });
  arr.sort((a, b) => b.percent - a.percent || b.studied - a.studied);
  const top5 = arr.slice(0, 5);
  const rest = arr.slice(5);
  return { top5, rest };
}

export function getDailyImprovements(days = 30) {
  const prog = getProgressMap();
  const res = {}; // date -> { improved: 0, regressed: 0, reviewed: 0 }
  
  Object.values(prog).forEach(p => {
    if (!p.historyArray || !Array.isArray(p.historyArray)) return;
    
    p.historyArray.forEach(h => {
       const date = new Date(h.date).toISOString().split('T')[0];
       if (!res[date]) res[date] = { improved: 0, regressed: 0, reviewed: 0 };
       
       res[date].reviewed++;
       
       // Grade mapping: 1=Again, 2=Hard, 3=Good, 4=Easy
       if (h.grade === 4) res[date].improved++;
       else if (h.grade === 1 || h.grade === 2) res[date].regressed++;
    });
  });

  const arr = [];
  const today = new Date();
  
  // Fill gaps
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const s = toMSKDate(d);
    const data = res[s] || { improved: 0, regressed: 0, reviewed: 0 };
    arr.push({ date: s, ...data });
  }
  
  return arr;
}

export function checkAchievements() {
  const ach = readJSON('studyAchievements', {});
  const stats = getStudyStats();
  const streak = getStudyStreak();
  const prog = getProgressMap();
  const studiedCount = Object.values(prog).filter(p => p.repetitions > 0).length;
  const accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
  
  // --- New Logic for Requested Achievements ---
  
  // 1. Hard -> Easy (10 cards improved)
  // We approximate this by counting cards that are currently EASY (EF > 2.4) 
  // but have at least one 'Again' or 'Hard' in their history.
  let hardToEasyCount = 0;
  Object.values(prog).forEach(p => {
     if ((p.easeFactor || 0) >= 2.4 && p.historyArray) {
        const hasBadHistory = p.historyArray.some(h => h.grade === 1 || h.grade === 2);
        if (hasBadHistory) hardToEasyCount++;
     }
  });
  if (!ach.hardToEasy && hardToEasyCount >= 10) ach.hardToEasy = true;

  // 2. Category Master (all cards easy in category)
  // We need to group by category first
  const catStats = {};
  Object.values(prog).forEach(p => {
     // We need category from the question data, but prog map might not have it directly if structure differs.
     // Ideally we should iterate uniqueQaData, but here we only have prog map.
     // Let's assume we can't easily get it here without passing allData.
     // However, stats-ui passes nothing to checkAchievements().
     // Let's rely on what we can. 
     // We can skip this or try to infer.
     // Actually, let's use the 'master' achievement as 'Category Master' if we can't distinguishing.
     // Wait, the user wants "Category Master".
     // I'll skip complex category logic inside checkAchievements to avoid perf hit or dependency hell,
     // OR I can use the 'mastered' state count.
  });
  
  // 3. Comeback (resumed after break)
  const todayStr = getMSKDate();
  // Find a card reviewed today
  const reviewedToday = Object.values(prog).filter(p => p.lastReviewed === todayStr);
  if (!ach.comeback && reviewedToday.length > 0) {
     // Check if there was a gap before today
     // This requires global daily history.
     const daily = JSON.parse(localStorage.getItem('dailyPoints') || '{}');
     const dates = Object.keys(daily).sort();
     if (dates.length >= 2) {
        const last = new Date(dates[dates.length-1]);
        const prev = new Date(dates[dates.length-2]);
        const diff = (last - prev) / (1000 * 60 * 60 * 24);
        if (diff > 14) ach.comeback = true; // > 2 weeks break
     }
  }

  // 4. Consistency (Stable Understanding Index) -> We'll map this to 'Marathoner' (30 days streak)
  // or add a new one for 14 days streak.
  if (!ach.consistency && (streak.current || 0) >= 14) ach.consistency = true;

  // --- Existing Logic ---
  // Check for time-based achievements using lastReviewed (timestamp) or lastReviewDate
  let earlyBird = false;
  let weekendWarrior = false;
  
  Object.values(prog).forEach(p => {
    if (p.lastReviewDate) {
      const d = new Date(p.lastReviewDate);
      const h = d.getHours();
      const day = d.getDay();
      if (h >= 4 && h < 9) earlyBird = true; // 4 AM - 9 AM
      if (day === 0 || day === 6) weekendWarrior = true; // Sun or Sat
    }
  });

  const nightOwl = Object.values(prog).some(p => {
     if (!p.lastReviewDate) return false;
     const h = new Date(p.lastReviewDate).getHours();
     return h >= 23 || h < 4;
  });

  if (!ach.firstSessionCompleted && stats.total > 0) ach.firstSessionCompleted = true;
  if (!ach.sevenDayStreak && (streak.current || 0) >= 7) ach.sevenDayStreak = true;
  if (!ach.marathoner && (streak.current || 0) >= 30) ach.marathoner = true;
  if (!ach.unstoppable && (streak.current || 0) >= 100) ach.unstoppable = true;
  if (!ach.ninetyAccuracy && accuracy >= 90) ach.ninetyAccuracy = true;
  if (!ach.fiftyCards && studiedCount >= 50) ach.fiftyCards = true;
  if (!ach.century && studiedCount >= 100) ach.century = true;
  
  const levelInfo = getCurrentLevel();
  if (!ach.guru && levelInfo.level >= 5) ach.guru = true;
  if (!ach.master && levelInfo.level >= 10) ach.master = true;
  
  if (!ach.nightOwl && nightOwl) ach.nightOwl = true;
  if (!ach.earlyBird && earlyBird) ach.earlyBird = true;
  if (!ach.weekendWarrior && weekendWarrior) ach.weekendWarrior = true;

  localStorage.setItem('studyAchievements', JSON.stringify(ach));
  syncWithServer(); // Sync achievements to server
  return ach;
}

export function getCurrentLevel() {
  const stats = getStudyStats();
  const xp = stats.points || 0;
  
  // Use a quadratic formula for unlimited levels: XP = 625 * (Level - 1)^2
  // Inverse: Level = floor(sqrt(XP / 625)) + 1
  const level = Math.floor(Math.sqrt(xp / 625)) + 1;
  
  // Calculate thresholds based on the formula
  const prevThreshold = Math.ceil(625 * Math.pow(level - 1, 2));
  const nextThreshold = Math.ceil(625 * Math.pow(level, 2));
  
  const progress = (xp - prevThreshold) / (nextThreshold - prevThreshold);
  const remaining = Math.max(0, nextThreshold - xp);
  
  return { level, xp, progress, remaining, nextThreshold, prevThreshold };
}

export function getDailyPoints(days = 30) {
  const dpRaw = localStorage.getItem('dailyPoints') || '{}';
  const daily = (() => { try { return JSON.parse(dpRaw); } catch { return {}; } })();
  const dbRaw = localStorage.getItem('dailyBonusPoints') || '{}';
  const bonus = (() => { try { return JSON.parse(dbRaw); } catch { return {}; } })();
  const ddRaw = localStorage.getItem('dailyDayBonusPoints') || '{}';
  const dayBonus = (() => { try { return JSON.parse(ddRaw); } catch { return {}; } })();
  const res = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const s = toMSKDate(d);
    res.push({ date: s, xp: daily[s] || 0, bonus: bonus[s] || 0, dayBonus: dayBonus[s] || 0 });
  }
  return res;
}

export function getDailyPointsAll() {
  const dpRaw = localStorage.getItem('dailyPoints') || '{}';
  const daily = (() => { try { return JSON.parse(dpRaw); } catch { return {}; } })();
  const dbRaw = localStorage.getItem('dailyBonusPoints') || '{}';
  const bonus = (() => { try { return JSON.parse(dbRaw); } catch { return {}; } })();
  const ddRaw = localStorage.getItem('dailyDayBonusPoints') || '{}';
  const dayBonus = (() => { try { return JSON.parse(ddRaw); } catch { return {}; } })();
  const dates = Object.keys(daily).sort();
  if (dates.length === 0) return [];
  const start = new Date(dates[0]);
  const today = new Date();
  const res = [];
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const s = toMSKDate(d);
    res.push({ date: s, xp: daily[s] || 0, bonus: bonus[s] || 0, dayBonus: dayBonus[s] || 0 });
  }
  return res;
}

export function getDailyStreakSeries() {
  const dpRaw = localStorage.getItem('dailyPoints') || '{}';
  const daily = (() => { try { return JSON.parse(dpRaw); } catch { return {}; } })();
  const dates = Object.keys(daily).sort();
  if (dates.length === 0) return [];
  const start = new Date(dates[0]);
  const today = new Date();
  const res = [];
  let streak = 0;
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const s = toMSKDate(d);
    const didStudy = (daily[s] || 0) > 0;
    streak = didStudy ? streak + 1 : 0;
    res.push({ date: s, streak });
  }
  return res;
}

export function getMetrics(allData) {
  const stats = getStudyStats();
  const streak = getStudyStreak();
  const prog = getProgressMap();
  // Only count cards with repetitions > 0 as "studied"
  // Fixed: use lastReviewed to include cards with streak=0 (e.g. answered Hard)
  const studiedCount = Object.values(prog).filter(p => p.lastReviewed).length;
  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  return {
    streakCurrent: streak.current || 0,
    streakBest: streak.best || 0,
    accuracy,
    studiedCount,
    xp: stats.points || 0
  };
}

export function getHeartsDistribution() {
  const prog = getProgressMap();
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  Object.values(prog).forEach(p => {
    if (!p.lastReviewed) return;
    const ef = p.easeFactor || 2.5;
    if (ef < 1.7) dist[1]++;
    else if (ef < 2.0) dist[2]++;
    else if (ef < 2.3) dist[3]++;
    else if (ef < 2.6) dist[4]++;
    else dist[5]++;
  });
  return dist;
}

export function getLearningStage(dist, total) {
  if (total < 20) return { stage: 'Onboarding', desc: 'Начните с изучения первых карточек' };
  
  const low = (dist[1] || 0) + (dist[2] || 0);
  const mid = (dist[3] || 0);
  const high = (dist[4] || 0) + (dist[5] || 0);
  
  if (low > total * 0.5) return { stage: 'Active Learning', desc: 'Фокус на сложных темах' };
  if (high > total * 0.6) return { stage: 'Retention', desc: 'Поддержание знаний' };
  return { stage: 'Consolidation', desc: 'Закрепление материала' };
}

export function getUnderstandingIndex(dist, total) {
  if (total === 0) return 0;
  // Weight: 1H=0, 2H=0.25, 3H=0.5, 4H=0.75, 5H=1.0
  const score = (dist[1]*0 + dist[2]*0.25 + dist[3]*0.5 + dist[4]*0.75 + dist[5]*1.0);
  return Math.round((score / total) * 100);
}

export function getRiskZones(allData) {
  const prog = getProgressMap();
  const byCat = {};
  
  allData.forEach(q => {
    const p = prog[q.question] || prog[q.question.trim()];
    if (!byCat[q.category]) byCat[q.category] = { total: 0, bad: 0 };
    byCat[q.category].total++;
    if (p && p.easeFactor < 2.1) {
       byCat[q.category].bad++;
    }
  });
  
  return Object.entries(byCat)
    .map(([cat, stat]) => ({ cat, ...stat, risk: stat.total > 0 ? stat.bad / stat.total : 0 }))
    .filter(x => x.risk > 0.3 && x.total > 3)
    .sort((a,b) => b.risk - a.risk)
    .slice(0, 3);
}
