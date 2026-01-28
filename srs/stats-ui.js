import { getMetrics, calculateActivity, getCategoryProgress, checkAchievements, getCurrentLevel, getDailyPoints, getDailyPointsAll, getDailyStreakSeries } from './stats-utils.js?v=3';
import { getProgressMap, syncFavorite } from './storage.js';
import { getDifficultyLevel, getLevelProgress } from './algorithm.js';
import { uniqueQaData } from '../all-data.js';
import { getTodaysSession } from './category-scheduler.js';
import { startLearnSession } from './learn-ui.js?v=33';

let statsContainer = null;
let mainContainer = null;
let currentXpMode = 'week';
let isDiffExpanded = false;
let areCatsExpanded = false;

// --- STYLES ---
const STATS_STYLES = `
:root {
  --st-bg: #0E1117;
  --st-surf: #161B22;
  --st-surf-h: #1F2630;
  --st-prim: #FF9F1C;
  --st-sec: #2EC4B6;
  --st-danger: #E5533D;
  --st-muted: #8B949E;
  --st-text: #E6EDF3;
  --st-text-sec: #9BA3AF;
  --st-border: #222938;
  --st-font: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

#stats-container {
  background-color: var(--st-bg);
  color: var(--st-text);
  font-family: var(--st-font);
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  z-index: 2000;
  padding: 0;
  box-sizing: border-box;
}

.st-wrapper {
  max-width: 600px; /* Mobile-first constraint */
  margin: 0 auto;
  padding: 32px; /* Increased from 20px */
  padding-bottom: 100px; /* Space for sticky CTA */
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Header */
.st-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 16px;
  padding: 10px 0;
}
.st-header-title {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}
.st-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.st-auth-btn {
  /* nav-icon-btn styles will apply via class */
}
.st-home-btn {
  /* nav-icon-btn styles will apply via class */
}

/* HERO Section */
.st-hero {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.st-level-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.st-lvl-num { font-size: 20px; font-weight: 700; color: #fff; }
.st-lvl-xp { font-size: 14px; color: var(--st-muted); }

.st-hero-bar-bg {
  height: 10px;
  background: var(--st-surf-h);
  border-radius: 5px;
  overflow: hidden;
}
.st-hero-bar-fill {
  height: 100%;
  background: var(--st-prim);
  border-radius: 5px;
  transition: width 0.5s ease-out;
}

.st-hero-stats {
  display: flex;
  gap: 20px;
  margin-top: 8px;
}
.st-hero-stat {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
  color: #fff;
}
.st-hero-icon { font-size: 18px; }

/* Sticky CTA */
.st-sticky-cta-wrapper {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  padding: 16px 20px 32px;
  background: linear-gradient(to top, var(--st-bg) 80%, transparent);
  z-index: 2010;
  display: flex;
  justify-content: center;
  pointer-events: none; /* Let clicks pass through transparent area */
  box-sizing: border-box; /* Fix width overflow */
}
.st-cta-btn {
  pointer-events: auto;
  background: var(--st-prim);
  color: #000;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 12px;
  padding: 16px 32px;
  width: 100%; /* Full width on mobile */
  max-width: 600px;
  box-shadow: 0 4px 12px rgba(255, 159, 28, 0.3);
  cursor: pointer;
  transition: transform 0.1s, background 0.2s;
}
.st-cta-btn:active { transform: scale(0.98); }
.st-cta-btn:hover { background: #ffa833; }

/* Progress Cards */
.st-prog-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.st-card {
  background: var(--st-surf);
  border: 1px solid var(--st-border);
  border-radius: 12px;
  padding: 16px;
  transition: background 0.2s;
}
.st-card:hover { background: var(--st-surf-h); }
.st-card-label { font-size: 14px; color: var(--st-muted); margin-bottom: 4px; }
.st-card-val { font-size: 20px; font-weight: 600; color: var(--st-text); }
.st-card-sub { font-size: 12px; color: var(--st-text-sec); margin-top: 2px; }

/* Collapsible Section */
.st-collapsible-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  padding: 8px 0;
}
.st-col-title { font-size: 16px; font-weight: 600; color: #fff; }
.st-col-arrow { transition: transform 0.3s; color: var(--st-muted); }
.st-col-arrow.expanded { transform: rotate(180deg); }

/* Difficulty Bar */
.st-diff-bar-wrap {
  height: 8px;
  background: var(--st-surf-h);
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  margin-top: 12px;
}
.st-diff-seg { height: 100%; }
.st-diff-seg.red { background: var(--st-danger); }
.st-diff-seg.orange { background: var(--st-prim); }
.st-diff-seg.green { background: var(--st-sec); }
.st-diff-seg.blue { background: #2f81f7; }

.st-diff-list {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  animation: slideDown 0.3s ease-out;
}
@keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

.st-diff-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--st-surf-h);
  border-radius: 8px;
  cursor: pointer;
}
.st-diff-item:hover { background: #262c36; }
.st-diff-dot { width: 8px; height: 8px; border-radius: 50%; margin-right: 12px; }
.st-diff-name { flex: 1; font-size: 14px; color: var(--st-text); }
.st-diff-count { font-size: 14px; font-weight: 600; color: #fff; }

/* Activity & XP */
.st-xp-tabs {
  display: flex;
  background: var(--st-surf);
  border-radius: 8px;
  padding: 4px;
  margin-bottom: 16px;
}
.st-xp-tab {
  flex: 1;
  text-align: center;
  padding: 8px;
  font-size: 13px;
  color: var(--st-muted);
  border-radius: 6px;
  cursor: pointer;
  transition: color 0.2s;
}
.st-xp-tab.active {
  background: var(--st-surf-h);
  color: #fff;
  font-weight: 600;
}

.st-xp-chart-container {
  height: 200px;
  margin-bottom: 20px;
}
.st-xp-chart {
  height: 100%;
  display: flex;
  align-items: flex-end;
  gap: 4px;
  padding-left: 0; 
}
.st-xp-col {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  position: relative;
}
.st-xp-bar {
  width: 100%;
  background: var(--st-prim);
  border-radius: 4px 4px 0 0;
  opacity: 0.8;
  min-height: 2px;
}
.st-xp-bar.today { background: #fff; opacity: 1; }
.st-xp-col:hover .st-xp-bar { opacity: 1; }

/* Categories */
.st-cat-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.st-cat-item {
  background: var(--st-surf);
  border-radius: 8px;
  padding: 12px;
}
.st-cat-head { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; color: #fff; }
.st-cat-bg { height: 6px; background: var(--st-surf-h); border-radius: 3px; overflow: hidden; }
.st-cat-fill { height: 100%; background: var(--st-sec); border-radius: 3px; }

/* Achievements */
.st-ach-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.st-ach-card {
  background: var(--st-surf);
  border: 1px solid var(--st-border);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  opacity: 0.4;
  filter: grayscale(100%);
}
.st-ach-card.unlocked {
  opacity: 1;
  filter: none;
  background: rgba(46, 196, 182, 0.05);
  border-color: var(--st-sec);
}
.st-ach-icon { font-size: 28px; margin-bottom: 8px; }
.st-ach-title { font-size: 13px; font-weight: 600; color: #fff; margin-bottom: 4px; }
.st-ach-desc { font-size: 11px; color: var(--st-muted); }

/* Modal */
.st-modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.8);
  z-index: 2200;
  display: flex; justify-content: center; align-items: center;
  backdrop-filter: blur(4px);
}
.st-modal {
  background: var(--st-bg);
  border: 1px solid var(--st-border);
  border-radius: 16px;
  width: 90%; max-width: 500px;
  max-height: 80vh;
  display: flex; flex-direction: column;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}
.st-modal-header {
  padding: 16px;
  border-bottom: 1px solid var(--st-border);
  display: flex; justify-content: space-between; align-items: center;
}
.st-modal-title { font-size: 18px; font-weight: 600; color: #fff; }
.st-modal-close { background: none; border: none; color: var(--st-muted); cursor: pointer; font-size: 24px; }
.st-modal-body {
  padding: 0;
  overflow-y: auto;
  flex: 1;
}
.st-modal-list { list-style: none; padding: 0; margin: 0; }
.st-modal-item {
  padding: 12px 16px;
  border-bottom: 1px solid var(--st-border);
  font-size: 14px;
  color: var(--st-text);
  display: block;
}
.st-modal-q { font-weight: 600; color: #fff; margin-bottom: 4px; display: block; }
.st-modal-a { color: var(--st-text-sec); font-size: 13px; display: block; margin-top: 4px; }
.st-modal-footer {
  padding: 16px;
  border-top: 1px solid var(--st-border);
  display: flex; justify-content: center;
}
.st-modal-btn {
  background: var(--st-prim); color: #000; font-weight: 600;
  padding: 12px 24px; border-radius: 8px; border: none; cursor: pointer;
  width: 100%;
}

/* Desktop Adaptation */
@media (min-width: 1024px) {
  .st-wrapper {
    max-width: 1280px;
    padding: 40px;
    display: grid;
    grid-template-columns: 2fr 1fr;
    /* Auto rows */
    gap: 24px;
    align-items: start;
  }
  
  /* Full Width Rows */
  .st-header { grid-column: 1 / -1; display: flex; justify-content: flex-start; gap: 16px; align-items: center; padding-bottom: 0; }
  .st-header::before { content: none; }

  .st-hero {
    grid-column: 1 / -1;
    flex-direction: row;
    align-items: center;
    background: var(--st-surf);
    padding: 32px;
    border-radius: 16px;
    border: 1px solid var(--st-border);
  }
  /* ... hero inner styles ... */
  .st-hero-left { flex: 1; display: flex; flex-direction: row; align-items: center; gap: 40px; }
  .st-level-row { flex-direction: column; align-items: flex-start; min-width: 140px; }
  .st-hero-bar-bg { margin-top: 0 !important; flex: 1; height: 12px; }
  .st-hero-stats { margin-top: 0; gap: 40px; }
  
  .st-sticky-cta-wrapper {
    position: static;
    background: none;
    padding: 0;
    width: auto;
    display: block;
    margin-left: 40px;
  }
  .st-cta-btn {
    width: auto;
    padding: 14px 40px;
    font-size: 15px;
    background: var(--st-prim);
    color: #0E1117;
    box-shadow: none;
    min-width: 200px;
  }

  /* Progress Cards (Row 3) */
  .st-prog-stack {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
  }
  .st-card { padding: 24px; }

  /* Main Content Columns (Row 4+) */
  
  /* Activity: Left Column */
  .st-activity-section {
    grid-column: 1 / 2;
    /* Remove explicit grid-row to allow natural flow */
    background: var(--st-surf);
    padding: 32px;
    border-radius: 16px;
    border: 1px solid var(--st-border);
    height: auto; /* Allow auto height */
  }
  .st-xp-chart-container { height: 300px; } /* Slightly reduced height */
  .st-collapsible-header { cursor: default; pointer-events: none; margin-bottom: 24px; }
  .st-col-arrow { display: none; }
  .st-col-title { font-size: 18px; }

  /* Right Column Stack */
  .st-diff-section, .st-cat-section {
    grid-column: 2 / 3;
    background: var(--st-surf);
    padding: 24px;
    border-radius: 16px;
    border: 1px solid var(--st-border);
  }
  
  /* Achievements: Full Width at Bottom */
  .st-ach-section {
    grid-column: 1 / -1;
    background: var(--st-surf);
    padding: 32px;
    border-radius: 16px;
    border: 1px solid var(--st-border);
    margin-top: 8px;
  }
  .st-ach-grid { grid-template-columns: repeat(4, 1fr); }

  /* Force Expand Content */
  .st-diff-bar-wrap { display: none !important; }
  .st-diff-list { display: flex !important; margin-top: 0; animation: none; opacity: 1; transform: none; }
  .st-cat-list { display: flex !important; }
  .st-cat-more-btn { display: none !important; }
  .st-cat-item-hidden { display: block !important; }
}
`;

