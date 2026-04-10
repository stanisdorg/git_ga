import { getMetrics, calculateActivity, getCategoryProgress, checkAchievements, getCurrentLevel, getDailyPoints, getDailyPointsAll, getDailyStreakSeries, getHeartsDistribution, getLearningStage, getUnderstandingIndex, getRiskZones, getDailyImprovements, getProgressMap, getStudyStats, getStudyStreak, getAverageCardTime, getMSKDate, getTotalHearts, getDailyHearts } from './stats-utils.js?v=6.67.0';
import { syncFavorite } from './storage.js?v=6.61.0';
import { getDifficultyLevel, getLevelProgress } from './algorithm.js?v=6.68.0';
import { getTodaysSession, getTodaysSessionBreakdown, get4DayForecast } from './category-scheduler.js?v=6.68.0';
import { startLearnSession } from './learn-ui.js?v=6.68.0';
import { getMarathonProgress, clearMarathonProgress, hasActiveMarathon } from './marathon-progress.js?v=1.0.0';
import { applyFormatting } from './text-formatter.js';

// Функция для получения актуальных данных (всегда из localStorage для авторизованных)
function getCurrentCards() {
  try {
    const sessionUserRaw = localStorage.getItem('qaSessionUser');
    if (sessionUserRaw) {
      const userCardsRaw = localStorage.getItem('qaUserCards');
      if (userCardsRaw) {
        const userCards = JSON.parse(userCardsRaw);
        if (Array.isArray(userCards) && userCards.length > 0) {
          /* DEBUG
          console.log('[getCurrentCards] Используем qaUserCards:', userCards.length, 'карточек');
          */

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
    /* DEBUG
    console.log('[getCurrentCards] Используем window.uniqueQaData:', window.uniqueQaData.length, 'карточек');
    */
    return window.uniqueQaData;
  }

  /* DEBUG
  console.log('[getCurrentCards] Нет данных');
  */
  return [];
}

let statsContainer = null;
let mainContainer = null;
let currentXpMode = 'week';
let isDiffExpanded = false;
let areCatsExpanded = false;

// SKELETON LOADER STYLES
const SKELETON_STYLES = `
.st-skeleton-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--st-bg);
  z-index: 2001; /* Выше чем stats-container (2000) */
  overflow-y: auto;
}
.st-skeleton-wrapper {
  max-width: 600px;
  margin: 0 auto;
  padding: 0 16px 40px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
@keyframes skeleton-shimmer {
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
}
.st-sk-block {
  background: linear-gradient(90deg, #2a2a2a 0%, #3a3a3a 50%, #2a2a2a 100%);
  background-size: 200px 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  border-radius: 8px;
  opacity: 0.7;
}
/* Header skeleton */
.st-sk-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
}
.st-sk-header-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  flex-shrink: 0;
}
.st-sk-header-metrics {
  flex: 1;
  display: flex;
  gap: 8px;
  overflow: hidden;
}
.st-sk-header-metric {
  height: 20px;
  flex: 1;
  max-width: 60px;
  border-radius: 4px;
}
.st-sk-header-progress {
  width: 100px;
  height: 20px;
  border-radius: 8px;
  flex-shrink: 0;
}
/* CTA button skeleton */
.st-sk-cta {
  width: 100%;
  height: 44px;
  border-radius: 12px;
}
/* Modes grid skeleton */
.st-sk-modes {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.st-sk-mode-card {
  height: 72px;
  border-radius: 8px;
}
/* Difficulty section skeleton */
.st-sk-diff {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.st-sk-diff-row {
  display: flex;
  gap: 6px;
}
.st-sk-diff-item {
  flex: 1;
  height: 36px;
  border-radius: 8px;
}
.st-sk-diff-labels {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}
.st-sk-diff-label {
  flex: 1;
  height: 12px;
  border-radius: 3px;
}
.st-sk-fav {
  height: 36px;
  border-radius: 8px;
  margin-top: 6px;
}
/* Categories skeleton */
.st-sk-cats {
  height: 120px;
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.st-sk-cat-header {
  height: 20px;
  width: 40%;
  border-radius: 4px;
}
.st-sk-cat-item {
  height: 32px;
  border-radius: 8px;
}
.st-sk-cat-item-inner {
  height: 16px;
  width: 60%;
  border-radius: 4px;
  margin-bottom: 4px;
}
.st-sk-cat-bar {
  height: 4px;
  width: 100%;
  border-radius: 2px;
}
/* Activity chart skeleton */
.st-sk-activity {
  height: 280px;
  border-radius: 16px;
  padding: 16px;
}
/* Achievements skeleton */
.st-sk-ach {
  height: 140px;
  border-radius: 16px;
  padding: 16px;
}

@media (max-width: 768px) {
  .st-skeleton-wrapper {
    gap: 12px !important;
    padding: 0 12px 40px;
  }
  .st-sk-header {
    padding: 8px 0;
  }
  .st-sk-cta {
    height: 40px;
  }
  .st-sk-mode-card {
    height: 64px;
  }
  .st-sk-diff-item {
    height: 32px;
  }
  .st-sk-cats {
    height: 100px;
  }
}

@media (max-width: 320px) {
  .st-skeleton-wrapper {
    padding: 0 8px 40px;
  }
  .st-sk-header-btn {
    width: 28px;
    height: 28px;
  }
  .st-sk-cta {
    height: 36px;
  }
  .st-sk-mode-card {
    height: 56px;
  }
  .st-sk-diff-item {
    height: 28px;
  }
}
`;

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
.st-settings-btn { transition: all 0.2s; }
.st-settings-btn:hover { background: rgba(255,255,255,0.15) !important; }
.st-settings-btn:hover svg { color: rgba(255,255,255,0.9) !important; transform: rotate(90deg); }
.st-settings-btn svg { transition: all 0.3s; }
.activity-card {
  background: var(--st-surf);
  border: 1px solid var(--st-border);
  border-radius: 16px;
  padding: 8px 0 4px;
  grid-column: span 8;
  height: 320px;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}
.activity-card:hover {
  transform: scale(1.025);
  z-index: 10;
}
.activity-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 16px;
  margin-bottom: 8px;
  padding-right: 40px; /* Место для кнопки развёртывания */
}
.period-switch { display: flex; gap: 6px; font-size: 12px; color: var(--st-muted); margin-left: 20px; }
.period-switch > div {
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  border: 1px solid transparent;
}
.period-switch > div:hover {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.15);
}
.period-switch .active {
  color: #fff;
  font-weight: 600;
  background: rgba(255,255,255,0.12);
  border-color: rgba(255,255,255,0.2);
}
.month-switch { font-size: 11px; color: rgba(255,255,255,0.35); font-weight: 400; letter-spacing: 0.02em; margin-left: auto; margin-right: 10px; }
.chart-wrapper { display: block; height: 270px; position: relative; }
.chart { width: 100%; height: 100%; overflow: visible; }
.chart-label { font-size: 11px; opacity: 0.45; fill: var(--st-text); }
.bar-xp { display: none; }
.bar-hearts { opacity: 1; }
.bar-cards { opacity: 0.9; stroke: none; }
.chart-grid-line { stroke: rgba(255,255,255,0.06); stroke-width: 1; }
.tooltip { position: absolute; width: 160px; padding: 8px 10px; font-size: 12px; border-radius: 8px; background: rgba(37, 37, 43, 0.05); color: var(--st-text); border: 1px solid rgba(255,255,255,0.05); display: none; pointer-events: none; z-index: 3000; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
.tooltip .tip-arrow { position: absolute; top: -6px; left: calc(50% - 6px); width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 6px solid var(--st-surf-h); }

/* Кнопка развёртывания графика */
.st-expand-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(255,255,255,0.1);
  border: 1px solid var(--st-border);
  color: var(--st-text-sec);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  opacity: 0;
  transform: translateY(-10px);
}
.activity-card:hover .st-expand-btn {
  opacity: 1;
  transform: translateY(0);
}
.st-expand-btn:hover {
  background: var(--st-prim);
  color: #000;
  border-color: var(--st-prim);
}

/* Активные кнопки в модальном окне */
.week-btn.active, .month-btn.active, .year-btn.active {
  color: #fff;
  font-weight: 600;
  cursor: pointer;
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

/* Category Progress Cards */
.st-cat-progress-wrap {
  background: var(--st-surf);
  border: 1px solid var(--st-border);
  border-radius: 16px;
  padding: 20px;
  overflow: hidden;
  display: flex !important;
  flex-direction: column !important;
}
.st-cat-progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.st-cat-progress-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--st-text);
}
.st-cat-toggle-btn {
  background: transparent;
  border: none;
  color: var(--st-text-sec);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.st-cat-toggle-btn:hover {
  background: var(--st-surf-h);
  color: var(--st-prim);
}
.st-cat-toggle-icon {
  width: 20px;
  height: 20px;
  transition: transform 0.3s;
}
.st-cat-toggle-icon.collapsed {
  transform: rotate(-90deg);
}
.st-cat-progress-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  flex: 1;
  padding-right: 4px;
  transition: max-height 0.3s ease;
  position: relative;
}
.st-cat-progress-list.collapsed {
  max-height: 120px; /* Показываем ~1-2 категории */
  overflow: hidden;
}
.st-cat-progress-list.collapsed::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: linear-gradient(to bottom, rgba(22,27,34,0), var(--st-surf));
  pointer-events: none;
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
  gap: 4px; /* Уменьшено с 6px */
  padding: 4px 12px !important; /* Уменьшено с 2px 12px 5px */
  background: linear-gradient(135deg, rgba(15,52,96,0.6) 0%, rgba(15,52,96,0.4) 100%);
  border-radius: 8px;
  border: 1px solid rgba(26,58,92,0.5);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}
.st-cat-progress-item:hover {
  background: linear-gradient(135deg, rgba(255,159,28,0.15) 0%, rgba(15,52,96,0.6) 100%);
  border-color: var(--st-prim);
  transform: translateX(4px);
  box-shadow: 0 4px 12px rgba(255,159,28,0.2), inset 0 1px 0 rgba(255,255,255,0.1);
}
.st-cat-progress-item:active {
  transform: translateX(2px) scale(0.98);
}
.st-cat-progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px; /* Уменьшено с 4px */
}
.st-cat-progress-name {
  font-size: 11px;
  color: #aaa;
  font-weight: 500;
}
.st-cat-progress-value {
  font-size: 11px; /* Уменьшено с 12px */
  color: #fff;
  font-weight: 700;
}
.st-cat-progress-track {
  height: 4px; /* Уменьшено с 6px */
  background: #1a1a2e;
  border-radius: 2px;
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
  /* Скрываем кнопку развёртывания графика на мобильных */
  .st-expand-btn {
    display: none !important;
  }
  /* Compact header on mobile */
  .st-top {
    padding: 8px 0 !important; /* Уменьшено с 12px до 8px */
  }
  .st-top-right {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    gap: 6px !important; /* Уменьшено с 8px до 6px */
    overflow-x: auto !important;
    justify-content: flex-start !important;
    align-items: center !important;
  }
  .st-top-actions {
    flex-shrink: 0 !important;
    display: flex !important;
    align-items: center !important;
    gap: 6px !important; /* Уменьшено с 8px до 6px */
  }
  /* Имя пользователя — выравниваем по началу прогресс-бара */
  .st-mobile-username {
    left: 111px !important;
  }
  .st-auth-btn, .st-home-btn {
    width: 32px !important; /* Уменьшено с 36px */
    height: 32px !important; /* Уменьшено с 36px */
    padding: 0 !important;
    min-width: 32px !important;
  }
  .app-version-display {
    display: none !important;
  }
  .st-top-metrics {
    display: flex !important;
    flex-direction: row !important;
    gap: 4px !important; /* Уменьшено с 6px до 4px */
    flex-shrink: 0 !important;
  }
  .st-top-metrics .metric {
    display: flex !important;
    align-items: center !important;
    gap: 2px !important; /* Уменьшено с 4px до 2px */
    font-size: 11px !important;
    white-space: nowrap !important;
    flex-shrink: 0 !important;
  }
  /* Скрываем метрику "Общий XP" на мобильных */
  .st-top-metrics .metric:nth-child(1) {
    display: none !important;
  }
  /* Перемещаем стрик после уровня на мобильных */
  .st-top-right > .st-top-actions {
    order: 1 !important;
  }
  .st-top-right > .st-top-metrics {
    order: 2 !important;
  }
  .st-top-right > .st-level-inline {
    order: 3 !important;
  }
  .st-top-right > .st-streak-metric {
    order: 4 !important;
  }
  .st-top-right > .st-cta-btn {
    order: 5 !important;
  }
  .st-top-right > .st-settings-btn {
    order: 6 !important;
  }
  .st-top-right > .st-auth-btn {
    order: 7 !important;
  }
  .st-top-metrics .metric svg {
    width: 14px !important;
    height: 14px !important;
    flex-shrink: 0 !important;
  }
  /* Скрываем имя пользователя на мобильных */
  .st-username-display {
    display: none !important;
  }
  .st-level-inline {
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    flex: 1 !important; /* Занимает доступное пространство */
    min-width: 0 !important; /* Позволяет сжиматься */
    margin-left: 0 !important;
  }
  .level-inline {
    display: flex;
    align-items: center;
    gap: 6px; /* Уменьшено с 8px до 6px */
    padding: 4px 6px; /* Уменьшено с 4px 8px */
    border-radius: 8px;
    transition: all 0.2s ease;
    flex: 1; /* Занимает всё доступное пространство */
    min-width: 0; /* Позволяет сжиматься */
  }
  .level-inline:hover {
    background: rgba(255,159,28,0.15);
    box-shadow: 0 0 12px rgba(255,159,28,0.4);
    transform: translateX(2px);
  }
  .lv-label {
    font-weight: 700;
    color: var(--st-prim);
    font-size: 9px; /* Уменьшено с 13px в 1.5 раза */
    white-space: nowrap;
  }
  .level-inline-bar {
    position: relative;
    flex: 1; /* Занимает всё свободное пространство */
    height: 20px;
    background: rgba(0,0,0,0.3);
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid var(--st-border);
    transition: all 0.2s ease;
  }
  .level-inline:hover .level-inline-bar {
    border-color: var(--st-prim);
    box-shadow: 0 0 8px rgba(255,159,28,0.3);
  }
  .level-inline-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--st-prim) 0%, #FFB142 100%);
    border-radius: 10px;
    transition: width 0.5s ease;
    min-width: 2px;
  }
  .level-inline-text {
    position: absolute;
    top: 50%;
    left: 8px; /* Отступ от левого края бара */
    transform: translateY(-50%);
    font-size: 11px;
    font-weight: 400; /* Уменьшено с 700 в 1.5 раза */
    color: #fff;
    text-shadow: 0 1px 3px rgba(0,0,0,0.8);
    white-space: nowrap;
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

/* Большие карточки режимов */
.st-mode-card-large {
  padding: 20px;
  border-radius: 16px;
  border: 2px solid var(--st-border);
  background: linear-gradient(135deg, var(--st-surf) 0%, var(--st-surf-h) 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.st-mode-card-large:hover {
  border-color: var(--st-prim);
  background: linear-gradient(135deg, var(--st-surf-h) 0%, rgba(255,159,28,0.1) 100%);
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 8px 24px rgba(255,159,28,0.2);
}
.st-mode-card-large .st-mode-icon { 
  font-size: 48px; 
  margin-bottom: 12px; 
  display: block;
  filter: drop-shadow(0 2px 8px rgba(255,159,28,0.3));
}
.st-mode-card-large .st-mode-title { 
  font-weight: 700; 
  font-size: 18px; 
  margin-bottom: 8px; 
  color: #fff; 
  display: block;
  text-align: center;
}
.st-mode-card-large .st-mode-desc { 
  font-size: 13px; 
  color: var(--st-text-sec); 
  display: block; 
  line-height: 1.5;
  text-align: center;
  max-width: 90%;
}

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
  padding: 0 4px 120px; /* Нижний отступ для достижений, боковые минимальные */
  display: flex;
  flex-direction: column;
  gap: 24px; /* Увеличено с 20px до 24px для отступов между блоками */
  position: relative; /* Для абсолютного позиционирования имени пользователя */
}

/* Дополнительные отступы для мобильных между конкретными блоками */
@media (max-width: 768px) {
  .st-wrapper {
    gap: 5px !important; /* Уменьшено с 24px до 5px для компактности */
    padding-bottom: 120px !important;
  }
  /* На мобильных список категорий свёрнут по умолчанию */
  .st-cat-progress-list.collapsed {
    max-height: 120px !important;
    overflow: hidden !important;
  }
  .st-cat-progress-list.expanded {
    max-height: none !important;
    overflow: auto !important;
  }
  .st-cat-progress-wrap {
    margin-bottom: 24px; /* Отступ после блока категорий */
  }
  .activity-card {
    margin-bottom: 24px; /* Отступ после графика активности */
  }
  .st-modes-section {
    margin-bottom: 24px; /* Отступ между режимами и достижениями */
  }
  .st-ach-section {
    margin-bottom: 24px; /* Отступ после блока достижений */
  }
  .st-diff-section {
    margin-top: 24px !important; /* Отступ перед блоком сложности */
  }
  .st-block-4 {
    margin-bottom: 24px !important; /* Отступ после блока сложности (перед достижениями) */
  }
  .st-block-5 {
    margin-top: 0px; /* Достижения в самом низу */
  }
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
  margin: 5px 0 !important;
  padding: 10px 20px !important;
  width: 100%;
  max-width: none;
}

/* Mobile: стили для кнопки продолжить */
@media (max-width: 768px) {
  .st-main {
    display: flex !important;
    flex-direction: column !important;
  }
  .st-continue-mobile {
    margin-bottom: 8px !important;
  }
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
  padding: 7px 12px;
  background: linear-gradient(135deg, rgba(22,27,34,0.6) 0%, rgba(22,27,34,0.4) 100%);
  border-radius: 8px;
  border: 1px solid rgba(34,41,51,0.5);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.st-diff-item:hover {
  background: linear-gradient(135deg, rgba(255,159,28,0.15) 0%, rgba(22,27,34,0.6) 100%);
  border-color: var(--st-prim);
  transform: translateX(4px);
  box-shadow: 0 4px 12px rgba(255,159,28,0.2), inset 0 1px 0 rgba(255,255,255,0.1);
}
.st-diff-item:active {
  transform: translateX(2px) scale(0.98);
}
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
.st-ach-section {
  background: var(--st-surf);
  padding: 16px;
  border-radius: 16px;
  border: 1px solid var(--st-border);
  margin-top: 0;
}
.st-ach-scroll-wrap {
  display: flex;
  gap: 8px;
  padding-bottom: 8px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--st-prim) var(--st-surf-h);
  scroll-snap-type: x mandatory; /* Прилипание по горизонтали */
}
/* Стилизованный скроллбар */
.st-ach-scroll-wrap::-webkit-scrollbar {
  height: 8px;
}
.st-ach-scroll-wrap::-webkit-scrollbar-track {
  background: var(--st-surf-h);
  border-radius: 4px;
}
.st-ach-scroll-wrap::-webkit-scrollbar-thumb {
  background: linear-gradient(90deg, var(--st-prim), #FFB142);
  border-radius: 4px;
}
.st-ach-scroll-wrap::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(90deg, #FFB142, var(--st-prim));
}
.st-ach-card {
  width: 76px;
  height: 92px;
  flex-shrink: 0;
  scroll-snap-align: start; /* Прилипание карточек */
  background: var(--st-surf);
  border: 1px solid var(--st-border);
  border-radius: 12px;
  padding: 8px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  opacity: 0.5;
  filter: grayscale(80%);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

/* Mobile: 2 rows with snap scroll */
@media (max-width: 768px) {
  .st-ach-scroll-wrap {
    display: grid;
    grid-template-columns: repeat(4, 1fr); /* 4 карточки в ряду */
    gap: 8px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    padding: 8px;
    margin: -8px; /* Компенсация padding для выравнивания */
  }
  .st-ach-card {
    scroll-snap-align: start;
    width: 100%; /* Адаптивная ширина */
  }
  /* Скроллбар для мобильных */
  .st-ach-scroll-wrap::-webkit-scrollbar {
    height: 6px;
  }
  .st-ach-scroll-wrap::-webkit-scrollbar-track {
    background: rgba(255,255,255,0.05);
    border-radius: 3px;
  }
  .st-ach-scroll-wrap::-webkit-scrollbar-thumb {
    background: var(--st-prim);
    border-radius: 3px;
  }
}
.st-ach-card:hover {
  transform: translateY(-3px) scale(1.05);
  z-index: 10;
}
.st-ach-card.unlocked {
  opacity: 1;
  filter: none;
}
/* Rarity tiers */
.st-ach-card.common.unlocked {
  border-color: #4A5568;
  box-shadow: 0 0 10px rgba(74,85,104,0.4);
}
.st-ach-card.rare.unlocked {
  border-color: #3B82F6;
  box-shadow: 0 0 12px rgba(59,130,246,0.5);
}
.st-ach-card.epic.unlocked {
  border-color: #A855F7;
  box-shadow: 0 0 15px rgba(168,85,247,0.6);
}
.st-ach-card.legendary.unlocked {
  border-color: #F59E0B;
  box-shadow: 0 0 20px rgba(245,158,11,0.7);
}
.st-ach-card.locked {
  background: rgba(22,27,34,0.5);
}
.st-ach-icon {
  font-size: 26px;
  margin-bottom: 4px;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
}
.st-ach-title {
  font-size: 9px;
  font-weight: 700;
  color: #fff;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}
.st-ach-progress-wrap {
  width: 100%;
  height: 3px;
  background: rgba(255,255,255,0.1);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 2px;
}
.st-ach-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--st-prim), #FFB142);
  border-radius: 2px;
  transition: width 0.5s ease;
}
.st-ach-card.unlocked .st-ach-progress-fill {
  background: linear-gradient(90deg, var(--st-sec), #4ADE80);
}
.st-ach-desc {
  display: none;
}
.st-info-btn {
  background: rgba(255,255,255,0.1);
  border: none;
  color: var(--st-text-sec);
  width: 24px; height: 24px; border-radius: 50%;
  font-size: 14px; line-height: 24px; text-align: center;
  margin-left: 10px; cursor: pointer; display: inline-flex;
  align-items: center; justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}
.st-info-btn:hover { background: var(--st-sec); color: #fff; transform: scale(1.1); }

/* Modal - Glassmorphism */
.st-modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 2200;
  display: flex; justify-content: center; align-items: center;
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}
.st-modal {
  width: 90%; max-width: 500px;
  max-height: 80vh;
  display: flex; flex-direction: column;
  background: linear-gradient(135deg,
    rgba(255,255,255,0.12) 0%,
    rgba(255,255,255,0.06) 50%,
    rgba(255,255,255,0.03) 100%);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-top: 1px solid rgba(255, 255, 255, 0.25);
  border-left: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255,255,255,0.15),
    inset 0 -1px 0 rgba(0,0,0,0.1);
  overflow: hidden;
  position: relative;
}
/* Блик сверху */
.st-modal::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg,
    transparent,
    rgba(255,255,255,0.4),
    transparent);
  pointer-events: none;
  z-index: 1;
}
.st-modal-header {
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex; justify-content: space-between; align-items: center;
}
.st-modal-title { font-size: 16px; font-weight: 700; color: #fff; }
.st-modal-close {
  width: 28px; height: 28px;
  border-radius: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition: background 0.2s, color 0.2s;
}
.st-modal-close:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}
.st-modal-body {
  padding: 0;
  overflow-y: auto;
  flex: 1;
}
.st-modal-body::-webkit-scrollbar {
  width: 6px;
}
.st-modal-body::-webkit-scrollbar-track {
  background: rgba(255,255,255,0.05);
  border-radius: 3px;
}
.st-modal-body::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.2);
  border-radius: 3px;
}
.st-modal-body::-webkit-scrollbar-thumb:hover {
  background: rgba(255,255,255,0.4);
}
.st-modal-body {
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.2) rgba(255,255,255,0.05);
}
.st-modal-list { list-style: none; padding: 0; margin: 0; }
.st-modal-item {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  font-size: 14px;
  color: #E6EDF3;
  display: block;
  transition: background 0.15s;
}
.st-modal-item:hover {
  background: rgba(255,255,255,0.04);
}
.st-modal-q { font-weight: 600; color: #fff; margin-bottom: 4px; display: block; }
.st-modal-a { color: rgba(255,255,255,0.55); font-size: 13px; display: block; margin-top: 4px; }
.st-modal-footer {
  padding: 16px;
  border-top: 1px solid rgba(255,255,255,0.08);
  display: flex; justify-content: center;
}
.st-modal-btn {
  background: linear-gradient(135deg, var(--st-prim) 0%, #FF8A00 100%);
  color: #000;
  font-weight: 700;
  padding: 14px 24px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  width: 100%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-size: 13px;
}
.st-modal-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(255,159,28,0.4), inset 0 1px 0 rgba(255,255,255,0.2);
  background: linear-gradient(135deg, #FFB142 0%, var(--st-prim) 100%);
}
.st-modal-btn:active {
  transform: translateY(0) scale(0.98);
  box-shadow: 0 4px 12px rgba(255,159,28,0.3);
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
  #stats-container { overflow-y: auto; }
  .st-wrapper {
    max-width: 1400px;
    min-height: 100vh;
    padding: 0 0 80px; /* Отступ только снизу */
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
  .st-top { grid-area: top; height: var(--header-fixed-height); display: grid; grid-template-columns: repeat(12, 1fr); column-gap: 24px; align-items: flex-start; padding-top: 4px; position:relative; }
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
  
  /* Compact Card - Краткая статистика */
  .st-compact-card {
    width: 100%;
    height: 100%;
    min-height: 200px;
    background: linear-gradient(135deg, var(--st-surf) 0%, var(--st-surf-h) 100%) !important;
    border: 1px solid var(--st-border);
    border-radius: 16px;
    padding: 10px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: none !important;
  }

  .stc-header-with-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }
  
  .stc-block-title {
    font-size: 15px;
    font-weight: 700;
    color: #fff;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  .stc-content {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 1;
  }

  .stc-left {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .stc-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }
  
  .stc-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    color: var(--st-prim);
  }
  
  .stc-icon svg {
    width: 100%;
    height: 100%;
  }
  
  .stc-label {
    color: var(--st-text-sec);
    font-size: 13px;
    white-space: nowrap;
  }
  
  .stc-label.index-label {
    font-size: 13px;
  }
  
  .stc-label.stc-today {
    font-size: 13px;
    color: var(--st-text-sec);
  }
  
  .stc-value {
    font-weight: 600;
    color: var(--st-text);
    font-size: 14px;
  }
  
  .stc-value.stc-strong {
    font-weight: 700;
    font-size: 16px;
  }
  
  .stc-value.stc-orange {
    color: var(--st-prim);
  }
  
  .stc-value.stc-red {
    color: var(--st-danger);
  }
  
  .stc-value.index-value {
    font-size: 18px;
  }

  .stc-today-line {
    white-space: nowrap;
  }
  
  .stc-today-line .muted {
    color: var(--st-text-sec);
    font-weight: 400;
  }
  
  .stc-today-line .approx {
    color: var(--st-sec);
    font-weight: 600;
  }

  .stc-forecast-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }

  .stc-forecast-row .stc-icon {
    width: 20px;
    height: 20px;
    color: var(--st-sec);
    flex-shrink: 0;
  }

  .stc-forecast-text {
    color: var(--st-text-sec);
    font-size: 13px;
  }

  .stc-forecast-text .date {
    color: var(--st-text);
    font-weight: 600;
    font-size: 14px;
  }
  
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
    background: transparent !important;
    box-shadow: none !important;
    position: relative;
    z-index: 1;
  }
  .st-block-1.expanded {
    z-index: 100 !important;
    position: relative !important;
    display: flex !important;
    align-items: flex-start !important;
    height: 180px !important;
    min-height: 180px !important;
  }
  .st-block-1.expanded .st-compact-card {
    overflow: visible !important;
    position: relative !important;
    opacity: 0.9 !important;
    transition: opacity 0.2s ease !important;
  }
  .st-block-1:not(.expanded) .st-compact-card {
    opacity: 1 !important;
    transition: opacity 0.2s ease !important;
  }
  /* История поверх других блоков с полупрозрачной подложкой */
  .st-block-1.expanded #st-history-timeline {
    position: absolute !important;
    top: 100% !important;
    left: 0 !important;
    right: 0 !important;
    z-index: 999 !important;
    background: linear-gradient(135deg, rgba(22, 27, 34, 0.95) 0%, rgba(31, 38, 48, 0.95) 100%) !important;
    backdrop-filter: blur(8px) !important;
    -webkit-backdrop-filter: blur(8px) !important;
    border: 1px solid var(--st-border) !important;
    border-radius: 12px !important;
    margin-top: 8px !important;
    padding: 10px 10px 14px 10px !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;
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
    position: relative;
    z-index: 0;
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

  /* Фиксированная высота блоков (кроме expanded состояния) */
  .st-block-1:not(.expanded),
  .st-block-2 {
    height: 180px !important;
    min-height: 180px !important;
    display: flex !important;
    flex-direction: column !important;
    background: transparent !important;
    box-shadow: none !important;
  }

  .st-compact-card {
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: space-between !important;
  }

  /* Мобильная версия блока прогресса - компактная с центрированием */
  /* Применяется всегда, но переопределяется для десктопа выше */
  #stats-container .st-wrapper .st-compact-card {
    padding: 8px 12px !important;
    min-height: auto !important;
    gap: 8px !important;
  }
  #stats-container .st-wrapper .stc-header-with-info {
    margin-bottom: 0 !important;
    justify-content: center !important;
  }
  #stats-container .st-wrapper .stc-block-title {
    font-size: 14px !important;
    justify-content: center !important;
    text-align: center !important;
  }
  #stats-container .st-wrapper .stc-block-title .index-value {
    font-size: 16px !important;
  }
  #stats-container .st-wrapper .stc-content {
    display: flex !important;
    flex-direction: column !important;
    gap: 6px !important;
    align-items: center !important;
    text-align: center !important;
  }
  #stats-container .st-wrapper .stc-row {
    justify-content: center !important;
    flex-wrap: wrap !important;
    gap: 4px !important;
    text-align: center !important;
  }
  #stats-container .st-wrapper .stc-label.stc-today {
    font-size: 11px !important;
    font-weight: 500 !important;
  }
  #stats-container .st-wrapper .stc-today-line {
    font-size: 12px !important;
    white-space: normal !important;
    text-align: center !important;
  }
  #stats-container .st-wrapper .stc-today-line .stc-value {
    font-size: 13px !important;
  }
  #stats-container .st-wrapper .stc-today-line .muted {
    font-size: 11px !important;
  }
  #stats-container .st-wrapper .stc-today-line .approx {
    font-size: 11px !important;
    font-weight: 600 !important;
  }
  #stats-container .st-wrapper .stc-forecast-row {
    justify-content: center !important;
    gap: 4px !important;
    font-size: 10px !important;
    text-align: center !important;
  }
  #stats-container .st-wrapper .stc-forecast-row .stc-icon {
    width: 12px !important;
    height: 12px !important;
  }
  #stats-container .st-wrapper .stc-forecast-text {
    font-size: 10px !important;
    text-align: center !important;
  }
  #stats-container .st-wrapper .stc-forecast-text .date {
    font-size: 11px !important;
    font-weight: 600 !important;
  }

  /* Desktop: переопределяем стили обратно */
  @media (min-width: 769px) {
    #stats-container .st-wrapper .st-compact-card {
      padding: 10px 20px !important;
      gap: 12px !important;
    }
    #stats-container .st-wrapper .stc-header-with-info {
      margin-bottom: 4px !important;
      justify-content: space-between !important;
    }
    #stats-container .st-wrapper .stc-block-title {
      font-size: 15px !important;
      justify-content: flex-start !important;
      text-align: left !important;
    }
    #stats-container .st-wrapper .stc-content {
      align-items: flex-start !important;
      text-align: left !important;
    }
    #stats-container .st-wrapper .stc-row {
      justify-content: flex-start !important;
      text-align: left !important;
    }
    #stats-container .st-wrapper .stc-label.stc-today {
      font-size: 13px !important;
    }
    #stats-container .st-wrapper .stc-today-line {
      font-size: 14px !important;
      white-space: nowrap !important;
      text-align: left !important;
    }
    #stats-container .st-wrapper .stc-forecast-row {
      justify-content: flex-start !important;
      font-size: 13px !important;
      text-align: left !important;
    }
    #stats-container .st-wrapper .stc-forecast-row .stc-icon {
      width: 20px !important;
      height: 20px !important;
    }
    #stats-container .st-wrapper .stc-forecast-text {
      font-size: 13px !important;
      text-align: left !important;
    }
    #stats-container .st-wrapper .stc-forecast-text .date {
      font-size: 14px !important;
    }
  }

  /* .modes-grid удалено - теперь только в @media (max-width: 768px) */

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
    overflow-y: auto !important;
  }
  /* Кастомный скроллбар для категорий */
  .st-block-achievements::-webkit-scrollbar,
  .st-cat-progress-wrap::-webkit-scrollbar {
    width: 6px;
  }
  .st-block-achievements::-webkit-scrollbar-track,
  .st-cat-progress-wrap::-webkit-scrollbar-track {
    background: rgba(0,0,0,0.3);
    border-radius: 3px;
  }
  .st-block-achievements::-webkit-scrollbar-thumb,
  .st-cat-progress-wrap::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.2);
    border-radius: 3px;
  }
  .st-block-achievements::-webkit-scrollbar-thumb:hover,
  .st-cat-progress-wrap::-webkit-scrollbar-thumb:hover {
    background: rgba(255,255,255,0.4);
  }
  .st-block-achievements,
  .st-cat-progress-wrap {
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.2) rgba(0,0,0,0.3);
  }

  /* Кастомный скроллбар для истории */
  #st-history-timeline-list::-webkit-scrollbar {
    width: 6px;
  }
  #st-history-timeline-list::-webkit-scrollbar-track {
    background: rgba(255,255,255,0.05);
    border-radius: 3px;
  }
  #st-history-timeline-list::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.2);
    border-radius: 3px;
  }
  #st-history-timeline-list::-webkit-scrollbar-thumb:hover {
    background: rgba(255,255,255,0.4);
  }
  #st-history-timeline-list {
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.2) rgba(255,255,255,0.05);
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
      position: relative;
      z-index: 1;
    }
    .st-block-1.expanded {
      z-index: 100 !important;
      position: relative !important;
      display: flex !important;
      align-items: flex-start !important;
      height: 180px !important;
      min-height: 180px !important;
    }
    .st-block-1.expanded .st-compact-card {
      overflow: visible !important;
      position: relative !important;
      opacity: 0.9 !important;
      transition: opacity 0.2s ease !important;
    }
    .st-block-1:not(.expanded) .st-compact-card {
      opacity: 1 !important;
      transition: opacity 0.2s ease !important;
    }
    /* На мобильной версия timeline раздвигает блоки (не absolute) */
    .st-block-1.expanded #st-history-timeline {
      position: relative !important;
      z-index: 10 !important;
      background: linear-gradient(135deg, rgba(22, 27, 34, 0.95) 0%, rgba(31, 38, 48, 0.95) 100%) !important;
      backdrop-filter: blur(8px) !important;
      -webkit-backdrop-filter: blur(8px) !important;
      border: 1px solid var(--st-border) !important;
      border-radius: 12px !important;
      margin-top: 8px !important;
      padding: 10px 10px 14px 10px !important;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;
    }
    .st-block-achievements {
      grid-column: 1 / span 2; 
      grid-row: 2;
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
    /* Кастомный скроллбар для истории на мобильных */
    #st-history-timeline-list::-webkit-scrollbar {
      width: 6px;
    }
    #st-history-timeline-list::-webkit-scrollbar-track {
      background: rgba(255,255,255,0.05);
      border-radius: 3px;
    }
    #st-history-timeline-list::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.2);
      border-radius: 3px;
    }
    #st-history-timeline-list::-webkit-scrollbar-thumb:hover {
      background: rgba(255,255,255,0.4);
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
      order: 3; /* Прогресс */
    }
    .st-block-achievements {
      grid-column: 1;
      grid-row: auto;
      max-height: none;
      order: 6; /* Категории */
    }
    .st-block-2 {
      grid-column: 1;
      grid-row: auto;
      display: flex !important; /* ДОБАВЛЕНО: чтобы .modes-grid мог быть grid */
      flex-direction: column !important;
      order: 4; /* Режимы (2 карточки) */
    }
    .st-block-3 {
      grid-column: 1;
      grid-row: auto;
      order: 7; /* Графики */
    }
    .st-block-4 {
      grid-column: 1;
      grid-row: auto;
      order: 5; /* Сложность + Избранное */
    }
    .st-block-5 {
      grid-column: 1;
      grid-row: auto;
      order: 8; /* Достижения */
    }
    
    /* Mobile: убираем фиксированную высоту */
    .st-compact-card,
    .training-modes-block,
    .st-diff-section {
      height: auto !important;
      min-height: auto !important;
      padding: 8px 12px !important;
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
      height: 280px;
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

  /* Mobile: компактные карточки режимов - вертикальные с жирным заголовком */
  @media (max-width: 768px) {
    .modes-grid {
      display: grid !important;
      grid-template-columns: repeat(2, 1fr) !important;
      gap: 8px !important;
      height: auto !important;
    }
    .modes-grid .st-mode-card {
      padding: 12px 8px !important;
      border-radius: 8px !important;
      border: none !important;
      background: linear-gradient(135deg, rgba(255,159,28,0.08) 0%, rgba(46,196,182,0.05) 100%) !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      text-align: center !important;
      gap: 8px !important;
      transition: all 0.2s !important;
    }
    .modes-grid .st-mode-card:hover {
      background: linear-gradient(135deg, rgba(255,159,28,0.12) 0%, rgba(46,196,182,0.08) 100%) !important;
      border: 1px solid rgba(255,159,28,0.4) !important;
    }
    .modes-grid .st-mode-card-large {
      padding: 12px 8px !important;
      border-radius: 8px !important;
    }
    .modes-grid .st-mode-card-large .st-mode-icon {
      width: 40px !important;
      height: 40px !important;
      font-size: 0 !important;
      margin: 0 !important;
      border-radius: 8px !important;
      background: linear-gradient(135deg, rgba(255,159,28,0.3) 0%, rgba(255,107,53,0.3) 100%) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      flex-shrink: 0 !important;
      filter: none !important;
    }
    .modes-grid .st-mode-card-large .st-mode-icon svg {
      width: 24px !important;
      height: 24px !important;
    }
    .modes-grid .st-mode-card-large .st-mode-title {
      font-size: 13px !important;
      font-weight: 700 !important;
      margin: 0 !important;
      text-align: center !important;
      display: block !important;
      color: #fff !important;
    }
    .modes-grid .st-mode-card-large .st-mode-desc {
      display: block !important;
      font-size: 9px !important;
      color: rgba(255,255,255,0.45) !important;
      margin: 2px 0 0 0 !important;
      text-align: center !important;
      line-height: 1.2 !important;
    }
  }

  /* ДОБАВЛЕНО: Правило вне media query для принудительного применения */
  /* Мобильные стили для режимов - Вариант 5 с градиентом */
  #stats-container .st-block-2 .modes-grid .st-mode-card-large {
    padding: 8px 10px !important;
    border-radius: 8px !important;
    border: none !important;
    background: linear-gradient(135deg, rgba(255,159,28,0.08) 0%, rgba(46,196,182,0.05) 100%) !important;
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    gap: 8px !important;
    height: auto !important;
    transition: all 0.2s !important;
  }
  #stats-container .st-block-2 .modes-grid .st-mode-card-large:hover {
    background: linear-gradient(135deg, rgba(255,159,28,0.12) 0%, rgba(46,196,182,0.08) 100%) !important;
    border: 1px solid rgba(255,159,28,0.4) !important;
  }
  #stats-container .st-block-2 .modes-grid .st-mode-card-large .st-mode-icon {
    width: 28px !important;
    height: 28px !important;
    font-size: 0 !important;
    margin: 0 !important;
    border-radius: 50% !important;
    background: linear-gradient(135deg, rgba(255,159,28,0.3) 0%, rgba(255,107,53,0.3) 100%) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex-shrink: 0 !important;
    filter: none !important;
  }
  #stats-container .st-block-2 .modes-grid .st-mode-card-large .st-mode-icon svg {
    width: 16px !important;
    height: 16px !important;
  }
  #stats-container .st-block-2 .modes-grid .st-mode-card-large .st-mode-title {
    font-size: 12px !important;
    font-weight: 600 !important;
    margin: 0 !important;
    text-align: left !important;
    flex: 1 !important;
  }
  #stats-container .st-block-2 .modes-grid .st-mode-card-large .st-mode-desc {
    display: none !important;
  }
  
  .st-block-2 .modes-grid {
    display: grid !important;
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 8px !important;
    background: transparent !important;
    height: auto !important;
  }
  
  /* ДОБАВЛЕНО: .st-block-2 должен быть flex для работы .modes-grid */
  .st-block-2 {
    display: flex !important;
    flex-direction: column !important;
  }
  
  /* ДОБАВЛЕНО: Карточки одинаковой высоты */
  .st-block-2 .modes-grid .st-mode-card-large {
    align-items: center !important;
    justify-content: center !important;
  }
  
  .st-block-2 .modes-grid {
    align-items: stretch !important;
  }

  /* Achievements: Full Width at Bottom */
  .st-ach-section { background: var(--st-surf); padding: 0; border-radius: 16px; border: 1px solid var(--st-border); margin-top: 0; }
  .st-ach-scroll-wrap { display: flex; gap: 12px; padding: 20px; overflow-x: auto; overflow-y: hidden; justify-content: space-between; scrollbar-width: thin; scrollbar-color: var(--st-prim) var(--st-surf-h); }
  .st-ach-scroll-wrap::-webkit-scrollbar { height: 8px; }
  .st-ach-scroll-wrap::-webkit-scrollbar-track { background: var(--st-surf-h); border-radius: 4px; }
  .st-ach-scroll-wrap::-webkit-scrollbar-thumb { background: linear-gradient(90deg, var(--st-prim), #FFB142); border-radius: 4px; }
  .st-ach-scroll-wrap::-webkit-scrollbar-thumb:hover { background: linear-gradient(90deg, #FFB142, var(--st-prim)); }
  .st-ach-card { width: 96px; height: 96px; flex-shrink: 0; }
  .st-ach-icon { font-size: 28px; margin-bottom: 6px; }
  .st-ach-title { font-size: 12px; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .st-ach-desc { display: none; }

  /* Force Expand Content */
  .st-diff-bar-wrap { display: none !important; }
  .st-diff-list { display: flex !important; margin-top: 0; animation: none; opacity: 1; transform: none; }
  .st-cat-list { display: flex !important; }
  .st-cat-more-btn { display: none !important; }
  .st-cat-item-hidden { display: block !important; }

  /* Compact Modal Styles */
  .card {
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--st-border);
    border-radius: 12px;
    padding: 14px;
  }
  .current-level-card {
    background: linear-gradient(135deg, rgba(255,159,28,0.2) 0%, rgba(255,159,28,0.05) 100%);
    border: 2px solid var(--st-prim);
  }
  .xp-source {
    background: rgba(255,255,255,0.05);
    padding: 10px;
    border-radius: 8px;
    text-align: center;
    border-left: 3px solid transparent;
  }
  .stat-item {
    background: rgba(255,255,255,0.05);
    padding: 10px;
    border-radius: 8px;
    text-align: center;
  }
  .levels-section {
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--st-border);
    border-radius: 12px;
    padding: 14px;
  }
  .levels-nav-btn {
    flex: 1;
    background: rgba(255,255,255,0.05);
    border: 1px solid var(--st-border);
    color: var(--st-text);
    padding: 8px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    transition: all 0.2s;
  }
  .levels-nav-btn:hover {
    background: rgba(255,255,255,0.1);
    border-color: var(--st-prim);
  }
  .start-btn {
    background: var(--st-prim);
    color: #000;
    border: none;
    padding: 12px;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }
  .start-btn:hover {
    background: #FFB142;
    transform: translateY(-2px);
  }

  /* Levels Horizontal Scroll */
  .levels-horizontal {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding: 10px 4px;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
  }
  .levels-horizontal::-webkit-scrollbar {
    height: 6px;
  }
  .levels-horizontal::-webkit-scrollbar-track {
    background: rgba(255,255,255,0.05);
    border-radius: 3px;
  }
  .levels-horizontal::-webkit-scrollbar-thumb {
    background: var(--st-prim);
    border-radius: 3px;
  }
  .level-card {
    min-width: 140px;
    max-width: 140px;
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--st-border);
    border-radius: 10px;
    padding: 15px;
    flex-shrink: 0;
    transition: all 0.2s;
  }
  .level-card:hover {
    background: rgba(255,255,255,0.05);
    border-color: var(--st-muted);
  }
  .level-card.current {
    background: linear-gradient(135deg, rgba(255,159,28,0.15) 0%, rgba(255,159,28,0.05) 100%);
    border-color: var(--st-prim);
  }
  .level-card .level-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  .level-card .level-num {
    font-size: 24px;
    font-weight: 700;
    color: var(--st-prim);
  }
  .level-card .level-icon {
    font-size: 18px;
  }
  .level-card .level-range {
    font-size: 11px;
    color: var(--st-text-sec);
    margin-bottom: 10px;
    line-height: 1.3;
  }
  .level-card .progress-label {
    font-size: 10px;
    color: var(--st-text-sec);
    margin-bottom: 4px;
  }
  .level-card .progress-bar {
    height: 6px;
    background: rgba(255,255,255,0.1);
    border-radius: 3px;
    overflow: hidden;
  }
  .level-card .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #FF9F1C, #FFB142);
    border-radius: 3px;
    transition: width 0.5s;
  }
}

