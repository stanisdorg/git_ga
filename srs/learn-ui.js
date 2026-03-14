import { LearningSession } from './session.js?v=2.01';
import { getDueCards, syncFavorite, syncDailyStats } from './storage.js?v=2.01';
import { getProgressMap } from './stats-utils.js?v=2.00';
import { checkAchievements } from './stats-utils.js?v=2.00';
import { Scheduler } from './scheduler.js?v=2.00';
import { getTodaysSession } from './category-scheduler.js?v=2.00';
import { getDifficultyLevel, canUseEasy } from './algorithm.js?v=2.00';

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
            <style>
                /* Navigation Arrows */
                .nav-arrow-btn {
                    background: transparent;
                    border: none;
                    color: var(--color-text-secondary, #888);
                    width: 48px;
                    height: 48px;
                    cursor: pointer;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    outline: none;
                    flex-shrink: 0;
                    -webkit-tap-highlight-color: transparent;
                }
                .nav-arrow-btn:hover {
                    background: rgba(255,255,255,0.1);
                    color: var(--color-text-primary, #fff);
                }
                .nav-arrow-btn:active {
                    background: rgba(255,255,255,0.15);
                }
                .nav-arrow-btn:disabled {
                    opacity: 0.1;
                    cursor: default;
                    pointer-events: none;
                }
                .nav-arrow-btn svg {
                    width: 32px;
                    height: 32px;
                    fill: currentColor;
                    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
                }
                
                /* Mobile Layout */
                @media (max-width: 768px) {
                    .flashcard-container {
                        position: relative;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 100%;
                        padding: 0 10px; /* Prevent card from touching edges */
                        box-sizing: border-box;
                    }
                    .flashcard {
                        position: relative;
                        margin: 0 auto;
                        width: 92vw;
                        max-width: 520px;
                    }
                    .nav-arrow-btn {
                        position: absolute;
                        top: 66%;
                        transform: translateY(-50%);
                        width: 36px;
                        height: 36px;
                        z-index: 100;
                        background: rgba(0,0,0,0.35);
                        color: rgba(255,255,255,0.95);
                        box-shadow: 0 2px 6px rgba(0,0,0,0.25);
                        opacity: 0.7;
                    }
                    .nav-arrow-btn.left {
                        left: 12px;
                    }
                    .nav-arrow-btn.right {
                        right: 12px;
                    }
                    .nav-arrow-btn svg {
                        width: 22px;
                        height: 22px;
                    }
                }
                
                /* Desktop Layout */
                @media (min-width: 769px) {
                    .flashcard-container {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 24px;
                    }
                    .flashcard {
                        position: relative;
                    }
                    .nav-arrow-btn {
                        position: absolute;
                        top: 66%;
                        transform: translateY(-50%);
                        width: 48px;
                        height: 48px;
                        z-index: 90;
                        background: rgba(0,0,0,0.25);
                        color: rgba(255,255,255,0.95);
                        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
                    }
                    .nav-arrow-btn.left { left: 16px; }
                    .nav-arrow-btn.right { right: 16px; }
                    .nav-arrow-btn svg {
                        width: 28px;
                        height: 28px;
                    }
                }
                
                .mode-timer {
                    position: absolute;
                    top: 12px;
                    left: 50%;
                    transform: translateX(-50%);
                    font-size: 24px;
                    font-weight: 800;
                    color: #ff4d4d;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.5);
                    z-index: 20;
                    display: none;
                }
            </style>
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
                    <div id="mode-timer" class="mode-timer"></div>
                    <button id="learn-prev-btn" class="nav-arrow-btn left" title="Назад (Стрелка влево)" aria-label="Назад">
                        <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                    </button>
                    <div class="flashcard-front">
                        <button class="favorite-btn learn-fav-btn" title="В избранное" style="top:10px;right:10px;z-index:10"></button>
                        <div class="learn-hearts" style="position:absolute; top:12px; right:45px; display:flex; gap:2px; z-index:9"></div>
                        <div class="flashcard-content" id="learn-question"></div>
                        <div class="flashcard-hint">Нажмите Пробел, чтобы увидеть ответ</div>
                    </div>
                    <div class="flashcard-back">
                        <button class="favorite-btn learn-fav-btn" title="В избранное" style="top:10px;right:10px;z-index:10"></button>
                        <div class="learn-hearts" style="position:absolute; top:12px; right:45px; display:flex; gap:2px; z-index:9"></div>
                        <div class="flashcard-back-question" id="learn-back-question"></div>
                        <div class="flashcard-content" id="learn-answer"></div>
                        <div class="flashcard-actions">
                            <button class="rate-btn rate-again" data-grade="0">Снова (1)</button>
                            <button class="rate-btn rate-hard" data-grade="1">Трудно (2)</button>
                            <button class="rate-btn rate-good" data-grade="2">Хорошо (3)</button>
                            <button class="rate-btn rate-easy" data-grade="3">Легко (4)</button>
                        </div>
                    </div>
                    <button id="learn-next-btn" class="nav-arrow-btn right" title="Вперед (Стрелка вправо)" aria-label="Вперед">
                        <svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
                    </button>
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
        const prevBtn = document.getElementById('learn-prev-btn');
        const nextBtn = document.getElementById('learn-next-btn');
        if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); if (session) session.goTo((session.currentIndex || 0) - 1); });
        if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); if (session) session.goTo((session.currentIndex || 0) + 1); });
        
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
    // If no active session, ignore keys
    if (!session) return;
    
    // Check for Space or Enter to flip
    if (e.code === 'Space' || e.key === ' ' || e.code === 'Enter') {
        // Only flip if not already flipped and not typing in an input (though we don't have inputs here)
        if (!session.isFlipped) {
            e.preventDefault(); // Prevent scrolling
            session.flip();
        }
    } else if (session.isFlipped) {
        // Rating keys
        if (e.key === '1') session.rate(0);
        if (e.key === '2') session.rate(1);
        if (e.key === '3') session.rate(2);
        if (e.key === '4') session.rate(3);
    }

    // Navigation arrows (Left/Right)
    if (e.key === 'ArrowLeft') {
         if (session) session.goTo((session.currentIndex || 0) - 1);
    }
    if (e.key === 'ArrowRight') {
         if (session) session.goTo((session.currentIndex || 0) + 1);
    }
}

