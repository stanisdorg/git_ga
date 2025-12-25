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

export function calculateActivity(days = 30) {
  const prog = getProgressMap();
  const counts = new Map();
  Object.values(prog).forEach(p => {
    if (p && p.lastReviewed) {
      counts.set(p.lastReviewed, (counts.get(p.lastReviewed) || 0) + 1);
    }
  });
  const res = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const s = d.toISOString().split('T')[0];
    const c = counts.get(s) || 0;
    let color = '#ebedf0';
    if (c >= 8) color = '#216e39';
    else if (c >= 4) color = '#40c463';
    else if (c >= 1) color = '#9be9a8';
    res.push({ date: s, count: c, color });
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
  const studiedCount = Object.keys(prog).length;
  const accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
  const nightOwl = Object.values(prog).some(p => (p.lastReviewedTime || 0) >= 23);

  if (!ach.firstSessionCompleted && stats.total > 0) ach.firstSessionCompleted = true;
  if (!ach.sevenDayStreak && (streak.current || 0) >= 7) ach.sevenDayStreak = true;
  if (!ach.ninetyAccuracy && accuracy >= 90) ach.ninetyAccuracy = true;
  if (!ach.fiftyCards && studiedCount >= 50) ach.fiftyCards = true;
  if (!ach.nightOwl && nightOwl) ach.nightOwl = true;

  localStorage.setItem('studyAchievements', JSON.stringify(ach));
  return ach;
}

export function getCurrentLevel() {
  const stats = getStudyStats();
  const xp = stats.points || 0;
  let level = 1;
  let nextThreshold = 1000;
  if (xp >= 10000) { level = 5; nextThreshold = Infinity; }
  else if (xp >= 5000) { level = 4; nextThreshold = 10000; }
  else if (xp >= 2500) { level = 3; nextThreshold = 5000; }
  else if (xp >= 1000) { level = 2; nextThreshold = 2500; }
  else { level = 1; nextThreshold = 1000; }
  const prevThreshold = (level === 1) ? 0 : (level === 2 ? 1000 : level === 3 ? 2500 : level === 4 ? 5000 : 10000);
  const progress = nextThreshold === Infinity ? 1 : (xp - prevThreshold) / (nextThreshold - prevThreshold);
  const remaining = nextThreshold === Infinity ? 0 : Math.max(0, nextThreshold - xp);
  return { level, xp, progress, remaining, nextThreshold, prevThreshold };
}

export function getMetrics(allData) {
  const stats = getStudyStats();
  const streak = getStudyStreak();
  const prog = getProgressMap();
  const studiedCount = Object.keys(prog).length;
  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  return {
    streakCurrent: streak.current || 0,
    streakBest: streak.best || 0,
    accuracy,
    studiedCount,
    xp: stats.points || 0
  };
}

