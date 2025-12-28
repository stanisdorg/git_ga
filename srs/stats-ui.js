import { getMetrics, calculateActivity, getCategoryProgress, checkAchievements, getCurrentLevel, getDailyPoints, getDailyPointsAll, getDailyStreakSeries } from './stats-utils.js';
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
  if (!location.hash || !location.hash.includes('stats')) {
    location.hash = '#/stats';
  }
}

function renderZoomXP() {
  const all = getDailyPointsAll();
  const wrap = document.createElement('div');
  wrap.className = 'zoom-chart-wrap';
  wrap.innerHTML = `
    <div class="zoom-controls">
      <button data-range="7">7д</button>
      <button data-range="30">30д</button>
      <button data-range="90">90д</button>
      <button data-range="180">180д</button>
      <button data-range="365">365д</button>
      <button data-range="all">Все</button>
    </div>
    <canvas id="xp-zoom-canvas" width="900" height="260" style="width:100%;height:260px;background:#1b1b1b;border:1px solid #333;border-radius:8px"></canvas>
  `;
  statsContainer.appendChild(wrap);
  const canvas = wrap.querySelector('#xp-zoom-canvas');
  const ctx = canvas.getContext('2d');
  let domainStart = 0;
  let domainEnd = all.length - 1;
  const margin = { l: 50, r: 20, t: 20, b: 40 };
  const draw = () => {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#1b1b1b'; ctx.fillRect(0,0,canvas.width,canvas.height);
    const w = canvas.width - margin.l - margin.r;
    const h = canvas.height - margin.t - margin.b;
    const view = all.slice(domainStart, domainEnd + 1);
    const max = Math.max(10, ...view.map(v => v.xp));
    const xScale = (i) => margin.l + (i - domainStart) * (w / Math.max(1,(domainEnd - domainStart)));
    const yScale = (xp) => margin.t + h - (xp / max) * h;
    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = margin.t + i * (h / 4);
      ctx.beginPath(); ctx.moveTo(margin.l, y); ctx.lineTo(canvas.width - margin.r, y); ctx.stroke();
    }
    ctx.fillStyle = '#3b82f6';
    view.forEach((v, i) => {
      const x = xScale(domainStart + i);
      const y = yScale(v.xp);
      const bw = Math.max(2, w / Math.max(1,(domainEnd - domainStart + 1)) - 2);
      ctx.fillRect(x, y, bw, margin.t + h - y);
    });
    ctx.fillStyle = '#e0e0e0'; ctx.textAlign = 'center'; ctx.font = '12px system-ui';
    const tickCount = Math.min(10, view.length);
    for (let i = 0; i < tickCount; i++) {
      const idx = Math.round(domainStart + i * ((domainEnd - domainStart) / Math.max(1,(tickCount - 1))));
      const x = xScale(idx);
      const d = all[idx]?.date || '';
      ctx.fillText(d, x, canvas.height - 18);
    }
    ctx.textAlign = 'left'; ctx.fillText(`XP (макс: ${Math.round(max)})`, margin.l + 4, margin.t - 6);
  };
  draw();
  let isDrag = false, dragStartX = 0, dragStartDomain = 0, dragWidthDomain = 0;
  canvas.addEventListener('mousedown', (e) => {
    isDrag = true; dragStartX = e.offsetX; dragStartDomain = domainStart; dragWidthDomain = domainEnd - domainStart;
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!isDrag) return;
    const dx = e.offsetX - dragStartX;
    const w = canvas.width - margin.l - margin.r;
    const deltaIdx = Math.round(-dx * (dragWidthDomain / Math.max(1,w)));
    let ns = Math.max(0, Math.min(all.length - dragWidthDomain - 1, dragStartDomain + deltaIdx));
    domainStart = ns;
    domainEnd = ns + dragWidthDomain;
    draw();
  });
  window.addEventListener('mouseup', () => { isDrag = false; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const dir = Math.sign(e.deltaY);
    const span = domainEnd - domainStart;
    const step = Math.max(1, Math.round(span * 0.1));
    if (dir > 0) { // zoom out
      domainStart = Math.max(0, domainStart - step);
      domainEnd = Math.min(all.length - 1, domainEnd + step);
    } else { // zoom in
      if (span > 10) {
        domainStart = Math.min(domainEnd - 5, domainStart + step);
        domainEnd = Math.max(domainStart + 5, domainEnd - step);
      }
    }
    draw();
  }, { passive: false });
  wrap.querySelectorAll('.zoom-controls button').forEach(btn => {
    btn.addEventListener('click', () => {
      const range = btn.getAttribute('data-range');
      if (range === 'all') { domainStart = 0; domainEnd = all.length - 1; }
      else {
        const n = parseInt(range, 10);
        domainEnd = all.length - 1; domainStart = Math.max(0, all.length - n);
      }
      draw();
    });
  });
}