/* History Timeline */
.st-history-toggle:hover {
  background: var(--st-surf-h) !important;
  color: var(--st-prim) !important;
  border-color: var(--st-prim) !important;
}
.st-hist-filter-btn:hover {
  background: var(--st-surf-h) !important;
  color: var(--st-text) !important;
}
.st-hist-filter-btn.active {
  background: var(--st-prim) !important;
  color: #000 !important;
  border-color: var(--st-prim) !important;
}
.st-hist-filter-btn[data-grade="1"].active {
  background: #E5533D !important;
  border-color: #E5533D !important;
}
.st-hist-filter-btn[data-grade="2"].active {
  background: #FF9F1C !important;
  border-color: #FF9F1C !important;
}
.st-hist-filter-btn[data-grade="3"].active {
  background: #2EC4B6 !important;
  border-color: #2EC4B6 !important;
}
.st-hist-filter-btn[data-grade="4"].active {
  background: #06D6A0 !important;
  border-color: #06D6A0 !important;
}
.st-timeline-item {
  position: relative;
  padding: 5px 0 5px 14px;
  cursor: pointer;
  transition: opacity 0.15s;
}
.st-timeline-item:hover .st-timeline-q {
  color: var(--st-prim) !important;
}
.st-timeline-dot {
  position: absolute;
  left: -15px;
  top: 9px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid;
  background: currentColor;
}
.st-timeline-dot[data-grade="1"] { border-color: #E5533D; color: #E5533D; }
.st-timeline-dot[data-grade="2"] { border-color: #FF9F1C; color: #FF9F1C; }
.st-timeline-dot[data-grade="3"] { border-color: #2EC4B6; color: #2EC4B6; }
.st-timeline-dot[data-grade="4"] { border-color: #06D6A0; color: #06D6A0; }
.st-timeline-q {
  font-size: 11px;
  font-weight: 600;
  color: var(--st-text);
  transition: color 0.15s;
}
.st-timeline-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 9px;
  color: var(--st-text-sec);
  margin-top: 2px;
}
.st-timeline-grade {
  font-size: 8px;
  padding: 1px 5px;
  border-radius: 8px;
  font-weight: 700;
  color: #000;
}
.st-timeline-grade[data-grade="1"] { background: #E5533D; }
.st-timeline-grade[data-grade="2"] { background: #FF9F1C; }
.st-timeline-grade[data-grade="3"] { background: #2EC4B6; }
.st-timeline-grade[data-grade="4"] { background: #06D6A0; }
.st-timeline-line {
  border-left: 3px solid var(--st-border);
  position: absolute;
  left: 5px;
  top: 0;
  bottom: 0;
}
.st-timeline-sep {
  font-size: 9px;
  font-weight: 700;
  color: var(--st-muted);
  padding: 6px 0 2px;
  border-top: 1px solid var(--st-border);
  margin-top: 4px;
}
/* History modal */
.st-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(4px);
  z-index: 10000;
  display: none;
  align-items: center;
  justify-content: center;
}
.st-modal-overlay.active {
  display: flex;
}
.st-modal-box {
  background: var(--st-surf);
  border: 1px solid var(--st-border);
  border-radius: 12px;
  width: 90%;
  max-width: 450px;
  max-height: 70vh;
  overflow-y: auto;
  padding: 16px;
}
.st-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--st-border);
}
.st-modal-header h3 {
  font-size: 13px;
  font-weight: 700;
}
.st-modal-close {
  background: none;
  border: none;
  color: var(--st-text-sec);
  font-size: 18px;
  cursor: pointer;
}
.st-modal-stats {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.st-modal-stat {
  font-size: 10px;
  padding: 3px 7px;
  border-radius: 6px;
  background: var(--st-surf-h);
}
.st-modal-stat .sv {
  font-weight: 700;
}
.st-modal-stat[data-g="1"] .sv { color: #E5533D; }
.st-modal-stat[data-g="2"] .sv { color: #FF9F1C; }
.st-modal-stat[data-g="3"] .sv { color: #2EC4B6; }
.st-modal-stat[data-g="4"] .sv { color: #06D6A0; }
.st-modal-entry {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 7px;
  border-radius: 6px;
  background: var(--st-surf-h);
  border-left: 3px solid;
  margin-bottom: 4px;
}
.st-modal-entry[data-grade="1"] { border-left-color: #E5533D; }
.st-modal-entry[data-grade="2"] { border-left-color: #FF9F1C; }
.st-modal-entry[data-grade="3"] { border-left-color: #2EC4B6; }
.st-modal-entry[data-grade="4"] { border-left-color: #06D6A0; }
.st-modal-entry .me-dt { font-size: 9px; color: var(--st-text-sec); min-width: 75px; }
.st-modal-entry .me-grade {
  font-size: 8px;
  padding: 1px 5px;
  border-radius: 8px;
  font-weight: 700;
  color: #000;
}
.st-modal-entry[data-grade="1"] .me-grade { background: #E5533D; }
.st-modal-entry[data-grade="2"] .me-grade { background: #FF9F1C; }
.st-modal-entry[data-grade="3"] .me-grade { background: #2EC4B6; }
.st-modal-entry[data-grade="4"] .me-grade { background: #06D6A0; }
.st-modal-entry .me-dur { font-size: 9px; color: var(--st-muted); margin-left: auto; }
`;

export function initStatsPage(appVersion) {
  // Загружаем настройки пользователя
  try {
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      window.appSettings = JSON.parse(savedSettings);
    } else {
      window.appSettings = { language: 'ru', theme: 'dark', dailyStudyTime: 60 };
    }
  } catch {
    window.appSettings = { language: 'ru', theme: 'dark', dailyStudyTime: 60 };
  }

  /* DEBUG
  console.log('========================================');
  console.log('[STATS INIT] ========== initStatsPage CALLED ==========');
  console.log('[STATS INIT] Timestamp:', new Date().toISOString());
  console.log('[STATS INIT] appVersion:', appVersion);
  console.log('[STATS INIT] Current location.hash:', location.hash);
  console.log('[STATS INIT] document.readyState:', document.readyState);
  console.log('[STATS INIT] document.body exists:', !!document.body);
  console.log('[STATS INIT] .app-wrapper exists:', !!document.querySelector('.app-wrapper'));
  */

  if (appVersion) window.currentAppVersion = appVersion;

  // ПРИНУДИТЕЛЬНО скрываем всё остальное ПЕРЕД показом скелетона
  const mainContainer = document.querySelector('.container');
  const learnContainer = document.getElementById('learn-container');
  const sidebar = document.querySelector('.sidebar');
  const topActionsBar = document.querySelector('.top-actions-bar');

  // Отключаем MutationObserver перед скрытием top-actions-bar
  if (window.__statsTopActionsObserver) {
    window.__statsTopActionsObserver.disconnect();
    window.__statsTopActionsObserver = null;
  }

  if (mainContainer) {
    mainContainer.style.display = 'none';
  }
  if (learnContainer) {
    learnContainer.style.display = 'none';
  }
  if (sidebar) {
    sidebar.style.display = 'none';
  }
  if (topActionsBar) {
    topActionsBar.style.display = 'none';
  }

  // Скелетон уже видим (display:block в HTML), не нужно показывать

  // Создаём контейнер статистики если не существует
  let statsContainerEl = document.getElementById('stats-container');
  if (!statsContainerEl) {
    statsContainerEl = document.createElement('div');
    statsContainerEl.id = 'stats-container';

    const appWrapper = document.querySelector('.app-wrapper') || document.body;
    appWrapper.appendChild(statsContainerEl);
  }

  // Всегда обновляем стили (даже если контейнер уже есть)
  let styleEl = document.querySelector('style[data-stats-style="true"]');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.setAttribute('data-stats-style', 'true');
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = SKELETON_STYLES + STATS_STYLES;

  // Показываем скелетон-лоадер
  showSkeletonLoader();

  // Показываем статистику
  statsContainerEl.style.display = 'block';
  /* DEBUG
  console.log('[STATS INIT] stats-container display set to block');
  */

  // Инициализируем глобальную переменную
  statsContainer = statsContainerEl;

  // Проверяем что контейнер действительно виден
  const computedStyle = window.getComputedStyle(statsContainerEl);
  /* DEBUG
  console.log('[STATS INIT] stats-container computed display:', computedStyle.display);
  console.log('[STATS INIT] stats-container computed zIndex:', computedStyle.zIndex);

  console.log('[STATS INIT] Calling renderStats()...');
  */
  renderStats();

  // Добавляем задержку перед скрытием скелетона (1000ms для мобильных)
  /* DEBUG
  console.log('[STATS INIT] Setting skeleton display time (1000ms)...');
  */
  setTimeout(() => {
    /* DEBUG
    console.log('[STATS INIT] Timeout elapsed, hiding skeleton...');
    */
    hideSkeletonLoader();
  }, 1000);

  /* DEBUG
  console.log('[STATS INIT] ========== END initStatsPage ==========');
  */

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
  /* DEBUG
  console.log('[hideStatsPage] Called!');
  console.log('[hideStatsPage] __navigatingToHome:', window.__navigatingToHome);
  */

  if (statsContainer) {
    statsContainer.remove();
    statsContainer = null; // Очищаем ссылку на удаленный элемент
    /* DEBUG
    console.log('[hideStatsPage] stats-container removed and reference cleared');
    */
  }

  if (!mainContainer) mainContainer = document.querySelector('.container');
  if (mainContainer) {
    mainContainer.style.display = 'block'; // Явно показываем главный контейнер
    /* DEBUG
    console.log('[hideStatsPage] mainContainer display set to block');
    */
  }

  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.style.display = ''; // Возвращаем стандартное отображение
    /* DEBUG
    console.log('[hideStatsPage] sidebar display reset');
    */
  }

  // Восстанавливаем search-container и top-actions-bar
  const searchContainer = document.querySelector('.search-container');
  if (searchContainer) {
    searchContainer.style.display = '';
    /* DEBUG
    console.log('[hideStatsPage] search-container display reset');
    */
  } else {
    console.warn('[hideStatsPage] search-container NOT FOUND!');
  }

  const topActionsBar = document.querySelector('.top-actions-bar');
  if (topActionsBar) {
    topActionsBar.style.display = 'flex';
    /* DEBUG
    console.log('[hideStatsPage] top-actions-bar display reset');
    */
  } else {
    console.warn('[hideStatsPage] top-actions-bar NOT FOUND!');
  }

  // НЕ меняем hash здесь! Это вызывается из startFilteredSession
  // if (location.hash && location.hash.includes('stats')) {
  //     location.hash = '';
  // }
  const evt = new Event('statsClosed'); window.dispatchEvent(evt);

  /* DEBUG
  console.log('[hideStatsPage] Done!');
  */
}

// Helper function to render achievement card
function renderAchCard(key, icon, title, current, target, rarity, description) {
  const isUnlocked = current >= target;
  const pct = target > 0 ? Math.round((current / target) * 100) : 0;
  const lockedClass = isUnlocked ? 'unlocked' : 'locked';
  const rarityClass = rarity || 'common';
  const desc = description || '';

  return `
    <div class="st-ach-card ${lockedClass} ${rarityClass}" onclick="window.showAchievementDesc('${title}', '${desc}', ${isUnlocked}, '${current}/${target}')" style="cursor:pointer;" title="${title}: ${current}/${target}${desc ? ' — ' + desc : ''}">
      <div class="st-ach-icon">${icon}</div>
      <div class="st-ach-title">${title}</div>
      <div class="st-ach-progress-wrap">
        <div class="st-ach-progress-fill" style="width:${pct}%"></div>
      </div>
    </div>
  `;
}

// SKELETON LOADER FUNCTIONS
function showSkeletonLoader() {
  /* DEBUG
  console.log('[Skeleton] showSkeletonLoader called');
  */

  // Показываем HTML skeleton из index.html
  const skeleton = document.getElementById('stats-skeleton');
  /* DEBUG
  console.log('[Skeleton] skeleton element:', skeleton);
  */
  if (skeleton) {
    skeleton.style.display = 'block';
    /* DEBUG
    console.log('[Skeleton] HTML skeleton shown, display:', skeleton.style.display);
    console.log('[Skeleton] skeleton zIndex:', skeleton.style.zIndex);
    */
  } else {
    console.warn('[Skeleton] HTML skeleton not found, creating JS skeleton...');
    // Fallback: создаём JS skeleton если HTML не найден
    const jsSkeleton = document.createElement('div');
    jsSkeleton.className = 'st-skeleton-overlay';
    jsSkeleton.innerHTML = `
            <div class="st-skeleton-wrapper">
                <div class="st-sk-header">
                    <div class="st-sk-block st-sk-header-btn"></div>
                    <div class="st-sk-block st-sk-header-btn"></div>
                    <div class="st-sk-header-metrics">
                        <div class="st-sk-block st-sk-header-metric"></div>
                        <div class="st-sk-block st-sk-header-metric"></div>
                        <div class="st-sk-block st-sk-header-metric"></div>
                    </div>
                    <div class="st-sk-block st-sk-header-progress"></div>
                </div>
                <div class="st-sk-block st-sk-cta"></div>
                <div class="st-sk-modes">
                    <div class="st-sk-block st-sk-mode-card"></div>
                    <div class="st-sk-block st-sk-mode-card"></div>
                </div>
                <div class="st-sk-diff">
                    <div class="st-sk-diff-row">
                        <div class="st-sk-block st-sk-diff-item"></div>
                        <div class="st-sk-block st-sk-diff-item"></div>
                        <div class="st-sk-block st-sk-diff-item"></div>
                        <div class="st-sk-block st-sk-diff-item"></div>
                    </div>
                    <div class="st-sk-diff-labels">
                        <div class="st-sk-block st-sk-diff-label"></div>
                        <div class="st-sk-block st-sk-diff-label"></div>
                        <div class="st-sk-block st-sk-diff-label"></div>
                        <div class="st-sk-block st-sk-diff-label"></div>
                    </div>
                    <div class="st-sk-block st-sk-fav"></div>
                </div>
                <div class="st-sk-block st-sk-cats">
                    <div class="st-sk-block st-sk-cat-header"></div>
                    <div class="st-sk-cat-item">
                        <div class="st-sk-block st-sk-cat-item-inner"></div>
                        <div class="st-sk-block st-sk-cat-bar"></div>
                    </div>
                    <div class="st-sk-cat-item">
                        <div class="st-sk-block st-sk-cat-item-inner"></div>
                        <div class="st-sk-block st-sk-cat-bar"></div>
                    </div>
                </div>
                <div class="st-sk-block st-sk-activity"></div>
                <div class="st-sk-block st-sk-ach"></div>
            </div>
        `;
    document.body.appendChild(jsSkeleton);
    /* DEBUG
    console.log('[Skeleton] JS skeleton created and appended');
    */
  }
}

function hideSkeletonLoader() {
  /* DEBUG
  console.log('[Skeleton] hideSkeletonLoader called');
  */

  // Скрываем скелетон через display:none
  const skeleton = document.getElementById('stats-skeleton');
  if (skeleton) {
    skeleton.style.display = 'none';
    /* DEBUG
    console.log('[Skeleton] Skeleton hidden, display:', skeleton.style.display);
    */
  }

  // Проверяем видимость stats-container
  const statsContainer = document.getElementById('stats-container');
  /* DEBUG
  console.log('[Skeleton] stats-container exists:', !!statsContainer);
  */
  if (statsContainer) {
    /* DEBUG
    console.log('[Skeleton] stats-container display:', statsContainer.style.display);
    console.log('[Skeleton] stats-container offsetHeight:', statsContainer.offsetHeight);
    */
    statsContainer.style.display = 'block';
    /* DEBUG
    console.log('[Skeleton] stats-container forced to display:block');
    */
  }

  /* DEBUG
  console.log('[Skeleton] hideSkeletonLoader completed');
  */
}

function showStats() {
  const statsContainer = document.getElementById('stats-container');
  if (statsContainer) {
    statsContainer.style.display = 'block';
  }
  renderStats();
}

function renderStats() {
  console.log('[renderStats] === НАЧАЛО РЕНДЕРА СТАТИСТИКИ ===');
  let level, metrics, achievements, progress, top5, rest;
  try { level = getCurrentLevel(); } catch { level = { level: 1, xp: 0, remaining: 100, progress: 0 }; }
  try { metrics = getMetrics(uniqueQaData); } catch { metrics = { streakCurrent: 0, studiedCount: 0 }; }
  try {
    const achResult = checkAchievements();
    achievements = achResult.achievements || {};
    progress = achResult.progress || {};
  } catch { achievements = {}; progress = {}; }
  try { ({ top5, rest } = getCategoryProgress(uniqueQaData)); } catch { top5 = []; rest = []; }

  console.log('[renderStats] Данные получены:', { level: level.level, streak: metrics.streakCurrent, studied: metrics.studiedCount });

  // Получаем имя пользователя
  let username = '';
  try {
    const sessionUserRaw = localStorage.getItem('qaSessionUser');
    /* DEBUG
    console.log('[USERNAME] sessionUserRaw:', sessionUserRaw);
    */
    if (sessionUserRaw) {
      const u = JSON.parse(sessionUserRaw);
      /* DEBUG
      console.log('[USERNAME] parsed user:', u);
      */
      if (u && u.username) username = u.username;
    }
  } catch (e) { /* DEBUG */ console.log('[USERNAME] error:', e); /* */ }
  const usernameDisplay = username ? username : '';
  const usernameStyle = username ? 'position:absolute;top:0;left:210px;font-size:10px;color:#06D6A0;text-align:center;font-weight:500;margin:0;padding:0 8px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;z-index:10;pointer-events:none;' : 'display:none!important;';
  let planMins = 0;
  let sessionCount = 0;
  let dueCount = 0;
  let newCount = 0;
  let todaysSession = [];
  let fourDayForecast = null;
  const dataLoaded = uniqueQaData && uniqueQaData.length > 0;
  if (dataLoaded) {
    try {
      // Размер сессии (лимит для одного запуска)
      todaysSession = getTodaysSession(uniqueQaData);
      sessionCount = todaysSession.length;

      // РЕАЛЬНОЕ количество оставшихся вопросов (для кнопки)
      const breakdown = getTodaysSessionBreakdown(uniqueQaData);
      dueCount = breakdown.dueCount;
      newCount = breakdown.newCount;

      // 4-дневный прогноз
      fourDayForecast = get4DayForecast(uniqueQaData);

      // Расчёт времени на основе настроек пользователя
      const settings = window.appSettings || { dailyStudyTime: 60 };
      const dailyMinutes = settings.dailyStudyTime || 60;

      // Если сессия пустая — показываем 0
      if (sessionCount === 0) {
        planMins = 0;
      } else {
        // Используем реальное среднее время или дефолт 1.5 мин
        const avgSecPerCard = getAverageCardTime(40);
        const avgMinPerCard = avgSecPerCard > 0 ? avgSecPerCard / 60 : 1.5;
        planMins = Math.ceil(sessionCount * avgMinPerCard);

        // Ограничиваем временем из настроек (+15% буфер)
        const maxAllowed = Math.ceil(dailyMinutes * 1.15);
        if (planMins > maxAllowed) planMins = maxAllowed;
      }
    } catch { }
  }

  // Рандомные сообщения когда всё пройдено (фиксируем при первом рендере, сбрасываем каждый день)
  const doneMessages = [
    'Всё пройдено! Следующая сессия завтра',
    'На сегодня всё! Возвращайтесь завтра',
    'План выполнен! До завтра!',
    'Отличная работа! На сегодня всё'
  ];
  const _todayKey = new Date().toDateString();
  if (!window._doneMessageIndex || window._doneMessageDate !== _todayKey) {
    window._doneMessageIndex = Math.floor(Math.random() * doneMessages.length);
    window._doneMessageDate = _todayKey;
  }
  const doneMessage = doneMessages[window._doneMessageIndex];
  const doneIcon = `<svg viewBox="0 0 24 24" fill="none" style="width:22px;height:22px;flex-shrink:0;"><rect x="2" y="2" width="20" height="20" rx="5" fill="#06D6A0"/><path d="M7 12.5l3.5 3.5L17 9" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const totalCards = uniqueQaData ? uniqueQaData.length : 0;
  const studiedCards = metrics.studiedCount || 0;
  const remainingCards = Math.max(0, totalCards - studiedCards);

  // Forecast: Dynamic calculation based on settings and user speed
  // Formula: Days = Remaining / ( (SettingsTime * 1.15) / AvgSpeed )
  const settings = window.appSettings || { dailyStudyTime: 60 };
  const dailyMinutes = settings.dailyStudyTime || 60;

  // Get real user speed (min 30s per card)
  const avgSecPerCard = getAverageCardTime(50);
  const avgMinPerCard = Math.max(0.5, avgSecPerCard > 0 ? avgSecPerCard / 60 : 1.5); // Min 0.5 min

  const buffer = 1.15; // +15% buffer
  const dynamicSpeed = Math.floor((dailyMinutes * buffer) / avgMinPerCard);

  const daysToFinish = dynamicSpeed > 0 ? Math.ceil(remainingCards / dynamicSpeed) : 999;
  const today = new Date();
  const finishDate = new Date();
  finishDate.setDate(today.getDate() + daysToFinish);
  const finishDateStr = finishDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });

  const progressMap = getProgressMap();

  // XP из studyStats
  const studyStats = getStudyStats();
  const totalXP = studyStats.points || 0;

  // Общее количество сердечек (сумма всех efChange)
  const totalHearts = getTotalHearts();

  const easyCount = (() => {
    try {
      return Object.values(progressMap).filter(p => p && typeof p.easeFactor === 'number' && p.easeFactor >= 2.4).length;
    } catch { return 0; }
  })();
  const xpSeries = getXpSeries(currentXpMode);
  const improvements = getDailyImprovements(currentXpMode === 'week' ? 7 : (currentXpMode === 'month' ? 30 : 14));

  const lvlProgressPct = Math.max(0, Math.min(1, level.progress || 0)) * 100;
  const remainingXp = Math.max(0, Math.round(level.remaining || 0));

  // Используем локальное время устройства пользователя
  const todayStr = (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  })();
  /* DEBUG
  console.log('[STATS.UI] todayStr (local):', todayStr, 'UTC:', new Date().toISOString());
  */
  let cardsDoneToday = 0;

  // Forecast calculations
  let dueTomorrow = 0;
  let dueWeek = 0;
  const now = new Date();
  const tomorrowStart = new Date(now); tomorrowStart.setDate(now.getDate() + 1); tomorrowStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrowStart); tomorrowEnd.setHours(23, 59, 59, 999);
  const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7); weekEnd.setHours(23, 59, 59, 999);

  const currentCards = getCurrentCards();
  /* DEBUG
  console.log('[STATS.UI] Текущих карточек:', currentCards.length);
  */

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
    { label: 'Легкие', min: 2.4, max: 999, count: 0, color: '#00d9ff', hearts: 4 },
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
  const totalCount = currentCards.length; // Общее количество карточек для расчёта прогресса
  const learningStage = getLearningStage(heartsDist, totalCount);
  const understandingIndex = getUnderstandingIndex(heartsDist, totalCount);
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

  // Сохраняем состояние expanded перед рендером
  const block1El = container.querySelector('.st-block-1');
  const wasExpanded = block1El && block1El.classList.contains('expanded');

  container.innerHTML = `
    <div class="st-wrapper" style="position:relative;">
      <div class="st-mobile-username" id="st-mobile-username" style="${usernameStyle}">${usernameDisplay}</div>
      <div class="st-top">
        <div class="st-top-left" style="display:none"></div>
        <div class="st-top-right" style="grid-column:1 / span 12;display:flex;align-items:center;gap:10px;justify-content:flex-start;width:100%">
          <div class="st-top-actions" style="display:flex;align-items:center;gap:10px;">
            <button class="nav-icon-btn st-home-btn tab" title="Домой" style="min-width:auto;background-color:var(--color-card);">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3l9 8-1.5 1.5L12 6 4.5 12.5 3 11z"/>
                <path d="M5 13v8h6v-6h2v6h6v-8l-7-6z"/>
              </svg>
            </button>
          </div>
          <div class="app-version-display" style="font-size:11px;color:#555;font-weight:bold;">v${window.currentAppVersion || ''}</div>
          <div class="st-streak-metric" style="display:flex;align-items:center;gap:4px;white-space:nowrap;" title="Стрик дней"><span>🔥</span> ${metrics.streakCurrent}</div>
          <div class="st-top-metrics">
            <div class="metric" title="Общий XP"><span>⚡</span> ${totalXP}</div>
            <div class="metric" title="Всего сердечек"><span>❤️</span> ${totalHearts}</div>
          </div>
          ${!dataLoaded ? `
          <button class="st-cta-btn" id="st-continue-top-btn" style="padding:6px 14px;height:32px;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;white-space:nowrap;opacity:0.5;cursor:wait;" disabled>
            <span style="display:flex;align-items:center;line-height:1;">Загрузка...</span>
          </button>` : sessionCount > 0 ? `
          <button class="st-cta-btn" id="st-continue-top-btn" onclick="window.startDailySession()" style="padding:6px 14px;height:32px;font-size:14px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:20px;white-space:nowrap;" title="${fourDayForecast ? fourDayForecast.today.dueCount + ' повт. + ' + fourDayForecast.today.newCount + ' новых' : ''}">
            <span style="display:flex;align-items:center;line-height:1;"><svg viewBox="0 0 24 24" fill="#000" style="width:16px;height:16px;margin-right:6px;"><path d="M8 5v14l11-7z"/></svg>Обучение</span>
            <span style="font-size:12px;font-weight:500;color:#000;display:flex;align-items:center;line-height:1;">${fourDayForecast ? fourDayForecast.today.dueCount + ' повт. + ' + fourDayForecast.today.newCount + ' новых' : '...'}</span>
          </button>` : `
          <button class="st-cta-btn" id="st-continue-top-btn" style="padding:6px 14px;height:32px;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;opacity:0.8;cursor:default;" title="Все карточки на сегодня пройдены">
            ${doneIcon}
            <span style="display:flex;align-items:center;line-height:1;">${doneMessage}</span>
          </button>`}${(() => {
      try {
        const s = localStorage.getItem('qaSessionUser') || sessionStorage.getItem('qaSessionUser');
        console.log('[SETTINGS_BTN] qaSessionUser (local+session):', s);
        if (s) { const u = JSON.parse(s); console.log('[SETTINGS_BTN] parsed:', u); if (u && u.username) return true; }
      } catch (e) { console.error('[SETTINGS_BTN] error:', e); }
      return false;
    })() ? `
          <button class="nav-icon-btn st-settings-btn" onclick="window.openSettingsModal()" title="Настройки" style="min-width:32px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.1);border:none;border-radius:8px;cursor:pointer;transition:background 0.2s;">
            <svg viewBox="0 0 24 24" fill="currentColor" style="width:18px;height:18px;color:rgba(255,255,255,0.6);">
              <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
            </svg>
          </button>` : ''}
          <div class="st-level-inline" style="display:flex;align-items:center;gap:6px;"></div>
          <button class="nav-icon-btn login-main-btn tab st-auth-btn" title="${authTitle}" style="min-width:auto;background-color:var(--color-card);margin-left:auto;">${authIcon}</button>
        </div>
      </div>

      <!-- Отображение имени пользователя будет добавлено через JS -->


      <div class="st-main">
        <!-- Блок 1: Прогресс + 4-дневный прогноз (левый верхний, 33%) -->
        <div class="st-block-1">
          <div class="st-compact-card" role="group" aria-label="Краткая статистика" style="padding:8px 10px!important;gap:6px!important;min-height:auto!important;flex-direction:column!important;overflow:visible!important;">
            <!-- Прогресс и прогноз даты -->
            <div class="stc-content" style="display:flex!important;flex-direction:row!important;gap:4px!important;align-items:center!important;overflow:hidden!important;">
              <span class="stc-block-title" style="font-size:10px!important;font-weight:600!important;white-space:nowrap!important;">Прогресс: <span class="index-value stc-red stc-strong" style="font-size:11px!important;">${understandingIndex}%</span></span>
              <span class="stc-forecast-text" style="font-size:8px!important;color:var(--st-text-sec);white-space:nowrap!important;display:flex!important;align-items:center!important;gap:2px!important;margin-left:auto!important;">Прогноз: <span class="date" style="font-size:9px!important;font-weight:600!important;">${finishDateStr}</span><button class="st-info-btn" onclick="window.openStatsInfoModal(event)" title="Как рассчитывается статистика?" style="flex-shrink:0;margin-left:0!important;">i</button></span>
            </div>
            <!-- 4-дневный прогноз -->
            ${fourDayForecast ? `
            <div class="stc-forecast-block" style="display:flex;flex-direction:column;gap:3px;width:100%;border-top:1px solid rgba(139,148,158,0.2);padding-top:6px;margin-top:2px;">
              <!-- Вчера -->
              <div style="display:flex;align-items:center;justify-content:space-between;font-size:10px!important;gap:4px;">
                <span style="font-weight:600;white-space:nowrap;color:#8B949E;min-width:60px;">${fourDayForecast.yesterday.label}:</span>
                <span style="color:#06D6A0;font-weight:600;">${fourDayForecast.yesterday.completed} из ${fourDayForecast.yesterday.planned}</span>
                <span style="color:#8B949E;font-size:9px;">~${fourDayForecast.yesterday.timeEstimate} мин</span>
              </div>
              <!-- Сегодня -->
              <div style="display:flex;align-items:center;justify-content:space-between;font-size:10px!important;gap:4px;">
                <span style="font-weight:600;white-space:nowrap;color:#fff;min-width:60px;">${fourDayForecast.today.label}:</span>
                <span style="color:#FF9F1C;font-weight:600;">${fourDayForecast.today.completed} из ${fourDayForecast.today.total}</span>
                <span style="color:#8B949E;font-size:9px;">~${fourDayForecast.today.timeEstimate} мин</span>
              </div>
              <!-- Завтра -->
              <div style="display:flex;align-items:center;justify-content:space-between;font-size:10px!important;gap:4px;">
                <span style="font-weight:600;white-space:nowrap;color:#8B949E;min-width:60px;">${fourDayForecast.tomorrow.label}:</span>
                <span style="color:#58A6FF;font-weight:600;">~${fourDayForecast.tomorrow.forecast} карт.</span>
                <span style="color:#8B949E;font-size:9px;">~${fourDayForecast.tomorrow.timeEstimate} мин</span>
              </div>
              <!-- Послезавтра -->
              <div style="display:flex;align-items:center;justify-content:space-between;font-size:10px!important;gap:4px;">
                <span style="font-weight:600;white-space:nowrap;color:#8B949E;min-width:60px;">${fourDayForecast.dayAfter.label}:</span>
                <span style="color:#58A6FF;font-weight:600;">~${fourDayForecast.dayAfter.forecast} карт.</span>
                <span style="color:#8B949E;font-size:9px;">~${fourDayForecast.dayAfter.timeEstimate} мин</span>
              </div>
            </div>
            ` : ''}
            <!-- Кнопка истории -->
            <button class="st-history-toggle" onclick="window.toggleHistoryTimeline()" id="st-history-toggle" style="display:flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;width:100%!important;padding:6px!important;margin-top:6px!important;background:transparent!important;border:1px solid rgba(139,148,158,0.2)!important;border-radius:8px!important;color:var(--st-text-sec)!important;font-size:11px!important;font-weight:600!important;cursor:pointer!important;transition:all 0.2s!important;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px!important;height:14px!important;transition:transform 0.2s!important;" id="st-history-arrow"><polyline points="6 9 12 15 18 9"/></svg>
              Показать историю
            </button>
          </div>
          <!-- Timeline панель (вынесена за пределы st-compact-card) -->
          <div id="st-history-timeline" style="display:none!important;">
            <!-- Фильтры -->
            <div class="st-history-filters" style="display:flex!important;gap:4px!important;margin-bottom:6px!important;flex-wrap:wrap!important;padding-top:10px!important;border-top:1px solid rgba(139,148,158,0.2)!important;">
              <button class="st-hist-filter-btn active" onclick="window.filterHistoryTimeline('all',this)" style="font-size:9px!important;padding:2px 7px!important;border-radius:10px!important;border:1px solid rgba(139,148,158,0.2)!important;background:transparent!important;color:var(--st-text-sec)!important;cursor:pointer!important;font-weight:600!important;">Все</button>
              <button class="st-hist-filter-btn" onclick="window.filterHistoryTimeline('1',this)" style="font-size:9px!important;padding:2px 7px!important;border-radius:10px!important;border:1px solid rgba(139,148,158,0.2)!important;background:transparent!important;color:var(--st-text-sec)!important;cursor:pointer!important;font-weight:600!important;">Снова</button>
              <button class="st-hist-filter-btn" onclick="window.filterHistoryTimeline('2',this)" style="font-size:9px!important;padding:2px 7px!important;border-radius:10px!important;border:1px solid rgba(139,148,158,0.2)!important;background:transparent!important;color:var(--st-text-sec)!important;cursor:pointer!important;font-weight:600!important;">Трудно</button>
              <button class="st-hist-filter-btn" onclick="window.filterHistoryTimeline('3',this)" style="font-size:9px!important;padding:2px 7px!important;border-radius:10px!important;border:1px solid rgba(139,148,158,0.2)!important;background:transparent!important;color:var(--st-text-sec)!important;cursor:pointer!important;font-weight:600!important;">Хорошо</button>
              <button class="st-hist-filter-btn" onclick="window.filterHistoryTimeline('4',this)" style="font-size:9px!important;padding:2px 7px!important;border-radius:10px!important;border:1px solid rgba(139,148,158,0.2)!important;background:transparent!important;color:var(--st-text-sec)!important;cursor:pointer!important;font-weight:600!important;">Легко</button>
            </div>
            <!-- Timeline контейнер -->
            <div class="st-history-timeline-list" id="st-history-timeline-list" style="position:relative!important;padding-left:18px!important;max-height:280px!important;overflow-y:auto!important;"></div>
          </div>
        </div>

        <!-- Кнопка продолжить на всю ширину (мобильная версия) -->
        ${!dataLoaded ? `
        <button class="st-cta-btn st-continue-mobile" id="st-continue-btn" style="opacity:0.5;cursor:wait;" disabled><div style="display:flex;flex-direction:column;align-items:center;gap:4px;"><div style="font-size:15px;font-weight:700;">Загрузка...</div></div></button>` : sessionCount > 0 ? `
        <button class="st-cta-btn st-continue-mobile" id="st-continue-btn" onclick="window.startDailySession()"><div style="display:flex;flex-direction:column;align-items:center;gap:4px;"><div style="display:flex;align-items:center;gap:8px;font-size:16px;font-weight:700;"><svg viewBox="0 0 24 24" fill="#000" style="width:20px;height:20px;"><path d="M8 5v14l11-7z"/></svg><span>Продолжить обучение</span></div><div style="font-size:11px;color:#000;font-weight:400;"><span class="stc-value stc-strong" style="font-size:13px!important;font-weight:600!important;">${fourDayForecast ? fourDayForecast.today.dueCount + ' повт. + ' + fourDayForecast.today.newCount + ' новых' : '...'}</span></div></div></button>` : `
        <button class="st-cta-btn st-continue-mobile" id="st-continue-btn" style="opacity:0.8;cursor:default;"><div style="display:flex;flex-direction:column;align-items:center;gap:6px;">${doneIcon}<div style="font-size:15px;font-weight:700;">${doneMessage}</div></div></button>`}

        <!-- Блок 2: Режимы тренировки (правый верхний, 33%) -->
        <div class="st-block-2 st-modes-section">
          <div class="modes-grid" style="display: grid !important; grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important;">
            <div class="st-mode-card st-mode-card-large" onclick="window.startMode('cram_hard')" style="padding:12px 8px!important;border-radius:8px!important;border:none!important;background:linear-gradient(135deg,rgba(255,159,28,0.15) 0%,rgba(46,196,182,0.1) 100%)!important;display:flex!important;flex-direction:column!important;align-items:center!important;text-align:center!important;gap:8px!important;height:auto!important;" title="📝 Работа над ошибками\n\nНизкая точность.\n\nСфокусируйтесь на слабых местах — система покажет только те карточки, которые вызывают у вас трудности.">
              <span class="st-mode-icon" style="width:40px!important;height:40px!important;margin:0!important;border-radius:8px!important;background:linear-gradient(135deg,#FF9F1C 0%,#FF6B35 100%)!important;display:flex!important;align-items:center!important;justify-content:center!important;flex-shrink:0!important;">
                <svg viewBox="0 0 24 24" fill="#000" style="width:24px;height:24px;"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
              </span>
              <div style="display:flex!important;flex-direction:column!important;align-items:center!important;">
                <span class="st-mode-title" style="font-size:12px!important;font-weight:700!important;margin:0!important;text-align:center!important;display:block!important;color:#fff!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;">Работа над ошибками</span>
                <span class="st-mode-desc" style="font-size:9px!important;color:rgba(255,255,255,0.45)!important;margin:2px 0 0 0!important;text-align:center!important;display:block!important;line-height:1.2!important;white-space:nowrap!important;">Низкая точность</span>
              </div>
            </div>
            <div class="st-mode-card st-mode-card-large" onclick="window.startMode('new_cards')" style="padding:12px 8px!important;border-radius:8px!important;border:none!important;background:linear-gradient(135deg,rgba(255,159,28,0.15) 0%,rgba(46,196,182,0.1) 100%)!important;display:flex!important;flex-direction:column!important;align-items:center!important;text-align:center!important;gap:8px!important;height:auto!important;" title="🌱 Только новые\n\nИзучение свежего материала.\n\nПоказываются только карточки, которые вы ещё не начинали учить.">
              <span class="st-mode-icon" style="width:40px!important;height:40px!important;margin:0!important;border-radius:8px!important;background:linear-gradient(135deg,#2EC4B6 0%,#00d9ff 100%)!important;display:flex!important;align-items:center!important;justify-content:center!important;flex-shrink:0!important;">
                <svg viewBox="0 0 24 24" fill="#000" style="width:24px;height:24px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
              </span>
              <div style="display:flex!important;flex-direction:column!important;align-items:center!important;">
                <span class="st-mode-title" style="font-size:12px!important;font-weight:700!important;margin:0!important;text-align:center!important;display:block!important;color:#fff!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;">Только новые</span>
                <span class="st-mode-desc" style="font-size:9px!important;color:rgba(255,255,255,0.45)!important;margin:2px 0 0 0!important;text-align:center!important;display:block!important;line-height:1.2!important;white-space:nowrap!important;">Свежий материал</span>
              </div>
            </div>
            <div class="st-mode-card st-mode-card-large" onclick="window.startMode('fast_track')" style="padding:12px 8px!important;border-radius:8px!important;border:none!important;background:linear-gradient(135deg,rgba(255,159,28,0.15) 0%,rgba(46,196,182,0.1) 100%)!important;display:flex!important;flex-direction:column!important;align-items:center!important;text-align:center!important;gap:8px!important;height:auto!important;" title="⚡ Fast Track\n\nБыстрая тренировка.\n\nСлучайные 10 вопросов для быстрого повторения и закрепления материала.">
              <span class="st-mode-icon" style="width:40px!important;height:40px!important;margin:0!important;border-radius:8px!important;background:linear-gradient(135deg,#2196F3 0%,#00BCD4 100%)!important;display:flex!important;align-items:center!important;justify-content:center!important;flex-shrink:0!important;">
                <svg viewBox="0 0 24 24" fill="#000" style="width:24px;height:24px;"><path d="M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61 1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42C16.07 4.74 14.12 4 12 4c-4.97 0-9 4.03-9 9s4.02 9 9 9 9-4.03 9-9c0-2.12-.74-4.07-1.97-5.61zM12 20c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>
              </span>
              <div style="display:flex!important;flex-direction:column!important;align-items:center!important;">
                <span class="st-mode-title" style="font-size:12px!important;font-weight:700!important;margin:0!important;text-align:center!important;display:block!important;color:#fff!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;">Fast Track</span>
                ${(() => {
      const avgSecPerCard = getAverageCardTime(50);
      const fastTrackMinutes = Math.ceil((10 * avgSecPerCard) / 60);
      return `<span class="st-mode-desc" style="font-size:9px!important;color:rgba(255,255,255,0.45)!important;margin:2px 0 0 0!important;text-align:center!important;display:block!important;line-height:1.2!important;white-space:nowrap!important;">10 вопросов (~${fastTrackMinutes}м)</span>`;
    })()}
              </div>
            </div>
            ${(() => {
      const marathonCount = uniqueQaData ? uniqueQaData.filter(q => q && q.question && q.answer).length : 0;
      const avgSecPerCard = getAverageCardTime(50);
      const totalMinutes = Math.ceil((marathonCount * avgSecPerCard) / 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const timeStr = hours > 0 ? `${hours}ч ${minutes}м` : `${minutes}м`;

      const marathonProgress = getMarathonProgress();
      const completedCount = marathonProgress ? marathonProgress.currentIndex : 0;
      const hasProgress = completedCount > 0;
      const progressPercent = marathonCount > 0 ? Math.round((completedCount / marathonCount) * 100) : 0;

      return `
            <div class="st-mode-card st-mode-card-large" onclick="window.startMode('marathon')" style="padding:12px 8px!important;border-radius:8px!important;border:none!important;background:linear-gradient(135deg,rgba(255,159,28,0.15) 0%,rgba(46,196,182,0.1) 100%)!important;display:flex!important;flex-direction:column!important;align-items:center!important;text-align:center!important;gap:8px!important;height:auto!important;position:relative!important;" title="🏃 Марафон\n\nВсе карточки подряд.\n\nПройдите через все доступные карточки для максимального закрепления материала.">
              <span class="st-mode-icon" style="width:40px!important;height:40px!important;margin:0!important;border-radius:8px!important;background:linear-gradient(135deg,rgba(156,39,176,0.6) 0%,rgba(233,30,99,0.6) 100%)!important;display:flex!important;align-items:center!important;justify-content:center!important;flex-shrink:0!important;">
                <svg viewBox="0 0 24 24" fill="#000" style="width:24px;height:24px;"><path d="M14.4 6 14 4H5v17h2v-7h5.6l.4 2h7V6z"/></svg>
              </span>
              <div style="display:flex!important;flex-direction:column!important;align-items:center!important;width:100%!important;">
                <span class="st-mode-title" style="font-size:12px!important;font-weight:700!important;margin:0!important;text-align:center!important;display:block!important;color:#fff!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;">Марафон</span>
                <span class="st-mode-desc" style="font-size:9px!important;color:rgba(255,255,255,0.45)!important;margin:2px 0 0 0!important;text-align:center!important;display:block!important;line-height:1.2!important;white-space:nowrap!important;">${marathonCount} вопросов (~${timeStr})</span>
                <div style="width:100%!important;margin-top:6px!important;">
                  <div style="display:flex!important;justify-content:space-between!important;font-size:8px!important;color:rgba(255,255,255,${hasProgress ? '0.7' : '0.35'})!important;margin-bottom:2px!important;">
                    <span>${completedCount}/${marathonCount}</span>
                    <span>${progressPercent}%</span>
                  </div>
                  <div style="width:100%!important;height:4px!important;background:rgba(255,255,255,0.1)!important;border-radius:2px!important;overflow:hidden!important;">
                    <div style="width:${progressPercent}%!important;height:100%!important;background:linear-gradient(90deg,#9C27B0,#E91E63)!important;border-radius:2px!important;transition:width 0.3s ease!important;${!hasProgress ? 'opacity:0.4;' : ''}"></div>
                  </div>
                </div>
              </div>
              <button onclick="event.stopPropagation(); window.clearMarathonProgress && window.clearMarathonProgress();" style="position:absolute!important;top:6px!important;right:6px!important;width:20px!important;height:20px!important;border-radius:50%!important;border:none!important;background:rgba(255,255,255,${hasProgress ? '0.15' : '0.08'})!important;color:rgba(255,255,255,${hasProgress ? '0.7' : '0.3'})!important;cursor:${hasProgress ? 'pointer' : 'default'}!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:12px!important;line-height:1!important;padding:0!important;transition:all 0.2s ease!important;" title="${hasProgress ? 'Сбросить прогресс марафона' : 'Прогресса нет'}" ${!hasProgress ? 'disabled' : ''}>✕</button>
            </div>`;
    })()}
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
                    <div class="st-diff-name">${s.label} ${renderHeartsSvg(s.hearts, 'diff-' + i)}</div>
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

        <!-- Блок достижений по категориям (центральный, span 2 ряда, 33%) -->
        <div class="st-block-achievements">
          <div class="st-cat-progress-wrap">
            <div class="st-cat-progress-header" onclick="window.toggleCategoryList()" style="cursor: pointer;">
              <div class="st-cat-progress-title">Категории <span id="st-cat-count" style="font-size:12px;color:var(--st-muted);font-weight:400;"></span></div>
              <button class="st-cat-toggle-btn" title="Свернуть/развернуть" style="pointer-events: none;">
                <svg class="st-cat-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
            </div>
            <div class="st-cat-progress-list" id="st-cat-progress-list">
              <!-- Заполняется динамически -->
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
            <button class="st-expand-btn" onclick="window.openChartModal()" title="Развернуть график">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Блок 5: Достижения (нижний, 100% ширины) -->
        <div class="st-block-5">
          <div class="st-ach-section">
            <div class="st-ach-scroll-wrap">
              ${renderAchCard('firstSession', '🏁', 'Первый шаг', progress.firstSession, 1, 'common', 'Пройдите хотя бы один урок')}
              ${renderAchCard('sevenDayStreak', '🔥', 'Неделя в огне', progress.streak7, 7, 'rare', '7 дней подряд заходите в приложение и учитесь')}
              ${renderAchCard('consistency', '🧘', 'Стабильность', progress.streak14, 14, 'rare', '14 дней подряд без пропусков')}
              ${renderAchCard('marathoner', '🏃', 'Марафонец', progress.streak30, 30, 'epic', '30 дней подряд — целый месяц без пропусков!')}
              ${renderAchCard('hardToEasy', '📈', 'Прогресс', progress.hardToEasy, 10, 'rare', '10 карточек, которые были сложными, стали лёгкими (5 сердечек)')}
              ${renderAchCard('fiftyCards', '📚', 'Набрал темп', progress.cards50, 50, 'common', '50 карточек с 5 сердечками — хороший прогресс!')}
              ${renderAchCard('century', '💯', 'Центурион', progress.cards100, 100, 'epic', '100 карточек с 5 сердечками — отличное знание материала!')}
              ${renderAchCard('ninetyAccuracy', '🎯', 'Снайпер', progress.accuracy90, 90, 'epic', '90+ правильных ответов из всех вопросов — почти без ошибок!')}
              ${renderAchCard('master', '👑', 'Мастер', progress.level10, 10, 'legendary', 'Уровень 10 — накопите 56250 XP')}
              ${renderAchCard('earlyBird', '🌅', 'Ранняя пташка', progress.earlyBird, 25, 'rare', '25 карточек, пройденных до 9:00 утра')}
              ${renderAchCard('nightRaider', '🌙', 'Ночной рейдер', progress.nightRaider, 50, 'epic', '50 карточек, пройденных после 23:00 (ночью)')}
              ${renderAchCard('comeback', '🔄', 'Возвращение', progress.comebackCards, 10, 'legendary', 'Сделайте перерыв 7+ дней, затем вернитесь и пройдите 10 карточек')}
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
    usernameSpan.style.color = '#00d9ff';
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
      box.style.cursor = 'pointer';
      box.style.transition = 'all 0.2s ease';
      box.style.padding = '4px 8px';
      box.style.borderRadius = '8px';
      box.title = 'Уровни и XP';
      box.onclick = () => {
        /* DEBUG
        console.log('========================================');
        console.log('[LEVEL BOX CLICK] Клик по блоку уровня!');
        console.log('[LEVEL BOX CLICK] Timestamp:', new Date().toISOString());
        console.log('[LEVEL BOX CLICK] window.openLevelInfoModal:', typeof window.openLevelInfoModal);
        console.log('[LEVEL BOX CLICK] Вызываем openLevelInfoModal()...');
        */
        if (window.openLevelInfoModal) {
          window.openLevelInfoModal();
          /* DEBUG
          console.log('[LEVEL BOX CLICK] Модальное окно открыто!');
          */
        } else {
          console.error('[LEVEL BOX CLICK] ❌ window.openLevelInfoModal НЕ НАЙДЕН!');
        }
        /* DEBUG
        console.log('========================================');
        */
      };
      box.onmouseover = () => {
        box.style.background = 'rgba(255,159,28,0.15)';
        box.style.boxShadow = '0 0 12px rgba(255,159,28,0.4)';
        box.style.transform = 'translateX(2px)';
        const bar = box.querySelector('.level-inline-bar');
        if (bar) {
          bar.style.borderColor = 'var(--st-prim)';
          bar.style.boxShadow = '0 0 8px rgba(255,159,28,0.3)';
        }
      };
      box.onmouseout = () => {
        box.style.background = '';
        box.style.boxShadow = '';
        box.style.transform = '';
        const bar = box.querySelector('.level-inline-bar');
        if (bar) {
          bar.style.borderColor = '';
          bar.style.boxShadow = '';
        }
      };
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
      txt.textContent = `${cur}/${tot}`;
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
          if (t) t.textContent = `${cc}/${tt}`;
        } catch { }
      };
      window.addEventListener('xpUpdated', upd);
      window.addEventListener('statsClosed', upd);
    } catch { }
  }

  // Восстанавливаем класс expanded после рендера (если он был установлен до ререндера)
  if (wasExpanded) {
    const newBlock1 = container.querySelector('.st-block-1');
    if (newBlock1) {
      newBlock1.classList.add('expanded');
    }
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

  // ============================================
  // DEBUG: Логирование шапки статистики
  // ============================================
  /* DEBUG
  console.log('========================================');
  console.log('========================================');
  */

  // Объявление кнопок (вне DEBUG-блока)
  const authBtn = container.querySelector('.st-auth-btn');
  const homeBtn = container.querySelector('.st-home-btn');
  const continueBtn = container.querySelector('#st-continue-top-btn');

  /* DEBUG
  const topRight = container.querySelector('.st-top-right');
  if (topRight) {
    const topRightStyles = window.getComputedStyle(topRight);
    console.log('   display:', topRightStyles.display);
    console.log('   visibility:', topRightStyles.visibility);
    console.log('   opacity:', topRightStyles.opacity);
    console.log('   width:', topRightStyles.width);
    console.log('   height:', topRightStyles.height);
    console.log('   flex-wrap:', topRightStyles.flexWrap);
    console.log('   gap:', topRightStyles.gap);
    console.log('   justify-content:', topRightStyles.justifyContent);
    console.log('   overflow:', topRightStyles.overflow);
  }

  /* DEBUG
  // Проверка кнопок (дублирующее объявление - закомментировано)
  const authBtn = container.querySelector('.st-auth-btn');
  const homeBtn = container.querySelector('.st-home-btn');
  const continueBtn = container.querySelector('#st-continue-top-btn');

  /* DEBUG
  console.log('   .st-auth-btn:', authBtn ? 'НАЙДЕНА' : 'НЕ НАЙДЕНА');
  console.log('   .st-home-btn:', homeBtn ? 'НАЙДЕНА' : 'НЕ НАЙДЕНА');
  console.log('   #st-continue-top-btn:', continueBtn ? 'НАЙДЕНА' : 'НЕ НАЙДЕНА');

  if (authBtn) {
    const authStyles = window.getComputedStyle(authBtn);
    console.log('   auth-btn display:', authStyles.display, ', width:', authStyles.width, ', visibility:', authStyles.visibility);
  }
  if (homeBtn) {
    const homeStyles = window.getComputedStyle(homeBtn);
    console.log('   home-btn display:', homeStyles.display, ', width:', homeStyles.width, ', visibility:', homeStyles.visibility);
  }
  if (continueBtn) {
    const contStyles = window.getComputedStyle(continueBtn);
    console.log('   continue-btn display:', contStyles.display, ', width:', contStyles.width, ', visibility:', contStyles.visibility);
  }
  */

  /* DEBUG
  // Проверка видимости кнопок
  function isElementVisible(el) {
    if (!el) return false;
    const styles = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return styles.display !== 'none' &&
      styles.visibility !== 'hidden' &&
      styles.opacity !== '0' &&
      rect.width > 0 &&
      rect.height > 0;
  }

  console.log('   auth-btn видима:', isElementVisible(authBtn));
  console.log('   home-btn видима:', isElementVisible(homeBtn));
  console.log('   continue-btn видима:', isElementVisible(continueBtn));

  // Проверка z-index и position
  if (authBtn) {
    const authStyles = window.getComputedStyle(authBtn);
    console.log('   auth-btn z-index:', authStyles.zIndex, ', position:', authStyles.position);
  }
  if (homeBtn) {
    const homeStyles = window.getComputedStyle(homeBtn);
    console.log('   home-btn z-index:', homeStyles.zIndex, ', position:', homeStyles.position);
  }
  if (topRight) {
    const trStyles = window.getComputedStyle(topRight);
    console.log('   st-top-right z-index:', trStyles.zIndex, ', position:', trStyles.position);
  }

  // Проверка на перекрытие через elementFromPoint
  if (authBtn) {
    const authRect = authBtn.getBoundingClientRect();
    const centerX = authRect.left + authRect.width / 2;
    const centerY = authRect.top + authRect.height / 2;
    const topElement = document.elementFromPoint(centerX, centerY);
    console.log('   auth-btn: элемент в центре кнопки:', topElement ? topElement.className : 'null');
    console.log('   auth-btn: совпадает ли с кнопкой:', topElement === authBtn || (topElement && topElement.closest('.st-auth-btn')));
  }
  if (homeBtn) {
    const homeRect = homeBtn.getBoundingClientRect();
    const centerX = homeRect.left + homeRect.width / 2;
    const centerY = homeRect.top + homeRect.height / 2;
    const topElement = document.elementFromPoint(centerX, centerY);
    console.log('   home-btn: элемент в центре кнопки:', topElement ? topElement.className : 'null');
    console.log('   home-btn: совпадает ли с кнопкой:', topElement === homeBtn || (topElement && topElement.closest('.st-home-btn')));
  }

  // Проверка .st-top-actions
  const topActions = container.querySelector('.st-top-actions');
  if (topActions) {
    const actionsStyles = window.getComputedStyle(topActions);
    console.log('   display:', actionsStyles.display);
    console.log('   visibility:', actionsStyles.visibility);
  }

  console.log('\n========================================');
  // ============================================
  // КОНЕЦ DEBUG шапки
  // ============================================
  */

  // ============================================
  // DEBUG: Блок прогресса - стили и размеры
  // ============================================
  /* DEBUG
  console.log('\n========================================');
  console.log('========================================');

  const compactCard = container.querySelector('.st-compact-card');
  if (compactCard) {
    const styles = window.getComputedStyle(compactCard);
    const rect = compactCard.getBoundingClientRect();

    console.log('   padding: top=' + styles.paddingTop + ', right=' + styles.paddingRight + ', bottom=' + styles.paddingBottom + ', left=' + styles.paddingLeft);
    console.log('   min-height: ' + styles.minHeight);
    console.log('   height: ' + rect.height.toFixed(1) + 'px');
    console.log('   display: ' + styles.display);
    console.log('   flex-direction: ' + styles.flexDirection);
    console.log('   gap: ' + styles.gap);
    console.log('   align-items: ' + styles.alignItems);
    console.log('   justify-content: ' + styles.justifyContent);
    console.log('   text-align: ' + styles.textAlign);
  } else {
  }

  // Проверка заголовка
  const header = container.querySelector('.stc-header-with-info');
  if (header) {
    const hStyles = window.getComputedStyle(header);
    const hRect = header.getBoundingClientRect();
    console.log('   justify-content: ' + hStyles.justifyContent);
    console.log('   margin-bottom: ' + hStyles.marginBottom);
    console.log('   display: ' + hStyles.display);
    console.log('   width: ' + hRect.width.toFixed(1) + 'px');
    console.log('   height: ' + hRect.height.toFixed(1) + 'px');

    // Проверка дочерних элементов
    const children = header.children;
    console.log('   children count: ' + children.length);
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const cStyles = window.getComputedStyle(child);
      const cRect = child.getBoundingClientRect();
      console.log('   child[' + i + ']: ' + child.className);
      console.log('      justify-content: ' + cStyles.justifyContent);
      console.log('      text-align: ' + cStyles.textAlign);
      console.log('      flex: ' + cStyles.flex);
      console.log('      flex-shrink: ' + cStyles.flexShrink);
      console.log('      flex-grow: ' + cStyles.flexGrow);
      console.log('      width: ' + cRect.width.toFixed(1) + 'px');
      console.log('      left: ' + cRect.left.toFixed(1) + 'px');
    }
  }

  // Проверка заголовка текста
  const title = container.querySelector('.stc-block-title');
  if (title) {
    const tStyles = window.getComputedStyle(title);
    const tRect = title.getBoundingClientRect();
    console.log('   justify-content: ' + tStyles.justifyContent);
    console.log('   text-align: ' + tStyles.textAlign);
    console.log('   font-size: ' + tStyles.fontSize);
    console.log('   display: ' + tStyles.display);
    console.log('   flex: ' + tStyles.flex);
    console.log('   width: ' + tRect.width.toFixed(1) + 'px');
    console.log('   left: ' + tRect.left.toFixed(1) + 'px');
    console.log('   innerText: "' + tStyles.innerText + '"');
  }

  // Проверка кнопки "i"
  const infoBtn = container.querySelector('.st-info-btn');
  if (infoBtn) {
    const bStyles = window.getComputedStyle(infoBtn);
    const bRect = infoBtn.getBoundingClientRect();
    console.log('   flex-shrink: ' + bStyles.flexShrink);
    console.log('   margin-left: ' + bStyles.marginLeft);
    console.log('   display: ' + bStyles.display);
    console.log('   width: ' + bRect.width.toFixed(1) + 'px');
    console.log('   left: ' + bRect.left.toFixed(1) + 'px');
  }

  // Проверка контента
  const content = container.querySelector('.stc-content');
  if (content) {
    const cStyles = window.getComputedStyle(content);
    console.log('   align-items: ' + cStyles.alignItems);
    console.log('   text-align: ' + cStyles.textAlign);
    console.log('   gap: ' + cStyles.gap);
  }

  // Проверка строки с прогнозом
  const forecastRow = container.querySelector('.stc-forecast-row');
  if (forecastRow) {
    const fStyles = window.getComputedStyle(forecastRow);
    const fRect = forecastRow.getBoundingClientRect();
    console.log('   justify-content: ' + fStyles.justifyContent);
    console.log('   text-align: ' + fStyles.textAlign);
    console.log('   font-size: ' + fStyles.fontSize);
    console.log('   height: ' + fRect.height.toFixed(1) + 'px');

    // Проверка текста прогноза
    const forecastText = forecastRow.querySelector('.stc-forecast-text');
    if (forecastText) {
      const ftStyles = window.getComputedStyle(forecastText);
      console.log('   font-size: ' + ftStyles.fontSize);
      console.log('   text-align: ' + ftStyles.textAlign);

      // Проверка даты
      const dateEl = forecastText.querySelector('.date');
      if (dateEl) {
        const dStyles = window.getComputedStyle(dateEl);
        console.log('   font-size: ' + dStyles.fontSize);
        console.log('   text-align: ' + dStyles.textAlign);
      }
    }
  }

  console.log('\n========================================');
  */

  // ============================================
  // DEBUG: Порядок блоков в мобильной версии
  // ============================================
  /* DEBUG
  console.log('\n========================================');
  console.log('========================================');
  console.log('window.innerWidth:', window.innerWidth);
  console.log('Is mobile (≤768px):', window.innerWidth <= 768);

  const blocks = {
    '.st-top-right': 'Шапка',
    '#st-continue-btn': 'Продолжить обучение',
    '.st-block-1': 'Прогресс',
    '.st-block-2': 'Режимы (2 карточки)',
    '.st-block-4': 'Сложность + Избранное',
    '.st-block-achievements': 'Категории',
    '.st-block-3': 'Графики',
    '.st-block-5': 'Достижения'
  };

  Object.entries(blocks).forEach(([selector, name], index) => {
    const el = container.querySelector(selector);
    if (el) {
      const styles = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      console.log(`   ${index + 1}. ${selector}`);
      console.log(`      ${name}`);
      console.log(`      order: ${styles.order}`);
      console.log(`      display: ${styles.display}`);
      console.log(`      position: top=${rect.top.toFixed(1)}, height=${rect.height.toFixed(1)}`);
    } else {
      console.log(`   ${index + 1}. ${selector} - НЕ НАЙДЕН`);
    }
  });

  // Проверка CSS правил для order
  const allStyles = Array.from(document.styleSheets);
  allStyles.forEach((sheet, i) => {
    try {
      const rules = Array.from(sheet.cssRules || []);
      rules.forEach(r => {
        if (r.selectorText && r.selectorText.includes('.st-block-') && r.style.order) {
          console.log(`   Sheet ${i}: ${r.selectorText} -> order: ${r.style.order}`);
        }
      });
    } catch (e) {
      // CORS
    }
  });

  console.log('\n========================================');
  // ============================================
  // КОНЕЦ DEBUG порядка блоков
  // ============================================
  */

  // ============================================
  // DEBUG: modes-grid (карточки режимов)
  // ============================================
  /* DEBUG
  console.log('\n========================================');
  console.log('========================================');

  console.log('   Media query (max-width: 768px):', window.innerWidth <= 768 ? 'ДА' : 'НЕТ');

  // Проверка STATS_STYLES
  console.log('\n📄 ПРОВЕРКА STATS_STYLES:');
  if (typeof STATS_STYLES !== 'undefined') {
    const hasModesGrid = STATS_STYLES.includes('.modes-grid');
    const hasMedia768 = STATS_STYLES.includes('@media (max-width: 768px)');
    console.log('   STATS_STYLES существует:', true);
    console.log('   Содержит .modes-grid:', hasModesGrid);
    console.log('   Содержит @media (max-width: 768px):', hasMedia768);
    if (hasModesGrid) {
      const startIdx = STATS_STYLES.indexOf('.modes-grid');
      const snippet = STATS_STYLES.substring(startIdx, startIdx + 200);
      console.log('   Фрагмент CSS:', snippet.replace(/\n/g, '\\n'));
    }
  } else {
    console.log('   STATS_STYLES НЕ НАЙДЕН!');
  }

  // Проверка style элемента
  const styleEl = document.querySelector('style[data-stats-style]') || document.querySelector('style');
  if (styleEl) {
    const styleContent = styleEl.textContent;
    const hasModesGrid = styleContent.includes('.modes-grid');
    console.log('   <style> элемент:', 'НАЙДЕН');
    console.log('   Длина CSS:', styleContent.length, 'символов');
    console.log('   Содержит .modes-grid:', hasModesGrid);
    if (hasModesGrid) {
      const startIdx = styleContent.indexOf('.modes-grid');
      const snippet = styleContent.substring(startIdx, startIdx + 200);
      console.log('   Фрагмент:', snippet.replace(/\n/g, '\\n'));
    }
  } else {
    console.log('   <style> элемент:', 'НЕ НАЙДЕН!');
  }

  // Проверка всех stylesheet
  const allRules = [];
  for (let i = 0; i < document.styleSheets.length; i++) {
    try {
      const rules = document.styleSheets[i].cssRules || document.styleSheets[i].rules;
      for (let j = 0; j < rules.length; j++) {
        const rule = rules[j];
        if (rule.selectorText && rule.selectorText.includes('.modes-grid')) {
          console.log(`      display: ${rule.style.display}`);
          console.log(`      grid-template-columns: ${rule.style.gridTemplateColumns}`);
          console.log(`      background: ${rule.style.background}`);
          allRules.push(rule.selectorText);
        }
      }
    } catch (e) {
    }
  }
  if (allRules.length === 0) {
  }

  const modesGrid = container.querySelector('.modes-grid');
  if (modesGrid) {
    const mgStyles = window.getComputedStyle(modesGrid);
    console.log('   display:', mgStyles.display);
    console.log('   grid-template-columns:', mgStyles.gridTemplateColumns);
    console.log('   gap:', mgStyles.gap);
    console.log('   width:', mgStyles.width);
    console.log('   height:', mgStyles.height);

    // Проверка дочерних карточек
    const cards = modesGrid.querySelectorAll('.st-mode-card, .st-mode-card-large');
    cards.forEach((card, i) => {
      const cStyles = window.getComputedStyle(card);
      const icon = card.querySelector('.st-mode-icon');
      const title = card.querySelector('.st-mode-title');
      const desc = card.querySelector('.st-mode-desc');

      console.log('\n   Карточка ' + (i + 1) + ':');
      console.log('      display:', cStyles.display);
      console.log('      padding:', cStyles.padding);
      console.log('      background:', cStyles.background);
      console.log('      border:', cStyles.border);
      console.log('      border-radius:', cStyles.borderRadius);
      console.log('      height:', cStyles.height);
      console.log('      flex-direction:', cStyles.flexDirection);
      console.log('      align-items:', cStyles.alignItems);
      console.log('      gap:', cStyles.gap);

      if (icon) {
        const iStyles = window.getComputedStyle(icon);
        console.log('      .st-mode-icon:');
        console.log('         width:', iStyles.width, '| height:', iStyles.height);
        console.log('         background:', iStyles.background);
        console.log('         border-radius:', iStyles.borderRadius);
        console.log('         margin:', iStyles.margin);
        console.log('         display:', iStyles.display);
        console.log('         innerHTML:', icon.innerHTML.substring(0, 50) + '...');
      }

      if (title) {
        const tStyles = window.getComputedStyle(title);
        console.log('      .st-mode-title:');
        console.log('         font-size:', tStyles.fontSize);
        console.log('         text-align:', tStyles.textAlign);
        console.log('         flex:', tStyles.flex);
        console.log('         text:', title.textContent.substring(0, 30));
      }

      if (desc) {
        const dStyles = window.getComputedStyle(desc);
        console.log('      .st-mode-desc:');
        console.log('         display:', dStyles.display);
        console.log('         font-size:', dStyles.fontSize);
      }
    });
  }

  const stBlock2 = container.querySelector('.st-block-2');
  if (stBlock2) {
    const b2Styles = window.getComputedStyle(stBlock2);
    console.log('   display:', b2Styles.display);
    console.log('   flex-direction:', b2Styles.flexDirection);
  }

  // Проверка каждого child
  if (modesGrid) {
    console.log('   children count:', modesGrid.children.length);
    Array.from(modesGrid.children).forEach((child, i) => {
      const childStyles = window.getComputedStyle(child);
      console.log(`   child[${i}]:`, child.className);
      console.log(`      display: ${childStyles.display}, width: ${childStyles.width}`);
      console.log(`      grid-column: ${childStyles.gridColumn}`);
    });
  }

  // Проверка .st-block-2
  const block2 = container.querySelector('.st-block-2');
  if (block2) {
    const b2Styles = window.getComputedStyle(block2);
    console.log('   display:', b2Styles.display);
    console.log('   width:', b2Styles.width);
  }

  console.log('\n========================================');
  // ============================================
  // КОНЕЦ DEBUG modes-grid
  // ============================================
  */

  // homeBtn уже объявлен выше в debug-секции
  /* DEBUG
  console.log('========================================');
  console.log('[HOME BTN SETUP] homeBtn found:', !!homeBtn);
  console.log('[HOME BTN SETUP] location.hash:', location.hash);
  console.log('========================================');
  */
  if (homeBtn) {
    homeBtn.addEventListener('click', () => {
      /* DEBUG
      console.log('========================================');
      console.log('[HOME BTN CLICK] Clicked!');
      console.log('[HOME BTN CLICK] Current location.hash:', location.hash);
      console.log('[HOME BTN CLICK] window.__lastCandidates:', window.__lastCandidates);
      */

      // Очищаем состояние обучения
      if (window.__lastCandidates) {
        window.__lastCandidates = null;
        /* DEBUG
        console.log('[HOME BTN CLICK] Cleared __lastCandidates');
        */
      }

      // Просто меняем hash на главную
      location.hash = '#/';
      /* DEBUG
      console.log('[HOME BTN CLICK] Hash changed to:', location.hash);
      console.log('========================================');
      */
    });
  }

  const continueBtnBottom = container.querySelector('#st-continue-btn');
  if (continueBtnBottom) {
    continueBtnBottom.addEventListener('click', () => {
      if (!uniqueQaData || uniqueQaData.length === 0) {
        alert('Нет вопросов для изучения');
        return;
      }

      hideStatsPage();
      startLearnSession(uniqueQaData);

      const mainNav = document.getElementById('bottom-nav');
      if (mainNav) {
        const learnNav = mainNav.querySelector('#bn-learn');
        if (learnNav) learnNav.click();
      }
    });
  }

  // Функция для кнопки "Продолжить обучение" в шапке
  window.startDailySession = () => {
    // Передаём ВСЕ карточки, чтобы getTodaysSession в learn-ui.js сама отфильтровала
    if (!uniqueQaData || uniqueQaData.length === 0) {
      alert('Нет вопросов для изучения');
      return;
    }

    hideStatsPage();
    startLearnSession(uniqueQaData);

    const mainNav = document.getElementById('bottom-nav');
    if (mainNav) {
      const learnNav = mainNav.querySelector('#bn-learn');
      if (learnNav) learnNav.click();
    }
  };

  const startTodayLink = container.querySelector('#st-start-today');
  if (startTodayLink) {
    startTodayLink.addEventListener('click', () => {
      // Передаём ВСЕ карточки
      if (!uniqueQaData || uniqueQaData.length === 0) {
        alert('Нет вопросов для изучения');
        return;
      }

      hideStatsPage();
      startLearnSession(uniqueQaData);

      const mainNav = document.getElementById('bottom-nav');
      if (mainNav) {
        const learnNav = mainNav.querySelector('#bn-learn');
        if (learnNav) learnNav.click();
      }
    });
  }

  const authBtnSetup = container.querySelector('.st-auth-btn');
  if (authBtnSetup) {
    authBtnSetup.addEventListener('click', () => {
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
      if (!uniqueQaData || uniqueQaData.length === 0) { alert('Нет вопросов для изучения'); return; }
      hideStatsPage();
      startLearnSession(uniqueQaData);
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
    // Фиксированная высота графика для всех режимов (согласована с CSS .chart-wrapper)
    const h = 270;
    const bottomPad = 16;
    const topPad = 20;
    const leftMargin = 28;
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
      : currentXpMode === 'month' ? { bar: 12, gap: 6, count: data.length, labelStep: 2 }
        : { bar: 28, gap: 16, count: 12, labelStep: 2 };
    const width = chartEl.clientWidth || 600;
    // Динамически рассчитываем ширину баров, чтобы все помещались
    const availableWidth = width - leftMargin - 4; // минимальный запас справа
    const maxGroupW = Math.floor(availableWidth / cfg.count);
    const wideBarW = Math.max(3, Math.min(14, maxGroupW - 2)); // минимум 3px, максимум 14px
    const narrowBarW = Math.max(1, Math.round(wideBarW * 0.4));
    const groupW = wideBarW;
    const dynamicGap = Math.max(1, maxGroupW - wideBarW);
    const colsW = width; // viewBox всегда равен ширине контейнера
    chartEl.setAttribute('viewBox', `0 0 ${colsW} ${h}`);
    chartEl.removeAttribute('preserveAspectRatio');
    const grid = ticks.map(t => {
      const y = (innerH / maxVal) * t;
      return `<line class="chart-grid-line" x1="${leftMargin}" y1="${topPad + (innerH - y)}" x2="${colsW}" y2="${topPad + (innerH - y)}"/>`;
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
    const minBarH = 4;
    const zeroBarH = 1;
    data.forEach((d, idx) => {
      const labelOk = idx % cfg.labelStep === 0;
      const cardsVal = d.cards || 0;
      const heartsVal = d.hearts || 0;
      const rWide = Math.round(wideBarW / 2);

      // Тёмный плейсхолдер-тень на полную высоту (один на весь столбик)
      const placeholderRx = Math.min(rWide, Math.max(1, Math.round(innerH / 2)));
      const pathPlaceholder = `M ${x} ${topPad + innerH} L ${x} ${topPad + placeholderRx} Q ${x} ${topPad} ${x + placeholderRx} ${topPad} L ${x + wideBarW - placeholderRx} ${topPad} Q ${x + wideBarW} ${topPad} ${x + wideBarW} ${topPad + placeholderRx} L ${x + wideBarW} ${topPad + innerH} Z`;
      bars.push(`<path class="bar-placeholder" d="${pathPlaceholder}" fill="rgba(0,0,0,0.12)" style="pointer-events:none"/>`);

      const narrowBarW = Math.round(wideBarW * 0.4);
      const heartsX = x + Math.round((wideBarW - narrowBarW) / 2);

      if (cardsVal > 0) {
        const cardsH = Math.max(minBarH, Math.min(innerH, (innerH / hcMax) * cardsVal));
        const yCards = topPad + (innerH - cardsH);
        const tCards = Math.max(0, Math.min(1, cardsVal / hcMax));
        const topOrange = lerpHex(orangeDark, orangeBright, tCards);
        defs.push(`<linearGradient id="go${idx}" gradientUnits="userSpaceOnUse" x1="0" y1="${topPad + innerH}" x2="0" y2="${topPad}"><stop offset="0%" stop-color="${orangeDark}"/><stop offset="100%" stop-color="${topOrange}"/></linearGradient>`);
        const rx = Math.min(Math.round(wideBarW / 2), Math.max(1, Math.round(cardsH / 2)));
        const pathCards = `M ${x} ${topPad + innerH} L ${x} ${yCards + rx} Q ${x} ${yCards} ${x + rx} ${yCards} L ${x + wideBarW - rx} ${yCards} Q ${x + wideBarW} ${yCards} ${x + wideBarW} ${yCards + rx} L ${x + wideBarW} ${topPad + innerH} Z`;
        bars.push(`<path class="bar-cards" d="${pathCards}" data-type="cards" data-date="${d.date}" data-hearts="${heartsVal}" data-cards="${cardsVal}" fill="url(#go${idx})" opacity="0.9"/>`);
      } else {
        defs.push(`<linearGradient id="go${idx}" gradientUnits="userSpaceOnUse" x1="0" y1="${topPad + innerH}" x2="0" y2="${topPad}"><stop offset="0%" stop-color="${orangeDark}"/><stop offset="100%" stop-color="${orangeDark}"/></linearGradient>`);
        const yZero = topPad + innerH - zeroBarH;
        bars.push(`<rect class="bar-cards" x="${x}" y="${yZero}" width="${wideBarW}" height="${zeroBarH}" data-type="cards" data-date="${d.date}" data-hearts="${heartsVal}" data-cards="0" fill="url(#go${idx})" opacity="0.15"/>`);
      }

      if (heartsVal > 0) {
        const heartsH = Math.max(minBarH, Math.min(innerH, (innerH / hcMax) * heartsVal * 20));
        const yHearts = topPad + (innerH - heartsH);
        const tHearts = Math.max(0, Math.min(1, heartsVal / hcMax));
        const topRed = lerpHex(redDark, redBright, tHearts);
        defs.push(`<linearGradient id="gh${idx}" gradientUnits="userSpaceOnUse" x1="0" y1="${topPad + innerH}" x2="0" y2="${topPad}"><stop offset="0%" stop-color="${redDark}"/><stop offset="100%" stop-color="${topRed}"/></linearGradient>`);
        const rx = Math.min(Math.round(narrowBarW / 2), Math.max(1, Math.round(heartsH / 2)));
        const pathHearts = `M ${heartsX} ${topPad + innerH} L ${heartsX} ${yHearts + rx} Q ${heartsX} ${yHearts} ${heartsX + rx} ${yHearts} L ${heartsX + narrowBarW - rx} ${yHearts} Q ${heartsX + narrowBarW} ${yHearts} ${heartsX + narrowBarW} ${yHearts + rx} L ${heartsX + narrowBarW} ${topPad + innerH} Z`;
        bars.push(`<path class="bar-hearts" d="${pathHearts}" data-type="hearts" data-date="${d.date}" data-hearts="${heartsVal}" data-cards="${cardsVal}" fill="url(#gh${idx})" opacity="1"/>`);
      } else {
        defs.push(`<linearGradient id="gh${idx}" gradientUnits="userSpaceOnUse" x1="0" y1="${topPad + innerH}" x2="0" y2="${topPad}"><stop offset="0%" stop-color="${redDark}"/><stop offset="100%" stop-color="${redDark}"/></linearGradient>`);
        const yZero = topPad + innerH - zeroBarH;
        bars.push(`<rect class="bar-hearts" x="${heartsX}" y="${yZero}" width="${narrowBarW}" height="${zeroBarH}" data-type="hearts" data-date="${d.date}" data-hearts="${heartsVal}" data-cards="${cardsVal}" fill="url(#gh${idx})" opacity="0.1"/>`);
      }
      if (labelOk) {
        bars.push(`<text class="chart-label" x="${x + groupW / 2}" y="${h - 4}" text-anchor="middle">${d.label}</text>`);
      }
      x += groupW + dynamicGap;
    });
    // Прозрачный overlay для отслеживания мыши по всей области графика
    bars.push(`<rect class="chart-overlay" x="${leftMargin}" y="${topPad}" width="${colsW - leftMargin}" height="${innerH}" fill="transparent" style="cursor:default"/>`);
    defs.push(`<linearGradient id="ghost-grad" gradientUnits="userSpaceOnUse" x1="0" y1="${topPad + innerH}" x2="0" y2="${topPad}"><stop offset="0%" stop-color="rgba(255,255,255,0.12)"/><stop offset="100%" stop-color="rgba(255,255,255,0.06)"/></linearGradient>`);
    const ghostRx = Math.round(wideBarW / 2);
    const ghostBarSVG = `<path class="ghost-bar" d="M 0 ${topPad + innerH} L 0 ${topPad + ghostRx} Q 0 ${topPad} ${ghostRx} ${topPad} L ${wideBarW - ghostRx} ${topPad} Q ${wideBarW} ${topPad} ${wideBarW} ${topPad + ghostRx} L ${wideBarW} ${topPad + innerH} Z" fill="url(#ghost-grad)" opacity="0" style="pointer-events:none;"/>`;
    chartEl.innerHTML = `<defs>${defs.join('')}</defs>${grid}${yLabels}${bars.join('')}${ghostBarSVG}`;

    let tip = document.querySelector('.tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'tooltip';
      document.body.appendChild(tip);
    }
    const tooltipW = 160;
    const overlay = chartEl.querySelector('.chart-overlay');
    const ghostBar = chartEl.querySelector('.ghost-bar');

    // Функции подсветки реальных столбиков
    let highlightedBars = [];
    function highlightBars(idx) {
      clearBarHighlight();
      const date = data[idx].date;
      chartEl.querySelectorAll(`[data-date="${date}"]`).forEach(el => {
        el.style.filter = 'brightness(1.3)';
        highlightedBars.push(el);
      });
    }
    function clearBarHighlight() {
      highlightedBars.forEach(el => { el.style.filter = ''; });
      highlightedBars = [];
    }

    overlay.addEventListener('mousemove', (e) => {
      const rect = chartEl.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      // Масштабирование координат из экрана в viewBox
      const scaleX = colsW / rect.width;
      const scaleY = innerH / rect.height;
      const viewBoxX = mouseX * scaleX;
      const viewBoxY = topPad + mouseY * scaleY;
      // Определяем индекс дня по X
      const dayIdx = Math.floor((viewBoxX - leftMargin) / (groupW + dynamicGap));
      if (dayIdx < 0 || dayIdx >= data.length) { tip.style.display = 'none'; ghostBar.setAttribute('opacity', '0'); clearBarHighlight(); return; }
      // Проверяем что курсор в зоне столбика (а не в gap между столбиками)
      const barStartX = leftMargin + dayIdx * (groupW + dynamicGap);
      const barEndX = barStartX + groupW;
      if (viewBoxX < barStartX || viewBoxX > barEndX) { tip.style.display = 'none'; ghostBar.setAttribute('opacity', '0'); clearBarHighlight(); return; }

      const d = data[dayIdx];
      const cardsH = d.cards > 0 ? Math.max(minBarH, Math.min(innerH, (innerH / hcMax) * d.cards)) : 0;
      const heartsH = d.hearts > 0 ? Math.max(minBarH, Math.min(innerH, (innerH / hcMax) * d.hearts)) : 0;
      const cardsTopY = topPad + innerH - cardsH;
      const heartsTopY = topPad + innerH - heartsH;
      const narrowBarW = Math.round(wideBarW * 0.4);
      const heartsX = barStartX + Math.round((wideBarW - narrowBarW) / 2);

      // Определяем на какую часть столбика наведен курсор
      // Призрак показываем всегда когда курсор в X-зоне столбика, а тип — по позиции
      let typeLabel;
      const inHeartsX = viewBoxX >= heartsX && viewBoxX <= heartsX + narrowBarW;
      const inHeartsY = viewBoxY >= heartsTopY && viewBoxY <= topPad + innerH;
      const inCardsY = viewBoxY >= cardsTopY && viewBoxY <= topPad + innerH;

      if (inHeartsX && inHeartsY && heartsH > 0) {
        typeLabel = 'Сердечки (красный)';
      } else if (inCardsY && cardsH > 0) {
        typeLabel = 'Карточки (оранжевый)';
      } else if (inHeartsX && heartsH > 0) {
        // Курсор в X-зоне hearts, но выше/ниже столбика — всё равно показываем
        typeLabel = 'Сердечки (красный)';
      } else if (cardsH > 0) {
        // Курсор в X-зоне cards — показываем карточки
        typeLabel = 'Карточки (оранжевый)';
      } else if (heartsH > 0) {
        typeLabel = 'Сердечки (красный)';
      } else {
        // Нулевой столбик — всё равно показываем призрак и тултип
        typeLabel = 'Нет данных';
      }

      // Подсвечиваем реальные столбики этого дня
      highlightBars(dayIdx);

      // Показываем призрачный столбик
      const gRx = Math.round(wideBarW / 2);
      const ghostPath = `M ${barStartX} ${topPad + innerH} L ${barStartX} ${topPad + gRx} Q ${barStartX} ${topPad} ${barStartX + gRx} ${topPad} L ${barStartX + wideBarW - gRx} ${topPad} Q ${barStartX + wideBarW} ${topPad} ${barStartX + wideBarW} ${topPad + gRx} L ${barStartX + wideBarW} ${topPad + innerH} Z`;
      ghostBar.setAttribute('d', ghostPath);
      ghostBar.setAttribute('opacity', '1');

      tip.innerHTML = `<div class="tooltip-date">${new Date(d.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}</div><div style="margin:4px 0;color:#fff;font-weight:600">${typeLabel}</div><div>❤️: ${d.hearts || 0}</div><div>📚: ${d.cards || 0}</div><div class="tip-arrow"></div>`;
      tip.style.display = 'block';
      // Позиционируем рядом с курсором
      const spaceRight = window.innerWidth - e.clientX;
      let tipLeft, tipTop;
      if (spaceRight >= tooltipW + 10) {
        tipLeft = e.clientX + 10;
        tip.querySelector('.tip-arrow').style.cssText = 'position:absolute;top:10px;left:-6px;width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-right:6px solid var(--st-surf-h);border-left:none;';
      } else {
        tipLeft = e.clientX - tooltipW - 10;
        tip.querySelector('.tip-arrow').style.cssText = 'position:absolute;top:10px;right:-6px;width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-left:6px solid var(--st-surf-h);border-right:none;';
      }
      tipTop = e.clientY - 10;
      tip.style.left = Math.round(tipLeft) + 'px';
      tip.style.top = Math.round(tipTop) + 'px';
    });
    overlay.addEventListener('mouseleave', () => { tip.style.display = 'none'; ghostBar.setAttribute('opacity', '0'); clearBarHighlight(); });
    // Убираем pointer-events с баров (overlay перехватывает события)
    chartEl.querySelectorAll('.bar-hearts,.bar-cards').forEach(el => {
      el.style.pointerEvents = 'none';
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
      <div class="st-xp-col ${d.isToday ? 'today' : ''}" title="${d.date}: ${d.xp} XP, ❤ ${(d.hearts || 0)}">
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
              <button onclick="simClick(1)" style="background:#FF9F1C;color:#000;border:none;padding:10px;border-radius:8px;cursor:pointer;font-weight:700;"><div style="font-size:20px;">🤔</div><div style="font-size:11px;">Трудно</div><div style="font-size:10px;opacity:0.8;">-0.15</div></button>
              <button onclick="simClick(2)" style="background:#2EC4B6;color:#000;border:none;padding:10px;border-radius:8px;cursor:pointer;font-weight:700;"><div style="font-size:20px;">😊</div><div style="font-size:11px;">Хорошо</div><div style="font-size:10px;opacity:0.8;">+0.05</div></button>
              <button onclick="simClick(3)" style="background:#4CAF50;color:#fff;border:none;padding:10px;border-radius:8px;cursor:pointer;font-weight:700;"><div style="font-size:20px;">🚀</div><div style="font-size:11px;">Легко</div><div style="font-size:10px;opacity:0.8;">+0.05</div></button>
           </div>
           <button onclick="simReset()" style="width:100%;background:rgba(255,255,255,0.1);color:#fff;border:1px solid var(--st-border);padding:10px;border-radius:8px;cursor:pointer;">🔄 Сбросить</button>
           <div id="sim-msg" style="margin-top:12px;font-size:13px;color:var(--st-text-sec);text-align:center;min-height:18px;"></div>
        </div>
     </div>
   `;
  document.body.appendChild(overlay);

  // Закрытие по ESC
  const escHandler = () => { overlay.remove(); document.removeEventListener('keydown', escHandler); };
  document.addEventListener('keydown', escHandler);

  window.simValue = 3.0;
  window.simClick = (action) => { const changes = [-0.25, -0.15, +0.05, +0.05]; window.simValue = Math.max(0, Math.min(5, window.simValue + changes[action])); updateSim(); };
  window.simReset = () => { window.simValue = 3.0; updateSim(); };
  function createHeart(id, fillPercent) { return '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" style="display:inline-block;"><defs><linearGradient id="' + id + '"><stop offset="' + fillPercent + '%" stop-color="#ff4d4d"/><stop offset="' + fillPercent + '%" stop-color="#444"/></linearGradient></defs><path fill="url(#' + id + ')" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>'; }
  function updateSim() { const v = window.simValue; document.getElementById('sim-value').textContent = v.toFixed(2); const full = Math.floor(v); const partial = v - full; const heartsContainer = document.getElementById('sim-hearts'); let html = ''; for (let i = 1; i <= 5; i++) { const fillPercent = i <= full ? 100 : (i === full + 1 ? Math.round(partial * 100) : 0); html += createHeart('sim-grad-' + i, fillPercent); } heartsContainer.innerHTML = html; const levels = ['Очень трудные', 'Трудные', 'Стандарт', 'Стандарт', 'Легкие']; const levelIdx = v < 1 ? 0 : v < 2 ? 1 : v < 3 ? 2 : v < 4 ? 3 : 4; document.getElementById('sim-level').textContent = levels[levelIdx]; const msg = document.getElementById('sim-msg'); if (v <= 0) msg.textContent = '⚠️ 0 сердечек — начните заново!'; else if (v >= 5) msg.textContent = '🎉 5 сердечек — карточка в памяти!'; else msg.textContent = ''; }
  updateSim();
};

// Модальное окно с объяснением статистики

// ============================================
// DEBUG ФУНКЦИЯ ДЛЯ МОБИЛЬНОЙ ВЁРСТКИ
// ============================================

// Показать описание достижения (toast)
window.showAchievementDesc = (title, desc, isUnlocked, progress) => {
  if (!desc) return;

  // Удаляем существующий toast если есть
  const existing = document.getElementById('ach-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'ach-toast';
  toast.style.cssText = `
    position:fixed;
    bottom:80px;
    left:50%;
    transform:translateX(-50%);
    background:var(--st-surf);
    border:1px solid var(--st-border);
    border-left:3px solid ${isUnlocked ? 'var(--st-sec)' : 'var(--st-prim)'};
    border-radius:8px;
    padding:12px 16px;
    max-width:280px;
    z-index:10000;
    box-shadow:0 4px 12px rgba(0,0,0,0.5);
    animation:toastFadeIn 0.3s ease;
  `;
  toast.innerHTML = `
    <div style="font-size:12px;font-weight:600;color:#fff;margin-bottom:4px;">${isUnlocked ? '✅ ' : '🔒 '}${title}</div>
    <div style="font-size:11px;color:var(--st-text-sec);margin-bottom:6px;">${desc}</div>
    <div style="font-size:10px;color:var(--st-muted);">Прогресс: <strong style="color:#fff;">${progress}</strong></div>
  `;

  // Добавляем стили для анимации
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
      @keyframes toastFadeIn {
        from { opacity: 0; transform: translateX(-50%) translateY(10px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
      @keyframes toastFadeOut {
        from { opacity: 1; transform: translateX(-50%) translateY(0); }
        to { opacity: 0; transform: translateX(-50%) translateY(10px); }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);

  // Автозакрытие через 4 секунды
  let closeTimeout = setTimeout(() => closeToast(), 4000);

  // Закрытие по клику в любом месте (кроме самого toast)
  const closeToast = () => {
    if (toast && toast.parentNode) {
      toast.style.animation = 'toastFadeOut 0.3s ease';
      setTimeout(() => {
        if (toast && toast.parentNode) toast.remove();
      }, 300);
    }
    clearTimeout(closeTimeout);
    document.removeEventListener('click', handleClick);
    document.removeEventListener('touchstart', handleClick);
  };

  const handleClick = (e) => {
    // Не закрываем если клик по toast
    if (toast.contains(e.target)) {
      return;
    }
    closeToast();
  };

  // Добавляем обработчик с задержкой 100мс чтобы избежать срабатывания от клика по иконке
  setTimeout(() => {
    document.addEventListener('click', handleClick);
    document.addEventListener('touchstart', handleClick);
  }, 100);
};

window.openStatsInfoModal = (event) => {
  if (event) event.stopPropagation();
  const overlay = document.createElement('div');
  overlay.className = 'st-modal-overlay';
  overlay.innerHTML = `
    <div class="st-modal" style="max-width:700px;">
      <div class="st-modal-header">
        <div class="st-modal-title">📊 Как рассчитывается статистика?</div>
        <button class="st-modal-close" onclick="this.closest('.st-modal-overlay').remove()">×</button>
      </div>
      <div class="st-modal-body" style="padding:20px;">

        <!-- Прогресс -->
        <div style="margin-bottom:24px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <span style="font-size:24px;">📊</span>
            <h3 style="margin:0;font-size:16px;color:#fff;">Прогресс</h3>
          </div>
          <div style="background:rgba(229,83,61,0.1);border-left:3px solid #E5533D;padding:12px;border-radius:8px;">
            <p style="margin:0 0 12px 0;font-size:14px;color:var(--st-text);">
              Показывает степень усвоения материала (от 0% до 100%) на основе интервальных повторений (SRS).
            </p>
            <div style="background:linear-gradient(90deg,#E5533D 0%,#FF9F1C 50%,#4CAF50 100%);height:24px;border-radius:12px;position:relative;margin-bottom:10px;">
              <div style="position:absolute;left:0%;top:50%;transform:translate(-50%,-50%);font-size:10px;color:#fff;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,0.8);">0%</div>
              <div style="position:absolute;left:25%;top:50%;transform:translate(-50%,-50%);font-size:10px;color:#fff;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,0.8);">25%</div>
              <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:10px;color:#fff;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,0.8);">50%</div>
              <div style="position:absolute;left:75%;top:50%;transform:translate(-50%,-50%);font-size:10px;color:#fff;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,0.8);">75%</div>
              <div style="position:absolute;left:100%;top:50%;transform:translate(-50%,-50%);font-size:10px;color:#fff;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,0.8);">100%</div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;text-align:center;font-size:10px;color:var(--st-text-sec);">
              <div>💔<br>1❤️</div>
              <div>❤️<br>2❤️</div>
              <div>🧡<br>3❤️</div>
              <div>💛<br>4❤️</div>
              <div>💚<br>5❤️</div>
            </div>
            <p style="margin:10px 0 0 0;font-size:12px;color:var(--st-text-sec);">
              Каждая карточка получает от 1 до 5 сердечек в зависимости от Ease Factor. Прогресс — это средний процент заполнения сердечек по всем изученным карточкам.
            </p>
          </div>
        </div>

        <!-- Динамический план -->
        <div style="margin-bottom:24px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <span style="font-size:24px;">📅</span>
            <h3 style="margin:0;font-size:16px;color:#fff;">План обучения</h3>
          </div>
          <div style="background:rgba(46,196,182,0.1);border-left:3px solid var(--st-sec);padding:12px;border-radius:8px;">
            <p style="margin:0 0 10px 0;font-size:14px;color:var(--st-text);">
              Система показывает план на 4 дня вперед. Лимит карточек на каждый день рассчитывается динамически:
            </p>
            <ul style="margin:0;padding-left:20px;font-size:13px;color:var(--st-text-sec);line-height:1.6;">
              <li>Берется ваше время из настроек (например, 60 мин)</li>
              <li>Учитывается ваша реальная скорость прохождения (последние 50 карт)</li>
              <li><strong style="color:#fff;">Лимит = Время / Скорость</strong></li>
            </ul>
            <p style="margin:10px 0 0 0;font-size:12px;color:var(--st-text-sec);">
              Если вы отвечаете быстрее, лимит растет. Если медленнее — уменьшается. Все планы пересчитываются мгновенно при изменении настроек.
            </p>
          </div>
        </div>

        <!-- Прогноз -->
        <div style="margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <span style="font-size:24px;">🏁</span>
            <h3 style="margin:0;font-size:16px;color:#fff;">Прогноз завершения</h3>
          </div>
          <div style="background:rgba(155,163,175,0.1);border-left:3px solid var(--st-muted);padding:12px;border-radius:8px;">
            <p style="margin:0;font-size:14px;color:var(--st-text);">
              Дата, когда вы пройдете все карточки.
            </p>
            <p style="margin:8px 0 0 0;font-size:12px;color:var(--st-text-sec);">
              Рассчитывается на основе динамического дневного лимита. Вы можете ускорить дату, увеличив время в настройках или повысив скорость ответов.
            </p>
          </div>
        </div>

      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Закрытие по ESC
  const escHandler = () => { overlay.remove(); document.removeEventListener('keydown', escHandler); };
  document.addEventListener('keydown', escHandler);
};

// Модальное окно с информацией об уровнях и XP
window.openLevelInfoModal = () => {
  console.log('========================================');
  console.log('[OPENLEVELINFOMODAL] Функция вызвана!');
  console.log('[OPENLEVELINFOMODAL] Timestamp:', new Date().toISOString());
  console.log('[OPENLEVELINFOMODAL] location.hash:', location.hash);
  console.log('[OPENLEVELINFOMODAL] document.querySelector(".app-wrapper"):', document.querySelector('.app-wrapper'));
  console.log('[OPENLEVELINFOMODAL] document.querySelector(".sidebar"):', document.querySelector('.sidebar'));
  console.log('[OPENLEVELINFOMODAL] document.querySelector(".container"):', document.querySelector('.container'));

  // Проверяем есть ли стили STATS_STYLES в DOM
  const stylesInDom = document.querySelector('style');
  console.log('[OPENLEVELINFOMODAL] Первый style элемент:', stylesInDom);
  console.log('[OPENLEVELINFOMODAL] stylesInDom.textContent (первые 200 символов):', stylesInDom?.textContent?.substring(0, 200));

  // ДОБАВЛЯЕМ СТИЛИ ЕСЛИ ИХ НЕТ
  let styleEl = document.getElementById('stats-modal-styles');
  if (!styleEl) {
    console.log('[OPENLEVELINFOMODAL] Стили не найдены, добавляем STATS_STYLES...');
    styleEl = document.createElement('style');
    styleEl.id = 'stats-modal-styles';
    styleEl.textContent = STATS_STYLES;
    document.head.appendChild(styleEl);
    console.log('[OPENLEVELINFOMODAL] Стили добавлены!');
  } else {
    console.log('[OPENLEVELINFOMODAL] Стили уже есть в DOM');
  }

  const levelInfo = getCurrentLevel();
  const stats = getStudyStats();
  const daily = getDailyPointsAll();
  const streak = getStudyStreak();
  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  const studiedCount = Object.values(getProgressMap()).filter(p => p.lastReviewed).length;

  // Генерируем горизонтальный скролл уровней 1-20
  let levelsHorizontal = '';
  for (let lvl = 1; lvl <= 20; lvl++) {
    const prevXP = lvl === 1 ? 0 : Math.ceil(625 * Math.pow(lvl - 1, 2));
    const nextXP = Math.ceil(625 * Math.pow(lvl, 2));
    const isCurrent = lvl === levelInfo.level;
    const isPassed = lvl < levelInfo.level;
    const needed = nextXP - levelInfo.xp;
    const progress = levelInfo.xp >= nextXP ? 100 : levelInfo.xp <= prevXP ? 0 : Math.round(((levelInfo.xp - prevXP) / (nextXP - prevXP)) * 100);
    const icon = isPassed ? '✅' : isCurrent ? '👑' : '🔒';

    levelsHorizontal += `
      <div class="level-card${isCurrent ? ' current' : ''}" data-level="${lvl}">
        <div class="level-header">
          <div class="level-num">${lvl}</div>
          <div class="level-icon">${icon}</div>
        </div>
        <div class="level-range">${prevXP.toLocaleString()} → ${nextXP.toLocaleString()} XP</div>
        <div class="progress-label">${isPassed ? 'Пройдено' : isCurrent ? `${needed.toLocaleString()} XP до ${lvl + 1}` : 'Закрыто'}</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${isPassed ? '100%' : progress}%;background:${isPassed ? '#4CAF50' : 'linear-gradient(90deg,#FF9F1C,#FFB142)'}"></div>
        </div>
      </div>
    `;
  }

  const overlay = document.createElement('div');
  overlay.className = 'st-modal-overlay';
  // Принудительные стили для overlay
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.right = '0';
  overlay.style.bottom = '0';
  overlay.style.backgroundColor = 'rgba(0,0,0,0.7)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '9999';
  overlay.innerHTML = `
    <div class="st-modal" style="max-width:900px;max-height:75vh;overflow:hidden;display:flex;flex-direction:column;">
      <div class="st-modal-header" style="flex-shrink:0;">
        <div class="st-modal-title">🎯 Уровни и опыт</div>
        <button class="st-modal-close" onclick="this.closest('.st-modal-overlay').remove()">×</button>
      </div>
      <div class="st-modal-body" style="padding:20px;display:flex;flex-direction:column;gap:16px;flex:1;min-height:0;">

        <!-- ВЕРХНЯЯ СЕКЦИЯ: 3 блока в ряд -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;flex-shrink:0;">
          
          <!-- Блок 1: Текущий уровень -->
          <div class="card current-level-card" style="background:linear-gradient(135deg,rgba(255,159,28,0.2) 0%,rgba(255,159,28,0.05) 100%);border:2px solid var(--st-prim);border-radius:12px;padding:14px;">
            <div class="level-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              <div class="level-badge" style="font-size:24px;font-weight:800;color:var(--st-prim);">Уровень ${levelInfo.level}</div>
              <div class="xp-display" style="text-align:right;">
                <div class="xp-label" style="font-size:10px;color:var(--st-text-sec);">Всего XP</div>
                <div class="xp-value" style="font-size:20px;font-weight:700;">${levelInfo.xp.toLocaleString()}</div>
              </div>
            </div>
            <div class="progress-wrap" style="margin-bottom:12px;">
              <div class="progress-info" style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:11px;color:var(--st-text-sec);">
                <span>Прогресс до уровня ${levelInfo.level + 1}</span>
                <span style="color:var(--st-prim);font-weight:700;">${Math.round(levelInfo.progress * 100)}%</span>
              </div>
              <div class="progress-bg" style="height:8px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;">
                <div class="progress-fill" style="height:100%;background:linear-gradient(90deg,#FF9F1C,#FFB142);border-radius:4px;transition:width 0.5s;width:${Math.round(levelInfo.progress * 100)}%;"></div>
              </div>
            </div>
            <div class="level-stats" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.1);">
              <div class="stat-box" style="text-align:center;">
                <div class="stat-box-label" style="font-size:9px;color:var(--st-text-sec);text-transform:uppercase;margin-bottom:4px;">Осталось XP</div>
                <div class="stat-box-value" style="font-size:14px;font-weight:700;color:var(--st-prim);">${levelInfo.remaining.toLocaleString()}</div>
              </div>
              <div class="stat-box" style="text-align:center;">
                <div class="stat-box-label" style="font-size:9px;color:var(--st-text-sec);text-transform:uppercase;margin-bottom:4px;">След. уровень</div>
                <div class="stat-box-value" style="font-size:14px;font-weight:700;color:var(--st-prim);">${levelInfo.nextThreshold.toLocaleString()}</div>
              </div>
            </div>
          </div>

          <!-- Блок 2: Источники XP -->
          <div class="card" style="background:rgba(255,255,255,0.03);border:1px solid var(--st-border);border-radius:12px;padding:14px;">
            <div class="card-title" style="font-size:13px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
              <span>⚡</span> Как получить XP
            </div>
            <div class="xp-sources-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <div class="xp-source" style="background:rgba(255,255,255,0.05);padding:10px;border-radius:8px;text-align:center;border-left:3px solid var(--st-sec);">
                <div class="xp-source-icon" style="font-size:18px;margin-bottom:4px;">📚</div>
                <div class="xp-source-label" style="font-size:10px;color:var(--st-text-sec);margin-bottom:2px;">Изучение</div>
                <div class="xp-source-value" style="font-size:11px;font-weight:600;">+10 XP</div>
              </div>
              <div class="xp-source" style="background:rgba(255,255,255,0.05);padding:10px;border-radius:8px;text-align:center;border-left:3px solid var(--st-danger);">
                <div class="xp-source-icon" style="font-size:18px;margin-bottom:4px;">❤️</div>
                <div class="xp-source-label" style="font-size:10px;color:var(--st-text-sec);margin-bottom:2px;">Сердечки</div>
                <div class="xp-source-value" style="font-size:11px;font-weight:600;">+1-5 XP</div>
              </div>
              <div class="xp-source" style="background:rgba(255,255,255,0.05);padding:10px;border-radius:8px;text-align:center;border-left:3px solid var(--st-prim);">
                <div class="xp-source-icon" style="font-size:18px;margin-bottom:4px;">🔥</div>
                <div class="xp-source-label" style="font-size:10px;color:var(--st-text-sec);margin-bottom:2px;">Серия</div>
                <div class="xp-source-value" style="font-size:11px;font-weight:600;">Бонус</div>
              </div>
              <div class="xp-source" style="background:rgba(255,255,255,0.05);padding:10px;border-radius:8px;text-align:center;border-left:3px solid #A855F7;">
                <div class="xp-source-icon" style="font-size:18px;margin-bottom:4px;">🎯</div>
                <div class="xp-source-label" style="font-size:10px;color:var(--st-text-sec);margin-bottom:2px;">Точность</div>
                <div class="xp-source-value" style="font-size:11px;font-weight:600;">% бонус</div>
              </div>
            </div>
          </div>

          <!-- Блок 3: Статистика -->
          <div class="card" style="background:rgba(255,255,255,0.03);border:1px solid var(--st-border);border-radius:12px;padding:14px;">
            <div class="card-title" style="font-size:13px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
              <span>📊</span> Статистика
            </div>
            <div class="stats-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <div class="stat-item" style="background:rgba(255,255,255,0.05);padding:10px;border-radius:8px;text-align:center;">
                <div class="stat-icon" style="font-size:18px;margin-bottom:4px;">📚</div>
                <div class="stat-value" style="font-size:16px;font-weight:700;">${studiedCount}</div>
                <div class="stat-label" style="font-size:9px;color:var(--st-text-sec);margin-top:2px;">Извчено</div>
              </div>
              <div class="stat-item" style="background:rgba(255,255,255,0.05);padding:10px;border-radius:8px;text-align:center;">
                <div class="stat-icon" style="font-size:18px;margin-bottom:4px;">🎯</div>
                <div class="stat-value" style="font-size:16px;font-weight:700;">${accuracy}%</div>
                <div class="stat-label" style="font-size:9px;color:var(--st-text-sec);margin-top:2px;">Точность</div>
              </div>
              <div class="stat-item" style="background:rgba(255,255,255,0.05);padding:10px;border-radius:8px;text-align:center;">
                <div class="stat-icon" style="font-size:18px;margin-bottom:4px;">🔥</div>
                <div class="stat-value" style="font-size:16px;font-weight:700;">${streak.current || 0}</div>
                <div class="stat-label" style="font-size:9px;color:var(--st-text-sec);margin-top:2px;">Серия</div>
              </div>
              <div class="stat-item" style="background:rgba(255,255,255,0.05);padding:10px;border-radius:8px;text-align:center;">
                <div class="stat-icon" style="font-size:18px;margin-bottom:4px;">🏆</div>
                <div class="stat-value" style="font-size:16px;font-weight:700;color:var(--st-prim);">${streak.best || 0}</div>
                <div class="stat-label" style="font-size:9px;color:var(--st-text-sec);margin-top:2px;">Лучшая</div>
              </div>
            </div>
          </div>

        </div>

        <!-- НИЖНЯЯ СЕКЦИЯ: Уровни 1-20 -->
        <div style="flex:1;min-height:0;display:flex;flex-direction:column;">
          <div class="levels-section" style="background:rgba(255,255,255,0.03);border:1px solid var(--st-border);border-radius:12px;padding:14px;display:flex;flex-direction:column;flex:1;min-height:0;">
            <div class="levels-title" style="font-size:13px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
              <span>🏆</span> Уровни 1-20
            </div>
            <div class="levels-horizontal" id="levelsScroll" style="display:flex;gap:8px;overflow-x:auto;padding:8px 4px;scroll-behavior:smooth;flex:1;min-height:0;">
              ${levelsHorizontal}
            </div>
            <div class="levels-nav" style="display:flex;gap:8px;margin-top:8px;flex-shrink:0;">
              <button class="levels-nav-btn" onclick="document.getElementById('levelsScroll').scrollBy({left:-200,behavior:'smooth'})" style="flex:1;background:rgba(255,255,255,0.05);border:1px solid var(--st-border);color:var(--st-text);padding:8px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;transition:all 0.2s;">← Назад</button>
              <button class="levels-nav-btn" onclick="document.getElementById('levelsScroll').scrollBy({left:200,behavior:'smooth'})" style="flex:1;background:rgba(255,255,255,0.05);border:1px solid var(--st-border);color:var(--st-text);padding:8px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;transition:all 0.2s;">Вперед →</button>
            </div>
          </div>
        </div>

        <!-- Кнопка -->
        <button onclick="document.querySelector('.st-modal-overlay')?.remove();window.startDailySession()" class="start-btn" style="background:var(--st-prim);color:#000;border:none;padding:12px;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;transition:all 0.2s;margin-top:12px;flex-shrink:0;">▶ Начать учиться</button>

      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  console.log('[OPENLEVELINFOMODAL] Модальное окно создано и добавлено в DOM!');
  console.log('[OPENLEVELINFOMODAL] overlay element:', overlay);
  console.log('[OPENLEVELINFOMODAL] overlay.style:', overlay.style);
  console.log('[OPENLEVELINFOMODAL] overlay.className:', overlay.className);
  console.log('[OPENLEVELINFOMODAL] getComputedStyle(overlay):', window.getComputedStyle(overlay));
  console.log('[OPENLEVELINFOMODAL] overlay.children[0]:', overlay.children[0]);
  console.log('[OPENLEVELINFOMODAL] overlay.children[0].className:', overlay.children[0]?.className);
  console.log('[OPENLEVELINFOMODAL] getComputedStyle(modal):', overlay.children[0] ? window.getComputedStyle(overlay.children[0]) : 'N/A');
  console.log('========================================');

  // Закрытие по ESC
  const escHandler = () => { overlay.remove(); document.removeEventListener('keydown', escHandler); };
  document.addEventListener('keydown', escHandler);
};

function getHeartsForEf(ef) {
  if (ef === undefined || ef === null) return '🆕'; // New cards
  if (ef < 1.7) return '❤️🤍🤍🤍🤍';
  if (ef < 2.1) return '❤️❤️🤍🤍🤍';
  if (ef < 2.4) return '❤️❤️❤️🤍🤍';
  if (ef < 2.9) return '❤️❤️❤️❤️🤍';
  return '❤️❤️❤️❤️❤️';
}

// Функция для получения количества сердечек по EF (для SVG)
function getHeartsCountForEf(ef) {
  if (ef === undefined || ef === null) return 0;
  if (ef >= 2.4) return 5;      // EASY
  if (ef >= 2.1) return 4;      // STANDARD
  if (ef >= 1.7) return 3;      // HARD
  return 1;                      // VERY HARD
}

// Функция для получения процента заполнения для каждого сердечка (0-100%)
function getHeartFillPercentages(ef) {
  const fills = [];
  if (ef === undefined || ef === null) {
    return [0, 0, 0, 0, 0];
  }

  // EF range: 1.3 (min) to 2.9 (max) = 1.6 range
  // 5 hearts, so each heart = 0.32 EF range
  // Heart 1: 1.3-1.62, Heart 2: 1.62-1.94, Heart 3: 1.94-2.26, Heart 4: 2.26-2.58, Heart 5: 2.58-2.9

  const minEF = 1.3;
  const maxEF = 2.9;
  const heartRange = (maxEF - minEF) / 5; // 0.32

  for (let i = 0; i < 5; i++) {
    const heartMin = minEF + (i * heartRange);
    const heartMax = minEF + ((i + 1) * heartRange);

    if (ef >= heartMax) {
      fills.push(100);
    } else if (ef <= heartMin) {
      fills.push(0);
    } else {
      // Partial fill
      const percent = ((ef - heartMin) / heartRange) * 100;
      fills.push(Math.round(percent));
    }
  }

  return fills;
}

// Функция для генерации SVG сердечек с плавным градиентом
function renderHeartsSvg(fillPercentages, prefix) {
  let svg = '';
  // Если передано число (для обратной совместимости), конвертируем в массив
  if (typeof fillPercentages === 'number') {
    const count = fillPercentages;
    fillPercentages = [];
    for (let i = 0; i < 5; i++) {
      fillPercentages.push(i < count ? 100 : 0);
    }
  }

  for (let i = 0; i < 5; i++) {
    const fillPercent = fillPercentages[i] || 0;
    svg += `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" style="display:inline-block;vertical-align:middle;"><defs><linearGradient id="${prefix}-grad-${i + 1}"><stop offset="${fillPercent}%" stop-color="#ff4d4d"/><stop offset="${fillPercent}%" stop-color="#444"/></linearGradient></defs><path fill="url(#${prefix}-grad-${i + 1})" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
  }
  return svg;
}

// Модальное окно для графика активности
window.openChartModal = () => {
  const overlay = document.createElement('div');
  overlay.className = 'st-modal-overlay';
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 0.3s ease';
  overlay.innerHTML = `
    <div class="st-modal" style="max-width:80%;width:80%;height:80vh;transform:scale(0.95);transition:transform 0.3s ease;">
       <div class="st-modal-header">
          <div class="st-modal-title">📈 График активности</div>
          <button class="st-modal-close" onclick="window.closeChartModal()">×</button>
       </div>
       <div class="st-modal-body" style="padding:24px;height:calc(80vh - 80px);display:flex;flex-direction:column;">
          <div class="activity-card" style="height:100%;width:100%;transform:none;box-shadow:none;display:flex;flex-direction:column;">
            <div class="activity-header" style="flex-shrink:0;">
              <div class="period-switch">
                <div class="week-btn" onclick="window.changeModalXpMode('week')">Неделя</div>
                <div class="month-btn" onclick="window.changeModalXpMode('month')">Месяц</div>
                <div class="year-btn" onclick="window.changeModalXpMode('year')">Год</div>
              </div>
              <div class="month-switch"><span id="st-modal-month-label"></span></div>
            </div>
            <div class="chart-wrapper" style="flex:1;height:auto;min-height:0;">
              <svg class="chart" id="st-modal-activity-chart" style="width:100%;height:100%;"></svg>
              <div id="st-modal-tooltip" class="tooltip"></div>
            </div>
          </div>
       </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Плавное появление
  setTimeout(() => {
    overlay.style.opacity = '1';
    overlay.querySelector('.st-modal').style.transform = 'scale(1)';
  }, 10);

  // Закрытие по клику на фон
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      window.closeChartModal();
    }
  });

  // Закрытие по Escape
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      window.closeChartModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  // Сохраняем ссылку на overlay для закрытия
  window.chartModalOverlay = overlay;

  // Клонируем и увеличиваем график
  setTimeout(() => {
    window.renderModalChart();
  }, 100);
};

// Закрытие модального окна
window.closeChartModal = () => {
  const overlay = window.chartModalOverlay;
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.querySelector('.st-modal').style.transform = 'scale(0.95)';
    setTimeout(() => {
      overlay.remove();
      window.chartModalOverlay = null;
    }, 300);
  }
};

// Переключение режима в модальном окне
window.modalXpMode = 'week';
window.changeModalXpMode = (mode) => {
  window.modalXpMode = mode;
  window.renderModalChart();
};

// Рендер графика в модальном окне (копия renderActivityChart с увеличенными параметрами)
window.renderModalChart = () => {
  const mode = window.modalXpMode;
  const data = window.getXpSeriesForModal(mode);

  console.log('[MODAL.CHART] Рендерим график, режим:', mode, 'данных:', data.length);

  // Обновляем активную кнопку
  document.querySelectorAll('.week-btn, .month-btn, .year-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`.${mode}-btn`)?.classList.add('active');

  // Обновляем лейбл месяца
  const originalLabel = document.getElementById('st-month-label');
  const modalLabel = document.getElementById('st-modal-month-label');
  if (originalLabel && modalLabel) {
    modalLabel.textContent = originalLabel.textContent;
  }

  // Рисуем увеличенный график
  const svg = document.getElementById('st-modal-activity-chart');
  if (!svg) {
    console.error('[MODAL.CHART] SVG не найден!');
    return;
  }

  // Небольшая задержка чтобы flex-layout успел примениться
  requestAnimationFrame(() => {
    const width = svg.clientWidth || 800;
    const height = svg.clientHeight || 400;
    const padding = { top: 20, right: 30, bottom: 40, left: 50 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    // Увеличенные параметры (как в оригинале)
    const cfg = mode === 'week' ? { bar: 28, gap: 8, count: 14, labelStep: 2 }
      : (mode === 'month' ? { bar: 20, gap: 6, count: data.length, labelStep: 1 }
        : { bar: 46, gap: 28, count: 12, labelStep: 2 });

    const barWidth = cfg.bar;
    const gap = mode === 'year' ? cfg.gap : (innerWidth - (cfg.bar * data.length)) / (data.length + 1);
    const fontSize = 14;

    // Находим максимум
    const maxValue = Math.max(...data.map(d => (d.cards || 0) + (d.hearts || 0)), 1);

    // Градиенты
    const toRgb = (hex) => { const h = hex.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
    const lerp = (a, b, t) => Math.round(a + (b - a) * t);
    const lerpHex = (h1, h2, t) => { const [r1, g1, b1] = toRgb(h1), [r2, g2, b2] = toRgb(h2); const r = lerp(r1, r2, t).toString(16).padStart(2, '0'); const g = lerp(g1, g2, t).toString(16).padStart(2, '0'); const b = lerp(b1, b2, t).toString(16).padStart(2, '0'); return `#${r}${g}${b}`; };
    const redDark = '#8B0000'; const redBright = '#FF3B3B';
    const orangeDark = '#B45309'; const orangeBright = '#FF9F1C';

    // Генерируем SVG
    let defs = '';
    let content = '';
    let bars = '';

    // Сетка
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (innerHeight / 4) * i;
      content += `<line class="chart-grid-line" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"/>`;
      const value = Math.round(maxValue - (maxValue / 4) * i);
      content += `<text class="chart-label" x="${padding.left - 10}" y="${y + 4}" text-anchor="end" font-size="${fontSize}">${value}</text>`;
    }

    // Бары
    const minBarH = 4;
    const zeroBarH = 1;
    let x = padding.left + gap;
    data.forEach((d, idx) => {
      const cardsVal = d.cards || 0;
      const heartsVal = d.hearts || 0;

      // Тёмный плейсхолдер-тень на полную высоту (один на весь столбик)
      const placeholderRx = Math.min(Math.round(barWidth / 2), Math.max(1, Math.round(innerHeight / 2)));
      const pathPlaceholder = `M ${x} ${padding.top + innerHeight} L ${x} ${padding.top + placeholderRx} Q ${x} ${padding.top} ${x + placeholderRx} ${padding.top} L ${x + barWidth - placeholderRx} ${padding.top} Q ${x + barWidth} ${padding.top} ${x + barWidth} ${padding.top + placeholderRx} L ${x + barWidth} ${padding.top + innerHeight} Z`;
      bars += `<path class="bar-placeholder" d="${pathPlaceholder}" fill="rgba(0,0,0,0.12)" style="pointer-events:none"/>`;

      const narrowBarW = Math.round(barWidth * 0.4);
      const heartsX = x + Math.round((barWidth - narrowBarW) / 2);

      // Cards (оранжевый, широкий)
      if (cardsVal > 0) {
        const cardsH = Math.max(minBarH, (innerHeight / maxValue) * cardsVal);
        const yCards = padding.top + innerHeight - cardsH;
        const tCards = Math.max(0, Math.min(1, cardsVal / maxValue));
        const topOrange = lerpHex(orangeDark, orangeBright, tCards);
        defs += `<linearGradient id="modal-go${idx}" gradientUnits="userSpaceOnUse" x1="0" y1="${padding.top + innerHeight}" x2="0" y2="${padding.top}"><stop offset="0%" stop-color="${orangeDark}"/><stop offset="100%" stop-color="${topOrange}"/></linearGradient>`;
        const rx = Math.min(Math.round(barWidth / 2), Math.max(1, Math.round(cardsH / 2)));
        const pathCards = `M ${x} ${padding.top + innerHeight} L ${x} ${yCards + rx} Q ${x} ${yCards} ${x + rx} ${yCards} L ${x + barWidth - rx} ${yCards} Q ${x + barWidth} ${yCards} ${x + barWidth} ${yCards + rx} L ${x + barWidth} ${padding.top + innerHeight} Z`;
        bars += `<path class="bar-cards" d="${pathCards}" data-type="cards" data-date="${d.date}" data-hearts="${heartsVal}" data-cards="${cardsVal}" fill="url(#modal-go${idx})" style="cursor:pointer" opacity="0.9"/>`;
      } else {
        defs += `<linearGradient id="modal-go${idx}" gradientUnits="userSpaceOnUse" x1="0" y1="${padding.top + innerHeight}" x2="0" y2="${padding.top}"><stop offset="0%" stop-color="${orangeDark}"/><stop offset="100%" stop-color="${orangeDark}"/></linearGradient>`;
        const yZero = padding.top + innerHeight - zeroBarH;
        bars += `<rect class="bar-cards" x="${x}" y="${yZero}" width="${barWidth}" height="${zeroBarH}" data-type="cards" data-date="${d.date}" data-hearts="${heartsVal}" data-cards="0" fill="url(#modal-go${idx})" style="cursor:pointer" opacity="0.15"/>`;
      }

      // Hearts (красный, узкий, по центру) — narrowBarW и heartsX уже объявлены выше
      if (heartsVal > 0) {
        const heartsH = Math.max(minBarH, (innerHeight / maxValue) * heartsVal);
        const yHearts = padding.top + innerHeight - heartsH;
        const tHearts = Math.max(0, Math.min(1, heartsVal / maxValue));
        const topRed = lerpHex(redDark, redBright, tHearts);
        defs += `<linearGradient id="modal-gh${idx}" gradientUnits="userSpaceOnUse" x1="0" y1="${padding.top + innerHeight}" x2="0" y2="${padding.top}"><stop offset="0%" stop-color="${redDark}"/><stop offset="100%" stop-color="${topRed}"/></linearGradient>`;
        const rx = Math.min(Math.round(narrowBarW / 2), Math.max(1, Math.round(heartsH / 2)));
        const pathHearts = `M ${heartsX} ${padding.top + innerHeight} L ${heartsX} ${yHearts + rx} Q ${heartsX} ${yHearts} ${heartsX + rx} ${yHearts} L ${heartsX + narrowBarW - rx} ${yHearts} Q ${heartsX + narrowBarW} ${yHearts} ${heartsX + narrowBarW} ${yHearts + rx} L ${heartsX + narrowBarW} ${padding.top + innerHeight} Z`;
        bars += `<path class="bar-hearts" d="${pathHearts}" data-type="hearts" data-date="${d.date}" data-hearts="${heartsVal}" data-cards="${cardsVal}" fill="url(#modal-gh${idx})" style="cursor:pointer" opacity="1"/>`;
      } else {
        defs += `<linearGradient id="modal-gh${idx}" gradientUnits="userSpaceOnUse" x1="0" y1="${padding.top + innerHeight}" x2="0" y2="${padding.top}"><stop offset="0%" stop-color="${redDark}"/><stop offset="100%" stop-color="${redDark}"/></linearGradient>`;
        const yZero = padding.top + innerHeight - zeroBarH;
        bars += `<rect class="bar-hearts" x="${heartsX}" y="${yZero}" width="${narrowBarW}" height="${zeroBarH}" data-type="hearts" data-date="${d.date}" data-hearts="${heartsVal}" data-cards="${cardsVal}" fill="url(#modal-gh${idx})" style="cursor:pointer" opacity="0.1"/>`;
      }

      // Подпись
      const labelOk = mode === 'year' ? true : (idx % cfg.labelStep === 0);
      if (labelOk) {
        bars += `<text class="chart-label" x="${x + barWidth / 2}" y="${height - padding.bottom + 20}" text-anchor="middle" font-size="${fontSize}">${d.label}</text>`;
      }

      x += barWidth + gap;
    });

    // Прозрачный overlay для отслеживания мыши по всей области графика
    bars += `<rect class="chart-overlay" x="${padding.left}" y="${padding.top}" width="${innerWidth}" height="${innerHeight}" fill="transparent" style="cursor:default"/>`;
    defs += `<linearGradient id="ghost-grad" gradientUnits="userSpaceOnUse" x1="0" y1="${padding.top + innerHeight}" x2="0" y2="${padding.top}"><stop offset="0%" stop-color="rgba(255,255,255,0.12)"/><stop offset="100%" stop-color="rgba(255,255,255,0.06)"/></linearGradient>`;
    const ghostRx = Math.round(barWidth / 2);
    const ghostBarSVG = `<path class="ghost-bar" d="M 0 ${padding.top + innerHeight} L 0 ${padding.top + ghostRx} Q 0 ${padding.top} ${ghostRx} ${padding.top} L ${barWidth - ghostRx} ${padding.top} Q ${barWidth} ${padding.top} ${barWidth} ${padding.top + ghostRx} L ${barWidth} ${padding.top + innerHeight} Z" fill="url(#ghost-grad)" opacity="0" style="pointer-events:none;"/>`;
    svg.innerHTML = `<defs>${defs}</defs>${content}${bars}${ghostBarSVG}`;

    // Tooltip — рядом с курсором
    const tooltip = document.getElementById('st-modal-tooltip');
    const tooltipW = 160;
    const overlay = svg.querySelector('.chart-overlay');
    const ghostBar = svg.querySelector('.ghost-bar');

    // Функции подсветки реальных столбиков
    let highlightedBars = [];
    function highlightBars(idx) {
      clearBarHighlight();
      const date = data[idx].date;
      svg.querySelectorAll(`[data-date="${date}"]`).forEach(el => {
        el.style.filter = 'brightness(1.3)';
        highlightedBars.push(el);
      });
    }
    function clearBarHighlight() {
      highlightedBars.forEach(el => { el.style.filter = ''; });
      highlightedBars = [];
    }

    overlay.addEventListener('mousemove', (e) => {
      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      // Масштабирование координат из экрана в viewBox
      const scaleX = width / rect.width;
      const viewBoxX = mouseX * scaleX;
      // Определяем индекс дня по X (учитываем начальный gap: x начинается с padding.left + gap)
      const dayIdx = Math.floor((viewBoxX - padding.left - gap) / (barWidth + gap));
      if (dayIdx < 0 || dayIdx >= data.length) { tooltip.style.display = 'none'; ghostBar.setAttribute('opacity', '0'); clearBarHighlight(); return; }
      // Проверяем что курсор в зоне столбика (а не в gap между столбиками)
      // x начинается с padding.left + gap, затем каждый bar сдвигается на barWidth + gap
      const barStartX = padding.left + gap + dayIdx * (barWidth + gap);
      const barEndX = barStartX + barWidth;
      if (viewBoxX < barStartX || viewBoxX > barEndX) { tooltip.style.display = 'none'; ghostBar.setAttribute('opacity', '0'); clearBarHighlight(); return; }

      // Подсвечиваем реальные столбики этого дня
      highlightBars(dayIdx);

      // Показываем призрачный столбик
      const gRx = Math.round(barWidth / 2);
      const ghostPath = `M ${barStartX} ${padding.top + innerHeight} L ${barStartX} ${padding.top + gRx} Q ${barStartX} ${padding.top} ${barStartX + gRx} ${padding.top} L ${barStartX + barWidth - gRx} ${padding.top} Q ${barStartX + barWidth} ${padding.top} ${barStartX + barWidth} ${padding.top + gRx} L ${barStartX + barWidth} ${padding.top + innerHeight} Z`;
      ghostBar.setAttribute('d', ghostPath);
      ghostBar.setAttribute('opacity', '1');

      const d = data[dayIdx];

      // Определяем на какую часть столбика наведён курсор
      const cardsH = d.cards > 0 ? Math.max(4, (innerHeight / maxValue) * d.cards) : 0;
      const heartsH = d.hearts > 0 ? Math.max(4, (innerHeight / maxValue) * d.hearts) : 0;
      const narrowBarW = Math.round(barWidth * 0.4);
      const heartsX = barStartX + Math.round((barWidth - narrowBarW) / 2);
      const cardsTopY = padding.top + innerHeight - cardsH;
      const heartsTopY = padding.top + innerHeight - heartsH;

      // Масштабируем Y курсора в viewBox
      const scaleY = innerHeight / rect.height;
      const viewBoxY = padding.top + (e.clientY - rect.top) * scaleY;

      let typeLabel;
      const inHeartsX = viewBoxX >= heartsX && viewBoxX <= heartsX + narrowBarW;
      const inHeartsY = viewBoxY >= heartsTopY && viewBoxY <= padding.top + innerHeight;
      const inCardsY = viewBoxY >= cardsTopY && viewBoxY <= padding.top + innerHeight;

      if (inHeartsX && inHeartsY && heartsH > 0) {
        typeLabel = 'Сердечки (красный)';
      } else if (inCardsY && cardsH > 0) {
        typeLabel = 'Карточки (оранжевый)';
      } else if (inHeartsX && heartsH > 0) {
        typeLabel = 'Сердечки (красный)';
      } else if (cardsH > 0) {
        typeLabel = 'Карточки (оранжевый)';
      } else if (heartsH > 0) {
        typeLabel = 'Сердечки (красный)';
      } else {
        // Нулевой столбик — всё равно показываем
        typeLabel = 'Нет данных';
      }

      tooltip.innerHTML = `
        <div style="font-weight:700">${new Date(d.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</div>
        <div style="margin:4px 0;color:#fff;font-weight:600">${typeLabel}</div>
        <div>❤️: ${d.hearts || 0}</div>
        <div>📚: ${d.cards || 0}</div>
        <div class="tip-arrow"></div>
      `;
      tooltip.style.display = 'block';
      tooltip.style.width = `${tooltipW}px`;
      // Позиционируем рядом с курсором
      const spaceRight = rect.width - mouseX;
      let tipLeft, tipTop;
      if (spaceRight >= tooltipW + 10) {
        tipLeft = mouseX + 10;
        tooltip.querySelector('.tip-arrow').style.cssText = 'position:absolute;top:10px;left:-6px;width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-right:6px solid var(--st-surf-h);border-left:none;';
      } else {
        tipLeft = mouseX - tooltipW - 10;
        tooltip.querySelector('.tip-arrow').style.cssText = 'position:absolute;top:10px;right:-6px;width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-left:6px solid var(--st-surf-h);border-right:none;';
      }
      tipTop = e.clientY - rect.top - 10;
      tooltip.style.left = `${tipLeft}px`;
      tooltip.style.top = `${tipTop}px`;
    });
    overlay.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; ghostBar.setAttribute('opacity', '0'); clearBarHighlight(); });
    // Убираем pointer-events с баров (overlay перехватывает события)
    svg.querySelectorAll('.bar-hearts,.bar-cards').forEach(el => {
      el.style.pointerEvents = 'none';
    });
  });
};

// Получение данных для модального окна (полная копия getActivitySeries)
window.getXpSeriesForModal = (mode) => {
  // Используем локальное время устройства
  const getLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Используем функции из stats-utils
  const daily = typeof getDailyPointsAll === 'function' ? getDailyPointsAll() : [];
  const imp = typeof getDailyImprovements === 'function' ? getDailyImprovements(400) : [];
  const impMap = new Map(imp.map(d => [d.date, d]));
  const today = new Date();

  console.log('[MODAL.DATA] daily:', daily.length, 'imp:', imp.length);

  if (mode === 'year') {
    // 12 месяцев
    const res = [];
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
        hearts += getDailyHearts(s);
        cards += im ? (im.reviewed || 0) : 0;
      }
      res.push({
        date: getMSKDate(new Date(y, m, 1)),
        label: new Date(y, m, 1).toLocaleString('ru-RU', { month: 'short' }),
        xp,
        hearts,
        cards
      });
    }
    console.log('[MODAL.DATA] Year:', res);
    return res;
  }

  // Неделя (14 дней) или Месяц (все дни текущего месяца)
  const res = [];

  if (mode === 'month') {
    // Для месяца: все дни текущего месяца с 1-го числа
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const s = getMSKDate(d);
      const entry = daily.find(x => x.date === s) || { xp: 0, bonus: 0, dayBonus: 0 };
      const im = impMap.get(s);
      res.push({
        date: s,
        label: d.getDate().toString(),
        xp: entry.xp,
        hearts: getDailyHearts(s),
        cards: im ? im.reviewed : 0
      });
    }
    console.log('[MODAL.DATA] Month:', res);
    return res;
  }

  // Неделя (14 дней)
  const days = 14;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const s = getMSKDate(d);
    const entry = daily.find(x => x.date === s) || { xp: 0, bonus: 0, dayBonus: 0 };
    const im = impMap.get(s);
    const hearts = getDailyHearts(s);

    res.push({
      date: s,
      label: d.toLocaleDateString('ru-RU', { day: 'numeric' }),
      xp: entry.xp,
      hearts: hearts,
      cards: im ? im.reviewed : 0
    });
  }

  console.log('[MODAL.DATA] 📊 CHART DATA (last 3 days):', res.slice(-3).map(r =>
    `date=${r.date}, xp=${r.xp}, hearts=${r.hearts}, cards=${r.cards}`
  ));

  console.log('[MODAL.DATA] Week/Month:', res.slice(0, 5));
  return res;
};

window.openDiffModal = (index) => {
  console.log('[openDiffModal] Called with index:', index);
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
             ${list.map((q, idx) => {
    const p = prog[q.question] || prog[q.question.trim()];
    const ef = p ? p.easeFactor : undefined;
    const heartFills = getHeartFillPercentages(ef);
    const heartsSvg = renderHeartsSvg(heartFills, 'modal-' + idx);
    const isFav = favorites.has(q.question);

    // Применяем форматирование к вопросу и ответу
    const questionFormatting = q.formatting?.question || [];
    const answerFormatting = q.formatting?.answer || [];
    const questionHTML = applyFormatting(q.question, questionFormatting);
    const answerPreview = q.answer.substring(0, 80) + (q.answer.length > 80 ? '...' : '');
    const answerHTML = applyFormatting(answerPreview, answerFormatting);

    return `
                <li class="st-modal-item">
                   <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px">
                       <span class="st-modal-q" style="flex:1; padding-right:8px; font-weight:600; color:#fff">${questionHTML}</span>
                       <div style="display:flex; gap:6px; align-items:center; flex-shrink:0; font-size:12px">
                          <span title="EF: ${ef ? ef.toFixed(2) : 'N/A'}">${heartsSvg}</span>
                          ${isFav ? '<span style="color:#ffd700; font-size:14px">★</span>' : ''}
                       </div>
                   </div>
                   <div class="st-modal-a" style="font-size:13px; color:var(--st-text-sec)">${answerHTML}</div>
                </li>
                `;
  }).join('')}
          </ul>
       </div>
       <div class="st-modal-footer">
          <button class="st-modal-btn" onclick="window.startFilteredSession('${index}')">Тренировать эту группу</button>
       </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0,0,0,0.5)';
  overlay.style.zIndex = '2200';
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.backdropFilter = 'blur(3px)';
  overlay.style.webkitBackdropFilter = 'blur(3px)';

  // Закрытие по ESC
  const escHandler = () => { overlay.remove(); document.removeEventListener('keydown', escHandler); };
  document.addEventListener('keydown', escHandler);
};

// Модальное окно для категории
window.openCategoryModal = (categoryName) => {
  const currentCards = getCurrentCards();
  const progress = getProgressMap();
  const favorites = new Set(JSON.parse(localStorage.getItem('qaFavorites') || '[]'));

  // Фильтруем карточки по категории
  let list = currentCards.filter(q => q.category === categoryName);

  // Сортируем по прогрессу (сначала трудные/сначала лёгкие) - по возрастанию EF
  list.sort((a, b) => {
    const pA = progress[a.question] || progress[a.question.trim()];
    const pB = progress[b.question] || progress[b.question.trim()];
    const efA = pA ? pA.easeFactor : 0;
    const efB = pB ? pB.easeFactor : 0;
    return efA - efB; // Сначала трудные (низкий EF)
  });

  // Считаем проценты
  const total = list.length;
  let heartsFilled = 0;
  list.forEach(q => {
    const p = progress[q.question] || progress[q.question.trim()];
    if (p && p.easeFactor !== undefined) {
      heartsFilled += getHeartsCountForEf(p.easeFactor);
    }
  });
  const maxHearts = total * 5;
  const percentage = maxHearts > 0 ? Math.round((heartsFilled / maxHearts) * 100) : 0;

  console.log('[openCategoryModal] Категория:', categoryName, 'Карточек:', list.length);

  const overlay = document.createElement('div');
  overlay.className = 'st-modal-overlay';
  overlay.innerHTML = `
    <div class="st-modal">
       <div class="st-modal-header">
          <div class="st-modal-title">${categoryName} (${list.length}) - ${percentage}%</div>
          <button class="st-modal-close" onclick="this.closest('.st-modal-overlay').remove()">×</button>
       </div>
       <div class="st-modal-body">
          <ul class="st-modal-list">
             ${list.map((q, idx) => {
    const p = progress[q.question] || progress[q.question.trim()];
    const ef = p ? p.easeFactor : undefined;
    const heartFills = getHeartFillPercentages(ef);
    const heartsSvg = renderHeartsSvg(heartFills, 'cat-' + idx);
    const isFav = favorites.has(q.question);

    // Применяем форматирование к вопросу и ответу
    const questionFormatting = q.formatting?.question || [];
    const answerFormatting = q.formatting?.answer || [];
    const questionHTML = applyFormatting(q.question, questionFormatting);
    const answerPreview = q.answer.substring(0, 80) + (q.answer.length > 80 ? '...' : '');
    const answerHTML = applyFormatting(answerPreview, answerFormatting);

    return `
                <li class="st-modal-item">
                   <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px">
                       <span class="st-modal-q" style="flex:1; padding-right:8px; font-weight:600; color:#fff">${questionHTML}</span>
                       <div style="display:flex; gap:6px; align-items:center; flex-shrink:0; font-size:12px">
                          <span title="EF: ${ef ? ef.toFixed(2) : 'N/A'}">${heartsSvg}</span>
                          ${isFav ? '<span style="color:#ffd700; font-size:14px">★</span>' : ''}
                       </div>
                   </div>
                   <div class="st-modal-a" style="font-size:13px; color:var(--st-text-sec)">${answerHTML}</div>
                </li>
                `;
  }).join('')}
          </ul>
       </div>
       <div class="st-modal-footer">
          <button class="st-modal-btn" onclick="window.startCategorySession('${categoryName.replace(/'/g, "\\'")}')">Тренировать эту категорию</button>
       </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0,0,0,0.5)';
  overlay.style.zIndex = '2200';
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.backdropFilter = 'blur(3px)';
  overlay.style.webkitBackdropFilter = 'blur(3px)';

  // Закрытие по ESC
  const escHandler = () => { overlay.remove(); document.removeEventListener('keydown', escHandler); };
  document.addEventListener('keydown', escHandler);
};

// Сворачивание/разворачивание списка категорий
window.toggleCategoryList = () => {
  const list = document.getElementById('st-cat-progress-list');
  const icon = document.querySelector('.st-cat-toggle-icon');

  if (!list) return;

  const isCollapsed = list.classList.contains('collapsed');

  // Переключаем состояние
  if (isCollapsed) {
    // Разворачиваем
    list.classList.remove('collapsed');
    list.classList.add('expanded');
    if (icon) icon.classList.remove('collapsed');
  } else {
    // Сворачиваем
    list.classList.add('collapsed');
    list.classList.remove('expanded');
    if (icon) icon.classList.add('collapsed');
  }
};

window.startCategorySession = (categoryName) => {
  document.querySelector('.st-modal-overlay')?.remove();

  const currentCards = getCurrentCards();
  const cards = currentCards.filter(q => q.category === categoryName);

  console.log('[startCategorySession] Категория:', categoryName, 'Карточек:', cards.length);

  if (cards.length === 0) {
    alert('Нет карт в этой категории');
    return;
  }

  hideStatsPage();
  startLearnSession(cards, { mode: 'cram' });
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
    alert('Нет карт в ��той категории');
    return;
  }

  // Очищаем состояние обучения ПЕРЕД запуском нового
  if (window.__lastCandidates) {
    window.__lastCandidates = null;
    console.log('[startFilteredSession] Cleared __lastCandidates');
  }

  // Сбрасываем флаг навигац��и
  window.__navigatingToHome = false;
  console.log('[startFilteredSession] Set __navigatingToHome = false');

  hideStatsPage();
  startLearnSession(cards, { mode: 'cram' });
};

window.startRiskSession = (catName) => {
  const currentCards = getCurrentCards();
  const riskZones = getRiskZones(currentCards);
  const zone = riskZones.find(z => z.cat === catName);
  if (!zone || !zone.items || zone.items.length === 0) return;

  // Очищаем состояние обучения ПЕРЕД запуском нового
  if (window.__lastCandidates) {
    window.__lastCandidates = null;
    console.log('[startRiskSession] Cleared __lastCandidates');
  }

  // Сбрасываем флаг навигации
  window.__navigatingToHome = false;
  console.log('[startRiskSession] Set __navigatingToHome = false');

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

  } else if (modeId === 'marathon') {
    // Марафон - все карточки подряд
    const valid = uniqueQaData.filter(q => q && q.question && q.answer);
    if (valid.length === 0) {
      alert('Нет доступных карточек');
      return;
    }
    candidates = [...valid];
    options.mode = 'marathon';

  } else if (modeId === 'fast_track') {
    // Fast Track - случайные 10 вопросов
    const valid = uniqueQaData.filter(q => q && q.question && q.answer);
    if (valid.length === 0) {
      alert('Нет доступных карточек');
      return;
    }
    candidates = [...valid].sort(() => 0.5 - Math.random()).slice(0, 10);
    options.mode = 'fast_track';
  }

  if (candidates.length > 0) {
    // Очищаем состояние обучения ПЕРЕД запуском нового
    if (window.__lastCandidates) {
      window.__lastCandidates = null;
      console.log('[startMode] Cleared __lastCandidates');
    }
    // Сбрасываем флаг навигации
    window.__navigatingToHome = false;
    console.log('[startMode] Set __navigatingToHome = false');
    hideStatsPage();
    startLearnSession(candidates, options);
  }
};

// Global function for clearing marathon progress with confirmation
window.clearMarathonProgress = () => {
  if (confirm('Сбросить прогресс марафона? Вы начнёте с начала.')) {
    clearMarathonProgress();
    // Re-render stats page to update UI
    renderStats();
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
  const countSpan = document.getElementById('st-cat-count');
  if (!container) return;

  // Показываем счётчик категорий
  if (countSpan) {
    countSpan.textContent = `(${categoryProgress.length})`;
  }

  // Определяем начальное состояние
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    container.classList.add('collapsed'); // Свёрнуто на мобильных
    container.classList.remove('expanded');
  } else {
    container.classList.remove('collapsed'); // Развёрнуто на десктопе
    container.classList.add('expanded');
  }

  container.innerHTML = categoryProgress.map(cat => `
        <div class="st-cat-progress-item" onclick="window.openCategoryModal('${cat.name.replace(/'/g, "\\'")}')" style="cursor:pointer" title="Нажмите для просмотра карточек">
            <div class="st-cat-progress-header">
                <span class="st-cat-progress-name">${cat.name}</span>
                <span class="st-cat-progress-value">${cat.percentage}% (${cat.total})</span>
            </div>
            <div class="st-cat-progress-track">
                <div class="st-cat-progress-fill" style="width: ${cat.percentage}%"></div>
            </div>
        </div>
    `).join('');
}
// ======================================================================

function getXpSeries(mode) {
  // Вспомогательная функция для получения даты локального времени устройства
  const getLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  /* DEBUG
  console.log('[CHART.XP] Starting getXpSeries, mode:', mode);
  */
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
  const todayStr = getLocalDate(today);
  /* DEBUG
  console.log('[CHART.XP] todayStr (local):', todayStr);
  */
  const days = mode === 'week' ? 7 : (mode === 'month' ? 30 : (mode === 'year' ? 365 : 365));
  const res = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const s = getLocalDate(d);
    const entry = data.find(x => x.date === s) || { xp: 0, bonus: 0, dayBonus: 0 };
    /* DEBUG
    if (i <= 2 || i >= days - 2) {
      console.log(`[CHART.XP] Day ${i}:`, { date: s, xp: entry.xp, isToday: s === todayStr });
    }
    */
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
  // Вспомогательная функция для получения даты локального времени устройства
  const getLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
        const s = getLocalDate(d);
        const de = daily.find(x => x.date === s);
        const im = impMap.get(s);
        xp += de ? (de.xp || 0) : 0;
        hearts += getDailyHearts(s);
        cards += im ? (im.reviewed || 0) : 0;
      }
      res.push({ date: getLocalDate(new Date(y, m, 1)), label: new Date(y, m, 1).toLocaleString('ru-RU', { month: 'short' }), xp, hearts, cards });
    }
    return res;
  }
  if (mode === 'month') {
    // Для месяца: все дни текущего месяца с 1-го числа
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const s = getLocalDate(d);
      const de = daily.find(x => x.date === s) || { xp: 0 };
      const im = impMap.get(s) || { improved: 0, regressed: 0, reviewed: 0 };
      res.push({
        date: s,
        label: d.getDate().toString(),
        xp: de.xp || 0,
        hearts: getDailyHearts(s),
        cards: im.reviewed || 0
      });
    }
    console.log('[DEBUG getActivitySeries] mode:', mode, 'res.length:', res.length);
    return res;
  }
  // Для недели: последние 14 дней
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const s = getLocalDate(d);
    const de = daily.find(x => x.date === s) || { xp: 0 };
    const im = impMap.get(s) || { improved: 0, regressed: 0, reviewed: 0 };
    res.push({
      date: s,
      label: d.toLocaleDateString('ru-RU', { day: 'numeric' }),
      xp: de.xp || 0,
      hearts: getDailyHearts(s),
      cards: im.reviewed || 0
    });
  }
  return res;
}

// ============================================
// Модальное окно настроек
// ============================================

function getSettings() {
  try {
    const saved = localStorage.getItem('appSettings');
    if (saved) return JSON.parse(saved);
  } catch { }

  // Определяем часовой пояс устройства
  const offset = new Date().getTimezoneOffset();
  const hours = -offset / 60;
  const sign = hours >= 0 ? '+' : '-';
  const absHours = Math.abs(hours);
  const defaultTimezone = `UTC${sign}${absHours}`;

  return {
    language: 'ru',
    theme: 'dark',
    timezone: defaultTimezone,
    dailyStudyTime: 60 // минуты по умолчанию
  };
}

function saveSettings(settings) {
  localStorage.setItem('appSettings', JSON.stringify(settings));
  window.dispatchEvent(new Event('settingsChanged'));
}

window.openSettingsModal = function () {
  // Удаляем старое модальное окно если есть
  const old = document.getElementById('settings-modal-overlay');
  if (old) old.remove();

  const settings = getSettings();

  const overlay = document.createElement('div');
  overlay.id = 'settings-modal-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:10000;animation:fadeIn 0.2s;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:#1a1a2e;border-radius:16px;width:90%;max-width:500px;max-height:85vh;overflow-y:auto;padding:0;box-shadow:0 20px 60px rgba(0,0,0,0.5);animation:slideUp 0.3s;';

  modal.innerHTML = `
    <!-- Шапка -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.1);">
      <h2 style="margin:0;font-size:20px;font-weight:700;color:#fff;display:flex;align-items:center;gap:10px;">
        <svg viewBox="0 0 24 24" fill="currentColor" style="width:24px;height:24px;color:#FF9F1C;">
          <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
        </svg>
        Настройки
      </h2>
      <button onclick="document.getElementById('settings-modal-overlay').remove()" style="background:none;border:none;color:rgba(255,255,255,0.5);cursor:pointer;padding:4px;border-radius:4px;transition:all 0.2s;" onmouseover="this.style.color='#fff';this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.color='rgba(255,255,255,0.5)';this.style.background='none'">
        <svg viewBox="0 0 24 24" fill="currentColor" style="width:24px;height:24px;">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>

    <!-- Контент -->
    <div style="padding:24px;">
      <!-- 1. Настройки приложения -->
      <div style="margin-bottom:28px;">
        <h3 style="margin:0 0 16px 0;font-size:14px;font-weight:600;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.5px;">⚙️ Настройки приложения</h3>
        
        <!-- Язык -->
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:14px;color:#fff;margin-bottom:8px;font-weight:500;">Язык интерфейса</label>
          <select id="settings-language" style="width:100%;padding:10px 14px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:#fff;font-size:14px;cursor:pointer;">
            <option value="ru" ${settings.language === 'ru' ? 'selected' : ''}>🇷🇺 Русский</option>
            <option value="en" ${settings.language === 'en' ? 'selected' : ''}>🇬🇧 English (в разработке)</option>
          </select>
        </div>

        <!-- Тема -->
        <div>
          <label style="display:block;font-size:14px;color:#fff;margin-bottom:8px;font-weight:500;">Тема оформления</label>
          <select id="settings-theme" style="width:100%;padding:10px 14px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:#fff;font-size:14px;cursor:pointer;">
            <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>🌙 Тёмная</option>
            <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>☀️ Светлая (в разработке)</option>
          </select>
        </div>

        <!-- Часовой пояс -->
        <div style="margin-top:16px;">
          <label style="display:block;font-size:14px;color:#fff;margin-bottom:8px;font-weight:500;">
            Часовой пояс
            <span style="color:#4361EE;font-size:11px;font-weight:400;">(для корректного отображения статистики)</span>
          </label>
          
          <div id="timezone-dropdown" style="position:relative;width:100%;">
            <!-- Кнопка dropdown -->
            <button id="timezone-btn" style="width:100%;padding:10px 14px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:#fff;font-size:14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;transition:background 0.2s;">
              <span id="timezone-selected">🕐 ${settings.timezone || 'UTC+3'}</span>
              <span style="font-size:12px;opacity:0.6;">▼</span>
            </button>
            
            <!-- Список опций -->
            <div id="timezone-list" style="display:none;position:absolute;top:100%;left:0;right:0;max-height:300px;overflow-y:auto;background:rgba(30,30,40,0.98);border:1px solid rgba(255,255,255,0.2);border-radius:8px;margin-top:4px;z-index:1000;backdrop-filter:blur(10px);box-shadow:0 8px 32px rgba(0,0,0,0.4);">
            </div>
          </div>
          
          <p style="margin:8px 0 0 0;font-size:11px;color:rgba(255,255,255,0.4);line-height:1.4;">
            🕐 Рекомендуется выбрать ваш часовой пояс для правильного подсчёта статистики по дням
          </p>
        </div>
      </div>

      <!-- 2. Настройки пользователя -->
      <div style="margin-bottom:28px;">
        <h3 style="margin:0 0 16px 0;font-size:14px;font-weight:600;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.5px;">👤 Настройки обучения</h3>
        
        <div>
          <label style="display:block;font-size:14px;color:#fff;margin-bottom:8px;font-weight:500;">
            Время на обучение в день
            <span style="color:#FF9F1C;font-size:16px;font-weight:700;" id="settings-time-display">${settings.dailyStudyTime} мин</span>
          </label>
          <input type="range" id="settings-study-time" min="30" max="120" step="15" value="${settings.dailyStudyTime}" style="width:100%;margin-bottom:12px;accent-color:#FF9F1C;">
          <div style="display:flex;justify-content:space-between;font-size:12px;color:rgba(255,255,255,0.4);margin-bottom:16px;">
            <span>30 мин</span>
            <span>60 мин</span>
            <span>90 мин</span>
            <span>120 мин</span>
          </div>
          
          <!-- Кнопка сохранения и уведомление -->
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
            <button id="settings-save-btn" style="flex:1;padding:10px;background:#FF9F1C;color:#000;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:background 0.2s;">
              Сохранить
            </button>
          </div>
          <div id="settings-save-msg" style="font-size:12px;color:#06D6A0;text-align:center;min-height:18px;"></div>

          <p style="margin:8px 0 0 0;font-size:12px;color:rgba(255,255,255,0.4);line-height:1.5;">
            💡 Система адаптирует количество карточек под ваше время. Допускается +15% к выбранному времени.
          </p>
        </div>
      </div>

      <!-- 3. Управление бэкапами -->
      <div style="margin-bottom:28px;">
        <h3 style="margin:0 0 16px 0;font-size:14px;font-weight:600;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.5px;">💾 Бэкапы и восстановление</h3>
        
        <!-- Кнопки действий -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
          <button id="backup-create-btn" style="padding:10px;background:#06D6A0;color:#000;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">➕ Создать бэкап</button>
          <button id="backup-import-btn" style="padding:10px;background:#4361EE;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">📥 Импорт</button>
        </div>

        <!-- Список бэкапов -->
        <div id="backups-list-container" style="max-height:400px;overflow-y:auto;">
          <div id="backups-loading" style="text-align:center;padding:20px;color:rgba(255,255,255,0.5);font-size:13px;">Загрузка...</div>
          <div id="backups-list"></div>
        </div>

        <!-- Сброс прогресса -->
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);">
          <button id="backup-reset-progress-btn" style="width:100%;padding:10px;background:rgba(255,107,107,0.2);color:#FF6B6B;border:1px solid rgba(255,107,107,0.3);border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">🗑️ Сбросить прогресс</button>
        </div>
      </div>

      <!-- 4. Информация -->
      <div>
        <h3 style="margin:0 0 16px 0;font-size:14px;font-weight:600;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.5px;">ℹ️ Информация</h3>
        
        <div style="background:rgba(255,255,255,0.05);border-radius:10px;padding:16px;font-size:13px;color:rgba(255,255,255,0.7);line-height:1.6;">
          <p style="margin:0 0 12px 0;"><strong style="color:#fff;">Как работает обучение?</strong></p>
          <p style="margin:0 0 12px 0;">Система использует метод интервальных повторений (SRS) — карточки показываются через оптимальные промежутки времени, чтобы вы запоминали материал надолго.</p>
          
          <p style="margin:0 0 12px 0;"><strong style="color:#fff;">Сколько карточек в день?</strong></p>
          <p style="margin:0 0 12px 0;">Количество зависит от вашего времени обучения и точности ответов. В среднем:</p>
          <ul style="margin:0 0 12px 16px;padding:0;">
            <li>30 мин → ~10-15 новых карточек + повторения</li>
            <li>60 мин → ~20-30 новых карточек + повторения</li>
            <li>90 мин → ~30-40 новых карточек + повторения</li>
          </ul>
          
          <p style="margin:0 0 12px 0;"><strong style="color:#fff;">Что такое "повторения" и "новые"?</strong></p>
          <p style="margin:0 0 12px 0;">• <strong>Новые</strong> — карточки, которые вы видите впервые<br>• <strong>Повторения</strong> — карточки, которые пора повторить по алгоритму</p>
          
          <p style="margin:0 0 12px 0;"><strong style="color:#fff;">Что будет если пропустить день?</strong></p>
          <p style="margin:0 0 0 0;">Ничего страшного! Карточки накопятся и будут показаны в следующей сессии. Рекомендуется заниматься регулярно для лучшего запоминания.</p>
        </div>
      </div>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Закрытие по клику на оверлей
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  // Закрытие по Escape
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);

  // Обновление отображения времени
  const timeSlider = document.getElementById('settings-study-time');
  const timeDisplay = document.getElementById('settings-time-display');
  timeSlider.addEventListener('input', () => {
    timeDisplay.textContent = timeSlider.value + ' мин';
  });

  // Сохранение настроек
  document.getElementById('settings-save-btn').addEventListener('click', async () => {
    const msgEl = document.getElementById('settings-save-msg');
    const btnEl = document.getElementById('settings-save-btn');

    btnEl.disabled = true;
    btnEl.style.opacity = '0.6';
    msgEl.textContent = 'Сохранение...';

    const newSettings = {
      language: document.getElementById('settings-language').value,
      theme: document.getElementById('settings-theme').value,
      timezone: document.getElementById('timezone-selected').textContent.replace('🕐 ', ''),
      dailyStudyTime: parseInt(document.getElementById('settings-study-time').value)
    };

    // Сохраняем локально
    saveSettings(newSettings);

    // Синхронизируем с сервером
    try {
      const sessionUserRaw = localStorage.getItem('qaSessionUser') || sessionStorage.getItem('qaSessionUser');
      if (sessionUserRaw) {
        const user = JSON.parse(sessionUserRaw);
        if (user && user.username) {
          const res = await fetch(`/api/settings?username=${encodeURIComponent(user.username)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newSettings)
          });
          if (!res.ok) throw new Error('Server error');
        }
      }
    } catch (e) {
      console.warn('[SETTINGS] Failed to sync with server:', e);
      msgEl.style.color = '#FF6B6B';
      msgEl.textContent = 'Ошибка синхронизации. Сохранено локально.';
      setTimeout(() => overlay.remove(), 1500);
      return;
    }

    // Успех
    msgEl.style.color = '#06D6A0';
    msgEl.textContent = '✓ Настройки сохранены и синхронизированы!';

    setTimeout(() => {
      overlay.remove();
    }, 1000);
  });

  // ============================================
  // ЧАСОВОЙ ПОЯС - КАСТОМНЫЙ DROPDOWN
  // ============================================

  const timezones = [
    { value: 'UTC-12', label: '🌍 UTC-12 (Бейкер)' },
    { value: 'UTC-11', label: '🌍 UTC-11 (Паго-Паго)' },
    { value: 'UTC-10', label: '🌍 UTC-10 (Гавайи)' },
    { value: 'UTC-9', label: '🌍 UTC-9 (Аляска)' },
    { value: 'UTC-8', label: '🌍 UTC-8 (Лос-Анджелес)' },
    { value: 'UTC-7', label: '🌍 UTC-7 (Денвер)' },
    { value: 'UTC-6', label: '🌍 UTC-6 (Чикаго)' },
    { value: 'UTC-5', label: '🌍 UTC-5 (Нью-Йорк)' },
    { value: 'UTC-4', label: '🌍 UTC-4 (Сантьяго)' },
    { value: 'UTC-3', label: '🌍 UTC-3 (Буэнос-Айрес)' },
    { value: 'UTC-2', label: '🌍 UTC-2 (Южная Джорджия)' },
    { value: 'UTC-1', label: '🌍 UTC-1 (Азорские острова)' },
    { value: 'UTC+0', label: '🌍 UTC+0 (Лондон)' },
    { value: 'UTC+1', label: '🌍 UTC+1 (Берлин)' },
    { value: 'UTC+2', label: '🌍 UTC+2 (Киев)' },
    { value: 'UTC+3', label: '🇷 UTC+3 (Москва, СПб)' },
    { value: 'UTC+4', label: '🌍 UTC+4 (Дубай, Баку)' },
    { value: 'UTC+5', label: '🌍 UTC+5 (Екатеринбург)' },
    { value: 'UTC+6', label: '🌍 UTC+6 (Алматы, Омск)' },
    { value: 'UTC+7', label: '🌍 UTC+7 (Новосибирск, Бангкок)' },
    { value: 'UTC+8', label: '🌍 UTC+8 (Пекин, Красноярск)' },
    { value: 'UTC+9', label: '🌍 UTC+9 (Токио, Иркутск)' },
    { value: 'UTC+10', label: '🌍 UTC+10 (Владивосток, Сидней)' },
    { value: 'UTC+11', label: '🌍 UTC+11 (Магадан)' },
    { value: 'UTC+12', label: '🌍 UTC+12 (Камчатка, Окленд)' },
  ];

  const timezoneBtn = document.getElementById('timezone-btn');
  const timezoneList = document.getElementById('timezone-list');
  const timezoneSelected = document.getElementById('timezone-selected');

  // Заполняем список опций
  const currentTz = settings.timezone || 'UTC+3';
  timezoneSelected.textContent = '🕐 ' + currentTz;

  timezones.forEach(tz => {
    const item = document.createElement('div');
    item.textContent = tz.label;
    item.dataset.value = tz.value;
    item.style.cssText = `
      padding:10px 14px;
      color:#fff;
      font-size:14px;
      cursor:pointer;
      transition:background 0.15s;
      border-bottom:1px solid rgba(255,255,255,0.05);
    `;

    if (tz.value === currentTz) {
      item.style.background = 'rgba(255,159,28,0.2)';
      item.style.color = '#FF9F1C';
    }

    item.onmouseover = () => {
      if (tz.value !== currentTz) {
        item.style.background = 'rgba(255,255,255,0.1)';
      }
    };
    item.onmouseout = () => {
      if (tz.value !== currentTz) {
        item.style.background = 'transparent';
      }
    };

    item.onclick = () => {
      timezoneSelected.textContent = '🕐 ' + tz.value;
      timezoneList.style.display = 'none';
      timezoneBtn.style.background = 'rgba(255,159,28,0.15)';
      setTimeout(() => {
        timezoneBtn.style.background = '';
      }, 300);
    };

    timezoneList.appendChild(item);
  });

  // Открытие/закрытие списка
  timezoneBtn.onclick = (e) => {
    e.stopPropagation();
    const isOpen = timezoneList.style.display === 'block';
    timezoneList.style.display = isOpen ? 'none' : 'block';
  };

  // Закрытие при клике вне dropdown
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#timezone-dropdown')) {
      timezoneList.style.display = 'none';
    }
  });

  // ============================================
  // ФУНКЦИИ ДЛЯ РАБОТЫ С БЭКАПАМИ
  // ============================================

  // Helper функция для получения username текущего пользователя
  function getCurrentUsername() {
    try {
      const sessionUserRaw = localStorage.getItem('qaSessionUser') || sessionStorage.getItem('qaSessionUser');
      if (!sessionUserRaw) return null;
      const user = JSON.parse(sessionUserRaw);
      return user && user.username ? user.username : null;
    } catch (e) {
      console.error('[BACKUP] Failed to get username:', e);
      return null;
    }
  }

  const username = getCurrentUsername();

  // Загрузка списка бэкапов
  async function loadBackupsList() {
    const loadingEl = document.getElementById('backups-loading');
    const listEl = document.getElementById('backups-list');

    if (!username) {
      listEl.innerHTML = '<div style="padding:16px;text-align:center;color:#FF6B6B;font-size:13px;">Необходима авторизация</div>';
      loadingEl.style.display = 'none';
      return;
    }

    try {
      const res = await fetch(`/api/backups/list?user=${encodeURIComponent(username)}`);
      const data = await res.json();

      loadingEl.style.display = 'none';

      if (!data.ok || !data.backups || data.backups.length === 0) {
        listEl.innerHTML = '<div style="padding:16px;text-align:center;color:rgba(255,255,255,0.5);font-size:13px;">Бэкапов пока нет</div>';
        return;
      }

      listEl.innerHTML = data.backups.map(backup => `
        <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:12px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">
            <div style="flex:1;">
              <div style="font-size:14px;font-weight:600;color:#fff;margin-bottom:4px;">
                ${backup.isAuto ? '🔄' : '⭐'} ${backup.name}
              </div>
              <div style="font-size:11px;color:rgba(255,255,255,0.5);">
                ${new Date(backup.createdAt).toLocaleString('ru-RU')} • ${(backup.size / 1024).toFixed(1)} KB
              </div>
            </div>
            <span style="padding:2px 8px;background:${backup.isAuto ? 'rgba(67,97,238,0.2)' : 'rgba(6,214,160,0.2)'};color:${backup.isAuto ? '#4361EE' : '#06D6A0'};border-radius:12px;font-size:11px;font-weight:600;">
              ${backup.isAuto ? 'Авто' : 'Ручной'}
            </span>
          </div>
          
          <div style="display:flex;gap:6px;flex-wrap:wrap;font-size:11px;color:rgba(255,255,255,0.6);margin-bottom:8px;">
            ${backup.hasCards ? `<span>📝 ${backup.cardsCount} карт</span>` : ''}
            ${backup.categoriesCount > 0 ? `<span>📁 ${backup.categoriesCount} кат</span>` : ''}
            ${backup.achievementsCount > 0 ? `<span>🏆 ${backup.achievementsCount} дост</span>` : ''}
          </div>
          
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button onclick="restoreBackup('${backup.id}', 'full')" style="padding:6px 10px;background:#FF9F1C;color:#000;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;">Восстановить</button>
            <button onclick="exportBackup('${backup.id}')" style="padding:6px 10px;background:#4361EE;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;">Скачать</button>
            ${backup.canDelete ? `<button onclick="deleteBackup('${backup.filename}')" style="padding:6px 10px;background:rgba(255,107,107,0.2);color:#FF6B6B;border:1px solid rgba(255,107,107,0.3);border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;">Удалить</button>` : ''}
            ${backup.canRename ? `<button onclick="renameBackup('${backup.filename}')" style="padding:6px 10px;background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;">Переим.</button>` : ''}
          </div>
        </div>
      `).join('');
    } catch (e) {
      console.error('[BACKUP] Failed to load backups:', e);
      listEl.innerHTML = '<div style="padding:16px;text-align:center;color:#FF6B6B;font-size:13px;">Ошибка загрузки</div>';
    }
  }

  // Создание бэкапа
  document.getElementById('backup-create-btn').addEventListener('click', async () => {
    if (!confirm('Создать ручной бэкап всех данных?')) return;

    const btn = document.getElementById('backup-create-btn');
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.textContent = 'Создание...';

    try {
      const res = await fetch(`/api/backups/create?user=${encodeURIComponent(username)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'full' })
      });

      const data = await res.json();

      if (data.success) {
        btn.textContent = '✓ Создан';
        btn.style.background = '#06D6A0';
        setTimeout(() => {
          btn.disabled = false;
          btn.style.opacity = '1';
          btn.textContent = '➕ Создать бэкап';
          btn.style.background = '#06D6A0';
          loadBackupsList();
        }, 1000);
      } else {
        alert('Ошибка: ' + data.error);
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.textContent = '➕ Создать бэкап';
      }
    } catch (e) {
      alert('Ошибка создания бэкапа');
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.textContent = '➕ Создать бэкап';
    }
  });

  // Импорт бэкапа
  document.getElementById('backup-import-btn').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const backupData = JSON.parse(text);

        const customName = prompt('Введите имя для бэкапа (или оставьте пустым для автоматического):', '');

        const res = await fetch(`/api/backups/import?user=${encodeURIComponent(username)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            backupData,
            name: customName || null
          })
        });

        const data = await res.json();

        if (data.success) {
          alert('✓ Бэкап импортирован!');
          loadBackupsList();
        } else {
          alert('Ошибка: ' + data.error);
        }
      } catch (e) {
        alert('Ошибка чтения файла');
      }
    };

    input.click();
  });

  // Сброс прогресса
  document.getElementById('backup-reset-progress-btn').addEventListener('click', async () => {
    if (!confirm('⚠️ Вы уверены, что хотите сбросить ВЕСЬ прогресс обучения?\n\nЭто удалит:\n• Достижения\n• Сердечки карточек\n• Историю ответов\n• Уровни\n• Серию дней\n\nКарточки останутся на месте.')) return;

    if (!confirm('🔴 ТОЧНО уверены? Прогресс будет удалён безвозвратно!')) return;

    const btn = document.getElementById('backup-reset-progress-btn');
    btn.disabled = true;
    btn.textContent = 'Сброс...';

    try {
      // 1. Сначала сбрасываем на СЕРВЕРЕ
      const res = await fetch(`/api/backups/reset-achievements?user=${encodeURIComponent(username)}`, {
        method: 'POST'
      });

      const data = await res.json();

      if (!data.success) {
        alert('Ошибка сервера: ' + data.error);
        btn.disabled = false;
        btn.textContent = '🗑️ Сбросить прогресс';
        return;
      }

      // 2. Потом очищаем localStorage
      localStorage.removeItem('studyAchievements');
      localStorage.removeItem('srsProgress');
      localStorage.removeItem('dailyPoints');
      localStorage.removeItem('dailyBonusPoints');
      localStorage.removeItem('dailyDayBonusPoints');
      localStorage.removeItem('studyStreak');
      localStorage.removeItem('studyStats');
      localStorage.removeItem('userLevel');
      localStorage.removeItem('progressMap');
      localStorage.removeItem('mskDate');
      localStorage.removeItem('mskMigrated');
      localStorage.removeItem('localDataTimestamp');
      localStorage.removeItem('marathonProgress'); // Марафон

      console.log('[BACKUP] LocalStorage очищен, перезагрузка...');

      // 3. Перезагружаем
      location.reload();
    } catch (e) {
      alert('Ошибка сброса прогресса: ' + e.message);
      btn.disabled = false;
      btn.textContent = '🗑️ Сбросить прогресс';
    }
  });

  // Глобальные функции для кнопок бэкапов
  window.restoreBackup = async function (backupId, restoreType) {
    const typeMap = {
      'full': 'все данные',
      'cards': 'карточки и категории',
      'progress': 'прогресс и достижения'
    };

    if (!confirm(`⚠️ Восстановить "${typeMap[restoreType]}" из бэкапа?\n\nТекущие данные будут заменены.`)) return;

    try {
      const res = await fetch(`/api/backups/restore?user=${encodeURIComponent(username)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId, restoreType })
      });

      const data = await res.json();

      if (data.success) {
        alert('✓ Данные восстановлены! Страница будет перезагружена.');
        location.reload();
      } else {
        alert('Ошибка: ' + data.error);
      }
    } catch (e) {
      alert('Ошибка восстановления');
    }
  };

  window.exportBackup = async function (backupId) {
    try {
      const res = await fetch(`/api/backups/export?user=${encodeURIComponent(username)}&backupId=${encodeURIComponent(backupId)}`);

      if (!res.ok) {
        alert('Ошибка экспорта');
        return;
      }

      const content = await res.text();
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = backupId.split('__')[1] || 'backup.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Ошибка экспорта');
    }
  };

  window.deleteBackup = async function (filename) {
    if (!confirm('Удалить этот бэкап?')) return;

    try {
      const res = await fetch(`/api/backups/delete?user=${encodeURIComponent(username)}&filename=${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });

      const data = await res.json();

      if (data.success) {
        loadBackupsList();
      } else {
        alert('Ошибка: ' + data.error);
      }
    } catch (e) {
      alert('Ошибка удаления');
    }
  };

  window.renameBackup = async function (filename) {
    const newName = prompt('Введите новое имя для бэкапа (без .json):', filename.replace('.json', ''));

    if (!newName || !newName.trim()) return;

    try {
      const res = await fetch(`/api/backups/rename?user=${encodeURIComponent(username)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldFilename: filename,
          newFilename: newName.trim() + '.json'
        })
      });

      const data = await res.json();

      if (data.success) {
        loadBackupsList();
      } else {
        alert('Ошибка: ' + data.error);
      }
    } catch (e) {
      alert('Ошибка переименования');
    }
  };

  // Загружаем список бэкапов
  loadBackupsList();
};

