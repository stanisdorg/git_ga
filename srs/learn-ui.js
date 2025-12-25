import { LearningSession } from './session.js';
import { getDueCards } from './storage.js';

// DOM Elements
let container = null;
let mainContainer = null; // The app's main container to hide/show
let session = null;

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
                        <div class="learn-progress-fill"></div>
                    </div>
                    <span id="learn-counter">0/0</span>
                </div>
            </div>
            
            <div class="flashcard-container">
                <div class="flashcard">
                    <div class="flashcard-front">
                        <div class="flashcard-content" id="learn-question"></div>
                        <div class="flashcard-hint">Нажмите Пробел, чтобы увидеть ответ</div>
                    </div>
                    <div class="flashcard-back">
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
    
    const sessionCards = [...reviews, ...newCards];
    
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

    // Start Session
    session = new LearningSession(
        sessionCards,
        renderCardState,
        showStats
    );
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

    qEl.textContent = state.card.question;
    aEl.textContent = state.card.answer;
    
    counter.textContent = `${state.progress}/${state.total}`;
    progressFill.style.width = `${(state.progress / state.total) * 100}%`;

    if (state.isFlipped) {
        cardEl.classList.add('flipped');
    } else {
        cardEl.classList.remove('flipped');
    }
}

function showStats(stats) {
    container.querySelector('.flashcard-container').style.display = 'none';
    const statsEl = document.getElementById('learn-stats');
    statsEl.style.display = 'block';
    
    document.getElementById('stat-total').textContent = stats.reviewed;
    document.getElementById('stat-again').textContent = stats.again;
    document.getElementById('stat-hard').textContent = stats.hard;
    document.getElementById('stat-good').textContent = stats.good;
    document.getElementById('stat-easy').textContent = stats.easy;
}
