import { LearningSession } from './session.js';
import { getDueCards, syncFavorite } from './storage.js';
import { checkAchievements } from './stats-utils.js';
import { syncDailyStats } from './storage.js';

// DOM Elements
let container = null;
let mainContainer = null; // The app's main container to hide/show
let session = null;

const starSvg = (filled) => `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
            style="fill: ${filled ? '#ffd700' : 'none'}; stroke: ${filled ? '#ffd700' : 'currentColor'}; stroke-width: 2px;"
        />
    </svg>
`;

export function initLearnUI() {
    // Create Learn Container if not exists
    if (!document.getElementById('learn-container')) {
        const appWrapper = document.querySelector('.app-wrapper') || document.body;
        container = document.createElement('div');
        container.id = 'learn-container';
        container.style.display = 'none';
        container.innerHTML = `
            <div class="learn-header">
                <button id="learn-exit-btn">✕ Выход</button>
                <div class="learn-progress">
                    <div class="learn-progress-bar">
                        <div class="learn-progress-segments" id="learn-segments"></div>
                        <div class="learn-progress-fill"></div>
                    </div>
                    <span id="learn-counter">0/0</span>
                </div>
            </div>
            
            <div class="flashcard-container">
                <div class="flashcard">
                    <div class="flashcard-front" style="position:relative">
                        <button class="favorite-btn learn-fav-btn" title="В избранное" style="top:10px;right:10px;z-index:10"></button>
                        <div class="flashcard-content" id="learn-question"></div>
                        <div class="flashcard-hint">Нажмите Пробел, чтобы увидеть ответ</div>
                    </div>
                    <div class="flashcard-back" style="position:relative">
                        <button class="favorite-btn learn-fav-btn" title="В избранное" style="top:10px;right:10px;z-index:10"></button>
                        <div class="flashcard-content" id="learn-answer"></div>
                        <div class="flashcard-actions">
                            <button class="rate-btn rate-again" data-grade="0">Снова (1)</button>
                            <button class="rate-btn rate-hard" data-grade="1">Трудно (2)</button>
                            <button class="rate-btn rate-good" data-grade="2">Хорошо (3)</button>
                            <button class="rate-btn rate-easy" data-grade="3">Легко (4)</button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="learn-stats" style="display:none">
                <h2>Сессия завершена!</h2>
                <div class="stats-grid">
                    <div class="stat-item"><span>Всего:</span> <span id="stat-total">0</span></div>
                    <div class="stat-item"><span>Снова:</span> <span id="stat-again">0</span></div>
                    <div class="stat-item"><span>Трудно:</span> <span id="stat-hard">0</span></div>
                    <div class="stat-item"><span>Хорошо:</span> <span id="stat-good">0</span></div>
                    <div class="stat-item"><span>Легко:</span> <span id="stat-easy">0</span></div>
                </div>
                <button id="learn-finish-btn" class="primary-btn">Вернуться к списку</button>
            </div>
        `;
        appWrapper.appendChild(container);

        // Bind Events
        document.getElementById('learn-exit-btn').addEventListener('click', stopLearnSession);
        document.getElementById('learn-finish-btn').addEventListener('click', stopLearnSession);
        
        container.querySelector('.flashcard').addEventListener('click', () => {
            if (session && !session.isFlipped) session.flip();
        });

        // Favorite buttons
        container.querySelectorAll('.learn-fav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!session || !session.currentCard) return;

                const question = session.currentCard.question;
                const favs = JSON.parse(localStorage.getItem('qaFavorites') || '[]');
                const index = favs.indexOf(question);
                let newIsFav = false;

                if (index === -1) {
                    favs.push(question);
                    newIsFav = true;
                } else {
                    favs.splice(index, 1);
                    newIsFav = false;
                }

                localStorage.setItem('qaFavorites', JSON.stringify(favs));
                syncFavorite(question, newIsFav);

                // Update all buttons (both front and back)
                container.querySelectorAll('.learn-fav-btn').forEach(b => {
                    b.innerHTML = starSvg(newIsFav);
                    b.classList.toggle('active', newIsFav);
                });
            });
        });

        // Rating buttons
        const rates = container.querySelectorAll('.rate-btn');
        rates.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const grade = parseInt(btn.dataset.grade);
                if (session) session.rate(grade);
            });
        });

        // Hotkeys
        document.addEventListener('keydown', handleKeydown);
    }
    
    mainContainer = document.querySelector('.container');
}

function handleKeydown(e) {
    if (container.style.display === 'none') return;
    
    if (e.code === 'Space' || e.code === 'Enter') {
        if (session && !session.isFlipped) {
            e.preventDefault(); // Prevent scrolling
            session.flip();
        }
    } else if (session && session.isFlipped) {
        if (e.key === '1') session.rate(0);
        if (e.key === '2') session.rate(1);
        if (e.key === '3') session.rate(2);
        if (e.key === '4') session.rate(3);
    }
}