// Загружаем настройки при старте
window.addEventListener('DOMContentLoaded', async () => {
  let settings = getSettings();

  // Определяем часовой пояс устройства по умолчанию
  if (!settings.timezone) {
    const offset = new Date().getTimezoneOffset();
    const hours = -offset / 60;
    const sign = hours >= 0 ? '+' : '-';
    const absHours = Math.abs(hours);
    const formattedOffset = `UTC${sign}${absHours}`;
    settings.timezone = formattedOffset;
    saveSettings(settings);
  }

  // Пробуем загрузить с сервера
  try {
    const sessionUserRaw = localStorage.getItem('qaSessionUser') || sessionStorage.getItem('qaSessionUser');
    if (sessionUserRaw) {
      const user = JSON.parse(sessionUserRaw);
      if (user && user.username) {
        // Получаем полные данные пользователя (включая _appSettings)
        const res = await fetch(`/api/progress?username=${encodeURIComponent(user.username)}`);
        if (res.ok) {
          const data = await res.json();
          if (data._appSettings) {
            settings = { ...settings, ...data._appSettings };
            saveSettings(settings); // Обновляем локальный кэш
            console.log('[SETTINGS] Loaded from server:', settings);
          }
        }
      }
    }
  } catch (e) {
    console.warn('[SETTINGS] Failed to load from server:', e);
  }

  window.appSettings = settings;
  window.dispatchEvent(new Event('settingsLoaded'));
});

