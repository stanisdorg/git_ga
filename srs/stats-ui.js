import { getMetrics, calculateActivity, getCategoryProgress, checkAchievements, getCurrentLevel, getDailyPoints, getDailyPointsAll, getDailyStreakSeries } from './stats-utils.js?v=3';
import { getProgressMap } from './storage.js';
import { uniqueQaData } from '../all-data.js';
import { getTodaysSession } from './category-scheduler.js';
import { startLearnSession } from './learn-ui.js?v=4';

let statsContainer = null;
let mainContainer = null;
let currentXpMode = 'week';

// --- STYLES ---
const STATS_STYLES = `
:root {
  --st-bg: #0d1117;
  --st-surf: #161b22;
  --st-surf-h: #21262d;
  --st-border: #30363d;
  --st-text: #c9d1d9;
  --st-text-sec: #8b949e;
  --st-prim: #f78166;
  --st-acc-blue: #58a6ff;
  --st-acc-green: #3fb950;
  --st-acc-red: #da3633;
  --st-acc-gold: #d29922;
  --st-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
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
  padding: 20px;
  box-sizing: border-box;
}

.st-wrapper {
  max-width: 1000px;
  margin: 0 auto;
  padding-bottom: 60px;
}

/* Header */
.st-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.st-header-title { font-size: 24px; font-weight: 600; color: #fff; }
.st-close {
  background: none;
  border: none;
  color: var(--st-text-sec);
  font-size: 24px;
  cursor: pointer;
  padding: 0;
}
.st-close:hover { color: #fff; }

/* Common Block Style */
.st-block {
  background: var(--st-surf);
  border: 1px solid var(--st-border);
  border-radius: 6px;
  padding: 20px;
  margin-bottom: 20px;
}
.st-section-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 20px;
}

/* Level Block */
.st-level-block {
  /* Inherits st-block properties via HTML class if used, or keep separate */
  background: var(--st-surf);
  border: 1px solid var(--st-border);
  border-radius: 6px;
  padding: 20px;
  margin-bottom: 20px;
}
.st-level-top {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
}
.st-lvl-title { font-weight: 600; color: #fff; font-size: 16px; }
.st-lvl-rem { color: var(--st-text-sec); font-size: 12px; }

.st-progress-bar {
  height: 8px;
  background: var(--st-surf-h);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 20px;
}
.st-progress-fill {
  height: 100%;
  background: var(--st-prim);
  border-radius: 4px;
  transition: width 0.3s;
}

/* Info Grid */
.st-info-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}
.st-info-card {
  background: var(--st-surf-h);
  border: 1px solid var(--st-border);
  border-radius: 6px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.st-info-card.yellow-border { border: 1px solid var(--st-acc-gold); }

.st-info-row { display: flex; align-items: baseline; gap: 6px; }
.st-info-label { font-size: 11px; color: var(--st-text-sec); font-weight: 600; margin-bottom: 4px; }
.st-info-val-lg { font-size: 20px; font-weight: 700; color: #fff; line-height: 1.2; }
.st-info-sub { font-size: 10px; color: var(--st-text-sec); margin-top: 2px; }

/* Forecast Grid (Inside Block) */
.st-forecast-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}
.st-forecast-item { display: flex; flex-direction: column; gap: 4px; }
.st-forecast-label { font-size: 12px; color: var(--st-text-sec); }
.st-forecast-val { font-size: 18px; font-weight: 600; color: #fff; }
.st-forecast-sub { font-size: 11px; color: var(--st-text-sec); }

/* Difficulty Grid (Inside Block) */
.st-diff-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.st-diff-card {
  background: var(--st-surf-h); /* Lighter bg inside block */
  border: 1px solid var(--st-border);
  border-radius: 6px;
  padding: 12px;
  position: relative;
  overflow: hidden;
}
.st-diff-card::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
}
.st-diff-card.red::before { background: var(--st-acc-red); }
.st-diff-card.orange::before { background: var(--st-prim); }
.st-diff-card.green::before { background: var(--st-acc-green); }
.st-diff-card.blue::before { background: var(--st-acc-blue); }

.st-diff-title { font-size: 11px; font-weight: 600; margin-bottom: 6px; }
.st-diff-card.red .st-diff-title { color: var(--st-acc-red); }
.st-diff-card.orange .st-diff-title { color: var(--st-prim); }
.st-diff-card.green .st-diff-title { color: var(--st-acc-green); }
.st-diff-card.blue .st-diff-title { color: var(--st-acc-blue); }

.st-diff-val { font-size: 18px; font-weight: 700; color: #fff; }
.st-diff-sub { font-size: 10px; color: var(--st-text-sec); }

/* Simulator (Block) */
.st-sim-desc { font-size: 12px; color: var(--st-text-sec); margin-bottom: 20px; }
.st-sim-track-wrap {
  position: relative;
  height: 50px;
  margin-bottom: 24px;
  padding-top: 10px;
}
.st-sim-track {
  height: 24px;
  border-radius: 12px;
  background: linear-gradient(to right, 
    #da3633 0%, #da3633 20%, 
    #f78166 20%, #f78166 45%, 
    #3fb950 45%, #3fb950 65%, 
    #2f81f7 65%, #2f81f7 100%
  );
  position: relative;
  opacity: 0.9;
}
.st-sim-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 10px;
  font-weight: 600;
  padding: 0 4px;
}
.st-sim-labels span:nth-child(1) { color: #da3633; }
.st-sim-labels span:nth-child(2) { color: #f78166; }
.st-sim-labels span:nth-child(3) { color: #3fb950; }
.st-sim-labels span:nth-child(4) { color: #2f81f7; }

/* Custom Slider */
input[type=range].st-custom-range {
  -webkit-appearance: none;
  width: 100%;
  background: transparent;
  position: absolute;
  top: 10px; /* Match track top */
  left: 0;
  margin: 0;
  z-index: 10;
  height: 24px; /* Match track height */
}
input[type=range].st-custom-range:focus { outline: none; }
input[type=range].st-custom-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 32px;
  width: 16px;
  border-radius: 4px;
  background: #fff;
  border: 1px solid #ccc;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  margin-top: -4px; /* Center vertically relative to track (24px) -> (24-32)/2 = -4 */
}
.st-slider-val-bubble {
  position: absolute;
  top: -20px;
  background: #fff;
  color: #000;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  transform: translateX(-50%);
  pointer-events: none;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
.st-slider-val-bubble::after {
  content: ''; position: absolute; bottom: -4px; left: 50%; margin-left: -4px;
  border-width: 4px; border-style: solid;
  border-color: #fff transparent transparent transparent;
}

.st-sim-btns {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 20px;
}
.st-sim-btn {
  background: var(--st-surf-h);
  border: 1px solid var(--st-border);
  color: #fff;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 90px;
  transition: all 0.1s;
}
.st-sim-btn:active { transform: scale(0.98); }
.st-sim-btn.b-again { border-bottom: 2px solid var(--st-acc-red); }
.st-sim-btn.b-hard { border-bottom: 2px solid var(--st-prim); }
.st-sim-btn.b-good { border-bottom: 2px solid var(--st-acc-green); }
.st-sim-btn.b-easy { border-bottom: 2px solid var(--st-acc-blue); }

.st-sim-btn span:first-child { font-weight: 600; margin-bottom: 2px; }
.st-sim-btn span:last-child { font-size: 10px; opacity: 0.8; }
.st-sim-note { text-align: center; font-size: 11px; color: var(--st-text-sec); margin-top: 16px; }

/* Activity */
.st-heatmap-scroll {
  overflow-x: auto;
  padding-bottom: 10px;
}
.st-heatmap {
  display: grid;
  grid-template-rows: repeat(7, 10px);
  grid-auto-flow: column;
  gap: 3px;
}
.st-heat-cell {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: #161b22;
}
.st-heat-l1 { background: #0e4429; }
.st-heat-l2 { background: #006d32; }
.st-heat-l3 { background: #26a641; }
.st-heat-l4 { background: #39d353; }

.st-heat-legend {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  font-size: 10px;
  color: var(--st-text-sec);
}
.st-legend-item { width: 10px; height: 10px; border-radius: 2px; }

/* XP Chart */
.st-xp-tabs { display: flex; gap: 4px; margin-bottom: 20px; }
.st-xp-tab {
  background: var(--st-surf-h);
  border: 1px solid var(--st-border);
  color: var(--st-text-sec);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}
.st-xp-tab.active { background: #1f6feb; color: #fff; border-color: #1f6feb; }

.st-xp-chart {
  height: 180px;
  display: flex;
  align-items: flex-end;
  gap: 2px;
  padding-left: 30px; /* space for axis */
  position: relative;
  border-bottom: 1px solid var(--st-border);
}
.st-xp-bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  height: 100%;
  position: relative;
}
.st-xp-bar {
  width: 100%;
  background: #1f6feb;
  border-radius: 2px 2px 0 0;
  opacity: 0.8;
  min-height: 1px;
  transition: height 0.3s;
}
.st-xp-bar:hover { opacity: 1; background: #58a6ff; }

.st-xp-label {
  position: absolute;
  bottom: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  color: var(--st-text-sec);
  white-space: nowrap;
}

.st-xp-axis-y {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 25px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-size: 9px;
  color: var(--st-text-sec);
  text-align: right;
  padding-right: 5px;
}

/* Categories */
.st-cat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.st-cat-card {
  background: var(--st-surf-h);
  border: 1px solid var(--st-border);
  border-radius: 6px;
  padding: 12px;
}
.st-cat-head { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; color: #fff; }
.st-cat-bar-bg { height: 6px; background: var(--st-surf); border-radius: 3px; overflow: hidden; } /* Darker bg inside card */
.st-cat-bar-fill { height: 100%; background: #1f6feb; border-radius: 3px; }
.st-cat-meta { font-size: 11px; color: var(--st-text-sec); margin-top: 4px; }

/* Achievements */
.st-ach-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.st-ach-card {
  background: var(--st-surf-h);
  border: 1px solid var(--st-border);
  border-radius: 6px;
  padding: 16px;
  text-align: center;
  opacity: 0.5;
  transition: all 0.3s;
}
.st-ach-card:hover { transform: translateY(-2px); }
.st-ach-card.unlocked {
  opacity: 1;
  border-color: var(--st-acc-gold);
  background: rgba(210, 153, 34, 0.05);
}
.st-ach-icon { font-size: 24px; margin-bottom: 8px; }
.st-ach-name { font-size: 12px; font-weight: 600; color: #fff; margin-bottom: 4px; }
.st-ach-desc { font-size: 10px; color: var(--st-text-sec); }

/* Media Queries */
@media (max-width: 800px) {
  .st-info-grid, .st-forecast-grid, .st-diff-grid, .st-cat-grid { grid-template-columns: repeat(2, 1fr); }
  .st-ach-row { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 500px) {
  .st-info-grid, .st-forecast-grid, .st-diff-grid, .st-cat-grid, .st-ach-row { grid-template-columns: 1fr; }
}
`;