export function initStatsPage(appVersion) {
  if (appVersion) window.currentAppVersion = appVersion;
  if (!document.getElementById('stats-container')) {
    const appWrapper = document.querySelector('.app-wrapper') || document.body;
    statsContainer = document.createElement('div');
    statsContainer.id = 'stats-container';
    appWrapper.appendChild(statsContainer);
    
    const styleEl = document.createElement('style');
    styleEl.textContent = STATS_STYLES;
    document.head.appendChild(styleEl);
  }
  
  mainContainer = document.querySelector('.container');
  if (mainContainer) mainContainer.style.display = 'none';
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.style.display = 'none';
  
  renderStats();
  
  if (!window._statsXpListener) {
    window._statsXpListener = () => {
      if (document.getElementById('stats-container')) renderStats();
    };
    window.addEventListener('xpUpdated', window._statsXpListener);
    window.addEventListener('dataLoaded', window._statsXpListener);
  }

  if (!location.hash || !location.hash.includes('stats')) {
    location.hash = '#/stats';
  }
}

export function hideStatsPage() {
  if (statsContainer) statsContainer.remove();
  
  if (!mainContainer) mainContainer = document.querySelector('.container');
  if (mainContainer) mainContainer.style.display = '';
  
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.style.display = '';
  
  if (location.hash && location.hash.includes('stats')) {
      location.hash = '';
  }
  const evt = new Event('statsClosed'); window.dispatchEvent(evt);
}