// Обновляем статистику при изменении настроек
window.addEventListener('settingsChanged', () => {
  window.appSettings = getSettings();
  console.log('[STATS] Settings changed, re-rendering stats:', window.appSettings);
  if (document.getElementById('stats-container')) {
    renderStats();
  }
});

/* =============================================
   HISTORY TIMELINE (stats page)
   ============================================= */
const _GN = { 1: 'Снова', 2: 'Трудно', 3: 'Хорошо', 4: 'Легко' };
let _allHistory = [];
let _histFilter = 'all';

function _buildAllHistory() {
  const prog = getProgressMap();
  const entries = [];
  Object.values(prog).forEach(p => {
    if (!p.historyArray || !Array.isArray(p.historyArray)) return;
    p.historyArray.forEach(h => {
      if (h.date && h.grade) {
        entries.push({
          date: h.date,
          grade: h.grade,
          duration: h.duration || 0,
          question: p.question || ''
        });
      }
    });
  });
  entries.sort((a, b) => b.date - a.date);
  return entries;
}

function _fmtDate(ds) {
  const d = new Date(ds);
  const now = new Date();
  const diff = now - d;
  const days = Math.floor(diff / 864e5);
  if (days === 0) return 'Сегодня';
  if (days === 1) return 'Вчера';
  if (days < 7) return days + 'дн.';
  const M = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return d.getDate() + ' ' + M[d.getMonth()];
}

