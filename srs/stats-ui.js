import { getMetrics, calculateActivity, getCategoryProgress, checkAchievements, getCurrentLevel } from './stats-utils.js';
import { uniqueQaData } from '../all-data.js';

let statsContainer = null;
let mainContainer = null;

export function initStatsPage() {
  if (!document.getElementById('stats-container')) {
    const appWrapper = document.querySelector('.app-wrapper') || document.body;
    statsContainer = document.createElement('div');
    statsContainer.id = 'stats-container';
    statsContainer.className = 'stats-page';
    appWrapper.appendChild(statsContainer);
  }
  mainContainer = document.querySelector('.container');
  if (mainContainer) mainContainer.style.display = 'none';
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.style.display = 'none';
  renderStats();
  history.replaceState({}, '', '/stats');
}

export function hideStatsPage() {
  if (statsContainer) statsContainer.remove();
  if (mainContainer) mainContainer.style.display = '';
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.style.display = '';
  history.replaceState({}, '', '/');
}

function renderStats() {
  const metrics = getMetrics(uniqueQaData);
  const activity = calculateActivity(30);
  const { top5, rest } = getCategoryProgress(uniqueQaData);
  const achievements = checkAchievements();
  const level = getCurrentLevel();

  const emptyState = metrics.studiedCount === 0 ? `
    <div class="empty-state">Начните изучение, и мы покажем вашу статистику здесь.</div>
  ` : '';

  statsContainer.innerHTML = `
    <div class="stats-header">
      <h1>Статистика</h1>
      <button class="stats-close-btn">Назад</button>
    </div>

    ${emptyState}

    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-title">Стрик</div>
        <div class="metric-value">${metrics.streakCurrent} <span class="metric-sub">рекорд ${metrics.streakBest}</span></div>
      </div>
      <div class="metric-card">
        <div class="metric-title">Точность</div>
        <div class="metric-value">${metrics.accuracy}%</div>
      </div>
      <div class="metric-card">
        <div class="metric-title">Изучено</div>
        <div class="metric-value">${metrics.studiedCount}</div>
      </div>
      <div class="metric-card">
        <div class="metric-title">XP</div>
        <div class="metric-value">${metrics.xp}</div>
      </div>
    </div>

    <div class="section">
      <h2>Активность (30 дней)</h2>
      <div class="activity-grid">
        ${activity.map(a => `<div class="activity-cell" title="${a.date}: ${a.count}" style="background:${a.color}"></div>`).join('')}
      </div>
    </div>

    <div class="section">
      <h2>Прогресс по категориям</h2>
      <div class="categories-grid">
        ${top5.map(c => categoryBar(c)).join('')}
        ${rest.length ? `<details><summary>Остальные</summary>${rest.map(c => categoryBar(c)).join('')}</details>` : ''}
      </div>
    </div>

    <div class="section">
      <h2>Достижения</h2>
      <div class="achievements-grid">
        ${achievementCard('Первые шаги', 'Завершите первую сессию', achievements.firstSessionCompleted)}
        ${achievementCard('Неделя силы', 'Стрик 7 дней', achievements.sevenDayStreak)}
        ${achievementCard('Точность 90%', 'Средняя точность ≥ 90%', achievements.ninetyAccuracy)}
        ${achievementCard('Изучено 50 карточек', 'Уникальных карточек ≥ 50', achievements.fiftyCards)}
        ${achievementCard('Ночная сова', 'Учитесь после 23:00', achievements.nightOwl)}
      </div>
    </div>

    <div class="section">
      <h2>Уровень</h2>
      <div class="level-box">
        <div class="level-title">Уровень ${level.level}</div>
        <div class="level-progress-bar"><div class="level-progress-fill" style="width:${Math.round(level.progress*100)}%"></div></div>
        <div class="level-sub">До следующего: ${level.remaining === 0 ? 'макс.' : level.remaining + ' XP'}</div>
      </div>
    </div>
  `;

  statsContainer.querySelector('.stats-close-btn').addEventListener('click', hideStatsPage);
}

function categoryBar(c) {
  return `
    <div class="category-item">
      <div class="category-title">${c.category}</div>
      <div class="category-progress-bar">
        <div class="category-progress-fill" style="width:${c.percent}%"></div>
      </div>
      <div class="category-sub">${c.studied}/${c.total} (${c.percent}%)</div>
    </div>
  `;
}

function achievementCard(title, desc, unlocked) {
  const icon = unlocked ? '🏆' : '🔒';
  return `
    <div class="achievement-card ${unlocked ? 'unlocked' : ''}">
      <div class="achievement-icon">${icon}</div>
      <div class="achievement-title">${title}</div>
      <div class="achievement-desc">${desc}</div>
    </div>
  `;
}

