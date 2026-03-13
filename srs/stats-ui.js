import { getMetrics, calculateActivity, getCategoryProgress, checkAchievements, getCurrentLevel, getDailyPoints, getDailyPointsAll, getDailyStreakSeries, getHeartsDistribution, getLearningStage, getUnderstandingIndex, getRiskZones, getDailyImprovements, getProgressMap } from './stats-utils.js?v=2.01';
import { syncFavorite } from './storage.js?v=2.01';
import { getDifficultyLevel, getLevelProgress } from './algorithm.js?v=2.00';
import { getTodaysSession } from './category-scheduler.js?v=2.00';
import { startLearnSession } from './learn-ui.js?v=2.00';

// Функция для получения актуальных данных (всегда из localStorage для авторизованных)
function getCurrentCards() {
  try {
    const sessionUserRaw = localStorage.getItem('qaSessionUser');
    if (sessionUserRaw) {
      const userCardsRaw = localStorage.getItem('qaUserCards');
      if (userCardsRaw) {
        const userCards = JSON.parse(userCardsRaw);
        if (Array.isArray(userCards) && userCards.length > 0) {
          console.log('[getCurrentCards] Используем qaUserCards:', userCards.length, 'карточек');
          
          // 🔧 Исправляем кодировку на лету
          userCards.forEach(card => {
            if (card.category === 'Документация' || card.category === 'Дкументация') {
              card.category = 'Документация';
            }
            if (card.subcategory === 'Типы требований' || card.subcategory === 'Типы треований') {
              card.subcategory = 'Типы требований';
            }
          });
          
          return userCards;
        }
      }
    }
  } catch (e) {
    console.warn('[stats-ui] Ошибка загрузки userCards:', e);
  }

  // Fallback: читаем из all-data.js через window
  if (window.uniqueQaData && Array.isArray(window.uniqueQaData)) {
    console.log('[getCurrentCards] Используем window.uniqueQaData:', window.uniqueQaData.length, 'карточек');
    return window.uniqueQaData;
  }

  console.log('[getCurrentCards] Нет данных');
  return [];
}

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

.nav-icon-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  color: var(--st-text);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, transform 0.1s;
}
.nav-icon-btn:hover {
  background: var(--st-surf-h);
  color: #fff;
}
.nav-icon-btn:active {
  transform: scale(0.95);
}
.st-auth-btn svg { width: 20px; height: 20px; }
.st-top-actions .nav-icon-btn { padding: 0; }
.st-top-actions .tab { width: 36px; height: 36px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-card); padding: 0; display:flex; align-items:center; justify-content:center; box-sizing: border-box; }
.activity-card { background: var(--st-surf); border: 1px solid var(--st-border); border-radius: 16px; padding: 16px 16px 12px; grid-column: span 8; height: 320px; }
.activity-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.period-switch { display: flex; gap: 12px; font-size: 12px; color: var(--st-muted); }
.period-switch .active { color: #fff; font-weight: 600; }
.month-switch { font-size: 12px; color: var(--st-text-sec); }
.chart-wrapper { display: block; height: calc(100% - 8px); position: relative; }
.chart { width: 100%; height: 100%; overflow: visible; }
.chart-label { font-size: 11px; opacity: 0.45; fill: var(--st-text); }
.bar-xp { display: none; }
.bar-hearts { opacity: 1; }
.bar-cards { opacity: 0.9; stroke: none; }
.chart-grid-line { stroke: rgba(255,255,255,0.06); stroke-width: 1; }
.tooltip { position: absolute; width: 160px; padding: 8px 10px; font-size: 12px; border-radius: 8px; background: var(--st-surf-h); color: var(--st-text); border: 1px solid var(--st-border); display: none; pointer-events: none; z-index: 3000; }
.tooltip .tip-arrow { position: absolute; bottom: -6px; left: calc(50% - 6px); width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 6px solid var(--st-surf-h); }

/* NEW METRICS STYLES */
.st-meta-state {
  background: linear-gradient(90deg, rgba(46,196,182,0.1), rgba(46,196,182,0.02));
  border-left: 3px solid var(--st-sec);
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.st-meta-info { flex: 1; }
.st-meta-title { font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--st-sec); font-weight: 700; margin-bottom: 4px; }
.st-meta-desc { font-size: 15px; color: var(--st-text); font-weight: 500; }
.st-meta-index { text-align: right; }
.st-meta-val { font-size: 24px; font-weight: 800; color: #fff; line-height: 1; }
.st-meta-lbl { font-size: 11px; color: var(--st-muted); text-transform: uppercase; }

.st-quality-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 8px;
}
.st-quality-card {
  background: var(--st-surf);
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--st-border);
  text-align: center;
}
.st-q-val { font-size: 32px; font-weight: 800; color: #fff; line-height: 1; margin-bottom: 4px; }
.st-q-label { font-size: 13px; color: var(--st-muted); }

/* Category Progress Cards */
.st-cat-progress-wrap {
  background: var(--st-surf);
  border: 1px solid var(--st-border);
  border-radius: 16px;
  padding: 20px;
  max-height: 600px !important;
  overflow: hidden;
  display: flex !important;
  flex-direction: column !important;
  height: 100% !important;
}
.st-cat-progress-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--st-text);
  margin-bottom: 16px;
}
.st-cat-progress-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  flex: 1;
  padding-right: 4px;
}
.st-cat-progress-list::-webkit-scrollbar {
  width: 6px;
}
.st-cat-progress-list::-webkit-scrollbar-track {
  background: var(--st-surf-h);
  border-radius: 3px;
}
.st-cat-progress-list::-webkit-scrollbar-thumb {
  background: var(--st-muted);
  border-radius: 3px;
}
.st-cat-progress-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 2px 12px 5px !important;
  background: #0f3460;
  border-radius: 8px;
  border: 1px solid #1a3a5c;
}
.st-cat-progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.st-cat-progress-name {
  font-size: 11px;
  color: #aaa;
  font-weight: 500;
}
.st-cat-progress-value {
  font-size: 12px;
  color: #fff;
  font-weight: 700;
}
.st-cat-progress-track {
  height: 6px;
  background: #1a1a2e;
  border-radius: 3px;
  overflow: hidden;
}
.st-cat-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #ffffff);
  border-radius: 3px;
  transition: width 0.5s ease;
}