function _fmtTime(ds) {
  const d = new Date(ds);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

window.toggleHistoryTimeline = function () {
  console.log('[HISTORY] ===== toggleHistoryTimeline START =====');
  const panel = document.getElementById('st-history-timeline');
  const btn = document.getElementById('st-history-toggle');
  const arrow = document.getElementById('st-history-arrow');

  console.log('[HISTORY] panel element:', panel ? 'FOUND' : 'NOT FOUND');
  console.log('[HISTORY] btn element:', btn ? 'FOUND' : 'NOT FOUND');
  console.log('[HISTORY] arrow element:', arrow ? 'FOUND' : 'NOT FOUND');

  if (!panel || !btn) {
    console.error('[HISTORY] Missing elements, aborting');
    return;
  }

  const block1El = document.querySelector('.st-block-1');
  const compactCard = block1El ? block1El.querySelector('.st-compact-card') : null;
  const stcContent = compactCard ? compactCard.querySelector('.stc-content') : null;
  const forecastBlock = compactCard ? compactCard.querySelector('[style*="border-top"]') : null;
  console.log('====== [LAYOUT] ДО РАСКРЫТИЯ ======');
  if (block1El) {
    const b = window.getComputedStyle(block1El);
    console.log(`[LAYOUT] .st-block-1 classes="${block1El.className}"`);
    console.log(`[LAYOUT] .st-block-1 display=${b.display}, position=${b.position}, overflow=${b.overflow}`);
    console.log(`[LAYOUT] .st-block-1 padding=${b.padding}, width=${b.width}, height=${b.height}`);
    console.log(`[LAYOUT] .st-block-1 alignItems=${b.alignItems}, justifyContent=${b.justifyContent}, flexDirection=${b.flexDirection}`);
    console.log(`[LAYOUT] .st-block-1 background=${b.background}`);
    console.log(`[LAYOUT] .st-block-1 border=${b.border}`);
    console.log(`[LAYOUT] .st-block-1 zIndex=${b.zIndex}`);
    console.log(`[LAYOUT] .st-block-1 ::before =`, window.getComputedStyle(block1El, '::before').content);
  }
  if (compactCard) {
    const c = window.getComputedStyle(compactCard);
    console.log(`[LAYOUT] .st-compact-card classes="${compactCard.className}"`);
    console.log(`[LAYOUT] .st-compact-card inlineStyle="${compactCard.getAttribute('style')}"`);
    console.log(`[LAYOUT] .st-compact-card display=${c.display}, overflow=${c.overflow}, padding=${c.padding}`);
    console.log(`[LAYOUT] .st-compact-card gap=${c.gap}, rowGap=${c.rowGap}, columnGap=${c.columnGap}, flexDirection=${c.flexDirection}`);
    console.log(`[LAYOUT] .st-compact-card background=${c.background}, border=${c.border}`);
    console.log(`[LAYOUT] .st-compact-card height=${c.height}, width=${c.width}`);
    const r = compactCard.getBoundingClientRect();
    console.log(`[LAYOUT] .st-compact-card rect: x=${r.x.toFixed(0)} y=${r.y.toFixed(0)} w=${r.width.toFixed(0)} h=${r.height.toFixed(0)}`);
    // Check pseudo-elements
    const beforeStyle = window.getComputedStyle(compactCard, '::before');
    const afterStyle = window.getComputedStyle(compactCard, '::after');
    console.log(`[LAYOUT] .st-compact-card::before content="${beforeStyle.content}" display=${beforeStyle.display} height=${beforeStyle.height}`);
    console.log(`[LAYOUT] .st-compact-card::after content="${afterStyle.content}" display=${afterStyle.display} height=${afterStyle.height}`);

    // Лог всех дочерних элементов
    console.log('[LAYOUT] .st-compact-card children:');
    for (const child of compactCard.children) {
      const cs = window.getComputedStyle(child);
      const cr = child.getBoundingClientRect();
      const relY = cr.y - r.y;
      console.log(`  ↳ <${child.tagName}>${child.className ? '.' + (child.className || '').split(' ')[0] : ''}: y=${cr.y.toFixed(0)} (rel:${relY.toFixed(0)}), h=${cr.height.toFixed(0)}, marginTop=${cs.marginTop}, marginBottom=${cs.marginBottom}, paddingTop=${cs.paddingTop}, position=${cs.position}, display=${cs.display}, flex=${cs.flex}`);
    }
  }
  if (stcContent) {
    const s = window.getComputedStyle(stcContent);
    console.log(`[LAYOUT] .stc-content display=${s.display}, visibility=${s.visibility}, opacity=${s.opacity}`);
    console.log(`[LAYOUT] .stc-content height=${s.height}, width=${s.width}, overflow=${s.overflow}`);
    console.log(`[LAYOUT] .stc-content flex=${s.flex}, flexShrink=${s.flexShrink}, flexGrow=${s.flexGrow}`);
    console.log(`[LAYOUT] .stc-content inlineStyle="${stcContent.getAttribute('style')}"`);
    const r2 = stcContent.getBoundingClientRect();
    console.log(`[LAYOUT] .stc-content rect: x=${r2.x.toFixed(0)} y=${r2.y.toFixed(0)} w=${r2.width.toFixed(0)} h=${r2.height.toFixed(0)}`);
  }
  if (forecastBlock) {
    const f = window.getComputedStyle(forecastBlock);
    console.log(`[LAYOUT] forecast-block display=${f.display}, height=${f.height}, width=${f.width}`);
    console.log(`[LAYOUT] forecast-block marginTop=${f.marginTop}, paddingTop=${f.paddingTop}, flex=${f.flex}`);
    console.log(`[LAYOUT] forecast-block inlineStyle="${forecastBlock.getAttribute('style')}"`);
    const r3 = forecastBlock.getBoundingClientRect();
    console.log(`[LAYOUT] forecast-block rect: x=${r3.x.toFixed(0)} y=${r3.y.toFixed(0)} w=${r3.width.toFixed(0)} h=${r3.height.toFixed(0)}`);
    // Вычисляем gap между content и forecast
    if (stcContent) {
      const contentBottom = stcContent.getBoundingClientRect().bottom;
      const forecastTop = r3.y;
      console.log(`[LAYOUT] GAP между .stc-content и forecast: ${(forecastTop - contentBottom).toFixed(1)}px`);
    }
  }
  console.log('====== [LAYOUT] КОНЕЦ ДО ======');

  // Проверяем родительские элементы panel
  let pnode = panel.parentElement;
  let depth = 0;
  while (pnode && depth < 6) {
    const ps = window.getComputedStyle(pnode);
    console.log(`[LAYOUT] parent[${depth}] ${pnode.tagName}.${(pnode.className || '').split(' ')[0]} display=${ps.display} overflow=${ps.overflow} padding=${ps.padding}`);
    pnode = pnode.parentElement;
    depth++;
  }

  const isOpen = panel.style.display !== 'none';
  console.log('[HISTORY] isOpen:', isOpen);

  if (isOpen) {
    panel.style.display = 'none';
    panel.style.position = '';
    panel.style.top = '';
    panel.style.left = '';
    panel.style.right = '';
    panel.style.zIndex = '';
    panel.style.marginTop = '';
    panel.style.background = '';
    panel.style.backdropFilter = '';
    panel.style.webkitBackdropFilter = '';
    panel.style.border = '';
    panel.style.borderRadius = '';
    panel.style.padding = '';
    panel.style.boxShadow = '';
    if (compactCard) compactCard.style.height = '';
    if (arrow) arrow.style.transform = 'rotate(0deg)';
    btn.lastChild.textContent = ' Показать историю';
    if (block1El) block1El.classList.remove('expanded');
    console.log('[HISTORY] Panel HIDDEN, block1 collapsed');
  } else {
    _allHistory = _buildAllHistory();
    console.log('[HISTORY] Built history, total entries:', _allHistory.length);
    if (_allHistory.length > 0) {
      console.log('[HISTORY] First 3 entries:', _allHistory.slice(0, 3).map(e => e.question.slice(0, 30)));
    }
    _renderTimeline();
    if (arrow) arrow.style.transform = 'rotate(180deg)';
    btn.lastChild.textContent = ' Скрыть историю';
    if (block1El) {
      block1El.classList.add('expanded');
      console.log('[HISTORY] Block1 classes after add:', block1El.className);
      console.log('[HISTORY] Block1 has expanded class:', block1El.classList.contains('expanded'));
    } else {
      console.error('[HISTORY] Block1 NOT FOUND!');
    }
    // Даём браузеру применить класс expanded, затем показываем панель
    requestAnimationFrame(() => {
      panel.style.setProperty('display', 'block', 'important');

      // Проверяем мобильная ли версия (max-width: 1024px)
      const isMobile = window.matchMedia('(max-width: 1024px)').matches;

      if (isMobile) {
        // Мобильная версия: timeline в потоке, раздвигает блоки
        panel.style.setProperty('position', 'relative', 'important');
        panel.style.setProperty('z-index', '10', 'important');
        panel.style.setProperty('background', 'linear-gradient(135deg, rgba(22, 27, 34, 0.95) 0%, rgba(31, 38, 48, 0.95) 100%)', 'important');
        panel.style.setProperty('backdrop-filter', 'blur(8px)', 'important');
        panel.style.setProperty('-webkit-backdrop-filter', 'blur(8px)', 'important');
        panel.style.setProperty('border', '1px solid var(--st-border)', 'important');
        panel.style.setProperty('border-radius', '12px', 'important');
        panel.style.setProperty('padding', '10px 10px 14px 10px', 'important');
        panel.style.setProperty('box-shadow', '0 8px 32px rgba(0, 0, 0, 0.4)', 'important');
        panel.style.setProperty('margin-top', '8px', 'important');
        console.log('[HISTORY] Mobile: timeline in flow, blocks will be pushed down');
      } else {
        // Desktop версия: timeline поверх остальных (absolute)
        // Сбрасываем высоту .st-compact-card чтобы align-items: flex-start работал
        if (compactCard) {
          compactCard.style.setProperty('height', 'fit-content', 'important');
          console.log('[HISTORY] Compact-card height set to fit-content');
        }
        panel.style.setProperty('position', 'absolute', 'important');
        panel.style.setProperty('top', '100%', 'important');
        panel.style.setProperty('left', '0', 'important');
        panel.style.setProperty('right', '0', 'important');
        panel.style.setProperty('z-index', '999', 'important');
        panel.style.setProperty('margin-top', '8px', 'important');
        panel.style.setProperty('background', 'linear-gradient(135deg, rgba(22, 27, 34, 0.95) 0%, rgba(31, 38, 48, 0.95) 100%)', 'important');
        panel.style.setProperty('backdrop-filter', 'blur(8px)', 'important');
        panel.style.setProperty('-webkit-backdrop-filter', 'blur(8px)', 'important');
        panel.style.setProperty('border', '1px solid var(--st-border)', 'important');
        panel.style.setProperty('border-radius', '12px', 'important');
        panel.style.setProperty('padding', '10px 10px 14px 10px', 'important');
        panel.style.setProperty('box-shadow', '0 8px 32px rgba(0, 0, 0, 0.4)', 'important');
        console.log('[HISTORY] Desktop: timeline absolute, blocks not moved');
      }
    });

    // Проверяем что применилось через 300ms
    setTimeout(() => {
      console.log('====== [LAYOUT] ПОСЛЕ РАСКРЫТИЯ (через 300мс) ======');
      const b1 = document.querySelector('.st-block-1');
      if (b1) {
        const bs = window.getComputedStyle(b1);
        console.log(`[LAYOUT] .st-block-1 classes="${b1.className}"`);
        console.log(`[LAYOUT] .st-block-1 display=${bs.display}, position=${bs.position}, overflow=${bs.overflow}`);
        console.log(`[LAYOUT] .st-block-1 padding=${bs.padding}, width=${bs.width}, height=${bs.height}`);
        console.log(`[LAYOUT] .st-block-1 alignItems=${bs.alignItems}, justifyContent=${bs.justifyContent}, flexDirection=${bs.flexDirection}`);
        console.log(`[LAYOUT] .st-block-1 background=${bs.background}`);
        console.log(`[LAYOUT] .st-block-1 border=${bs.border}`);
        console.log(`[LAYOUT] .st-block-1 zIndex=${bs.zIndex}`);
        const beforeStyle = window.getComputedStyle(b1, '::before');
        console.log(`[LAYOUT] .st-block-1::before content="${beforeStyle.content}" position=${beforeStyle.position} inset=${beforeStyle.top || 'auto'}${beforeStyle.right ? ' r=' + beforeStyle.right : ''}${beforeStyle.bottom ? ' b=' + beforeStyle.bottom : ''}${beforeStyle.left ? ' l=' + beforeStyle.left : ''}`);
        console.log(`[LAYOUT] .st-block-1::before background=${beforeStyle.background}`);
        console.log(`[LAYOUT] .st-block-1::before zIndex=${beforeStyle.zIndex}`);
        console.log(`[LAYOUT] .st-block-1 offsetHeight=${b1.offsetHeight}`);
        const br = b1.getBoundingClientRect();
        console.log(`[LAYOUT] .st-block-1 rect: x=${br.x.toFixed(0)} y=${br.y.toFixed(0)} w=${br.width.toFixed(0)} h=${br.height.toFixed(0)}`);
      }
      const cc = b1 ? b1.querySelector('.st-compact-card') : null;
      if (cc) {
        const cs = window.getComputedStyle(cc);
        console.log(`[LAYOUT] .st-compact-card classes="${cc.className}"`);
        console.log(`[LAYOUT] .st-compact-card inlineStyle="${cc.getAttribute('style')}"`);
        console.log(`[LAYOUT] .st-compact-card display=${cs.display}, overflow=${cs.overflow}, padding=${cs.padding}`);
        console.log(`[LAYOUT] .st-compact-card gap=${cs.gap || cs.rowGap}, flexDirection=${cs.flexDirection}`);
        console.log(`[LAYOUT] .st-compact-card background=${cs.background}`);
        console.log(`[LAYOUT] .st-compact-card height=${cs.height}, width=${cs.width}`);
        console.log(`[LAYOUT] .st-compact-card minHeight=${cs.minHeight}, maxHeight=${cs.maxHeight}`);
        console.log(`[LAYOUT] .st-compact-card alignSelf=${cs.alignSelf}, flexBasis=${cs.flexBasis}`);
        // Лог align-items родителя
        const b1cs = window.getComputedStyle(b1);
        console.log(`[LAYOUT] .st-block-1 expanded alignItems=${b1cs.alignItems}, justifyContent=${b1cs.justifyContent}, flexDirection=${b1cs.flexDirection}`);
        // Лог всех CSS правил которые применяются к .st-compact-card
        console.log('[CSS] === Правила для .st-compact-card ===');
        try {
          for (let i = 0; i < document.styleSheets.length; i++) {
            try {
              const rules = document.styleSheets[i].cssRules;
              for (let j = 0; j < rules.length; j++) {
                const rule = rules[j];
                if (rule.selectorText && (rule.selectorText.includes('st-compact-card') || rule.selectorText.includes('st-block-1.expanded'))) {
                  console.log(`[CSS][${i}][${j}] ${rule.selectorText} -> height=${rule.style.height || 'auto'}, minHeight=${rule.style.minHeight || 'auto'}, alignItems=${rule.style.alignItems || 'inherit'}, display=${rule.style.display || 'inherit'}`);
                }
              }
            } catch (e) { /* CORS */ }
          }
        } catch (e) {
          console.log('[CSS] Cannot read stylesheets:', e.message);
        }
        console.log('[CSS] === КОНЕЦ ===');
        const cr = cc.getBoundingClientRect();
        console.log(`[LAYOUT] .st-compact-card rect: x=${cr.x.toFixed(0)} y=${cr.y.toFixed(0)} w=${cr.width.toFixed(0)} h=${cr.height.toFixed(0)}`);

        // Лог всех дочерних элементов
        console.log('[LAYOUT] .st-compact-card children:');
        for (const child of cc.children) {
          const chs = window.getComputedStyle(child);
          const chr = child.getBoundingClientRect();
          const relY = chr.y - cr.y;
          console.log(`  ↳ <${child.tagName}>${child.className ? '.' + child.className.split(' ')[0] : ''}: y=${chr.y.toFixed(0)} (rel:${relY.toFixed(0)}), h=${chr.height.toFixed(0)}, marginTop=${chs.marginTop}, marginBottom=${chs.marginBottom}, paddingTop=${chs.paddingTop}, flex=${chs.flex}`);
        }
      }
      const sc = cc ? cc.querySelector('.stc-content') : null;
      if (sc) {
        const ss = window.getComputedStyle(sc);
        console.log(`[LAYOUT] .stc-content display=${ss.display}, visibility=${ss.visibility}, opacity=${ss.opacity}`);
        console.log(`[LAYOUT] .stc-content height=${ss.height}, width=${ss.width}, overflow=${ss.overflow}`);
        console.log(`[LAYOUT] .stc-content flex=${ss.flex}, flexShrink=${ss.flexShrink}, flexGrow=${ss.flexGrow}`);
        console.log(`[LAYOUT] .stc-content inlineStyle="${sc.getAttribute('style')}"`);
        const sr = sc.getBoundingClientRect();
        console.log(`[LAYOUT] .stc-content rect: x=${sr.x.toFixed(0)} y=${sr.y.toFixed(0)} w=${sr.width.toFixed(0)} h=${sr.height.toFixed(0)}`);
        // Проверка: виден ли элемент вообще
        console.log(`[LAYOUT] .stc-content offsetParent=${sc.offsetParent ? sc.offsetParent.tagName + '.' + (sc.offsetParent.className || '') : 'NULL'}`);
      }
      const fb = cc ? cc.querySelector('.stc-forecast-block') || cc.querySelector('[style*="border-top"]') : null;
      if (fb) {
        const fs = window.getComputedStyle(fb);
        console.log(`[LAYOUT] forecast-block display=${fs.display}, height=${fs.height}, width=${fs.width}, overflow=${fs.overflow}`);
        console.log(`[LAYOUT] forecast-block marginTop=${fs.marginTop}, paddingTop=${fs.paddingTop}, flex=${fs.flex}`);
        console.log(`[LAYOUT] forecast-block inlineStyle="${fb.getAttribute('style')}"`);
        const fr = fb.getBoundingClientRect();
        console.log(`[LAYOUT] forecast-block rect: x=${fr.x.toFixed(0)} y=${fr.y.toFixed(0)} w=${fr.width.toFixed(0)} h=${fr.height.toFixed(0)}`);
        // Вычисляем gap между content и forecast
        if (sc) {
          const contentBottom = sc.getBoundingClientRect().bottom;
          const forecastTop = fr.y;
          console.log(`[LAYOUT] GAP между .stc-content и forecast: ${(forecastTop - contentBottom).toFixed(1)}px`);
        }
      }
      const ht = document.getElementById('st-history-timeline');
      if (ht) {
        const hs = window.getComputedStyle(ht);
        console.log(`[LAYOUT] #st-history-timeline display=${hs.display}, position=${hs.position}, height=${hs.height}, width=${hs.width}`);
        console.log(`[LAYOUT] #st-history-timeline top=${hs.top}, left=${hs.left}, right=${hs.right}, zIndex=${hs.zIndex}`);
        console.log(`[LAYOUT] #st-history-timeline background=${hs.background}`);
        console.log(`[LAYOUT] #st-history-timeline margin=${hs.margin}, padding=${hs.padding}`);
        console.log(`[LAYOUT] #st-history-timeline borderRadius=${hs.borderRadius}`);
        console.log(`[LAYOUT] #st-history-timeline inlineStyle="${ht.getAttribute('style')}"`);
        const hr = ht.getBoundingClientRect();
        console.log(`[LAYOUT] #st-history-timeline rect: x=${hr.x.toFixed(0)} y=${hr.y.toFixed(0)} w=${hr.width.toFixed(0)} h=${hr.height.toFixed(0)}`);
        // Check if CSS rule is being applied
        console.log(`[LAYOUT] #st-history-timeline parent=${ht.parentElement ? ht.parentElement.tagName + '.' + (ht.parentElement.className || '').split(' ')[0] : 'NONE'}`);
        // Check all matching CSS rules
        try {
          const rules = document.styleSheets;
          for (let i = 0; i < rules.length; i++) {
            try {
              const cssRules = rules[i].cssRules;
              for (let j = 0; j < cssRules.length; j++) {
                if (cssRules[j].selectorText && cssRules[j].selectorText.includes('st-history-timeline')) {
                  console.log(`[LAYOUT] CSS Rule[${i}][${j}]: ${cssRules[j].selectorText} -> position=${cssRules[j].style.position}`);
                }
              }
            } catch (e) { /* CORS */ }
          }
        } catch (e) {
          console.log('[LAYOUT] Cannot read stylesheets:', e.message);
        }
      }
      const htl = document.getElementById('st-history-timeline-list');
      if (htl) {
        const hls = window.getComputedStyle(htl);
        console.log(`[LAYOUT] .st-history-timeline-list background=${hls.background}`);
        console.log(`[LAYOUT] .st-history-timeline-list margin=${hls.margin}, padding=${hls.padding}`);
        console.log(`[LAYOUT] .st-history-timeline-list borderRadius=${hls.borderRadius}`);
      }
      console.log('====== [LAYOUT] КОНЕЦ ПОСЛЕ ======');
    }, 300);
  }
};

window.filterHistoryTimeline = function (grade, btnEl) {
  _histFilter = grade;
  document.querySelectorAll('.st-hist-filter-btn').forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');
  _renderTimeline();
};

function _renderTimeline() {
  const list = document.getElementById('st-history-timeline-list');
  if (!list) return;
  list.innerHTML = '';
  const data = _histFilter === 'all' ? _allHistory : _allHistory.filter(h => h.grade === +_histFilter);

  // Vertical line
  const line = document.createElement('div');
  line.className = 'st-timeline-line';
  list.appendChild(line);

  let lastDay = '';
  data.forEach(h => {
    const day = new Date(h.date).toISOString().split('T')[0];
    if (day !== lastDay) {
      const sep = document.createElement('div');
      sep.className = 'st-timeline-sep';
      sep.textContent = _fmtDate(h.date);
      list.appendChild(sep);
      lastDay = day;
    }

    const item = document.createElement('div');
    item.className = 'st-timeline-item';
    item.onclick = () => window.openCardHistoryModal(h.question);

    const dot = document.createElement('div');
    dot.className = 'st-timeline-dot';
    dot.setAttribute('data-grade', h.grade);

    const q = document.createElement('div');
    q.className = 'st-timeline-q';
    q.textContent = h.question.length > 50 ? h.question.slice(0, 50) + '…' : h.question;

    const meta = document.createElement('div');
    meta.className = 'st-timeline-meta';

    const timeSpan = document.createElement('span');
    timeSpan.textContent = _fmtTime(h.date);
    meta.appendChild(timeSpan);

    const gradeSpan = document.createElement('span');
    gradeSpan.className = 'st-timeline-grade';
    gradeSpan.setAttribute('data-grade', h.grade);
    gradeSpan.textContent = _GN[h.grade];
    meta.appendChild(gradeSpan);

    if (h.duration) {
      const durSpan = document.createElement('span');
      durSpan.textContent = '~' + h.duration + 'с';
      meta.appendChild(durSpan);
    }

    item.appendChild(dot);
    item.appendChild(q);
    item.appendChild(meta);
    list.appendChild(item);
  });
}

window.openCardHistoryModal = function (question) {
  const prog = getProgressMap();
  const p = prog[question];
  if (!p || !p.historyArray) return;
  const entries = p.historyArray.filter(h => h.date && h.grade).sort((a, b) => b.date - a.date);

  const cnts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  entries.forEach(e => cnts[e.grade]++);
  const total = entries.length;
  const avgS = total > 0 ? Math.round(entries.reduce((s, e) => s + (e.duration || 0), 0) / total) : 0;
  const shortQ = question.length > 40 ? question.slice(0, 40) + '…' : question;

  // Overlay
  const overlay = document.createElement('div');
  overlay.className = 'st-modal-overlay';
  overlay.onclick = (ev) => { if (ev.target === overlay) overlay.remove(); };

  // Box
  const box = document.createElement('div');
  box.className = 'st-modal-box';

  // Header
  const header = document.createElement('div');
  header.className = 'st-modal-header';
  const title = document.createElement('h3');
  title.textContent = '📋 ' + shortQ;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'st-modal-close';
  closeBtn.textContent = '✕';
  closeBtn.onclick = () => overlay.remove();
  header.appendChild(title);
  header.appendChild(closeBtn);
  box.appendChild(header);

  // Stats
  const statsDiv = document.createElement('div');
  statsDiv.className = 'st-modal-stats';
  for (let g = 1; g <= 4; g++) {
    const st = document.createElement('div');
    st.className = 'st-modal-stat';
    st.setAttribute('data-g', g);
    const sv = document.createElement('span');
    sv.className = 'sv';
    sv.textContent = cnts[g];
    st.appendChild(sv);
    st.appendChild(document.createTextNode(' ' + _GN[g]));
    statsDiv.appendChild(st);
  }
  // Total
  const totalSt = document.createElement('div');
  totalSt.className = 'st-modal-stat';
  const totalSv = document.createElement('span');
  totalSv.className = 'sv';
  totalSv.style.color = '#fff';
  totalSv.textContent = total;
  totalSt.appendChild(totalSv);
  totalSt.appendChild(document.createTextNode(' Всего'));
  statsDiv.appendChild(totalSt);
  // Avg time
  const avgSt = document.createElement('div');
  avgSt.className = 'st-modal-stat';
  const avgSv = document.createElement('span');
  avgSv.className = 'sv';
  avgSv.style.color = 'var(--st-muted)';
  avgSv.textContent = avgS + 'с';
  avgSt.appendChild(avgSv);
  avgSt.appendChild(document.createTextNode(' Ср. время'));
  statsDiv.appendChild(avgSt);
  box.appendChild(statsDiv);

  // Entries list
  entries.forEach(e => {
    const entry = document.createElement('div');
    entry.className = 'st-modal-entry';
    entry.setAttribute('data-grade', e.grade);

    const dt = document.createElement('span');
    dt.className = 'me-dt';
    dt.textContent = _fmtDate(e.date) + ' ' + _fmtTime(e.date);
    entry.appendChild(dt);

    const grade = document.createElement('span');
    grade.className = 'me-grade';
    grade.setAttribute('data-grade', e.grade);
    grade.textContent = _GN[e.grade];
    entry.appendChild(grade);

    if (e.duration) {
      const dur = document.createElement('span');
      dur.className = 'me-dur';
      dur.textContent = e.duration + 'с';
      entry.appendChild(dur);
    }

    box.appendChild(entry);
  });

  overlay.appendChild(box);
  document.body.appendChild(overlay);
};