function renderStats() {
  let level, metrics, achievements, top5, rest;
  try { level = getCurrentLevel(); } catch { level = { level: 1, xp: 0, remaining: 100, progress: 0 }; }
  try { metrics = getMetrics(uniqueQaData); } catch { metrics = { streakCurrent: 0, studiedCount: 0 }; }
  try { achievements = checkAchievements(); } catch { achievements = {}; }
  try { ({ top5, rest } = getCategoryProgress(uniqueQaData)); } catch { top5=[]; rest=[]; }
  
  // Daily Plan
  let planMins = 0;
  let sessionCount = 0;
  let todaysSession = [];
  try {
      todaysSession = getTodaysSession(uniqueQaData || []);
      sessionCount = todaysSession.length;
      planMins = Math.ceil(sessionCount * 1.5);
  } catch {}

  const totalCards = uniqueQaData ? uniqueQaData.length : 0;
  const studiedCards = metrics.studiedCount || 0;
  const remainingCards = Math.max(0, totalCards - studiedCards);
  
  // Forecast
  const activeDaysForSpeed = metrics.studiedCount > 0 ? (metrics.xp / 50) : 1; // Approx
  const speed = 12; // Hardcoded fallback or calc
  const daysToFinish = speed > 0 ? Math.ceil(remainingCards / speed) : 999;
  const today = new Date();
  const finishDate = new Date();
  finishDate.setDate(today.getDate() + daysToFinish);
  const finishDateStr = finishDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });

  const progressMap = getProgressMap();
  const xpSeries = getXpSeries(currentXpMode);

  const lvlProgressPct = Math.max(0, Math.min(1, level.progress || 0)) * 100;
  const remainingXp = Math.max(0, Math.round(level.remaining || 0));

  const todayStr = new Date().toISOString().split('T')[0];
  let cardsDoneToday = 0;
  
  // Calculate Difficulty Distribution
   const segs = [
      { label: 'Очень трудные', min: 0, max: 1.7, count: 0, color: 'var(--st-diff-hard)', colorClass: 'st-diff-seg-hard' },
      { label: 'Трудные', min: 1.7, max: 2.1, count: 0, color: 'var(--st-diff-high)', colorClass: 'st-diff-seg-high' },
      { label: 'Стандарт', min: 2.1, max: 2.4, count: 0, color: 'var(--st-diff-std)', colorClass: 'st-diff-seg-std' },
      { label: 'Легкие', min: 2.4, max: 999, count: 0, color: 'var(--st-diff-easy)', colorClass: 'st-diff-seg-easy' }
   ];
  
  let totalRated = 0;
  let favCount = 0;
  const favorites = new Set(JSON.parse(localStorage.getItem('qaFavorites') || '[]'));

  uniqueQaData.forEach(q => {
     if (favorites.has(q.question)) favCount++;

     let p = progressMap[q.question];
     // Try trimmed lookup if direct failed
     if (!p && q.question) p = progressMap[q.question.trim()];

     // Count today's activity
     if (p && p.lastReviewed === todayStr) {
         cardsDoneToday++;
     }

     // Only count difficulty for cards with actual progress
     // Unstudied/New cards are excluded from the difficulty distribution
     if (p && p.easeFactor !== undefined) {
         const ef = p.easeFactor;
         
         if (ef < 1.7) segs[0].count++;
         else if (ef < 2.1) segs[1].count++;
         else if (ef < 2.4) segs[2].count++;
         else segs[3].count++;
         totalRated++;
     }
  });
  
  segs.forEach(s => {
     s.pct = totalRated > 0 ? (s.count / totalRated) * 100 : 0;
  });

  const html = `
    <div class="st-wrapper">
      <!-- Header -->
      <div class="st-header">
        <div class="st-header-right">
          <button class="st-home-btn nav-icon-btn" onclick="document.dispatchEvent(new Event('closeStats'))" title="На главную">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </button>
          <button class="st-auth-btn nav-icon-btn" id="st-auth-btn"></button>
          ${window.currentAppVersion ? `<span style="font-size:10px;color:var(--st-text-sec);opacity:0.5;margin-left:4px;">v${window.currentAppVersion}</span>` : ''}
        </div>
        <div class="st-header-title">Статистика</div>
      </div>

      <!-- HERO -->
      <div class="st-hero">
        <div class="st-hero-left">
          <div class="st-level-row">
            <div class="st-lvl-num">Уровень ${level.level}</div>
            <div class="st-lvl-xp">${remainingXp} XP до следующего</div>
          </div>
          <div class="st-hero-bar-bg" style="margin-top:8px">
            <div class="st-hero-bar-fill" style="width: ${lvlProgressPct}%"></div>
          </div>
          <div class="st-hero-stats">
            <div class="st-hero-stat"><span class="st-hero-icon">🔥</span> ${metrics.streakCurrent} дн</div>
            <div class="st-hero-stat"><span class="st-hero-icon">⏱</span> ${planMins} мин</div>
            <div class="st-hero-stat"><span class="st-hero-icon">📚</span> ${cardsDoneToday} карт</div>
          </div>
        </div>
        
        <!-- Desktop CTA placement (hidden on mobile via CSS if needed, but here simplified) -->
        <div class="st-sticky-cta-wrapper">
           <button class="st-cta-btn" onclick="window.startDailySession()">
             ${sessionCount > 0 ? 'НАЧАТЬ ОБУЧЕНИЕ' : 'УЧИТЬ ВСЕ'}
           </button>
        </div>
      </div>

      <!-- SHORT PROGRESS -->
      <div class="st-prog-stack">
        <div class="st-card">
           <div class="st-card-label">Осталось</div>
           <div class="st-card-val">${remainingCards} <span style="font-size:14px;color:var(--st-text-sec)">/ ${totalCards}</span></div>
           <div class="st-card-sub">карточек</div>
        </div>
        <div class="st-card">
           <div class="st-card-label">Прогноз</div>
           <div class="st-card-val">${finishDateStr}</div>
           <div class="st-card-sub">завершение курса</div>
        </div>
        <div class="st-card">
           <div class="st-card-label">Цель</div>
           <div class="st-card-val">${daysToFinish}</div>
           <div class="st-card-sub">дней осталось</div>
        </div>
      </div>

      <!-- DIFFICULTY (Collapsible) -->
      <div class="st-diff-section">
        <div class="st-collapsible-header" onclick="window.toggleDiff()">
           <div class="st-col-title">
               Сложность карточек
               <button class="st-info-btn" onclick="event.stopPropagation(); window.toggleDiffInfo()" title="Как это работает?" style="pointer-events: auto; background:none;border:none;cursor:pointer;font-size:20px;padding:4px 8px;margin-left:8px;opacity:0.9;color:var(--st-text-sec)">ℹ️</button>
           </div>
           <div class="st-col-arrow ${isDiffExpanded ? 'expanded' : ''}">▼</div>
        </div>
        
        <div class="st-diff-bar-wrap" style="display: ${isDiffExpanded ? 'none' : 'flex'}">
           ${segs.map(s => `<div class="st-diff-seg ${s.colorClass}" style="width:${s.pct}%"></div>`).join('')}
        </div>

        <div class="st-diff-list" style="display: ${isDiffExpanded ? 'flex' : 'none'}">
           ${segs.map(s => `
             <div class="st-diff-item" onclick="window.openDiffModal('${s.label}', '${s.colorClass}')" style="border-left: 3px solid ${s.color}; background: rgba(255,255,255,0.03);">
               <div style="display:flex;align-items:center;gap:12px">
                 <div class="st-diff-dot" style="background:${s.color}"></div>
                 <div class="st-diff-name" style="color:${s.color}">${s.label}</div>
               </div>
               <div class="st-diff-count">${s.count}</div>
             </div>
           `).join('')}
           
           <!-- Favorites Item -->
           <div class="st-diff-item" onclick="window.openDiffModal('Избранное', 'gold')" style="border-left: 3px solid #ffd700; background: rgba(255,215,0,0.05); margin-top: 8px;">
               <div style="display:flex;align-items:center;gap:12px">
                 <div class="st-diff-dot" style="background:#ffd700"></div>
                 <div class="st-diff-name" style="color:#ffd700">Избранное</div>
               </div>
               <div class="st-diff-count">${favCount}</div>
           </div>
        </div>
      </div>

      <!-- ACTIVITY & XP -->
      <div class="st-activity-section">
         <div class="st-collapsible-header">
           <div class="st-col-title">Активность</div>
         </div>
         <div class="st-xp-tabs">
            <div class="st-xp-tab ${currentXpMode==='week'?'active':''}" onclick="window.setXpMode('week')">Неделя</div>
            <div class="st-xp-tab ${currentXpMode==='month'?'active':''}" onclick="window.setXpMode('month')">Месяц</div>
            <div class="st-xp-tab ${currentXpMode==='year'?'active':''}" onclick="window.setXpMode('year')">Год</div>
         </div>
         
         <div class="st-xp-chart-container">
            <div class="st-xp-chart">
               ${xpSeries.map(col => {
                  const h = (col.val / (Math.max(...xpSeries.map(x=>x.val)) || 1)) * 100;
                  return `
                  <div class="st-xp-col" title="${col.date}: ${col.val} XP">
                     <div class="st-xp-bar ${col.isToday?'today':''}" style="height:${h}%"></div>
                  </div>
                  `;
               }).join('')}
            </div>
         </div>
      </div>

      <!-- CATEGORIES -->
      <div class="st-cat-section">
         <div class="st-collapsible-header" onclick="window.toggleCats()">
            <div class="st-col-title">Категории</div>
            <div class="st-col-arrow ${areCatsExpanded ? 'expanded' : ''}">▼</div>
         </div>
         <div class="st-cat-list">
            ${top5.map(c => `
              <div class="st-cat-item">
                 <div class="st-cat-head">
                    <span>${c.category}</span>
                    <span>${c.percent}%</span>
                 </div>
                 <div class="st-cat-bg">
                    <div class="st-cat-fill" style="width:${c.percent}%"></div>
                 </div>
              </div>
            `).join('')}
            
            ${rest.map(c => `
              <div class="st-cat-item st-cat-item-hidden" style="display: ${areCatsExpanded ? 'block' : 'none'}">
                 <div class="st-cat-head">
                    <span>${c.category}</span>
                    <span>${c.percent}%</span>
                 </div>
                 <div class="st-cat-bg">
                    <div class="st-cat-fill" style="width:${c.percent}%"></div>
                 </div>
              </div>
            `).join('')}
            
            ${rest.length > 0 ? `
              <div class="st-cat-more-btn" style="text-align:center; padding:10px; color:var(--st-prim); cursor:pointer; display:${areCatsExpanded ? 'none' : 'block'}" onclick="window.toggleCats()">
                 Показать ещё (${rest.length})
              </div>
            ` : ''}
         </div>
      </div>

      <!-- ACHIEVEMENTS -->
      <div class="st-ach-section">
         <div class="st-section-title" style="margin-bottom:16px;color:#fff;font-weight:600">Достижения</div>
         <div class="st-ach-grid">
            <div class="st-ach-card ${achievements.firstSessionCompleted ? 'unlocked' : ''}">
               <div class="st-ach-icon">🏁</div>
               <div class="st-ach-title">Первый шаг</div>
               <div class="st-ach-desc">Заверши первый урок</div>
            </div>
            <div class="st-ach-card ${achievements.sevenDayStreak ? 'unlocked' : ''}">
               <div class="st-ach-icon">🔥</div>
               <div class="st-ach-title">В огне</div>
               <div class="st-ach-desc">Стрик 7 дней</div>
            </div>
            <div class="st-ach-card ${achievements.ninetyAccuracy ? 'unlocked' : ''}">
               <div class="st-ach-icon">🎯</div>
               <div class="st-ach-title">Снайпер</div>
               <div class="st-ach-desc">Точность 90%</div>
            </div>
            <div class="st-ach-card ${achievements.fiftyCards ? 'unlocked' : ''}">
               <div class="st-ach-icon">📚</div>
               <div class="st-ach-title">Эрудит</div>
               <div class="st-ach-desc">50 карточек</div>
            </div>
         </div>
      </div>

    </div>
  `;
  
  statsContainer.innerHTML = html;
  
  const authBtn = document.getElementById('st-auth-btn');
  if (authBtn) {
    const getUser = () => {
      try {
        const raw = localStorage.getItem('qaSessionUser') || sessionStorage.getItem('qaSessionUser') || '';
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    };
    const updateAuth = () => {
      const u = getUser();
      if (u) {
        authBtn.textContent = u.username || u.email || 'Выйти';
      } else {
        authBtn.textContent = 'Войти';
      }
    };
    authBtn.onclick = () => {
      const api = window.qaAuth || {};
      const u = getUser();
      if (u) {
        if (typeof api.logout === 'function') api.logout();
      } else {
        if (typeof api.openLogin === 'function') api.openLogin();
      }
      setTimeout(updateAuth, 300);
    };
    updateAuth();
  }
  
  // Handlers
  window.startDailySession = () => {
     if (sessionCount > 0) {
        hideStatsPage();
        // todaysSession returns wrappers {item, progress, isNew}, we need to pass raw items
        const rawSession = todaysSession.map(s => s.item || s);
        startLearnSession(rawSession);
     } else {
        // Start cram session
        hideStatsPage();
        startLearnSession(uniqueQaData, { mode: 'cram' });
     }
  };
  
  window.toggleDiff = () => {
     isDiffExpanded = !isDiffExpanded;
     renderStats();
  };
  
  window.toggleCats = () => {
     areCatsExpanded = !areCatsExpanded;
     renderStats();
  };
  
  window.setXpMode = (mode) => {
     currentXpMode = mode;
     renderStats();
  };

  window.toggleDiffInfo = () => {
    const el = document.getElementById('diff-info-modal');
    if (el) {
        el.remove();
        return;
    }
    
    const renderHeartsEx = (count) => {
        let html = '<div style="display:flex; gap:2px;">';
        for (let i = 0; i < 5; i++) {
            const color = i < count ? '#ff4d4d' : '#444';
            html += `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="${color}">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>`;
        }
        html += '</div>';
        return html;
    };

    const html = `
      <div class="st-modal-overlay" id="diff-info-modal" onclick="window.toggleDiffInfo()" style="z-index: 2200;">
        <div class="st-modal" onclick="event.stopPropagation()">
           <div class="st-modal-header">
             <div class="st-modal-title">Сложность карточек</div>
             <button class="st-modal-close" onclick="window.toggleDiffInfo()">✕</button>
           </div>
           <div class="st-modal-body" style="font-size:14px;line-height:1.5;color:var(--st-text-sec);padding:24px;">
             <p style="margin-bottom:12px">Количество сердечек показывает, насколько хорошо вы помните карточку (Ease Factor):</p>
             <ul style="display:flex;flex-direction:column;gap:12px;padding-left:0;list-style:none;margin:0">
               <li style="display:flex;gap:12px;align-items:start">
                 <div style="margin-top:4px;flex-shrink:0">${renderHeartsEx(1)}</div>
                 <div><strong style="color:var(--st-text)">Очень трудные</strong> (1 ❤️)<br>Вы часто ошибаетесь. Карточки повторяются часто.</div>
               </li>
               <li style="display:flex;gap:12px;align-items:start">
                 <div style="margin-top:4px;flex-shrink:0">${renderHeartsEx(2)}</div>
                 <div><strong style="color:var(--st-text)">Трудные</strong> (2 ❤️)<br>Требуют усилий. Интервалы растут медленно.</div>
               </li>
               <li style="display:flex;gap:12px;align-items:start">
                 <div style="margin-top:4px;flex-shrink:0">${renderHeartsEx(3)}</div>
                 <div><strong style="color:var(--st-text)">Стандарт</strong> (3 ❤️)<br>Обычный режим. Новые карточки начинаются здесь.</div>
               </li>
               <li style="display:flex;gap:12px;align-items:start">
                 <div style="margin-top:4px;flex-shrink:0">${renderHeartsEx(5)}</div>
                 <div><strong style="color:var(--st-text)">Легкие</strong> (4-5 ❤️)<br>Вы помните их отлично. Интервалы растут быстро.</div>
               </li>
             </ul>
           </div>
        </div>
      </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstElementChild);
  };
  
  window.openDiffModal = (label, colorClass) => {
      const progress = getProgressMap();
      let cards = [];

      if (label === 'Избранное') {
          const favorites = new Set(JSON.parse(localStorage.getItem('qaFavorites') || '[]'));
          cards = uniqueQaData.filter(q => q && q.question && q.answer && favorites.has(q.question));
      } else {
          let min = 0, max = 0;
          if (label === 'Очень трудные') { max = 1.7; }
          else if (label === 'Трудные') { min = 1.7; max = 2.1; }
          else if (label === 'Стандарт') { min = 2.1; max = 2.4; }
          else if (label === 'Легкие') { min = 2.4; max = 999; }

          // Use the same EF logic as in the chart: only cards with progress
          cards = uniqueQaData.filter(q => {
             // Ensure valid card data
             if (!q || !q.question || !q.answer) return false;

             let p = progress[q.question];
             if (!p && q.question) p = progress[q.question.trim()];
             
             // Filter out cards without progress (new cards)
             if (!p || p.easeFactor === undefined) return false;
             
             const ef = p.easeFactor;
             return ef >= min && ef < max;
          });
      }
      
      window._tempSessionCards = cards;

      const starSvg = (filled) => `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${filled ? '#ffd700' : 'none'}" stroke="${filled ? '#ffd700' : 'currentColor'}" stroke-width="2">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
        </svg>
      `;

      const renderHearts = (ef) => {
        // Расчет количества сердечек (1.0 - 5.0)
        let heartsCount = 0;
        if (ef < 1.7) {
            heartsCount = 1 + (ef - 1.3) / 0.4;
        } else if (ef < 2.1) {
            heartsCount = 2 + (ef - 1.7) / 0.4;
        } else if (ef < 2.4) {
            heartsCount = 3 + (ef - 2.1) / 0.3;
        } else {
            heartsCount = 4 + (ef - 2.4) / 0.5;
        }
        heartsCount = Math.max(1, Math.min(5, heartsCount));

        const level = getDifficultyLevel(ef);
        const levelNames = {
            'VERY_HARD': 'Очень трудные',
            'HARD': 'Трудные',
            'STANDARD': 'Стандарт',
            'EASY': 'Легкие'
        };
        const levelName = levelNames[level] || level;
        
        let html = '<div class="hearts-container" title="Уровень: ' + levelName + '\\nEF: ' + ef.toFixed(2) + '\\nСердечек: ' + heartsCount.toFixed(2) + '" style="display:flex; gap:2px;">';
        
        for (let i = 0; i < 5; i++) {
            let fill = 0;
            if (heartsCount >= i + 1) {
                fill = 1;
            } else if (heartsCount > i) {
                fill = heartsCount - i;
            }
            
            const stopVal = Math.round(fill * 100);
            const id = `heart-grad-${Math.random().toString(36).substr(2, 9)}`;
            
            html += `
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24">
                    <defs>
                        <linearGradient id="${id}">
                            <stop offset="${stopVal}%" stop-color="#ff4d4d" />
                            <stop offset="${stopVal}%" stop-color="#444" />
                        </linearGradient>
                    </defs>
                    <path fill="url(#${id})" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
            `;
        }
        html += '</div>';
        return html;
      };

      const favorites = new Set(JSON.parse(localStorage.getItem('qaFavorites') || '[]'));
      
      const listHtml = cards.length > 0 
        ? cards.map(c => {
            let p = progress[c.question];
            if (!p && c.question) p = progress[c.question.trim()];
            const ef = (p && p.easeFactor) ? p.easeFactor : 2.3;
            const isFav = favorites.has(c.question);

            return `
            <li class="st-modal-item" style="position:relative; padding-right: 40px;">
               <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                   <div class="st-modal-q" style="margin-bottom:0; flex:1; padding-right:8px;">${c.question}</div>
                   ${renderHearts(ef)}
               </div>
               <div class="st-modal-a">${c.answer || ''}</div>
               <button class="st-modal-fav-btn" data-q="${c.question.replace(/"/g, '&quot;')}" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; padding:4px;">
                   ${starSvg(isFav)}
               </button>
            </li>`;
        }).join('')
        : '<li style="padding:16px;color:#8b949e;text-align:center">Нет карточек в этой категории</li>';

      const modalHtml = `
        <div class="st-modal-overlay" onclick="closeDiffModal(event)">
          <div class="st-modal">
            <div class="st-modal-header">
              <div class="st-modal-title">${label} (${cards.length})</div>
              <button class="st-modal-close" onclick="closeDiffModal()">✕</button>
            </div>
            <div class="st-modal-body">
              <ul class="st-modal-list">${listHtml}</ul>
            </div>
            <div class="st-modal-footer">
               <button class="st-modal-btn" onclick="startFilteredSession()">
                 Начать обучение
               </button>
            </div>
          </div>
        </div>
      `;
      
      const div = document.createElement('div');
      div.id = 'diff-modal-container';
      div.innerHTML = modalHtml;
      document.body.appendChild(div);

      // Add event listeners for fav buttons
      div.querySelectorAll('.st-modal-fav-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const q = btn.dataset.q;
              const currentFavs = JSON.parse(localStorage.getItem('qaFavorites') || '[]');
              const index = currentFavs.indexOf(q);
              let newIsFav = false;
              
              if (index === -1) {
                  currentFavs.push(q);
                  newIsFav = true;
              } else {
                  currentFavs.splice(index, 1);
                  newIsFav = false;
              }
              
              localStorage.setItem('qaFavorites', JSON.stringify(currentFavs));
              syncFavorite(q, newIsFav);
              
              // Update UI
              btn.innerHTML = starSvg(newIsFav);
              
              // Dispatch event to update other parts of UI
              window.dispatchEvent(new Event('favoritesUpdated'));
          });
      });
  };
  
  window.closeDiffModal = (e) => {
     if (e && e.target && !e.target.classList.contains('st-modal-overlay') && !e.target.classList.contains('st-modal-close')) return;
     const el = document.getElementById('diff-modal-container');
     if (el) el.remove();
  };
  
  window.startFilteredSession = () => {
     const cards = window._tempSessionCards;
     if (!cards || cards.length === 0) {
        alert('Нет карточек');
        return;
     }
     window.closeDiffModal();
     hideStatsPage();
     startLearnSession(cards, { mode: 'cram' });
  };
  
  // Listen for close event from header
  document.addEventListener('closeStats', hideStatsPage);
}

// Helpers
function getXpSeries(mode) {
  const days = mode === 'week' ? 7 : (mode === 'month' ? 30 : 365);
  const data = getDailyPointsAll(); // returns array of {date, xp, ...}
  const today = new Date();
  const res = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const s = d.toISOString().split('T')[0];
    const entry = data.find(x => x.date === s) || { xp: 0 };
    res.push({
       date: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
       val: entry.xp,
       isToday: i === 0
    });
  }
  return res;
}