/**
 * Starts a learning session with the given list of candidate questions.
 * @param {Array} candidateQuestions 
 */
export function startLearnSession(candidateQuestions) {
    initLearnUI(); // Ensure UI exists
    window.__lastCandidates = candidateQuestions;

    // Filter due cards
    const dueCards = getDueCards(candidateQuestions);
    
    // Limit new cards? User said "limit 10-15". 
    // Let's implement a soft limit: if more than 15 NEW cards, take only 15.
    // Existing due cards (reviews) should all be shown.
    const reviews = dueCards.filter(c => !c.isNew);
    let newCards = dueCards.filter(c => c.isNew);
    
    if (newCards.length > 15) {
        newCards = newCards.slice(0, 15);
    }
    
    let sessionCards = [...reviews, ...newCards];
    // Ensure total count between 15 and 18
    const target = Math.min(18, Math.max(15, sessionCards.length));
    sessionCards = sessionCards.slice(0, target);
    
    if (sessionCards.length === 0) {
        alert('Нет карточек для изучения на сегодня!');
        return;
    }

    // Hide main UI, Show Learn UI
    if (mainContainer) mainContainer.style.display = 'none';
    // Hide sidebar if exists
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.style.display = 'none';
    
    container.style.display = 'flex';
    document.getElementById('learn-stats').style.display = 'none';
    container.querySelector('.flashcard-container').style.display = 'flex';
    // Reset progress UI for new session
    const segs = document.getElementById('learn-segments');
    const progressFill = container.querySelector('.learn-progress-fill');
    if (progressFill) progressFill.style.width = '0%';

    // Start Session
    session = new LearningSession(
        sessionCards,
        renderCardState,
        showStats
    );
    // Build fresh segments for the new session size
    if (segs) {
        segs.innerHTML = '';
        for (let i = 0; i < sessionCards.length; i++) {
            const s = document.createElement('div');
            s.className = 'learn-progress-segment';
            segs.appendChild(s);
        }
    }
    session.start();
}

function stopLearnSession() {
    container.style.display = 'none';
    if (mainContainer) mainContainer.style.display = 'block'; // Or whatever flex/grid it was
    // Restore sidebar
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.style.display = '';
    
    session = null;
}

