import { syncWithServer } from './storage.js';

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
    const s = d.toISOString().split('T')[0];
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

export function checkAchievements() {
  const ach = readJSON('studyAchievements', {});
  const stats = getStudyStats();
  const streak = getStudyStreak();
  const prog = getProgressMap();
  const studiedCount = Object.values(prog).filter(p => p.repetitions > 0).length;
  const accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
  const nightOwl = Object.values(prog).some(p => (p.lastReviewedTime || 0) >= 23);

  if (!ach.firstSessionCompleted && stats.total > 0) ach.firstSessionCompleted = true;
  if (!ach.sevenDayStreak && (streak.current || 0) >= 7) ach.sevenDayStreak = true;
  if (!ach.ninetyAccuracy && accuracy >= 90) ach.ninetyAccuracy = true;
  if (!ach.fiftyCards && studiedCount >= 50) ach.fiftyCards = true;
  if (!ach.nightOwl && nightOwl) ach.nightOwl = true;

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
    const s = d.toISOString().split('T')[0];
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
    const s = d.toISOString().split('T')[0];
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
    const s = d.toISOString().split('T')[0];
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
