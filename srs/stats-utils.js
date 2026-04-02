import { syncWithServer } from './storage.js?v=6.24.0';

// Вспомогательные функции для работы с датой (MSK timezone Europe/Moscow)
function getMSKDate() {
  // Возвращает дату в формате YYYY-MM-DD для московского времени
  // Используем Intl.DateTimeFormat для правильного учёта часового пояса
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' });
    const parts = fmt.formatToParts(new Date());
    return `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}-${parts.find(p => p.type === 'day').value}`;
  } catch {
    // Fallback на смещение (UTC+3) если Intl не доступен
    const mskOffset = 3 * 60 * 60 * 1000;
    return new Date(Date.now() + mskOffset).toISOString().split('T')[0];
  }
}

function getMSKHours() {
  // Возвращает часы по московскому времени
  try {
    const fmt = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', hour12: false });
    return parseInt(fmt.format(new Date()));
  } catch {
    // Fallback на смещение
    const mskOffset = 3 * 60 * 60 * 1000;
    return new Date(Date.now() + mskOffset).getHours();
  }
}

function toMSKDate(date) {
  // Конвертирует любую дату в московскую дату YYYY-MM-DD
  if (!date) return getMSKDate();
  const d = typeof date === 'string' ? new Date(date) : date;
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' });
    const parts = fmt.formatToParts(d);
    return `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}-${parts.find(p => p.type === 'day').value}`;
  } catch {
    // Fallback на смещение
    const mskOffset = 3 * 60 * 60 * 1000;
    return new Date(d.getTime() + mskOffset).toISOString().split('T')[0];
  }
}

// Миграция старых данных из UTC в MSK
export function migrateToMSK() {
  const migratedKey = localStorage.getItem('mskMigrated');
  if (migratedKey === 'true') {
    console.log('[MSK.MIGRATE] Already migrated, skipping');
    return false;
  }

  console.log('[MSK.MIGRATE] Starting migration...');
  console.log('[MSK.MIGRATE] Current UTC:', new Date().toISOString());
  console.log('[MSK.MIGRATE] Current MSK:', new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }));

  try {
    // Миграция dailyPoints
    const dailyPointsRaw = localStorage.getItem('dailyPoints') || '{}';
    const dailyPoints = JSON.parse(dailyPointsRaw);
    console.log('[MSK.MIGRATE] dailyPoints BEFORE:', dailyPoints);
    const newDailyPoints = {};
    Object.entries(dailyPoints).forEach(([date, value]) => {
      const mskDate = toMSKDate(new Date(date + 'T00:00:00Z'));
      newDailyPoints[mskDate] = (newDailyPoints[mskDate] || 0) + value;
      console.log(`[MSK.MIGRATE] ${date} (UTC) -> ${mskDate} (MSK): ${value}`);
    });
    localStorage.setItem('dailyPoints', JSON.stringify(newDailyPoints));
    console.log('[MSK.MIGRATE] dailyPoints AFTER:', newDailyPoints);

    // Миграция dailyBonusPoints
    const bonusRaw = localStorage.getItem('dailyBonusPoints') || '{}';
    const bonus = JSON.parse(bonusRaw);
    const newBonus = {};
    Object.entries(bonus).forEach(([date, value]) => {
      const mskDate = toMSKDate(new Date(date + 'T00:00:00Z'));
      newBonus[mskDate] = (newBonus[mskDate] || 0) + value;
    });
    localStorage.setItem('dailyBonusPoints', JSON.stringify(newBonus));

    // Миграция dailyDayBonusPoints
    const dayBonusRaw = localStorage.getItem('dailyDayBonusPoints') || '{}';
    const dayBonus = JSON.parse(dayBonusRaw);
    const newDayBonus = {};
    Object.entries(dayBonus).forEach(([date, value]) => {
      const mskDate = toMSKDate(new Date(date + 'T00:00:00Z'));
      newDayBonus[mskDate] = (newDayBonus[mskDate] || 0) + value;
    });
    localStorage.setItem('dailyDayBonusPoints', JSON.stringify(newDayBonus));

    // Миграция studyStreak
    const streakRaw = localStorage.getItem('studyStreak') || '{}';
    const streak = JSON.parse(streakRaw);
    if (streak.lastDate) {
      streak.lastDate = toMSKDate(new Date(streak.lastDate + 'T00:00:00Z'));
      localStorage.setItem('studyStreak', JSON.stringify(streak));
    }

    // Миграция srsProgress (lastReviewed)
    const progressRaw = localStorage.getItem('srsProgress') || '{}';
    const progress = JSON.parse(progressRaw);
    Object.values(progress).forEach(p => {
      if (p.lastReviewed) {
        p.lastReviewed = toMSKDate(new Date(p.lastReviewed + 'T00:00:00Z'));
      }
    });
    localStorage.setItem('srsProgress', JSON.stringify(progress));

    localStorage.setItem('mskMigrated', 'true');
    console.log('[MSK Migration] Complete!');
    return true;
  } catch (e) {
    console.error('[MSK Migration] Error:', e);
    return false;
  }
}

