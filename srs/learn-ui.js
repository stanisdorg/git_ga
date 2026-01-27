import { LearningSession } from './session.js';
import { getDueCards, syncFavorite, syncDailyStats, getProgressMap } from './storage.js';
import { checkAchievements } from './stats-utils.js?v=3';
import { Scheduler } from './scheduler.js?v=2';
import { getTodaysSession } from './category-scheduler.js';

// DOM Elements
let container = null;
let mainContainer = null; // The app's main container to hide/show
let session = null;
let currentScheduler = null;
let timerInterval = null;
let sessionTimerStart = 0;

const starSvg = (filled) => `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
            style="fill: ${filled ? '#ffd700' : 'none'} !important; stroke: ${filled ? '#ffd700' : 'currentColor'} !important; stroke-width: 2px;"
        />
    </svg>
`;

export function initLearnUI() {
    // Check if container already exists (from previous session or reload)
    container = document.getElementById('learn-container');
    
    // Create Learn Container if not exists
    if (!container) {
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
                    <div class="flashcard-front">
                        <button class="favorite-btn learn-fav-btn" title="В избранное" style="top:10px;right:10px;z-index:10"></button>
                        <div class="learn-hearts" style="position:absolute; top:12px; right:45px; display:flex; gap:2px; z-index:9"></div>
                        <div class="flashcard-content" id="learn-question"></div>
                        <div class="flashcard-hint">Нажмите Пробел, чтобы увидеть ответ</div>
                    </div>
                    <div class="flashcard-back">
                        <button class="favorite-btn learn-fav-btn" title="В избранное" style="top:10px;right:10px;z-index:10"></button>
                        <div class="learn-hearts" style="position:absolute; top:12px; right:45px; display:flex; gap:2px; z-index:9"></div>
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
                window.dispatchEvent(new Event('favoritesUpdated'));

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

// Stub for Smart Pause feature to prevent errors
// function showSmartPause(recommendation) {
//    if (!recommendation) return;
//    console.log('[SmartPause] Recommendation:', recommendation);
//    // Auto-resume for now to avoid blocking UI without modal implementation
//    if (session) session.resumeFromPause();
//}

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
export function startLearnSession(candidateQuestions, options = {}) {
    initLearnUI(); // Ensure UI exists

    // Filter out invalid cards to prevent empty screens
    if (candidateQuestions && Array.isArray(candidateQuestions)) {
        const originalCount = candidateQuestions.length;
        candidateQuestions = candidateQuestions.filter(q => q && q.question && q.answer);
        if (candidateQuestions.length < originalCount) {
            console.warn(`Filtered out ${originalCount - candidateQuestions.length} invalid cards (missing question/answer)`);
        }
    }

    window.__lastCandidates = candidateQuestions;

    // Initialize Scheduler
    currentScheduler = new Scheduler(candidateQuestions.length);
    const status = currentScheduler.getScheduleStatus();

    // Inject/Update Header Info safely
    let infoEl = document.getElementById('learn-schedule-info');
    if (!infoEl) {
        // If not exists, create it and insert it after the exit button
        const btn = document.getElementById('learn-exit-btn');
        if (btn && btn.parentNode) {
            infoEl = document.createElement('span');
            infoEl.id = 'learn-schedule-info';
            infoEl.className = 'schedule-info';
            infoEl.style.marginLeft = '16px';
            infoEl.style.fontSize = '14px';
            infoEl.style.color = 'var(--color-text-secondary)';
            // Insert after button
            btn.parentNode.insertBefore(infoEl, btn.nextSibling);
        }
    }
    if (infoEl) {
        if (options.mode === 'cram') {
            infoEl.textContent = `Углубленное обучение • ${candidateQuestions.length} карт`;
        } else {
            infoEl.textContent = `День ${status.dayNumber}/${status.totalDays} • Прогресс ${status.progressPercent}%`;
        }
    }

    // Initialize Session Timer UI
    let timerEl = document.getElementById('learn-timer');
    if (!timerEl) {
        timerEl = document.createElement('div');
        timerEl.id = 'learn-timer';
        timerEl.style.marginLeft = 'auto';
        timerEl.style.marginRight = '16px';
        timerEl.style.fontSize = '14px';
        timerEl.style.fontFamily = 'monospace';
        timerEl.style.color = 'var(--color-text-secondary)';
        timerEl.style.fontWeight = '600';
        
        const btn = document.getElementById('learn-exit-btn');
        if (btn && btn.parentNode) {
            btn.parentNode.insertBefore(timerEl, btn);
        }
    }
    
    // Start Timer
    if (timerInterval) clearInterval(timerInterval);
    sessionTimerStart = Date.now();
    updateTimerDisplay();
    timerInterval = setInterval(updateTimerDisplay, 1000);

    let sessionCards = [];

    if (options.mode === 'cram') {
        const progMap = getProgressMap();
        sessionCards = candidateQuestions.map(q => {
             const p = progMap[q.question];
             return {
                 question: q.question,
                 answer: q.answer,
                 item: q,
                 progress: p || null, // Use existing progress if available
                 isNew: !p
             };
        });
        // Shuffle
        sessionCards.sort(() => Math.random() - 0.5);
    } else {
        const dueCards = getDueCards(candidateQuestions);
        const reviews = dueCards.filter(c => !c.isNew);
        let newCards = dueCards.filter(c => c.isNew);
        sessionCards = [...reviews, ...newCards];
    }
    
    // Safety cap for session length (except cram?)
    const MAX_SESSION = options.mode === 'cram' ? 100 : 40; 
    if (sessionCards.length > MAX_SESSION) {
        sessionCards = sessionCards.slice(0, MAX_SESSION);
    }
    
    if (sessionCards.length === 0) {
        if (candidateQuestions && candidateQuestions.length > 0 && options.mode !== 'cram') {
            startLearnSession(candidateQuestions, { mode: 'cram' });
            return;
        }
        alert('Нет карточек для обучения.');
        return;
    }

    // Hide main UI, Show Learn UI
    if (mainContainer) mainContainer.style.display = 'none';
    // Hide sidebar if exists
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.style.display = 'none';
    
    container.style.display = 'flex';
    const learnStats = document.getElementById('learn-stats');
    if (learnStats) learnStats.style.display = 'none';
    
    const fcContainer = container.querySelector('.flashcard-container');
    if (fcContainer) fcContainer.style.display = 'flex';
    
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
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    if (container) container.style.display = 'none';
    if (mainContainer) mainContainer.style.display = 'block'; // Or whatever flex/grid it was
    // Restore sidebar
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.style.display = '';
    
    window.dispatchEvent(new Event('favoritesUpdated'));
    session = null;
}

function renderCardState(state) {
    if (state.pauseRecommendation) {
        try { showSmartPause(state.pauseRecommendation); } catch (e) { console.error('Pause error', e); }
    }

    if (!container) return; // Guard against missing container

    const cardEl = container.querySelector('.flashcard');
    const front = container.querySelector('.flashcard-front');
    const back = container.querySelector('.flashcard-back');
    const qEl = document.getElementById('learn-question');
    const aEl = document.getElementById('learn-answer');
    const counter = document.getElementById('learn-counter');
    const progressFill = container.querySelector('.learn-progress-fill');
    
    // Update segments
    updateSegments(state.results, state.total);

    if (qEl && state.card) qEl.textContent = state.card.question || '(Пустой вопрос)';
    if (aEl && state.card) aEl.textContent = state.card.answer || '(Пустой ответ)';
    
    // Update Hearts and Difficulty Label
    const renderHearts = (ef) => {
        try {
            let heartsCount = 0;
            // Absolute 1-5 scale based on EF ranges
            // Range 1: 1.3 - 1.7 (Very Hard) -> 1 heart base
            // Range 2: 1.7 - 2.1 (Hard) -> 2 hearts base
            // Range 3: 2.1 - 2.4 (Standard) -> 3 hearts base
            // Range 4: 2.4 - 2.9 (Easy) -> 4-5 hearts
            
            if (ef < 1.7) {
                // 1.3 to 1.7 -> 1.0 to 2.0
                heartsCount = 1 + (ef - 1.3) / 0.4;
            } else if (ef < 2.1) {
                // 1.7 to 2.1 -> 2.0 to 3.0
                heartsCount = 2 + (ef - 1.7) / 0.4;
            } else if (ef < 2.4) {
                // 2.1 to 2.4 -> 3.0 to 4.0
                heartsCount = 3 + (ef - 2.1) / 0.3;
            } else {
                // 2.4 to 2.9 -> 4.0 to 5.0
                heartsCount = 4 + (ef - 2.4) / 0.5;
            }
            
            // Clamp between 1 and 5
            heartsCount = Math.max(1, Math.min(5, heartsCount));

            let html = '';
            for (let i = 0; i < 5; i++) {
                let fill = 0;
                if (heartsCount >= i + 1) {
                    fill = 1;
                } else if (heartsCount > i) {
                    fill = heartsCount - i;
                }
                
                // Render heart with gradient if partial, or solid color
                const stopVal = Math.round(fill * 100);
                const id = `heart-grad-${Math.random().toString(36).substr(2, 9)}`;
                
                html += `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" class="heart-icon">
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
            return html;
        } catch (e) {
            console.error('Error in renderHearts:', e);
            return '';
        }
    };

    if (state.card) {
        // Prefer passed cardProgress, fallback to storage
        let progressObj = state.cardProgress;
        if (!progressObj) {
            const progMap = getProgressMap();
            progressObj = progMap[state.card.question];
        }

        const ef = progressObj && progressObj.easeFactor !== undefined ? progressObj.easeFactor : 2.5;
        const level = getDifficultyLevel(ef);
        // const progress = getLevelProgress(ef, level); // No longer needed for hearts

        // Map level to Russian text
        const levelNames = {
            'VERY_HARD': 'Очень трудные',
            'HARD': 'Трудные',
            'STANDARD': 'Стандарт',
            'EASY': 'Легкие'
        };
        
        // Recalculate hearts count for title
        let heartsCount = 0;
        if (ef < 1.7) heartsCount = 1 + (ef - 1.3) / 0.4;
        else if (ef < 2.1) heartsCount = 2 + (ef - 1.7) / 0.4;
        else if (ef < 2.4) heartsCount = 3 + (ef - 2.1) / 0.3;
        else heartsCount = 4 + (ef - 2.4) / 0.5;
        heartsCount = Math.max(1, Math.min(5, heartsCount));

        container.querySelectorAll('.learn-hearts').forEach(el => {
            // Label for the level
            const labelHtml = `<span class="level-label" style="font-size:12px;color:#aaa;margin-right:6px;align-self:center;font-weight:500">${levelNames[level]}</span>`;
            
            el.innerHTML = labelHtml + renderHearts(ef);
            el.title = `Уровень: ${levelNames[level]}\nEF: ${ef.toFixed(2)}\nСердечек: ${heartsCount.toFixed(2)}`;
            
            // Cleanup old sibling label if it exists (from previous version)
            const oldLabel = el.nextElementSibling;
            if (oldLabel && oldLabel.classList.contains('level-label')) {
                oldLabel.remove();
            }
        });

        // Update "Easy" button state
        const easyBtn = container.querySelector('.rate-easy');
        if (easyBtn) {
            const canEasy = canUseEasy(progressObj || { easeFactor: 2.3 });
            if (!canEasy) {
                easyBtn.style.opacity = '0.5';
                easyBtn.style.cursor = 'not-allowed';
                easyBtn.title = 'Доступно только для карточек уровня "Легкие" с прогрессом > 70%';
                // Optional: Change text or add lock icon
                easyBtn.innerHTML = 'Легко 🔒 (4)';
            } else {
                easyBtn.style.opacity = '1';
                easyBtn.style.cursor = 'pointer';
                easyBtn.title = '';
                easyBtn.innerHTML = 'Легко (4)';
            }
        }
    }

    if (counter) counter.textContent = `${state.progress}/${state.total}`;
    
    if (progressFill) {
        progressFill.style.width = `${(state.progress / state.total) * 100}%`;
    }

    // Update favorite button state
    try {
        const favs = JSON.parse(localStorage.getItem('qaFavorites') || '[]');
        const isFav = state.card && favs.includes(state.card.question);
        container.querySelectorAll('.learn-fav-btn').forEach(btn => {
            btn.innerHTML = starSvg(isFav);
            if (isFav) btn.classList.add('active');
            else btn.classList.remove('active');
        });
    } catch (e) { console.error('Fav update error', e); }

    if (cardEl) {
        if (state.isFlipped) {
            cardEl.classList.add('flipped');
        } else {
            cardEl.classList.remove('flipped');
        }
    }
}

function updateSegments(results, total) {
    const segs = document.getElementById('learn-segments');
    if (!segs) return;

    // Build segments once
    if (segs.childElementCount !== total) {
        segs.innerHTML = '';
        for (let i = 0; i < total; i++) {
            const s = document.createElement('div');
            s.className = 'learn-progress-segment';
            segs.appendChild(s);
        }
    }
    // Color segments by results
    if (results && results.length) {
        results.forEach((g, idx) => {
            const el = segs.children[idx];
            if (!el) return;
            el.className = 'learn-progress-segment';
            if (g === 0) el.classList.add('seg-again');
            else if (g === 1) el.classList.add('seg-hard');
            else if (g === 2) el.classList.add('seg-good');
            else if (g === 3) el.classList.add('seg-easy');
        });
    }
}

function showStats(stats, results, total) {
    // Update segments one last time to show the final card's result
    if (results && total) {
        updateSegments(results, total);
    }

    if (container) {
        const fcContainer = container.querySelector('.flashcard-container');
        if (fcContainer) fcContainer.style.display = 'none';
    }
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

        // Enter key handler for Continue button
        const enterHandler = (e) => {
            if (e.key === 'Enter' && overlay.classList.contains('show')) {
                e.preventDefault();
                e.stopPropagation();
                overlay.querySelector('#sum-continue').click();
            }
        };
        document.addEventListener('keydown', enterHandler);

        // Remove listener when overlay is removed
        const originalRemove = overlay.remove.bind(overlay);
        overlay.remove = () => {
            document.removeEventListener('keydown', enterHandler);
            originalRemove();
        };

        overlay.querySelector('#sum-stats').addEventListener('click', async () => {
            overlay.classList.remove('show');
            window.__overlayActive = true;
            // Скрываем контейнер обучения, чтобы статистика была поверх
            if (container) container.style.display = 'none';
            const { initStatsPage } = await import('./stats-ui.js?v=6');
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

    // Motivational Message Logic (Expert Psychology)
    let motivation = 'Продолжайте в том же духе!';
    if (currentScheduler) {
        const sched = currentScheduler.getScheduleStatus();
        const daysLeft = sched.daysRemaining;
        
        if (accuracy >= 90) {
            motivation = `Потрясающая точность! Вы уверенно идете к цели за ${daysLeft} дн.`;
        } else if (accuracy >= 75) {
            motivation = `Отличный результат! Осталось ${daysLeft} дней до финиша.`;
        } else if (accuracy < 50) {
            motivation = `Тяжело в учении — легко в бою. Завтра будет лучше!`;
        } else {
            motivation = `Хороший темп. Выучено ${sched.learnedCount} из ${sched.learnedCount + sched.unseenCount}.`;
        }

        if (sched.dayNumber > 40) {
            motivation += " Финиш уже близко!";
        }
    } else {
         motivation = accuracy > 80 ? 'Отлично! 💪' : 'Продолжайте! 🚀';
    }

    overlay.querySelector('#sum-motivation').textContent = motivation;
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
    import('./stats-utils.js?v=3').then(({ getCurrentLevel }) => {
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
    
    // Show all stats immediately (without staggered delay)
    const totalEl = overlay.querySelector('#stat-total');
    const accWrap = overlay.querySelector('#stat-accuracy');
    const streakWrap = overlay.querySelector('#stat-streak');
    const motEl = overlay.querySelector('#sum-motivation');
    const xpEl = overlay.querySelector('#sum-xp');
    const actions = overlay.querySelector('.summary-actions');

    // Apply animations simultaneously
    if (totalEl) { totalEl.style.display = ''; totalEl.classList.add('glitch-in'); }
    if (accWrap) { accWrap.style.display = ''; accWrap.classList.add('glitch-in'); }
    if (streakWrap) { streakWrap.style.display = ''; streakWrap.classList.add('glitch-in'); }
    
    // Fade-in elements (originally hidden by CSS opacity: 0)
    if (motEl) { motEl.style.display = ''; motEl.classList.add('fade-in'); }
    if (xpEl) { xpEl.style.display = ''; xpEl.classList.add('fade-in'); }
    if (actions) { actions.style.display = ''; actions.classList.add('fade-in'); }
}

function updateTimerDisplay() {
    const el = document.getElementById('learn-timer');
    if (!el) return;
    
    // Show time for current continuous block
    const now = Date.now();
    // If session exists, use session.lastPauseTime to track current block
    const startTime = (session && session.lastPauseTime) ? session.lastPauseTime : sessionTimerStart;
    
    const diff = Math.floor((now - startTime) / 1000);
    const m = Math.floor(diff / 60).toString().padStart(2, '0');
    const s = (diff % 60).toString().padStart(2, '0');
    el.textContent = `${m}:${s}`;
}

function showSmartPause(rec) {
    if (document.getElementById('smart-pause-overlay')) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'smart-pause-overlay';
    overlay.className = 'summary-overlay show'; 
    overlay.style.zIndex = '10002'; // Above everything
    
    overlay.innerHTML = `
        <div class="summary-box" style="max-width: 400px;">
            <div style="font-size: 48px; margin-bottom: 16px;">☕</div>
            <h2 style="margin:0 0 8px 0;">Умная пауза</h2>
            <div style="color: var(--color-text-secondary); margin-bottom: 24px; font-size: 16px;">
                ${rec.reason}
            </div>
            
            <div class="stats-grid" style="grid-template-columns: 1fr 1fr; margin-bottom: 24px;">
                <div class="stat-item">
                    <span>Время</span>
                    <span style="font-size: 20px; font-weight: 600;">${rec.duration} мин</span>
                </div>
                <div class="stat-item">
                    <span>Точность</span>
                    <span style="font-size: 20px; font-weight: 600; color: ${rec.accuracy >= 80 ? '#4ade80' : rec.accuracy >= 50 ? '#fbbf24' : '#ef4444'}">${rec.accuracy}%</span>
                </div>
            </div>
            
            <div style="display: flex; gap: 12px; flex-direction: column;">
                <button id="pause-break-btn" class="primary-btn" style="background: #10b981;">Сделать перерыв (5 мин)</button>
                <button id="pause-skip-btn" class="secondary-btn">Пропустить и продолжить</button>
            </div>
        </div>
    `;
    
    container.appendChild(overlay);
    
    // Handlers
    overlay.querySelector('#pause-skip-btn').addEventListener('click', () => {
        if (session) session.resumeFromPause();
        overlay.remove();
        updateTimerDisplay(); // Reset timer visually
    });
    
    overlay.querySelector('#pause-break-btn').addEventListener('click', () => {
        startBreakCountdown(overlay, 5 * 60);
    });
}

function startBreakCountdown(overlay, seconds) {
    const box = overlay.querySelector('.summary-box');
    box.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">🧘</div>
        <h2 style="margin:0 0 8px 0;">Отдыхаем...</h2>
        <div id="break-timer" style="font-size: 48px; font-weight: 700; font-family: monospace; margin: 24px 0;">
            05:00
        </div>
        <div style="color: var(--color-text-secondary); margin-bottom: 24px;">
            Глубоко вдохните и расслабьтесь.
        </div>
        <button id="break-skip-btn" class="secondary-btn">Вернуться к обучению</button>
    `;
    
    let left = seconds;
    const timerEl = box.querySelector('#break-timer');
    const interval = setInterval(() => {
        left--;
        if (left <= 0) {
            clearInterval(interval);
            if (session) session.resumeFromPause();
            overlay.remove();
            return;
        }
        const m = Math.floor(left / 60).toString().padStart(2, '0');
        const s = (left % 60).toString().padStart(2, '0');
        timerEl.textContent = `${m}:${s}`;
    }, 1000);
    
    box.querySelector('#break-skip-btn').addEventListener('click', () => {
        clearInterval(interval);
        if (session) session.resumeFromPause();
        overlay.remove();
    });
}
