import { getMetrics, calculateActivity, getCategoryProgress, checkAchievements, getCurrentLevel, getDailyPoints, getDailyPointsAll, getDailyStreakSeries, getHeartsDistribution, getLearningStage, getUnderstandingIndex, getRiskZones, getDailyImprovements } from './stats-utils.js?v=5';
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
  padding: 12px 16px;
  background: rgba(229, 83, 61, 0.08);
  border-left: 3px solid var(--st-danger);
  border-radius: 6px;
  transition: background 0.2s;
}
.st-risk-item:hover { background: rgba(229, 83, 61, 0.12); }
.st-risk-info { display: flex; flex-direction: column; }
.st-risk-name { font-weight: 600; color: #ffcccc; font-size: 14px; margin-bottom: 2px; }
.st-risk-sub { font-size: 12px; color: rgba(255,255,255,0.6); }
.st-risk-btn {
  background: var(--st-danger);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.1s;
}
.st-risk-btn:active { transform: scale(0.95); }

/* Game Modes */
.st-mode-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 12px;
}
.st-mode-card {
  background: var(--st-surf);
  border: 1px solid var(--st-border);
  padding: 16px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  position: relative;
  overflow: hidden;
}
.st-mode-card:hover { border-color: var(--st-prim); background: var(--st-surf-h); transform: translateY(-2px); }
.st-mode-icon { font-size: 24px; margin-bottom: 8px; display: block; }
.st-mode-title { font-weight: 600; font-size: 14px; margin-bottom: 4px; color: #fff; display: block; }
.st-mode-desc { font-size: 11px; color: var(--st-muted); display: block; line-height: 1.4; }
.st-mode-tag { 
  position: absolute; top: 8px; right: 8px; 
  font-size: 9px; padding: 2px 6px; border-radius: 4px; 
  background: var(--st-border); color: var(--st-muted); 
  text-transform: uppercase; font-weight: 700;
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
.st-info-btn {
  background: none; border: 1px solid var(--st-muted); color: var(--st-muted);
  width: 18px; height: 18px; border-radius: 50%;
  font-size: 11px; line-height: 16px; text-align: center;
  margin-left: 8px; cursor: pointer; display: inline-block;
  vertical-align: middle;
}
.st-info-btn:hover { border-color: var(--st-text); color: var(--st-text); }
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
  .st-diff-section, .st-cat-section, .st-risk-section {
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
  const improvements = getDailyImprovements(currentXpMode === 'week' ? 7 : (currentXpMode === 'month' ? 30 : 14));

  const lvlProgressPct = Math.max(0, Math.min(1, level.progress || 0)) * 100;
  const remainingXp = Math.max(0, Math.round(level.remaining || 0));

  const todayStr = new Date().toISOString().split('T')[0];
  let cardsDoneToday = 0;
  
  // Forecast calculations
  let dueTomorrow = 0;
  let dueWeek = 0;
  const now = new Date();
  const tomorrowStart = new Date(now); tomorrowStart.setDate(now.getDate() + 1); tomorrowStart.setHours(0,0,0,0);
  const tomorrowEnd = new Date(tomorrowStart); tomorrowEnd.setHours(23,59,59,999);
  const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7); weekEnd.setHours(23,59,59,999);

  uniqueQaData.forEach(q => {
      const p = progressMap[q.question] || progressMap[q.question.trim()];
      if (p && p.nextReviewDate) {
          const d = new Date(p.nextReviewDate);
          if (d >= tomorrowStart && d <= tomorrowEnd) dueTomorrow++;
          if (d >= now && d <= weekEnd) dueWeek++;
      }
  });
  
  // Calculate Difficulty Distribution
   const segs = [
      { label: 'Очень трудные', min: 0, max: 1.7, count: 0, color: 'var(--st-danger)', colorClass: 'red' },
      { label: 'Трудные', min: 1.7, max: 2.1, count: 0, color: 'var(--st-prim)', colorClass: 'orange' },
      { label: 'Стандарт', min: 2.1, max: 2.4, count: 0, color: 'var(--st-sec)', colorClass: 'green' },
      { label: 'Легкие', min: 2.4, max: 999, count: 0, color: '#2f81f7', colorClass: 'blue' }
   ];
  
  let totalRated = 0;
  let favCount = 0;
  const favorites = new Set(JSON.parse(localStorage.getItem('qaFavorites') || '[]'));

  uniqueQaData.forEach(q => {
     if (favorites.has(q.question)) favCount++;

     let p = progressMap[q.question];
     if (!p && q.question) p = progressMap[q.question.trim()];

     if (p && p.lastReviewed === todayStr) {
         cardsDoneToday++;
     }

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

  // Render HTML
  const container = document.getElementById('stats-container');
  if (!container) return;

  container.innerHTML = `
    <div class="st-wrapper">
      <div class="st-header">
        <button class="nav-icon-btn st-home-btn" title="На главную">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 3l9 8-1.5 1.5L12 6 4.5 12.5 3 11z"/><path d="M5 13v8h6v-6h2v6h6v-8l-7-6z"/></svg>
        </button>
        <div class="st-header-title">Статистика</div>
        <div class="st-header-right">
           <button class="nav-icon-btn st-auth-btn" title="${authTitle}">
             ${authIcon}
           </button>
        </div>
      </div>

      <div class="st-hero">
        <div class="st-hero-left">
           <div class="st-level-row">
             <div class="st-lvl-num">Уровень ${level.level}</div>
             <div class="st-lvl-xp">${remainingXp} XP до след.</div>
           </div>
           <div class="st-hero-bar-bg">
             <div class="st-hero-bar-fill" style="width: ${lvlProgressPct}%"></div>
           </div>
        </div>
        <div class="st-hero-stats">
          <div class="st-hero-stat"><span class="st-hero-icon">🔥</span> ${metrics.streakCurrent}</div>
          <div class="st-hero-stat"><span class="st-hero-icon">⚡</span> ${metrics.xp} XP</div>
          <div class="st-hero-stat"><span class="st-hero-icon">📚</span> ${studiedCards}</div>
        </div>
        <div class="st-sticky-cta-wrapper">
           <button class="st-cta-btn" id="st-continue-btn">
             Продолжить (${sessionCount})
           </button>
        </div>
      </div>

      <div class="st-meta-state">
         <div class="st-meta-info">
            <div class="st-meta-title">Этап обучения</div>
            <div class="st-meta-desc">${learningStage.stage}</div>
            <div class="st-meta-lbl" style="margin-top:2px; opacity:0.7">${learningStage.desc}</div>
         </div>
         <div class="st-meta-index">
            <div class="st-meta-val">${understandingIndex}%</div>
            <div class="st-meta-lbl">Индекс понимания</div>
         </div>
      </div>

      <div class="st-prog-stack">
         <div class="st-card">
            <div class="st-card-label">Изучено карточек</div>
            <div class="st-card-val">${studiedCards} <span style="font-size:14px;color:var(--st-muted)">/ ${totalCards}</span></div>
            <div class="st-card-sub">Осталось ${remainingCards}</div>
         </div>
         <div class="st-card">
            <div class="st-card-label">План на сегодня</div>
            <div class="st-card-val">${sessionCount} <span style="font-size:14px;color:var(--st-muted)">карточек</span></div>
            <div class="st-card-sub">~${planMins} минут</div>
         </div>
         <div class="st-card">
            <div class="st-card-label">Прогноз финиша</div>
            <div class="st-card-val">${finishDateStr}</div>
            <div class="st-card-sub">при текущем темпе</div>
         </div>
      </div>

      <div class="st-activity-section">
         <div class="st-collapsible-header">
            <div class="st-col-title">Активность</div>
         </div>
         <div class="st-xp-tabs">
            <div class="st-xp-tab ${currentXpMode==='week'?'active':''}" onclick="window.changeXpMode('week')">Неделя</div>
            <div class="st-xp-tab ${currentXpMode==='month'?'active':''}" onclick="window.changeXpMode('month')">Месяц</div>
            <div class="st-xp-tab ${currentXpMode==='all'?'active':''}" onclick="window.changeXpMode('all')">Всё время</div>
         </div>
         <div class="st-xp-chart-container">
            <div class="st-xp-chart">
               ${renderXpChart(xpSeries)}
            </div>
         </div>
         
         <div class="st-col-title" style="font-size:14px; margin-top:24px;">Ежедневные улучшения</div>
         <div class="st-imp-chart">
            <div class="st-imp-axis"></div>
            ${renderImpChart(improvements)}
         </div>
      </div>

      <div class="st-diff-section">
         <div class="st-collapsible-header" style="cursor:default">
            <div class="st-col-title">
               Сложность карточек
               <button class="st-info-btn" onclick="window.openDiffInfoModal(event)" title="Справка">?</button>
            </div>
         </div>
         
         <div class="st-diff-list" style="margin-top:0">
            ${segs.map((s, i) => `
              <div class="st-diff-item" onclick="window.openDiffModal('${i}')">
                 <div style="display:flex;align-items:center">
                   <div class="st-diff-dot" style="background:${s.color}"></div>
                   <div class="st-diff-name">${s.label}</div>
                 </div>
                 <div class="st-diff-count">${s.count}</div>
              </div>
            `).join('')}
            
            <div class="st-diff-item" onclick="window.openDiffModal('favorites')">
               <div style="display:flex;align-items:center">
                 <div class="st-diff-dot" style="background:#ffd700"></div>
                 <div class="st-diff-name">Избранное</div>
               </div>
               <div class="st-diff-count">${favCount}</div>
            </div>
         </div>
      </div>

      ${riskZones.length > 0 ? `
      <div class="st-risk-section">
         <div class="st-col-title" style="margin-bottom:12px">Зоны риска</div>
         <div class="st-risk-list">
            ${riskZones.map(z => `
               <div class="st-risk-item">
                  <div class="st-risk-info">
                     <div class="st-risk-name">${z.cat}</div>
                     <div class="st-risk-sub">${Math.round(z.risk*100)}% проблемных</div>
                  </div>
                  <button class="st-risk-btn" onclick="window.startRiskSession('${z.cat}')">Train</button>
               </div>
            `).join('')}
         </div>
      </div>
      ` : ''}

      <div class="st-cat-section">
         <div class="st-collapsible-header">
            <div class="st-col-title">Режимы тренировки</div>
         </div>
         <div class="st-mode-grid">
            <div class="st-mode-card" onclick="window.startMode('time_attack')">
               <span class="st-mode-tag">Hardcore</span>
               <span class="st-mode-icon">⏱️</span>
               <span class="st-mode-title">Тайм-атака</span>
               <span class="st-mode-desc">5 секунд на ответ. Ошибки недопустимы.</span>
            </div>
            <div class="st-mode-card" onclick="window.startMode('sudden_death')">
               <span class="st-mode-tag">Expert</span>
               <span class="st-mode-icon">☠️</span>
               <span class="st-mode-title">Внезапная смерть</span>
               <span class="st-mode-desc">Игра до первой ошибки.</span>
            </div>
            <div class="st-mode-card" onclick="window.startMode('cram_hard')">
               <span class="st-mode-icon">🧠</span>
               <span class="st-mode-title">Зубрежка сложных</span>
               <span class="st-mode-desc">Только карты с низким коэффициентом.</span>
            </div>
            <div class="st-mode-card" onclick="window.startMode('new_cards')">
               <span class="st-mode-icon">🌱</span>
               <span class="st-mode-title">Только новые</span>
               <span class="st-mode-desc">Изучение свежего материала.</span>
            </div>
         </div>
      </div>

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
               <div class="st-ach-title">Неделя в огне</div>
               <div class="st-ach-desc">7 дней подряд</div>
            </div>
            <div class="st-ach-card ${achievements.marathoner ? 'unlocked' : ''}">
               <div class="st-ach-icon">🏃</div>
               <div class="st-ach-title">Марафонец</div>
               <div class="st-ach-desc">30 дней подряд</div>
            </div>
            <div class="st-ach-card ${achievements.ninetyAccuracy ? 'unlocked' : ''}">
               <div class="st-ach-icon">🎯</div>
               <div class="st-ach-title">Снайпер</div>
               <div class="st-ach-desc">Точность 90%+</div>
            </div>
            <div class="st-ach-card ${achievements.century ? 'unlocked' : ''}">
               <div class="st-ach-icon">💯</div>
               <div class="st-ach-title">Центурион</div>
               <div class="st-ach-desc">100 карточек</div>
            </div>
            <div class="st-ach-card ${achievements.master ? 'unlocked' : ''}">
               <div class="st-ach-icon">👑</div>
               <div class="st-ach-title">Мастер</div>
               <div class="st-ach-desc">Уровень 10</div>
            </div>
            <div class="st-ach-card ${achievements.hardToEasy ? 'unlocked' : ''}">
               <div class="st-ach-icon">📈</div>
               <div class="st-ach-title">Прогресс</div>
               <div class="st-ach-desc">10 сложных → легкие</div>
            </div>
            <div class="st-ach-card ${achievements.consistency ? 'unlocked' : ''}">
               <div class="st-ach-icon">🧘</div>
               <div class="st-ach-title">Стабильность</div>
               <div class="st-ach-desc">14 дней подряд</div>
            </div>
            <div class="st-ach-card ${achievements.comeback ? 'unlocked' : ''}">
               <div class="st-ach-icon">🦅</div>
               <div class="st-ach-title">Возвращение</div>
               <div class="st-ach-desc">После перерыва</div>
            </div>
            <div class="st-ach-card ${achievements.earlyBird ? 'unlocked' : ''}">
               <div class="st-ach-icon">🌅</div>
               <div class="st-ach-title">Жаворонок</div>
               <div class="st-ach-desc">Занятие до 9 утра</div>
            </div>
            <div class="st-ach-card ${achievements.nightOwl ? 'unlocked' : ''}">
               <div class="st-ach-icon">🦉</div>
               <div class="st-ach-title">Сова</div>
               <div class="st-ach-desc">Занятие после 23:00</div>
            </div>
         </div>
      </div>
    </div>
  `;

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
             if (confirm(`Выйти из аккаунта ${user.email}?`)) {
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
}

function renderXpChart(data) {
  if (!data || data.length === 0) return '';
  const maxVal = Math.max(...data.map(d => d.val), 10); // Min scale 10
  return data.map(d => {
    const h = (d.val / maxVal) * 100;
    return `
      <div class="st-xp-col" title="${d.date}: ${d.val} XP">
         <div class="st-xp-bar ${d.isToday ? 'today' : ''}" style="height: ${Math.max(h, 2)}%"></div>
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
     <div class="st-modal">
        <div class="st-modal-header">
           <div class="st-modal-title">Сложность карточек</div>
           <button class="st-modal-close" onclick="this.closest('.st-modal-overlay').remove()">×</button>
        </div>
        <div class="st-modal-body" style="padding:16px">
           <p style="margin-bottom:12px;color:var(--st-text-sec)">Количество сердечек показывает, насколько хорошо вы помните карточку (Ease Factor):</p>
           
           <div style="margin-bottom:16px">
              <div style="color:#fff;font-weight:600;margin-bottom:4px">❤️ 🤍 🤍 🤍 🤍 Очень трудные (1 ❤️)</div>
              <div style="font-size:13px;color:var(--st-text-sec)">Вы часто ошибаетесь. Карточки повторяются часто.</div>
           </div>
           
           <div style="margin-bottom:16px">
              <div style="color:#fff;font-weight:600;margin-bottom:4px">❤️ ❤️ 🤍 🤍 🤍 Трудные (2 ❤️)</div>
              <div style="font-size:13px;color:var(--st-text-sec)">Требуют усилий. Интервалы растут медленно.</div>
           </div>
           
           <div style="margin-bottom:16px">
              <div style="color:#fff;font-weight:600;margin-bottom:4px">❤️ ❤️ ❤️ 🤍 🤍 Стандарт (3 ❤️)</div>
              <div style="font-size:13px;color:var(--st-text-sec)">Обычный режим. Новые карточки начинаются здесь.</div>
           </div>
           
           <div>
              <div style="color:#fff;font-weight:600;margin-bottom:4px">❤️ ❤️ ❤️ ❤️ ❤️ Легкие (4-5 ❤️)</div>
              <div style="font-size:13px;color:var(--st-text-sec)">Вы помните их отлично. Интервалы растут быстро.</div>
           </div>
        </div>
     </div>
   `;
   document.body.appendChild(overlay);
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
  
  if (index === 'favorites') {
     list = uniqueQaData.filter(q => favorites.has(q.question));
     label = 'Избранное';
  } else {
     const i = parseInt(index);
     const ranges = [
        { min: 0, max: 1.7, label: 'Очень трудные' },
        { min: 1.7, max: 2.1, label: 'Трудные' },
        { min: 2.1, max: 2.4, label: 'Стандарт' },
        { min: 2.4, max: 999, label: 'Легкие' }
     ];
     const r = ranges[i];
     label = r.label;
     list = uniqueQaData.filter(q => {
        const p = prog[q.question] || prog[q.question.trim()];
        if (!p || p.easeFactor === undefined) return false;
        return p.easeFactor >= r.min && p.easeFactor < r.max;
     });
  }
  
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
             ${list.slice(0, 50).map(q => {
                const p = prog[q.question] || prog[q.question.trim()];
                const ef = p ? p.easeFactor : undefined;
                const hearts = getHeartsForEf(ef);
                const isFav = favorites.has(q.question);
                
                return `
                <li class="st-modal-item">
                   <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px">
                       <span class="st-modal-q" style="flex:1; padding-right:8px; font-weight:600; color:#fff">${q.question}</span>
                       <div style="display:flex; gap:6px; align-items:center; flex-shrink:0; font-size:12px">
                          <span title="EF: ${ef ? ef.toFixed(2) : 'N/A'}">${hearts}</span>
                          ${isFav ? '<span style="color:#ffd700; font-size:14px">★</span>' : ''}
                       </div>
                   </div>
                   <div class="st-modal-a" style="font-size:13px; color:var(--st-text-sec)">${q.answer.substring(0, 80)}${q.answer.length > 80 ? '...' : ''}</div>
                </li>
                `;
             }).join('')}
             ${list.length > 50 ? `<li class="st-modal-item" style="text-align:center;color:var(--st-muted)">...и еще ${list.length - 50}</li>` : ''}
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
  
  let cards = [];
  if (index === 'favorites') {
      const favorites = new Set(JSON.parse(localStorage.getItem('qaFavorites') || '[]'));
      cards = uniqueQaData.filter(q => favorites.has(q.question));
  } else {
      const i = parseInt(index);
      const ranges = [
         { min: 0, max: 1.7 },
         { min: 1.7, max: 2.1 },
         { min: 2.1, max: 2.4 },
         { min: 2.4, max: 999 }
      ];
      const r = ranges[i];
      const prog = getProgressMap();
      
      cards = uniqueQaData.filter(q => {
         const p = prog[q.question] || prog[q.question.trim()];
         if (!p || p.easeFactor === undefined) return false;
         return p.easeFactor >= r.min && p.easeFactor < r.max;
      });
  }
  
  if (cards.length === 0) {
      alert('Нет карт в этой категории');
      return;
  }

  hideStatsPage();
  startLearnSession(cards, { mode: 'cram' });
};

window.startRiskSession = (catName) => {
   const riskZones = getRiskZones(uniqueQaData);
   const zone = riskZones.find(z => z.cat === catName);
   if (!zone || !zone.items || zone.items.length === 0) return;
   
   hideStatsPage();
   startLearnSession(zone.items, { mode: 'cram' });
};

window.startMode = (modeId) => {
    console.log('[Stats] Starting mode:', modeId);
    
    if (!uniqueQaData || uniqueQaData.length === 0) {
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

function getXpSeries(mode) {
  const data = getDailyPointsAll(); // returns array of {date, xp, ...}
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  if (mode === 'all') {
      return data.map(entry => ({
          date: new Date(entry.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
          val: entry.xp,
          isToday: entry.date === todayStr
      }));
  }

  const days = mode === 'week' ? 7 : (mode === 'month' ? 30 : 365);
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