// Read progress and stats from localStorage
function readJSON(key, fallback = {}) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
}

export function getProgressMap() {
  return readJSON('srsProgress', {});
}

/**
 * Расчёт среднего времени прохождения карточки (в секундах)
 * на основе последних 40 пройденных карточек
 * @returns {number} среднее время в секундах (округлено до целого)
 */
export function getAverageCardTime(sampleSize = 40) {
  const progressMap = getProgressMap();
  const cards = Object.values(progressMap);
  
  // Фильтруем карточки у которых есть lastReviewedTime
  const cardsWithTime = cards.filter(p => p && typeof p.lastReviewedTime === 'number');
  
  if (cardsWithTime.length === 0) {
    return 90; // Значение по умолчанию (1.5 минуты) если нет данных
  }
  
  // Сортируем по lastReviewed (дате) чтобы взять последние
  cardsWithTime.sort((a, b) => {
    const dateA = a.lastReviewed || '';
    const dateB = b.lastReviewed || '';
    return dateB.localeCompare(dateA); // По убыванию (сначала новые)
  });
  
  // Берём последние sampleSize карточек
  const recentCards = cardsWithTime.slice(0, sampleSize);
  
  // Считаем среднее время
  const totalTime = recentCards.reduce((sum, card) => sum + (card.lastReviewedTime || 0), 0);
  const avgTime = totalTime / recentCards.length;
  
  return Math.round(avgTime); // Возвращаем в секундах
}

export function getStudyStats() {
  return readJSON('studyStats', { total: 0, correct: 0, points: 0 });
}