export function initStatsPage() {
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
  const userRaw = localStorage.getItem('qaSessionUser');
  let user = null;
  try { user = JSON.parse(userRaw); } catch {}
  
  let level, metrics, activity, achievements, top5, rest;
  try { level = getCurrentLevel(); } catch { level = { level: 1, xp: 0, remaining: 100, progress: 0 }; }
  try { metrics = getMetrics(uniqueQaData); } catch { metrics = { streakCurrent: 0, studiedCount: 0 }; }
  try { achievements = checkAchievements(); } catch { achievements = {}; }
  try { ({ top5, rest } = getCategoryProgress(uniqueQaData)); } catch { top5=[]; rest=[]; }
  
  const activityDays = 365;
  try { activity = calculateActivity(activityDays); } catch { activity = []; }

  let planMins = 0;
  let sessionCount = 0;
  try {
      const session = getTodaysSession(uniqueQaData || []);
      sessionCount = session.length;
      planMins = Math.ceil(sessionCount * 1.5);
  } catch {}

  const progressMap = getProgressMap();
  const totalCards = uniqueQaData ? uniqueQaData.length : 0;
  const studiedCards = metrics.studiedCount || 0;
  const remainingCards = Math.max(0, totalCards - studiedCards);
  
  const activeDays = activity.filter(d => d.xp > 0).length;
  
  // Forecast Logic
  const activeDaysForSpeed = activeDays > 0 ? activeDays : 1;
  const speed = (studiedCards / activeDaysForSpeed).toFixed(1);
  const daysToFinish = speed > 0 ? Math.ceil(remainingCards / speed) : 9999;
  
  const today = new Date();
  const finishDate = new Date();
  finishDate.setDate(today.getDate() + daysToFinish);
  const finishDateStr = speed > 0 ? finishDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Неизвестно';
  
  const efDistribution = buildEfDistribution(progressMap);
  const xpSeries = getXpSeries(currentXpMode);

  const lvlProgressPct = Math.max(0, Math.min(1, level.progress || 0)) * 100;
  const remainingXp = Math.max(0, Math.round(level.remaining || 0));
  const xpTotal = metrics.xp || level.xp || 0;
  
  // Simulator initial state
  const simEf = 2.5;

  const html = `
    <div class="st-wrapper">
      <!-- Header -->
      <div class="st-header">
        <div class="st-header-title">Статистика</div>
        <button class="st-close" onclick="document.dispatchEvent(new Event('closeStats'))">✕</button>
      </div>

      <!-- Level Block -->
      <div class="st-level-block">
        <div class="st-level-top">
          <div class="st-lvl-title">Уровень ${level.level}</div>
          <div class="st-lvl-rem">До следующего: ${remainingXp} XP</div>
        </div>
        <div class="st-progress-bar">
          <div class="st-progress-fill" style="width: ${lvlProgressPct}%"></div>
        </div>
        
        <!-- Info Grid -->
        <div class="st-info-grid">
           <div class="st-info-card">
              <div class="st-info-row">
                 <span class="st-info-label">Всего XP</span>
              </div>
              <div class="st-info-val-lg">${xpTotal}</div>
           </div>
           <div class="st-info-card">
              <div class="st-info-label">Точность</div>
              <div class="st-info-val-lg">${metrics.accuracy}%</div>
           </div>
           <div class="st-info-card">
              <div class="st-info-row">
                <span class="st-info-label">Стрик</span>
                <span class="st-info-val-lg">${metrics.streakCurrent}</span>
              </div>
              <div class="st-info-sub">рекорд ${metrics.streakBest}</div>
           </div>
           <div class="st-info-card">
              <div class="st-info-row">
                 <span class="st-info-label">Активные дни</span>
                 <span class="st-info-val-lg">${activeDays}</span>
              </div>
           </div>
           <div class="st-info-card yellow-border">
              <div class="st-info-label" style="color:#d29922">План на сегодня</div>
              <div class="st-info-row">
                 <span class="st-info-val-lg">${sessionCount}</span>
                 <span class="st-info-sub">мин. ~${planMins}</span>
              </div>
           </div>
        </div>
      </div>

      <!-- Forecast -->
      <div class="st-block">
         <div class="st-section-title">Прогноз обучения</div>
         <div class="st-forecast-grid">
            <div class="st-forecast-item">
               <div class="st-forecast-label">Средняя скорость</div>
               <div class="st-forecast-val">${speed} <span style="font-size:12px;color:#8b949e">карт/день</span></div>
            </div>
            <div class="st-forecast-item">
               <div class="st-forecast-label">Осталось изучить</div>
               <div class="st-forecast-val">${remainingCards} <span style="font-size:12px;color:#8b949e">из ${totalCards}</span></div>
            </div>
            <div class="st-forecast-item">
               <div class="st-forecast-label">Прогноз завершения</div>
               <div class="st-forecast-val" style="font-size:16px">${finishDateStr}</div>
               <div class="st-forecast-sub">Через ${daysToFinish} дн.</div>
            </div>
            <div class="st-forecast-item">
               <div class="st-forecast-label">Цель (60 дней)</div>
               <div class="st-forecast-val">${Math.ceil(remainingCards/60)} <span style="font-size:12px;color:#8b949e">карт/день</span></div>
            </div>
         </div>
      </div>

      <!-- Difficulty -->
      <div class="st-block">
         <div class="st-section-title">Сложность карточек (Распределение EF)</div>
         <div class="st-diff-grid">
            <div class="st-diff-card red">
               <div class="st-diff-title">Очень трудные (&lt; 1.6)</div>
               <div class="st-diff-val">${efDistribution.buckets[0].count} <span style="font-size:12px;font-weight:400;color:#8b949e">(${efDistribution.buckets[0].percent}%)</span></div>
            </div>
            <div class="st-diff-card orange">
               <div class="st-diff-title">Трудные (1.6-2.1)</div>
               <div class="st-diff-val">${efDistribution.buckets[1].count} <span style="font-size:12px;font-weight:400;color:#8b949e">(${efDistribution.buckets[1].percent}%)</span></div>
            </div>
            <div class="st-diff-card green">
               <div class="st-diff-title">Стандарт (2.1-2.6)</div>
               <div class="st-diff-val">${efDistribution.buckets[2].count} <span style="font-size:12px;font-weight:400;color:#8b949e">(${efDistribution.buckets[2].percent}%)</span></div>
            </div>
            <div class="st-diff-card blue">
               <div class="st-diff-title">Легкие (&gt; 2.6)</div>
               <div class="st-diff-val">${efDistribution.buckets[3].count} <span style="font-size:12px;font-weight:400;color:#8b949e">(${efDistribution.buckets[3].percent}%)</span></div>
            </div>
         </div>
      </div>

      <!-- Simulator -->
      <div class="st-block">
         <div class="st-section-title">Как работает алгоритм (Симулятор)</div>
         <div class="st-sim-desc">
            Карточки перемещаются между зонами сложности в зависимости от ваших ответов. Чем выше коэффициент (EF), тем реже показывается карточка.
         </div>
         <div class="st-sim-track-wrap">
            <div class="st-sim-track"></div>
            <input type="range" id="st-sim-slider" class="st-custom-range" min="1.3" max="3.0" step="0.05" value="2.50">
            <div id="st-slider-bubble" class="st-slider-val-bubble">2.50</div>
         </div>
         <div class="st-sim-labels">
            <span>Очень трудные</span>
            <span>Трудные</span>
            <span>Стандарт</span>
            <span>Легкие</span>
         </div>
         <div class="st-sim-btns">
            <button class="st-sim-btn b-again" onclick="updateSimVal(-0.2)">
               <span>Снова</span>
               <span>-0.2 EF</span>
            </button>
            <button class="st-sim-btn b-hard" onclick="updateSimVal(-0.2)">
               <span>Трудно</span>
               <span>-0.2 EF</span>
            </button>
            <button class="st-sim-btn b-good" onclick="updateSimVal(0)">
               <span>Хорошо</span>
               <span>0 EF</span>
            </button>
            <button class="st-sim-btn b-easy" onclick="updateSimVal(0.1)">
               <span>Легко</span>
               <span>+0.1 EF</span>
            </button>
         </div>
         <div class="st-sim-note">
            Нажимайте кнопки, чтобы увидеть влияние на сложность. Новые карточки начинают с 2.50.
         </div>
      </div>

      <!-- Activity -->
      <div class="st-block">
         <div class="st-section-title">Активность (последний год)</div>
         <div class="st-heatmap-scroll">
            ${renderActivityHeatmap(activity)}
         </div>
         <div class="st-heat-legend">
            <span>Меньше</span>
            <div class="st-legend-item st-heat-l1"></div>
            <div class="st-legend-item st-heat-l2"></div>
            <div class="st-legend-item st-heat-l3"></div>
            <div class="st-legend-item st-heat-l4"></div>
            <span>Больше</span>
         </div>
      </div>

      <!-- XP Chart -->
      <div class="st-block">
         <div class="st-section-title">XP (Заработанные очки)</div>
         <div class="st-xp-tabs">
            <div class="st-xp-tab ${currentXpMode==='week'?'active':''}" data-mode="week">Неделя</div>
            <div class="st-xp-tab ${currentXpMode==='month'?'active':''}" data-mode="month">Месяц</div>
            <div class="st-xp-tab ${currentXpMode==='all'?'active':''}" data-mode="all">Год</div>
         </div>
         ${renderActivityBars(xpSeries, currentXpMode)}
      </div>

      <!-- Categories -->
      <div class="st-block">
         <div class="st-section-title">Прогресс по категориям</div>
         <div class="st-cat-grid">
            ${top5.map(c => `
               <div class="st-cat-card">
                  <div class="st-cat-head">
                     <span>${c.category}</span>
                     <span>${c.studied}/${c.total} (${c.percent}%)</span>
                  </div>
                  <div class="st-cat-bar-bg">
                     <div class="st-cat-bar-fill" style="width:${c.percent}%"></div>
                  </div>
               </div>
            `).join('')}
         </div>
      </div>

      <!-- Achievements -->
      <div class="st-block">
         <div class="st-section-title">Достижения</div>
         <div class="st-ach-row">
             ${Object.entries(achievements).map(([k, v]) => getAchievementCard(k, v)).join('')}
         </div>
      </div>

    </div>
  `;
  
  statsContainer.innerHTML = html;
  
  // Handlers
  document.addEventListener('closeStats', hideStatsPage);
  
  // XP Tabs
  statsContainer.querySelectorAll('.st-xp-tab').forEach(btn => {
    btn.addEventListener('click', e => {
      currentXpMode = e.currentTarget.dataset.mode || 'week';
      renderStats();
    });
  });

  // Sim Logic
  const simSlider = document.getElementById('st-sim-slider');
  const simBubble = document.getElementById('st-slider-bubble');
  
  window.updateSimVal = (delta) => {
    if (!simSlider) return;
    let val = parseFloat(simSlider.value);
    val = Math.max(1.3, Math.min(3.0, val + delta));
    simSlider.value = val;
    updateBubble();
  };

  function updateBubble() {
    if (!simSlider || !simBubble) return;
    const val = parseFloat(simSlider.value);
    const min = parseFloat(simSlider.min);
    const max = parseFloat(simSlider.max);
    const percent = (val - min) / (max - min);
    
    const trackW = simSlider.offsetWidth;
    const thumbW = 16;
    const left = percent * (trackW - thumbW) + (thumbW/2);
    
    simBubble.style.left = left + 'px';
    simBubble.textContent = val.toFixed(2);
  }

  if (simSlider) {
    simSlider.addEventListener('input', updateBubble);
    // Initial pos need a small delay for render
    setTimeout(updateBubble, 0);
    window.addEventListener('resize', updateBubble);
  }
}