/**
 * Starts a learning session with the given list of candidate questions.
 * @param {Array} candidateQuestions 
 */
export function startLearnSession(candidateQuestions, options = {}) {
    console.log('=== [startLearnSession] === CALLED ===');
    console.log('[startLearnSession] candidateQuestions:', candidateQuestions ? candidateQuestions.length : 'null');
    console.log('[startLearnSession] __navigatingToHome:', window.__navigatingToHome);
    console.log('[startLearnSession] Stack trace:', new Error().stack);
    
    // Проверяем, не перешли ли мы на главную во время запуска
    if (window.__navigatingToHome) {
        console.log('[startLearnSession] ABORTED - navigating to home!');
        window.__navigatingToHome = false;  // Сбрасываем флаг
        return;
    }

    initLearnUI(); // Ensure UI exists

    // Скрываем навигацию и добавляем класс на body
    document.body.classList.add('learning-mode');
    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) bottomNav.style.display = 'none';

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
            // Убираем День X/Y и Прогресс - не нужно в режиме обучения
            infoEl.textContent = '';
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
    const MAX_SESSION = (options.mode === 'cram' || options.mode === 'time_attack' || options.mode === 'sudden_death') ? 100 : 40; 
    if (sessionCards.length > MAX_SESSION) {
        sessionCards = sessionCards.slice(0, MAX_SESSION);
    }
    
    if (sessionCards.length === 0) {
        if (candidateQuestions && candidateQuestions.length > 0 && options.mode !== 'cram' && options.mode !== 'time_attack' && options.mode !== 'sudden_death') {
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
    if (progressFill) { progressFill.style.width = '0%'; progressFill.style.pointerEvents = 'none'; }

    // Start Session
    session = new LearningSession(
        sessionCards,
        renderCardState,
        showStats,
        options
    );
    // Build fresh segments for the new session size
    if (segs) {
        segs.innerHTML = '';
        for (let i = 0; i < sessionCards.length; i++) {
            const s = document.createElement('div');
            s.className = 'learn-progress-segment';
            s.dataset.index = String(i);
            segs.appendChild(s);
        }
        wireSegmentsInteractions(session);
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
    
    // Возвращаем навигацию и убираем класс с body
    document.body.classList.remove('learning-mode');
    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) bottomNav.style.display = 'flex';

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
    // Update nav buttons availability
    try {
        const prevBtn = document.getElementById('learn-prev-btn');
        const nextBtn = document.getElementById('learn-next-btn');
        if (prevBtn) {
            const isStart = (session?.currentIndex || 0) <= 0;
            prevBtn.disabled = isStart;
            prevBtn.style.opacity = isStart ? '0.5' : '1';
            prevBtn.style.cursor = isStart ? 'not-allowed' : 'pointer';
        }
        if (nextBtn) {
            const isEnd = (session?.currentIndex || 0) >= ((session?.queue?.length || 1) - 1);
            nextBtn.disabled = isEnd;
            nextBtn.style.opacity = isEnd ? '0.5' : '1';
            nextBtn.style.cursor = isEnd ? 'not-allowed' : 'pointer';
        }
    } catch {}

    if (qEl && state.card) qEl.textContent = state.card.question || '(Пустой вопрос)';
    if (aEl && state.card) aEl.textContent = state.card.answer || '(Пустой ответ)';
    
    // Обновляем вопрос на back-стороне
    const backQuestionEl = document.getElementById('learn-back-question');
    if (backQuestionEl && state.card) {
        backQuestionEl.textContent = state.card.question || '(Пустой вопрос)';
    }
    
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

        // Determine EF: if no progress or no easeFactor, it's a NEW card (null)
        const ef = progressObj && progressObj.easeFactor !== undefined ? progressObj.easeFactor : null;
        
        if (ef === null) {
            // Render "NEW" state
            container.querySelectorAll('.learn-hearts').forEach(el => {
                el.innerHTML = `<span class="level-label" style="font-size:12px;color:var(--color-text-secondary);font-weight:600;background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;">НОВАЯ</span>`;
                el.title = 'Карточка еще не изучалась';
                
                // Remove old label if exists
                const oldLabel = el.nextElementSibling;
                if (oldLabel && oldLabel.classList.contains('level-label')) oldLabel.remove();
            });
        } else {
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
        }

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

    // Update Mode Timer
    const timerEl = document.getElementById('mode-timer');
    if (timerEl) {
        if (state.mode === 'time_attack' && state.timeLeft !== null && !state.isFlipped) {
            timerEl.style.display = 'block';
            timerEl.textContent = state.timeLeft;
            if (state.timeLeft <= 2) {
                timerEl.style.color = '#ff0000';
                timerEl.style.transform = 'translateX(-50%) scale(1.2)';
            } else {
                timerEl.style.color = '#ff4d4d';
                timerEl.style.transform = 'translateX(-50%) scale(1)';
            }
        } else {
            timerEl.style.display = 'none';
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

function wireSegmentsInteractions(sess) {
    const segs = document.getElementById('learn-segments');
    if (!segs) return;
    let touchTimer = null;
    const ensurePreviewEl = () => {
        let el = document.getElementById('learn-seg-preview');
        if (!el) {
            el = document.createElement('div');
            el.id = 'learn-seg-preview';
            el.style.position = 'fixed';
            el.style.zIndex = '10010';
            el.style.background = 'var(--color-surface, #161B22)';
            el.style.border = '1px solid var(--color-border, #222938)';
            el.style.borderRadius = '10px';
            el.style.boxShadow = '0 8px 20px rgba(0,0,0,0.35)';
            el.style.padding = '10px 12px';
            el.style.maxWidth = '300px';
            el.style.fontSize = '13px';
            el.style.color = 'var(--color-text, #E6EDF3)';
            el.style.display = 'none';
            el.style.pointerEvents = 'none';
            document.body.appendChild(el);
        }
        return el;
    };
    const showPreview = (index, anchor) => {
        const el = ensurePreviewEl();
        const q = sess.queue[index]?.item?.question || '';
        const a = sess.queue[index]?.item?.answer || '';
        el.innerHTML = `<div style="font-weight:600;margin-bottom:6px;">${q}</div><div style="opacity:0.8">${a}</div>`;
        const r = anchor.getBoundingClientRect();
        const isMobile = window.innerWidth < 768;
        el.style.display = 'block';
        const pw = el.offsetWidth || 260;
        const ph = el.offsetHeight || 140;
        if (isMobile) {
            el.style.left = '50%';
            el.style.bottom = '16px';
            el.style.top = 'auto';
            el.style.transform = 'translateX(-50%)';
            el.style.pointerEvents = 'auto';
        } else {
            let top = r.top - 10 - ph;
            if (top < 10) {
                top = r.bottom + 10;
            }
            if (top + ph > window.innerHeight - 10) {
                top = Math.max(10, window.innerHeight - ph - 10);
            }
            let left = r.left + (r.width / 2) - (pw / 2);
            const minLeft = 10;
            const maxLeft = Math.max(minLeft, window.innerWidth - pw - 10);
            left = Math.max(minLeft, Math.min(maxLeft, left));
            el.style.top = `${top}px`;
            el.style.left = `${left}px`;
            el.style.transform = 'none';
        }
    };
    const hidePreview = () => {
        const el = document.getElementById('learn-seg-preview');
        if (el) el.style.display = 'none';
    };
    Array.from(segs.children).forEach((seg) => {
        const i = Number(seg.dataset.index || '0');
        seg.style.cursor = 'pointer';
        seg.addEventListener('click', (e) => {
            e.preventDefault();
            sess.goTo(i);
            hidePreview();
        });
        seg.addEventListener('mouseenter', () => showPreview(i, seg));
        seg.addEventListener('mouseleave', hidePreview);
        seg.addEventListener('touchstart', (e) => {
            if (touchTimer) clearTimeout(touchTimer);
            const target = seg;
            touchTimer = setTimeout(() => { showPreview(i, target); touchTimer = null; }, 300);
        }, { passive: true });
        seg.addEventListener('touchend', (e) => {
            if (touchTimer) {
                clearTimeout(touchTimer);
                touchTimer = null;
                sess.goTo(i);
            }
        });
    });
    document.addEventListener('scroll', hidePreview, { passive: true });
    window.addEventListener('resize', hidePreview);
}

function showStats(stats, results, total) {
    console.log('[MODAL.TEMPLATE] === CREATING MODAL ===');
    
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
                <div class="stats-grid">
                    <div class="stat-item" id="stat-total">
                        <div class="stat-value" id="sum-total">0</div>
                        <div class="stat-label">Повторено</div>
                    </div>
                    <div class="stat-item" id="stat-accuracy">
                        <div class="stat-value" id="sum-accuracy">0%</div>
                        <div class="stat-label">Точность</div>
                    </div>
                    <div class="stat-item" id="stat-streak">
                        <div class="stat-value" id="sum-streak">0</div>
                        <div class="stat-label">Дней подряд</div>
                    </div>
                </div>
                <div class="motivation" id="sum-motivation"></div>
                <div id="sum-xp" class="xp-line"></div>
                <div class="summary-actions">
                    <button id="sum-continue" class="btn btn-primary" title="Продолжить обучение" aria-label="Продолжить">
                        <span>▶</span> Продолжить
                    </button>
                    <button id="sum-exit" class="btn btn-secondary" title="Перейти к статистике" aria-label="Перейти к статистике">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 3v18h18V3H3zm16 16H5V5h14v14zM7 10h2v7H7v-7zm4-3h2v10h-2V7zm4 6h2v4h-2v-4z"/>
                        </svg>
                        Статистика
                    </button>
                </div>
            </div>
        `;
        console.log('[MODAL.TEMPLATE] New template created with .stats-grid and .stat-item');
        container.appendChild(overlay);
        
        // Кнопка "Статистика" - переход на страницу статистики
        overlay.querySelector('#sum-exit').addEventListener('click', async () => {
            console.log('========================================');
            console.log('[STATS BUTTON] ========== STATS BUTTON CLICKED ==========');
            console.log('[STATS BUTTON] Timestamp:', new Date().toISOString());
            console.log('[STATS BUTTON] Current location.hash:', location.hash);
            console.log('[STATS BUTTON] currentScheduler:', currentScheduler);
            console.log('[STATS BUTTON] document.body.classList:', document.body.classList.toString());
            
            // Завершаем сессию обучения
            if (currentScheduler) {
                currentScheduler = null;
                console.log('[STATS BUTTON] Cleared currentScheduler');
            }
            
            // Убираем класс learning-mode
            document.body.classList.remove('learning-mode');
            const bottomNav = document.getElementById('bottom-nav');
            if (bottomNav) bottomNav.style.display = 'flex';
            
            console.log('[STATS BUTTON] Removed learning-mode, showed bottomNav');
            
            // Закрываем модалку
            overlay.remove();
            console.log('[STATS BUTTON] Removed overlay');
            
            // Переходим на статистику
            location.hash = '#/stats';
            console.log('[STATS BUTTON] Hash changed to:', location.hash);
            
            // Инициализируем страницу статистики
            const { initStatsPage } = await import('./stats-ui.js?v=6');
            initStatsPage('4.76');
            console.log('[STATS BUTTON] initStatsPage called');
            console.log('[STATS BUTTON] ========== END STATS BUTTON ==========');
            console.log('========================================');
        });
        
        // Кнопка "Продолжить" - следующий круг обучения
        overlay.querySelector('#sum-continue').addEventListener('click', () => {
            console.log('[CONTINUE BTN] Clicked!');
            console.log('[CONTINUE BTN] __lastCandidates:', window.__lastCandidates ? 'EXISTS' : 'null');
            overlay.classList.remove('show');
            if (window.__lastCandidates) {
                console.log('[CONTINUE BTN] Starting session with __lastCandidates');
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

    // Завершаем сессию обучения
    console.log('[showStats] Ending learning session...');
    if (currentScheduler) {
        currentScheduler = null;
        console.log('[showStats] Cleared currentScheduler');
    }
    
    // Убираем класс learning-mode
    document.body.classList.remove('learning-mode');
    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) bottomNav.style.display = 'flex';
    
    console.log('[showStats] Removed learning-mode, showed bottomNav');

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
    
    console.log('[MODAL.ANIM] === START ANIMATION ===');
    console.log('[MODAL.ANIM] startXP:', session.startXP, 'earned:', earned, 'bonus:', bonus);
    
    // Level info on top
    import('./stats-utils.js?v=3').then(({ getCurrentLevel }) => {
        const lvl = getCurrentLevel();
        console.log('[MODAL.ANIM] Current level:', lvl.level, 'XP:', lvl.xp);
        
        overlay.querySelector('#sum-level').textContent = `LV:${lvl.level} • ${lvl.xp} XP`;
        const startXP = session.startXP || 0;
        const earned = session.stats.pointsEarned || 0;
        const streakRaw = localStorage.getItem('studyStreak') || '{}';
        const st = (() => { try { return JSON.parse(streakRaw); } catch { return {}; } })();
        const bonus = Math.min(100, (st.current || 0) * 5);
        
        console.log('[MODAL.ANIM] startXP:', startXP, 'earned:', earned, 'bonus:', bonus);

        // Определяем, было ли повышение уровня
        const startLevel = getLevelFromXP(startXP);
        const endLevel = lvl.level;
        const leveledUp = endLevel > startLevel;
        
        console.log('[MODAL.ANIM] startLevel:', startLevel, 'endLevel:', endLevel, 'leveledUp:', leveledUp);

        const bar = overlay.querySelector('.level-progress-bar');
        const oldEl = bar.querySelector('.level-progress-fill-old');
        const earnEl = bar.querySelector('.level-progress-fill-earned');
        const bonusEl = bar.querySelector('.level-progress-fill-bonus');
        
        console.log('[MODAL.ANIM] Elements found:', { bar: !!bar, oldEl: !!oldEl, earnEl: !!earnEl, bonusEl: !!bonusEl });

        if (leveledUp) {
            console.log('[MODAL.ANIM] === LEVEL UP ANIMATION ===');
            
            // 1. Отключаем transition для мгновенной установки
            oldEl.style.transition = 'none';
            earnEl.style.transition = 'none';
            bonusEl.style.transition = 'none';
            oldEl.style.width = '100%';
            earnEl.style.width = '0%';
            bonusEl.style.width = '0%';
            earnEl.style.left = '100%';
            bonusEl.style.left = '100%';
            
            console.log('[MODAL.ANIM] Step 1: Set to 100% (transition: none)');
            
            // 2. Включаем transition и запускаем анимацию
            setTimeout(() => {
                oldEl.style.transition = 'width 0.5s ease';
                console.log('[MODAL.ANIM] Step 2: Enable transition');
                
                // 3. Вспышка уровня
                const levelEl = overlay.querySelector('#sum-level');
                levelEl.classList.add('flash');
                levelEl.textContent = `LV:${endLevel}!`;
                console.log('[MODAL.ANIM] Step 3: Flash level');
                
                setTimeout(() => {
                    levelEl.classList.remove('flash');
                    levelEl.textContent = `LV:${endLevel} • ${lvl.xp} XP`;
                    console.log('[MODAL.ANIM] Step 4: Remove flash');
                    
                    // 4. Быстрое сжатие (200ms)
                    oldEl.style.transition = 'width 0.2s ease';
                    oldEl.style.width = '0%';
                    console.log('[MODAL.ANIM] Step 5: Shrink old (200ms)');
                    
                    setTimeout(() => {
                        console.log('[MODAL.ANIM] Step 6: Fill new level (1.5s)');
                        // 5. Заполнение нового уровня (1.5s)
                        earnEl.style.transition = 'width 1.5s ease';
                        bonusEl.style.transition = 'width 1.5s ease';
                        earnEl.style.left = '0%';
                        bonusEl.style.left = '0%';
                        
                        const totalForLevel = lvl.nextThreshold - lvl.prevThreshold;
                        const earnedInLevel = Math.max(0, lvl.xp - lvl.prevThreshold);
                        const earnedPct = totalForLevel > 0 ? (earnedInLevel / totalForLevel) * 100 : 0;
                        const bonusPct = totalForLevel > 0 ? (bonus / totalForLevel) * 100 : 0;
                        
                        console.log('[MODAL.ANIM] earnedPct:', earnedPct, 'bonusPct:', bonusPct);
                        
                        earnEl.style.width = `${Math.min(100, earnedPct)}%`;
                        bonusEl.style.width = `${Math.min(100, bonusPct)}%`;
                    }, 200);
                }, 300);
            }, 50);
            
        } else {
            console.log('[MODAL.ANIM] === NORMAL ANIMATION (no level up) ===');
            
            // Отключаем transition для мгновенной установки
            oldEl.style.transition = 'none';
            earnEl.style.transition = 'none';
            bonusEl.style.transition = 'none';
            
            const prev = lvl.prevThreshold;
            const next = lvl.nextThreshold;
            const pct = (v) => next === Infinity ? 1 : Math.max(0, Math.min(1, (v - prev) / (next - prev)));
            const startPct = pct(startXP);
            
            oldEl.style.width = `${startPct * 100}%`;
            earnEl.style.left = `${startPct * 100}%`;
            earnEl.style.width = '0%';
            bonusEl.style.left = `${startPct * 100}%`;
            bonusEl.style.width = '0%';
            
            console.log('[MODAL.ANIM] Step 1: Set startPct:', startPct * 100);
            
            // Включаем transition и запускаем анимацию
            setTimeout(() => {
                oldEl.style.transition = 'width 0.5s ease';
                console.log('[MODAL.ANIM] Step 2: Enable transition');
                
                setTimeout(() => {
                    console.log('[MODAL.ANIM] Step 3: Fill earned + bonus (1.5s)');
                    earnEl.style.transition = 'width 1.5s ease';
                    bonusEl.style.transition = 'width 1.5s ease';
                    
                    const earnedPct = Math.max(0, pct(startXP + earned) - startPct) * 100;
                    const bonusPct = Math.max(0, pct(startXP + earned + bonus) - pct(startXP + earned)) * 100;
                    
                    console.log('[MODAL.ANIM] earnedPct:', earnedPct, 'bonusPct:', bonusPct);
                    
                    earnEl.style.width = `${earnedPct}%`;
                    bonusEl.style.width = `${bonusPct}%`;
                }, 500);
            }, 50);
        }
    }).catch((err) => {
        console.error('[MODAL.ANIM] Error:', err);
    });
    
    // Animate overlay and stats
    overlay.classList.add('show');
    console.log('[MODAL.ANIM] Overlay show class added');
    
    // Show all stats immediately (without staggered delay)
    const totalEl = overlay.querySelector('#stat-total');
    const accWrap = overlay.querySelector('#stat-accuracy');
    const streakWrap = overlay.querySelector('#stat-streak');
    const motEl = overlay.querySelector('#sum-motivation');
    const xpEl = overlay.querySelector('#sum-xp');
    const actions = overlay.querySelector('.summary-actions');
    
    console.log('[MODAL.ANIM] Elements found:', {
        total: !!totalEl,
        accuracy: !!accWrap,
        streak: !!streakWrap,
        motivation: !!motEl,
        xp: !!xpEl,
        actions: !!actions
    });

    // Apply animations simultaneously
    if (totalEl) { 
        totalEl.style.display = ''; 
        totalEl.classList.add('fade-in'); 
        console.log('[MODAL.ANIM] totalEl fade-in added');
        // Animate numbers counting up
        animateValue(totalEl.querySelector('.stat-value'), 0, parseInt(totalEl.querySelector('.stat-value').textContent) || 0, 1000);
    }
    if (accWrap) { 
        accWrap.style.display = ''; 
        accWrap.classList.add('fade-in'); 
        console.log('[MODAL.ANIM] accWrap fade-in added');
        // Animate accuracy percentage
        const accValue = accWrap.querySelector('.stat-value');
        const accNum = parseInt(accValue.textContent) || 0;
        animateValue(accValue, 0, accNum, 1000, '%');
    }
    if (streakWrap) { 
        streakWrap.style.display = ''; 
        streakWrap.classList.add('fade-in'); 
        console.log('[MODAL.ANIM] streakWrap fade-in added');
        // Animate streak number
        animateValue(streakWrap.querySelector('.stat-value'), 0, parseInt(streakWrap.querySelector('.stat-value').textContent) || 0, 1000);
    }

    // Fade-in elements (originally hidden by CSS opacity: 0)
    if (motEl) { 
        motEl.style.display = ''; 
        motEl.classList.add('fade-in'); 
        console.log('[MODAL.ANIM] motEl fade-in added');
    }
    if (xpEl) { 
        xpEl.style.display = ''; 
        xpEl.classList.add('fade-in'); 
        console.log('[MODAL.ANIM] xpEl fade-in added');
    }
    if (actions) { 
        actions.style.display = ''; 
        actions.classList.add('fade-in'); 
        console.log('[MODAL.ANIM] actions fade-in added');
    }
}

// Helper function to animate numbers counting up
function animateValue(el, start, end, duration, suffix = '') {
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (easeOutQuart)
        const ease = 1 - Math.pow(1 - progress, 4);
        
        const current = Math.floor(start + (end - start) * ease);
        el.textContent = current + suffix;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

// Helper function to get level from XP
function getLevelFromXP(xp) {
    return Math.floor(Math.sqrt(xp / 625)) + 1;
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