/* Hearts Bar */
.st-hearts-wrap { margin: 20px 0; }
.st-hearts-title { font-size: 14px; color: var(--st-text); margin-bottom: 8px; font-weight: 600; display: flex; justify-content: space-between; }
.st-hearts-bar {
  display: flex;
  height: 28px;
  border-radius: 8px;
  overflow: hidden;
  background: #222;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
}
.st-hb-seg { 
  height: 100%; 
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1); 
  position: relative; 
  display: flex; 
  align-items: center; 
  justify-content: center;
  overflow: hidden;
}
.st-hb-icon { font-size: 12px; opacity: 0.8; text-shadow: 0 1px 2px rgba(0,0,0,0.5); }
.st-hb-seg:hover { filter: brightness(1.2); }
.st-hb-seg[data-val="1"] { background: #E5533D; }
.st-hb-seg[data-val="2"] { background: #FF9F1C; }
.st-hb-seg[data-val="3"] { background: #FFD166; }
.st-hb-seg[data-val="4"] { background: #06D6A0; }
.st-hb-seg[data-val="5"] { background: #118AB2; }

/* Risk Zones */
.st-risk-list { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.st-risk-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(229, 83, 61, 0.08);
  border-left: 3px solid var(--st-danger);
  border-radius: 6px;
  transition: background 0.2s;
}
.st-risk-item:hover { background: rgba(229, 83, 61, 0.12); }
.st-risk-info { display: flex; flex-direction: column; }
.st-risk-name { font-weight: 600; color: #ffcccc; font-size: 13px; margin-bottom: 2px; }
.st-risk-sub { font-size: 11px; color: rgba(255,255,255,0.6); }
.st-risk-btn {
  background: var(--st-danger);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.1s;
}
.st-risk-btn:active { transform: scale(0.95); }

/* Mobile - show continue button below header */
@media (max-width: 1024px) {
  .st-continue-mobile {
    display: block !important;
  }
  .st-top .st-cta-btn,
  #st-continue-top-btn {
    display: none !important;
  }
  /* Compact header on mobile */
  .st-top {
    padding: 12px 16px !important;
  }
  .st-top-right {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    gap: 8px !important;
    overflow-x: auto !important;
    justify-content: flex-end !important;
  }
  .st-top-actions {
    flex-shrink: 0 !important;
  }
  .app-version-display {
    display: none !important;
  }
  .st-top-metrics {
    display: flex !important;
    flex-direction: row !important;
    gap: 6px !important;
    flex-shrink: 0 !important;
  }
  .st-top-metrics .metric {
    display: flex !important;
    align-items: center !important;
    gap: 4px !important;
    font-size: 11px !important;
    white-space: nowrap !important;
    flex-shrink: 0 !important;
  }
  .st-top-metrics .metric svg {
    width: 14px !important;
    height: 14px !important;
    flex-shrink: 0 !important;
  }
  .st-level-inline {
    display: flex !important;
    gap: 4px !important;
    flex-shrink: 0 !important;
  }
}

/* Game Modes */
.st-mode-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-top: 10px;
}
.st-mode-card {
  background: var(--st-surf);
  border: 1px solid var(--st-border);
  padding: 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  position: relative;
  overflow: hidden;
}
.st-mode-card:hover { border-color: var(--st-prim); background: var(--st-surf-h); transform: translateY(-2px); }
.st-mode-icon { font-size: 20px; margin-bottom: 6px; display: block; }
.st-mode-title { font-weight: 600; font-size: 13px; margin-bottom: 2px; color: #fff; display: block; }
.st-mode-desc { font-size: 10px; color: var(--st-muted); display: block; line-height: 1.3; }
.st-mode-tag {
  position: absolute; top: 8px; right: 8px;
  font-size: 9px; padding: 2px 6px; border-radius: 4px;
  background: var(--st-border); color: var(--st-muted);
  text-transform: uppercase; font-weight: 700;
}
/* Tooltip для режимов с описанием */
.st-mode-card[title]:hover::after {
  content: attr(title);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.95);
  color: #fff;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid var(--st-border);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-line;
  z-index: 1000;
  width: max-content;
  max-width: 260px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  margin-bottom: 8px;
}

/* Daily Improvements Chart */
.st-imp-chart {
  display: flex;
  align-items: center; /* Center vertically relative to axis */
  height: 120px;
  gap: 4px;
  margin-top: 20px;
  position: relative;
  border-bottom: 1px solid var(--st-border);
  padding-bottom: 20px; /* Space for labels */
}
.st-imp-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
  position: relative;
  min-width: 4px;
}
/* Center line */
.st-imp-axis {
  position: absolute;
  top: 50%;
  left: 0;
  width: 100%;
  height: 1px;
  background: var(--st-border);
  z-index: 0;
}
.st-imp-bar-pos { 
  background: var(--st-sec); 
  border-radius: 2px 2px 0 0; 
  position: absolute; 
  bottom: 50%; 
  left: 0; right: 0; 
  min-height: 0;
}
.st-imp-bar-neg { 
  background: var(--st-danger); 
  border-radius: 0 0 2px 2px; 
  position: absolute; 
  top: 50%; 
  left: 0; right: 0; 
  min-height: 0;
}
.st-imp-date {
  position: absolute;
  bottom: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  color: var(--st-muted);
  white-space: nowrap;
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
  padding: 0 20px 80px; /* Top aligned with main page, keep side/bottom */
  display: flex;
  flex-direction: column;
  gap: 16px; /* Reduced from 24px */
}

/* Header */
.st-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  padding: 8px 0;
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
  margin-left: auto;
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

/* Mobile continue button - full width below header */
.st-continue-mobile {
  display: none;
  margin: 16px 0;
  padding: 14px 20px;
  width: 100%;
  max-width: none;
}

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
  padding: 12px;
  transition: background 0.2s;
}
.st-card:hover { background: var(--st-surf-h); }
.st-card-label { font-size: 13px; color: var(--st-muted); margin-bottom: 2px; }
.st-card-val { font-size: 18px; font-weight: 600; color: var(--st-text); }
.st-card-sub { font-size: 11px; color: var(--st-text-sec); margin-top: 2px; }

/* Collapsible Section */
.st-collapsible-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  padding: 6px 0;
}
.st-col-title { font-size: 15px; font-weight: 600; color: #fff; display: flex; align-items: center; justify-content: space-between; }
.st-col-arrow { transition: transform 0.3s; color: var(--st-muted); }
.st-col-arrow.expanded { transform: rotate(180deg); }

/* Difficulty Bar */
.st-diff-bar-wrap {
  height: 6px;
  background: var(--st-surf-h);
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  margin-top: 10px;
}
.st-diff-seg { height: 100%; }
.st-diff-seg.red { background: var(--st-danger); }
.st-diff-seg.orange { background: var(--st-prim); }
.st-diff-seg.green { background: var(--st-sec); }
.st-diff-seg.blue { background: #2f81f7; }

.st-diff-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  animation: slideDown 0.3s ease-out;
}
@keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

.st-diff-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--st-surf-h);
  border-radius: 8px;
  cursor: pointer;
}
.st-diff-item:hover { background: #262c36; }
.st-diff-item.favorite { margin-top: 8px; border: 1px solid #ffd700; background: rgba(255, 215, 0, 0.08); }
.st-diff-dot { width: 6px; height: 6px; border-radius: 50%; margin-right: 10px; }
.st-diff-name { flex: 1; font-size: 13px; color: var(--st-text); }
  .st-diff-count { font-size: 14px; font-weight: 600; color: #fff; }
.st-diff-barline { flex-basis: 100%; height: 6px; border-radius: 3px; margin-top: 6px; background: var(--st-sec); }

/* Activity & XP */
.st-xp-tabs {
  display: flex;
  background: var(--st-surf);
  border-radius: 8px;
  padding: 4px;
  margin-bottom: 12px;
}
.st-xp-tab {
  flex: 1;
  text-align: center;
  padding: 6px;
  font-size: 12px;
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
  height: 150px;
  margin-bottom: 12px;
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
  gap: 8px;
}
.st-ach-card {
  background: var(--st-surf);
  border: 1px solid var(--st-border);
  border-radius: 12px;
  padding: 12px;
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
.st-ach-scroll { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
.st-info-btn {
  background: rgba(255,255,255,0.1); 
  border: none; 
  color: var(--st-text-sec);
  width: 24px; height: 24px; border-radius: 50%;
  width: 24px; height: 24px; border-radius: 50%;
  font-size: 14px; line-height: 24px; text-align: center;
  margin-left: 10px; cursor: pointer; display: inline-flex;
  align-items: center; justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}
.st-info-btn:hover { background: var(--st-sec); color: #fff; transform: scale(1.1); }
.st-ach-icon { font-size: 24px; margin-bottom: 6px; }
.st-ach-title { font-size: 12px; font-weight: 600; color: #fff; margin-bottom: 2px; }
.st-ach-desc { font-size: 10px; color: var(--st-muted); }

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

/* Primary Stats */
.st-primary { background: var(--st-surf); border: 1px solid var(--st-border); border-radius: 16px; padding: 12px; }
.st-pr-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.st-pr-item { display: flex; flex-direction: column; align-items: flex-start; }
.st-pr-val { font-size: 24px; font-weight: 700; color: #fff; line-height: 1; }
.st-pr-sub { font-size: 11px; color: var(--st-muted); text-transform: uppercase; }
.st-pr-divider { width: 1px; height: 24px; background: rgba(255,255,255,0.08); }

/* Plan Card (compact) */
.st-plan-card { background: var(--st-surf); border: 1px solid var(--st-border); border-radius: 16px; padding: 12px; }
.st-plan-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.st-plan-label { font-size: 11px; color: var(--st-muted); text-transform: uppercase; }
.st-plan-val { font-size: 16px; font-weight: 600; color: #fff; }
.st-plan-total { font-size: 12px; color: var(--st-text-sec); }

/* Desktop Adaptation */
@media (min-width: 1024px) {
  #stats-container { overflow: hidden; }
  .st-wrapper {
    max-width: 1400px;
    height: 100vh;
    padding: 24px;
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    column-gap: 24px;
    row-gap: 8px;
    align-items: start;
    grid-template-areas:
      "top top top top top top top top top top top top"
      "progress progress progress progress progress progress sidebar sidebar sidebar sidebar sidebar sidebar"
      "main main main main main main main main main main main main";
  }

  /* Full Width Rows */
  .st-top { grid-area: top; height: var(--header-fixed-height); display: grid; grid-template-columns: repeat(12, 1fr); column-gap: 24px; align-items: flex-start; padding-top: 0; }
  .st-top-left { grid-column: 1 / span 6; display: flex; flex-direction: column; gap: 6px; }
  .st-top-title { display: none; }
  .st-top-sub { display: none; }
  .st-top-right { grid-column: 7 / span 6; display: grid; grid-template-columns: 1fr auto auto; column-gap: 16px; align-items: center; }
  .st-top-right { display: flex; align-items: center; gap: 12px; }
  .st-top-actions { align-items: flex-start; }
  .st-home-btn { font-size: 20px !important; padding: 0 10px !important; line-height: 20px !important; }
  .st-top-metrics { display: flex; gap: 12px; align-items: center; }
  .st-top-metrics .metric { display: flex; align-items: center; gap: 6px; font-size: 14px; color: #fff; }
  .st-cta-btn { height: 40px; padding: 0 20px; font-size: 14px; background: var(--st-prim); color: #0E1117; border-radius: 12px; border: none; cursor: pointer; transition: all 0.2s; }
  .st-cta-btn:hover { background: #ffa833; transform: translateY(-1px); }
  #st-continue-top-btn { display: inline-flex; align-items: center; gap: 6px; }
  .st-level-row, .st-hero-bar-bg, .st-hero-bar-fill, .st-hero-stats { display: block; }
  .st-level-inline { align-self: center; }

  /* Progress - 50% width */
  .progress { grid-area: progress; }
  .st-compact-card { width: 100%; height: 100%; min-height: 200px; }
  
  /* Sidebar with modes - 50% width */
  .st-sidebar { 
    grid-area: sidebar; 
    display: flex !important; 
    flex-direction: column;
    background: var(--st-surf);
    border: 1px solid var(--st-border);
    border-radius: 16px;
    padding: 24px;
  }
  .st-sidebar .st-col-title { 
    font-size: 14px; 
    font-weight: 700; 
    color: var(--st-text); 
    margin-bottom: 16px; 
    text-transform: uppercase; 
    letter-spacing: 0.5px;
  }
  .st-sidebar .st-mode-grid { 
    display: grid; 
    grid-template-columns: repeat(4, 1fr); 
    gap: 12px; 
  }
  .st-sidebar .st-mode-card { 
    padding: 16px; 
    background: var(--st-surf-h);
    border: 1px solid var(--st-border);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .st-sidebar .st-mode-card:hover {
    border-color: var(--st-prim);
    background: rgba(255, 159, 28, 0.1);
    transform: translateY(-2px);
  }
  .st-sidebar .st-mode-icon { font-size: 24px; display: block; margin-bottom: 8px; }
  .st-sidebar .st-mode-title { font-weight: 700; font-size: 13px; color: #fff; display: block; }
  .st-sidebar .st-mode-desc { font-size: 11px; color: var(--st-text-sec); display: block; line-height: 1.3; }

  /* Main Content */
  .st-main {
    grid-area: main;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: auto auto auto;
    gap: clamp(12px, 2vw, 24px);
    height: 100%;
    min-height: calc(100vh - 200px);
  }
  .st-block-1 { 
    grid-column: 1; 
    grid-row: 1;
    min-width: 280px;
  }
  .st-block-achievements { 
    grid-column: 2; 
    grid-row: 1 / span 2;
    overflow-y: auto;
    max-height: 600px;
    min-width: 280px;
  }
  .st-block-2 { 
    grid-column: 3; 
    grid-row: 1;
    min-width: 280px;
  }
  .st-block-3 { 
    grid-column: 1; 
    grid-row: 2;
    min-width: 280px;
  }
  .st-block-4 { 
    grid-column: 3; 
    grid-row: 2;
    min-width: 280px;
  }
  .st-block-5 { 
    grid-column: 1 / span 3; 
    grid-row: 3;
    min-width: 280px;
  }

  /* Фиксированная высота блоков */
  .st-block-1,
  .st-block-2 {
    height: 180px !important;
    min-height: 180px !important;
    display: flex !important;
    flex-direction: column !important;
  }

  .st-compact-card {
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: space-between !important;
  }

  .modes-grid {
    height: calc(200px - 2px) !important;  /* Вычитаем border у родителя */
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    box-sizing: border-box !important;
  }

  .st-diff-section,
  .st-block-4 {
    height: 320px !important;
    overflow-y: auto !important;
  }
  
  /* Стили для карточек в modes-grid */
  .modes-grid .st-mode-card {
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
  }
  
  /* Центральный блок — КРИТИЧНО! */
  .st-block-achievements,
  .st-cat-progress-wrap {
    max-height: 600px !important;
    overflow-y: auto !important;
  }

  /* Tablet: 2 колонки */
  @media (max-width: 1024px) {
    .st-main {
      grid-template-columns: repeat(2, 1fr);
      grid-template-rows: auto auto auto auto;
    }
    .st-block-1 { 
      grid-column: 1; 
      grid-row: 1;
    }
    .st-block-achievements { 
      grid-column: 1 / span 2; 
      grid-row: 2;
      max-height: 600px;
    }
    .st-block-2 { 
      grid-column: 2; 
      grid-row: 1;
    }
    .st-block-3 { 
      grid-column: 1; 
      grid-row: 3;
    }
    .st-block-4 { 
      grid-column: 2; 
      grid-row: 3;
    }
    .st-block-5 { 
      grid-column: 1 / span 2; 
      grid-row: 4;
    }
  }

  /* Mobile: 1 колонка */
  @media (max-width: 768px) {
    .st-main {
      grid-template-columns: 1fr;
      grid-template-rows: auto;
    }
    .st-block-1 { 
      grid-column: 1; 
      grid-row: auto;
    }
    .st-block-achievements { 
      grid-column: 1; 
      grid-row: auto;
      max-height: none;
    }
    .st-block-2 { 
      grid-column: 1; 
      grid-row: auto;
    }
    .st-block-3 { 
      grid-column: 1; 
      grid-row: auto;
    }
    .st-block-4 { 
      grid-column: 1; 
      grid-row: auto;
    }
    .st-block-5 { 
      grid-column: 1; 
      grid-row: auto;
    }
    
    /* Mobile: убираем фиксированную высоту */
    .st-compact-card,
    .training-modes-block,
    .st-diff-section {
      height: auto;
      min-height: 150px;
    }
  }

  .st-activity-section { 
    background: var(--st-surf); 
    padding: 20px; 
    border-radius: 16px; 
    border: 1px solid var(--st-border); 
    min-height: 320px;
    aspect-ratio: 4/3;
  }
  .st-activity-section { overflow: hidden; }
  
  /* Адаптивность для activity-section */
  @media (max-width: 1024px) {
    .st-activity-section {
      min-height: 280px;
    }
  }
  @media (max-width: 768px) {
    .st-activity-section {
      min-height: 240px;
      aspect-ratio: 16/9;
    }
  }
  .st-xp-tabs { background: none; padding: 0; margin-bottom: 12px; display: flex; gap: 16px; }
  .st-xp-tab { background: none; color: var(--st-muted); padding: 0; }
  .st-xp-tab.active { color: #fff; font-weight: 600; border-bottom: 2px solid #fff; }
  .st-xp-chart-container { height: 300px; overflow: hidden; }
  .st-xp-chart { height: 100%; display: flex; align-items: flex-end; gap: 8px; }
  .st-xp-col { width: 12px; position: relative; display: flex; align-items: flex-end; overflow: hidden; }
  .st-bar-xp { width: 100%; background: var(--st-prim); border-radius: 6px 6px 0 0; opacity: 0.9; }
  .st-bar-heart { width: 100%; background: var(--st-danger); border-radius: 6px 6px 0 0; position: absolute; bottom: auto; }
  .st-xp-col.today .st-bar-xp { filter: brightness(1.2); }
  .st-xp-label { position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%); font-size: 10px; color: var(--st-muted); }
  .st-collapsible-header { cursor: default; pointer-events: none; margin-bottom: 16px; }
  .st-col-arrow { display: none; }
  .st-col-title { font-size: 16px; }

  /* Right Column Stack */
  .st-diff-section { background: var(--st-surf); padding: 16px; border-radius: 16px; border: 1px solid var(--st-border); }
  .st-risk-section { background: var(--st-surf); padding: 16px; border-radius: 16px; border: 1px solid var(--st-border); }

  /* Primary Stats */
  .st-primary { background: var(--st-surf); padding: 16px; border-radius: 16px; border: 1px solid var(--st-border); }
  .st-mode-desc { display: none; }

  /* Achievements: Full Width at Bottom */
  .st-ach-section { background: var(--st-surf); padding: 16px; border-radius: 16px; border: 1px solid var(--st-border); margin-top: 0; }
  .st-ach-scroll { display: flex; gap: 12px; overflow-x: auto; overflow-y: hidden; padding-bottom: 4px; }
  .st-ach-card { width: 96px; height: 96px; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; }
  .st-ach-icon { font-size: 28px; margin-bottom: 6px; }
  .st-ach-title { font-size: 12px; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .st-ach-desc { display: none; }

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
  try { ({ top5, rest } = getCategoryProgress(uniqueQaData)); } catch { top5 = []; rest = []; }

  // Daily Plan
  let planMins = 0;
  let sessionCount = 0;
  let todaysSession = [];
  try {
    todaysSession = getTodaysSession(uniqueQaData || []);
    sessionCount = todaysSession.length;
    planMins = Math.ceil(sessionCount * 1.5);
  } catch { }

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
  const easyCount = (() => {
    try {
      return Object.values(progressMap).filter(p => p && typeof p.easeFactor === 'number' && p.easeFactor >= 2.4).length;
    } catch { return 0; }
  })();
  const xpSeries = getXpSeries(currentXpMode);
  const improvements = getDailyImprovements(currentXpMode === 'week' ? 7 : (currentXpMode === 'month' ? 30 : 14));

  const lvlProgressPct = Math.max(0, Math.min(1, level.progress || 0)) * 100;
  const remainingXp = Math.max(0, Math.round(level.remaining || 0));

  // MSK timezone fix (UTC+3)
  const mskOffset = 3 * 60 * 60 * 1000;
  const todayStr = new Date(Date.now() + mskOffset).toISOString().split('T')[0];
  console.log('[STATS.UI] todayStr (MSK):', todayStr, 'UTC:', new Date().toISOString());
  let cardsDoneToday = 0;

  // Forecast calculations
  let dueTomorrow = 0;
  let dueWeek = 0;
  const now = new Date();
  const tomorrowStart = new Date(now); tomorrowStart.setDate(now.getDate() + 1); tomorrowStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrowStart); tomorrowEnd.setHours(23, 59, 59, 999);
  const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7); weekEnd.setHours(23, 59, 59, 999);

  const currentCards = getCurrentCards();
  console.log('[STATS.UI] Текущих карточек:', currentCards.length);

  currentCards.forEach(q => {
    const p = progressMap[q.question] || progressMap[q.question.trim()];
    if (p && p.nextReviewDate) {
      const d = new Date(p.nextReviewDate);
      if (d >= tomorrowStart && d <= tomorrowEnd) dueTomorrow++;
      if (d >= now && d <= weekEnd) dueWeek++;
    }
  });

  // Calculate Difficulty Distribution (ordered: Easy, Standard, Hard, Very Hard) with single palette
  const segs = [
    { label: 'Легкие', min: 2.4, max: 999, count: 0, color: '#06D6A0', hearts: 4 },
    { label: 'Стандарт', min: 2.1, max: 2.4, count: 0, color: '#2f81f7', hearts: 3 },
    { label: 'Трудные', min: 1.7, max: 2.1, count: 0, color: '#FF9F1C', hearts: 2 },
    { label: 'Очень трудные', min: 0, max: 1.7, count: 0, color: '#E5533D', hearts: 1 }
  ];

  let totalRated = 0;
  let favCount = 0;
  const favorites = new Set(JSON.parse(localStorage.getItem('qaFavorites') || '[]'));

  currentCards.forEach(q => {
    if (favorites.has(q.question)) favCount++;

    let p = progressMap[q.question];
    if (!p && q.question) p = progressMap[q.question.trim()];

    if (p && p.lastReviewed === todayStr) {
      cardsDoneToday++;
    }

    if (p && p.easeFactor !== undefined) {
      const ef = p.easeFactor;
      if (ef >= 2.4) segs[0].count++;
      else if (ef >= 2.1) segs[1].count++;
      else if (ef >= 1.7) segs[2].count++;
      else segs[3].count++;
      totalRated++;
    }
  });

  segs.forEach(s => {
    s.pct = totalRated > 0 ? (s.count / totalRated) * 100 : 0;
  });

  // Calculate Hearts Distribution (New)
  const heartsDist = getHeartsDistribution();
  const learningStage = getLearningStage(heartsDist, totalRated);
  const understandingIndex = getUnderstandingIndex(heartsDist, totalRated);
  const riskZones = getRiskZones(uniqueQaData);

  // Check login status
  const user = window.qaAuth && window.qaAuth.getUser ? window.qaAuth.getUser() : null;
  const authTitle = user ? `Выйти (${user.email})` : 'Вход';
  const authIcon = user
    ? '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5z"/><path d="M4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4z"/><path d="M4 20v-2c0-3.3 4.7-5 8-5s8 1.7 8 5v2H4z"/></svg>';

  // Функция для генерации SVG сердечек с плавным градиентом
  function renderHeartsSvg(count, prefix) {
    let svg = '';
    for (let i = 1; i <= 5; i++) {
      const fillPercent = i <= count ? 100 : 0;
      svg += `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" style="display:inline-block;vertical-align:middle;"><defs><linearGradient id="${prefix}-grad-${i}"><stop offset="${fillPercent}%" stop-color="#ff4d4d"/><stop offset="${fillPercent}%" stop-color="#444"/></linearGradient></defs><path fill="url(#${prefix}-grad-${i})" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
    }
    return svg;
  }

  // Функция для получения количества сердечек по EF
  function getHeartsCountForEf(ef) {
    if (ef === undefined || ef === null) return 0;
    if (ef >= 2.4) return 5;      // EASY
    if (ef >= 2.1) return 4;      // STANDARD
    if (ef >= 1.7) return 3;      // HARD
    return 1;                      // VERY HARD
  }

  // Render HTML
  const container = document.getElementById('stats-container');
  if (!container) return;

  container.innerHTML = `
    <div class="st-wrapper">
      <div class="st-top">
        <div class="st-top-left" style="display:none"></div>
        <div class="st-top-right" style="grid-column:1 / span 12;display:flex;align-items:center;gap:10px;justify-content:flex-start;width:100%">
          <div class="st-top-actions" style="display:flex;align-items:center;gap:10px;">
            <button class="nav-icon-btn login-main-btn tab st-auth-btn" title="${authTitle}" style="min-width:auto;background-color:var(--color-card);">${authIcon}</button>
            <button class="nav-icon-btn st-home-btn tab" title="Домой" style="min-width:auto;background-color:var(--color-card);">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3l9 8-1.5 1.5L12 6 4.5 12.5 3 11z"/>
                <path d="M5 13v8h6v-6h2v6h6v-8l-7-6z"/>
              </svg>
            </button>
          </div>
          <div class="app-version-display" style="font-size:11px;color:#555;font-weight:bold;margin-left:10px;">v${window.currentAppVersion || ''}</div>
          <div class="st-top-metrics">
            <div class="metric"><span>🔥</span> ${metrics.streakCurrent}</div>
            <div class="metric"><span>⚡</span> ${easyCount}</div>
            <div class="metric"><span>❤️</span> ${cardsDoneToday}</div>
          </div>
          <button class="st-cta-btn" id="st-continue-top-btn" onclick="window.startDailySession()" style="margin-left:12px;padding:6px 12px;height:32px;font-size:12px;font-weight:600;">▶ Обучение</button>
          <div class="st-level-inline" style="margin-left:auto;display:flex;align-items:center;gap:6px;"></div>
        </div>
      </div>

      <!-- Отображение имени пользователя будет добавлено через JS -->
      <div class="st-username-placeholder" style="display:none"></div>

      <!-- Кнопка продолжить на всю ширину -->
      <button class="st-cta-btn st-continue-mobile" id="st-continue-btn">Продолжить обучение</button>

      <div class="st-main">
        <!-- Блок 1: Прогресс/статистика (левый верхний, 33%) -->
        <div class="st-block-1">
          <div class="st-compact-card" role="group" aria-label="Краткая статистика">
            <div class="stc-top">
              <div class="stc-left">
                <div class="stc-row">
                  <span class="stc-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M7 3h10a2 2 0 0 1 2 2v16l-7-4-7 4V5a2 2 0 0 1 2-2Z" fill="currentColor" opacity="0.95"/>
                    </svg>
                  </span>
                  <span class="stc-label">Этап:</span>
                  <span class="stc-value stage-value stc-orange">${learningStage.stage}</span>
                </div>
                <div class="stc-row">
                  <span class="stc-label index-label">Индекс удержания:</span>
                  <span class="stc-value index-value stc-red stc-strong">${understandingIndex}%</span>
                </div>
              </div>
              <div class="stc-right">
                <div class="stc-row">
                  <span class="stc-label stc-today">Сегодня:</span>
                </div>
                <div class="stc-row">
                  <span class="stc-today-line"><span class="stc-value stc-strong">${sessionCount}</span> карточек <span class="muted">≈</span> <span class="approx">${planMins} минут</span></span>
                </div>
              </div>
            </div>
            <div class="stc-bottom">
              <div class="stc-forecast">
                <span class="stc-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 4h10M7 10h10M7 14h10M7 18h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </span>
                <span class="key">Прогноз:</span>
                <span class="date">${finishDateStr}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Блок достижений по категориям (центральный, span 2 ряда, 33%) -->
        <div class="st-block-achievements">
          <div class="st-cat-progress-wrap">
            <div class="st-cat-progress-title"> Прогресс по категориям</div>
            <div class="st-cat-progress-list" id="st-cat-progress-list">
              <!-- Заполняется динамически -->
            </div>
          </div>
        </div>

        <!-- Блок 2: Режимы тренировки (правый верхний, 33%) -->
        <div class="st-block-2">
          <div class="modes-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="st-mode-card" onclick="window.startMode('time_attack')" title="⏱️ Тайм-атака\n\n5 секунд на ответ.\n\nОшибки недопустимы — любая ошибка завершает сессию. Идеально для проверки знаний на скорость.">
              <span class="st-mode-icon">⏱️</span>
              <span class="st-mode-title">Тайм-атака</span>
            </div>
            <div class="st-mode-card" onclick="window.startMode('sudden_death')" title="☠️ Внезапная смерть\n\nИгра до первой ошибки.\n\nМаксимальная сложность — одна ошибка и сессия завершена. Проверь свою выдержку!">
              <span class="st-mode-icon">☠️</span>
              <span class="st-mode-title">Внезапная смерть</span>
            </div>
            <div class="st-mode-card" onclick="window.startMode('cram_hard')" title="🧠 Зубрежка сложных\n\nТолько карты с низким коэффициентом запоминания.\n\nФокус на слабых местах — система покажет только те карточки, которые вы забываете.">
              <span class="st-mode-icon">🧠</span>
              <span class="st-mode-title">Зубрежка сложных</span>
            </div>
            <div class="st-mode-card" onclick="window.startMode('new_cards')" title="🌱 Только новые\n\nИзучение свежего материала.\n\nПоказываются только карточки, которые вы ещё не начинали учить.">
              <span class="st-mode-icon">🌱</span>
              <span class="st-mode-title">Только новые</span>
            </div>
          </div>
        </div>

        <!-- Блок 3: График активности (левый нижний, 33%) -->
        <div class="st-block-3">
          <div class="activity-card activity">
            <div class="activity-header">
              <div class="period-switch">
                <div class="${currentXpMode === 'week' ? 'active' : ''}" onclick="window.changeXpMode('week')">Неделя</div>
                <div class="${currentXpMode === 'month' ? 'active' : ''}" onclick="window.changeXpMode('month')">Месяц</div>
                <div class="${currentXpMode === 'year' ? 'active' : ''}" onclick="window.changeXpMode('year')">Год</div>
              </div>
              <div class="month-switch"><span id="st-month-label"></span></div>
            </div>
            <div class="chart-wrapper">
              <svg class="chart" id="st-activity-chart"></svg>
            </div>
          </div>
        </div>

        <!-- Блок 4: Сложность карточек (правый нижний, 33%) -->
        <div class="st-block-4">
          <div class="st-diff-section">
            <div class="st-col-title"   style="margin-bottom: 5px;"
              >Сложность <button class="st-info-btn" onclick="window.openDiffInfoModal(event)" title="Как формируются уровни сложности?">i</button></div>
            <div class="st-diff-list" style="margin-top:0">
              ${segs.map((s, i) => `
                <div class="st-diff-item" onclick="window.openDiffModal('${i}')" title="${s.pct.toFixed(1)}%">
                  <div style="display:flex;align-items:center">
                    <div class="st-diff-dot" style="background:${s.color}"></div>
                    <div class="st-diff-name">${s.label} ${renderHeartsSvg(s.hearts, 'diff-'+i)}</div>
                  </div>
                  <div class="st-diff-count">${s.count}</div>
                  <div class="st-diff-barline" style="width:${s.pct}%; background:${s.color}"></div>
                </div>
              `).join('')}
              <div class="st-diff-item favorite" onclick="window.openDiffModal('favorites')" title="Избранное">
                <div style="display:flex;align-items:center">
                  <div class="st-diff-dot" style="background:#ffd700"></div>
                  <div class="st-diff-name">Избранное</div>
                </div>
                <div class="st-diff-count">${favCount}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Блок 5: Достижения (нижний, 100% ширины) -->
        <div class="st-block-5">
          <div class="st-ach-section">
            <div class="st-ach-scroll">
              <div class="st-ach-card ${achievements.firstSessionCompleted ? 'unlocked' : ''}" title="🏁 Первый шаг: Заверши первый урок" style="cursor: help;">
                <div class="st-ach-icon">🏁</div>
                <div class="st-ach-title">Первый шаг</div>
              </div>
              <div class="st-ach-card ${achievements.sevenDayStreak ? 'unlocked' : ''}" title="🔥 Неделя в огне: 7 дней подряд" style="cursor: help;">
                <div class="st-ach-icon">🔥</div>
                <div class="st-ach-title">Неделя в огне</div>
              </div>
              <div class="st-ach-card ${achievements.marathoner ? 'unlocked' : ''}" title="🏃 Марафонец: 30 дней подряд" style="cursor: help;">
                <div class="st-ach-icon">🏃</div>
                <div class="st-ach-title">Марафонец</div>
              </div>
              <div class="st-ach-card ${achievements.ninetyAccuracy ? 'unlocked' : ''}" title="🎯 Снайпер: Точность 90%+" style="cursor: help;">
                <div class="st-ach-icon">🎯</div>
                <div class="st-ach-title">Снайпер</div>
              </div>
              <div class="st-ach-card ${achievements.century ? 'unlocked' : ''}" title="💯 Центурион: 100 карточек" style="cursor: help;">
                <div class="st-ach-icon">💯</div>
                <div class="st-ach-title">Центурион</div>
              </div>
              <div class="st-ach-card ${achievements.master ? 'unlocked' : ''}" title="👑 Мастер: Уровень 10" style="cursor: help;">
                <div class="st-ach-icon">👑</div>
                <div class="st-ach-title">Мастер</div>
              </div>
              <div class="st-ach-card ${achievements.hardToEasy ? 'unlocked' : ''}" title="📈 Прогресс: 10 сложных → легкие" style="cursor: help;">
                <div class="st-ach-icon">📈</div>
                <div class="st-ach-title">Прогресс</div>
              </div>
              <div class="st-ach-card ${achievements.consistency ? 'unlocked' : ''}" title="🧘 Стабильность: 14 дней подряд" style="cursor: help;">
                <div class="st-ach-icon">🧘</div>
                <div class="st-ach-title">Стабильность</div>
              </div>
              <div class="st-ach-card ${achievements.comeback ? 'unlocked' : ''}" title="🦅 Возвращение: После перерыва" style="cursor: help;">
                <div class="st-ach-icon">🦅</div>
                <div class="st-ach-title">Возвращение</div>
              </div>
              <div class="st-ach-card ${achievements.earlyBird ? 'unlocked' : ''}" title="🌅 Жаворонок: Занятие до 9 утра" style="cursor: help;">
                <div class="st-ach-icon">🌅</div>
                <div class="st-ach-title">Жаворонок</div>
              </div>
              <div class="st-ach-card ${achievements.nightOwl ? 'unlocked' : ''}" title="🦉 Сова: Занятие после 23:00" style="cursor: help;">
                <div class="st-ach-icon">🦉</div>
                <div class="st-ach-title">Сова</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const levelCont = container.querySelector('.st-level-inline');
  if (levelCont) {
    // Добавляем имя пользователя перед уровнем
    const usernameSpan = document.createElement('span');
    usernameSpan.className = 'st-username-display';
    usernameSpan.style.marginRight = '8px';
    usernameSpan.style.fontSize = '13px';
    usernameSpan.style.color = '#4ec9b0';
    usernameSpan.style.fontWeight = '600';

    try {
      const sessionUserRaw = localStorage.getItem('qaSessionUser');
      if (sessionUserRaw) {
        const user = JSON.parse(sessionUserRaw);
        if (user && user.username) {
          usernameSpan.textContent = user.username;
        } else {
          usernameSpan.textContent = 'Гость';
          usernameSpan.style.color = '#808080';
        }
      } else {
        usernameSpan.textContent = 'Гость';
        usernameSpan.style.color = '#808080';
      }
    } catch (e) {
      usernameSpan.textContent = 'Гость';
      usernameSpan.style.color = '#808080';
    }

    levelCont.parentNode.insertBefore(usernameSpan, levelCont);

    try {
      const d = getCurrentLevel();
      const box = document.createElement('div');
      box.className = 'level-inline';
      const lbl = document.createElement('div');
      lbl.className = 'lv-label';
      lbl.textContent = `LV:${d.level}`;
      const bar = document.createElement('div');
      bar.className = 'level-inline-bar';
      const fill = document.createElement('div');
      fill.className = 'level-inline-fill';
      const p = Math.round((d.progress || 0) * 100);
      fill.style.width = `${p}%`;
      const txt = document.createElement('div');
      txt.className = 'level-inline-text';
      const cur = Math.max(0, Math.round((d.xp - d.prevThreshold)));
      const tot = d.nextThreshold === Infinity ? cur : Math.round(d.nextThreshold - d.prevThreshold);
      txt.textContent = `XP:${d.xp}  ${cur}/${tot}`;
      bar.appendChild(fill); bar.appendChild(txt);
      box.appendChild(lbl); box.appendChild(bar);
      levelCont.appendChild(box);
      /* duplicate flame removed; streak already shown in metrics */
      const upd = () => {
        try {
          const dd = getCurrentLevel();
          const l = levelCont.querySelector('.lv-label');
          const f = levelCont.querySelector('.level-inline-fill');
          const t = levelCont.querySelector('.level-inline-text');
          if (l) l.textContent = `LV:${dd.level}`;
          const pp = Math.round((dd.progress || 0) * 100);
          if (f) f.style.width = `${pp}%`;
          const cc = Math.max(0, Math.round((dd.xp - dd.prevThreshold)));
          const tt = dd.nextThreshold === Infinity ? cc : Math.round(dd.nextThreshold - dd.prevThreshold);
          if (t) t.textContent = `XP:${dd.xp}  ${cc}/${tt}`;
        } catch { }
      };
      window.addEventListener('xpUpdated', upd);
      window.addEventListener('statsClosed', upd);
    } catch { }
  }

  // Ensure "39 карточек ≈ 59 минут" stays on one line; reduce font-size by up to 2px if needed
  try {
    const todayLine = container.querySelector('.stc-today-line');
    if (todayLine) {
      const base = parseFloat(getComputedStyle(todayLine).fontSize) || 18;
      let size = base;
      let tries = 0;
      todayLine.style.whiteSpace = 'nowrap';
      while (todayLine.scrollWidth > todayLine.clientWidth && tries < 2) {
        size -= 1;
        todayLine.style.fontSize = `${size}px`;
        tries += 1;
      }
    }
  } catch { }

  const topRight = container.querySelector('.st-top-right');

  const homeBtn = container.querySelector('.st-home-btn');
  if (homeBtn) {
    homeBtn.addEventListener('click', () => {
      location.hash = '';
      hideStatsPage();
      const mainNav = document.getElementById('bottom-nav');
      if (mainNav) {
        const homeNav = mainNav.querySelector('#bn-home');
        if (homeNav) homeNav.click();
      }
    });
  }

  const continueBtn = container.querySelector('#st-continue-btn');
  if (continueBtn) {
    continueBtn.addEventListener('click', () => {
      const questions = (window.currentQuestions && window.currentQuestions.length > 0)
        ? window.currentQuestions
        : getCurrentCards();

      if (!questions || questions.length === 0) {
        alert('Нет вопросов для изучения');
        return;
      }

      hideStatsPage();
      startLearnSession(questions);

      const mainNav = document.getElementById('bottom-nav');
      if (mainNav) {
        const learnNav = mainNav.querySelector('#bn-learn');
        if (learnNav) learnNav.click();
      }
    });
  }

  // Функция для кнопки "Продолжить обучение" в шапке
  window.startDailySession = () => {
    const questions = (window.currentQuestions && window.currentQuestions.length > 0)
      ? window.currentQuestions
      : uniqueQaData;

    if (!questions || questions.length === 0) {
      alert('Нет вопросов для изучения');
      return;
    }

    hideStatsPage();
    startLearnSession(questions);

    const mainNav = document.getElementById('bottom-nav');
    if (mainNav) {
      const learnNav = mainNav.querySelector('#bn-learn');
      if (learnNav) learnNav.click();
    }
  };

  const startTodayLink = container.querySelector('#st-start-today');
  if (startTodayLink) {
    startTodayLink.addEventListener('click', () => {
      const questions = (window.currentQuestions && window.currentQuestions.length > 0)
        ? window.currentQuestions
        : uniqueQaData;

      if (!questions || questions.length === 0) {
        alert('Нет вопросов для изучения');
        return;
      }

      hideStatsPage();
      startLearnSession(questions);

      const mainNav = document.getElementById('bottom-nav');
      if (mainNav) {
        const learnNav = mainNav.querySelector('#bn-learn');
        if (learnNav) learnNav.click();
      }
    });
  }

  const authBtn = container.querySelector('.st-auth-btn');
  if (authBtn) {
    authBtn.addEventListener('click', () => {
      const user = window.qaAuth && window.qaAuth.getUser ? window.qaAuth.getUser() : null;
      if (user) {
        const username = user.username || user.email || 'пользователь';
        if (confirm(`Выйти из аккаунта ${username}?`)) {
          if (window.qaAuth.logout) window.qaAuth.logout();
          renderStats();
        }
      } else {
        if (window.qaAuth && typeof window.qaAuth.openLogin === 'function') {
          window.qaAuth.openLogin();
        } else {
          alert('Окно входа недоступно');
        }
      }
    });
  }
  const statsBtn = container.querySelector('.st-stats-btn');
  if (statsBtn) {
    statsBtn.addEventListener('click', () => { });
  }
  const learnMainBtn = container.querySelector('.st-learn-btn');
  if (learnMainBtn) {
    learnMainBtn.addEventListener('click', () => {
      const qs = (window.currentQuestions && window.currentQuestions.length > 0) ? window.currentQuestions : uniqueQaData;
      if (!qs || qs.length === 0) { alert('Нет вопросов для изучения'); return; }
      hideStatsPage();
      startLearnSession(qs);
      const mainNav = document.getElementById('bottom-nav');
      if (mainNav) {
        const learnNav = mainNav.querySelector('#bn-learn');
        if (learnNav) learnNav.click();
      }
    });
  }
  const chartEl = container.querySelector('#st-activity-chart');
  const monthLabel = container.querySelector('#st-month-label');

  // Рендерим прогресс по категориям
  renderCategoryProgress();

  if (chartEl) {
    const data = getActivitySeries(currentXpMode);
    const maxHearts = Math.max(...data.map(d => d.hearts || 0), 1);
    const maxCards = Math.max(...data.map(d => d.cards || 0), 1);
    const rawMax = Math.max(maxHearts, maxCards);
    const maxVal = currentXpMode === 'week' ? rawMax * 1.2
      : currentXpMode === 'month' ? rawMax * 1.15
        : rawMax * 1.2;
    const h = chartEl.clientHeight || 280;
    const bottomPad = 16;
    const topPad = 20;
    const leftMargin = 40;
    const innerH = h - bottomPad - topPad;
    const ticks = currentXpMode === 'week'
      ? [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal]
      : (currentXpMode === 'month'
        ? [0, maxVal * 0.33, maxVal * 0.66, maxVal]
        : [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal]);

    const now = new Date();
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const mName = monthNames[now.getMonth()] + ' ' + now.getFullYear();
    monthLabel.textContent = mName;
    const cfg = currentXpMode === 'week' ? { bar: 18, gap: 8, count: 14, labelStep: 2 }
      : currentXpMode === 'month' ? { bar: 12, gap: 6, count: data.length, labelStep: 4 }
        : { bar: 28, gap: 16, count: 12, labelStep: 1 };
    const width = chartEl.clientWidth || 600;
    const wideBarW = 14;
    const narrowBarW = 8;
    const innerGap = 0;
    const groupW = wideBarW;
    const colsW = cfg.count * groupW + (cfg.count - 1) * cfg.gap + leftMargin;
    chartEl.setAttribute('viewBox', `0 0 ${Math.max(width, colsW)} ${h}`);
    const grid = ticks.map(t => {
      const y = (innerH / maxVal) * t;
      return `<line class="chart-grid-line" x1="${leftMargin}" y1="${topPad + (innerH - y)}" x2="${Math.max(width, colsW)}" y2="${topPad + (innerH - y)}"/>`;
    }).join('');
    const yLabels = ticks.map(t => {
      const y = (innerH / maxVal) * t;
      const yy = topPad + (innerH - y) + 4;
      return `<text class="chart-label" x="${leftMargin - 8}" y="${yy}" text-anchor="end">${Math.round(t)}</text>`;
    }).join('');
    const bars = [];
    const defs = [];
    let x = leftMargin;
    const hcMax = rawMax;
    const toRgb = (hex) => { const h = hex.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
    const lerp = (a, b, t) => Math.round(a + (b - a) * t);
    const lerpHex = (h1, h2, t) => { const [r1, g1, b1] = toRgb(h1), [r2, g2, b2] = toRgb(h2); const r = lerp(r1, r2, t).toString(16).padStart(2, '0'); const g = lerp(g1, g2, t).toString(16).padStart(2, '0'); const b = lerp(b1, b2, t).toString(16).padStart(2, '0'); return `#${r}${g}${b}`; };
    const redDark = '#8B0000'; const redBright = '#FF3B3B';
    const orangeDark = '#B45309'; const orangeBright = '#FF9F1C';
    data.forEach((d, idx) => {
      const labelOk = currentXpMode === 'year' ? true : (idx % cfg.labelStep === 0);
      const cardsH = Math.max(2, Math.min(innerH, (innerH / hcMax) * (d.cards || 0)));
      const yCards = topPad + (innerH - cardsH);
      const tCards = Math.max(0, Math.min(1, (d.cards || 0) / hcMax));
      const topOrange = lerpHex(orangeDark, orangeBright, tCards);
      defs.push(`<linearGradient id="go${idx}" gradientUnits="userSpaceOnUse" x1="0" y1="${topPad + innerH}" x2="0" y2="${topPad}"><stop offset="0%" stop-color="${orangeDark}"/><stop offset="100%" stop-color="${topOrange}"/></linearGradient>`);
      const rWide = Math.round(wideBarW / 2);
      const pathCards = `M ${x} ${yCards + cardsH} L ${x} ${yCards + rWide} A ${rWide} ${rWide} 0 0 1 ${x + wideBarW} ${yCards + rWide} L ${x + wideBarW} ${yCards + cardsH} Z`;
      bars.push(`<path class="bar-cards" d="${pathCards}" data-type="cards" data-date="${d.date}" data-hearts="${d.hearts || 0}" data-cards="${d.cards || 0}" fill="url(#go${idx})"/>`);

      const heartsH = Math.max(2, Math.min(innerH, (innerH / hcMax) * (d.hearts || 0)));
      const yHearts = topPad + (innerH - heartsH);
      const heartsX = x + Math.round((wideBarW - narrowBarW) / 2);
      const tHearts = Math.max(0, Math.min(1, (d.hearts || 0) / hcMax));
      const topRed = lerpHex(redDark, redBright, tHearts);
      defs.push(`<linearGradient id="gh${idx}" gradientUnits="userSpaceOnUse" x1="0" y1="${topPad + innerH}" x2="0" y2="${topPad}"><stop offset="0%" stop-color="${redDark}"/><stop offset="100%" stop-color="${topRed}"/></linearGradient>`);
      const rNarrow = Math.round(narrowBarW / 2);
      const pathHearts = `M ${heartsX} ${yHearts + heartsH} L ${heartsX} ${yHearts + rNarrow} A ${rNarrow} ${rNarrow} 0 0 1 ${heartsX + narrowBarW} ${yHearts + rNarrow} L ${heartsX + narrowBarW} ${yHearts + heartsH} Z`;
      bars.push(`<path class="bar-hearts" d="${pathHearts}" data-type="hearts" data-date="${d.date}" data-hearts="${d.hearts || 0}" data-cards="${d.cards || 0}" fill="url(#gh${idx})"/>`);
      if (labelOk) {
        bars.push(`<text class="chart-label" x="${x + groupW / 2}" y="${h - 4}" text-anchor="middle">${d.label}</text>`);
      }
      x += groupW + cfg.gap;
    });
    chartEl.innerHTML = `<defs>${defs.join('')}</defs>${grid}${yLabels}${bars.join('')}`;
    let tip = document.querySelector('.tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'tooltip';
      document.body.appendChild(tip);
    }
    const showTip = (ev, tgt) => {
      const date = tgt.getAttribute('data-date');
      const hearts = tgt.getAttribute('data-hearts');
      const cards = tgt.getAttribute('data-cards');
      const type = tgt.getAttribute('data-type');
      const typeLabel = type === 'hearts' ? 'Сердечки (красный)' : 'Карточки (оранжевый)';
      tip.innerHTML = `<div class="tooltip-date">${new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}</div><div style="margin:4px 0;color:#fff;font-weight:600">${typeLabel}</div><div>❤️: ${hearts}</div><div>📚: ${cards}</div><div class="tip-arrow"></div>`;
      tip.style.display = 'block';
      const bb = tgt.getBoundingClientRect();
      tip.style.left = Math.round(bb.left + window.scrollX + (bb.width / 2) + 12) + 'px';
      tip.style.top = Math.round(bb.top + window.scrollY - 8) + 'px';
    };
    const moveTip = () => { };
    const hideTip = () => { tip.style.display = 'none'; };
    chartEl.querySelectorAll('.bar-hearts,.bar-cards').forEach(el => {
      el.addEventListener('mouseenter', (e) => { showTip(e, e.currentTarget); e.currentTarget.style.filter = 'brightness(1.2)'; });
      el.addEventListener('mousemove', moveTip);
      el.addEventListener('mouseleave', (e) => { hideTip(); e.currentTarget.style.filter = ''; });
    });
  }
}

function renderXpChart(data) {
  if (!data || data.length === 0) return '';
  const maxTotal = Math.max(...data.map(d => (d.xp + (d.hearts || 0))), 10);
  return data.map(d => {
    const xpHRaw = (d.xp / maxTotal) * 100;
    const heartsHRaw = ((d.hearts || 0) / maxTotal) * 100;
    const xpH = Math.max(xpHRaw, d.xp > 0 ? 2 : 0);
    const heartsH = Math.min(Math.max(heartsHRaw, 0), Math.max(0, 100 - xpHRaw));
    return `
      <div class="st-xp-col ${d.isToday ? 'today' : ''}" title="${d.date}: ${d.xp} XP, ❤�� ${(d.hearts || 0)}">
         <div class="st-bar-xp" style="height:${xpH}%"></div>
         <div class="st-bar-heart" style="height:${heartsH}%; bottom:${xpHRaw}%"></div>
         <div class="st-xp-label">${d.label}</div>
      </div>
    `;
  }).join('');
}

function renderImpChart(data) {
  if (!data || data.length === 0) return '';
  // Find max amplitude
  const maxVal = Math.max(...data.map(d => Math.max(d.improved, d.regressed)), 5);

  return data.map(d => {
    const hPos = (d.improved / maxVal) * 50; // Max 50% height
    const hNeg = (d.regressed / maxVal) * 50; // Max 50% height
    return `
      <div class="st-imp-col" title="${d.date}: +${d.improved} / -${d.regressed}">
         <div class="st-imp-bar-pos" style="height: ${hPos}%"></div>
         <div class="st-imp-bar-neg" style="height: ${hNeg}%"></div>
         <div class="st-imp-date">${d.date.split('-')[2]}</div>
      </div>
    `;
  }).join('');
}

function renderHearts(dist, total) {
  if (total === 0) return '<div class="st-hearts-bar" style="background:#333;justify-content:center;align-items:center;color:#666;font-size:12px">Нет данных</div>';

  const hearts = [
    { val: 1, count: dist[1], icon: '💔' },
    { val: 2, count: dist[2], icon: '❤️' },
    { val: 3, count: dist[3], icon: '🧡' },
    { val: 4, count: dist[4], icon: '💛' },
    { val: 5, count: dist[5], icon: '💚' }
  ];

  return `
    <div class="st-hearts-bar">
       ${hearts.map(h => {
    const pct = (h.count / total) * 100;
    if (pct < 1) return '';
    return `<div class="st-hb-seg" data-val="${h.val}" style="width:${pct}%" title="${h.count} карт"><span class="st-hb-icon">${h.icon}</span></div>`;
  }).join('')}
    </div>
  `;
}

// Global Handlers
window.changeXpMode = (mode) => {
  currentXpMode = mode;
  renderStats();
};
window.openDiffInfoModal = (event) => {
  if (event) event.stopPropagation();
  const overlay = document.createElement('div');
  overlay.className = 'st-modal-overlay';
  overlay.innerHTML = `
     <div class="st-modal" style="max-width:600px;">
        <div class="st-modal-header">
           <div class="st-modal-title">💖 Тренажёр сердечек</div>
           <button class="st-modal-close" onclick="this.closest('.st-modal-overlay').remove()">×</button>
        </div>
        <div class="st-modal-body" style="padding:16px;">
           <div id="sim-hearts" style="display:flex;justify-content:center;gap:4px;margin-bottom:12px;"></div>
           <div style="text-align:center;margin-bottom:16px;">
              <div style="font-size:20px;font-weight:700;color:#fff;"><span id="sim-value">3.00</span> / 5 ❤️</div>
              <div style="font-size:13px;color:var(--st-text-sec);">Уровень: <span id="sim-level">Стандарт</span></div>
           </div>
           <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;">
              <button onclick="simClick(0)" style="background:#E5533D;color:#fff;border:none;padding:10px;border-radius:8px;cursor:pointer;font-weight:700;"><div style="font-size:20px;">😫</div><div style="font-size:11px;">Снова</div><div style="font-size:10px;opacity:0.8;">-0.25</div></button>
              <button onclick="simClick(1)" style="background:#FF9F1C;color:#000;border:none;padding:10px;border-radius:8px;cursor:pointer;font-weight:700;"><div style="font-size:20px;">😐</div><div style="font-size:11px;">Трудно</div><div style="font-size:10px;opacity:0.8;">-0.15</div></button>
              <button onclick="simClick(2)" style="background:#2EC4B6;color:#000;border:none;padding:10px;border-radius:8px;cursor:pointer;font-weight:700;"><div style="font-size:20px;">😊</div><div style="font-size:11px;">Хорошо</div><div style="font-size:10px;opacity:0.8;">+0.05</div></button>
              <button onclick="simClick(3)" style="background:#4CAF50;color:#fff;border:none;padding:10px;border-radius:8px;cursor:pointer;font-weight:700;"><div style="font-size:20px;">🚀</div><div style="font-size:11px;">Легко</div><div style="font-size:10px;opacity:0.8;">+0.05</div></button>
           </div>
           <button onclick="simReset()" style="width:100%;background:rgba(255,255,255,0.1);color:#fff;border:1px solid var(--st-border);padding:10px;border-radius:8px;cursor:pointer;">🔄 Сбросить</button>
           <div id="sim-msg" style="margin-top:12px;font-size:13px;color:var(--st-text-sec);text-align:center;min-height:18px;"></div>
        </div>
     </div>
   `;
  document.body.appendChild(overlay);
  window.simValue = 3.0;
  window.simClick = (action) => { const changes = [-0.25, -0.15, +0.05, +0.05]; window.simValue = Math.max(0, Math.min(5, window.simValue + changes[action])); updateSim(); };
  window.simReset = () => { window.simValue = 3.0; updateSim(); };
  function createHeart(id, fillPercent) { return '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" style="display:inline-block;"><defs><linearGradient id="'+id+'"><stop offset="'+fillPercent+'%" stop-color="#ff4d4d"/><stop offset="'+fillPercent+'%" stop-color="#444"/></linearGradient></defs><path fill="url(#'+id+')" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>'; }
  function updateSim() { const v = window.simValue; document.getElementById('sim-value').textContent = v.toFixed(2); const full = Math.floor(v); const partial = v - full; const heartsContainer = document.getElementById('sim-hearts'); let html = ''; for (let i = 1; i <= 5; i++) { const fillPercent = i <= full ? 100 : (i === full + 1 ? Math.round(partial * 100) : 0); html += createHeart('sim-grad-' + i, fillPercent); } heartsContainer.innerHTML = html; const levels = ['Очень трудные', 'Трудные', 'Стандарт', 'Стандарт', 'Легкие']; const levelIdx = v < 1 ? 0 : v < 2 ? 1 : v < 3 ? 2 : v < 4 ? 3 : 4; document.getElementById('sim-level').textContent = levels[levelIdx]; const msg = document.getElementById('sim-msg'); if (v <= 0) msg.textContent = '⚠️ 0 сердечек — начните заново!'; else if (v >= 5) msg.textContent = '🎉 5 сердечек — карточка в памяти!'; else msg.textContent = ''; }
  updateSim();
};

function getHeartsForEf(ef) {
  if (ef === undefined || ef === null) return '🆕'; // New cards
  if (ef < 1.7) return '❤️🤍🤍🤍🤍';
  if (ef < 2.1) return '❤️❤️🤍🤍🤍';
  if (ef < 2.4) return '❤️❤️❤️🤍🤍';
  if (ef < 2.9) return '❤️❤️❤️❤️🤍';
  return '❤️❤️❤️❤️❤️';
}

window.openDiffModal = (index) => {
  let list = [];
  let label = '';
  const prog = getProgressMap();
  const favorites = new Set(JSON.parse(localStorage.getItem('qaFavorites') || '[]'));
  const currentCards = getCurrentCards();

  console.log('[openDiffModal] Избранное:', {
    favCount: favorites.size,
    favQuestions: Array.from(favorites),
    totalCards: currentCards.length
  });

  if (index === 'favorites') {
    list = currentCards.filter(q => favorites.has(q.question));
    label = 'Избранное';
    console.log('[openDiffModal] Найдено карточек в избранном:', list.length, list.map(q => q.question));
  } else {
    const i = parseInt(index);
    const ranges = [
      { min: 2.4, max: 999, label: 'Легкие' },
      { min: 2.1, max: 2.4, label: 'Стандарт' },
      { min: 1.7, max: 2.1, label: 'Трудные' },
      { min: 0, max: 1.7, label: 'Очень трудные' }
    ];
    const r = ranges[i];
    label = r.label;
    list = currentCards.filter(q => {
      const p = prog[q.question] || prog[q.question.trim()];
      if (!p || p.easeFactor === undefined) return false;
      return p.easeFactor >= r.min && p.easeFactor < r.max;
    });
  }

  console.log('[openDiffModal] Карточек:', list.length, 'из', currentCards.length);

  // Show Modal
  const overlay = document.createElement('div');
  overlay.className = 'st-modal-overlay';
  overlay.innerHTML = `
    <div class="st-modal">
       <div class="st-modal-header">
          <div class="st-modal-title">${label} (${list.length})</div>
          <button class="st-modal-close" onclick="this.closest('.st-modal-overlay').remove()">×</button>
       </div>
       <div class="st-modal-body">
          <ul class="st-modal-list">
             ${list.slice(0, 50).map((q, idx) => {
    const p = prog[q.question] || prog[q.question.trim()];
    const ef = p ? p.easeFactor : undefined;
    const heartsCount = getHeartsCountForEf(ef);
    const heartsSvg = renderHeartsSvg(heartsCount, 'modal-'+idx);
    const isFav = favorites.has(q.question);

    return `
                <li class="st-modal-item">
                   <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px">
                       <span class="st-modal-q" style="flex:1; padding-right:8px; font-weight:600; color:#fff">${q.question}</span>
                       <div style="display:flex; gap:6px; align-items:center; flex-shrink:0; font-size:12px">
                          <span title="EF: ${ef ? ef.toFixed(2) : 'N/A'}">${heartsSvg}</span>
                          ${isFav ? '<span style="color:#ffd700; font-size:14px">★</span>' : ''}
                       </div>
                   </div>
                   <div class="st-modal-a" style="font-size:13px; color:var(--st-text-sec)">${q.answer.substring(0, 80)}${q.answer.length > 80 ? '...' : ''}</div>
                </li>
                `;
  }).join('')}
             ${list.length > 50 ? `<li class="st-modal-item" style="text-align:center;color:var(--st-muted)">...и ещ�� ${list.length - 50}</li>` : ''}
          </ul>
       </div>
       <div class="st-modal-footer">
          <button class="st-modal-btn" onclick="window.startFilteredSession('${index}')">Тренировать эту группу</button>
       </div>
    </div>
  `;
  document.body.appendChild(overlay);
};

window.startFilteredSession = (index) => {
  document.querySelector('.st-modal-overlay')?.remove();

  const currentCards = getCurrentCards();
  let cards = [];
  if (index === 'favorites') {
    const favorites = new Set(JSON.parse(localStorage.getItem('qaFavorites') || '[]'));
    cards = currentCards.filter(q => favorites.has(q.question));
  } else {
    const i = parseInt(index);
    const ranges = [
      { min: 2.4, max: 999 },
      { min: 2.1, max: 2.4 },
      { min: 1.7, max: 2.1 },
      { min: 0, max: 1.7 }
    ];
    const r = ranges[i];
    const prog = getProgressMap();

    cards = currentCards.filter(q => {
      const p = prog[q.question] || prog[q.question.trim()];
      if (!p || p.easeFactor === undefined) return false;
      return p.easeFactor >= r.min && p.easeFactor < r.max;
    });
  }

  console.log('[startFilteredSession] Карточек:', cards.length);

  if (cards.length === 0) {
    alert('Нет карт в этой категории');
    return;
  }

  hideStatsPage();
  startLearnSession(cards, { mode: 'cram' });
};

window.startRiskSession = (catName) => {
  const currentCards = getCurrentCards();
  const riskZones = getRiskZones(currentCards);
  const zone = riskZones.find(z => z.cat === catName);
  if (!zone || !zone.items || zone.items.length === 0) return;

  hideStatsPage();
  startLearnSession(zone.items, { mode: 'cram' });
};

window.startMode = (modeId) => {
  console.log('[Stats] Starting mode:', modeId);

  const currentCards = getCurrentCards();
  if (!currentCards || currentCards.length === 0) {
    alert('Данные не загружены');
    return;
  }

  const progress = getProgressMap();
  let candidates = [];
  let options = { mode: modeId };

  if (modeId === 'time_attack' || modeId === 'sudden_death') {
    const valid = uniqueQaData.filter(q => q && q.question && q.answer);
    if (valid.length === 0) {
      alert('Нет доступных карточек');
      return;
    }
    candidates = [...valid].sort(() => 0.5 - Math.random()).slice(0, 50);

  } else if (modeId === 'cram_hard') {
    candidates = uniqueQaData.filter(q => {
      const p = progress[q.question] || progress[q.question.trim()];
      return p && p.easeFactor !== undefined && p.easeFactor < 2.2;
    });

    if (candidates.length === 0) {
      alert('Нет карточек со сложностью ниже 2.2');
      return;
    }
    options.mode = 'cram';

  } else if (modeId === 'new_cards') {
    candidates = uniqueQaData.filter(q => {
      const p = progress[q.question] || progress[q.question.trim()];
      return !p || !p.lastReviewed;
    });

    if (candidates.length === 0) {
      alert('Нет новых карточек');
      return;
    }
    options.mode = 'cram';
  }

  if (candidates.length > 0) {
    hideStatsPage();
    startLearnSession(candidates, options);
  }
};

// ========== Функция для рендеринга прогресса по категориям ==========
function renderCategoryProgress() {
  const currentCards = getCurrentCards();
  if (!currentCards || currentCards.length === 0) return;

  const progress = getProgressMap();

  // Функция для получения количества сердечек по EF
  const getHeartsCount = (ef) => {
    if (ef >= 2.4) return 5;      // EASY
    if (ef >= 2.1) return 4;      // STANDARD
    if (ef >= 1.7) return 3;      // HARD
    return 1;                      // VERY HARD
  };

  // Группируем по категориям
  const categoryStats = {};
  currentCards.forEach(card => {
    const cat = card.category || 'Без категории';
    if (!categoryStats[cat]) {
      categoryStats[cat] = { total: 0, heartsFilled: 0 };
    }
    categoryStats[cat].total++;

    // Считаем заполненные сердечки (SRS прогресс)
    const cardProgress = progress[card.question] || progress[card.question.trim()];
    if (cardProgress && cardProgress.easeFactor !== undefined) {
      const hearts = getHeartsCount(cardProgress.easeFactor);
      categoryStats[cat].heartsFilled += hearts;
    }
  });

  // Рассчитываем проценты и сортируем
  const categoryProgress = Object.entries(categoryStats)
    .map(([name, stats]) => {
      const maxHearts = stats.total * 5; // Максимум 5 сердечек на карточку
      const percentage = maxHearts > 0 ? Math.round((stats.heartsFilled / maxHearts) * 100) : 0;
      return { name, percentage, total: stats.total };
    })
    .sort((a, b) => b.percentage - a.percentage); // Сортируем по убыванию прогресса

  // Рендерим
  const container = document.getElementById('st-cat-progress-list');
  if (!container) return;

  container.innerHTML = categoryProgress.map(cat => `
        <div class="st-cat-progress-item">
            <div class="st-cat-progress-header">
                <span class="st-cat-progress-name">${cat.name}</span>
                <span class="st-cat-progress-value">${cat.percentage}%</span>
            </div>
            <div class="st-cat-progress-track">
                <div class="st-cat-progress-fill" style="width: ${cat.percentage}%"></div>
            </div>
        </div>
    `).join('');
}
// ======================================================================

function getXpSeries(mode) {
  // Вспомогательная функция для получения даты по MSK (UTC+3)
  const getMSKDate = (date) => {
    const mskOffset = 3 * 60 * 60 * 1000;
    return new Date(date.getTime() + mskOffset).toISOString().split('T')[0];
  };

  console.log('[CHART.XP] Starting getXpSeries, mode:', mode);
  const data = getDailyPointsAll(); // {date, xp, bonus, dayBonus}
  const prog = getProgressMap();
  const revCounts = new Map();
  try {
    Object.values(prog).forEach(p => {
      if (p && p.lastReviewed) {
        revCounts.set(p.lastReviewed, (revCounts.get(p.lastReviewed) || 0) + 1);
      }
    });
  } catch { }
  const today = new Date();
  const todayStr = getMSKDate(today);
  console.log('[CHART.XP] todayStr (MSK):', todayStr);
  const days = mode === 'week' ? 7 : (mode === 'month' ? 30 : (mode === 'year' ? 365 : 365));
  const res = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const s = getMSKDate(d);
    const entry = data.find(x => x.date === s) || { xp: 0, bonus: 0, dayBonus: 0 };
    if (i <= 2 || i >= days - 2) {
      console.log(`[CHART.XP] Day ${i}:`, { date: s, xp: entry.xp, isToday: s === todayStr });
    }
    res.push({
      date: s,
      label: d.toLocaleDateString('ru-RU', { day: 'numeric' }),
      xp: entry.xp,
      hearts: entry.dayBonus || entry.bonus || revCounts.get(s) || 0,
      isToday: i === 0
    });
  }
  const trimmed = res.filter(e => (e.xp + (e.hearts || 0)) > 0 || e.isToday);
  return trimmed.length ? trimmed : res;
}

function getActivitySeries(mode) {
  // Вспомогательная функция для получения даты по MSK
  const getMSKDate = (date) => {
    try {
      const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' });
      const parts = fmt.formatToParts(date);
      return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;
    } catch {
      const mskOffset = 3 * 60 * 60 * 1000;
      return new Date(date.getTime() + mskOffset).toISOString().split('T')[0];
    }
  };

  const daily = getDailyPointsAll();
  const imp = getDailyImprovements(400);
  const impMap = new Map(imp.map(d => [d.date, d]));
  const today = new Date();
  const days = mode === 'week' ? 14 : (mode === 'month' ? new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() : 365);
  const res = [];
  if (mode === 'year') {
    for (let m = 0; m < 12; m++) {
      const y = today.getFullYear();
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);
      let xp = 0, hearts = 0, cards = 0;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const s = getMSKDate(d);
        const de = daily.find(x => x.date === s);
        const im = impMap.get(s);
        xp += de ? (de.xp || 0) : 0;
        hearts += im ? (im.regressed || 0) : 0;
        cards += im ? (im.reviewed || 0) : 0;
      }
      res.push({ date: getMSKDate(new Date(y, m, 1)), label: new Date(y, m, 1).toLocaleString('ru-RU', { month: 'short' }), xp, hearts, cards });
    }
    return res;
  }
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (mode === 'month' && d.getMonth() !== today.getMonth()) continue;
    const s = getMSKDate(d);
    const de = daily.find(x => x.date === s) || { xp: 0 };
    const im = impMap.get(s) || { improved: 0, regressed: 0, reviewed: 0 };
    res.push({
      date: s,
      label: mode === 'week' ? d.toLocaleDateString('ru-RU', { day: 'numeric' }) : d.getDate().toString(),
      xp: de.xp || 0,
      hearts: im.regressed || 0,
      cards: im.reviewed || 0
    });
  }
  return res;
}