function getAchievementCard(key, unlocked) {
   const meta = {
     firstSessionCompleted: { name: 'Первые шаги', desc: 'Завершите первую сессию', icon: '🏆' },
     sevenDayStreak: { name: 'Неделя силы', desc: 'Стрик 7 дней', icon: '🔥' },
     ninetyAccuracy: { name: 'Точность 90%', desc: 'Средняя точность ≥ 90%', icon: '🎯' },
     fiftyCards: { name: 'Изучено 50 карточек', desc: 'Уникальных карточек ≥ 50', icon: '📚' },
     nightOwl: { name: 'Ночная сова', desc: 'Учитесь после 23:00', icon: '🦉' }
   };
   const m = meta[key] || { name: key, desc: 'Unknown', icon: '❓' };
   
   return `
     <div class="st-ach-card ${unlocked?'unlocked':''}">
        <div class="st-ach-icon">${m.icon}</div>
        <div class="st-ach-name">${m.name}</div>
        <div class="st-ach-desc">${m.desc}</div>
     </div>
   `;
}

function buildEfDistribution(progressMap) {
  // Buckets: <1.6, 1.6-2.1, 2.1-2.6, >2.6
  // Match screenshot buckets exactly
  const buckets = [
    { id: 'veryHard', label: 'Очень трудные', from: 0, to: 1.6, count: 0 },
    { id: 'hard', label: 'Трудные', from: 1.6, to: 2.1, count: 0 },
    { id: 'standard', label: 'Стандарт', from: 2.1, to: 2.6, count: 0 },
    { id: 'easy', label: 'Легкие', from: 2.6, to: 999, count: 0 }
  ];

  const values = progressMap ? Object.values(progressMap) : [];
  let total = 0;
  values.forEach(p => {
    const ef = p && typeof p.easeFactor === 'number' ? p.easeFactor : null;
    if (!ef) return;
    total += 1;
    const bucket = buckets.find(b => ef >= b.from && ef < b.to);
    if (bucket) bucket.count += 1;
  });

  buckets.forEach(b => {
    b.percent = total ? Math.round((b.count / total) * 100) : 0;
  });

  return { buckets, total };
}