export function hideStatsPage() {
  if (statsContainer) statsContainer.remove();
  if (mainContainer) mainContainer.style.display = '';
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.style.display = '';
  location.hash = '';
  const evt = new Event('statsClosed'); window.dispatchEvent(evt);
}

function renderStats() {
  let metrics, activity, top5, rest, achievements, level, dailyXP, dailyStreak;
  try {
    metrics = getMetrics(uniqueQaData);
  } catch { metrics = { streakCurrent: 0, streakBest: 0, accuracy: 0, studiedCount: 0, xp: 0 }; }
  try {
    activity = calculateActivity(30);
    ({ top5, rest } = getCategoryProgress(uniqueQaData));
  } catch { activity = []; top5 = []; rest = []; }
  try { achievements = checkAchievements(); } catch { achievements = {}; }
  try { level = getCurrentLevel(); } catch { level = { level: 1, xp: 0, remaining: 0, progress: 0, prevThreshold: 0, nextThreshold: 1000 }; }
  try { dailyXP = getDailyPoints(30); } catch { dailyXP = []; }
  try { dailyStreak = getDailyStreakSeries(); } catch { dailyStreak = []; }

  const emptyState = metrics.studiedCount === 0 ? `
    <div class="empty-state">Начните изучение, и мы покажем вашу статистику здесь.</div>
  ` : '';

  const accVal = Number.isFinite(metrics.accuracy) ? metrics.accuracy : 0;
  statsContainer.innerHTML = `
    <div class="stats-header">
      <button class="stats-close-btn" title="Домой" aria-label="Домой">
        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
        </svg>
      </button>
      <h1>Статистика</h1>
    </div>

    ${emptyState}

    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-title">LV:${level.level}</div>
        <div class="metric-value">${level.xp} <span class="metric-sub">до след.: ${level.remaining === 0 ? 'макс.' : level.remaining + ' XP'}</span></div>
      </div>
      <div class="metric-card">
        <div class="metric-title">Точность</div>
        <div class="metric-value">${accVal}%</div>
      </div>
      <div class="metric-card">
        <div class="metric-title">Стрик</div>
        <div class="metric-value">${metrics.streakCurrent} <span class="metric-sub">рекорд ${metrics.streakBest}</span></div>
      </div>
      <div class="metric-card">
        <div class="metric-title">XP</div>
        <div class="metric-value">${metrics.xp}</div>
      </div>
    </div>

    <div class="section">
      <h2>Активность (30 дней)</h2>
      <div class="activity-grid">
        ${activity.map(a => `<div class="activity-cell" data-date="${a.date}" data-xp="${a.xp}" title="${a.date}: ${a.count} карточек, ${a.xp} XP" style="background:${a.color}"></div>`).join('')}
      </div>
    </div>

    <div class="section">
      <h2>Гистограмма XP</h2>
      <div class="hist-controls" style="margin-bottom:8px;display:flex;gap:8px">
        <button data-mode="week">Неделя</button>
        <button data-mode="month">Месяц</button>
        <button data-mode="year">Год</button>
      </div>
      <div class="histogram-wrap"></div>
      <div class="zoom-container"></div>
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
  bindActivityTooltip();
  // Убрали нижний зум-график, оставляем только нормальную гистограмму
  const wrap = statsContainer.querySelector('.histogram-wrap');
  const controls = statsContainer.querySelectorAll('.hist-controls button');
  let mode = 'week';
  const renderMode = () => {
    const pts = aggregatePoints(mode);
    wrap.innerHTML = '';
    wrap.appendChild(renderHistogramCanvas(pts, dailyStreak));
  };
  controls.forEach(btn => {
    btn.addEventListener('click', () => {
      mode = btn.getAttribute('data-mode');
      renderMode();
    });
  });
  renderMode();
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

function bindActivityTooltip() {
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.style.position = 'fixed';
  tip.style.pointerEvents = 'none';
  tip.style.background = 'rgba(0,0,0,0.8)';
  tip.style.color = '#fff';
  tip.style.padding = '6px 8px';
  tip.style.borderRadius = '6px';
  tip.style.fontSize = '12px';
  tip.style.zIndex = '9999';
  tip.style.display = 'none';
  document.body.appendChild(tip);
  statsContainer.querySelectorAll('.activity-cell').forEach(cell => {
    cell.addEventListener('mouseenter', (e) => {
      const date = cell.getAttribute('data-date');
      const xp = cell.getAttribute('data-xp');
      tip.textContent = `${date} • ${xp} XP`;
      tip.style.display = 'block';
    });
    cell.addEventListener('mousemove', (e) => {
      tip.style.left = `${e.clientX + 12}px`;
      tip.style.top = `${e.clientY + 12}px`;
    });
    cell.addEventListener('mouseleave', () => {
      tip.style.display = 'none';
    });
  });
}

function renderHistogram(points, streakSeries) {
  const width = Math.max(360, 900), height = 260, barGap = 6;
  const maxXP = Math.max(10, ...points.map(p => (p.xp + (p.bonus||0) + (p.dayBonus||0))));
  const barW = Math.max(12, Math.floor((width - (points.length - 1) * barGap) / points.length));
  const chartH = height - 40;
  const gridStep = Math.max(5, Math.ceil(maxXP / 4));
  const gridMax = gridStep * 4;
  const gridLines = [];
  for (let yVal = gridStep; yVal <= gridMax; yVal += gridStep) {
    const y = height - 10 - Math.round((yVal / gridMax) * chartH);
    gridLines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#2b2b2b" stroke-dasharray="4 4"/>`);
    gridLines.push(`<text x="4" y="${y - 4}" fill="#666" font-size="12">${yVal}</text>`);
  }
  const bars = points.map((p, i) => {
    const total = p.xp + (p.bonus || 0) + (p.dayBonus || 0);
    const scaleMax = Math.max(gridMax, maxXP);
    const hBase = Math.round((p.xp / scaleMax) * chartH);
    const hDayBonus = Math.round(((p.dayBonus || 0) / scaleMax) * chartH);
    const hTotal = Math.round((total / scaleMax) * chartH);
    const hBonus = Math.max(0, hTotal - hBase - hDayBonus);
    const x = i * (barW + barGap);
    const yBase = height - hBase - 10;
    const yBonus = yBase - hBonus;
    const yDayBonus = yBonus - hDayBonus;
    const streakVal = (streakSeries.find(s => s.date === p.date) || { streak: 0 }).streak;
    const emptyBar = total === 0 ? `<rect x="${x}" y="${height - 26}" width="${barW}" height="16" rx="4" fill="#3b4a66" opacity="0.7"></rect>` : '';
    const label = p.date.includes('W') ? p.date : p.date.slice(5);
    return `
      <g class="bar-group" data-date="${p.date}" data-xp="${p.xp}" data-bonus="${p.bonus || 0}" data-daily-bonus="${p.dayBonus || 0}" data-streak="${streakVal}">
        ${emptyBar}
        <rect x="${x}" y="${yBase}" width="${barW}" height="${hBase}" rx="3" fill="#1d4ed8"></rect>
        <rect x="${x}" y="${yBonus}" width="${barW}" height="${hBonus}" rx="3" fill="#8b5cf6"></rect>
        <rect x="${x}" y="${yDayBonus}" width="${barW}" height="${hDayBonus}" rx="3" fill="#67e8f9"></rect>
        <text x="${x + barW / 2}" y="${height - 2}" fill="#8a8a8a" font-size="12" text-anchor="middle">${label}</text>
      </g>
    `;
  }).join('');
  const svg = document.createElement('svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', `${height}`);
  svg.setAttribute('style', 'background:#0f1b26;border:1px solid #23313d;border-radius:8px');
  svg.innerHTML = `<g>${gridLines.join('')}${bars}</g>`;
  const wrap = document.createElement('div');
  wrap.className = 'xp-chart';
  wrap.appendChild(svg);
  // Tooltip
  const tip = document.createElement('div');
  tip.style.position = 'fixed'; tip.style.pointerEvents = 'none';
  tip.style.background = 'rgba(0,0,0,0.85)'; tip.style.color = '#fff';
  tip.style.padding = '6px 8px'; tip.style.borderRadius = '6px'; tip.style.fontSize = '12px'; tip.style.zIndex = '9999'; tip.style.display = 'none';
  document.body.appendChild(tip);
  svg.querySelectorAll('.bar-group').forEach(g => {
    g.addEventListener('mouseenter', (e) => {
      const d = g.getAttribute('data-date');
      const xp = g.getAttribute('data-xp');
      const bn = g.getAttribute('data-bonus');
      const db = g.getAttribute('data-daily-bonus');
      const st = g.getAttribute('data-streak');
      const total = (parseInt(xp||'0') + parseInt(bn||'0') + parseInt(db||'0'));
      tip.textContent = `${d} • XP:${xp} • Бонус стрик:${bn} • Дневной бонус:${db} • Стрик дней:${st} • Всего:${total}`;
      tip.style.display = 'block';
      g.querySelectorAll('rect').forEach(r => r.setAttribute('transform', 'scale(1.04)'));
    });
    g.addEventListener('mousemove', (e) => {
      tip.style.left = `${e.clientX + 12}px`; tip.style.top = `${e.clientY + 12}px`;
    });
    g.addEventListener('mouseleave', () => {
      tip.style.display = 'none';
      g.querySelectorAll('rect').forEach(r => r.removeAttribute('transform'));
    });
  });
  return wrap;
}