export function getStudyStreak() {
  // 🔥 Считаем стрик по dailyPoints (XP > 0), а не из studyStreak
  // Это обеспечивает консистентность с графиком активности
  const dpRaw = localStorage.getItem('dailyPoints') || '{}';
  const daily = (() => { try { return JSON.parse(dpRaw); } catch { return {}; } })();
  
  const dates = Object.keys(daily).sort();
  if (dates.length === 0) {
    return { current: 0, best: 0, lastDate: null };
  }
  
  // Считаем текущий стрик (последовательные дни с XP > 0 до сегодня)
  const today = toMSKDate(new Date());
  let current = 0;
  let best = 0;
  let tempStreak = 0;
  
  // Проходим по всем дням и считаем стрики
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const xp = daily[date] || 0;
    
    if (xp > 0) {
      tempStreak++;
      best = Math.max(best, tempStreak);
      
      // Если это сегодня, то это текущий стрик
      if (date === today) {
        current = tempStreak;
      }
    } else {
      tempStreak = 0;
    }
  }
  
  // Если сегодня ещё не было XP, но вчера был стрик, проверяем был ли вчера
  if (current === 0) {
    const yesterdayTime = new Date();
    yesterdayTime.setDate(yesterdayTime.getDate() - 1);
    const yesterday = toMSKDate(yesterdayTime);
    
    // Если вчера был XP > 0, то текущий стрик = последний темп стрик (он был прерван сегодня)
    if (daily[yesterday] > 0) {
      current = tempStreak;
    }
  }
  
  return { current, best, lastDate: dates[dates.length - 1] || null };
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

  // --- Progress tracking for achievements ---
  const progress = {};

  // Streak progress
  progress.streak7 = Math.min(7, streak.current || 0);
  progress.streak14 = Math.min(14, streak.current || 0);
  progress.streak30 = Math.min(30, streak.current || 0);
  progress.streak100 = Math.min(100, streak.current || 0);

  // Cards progress - считаем только карточки с 5 сердечками (EF >= 2.4)
  const fiveHeartsCount = Object.values(prog).filter(p => (p.easeFactor || 0) >= 2.4).length;
  progress.cards50 = Math.min(50, fiveHeartsCount);
  progress.cards100 = Math.min(100, fiveHeartsCount);

  // Accuracy progress - show correct answers count out of total questions (90)
  const totalQuestions = (window.uniqueQaData && window.uniqueQaData.length) || 90;
  progress.accuracy90 = Math.min(totalQuestions, stats.correct || 0);

  // Level progress
  const levelInfo = getCurrentLevel();
  progress.level5 = Math.min(5, levelInfo.level);
  progress.level10 = Math.min(10, levelInfo.level);

  // Hard to Easy progress
  let hardToEasyCount = 0;
  Object.values(prog).forEach(p => {
    if ((p.easeFactor || 0) >= 2.4 && p.historyArray) {
      const hasBadHistory = p.historyArray.some(h => h.grade === 1 || h.grade === 2);
      if (hasBadHistory) hardToEasyCount++;
    }
  });
  progress.hardToEasy = Math.min(10, hardToEasyCount);
  if (!ach.hardToEasy && hardToEasyCount >= 10) ach.hardToEasy = true;

  // --- Time-based achievements (using MSK time) ---
  let earlyBirdCount = 0; // Cards reviewed before 9:00
  let nightRaiderCount = 0; // Cards reviewed after 23:00

  Object.values(prog).forEach(p => {
    if (p.lastReviewDate) {
      const d = new Date(p.lastReviewDate);
      const h = d.getHours();
      if (h >= 4 && h < 9) earlyBirdCount++;
      if (h >= 23 || h < 4) nightRaiderCount++;
    }
  });

  // Ранняя пташка: 25+ карточек до 9:00
  progress.earlyBird = Math.min(25, earlyBirdCount);
  if (!ach.earlyBird && earlyBirdCount >= 25) ach.earlyBird = true;

  // Ночной рейдер: 50+ карточек после 23:00
  progress.nightRaider = Math.min(50, nightRaiderCount);
  if (!ach.nightRaider && nightRaiderCount >= 50) ach.nightRaider = true;

  // --- Comeback achievement (7+ days break, then 10+ cards) ---
  const todayStr = getMSKDate();
  const reviewedToday = Object.values(prog).filter(p => p.lastReviewed === todayStr);
  if (!ach.comeback && reviewedToday.length >= 10) {
    // Check if there was a gap of 7+ days before today
    const daily = JSON.parse(localStorage.getItem('dailyPoints') || '{}');
    const dates = Object.keys(daily).sort();
    if (dates.length >= 2) {
      const last = new Date(dates[dates.length - 1]);
      const prev = new Date(dates[dates.length - 2]);
      const diff = (last - prev) / (1000 * 60 * 60 * 24);
      if (diff >= 7) ach.comeback = true;
    }
  }
  // Progress for comeback (days since last activity if on break)
  progress.comebackDays = 0;
  progress.comebackCards = Math.min(10, reviewedToday.length);

  // --- Standard achievements ---
  if (!ach.firstSessionCompleted && stats.total > 0) ach.firstSessionCompleted = true;
  progress.firstSession = stats.total > 0 ? 1 : 0;

  if (!ach.sevenDayStreak && (streak.current || 0) >= 7) ach.sevenDayStreak = true;
  if (!ach.consistency && (streak.current || 0) >= 14) ach.consistency = true;
  if (!ach.marathoner && (streak.current || 0) >= 30) ach.marathoner = true;
  if (!ach.unstoppable && (streak.current || 0) >= 100) ach.unstoppable = true;

  // Снайпер: 90+ правильных ответов из всех вопросов
  if (!ach.ninetyAccuracy && (stats.correct || 0) >= totalQuestions) ach.ninetyAccuracy = true;

  // Достижения за карточки с 5 сердечками
  if (!ach.fiftyCards && fiveHeartsCount >= 50) ach.fiftyCards = true;
  if (!ach.century && fiveHeartsCount >= 100) ach.century = true;

  if (!ach.guru && levelInfo.level >= 5) ach.guru = true;
  if (!ach.master && levelInfo.level >= 10) ach.master = true;

  // Removed: earlyBird (old), nightOwl, weekendWarrior, comeback (old)
  // Keep legacy keys for backward compatibility but don't check them

  localStorage.setItem('studyAchievements', JSON.stringify(ach));
  localStorage.setItem('achievementProgress', JSON.stringify(progress));
  syncWithServer(); // Sync achievements to server
  return { achievements: ach, progress };
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

  // Получаем все карточки для расчёта общего количества
  let allCards = [];
  try {
    const sessionUserRaw = localStorage.getItem('qaSessionUser');
    if (sessionUserRaw) {
      const userCardsRaw = localStorage.getItem('qaUserCards');
      if (userCardsRaw) {
        allCards = JSON.parse(userCardsRaw);
      }
    }
    if (!allCards || allCards.length === 0) {
      allCards = window.uniqueQaData || [];
    }
  } catch (e) {
    allCards = window.uniqueQaData || [];
  }

  // Считаем распределение сердечек для пройденных карточек
  const studiedQuestions = new Set();
  Object.values(prog).forEach(p => {
    if (!p.lastReviewed) return;
    const ef = p.easeFactor || 2.5;
    studiedQuestions.add(p.question || Object.keys(prog).find(key => prog[key] === p));
    if (ef < 1.7) dist[1]++;
    else if (ef < 2.0) dist[2]++;
    else if (ef < 2.3) dist[3]++;
    else if (ef < 2.6) dist[4]++;
    else dist[5]++;
  });

  // Непройденные карточки считаем как 0 сердечек (добавляем к dist[1] для правильного расчёта)
  const totalCards = Array.isArray(allCards) ? allCards.length : 0;
  const unstudiedCount = Math.max(0, totalCards - studiedQuestions.size);
  dist[1] += unstudiedCount;

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
  const score = (dist[1] * 0 + dist[2] * 0.25 + dist[3] * 0.5 + dist[4] * 0.75 + dist[5] * 1.0);
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
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 3);
}

// Авто-миграция старых данных из UTC в MSK при загрузке
try {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    migrateToMSK();
  }
} catch (e) {
  console.error('[MSK Auto-Migrate] Error:', e);
}