function renderActivityHeatmap(activity) {
   // Activity: array of {date, count, xp, color}
   // Need to arrange in 7 rows (Mon-Sun).
   // Grid auto flow column.
   
   const cells = [];
   const firstDate = new Date(activity[0].date);
   let dayOfWeek = firstDate.getDay(); // 0=Sun, 1=Mon...
   // We want 0=Mon, 6=Sun.
   // if dayOfWeek is 0 (Sun), offset should be 6.
   // if dayOfWeek is 1 (Mon), offset should be 0.
   let startOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
   
   // Add empty cells
   let html = '';
   for(let i=0; i<startOffset; i++) {
     html += '<div class="st-heat-cell" style="background:transparent;border:none"></div>';
   }
   
   activity.forEach(d => {
      let cls = 'st-heat-cell';
      if (d.xp >= 100) cls += ' st-heat-l4';
      else if (d.xp >= 50) cls += ' st-heat-l3';
      else if (d.xp >= 20) cls += ' st-heat-l2';
      else if (d.xp > 0) cls += ' st-heat-l1';
      
      html += `<div class="${cls}" title="${d.date}: ${d.xp} XP"></div>`;
   });
   
   return `<div class="st-heatmap">${html}</div>`;
}

function getXpSeries(mode) {
  if (mode === 'week') return getDailyPoints(7);
  if (mode === 'month') return getDailyPoints(30);
  return getDailyPointsAll(); // Year/All
}

function renderActivityBars(series, mode) {
  // Find max for scaling
  const max = Math.max(...series.map(s => s.xp), 10);
  
  // Create Bars
  const barsHtml = series.map((d, index) => {
     const h = (d.xp / max) * 100;
     let showLabel = false;
     
     // Label logic:
     if (mode === 'week') {
         showLabel = true; // Show all
     } else if (mode === 'month') {
         // Show every 5th or start/end
         showLabel = (index % 5 === 0);
     } else {
         // 'all' -> show start of month
         // d.date is YYYY-MM-DD
         if (d.date.endsWith('-01')) showLabel = true;
     }
     
     const label = d.date.slice(5); // MM-DD
     
     return `
       <div class="st-xp-bar-col">
          <div class="st-xp-bar" style="height: ${h}%"></div>
          ${showLabel ? `<div class="st-xp-label">${label}</div>` : ''}
       </div>
     `;
  }).join('');
  
  // Y Axis Labels
  const yHtml = `
     <div class="st-xp-axis-y">
        <div>${max}</div>
        <div>${Math.round(max/2)}</div>
        <div>0</div>
     </div>
  `;
  
  return `<div class="st-xp-chart">${yHtml}${barsHtml}</div>`;
}