function aggregatePoints(mode) {
  if (mode === 'week') {
    return getDailyPoints(7);
  }
  if (mode === 'month') {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return getDailyPoints(daysInMonth);
  }
  if (mode === 'year') {
    const all = getDailyPointsAll();
    const map = new Map();
    all.forEach(p => {
      const d = new Date(p.date);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const v = map.get(key) || { xp: 0, bonus: 0, dayBonus: 0 };
      v.xp += p.xp; v.bonus += (p.bonus || 0); v.dayBonus += (p.dayBonus || 0);
      map.set(key, v);
    });
    const out = Array.from(map.entries()).map(([date, v]) => ({ date, xp: v.xp, bonus: v.bonus, dayBonus: v.dayBonus }));
    out.sort((a, b) => a.date.localeCompare(b.date));
    return out.slice(-12);
  }
  return getDailyPoints(30);
}

function renderHistogramCanvas(points, streakSeries) {
  const widthCSS = 900, heightCSS = 260;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.floor(widthCSS * dpr);
  const height = Math.floor(heightCSS * dpr);
  const padding = Math.floor(20 * dpr);
  const chartH = height - padding * 2;
  const chartW = width - padding * 2;
  const gap = Math.floor(18 * dpr);
  const totals = points.map(p => p.xp + (p.bonus || 0) + (p.dayBonus || 0));
  const maxXP = Math.max(10, ...totals);
  const barWMin = Math.floor(4 * dpr);
  const gridStep = Math.max(5, Math.ceil(maxXP / 4));
  const gridMax = gridStep * 4;
  const wrap = document.createElement('div');
  wrap.className = 'xp-chart';
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.style.width = `${widthCSS}px`; canvas.style.height = `${heightCSS}px`;
  wrap.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0f1b26'; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#23313d'; ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
  ctx.translate(padding, padding);
  ctx.setLineDash([4 * dpr, 4 * dpr]);
  ctx.strokeStyle = '#2b2b2b'; ctx.fillStyle = '#666'; ctx.font = `${12 * dpr}px sans-serif`;
  for (let yVal = gridStep; yVal <= gridMax; yVal += gridStep) {
    const y = chartH - Math.round((yVal / gridMax) * chartH);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(chartW, y); ctx.stroke();
    ctx.fillText(String(yVal), 4 * dpr, y - 4 * dpr);
  }
  ctx.setLineDash([]);
  const scaleMax = Math.max(gridMax, maxXP);
  const labelWidth = Math.ceil(ctx.measureText(String(gridMax)).width);
  const extraLeft = Math.floor(labelWidth + 50 * dpr);
  const chartWBars = Math.max(0, chartW - extraLeft);
  const barW = Math.max(barWMin, Math.floor((chartWBars - (points.length - 1) * gap) / points.length / 3));
  const barRects = [];
  points.forEach((p, i) => {
    const total = p.xp + (p.bonus || 0) + (p.dayBonus || 0);
    const hBase = Math.round((p.xp / scaleMax) * chartH);
    const hDay = Math.round(((p.dayBonus || 0) / scaleMax) * chartH);
    const hTotal = Math.round((total / scaleMax) * chartH);
    const hBonus = Math.max(0, hTotal - hBase - hDay);
    const x = extraLeft + i * (barW + gap);
    const yBase = chartH - hBase;
    const yBonus = yBase - hBonus;
    const yDay = yBonus - hDay;
    if (total === 0) {
      ctx.fillStyle = '#3b4a66';
      const h = Math.floor(16 * dpr);
      const y = chartH - h - Math.floor(8 * dpr);
      ctx.beginPath(); ctx.roundRect(x, y, barW, h, Math.floor(4 * dpr)); ctx.fill();
    }
    ctx.fillStyle = '#1d4ed8'; ctx.beginPath(); ctx.roundRect(x, yBase, barW, hBase, Math.floor(3 * dpr)); ctx.fill();
    ctx.fillStyle = '#8b5cf6'; ctx.beginPath(); ctx.roundRect(x, yBonus, barW, hBonus, Math.floor(3 * dpr)); ctx.fill();
    ctx.fillStyle = '#67e8f9'; ctx.beginPath(); ctx.roundRect(x, yDay, barW, hDay, Math.floor(3 * dpr)); ctx.fill();
    ctx.fillStyle = '#8a8a8a'; ctx.textAlign = 'center';
    ctx.fillText(p.date.includes('W') ? p.date : p.date.slice(5), x + barW / 2, chartH + Math.floor(18 * dpr));
    barRects.push({
      x, y: yDay, w: barW, h: (hBase + hBonus + hDay),
      data: { date: p.date, xp: p.xp, bonus: p.bonus || 0, dayBonus: p.dayBonus || 0,
        streak: (streakSeries.find(s => s.date === p.date) || { streak: 0 }).streak }
    });
  });
  const tip = document.createElement('div');
  tip.style.position = 'fixed'; tip.style.pointerEvents = 'none';
  tip.style.background = 'rgba(0,0,0,0.85)'; tip.style.color = '#fff';
  tip.style.padding = '6px 8px'; tip.style.borderRadius = '6px'; tip.style.fontSize = '12px'; tip.style.zIndex = '9999'; tip.style.display = 'none';
  document.body.appendChild(tip);
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (width / rect.width) - padding;
    const cy = (e.clientY - rect.top) * (height / rect.height) - padding;
    const hit = barRects.find(b => cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h);
    if (hit) {
      const d = hit.data;
      const total = d.xp + d.bonus + d.dayBonus;
      tip.textContent = `${d.date} • XP:${d.xp} • Бонус стрик:${d.bonus} • Дневной бонус:${d.dayBonus} • Стрик дней:${d.streak} • Всего:${total}`;
      tip.style.display = 'block';
      tip.style.left = `${e.clientX + 12}px`;
      tip.style.top = `${e.clientY + 12}px`;
    } else {
      tip.style.display = 'none';
    }
  });
  canvas.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
  return wrap;
}