function renderCardState(state) {
    const cardEl = container.querySelector('.flashcard');
    const front = container.querySelector('.flashcard-front');
    const back = container.querySelector('.flashcard-back');
    const qEl = document.getElementById('learn-question');
    const aEl = document.getElementById('learn-answer');
    const counter = document.getElementById('learn-counter');
    const progressFill = container.querySelector('.learn-progress-fill');
    const segs = document.getElementById('learn-segments');

    qEl.textContent = state.card.question;
    aEl.textContent = state.card.answer;
    
    counter.textContent = `${state.progress}/${state.total}`;
    progressFill.style.width = `${(state.progress / state.total) * 100}%`;
    // Build segments once
    if (segs && segs.childElementCount !== state.total) {
        segs.innerHTML = '';
        for (let i = 0; i < state.total; i++) {
            const s = document.createElement('div');
            s.className = 'learn-progress-segment';
            segs.appendChild(s);
        }
    }
    // Reset segments at the start of a new session or when no results yet
    if (segs && (!state.results || state.results.length === 0)) {
        for (let i = 0; i < segs.childElementCount; i++) {
            const el = segs.children[i];
            el.className = 'learn-progress-segment';
        }
    }
    // Color segments by results
    if (segs && state.results && state.results.length) {
        state.results.forEach((g, idx) => {
            const el = segs.children[idx];
            if (!el) return;
            el.className = 'learn-progress-segment';
            if (g === 0) el.classList.add('seg-again');
            else if (g === 1) el.classList.add('seg-hard');
            else if (g === 2) el.classList.add('seg-good');
            else if (g === 3) el.classList.add('seg-easy');
        });
    }

    // Update favorite button state
    const favs = JSON.parse(localStorage.getItem('qaFavorites') || '[]');
    const isFav = favs.includes(state.card.question);
    container.querySelectorAll('.learn-fav-btn').forEach(btn => {
        btn.innerHTML = starSvg(isFav);
        if (isFav) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    if (state.isFlipped) {
        cardEl.classList.add('flipped');
    } else {
        cardEl.classList.remove('flipped');
    }
}

function showStats(stats) {
    container.querySelector('.flashcard-container').style.display = 'none';
    checkAchievements();
    let overlay = document.getElementById('session-summary-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'session-summary-overlay';
        overlay.className = 'summary-overlay';
        overlay.innerHTML = `
            <div class="summary-box">
                <div id="sum-level" class="level-inline" style="margin-bottom:8px;font-weight:600;"></div>
                <div class="level-progress-bar">
                    <div class="level-progress-fill level-progress-fill-old" style="left:0;width:0%"></div>
                    <div class="level-progress-fill level-progress-fill-earned" style="left:0;width:0%"></div>
                    <div class="level-progress-fill level-progress-fill-bonus" style="left:0;width:0%"></div>
                </div>
                <div class="stats">
                    <div class="stat" id="stat-total">
                        <div class="stat-value" id="sum-total">0</div>
                        <div class="stat-label">Повторено</div>
                    </div>
                    <div class="stat" id="stat-accuracy">
                        <div class="stat-value" id="sum-accuracy">0%</div>
                        <div class="stat-label">Точность</div>
                    </div>
                    <div class="stat" id="stat-streak">
                        <div class="stat-value" id="sum-streak">0</div>
                        <div class="stat-label">Дней<br/>подряд</div>
                    </div>
                </div>
                <div class="motivation" id="sum-motivation"></div>
                <div id="sum-xp" class="xp-line"></div>
                <div class="summary-actions">
                    <button id="sum-continue" class="btn btn-green" title="Продолжить" aria-label="Продолжить">Продолжить</button>
                    <button id="sum-exit" class="btn btn-red" title="Выйти" aria-label="Выйти">Выйти</button>
                    <button id="sum-stats" class="btn btn-dark" title="Статистика" aria-label="Статистика">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="3" y="3" width="4" height="18" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="17" y="13" width="4" height="8" rx="1"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        container.appendChild(overlay);
        overlay.querySelector('#sum-exit').addEventListener('click', () => {
            stopLearnSession();
            overlay.remove();
        });
        overlay.querySelector('#sum-continue').addEventListener('click', () => {
            overlay.classList.remove('show');
            if (window.__lastCandidates) {
                startLearnSession(window.__lastCandidates);
            }
        });
        overlay.querySelector('#sum-stats').addEventListener('click', async () => {
            overlay.classList.remove('show');
            window.__overlayActive = true;
            // Скрываем контейнер обучения, чтобы статистика была поверх
            if (container) container.style.display = 'none';
            const { initStatsPage } = await import('./stats-ui.js');
            location.hash = '#/stats';
            initStatsPage();
        });
        window.addEventListener('statsClosed', () => {
            if (window.__overlayActive) {
                // Возвращаем контейнер обучения и модалку
                if (container) container.style.display = 'flex';
                overlay.classList.add('show');
                window.__overlayActive = false;
            }
        }, { once: true });
    }
    const statsRaw = localStorage.getItem('studyStats') || '{}';
    const s = (() => { try { return JSON.parse(statsRaw); } catch { return {}; } })();
    const streakRaw = localStorage.getItem('studyStreak') || '{}';
    const st = (() => { try { return JSON.parse(streakRaw); } catch { return {}; } })();
    const correctSession = stats.good + stats.easy;
    const accuracy = stats.reviewed > 0 ? Math.round((correctSession / stats.reviewed) * 100) : 0;
    overlay.querySelector('#sum-total').textContent = String(stats.reviewed);
    const accEl = overlay.querySelector('#sum-accuracy');
    accEl.textContent = `${accuracy}%`;
    accEl.classList.remove('acc-good','acc-mid','acc-bad');
    accEl.classList.add(accuracy >= 80 ? 'acc-good' : accuracy >= 50 ? 'acc-mid' : 'acc-bad');
    overlay.querySelector('#sum-streak').textContent = String(st.current || 0);
    overlay.querySelector('#sum-motivation').textContent = accuracy > 80 ? 'Отлично! 💪' : 'Продолжайте! 🚀';
    const earned = session.stats.pointsEarned || 0;
    const bonus = Math.min(100, (st.current || 0) * 5);
    const dayBonus = bonus > 0 ? Math.min(5, bonus) : 0;
    const streakBonus = Math.max(0, bonus - dayBonus);
    overlay.querySelector('#sum-xp').textContent = `+${earned} XP • бонусы: день +${dayBonus} XP, стрик +${streakBonus} XP`;
    // Apply bonus split to stats and daily points
    const todayKey = (() => {
        try {
            const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' });
            const parts = fmt.formatToParts(new Date());
            const y = parts.find(p => p.type === 'year')?.value || '0000';
            const m = parts.find(p => p.type === 'month')?.value || '01';
            const d = parts.find(p => p.type === 'day')?.value || '01';
            return `${y}-${m}-${d}`;
        } catch { return new Date().toISOString().split('T')[0]; }
    })();
    s.points = (s.points || 0) + bonus;
    localStorage.setItem('studyStats', JSON.stringify(s));
    const dpRaw2 = localStorage.getItem('dailyPoints') || '{}';
    const daily2 = (() => { try { return JSON.parse(dpRaw2); } catch { return {}; } })();
    daily2[todayKey] = (daily2[todayKey] || 0) + bonus;
    localStorage.setItem('dailyPoints', JSON.stringify(daily2));
    const dbRaw = localStorage.getItem('dailyBonusPoints') || '{}';
    const dBonus = (() => { try { return JSON.parse(dbRaw); } catch { return {}; } })();
    dBonus[todayKey] = (dBonus[todayKey] || 0) + streakBonus;
    localStorage.setItem('dailyBonusPoints', JSON.stringify(dBonus));
    const ddRaw = localStorage.getItem('dailyDayBonusPoints') || '{}';
    const dDay = (() => { try { return JSON.parse(ddRaw); } catch { return {}; } })();
    dDay[todayKey] = (dDay[todayKey] || 0) + dayBonus;
    localStorage.setItem('dailyDayBonusPoints', JSON.stringify(dDay));
    syncDailyStats(todayKey, daily2[todayKey] || 0, dBonus[todayKey] || 0, dDay[todayKey] || 0, st.current || 0);
    try { window.dispatchEvent(new Event('xpUpdated')); } catch {}
    // Level info on top
    import('./stats-utils.js').then(({ getCurrentLevel }) => {
        const lvl = getCurrentLevel();
        overlay.querySelector('#sum-level').textContent = `LV:${lvl.level} • ${lvl.xp} XP`;
        const startXP = session.startXP || 0;
        const earned = session.stats.pointsEarned || 0;
        const streakRaw = localStorage.getItem('studyStreak') || '{}';
        const st = (() => { try { return JSON.parse(streakRaw); } catch { return {}; } })();
        const bonus = Math.min(100, (st.current || 0) * 5);
        const prev = lvl.prevThreshold;
        const next = lvl.nextThreshold;
        const pct = (v) => next === Infinity ? 1 : Math.max(0, Math.min(1, (v - prev) / (next - prev)));
        const startPct = pct(startXP);
        const earnedPct = Math.max(0, pct(startXP + earned) - startPct);
        const bonusPct = Math.max(0, pct(startXP + earned + bonus) - pct(startXP + earned));
        const bar = overlay.querySelector('.level-progress-bar');
        const oldW = Math.round(startPct * 100);
        const earnW = Math.round(earnedPct * 100);
        const bonusW = Math.round(bonusPct * 100);
        const oldEl = bar.querySelector('.level-progress-fill-old');
        const earnEl = bar.querySelector('.level-progress-fill-earned');
        const bonusEl = bar.querySelector('.level-progress-fill-bonus');
        oldEl.style.width = `${oldW}%`;
        earnEl.style.left = `${oldW}%`;
        bonusEl.style.left = `${oldW}%`;
        // Запуск анимаций (замедлить до ~1.5s)
        earnEl.classList.add('animate');
        bonusEl.classList.add('animate');
        earnEl.style.transition = 'width 1500ms ease';
        bonusEl.style.transition = 'width 1500ms ease';
        setTimeout(() => {
            earnEl.style.width = `${earnW}%`;
            setTimeout(() => {
                bonusEl.style.left = `${oldW + earnW}%`;
                bonusEl.style.width = `${bonusW}%`;
            }, 1500);
        }, 100); // небольшая задержка перед началом
    }).catch(() => {});
    // Animate overlay and stats
    overlay.classList.add('show');
    // Скрыть всё, затем показать по таймлайну
    const totalEl = overlay.querySelector('#stat-total');
    const accWrap = overlay.querySelector('#stat-accuracy');
    const streakWrap = overlay.querySelector('#stat-streak');
    const motEl = overlay.querySelector('#sum-motivation');
    const xpEl = overlay.querySelector('#sum-xp');
    const actions = overlay.querySelector('.summary-actions');
    [totalEl, accWrap, streakWrap, motEl, xpEl, actions].forEach(el => { if (el) el.style.display = 'none'; });
    // Появление после заполнения шкалы
    setTimeout(() => {
        totalEl.style.display = '';
        totalEl.classList.add('glitch-in');
        setTimeout(() => {
            accWrap.style.display = '';
            accWrap.classList.add('glitch-in');
            setTimeout(() => {
                streakWrap.style.display = '';
                streakWrap.classList.add('glitch-in');
                setTimeout(() => {
                    motEl.style.display = '';
                    motEl.classList.add('fade-in');
                    setTimeout(() => {
                        xpEl.style.display = '';
                        xpEl.classList.add('fade-in');
                        setTimeout(() => {
                            actions.style.display = '';
                            actions.classList.add('fade-in');
                        }, 300);
                    }, 300);
                }, 300);
            }, 300);
        }, 300);
    }, 1600); // ~1.5с на шкалу + запас
}
