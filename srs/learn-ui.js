import { LearningSession } from './session.js?v=6.40.0';
import { getDueCards, syncFavorite, syncDailyStats, syncWithServer } from './storage.js?v=6.40.0';
import { getProgressMap } from './stats-utils.js?v=6.40.0';
import { checkAchievements } from './stats-utils.js?v=6.40.0';
import { Scheduler } from './scheduler.js?v=6.40.0';
import { getTodaysSession } from './category-scheduler.js?v=6.40.0';
import { getDifficultyLevel, canUseEasy } from './algorithm.js?v=6.40.0';
import { createFormatToolbar, initFormatToolbar } from './format-toolbar.js?v=6.40.0';
import { applyFormatting, createEmptyFormatting, convertHtmlToTextAndFormatting, renderFormattingInEditor } from './text-formatter.js?v=6.40.0';

// DOM Elements
let container = null;
let mainContainer = null; // The app's main container to hide/show
let session = null;
let currentScheduler = null;
let timerInterval = null;
let isTimerRunning = false; // Глобальный флаг для блокировки updateTimerDisplay
let currentIntervalId = null; // Хранит ID текущего активного интервала
let sessionTimerStart = 0;
let userScrolled = false; // Флаг ручного скролла прогресс-бара
let timerPaused = false; // Флаг паузы таймера
let pausedTimeRemaining = 0; // Накопленное время при паузе

const starSvg = (filled) => `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
            style="fill: ${filled ? '#ffd700' : 'none'} !important; stroke: ${filled ? '#ffd700' : 'currentColor'} !important; stroke-width: 2px;"
        />
    </svg>
`;

export function initLearnUI() {
    // 🔧 ЗАЩИТА ОТ ПОВТОРНОГО ВЫЗОВА
    if (window.__learnUIInitialized) {
        console.log('[initLearnUI] ✅ Already initialized, skipping');
        return;
    }
    window.__learnUIInitialized = true;

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
                        top: 76%;
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

                /* Timer controls - кнопка паузы и таймер */
                .timer-controls {
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                    position: absolute;
                    left: 50%;
                    top: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 20;
                    flex-direction: row !important;
                }

                /* Вариант 3: Неоновое свечение */
                .timer-pause-btn {
                    width: 30px;
                    height: 30px;
                    background: transparent;
                    border-radius: 6px;
                    cursor: pointer;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    color: #00ff88;
                    transition: all 0.2s ease;
                    flex-shrink: 0 !important;
                    filter: drop-shadow(0 0 5px rgba(0, 255, 136, 0.5));
                }

                .timer-pause-btn svg {
                    width: 16px;
                    height: 16px;
                    display: block;
                }

                .timer-pause-btn:hover {
                    filter: drop-shadow(0 0 10px rgba(0, 255, 136, 0.8));
                    background: rgba(0, 255, 136, 0.1);
                }

                /* Свечение для кнопки */
                .timer-pause-btn.running {
                    color: #00ff88;
                    filter: drop-shadow(0 0 5px rgba(0, 255, 136, 0.5));
                }

                .timer-pause-btn.paused {
                    color: #00ff88;
                    filter: drop-shadow(0 0 8px rgba(0, 255, 136, 0.7));
                }

                .timer-pause-btn.running .pause-icon {
                    display: none !important;
                }

                .timer-pause-btn.running .play-icon {
                    display: block !important;
                }

                .timer-pause-btn.paused .pause-icon {
                    display: block !important;
                }

                .timer-pause-btn.paused .play-icon {
                    display: none !important;
                }

                .mode-timer {
                    position: static;
                    transform: none;
                    font-size: 14px;
                    font-weight: 600;
                    color: #00ff88;
                    text-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
                    z-index: auto;
                    display: inline-block;
                    min-width: 60px;
                    text-align: center;
                    white-space: nowrap;
                    cursor: pointer;
                }
            </style>
            <div class="learn-header">
                <button id="learn-exit-btn">✕ Выход</button>
                <div class="timer-controls" id="timer-controls" title="Пауза/Старт (клик по таймеру)">
                    <button class="timer-pause-btn" id="timer-pause-btn" aria-label="Пауза/Старт">
                        <svg class="pause-icon" viewBox="0 0 24 24" style="display:none">
                            <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/>
                            <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>
                        </svg>
                        <svg class="play-icon" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" fill="currentColor"/>
                        </svg>
                    </button>
                    <div id="mode-timer" class="mode-timer"></div>
                </div>
                <div class="learn-progress">
                    <div class="learn-progress-bar">
                        <div class="learn-progress-segments" id="learn-segments"></div>
                    </div>
                    <span id="learn-counter">0/0</span>
                </div>
            </div>

            <div class="flashcard-container">
                <div class="flashcard">
                    <button id="learn-prev-btn" class="nav-arrow-btn left" title="Назад (Стрелка влево)" aria-label="Назад">
                        <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                    </button>
                    <div class="flashcard-front">
                        <button class="edit-btn learn-edit-btn" title="Редактировать" style="top:10px;left:10px;z-index:10">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="favorite-btn learn-fav-btn" title="В избранное" style="top:10px;right:10px;z-index:10"></button>
                        <div class="learn-hearts" style="position:absolute; top:12px; right:45px; display:flex; gap:2px; z-index:9"></div>
                        <div class="flashcard-content" id="learn-question"></div>
                        <div class="flashcard-hint">Нажмите Пробел, чтобы увидеть ответ</div>
                    </div>
                    <div class="flashcard-back">
                        <button class="edit-btn learn-edit-btn" title="Редактировать" style="top:10px;left:10px;z-index:10">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
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

        // Обработчик клика для переворота карточки
        const flashcard = container.querySelector('.flashcard');
        const flashcardFront = container.querySelector('.flashcard-front');
        const flashcardBack = container.querySelector('.flashcard-back');

        function handleCardClick(e) {
            e.stopPropagation();
            if (session && !session.isFlipped) {
                session.flip();
            }
        }

        if (flashcard) flashcard.addEventListener('click', handleCardClick);
        if (flashcardFront) flashcardFront.addEventListener('click', handleCardClick);
        if (flashcardBack) flashcardBack.addEventListener('click', handleCardClick);

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

        // Флаг блокировки повторных нажатий
        let isRatingInProgress = false;

        rates.forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();

                if (isRatingInProgress) {
                    return;
                }

                const grade = parseInt(btn.dataset.grade);

                isRatingInProgress = true;
                btn.style.pointerEvents = 'none';
                userScrolled = false;

                if (session) {
                    await session.rate(grade);
                }

                btn.blur();

                setTimeout(() => {
                    btn.style.pointerEvents = '';
                    isRatingInProgress = false;
                }, 300);
            });
        });

        // Edit buttons - открытие модального окна редактирования
        container.querySelectorAll('.learn-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!session || !session.currentCard) {
                    console.log('[EDIT] Нет активной карточки для редактирования');
                    return;
                }
                console.log('[EDIT] Открытие редактора для карточки:', session.currentCard.question?.substring(0, 50));
                openEditModal(session.currentCard);
            });
        });

        // Hotkeys
        document.addEventListener('keydown', handleKeydown);
    }

    mainContainer = document.querySelector('.container');
}

// ==========================================
// РЕДАКТИРОВАНИЕ КАРТОЧЕК
// ==========================================

let editModalState = {
    isOpen: false,
    originalCard: null,
    editedQuestion: '',
    editedAnswer: '',
    formatting: null  // formatting объект { question: [], answer: [] }
};

// Открытие модального окна редактирования
function openEditModal(card) {
    console.log('[EDIT MODAL] Открытие модального окна');

    // Получаем актуальные данные из session.currentCard (не из card!)
    const currentCard = session?.currentCard;
    const question = currentCard?.question || card.question || '';
    const answer = currentCard?.answer || currentCard?.item?.answer || card.answer || card.item?.answer || '';

    console.log('[EDIT MODAL] card.question:', question);
    console.log('[EDIT MODAL] answer:', answer?.substring(0, 50));

    // Получаем formatting из карточки или создаём пустой
    const formatting = card.formatting || createEmptyFormatting();

    // Сохраняем исходные данные - всегда берем из session.currentCard
    editModalState = {
        isOpen: true,
        originalCard: {
            question: question,
            answer: answer,
            item: currentCard?.item || card.item,
            formatting: formatting
        },
        editedQuestion: question,
        editedAnswer: answer,
        formatting: { ...formatting },  // Копируем formatting
        // Сохраняем oldQuestion для использования при сохранении
        oldQuestion: question
    };

    console.log('[EDIT MODAL] editModalState.originalCard.question:', editModalState.originalCard.question);
    console.log('[EDIT MODAL] editModalState.oldQuestion:', editModalState.oldQuestion);

    // Блокируем навигацию и переворот карточки
    if (session) {
        session.pauseNavigation = true;
        session.blockFlip = true;
    }

    // Блокируем клики по карточке
    const flashcard = container?.querySelector('.flashcard');
    if (flashcard) {
        flashcard.style.pointerEvents = 'none';
        console.log('[EDIT MODAL] Card clicks blocked');
    }

    // Создаем модальное окно с ОДНОЙ панелью форматирования
    const modalHTML = `
        <div class="edit-modal-overlay" id="edit-modal-overlay">
            <div class="edit-modal">
                <div class="edit-modal-content">
                    <!-- ОДНА ОБЩАЯ ПАНЕЛЬ ФОРМАТИРОВАНИЯ -->
                    <div class="format-toolbar" id="main-format-toolbar"></div>

                    <div class="edit-field-group">
                        <label class="edit-field-label">Вопрос</label>
                        <div
                            class="edit-field-editor"
                            id="edit-question-editor"
                            contenteditable="true"
                            spellcheck="true"
                        ></div>
                    </div>
                    <div class="edit-field-group">
                        <label class="edit-field-label">Ответ</label>
                        <div
                            class="edit-field-editor"
                            id="edit-answer-editor"
                            contenteditable="true"
                            spellcheck="true"
                        ></div>
                    </div>
                </div>
                <div class="edit-modal-footer">
                    <button class="edit-modal-btn cancel" id="edit-cancel-btn">Отмена</button>
                    <button class="edit-modal-btn save" id="edit-save-btn">Сохранить</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    console.log('[EDIT MODAL] Modal HTML inserted, checking element:', document.getElementById('edit-modal-overlay'));

    // Создаём toolbar
    const toolbarContainer = document.getElementById('main-format-toolbar');
    const questionEditor = document.getElementById('edit-question-editor');
    const answerEditor = document.getElementById('edit-answer-editor');

    if (toolbarContainer) {
        const mainToolbar = createFormatToolbar('both');  // 'both' означает общий для всех
        toolbarContainer.appendChild(mainToolbar);

        console.log('[EDIT MODAL] Toolbar created:', mainToolbar);
    }

    console.log('[EDIT MODAL] Editors found:', { questionEditor, answerEditor });

    if (questionEditor) {
        // Применяем форматирование к вопросу
        renderFormattingInEditor(questionEditor, question, formatting.question || []);
        console.log('[EDIT MODAL] Question set:', question?.substring(0, 50));
    }
    if (answerEditor) {
        // Применяем форматирование к ответу
        renderFormattingInEditor(answerEditor, answer, formatting.answer || []);
        console.log('[EDIT MODAL] Answer set:', answer?.substring(0, 50));
    }

    // Инициализируем toolbar с ОБОИМИ редакторами
    const mainToolbar = toolbarContainer?.querySelector('.format-toolbar');
    if (mainToolbar && questionEditor && answerEditor) {
        initFormatToolbar(mainToolbar, questionEditor, answerEditor, editModalState.formatting, (newFormatting) => {
            editModalState.formatting = newFormatting;
        });
    }

    // Обработчики кнопок
    const cancelBtn = document.getElementById('edit-cancel-btn');
    const saveBtn = document.getElementById('edit-save-btn');
    const overlay = document.getElementById('edit-modal-overlay');

    console.log('[EDIT MODAL] Buttons found:', { cancelBtn, saveBtn, overlay });

    // Добавляем отладочные логи для кнопок
    cancelBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('[EDIT MODAL] Cancel button clicked');
        closeEditModal(true);
    });

    saveBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('[EDIT MODAL] Save button clicked');
        saveEditChanges();
    });

    overlay?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            e.stopPropagation();
            console.log('[EDIT MODAL] Overlay clicked');
            closeEditModal(true);
        }
    });

    // Обработчик Enter (Ctrl+Enter для сохранения)
    const handleKeyDown = (e) => {
        // Блокируем все события клавиатуры от передачи на карточку
        e.stopPropagation();
        e.preventDefault();

        if (e.key === 'Enter' && e.ctrlKey) {
            saveEditChanges();
        } else if (e.key === 'Escape') {
            closeEditModal(true);
        }
        // Остальные клавиши работают для редактирования текста
    };

    // Блокируем стандартные события клавиатуры для редакторов
    questionEditor?.addEventListener('keydown', (e) => {
        e.stopPropagation();
        // Разрешаем только редактирование
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            saveEditChanges();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeEditModal(true);
        }
    });
    answerEditor?.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            saveEditChanges();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeEditModal(true);
        }
    });

    // Фокус на первый редактор
    setTimeout(() => {
        const overlay = document.getElementById('edit-modal-overlay');
        const modal = document.querySelector('.edit-modal');
        console.log('[EDIT MODAL] Final check:', {
            overlayExists: !!overlay,
            modalExists: !!modal,
            overlayDisplay: overlay?.style?.display,
            overlayZIndex: overlay?.style?.zIndex,
            computedZIndex: overlay ? getComputedStyle(overlay).zIndex : 'N/A',
            computedDisplay: overlay ? getComputedStyle(overlay).display : 'N/A'
        });
        questionEditor?.focus();
    }, 100);

    console.log('[EDIT MODAL] Модальное окно открыто');
}

// Закрытие модального окна
function closeEditModal(discardChanges = true) {
    console.log('[EDIT MODAL] Закрытие модального окна, discardChanges:', discardChanges);

    const modal = document.getElementById('edit-modal-overlay');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.remove();
        }, 200);
    }

    editModalState.isOpen = false;

    // Разблокируем навигацию и карточку
    if (session) {
        session.pauseNavigation = false;
        session.blockFlip = false;
    }

    // Восстанавливаем клики по карточке
    const flashcard = container?.querySelector('.flashcard');
    if (flashcard) {
        flashcard.style.pointerEvents = '';
        console.log('[EDIT MODAL] Card clicks restored');
    }

    console.log('[EDIT MODAL] Модальное окно закрыто');
}

// Сохранение изменений
async function saveEditChanges() {
    console.log('[EDIT MODAL] Сохранение изменений');

    const questionEditor = document.getElementById('edit-question-editor');
    const answerEditor = document.getElementById('edit-answer-editor');

    if (!questionEditor || !answerEditor) {
        console.error('[EDIT MODAL] Редакторы не найдены');
        return;
    }

    // Получаем HTML из редакторов
    const questionHTML = questionEditor.innerHTML.trim();
    const answerHTML = answerEditor.innerHTML.trim();

    // Конвертируем HTML в чистый текст + formatting
    const questionData = convertHtmlToTextAndFormatting(questionHTML);
    const answerData = convertHtmlToTextAndFormatting(answerHTML);

    const newQuestion = questionData.text.trim();
    const newAnswer = answerData.text.trim();

    // Получаем formatting из editModalState и обновляем его с новыми данными
    const currentFormatting = editModalState.formatting || createEmptyFormatting();

    console.log('[EDIT MODAL] Новые данные:', {
        newQuestion: newQuestion.substring(0, 50),
        newAnswer: newAnswer.substring(0, 50),
        hasFormatting: !!(currentFormatting.question?.length || currentFormatting.answer?.length)
    });
    console.log('[EDIT MODAL] currentFormatting:', currentFormatting);
    console.log('[EDIT MODAL] editModalState.formatting:', editModalState.formatting);
    console.log('[EDIT MODAL] New question length:', newQuestion.length);
    console.log('[EDIT MODAL] New answer length:', newAnswer.length);

    // Валидация
    if (!newQuestion) {
        showEditNotification('Вопрос не может быть пустым', 'error');
        questionEditor.focus();
        return;
    }

    if (!newAnswer) {
        showEditNotification('Ответ не может быть пустым', 'error');
        answerEditor.focus();
        return;
    }

    // Блокируем кнопку сохранения
    const saveBtn = document.getElementById('edit-save-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Сохранение...';
    }

    try {
        // Получаем текущего пользователя (проверяем оба ключа)
        let username = null;

        // Пробуем получить из UserSystem (currentUser)
        const currentUser = window.UserSystem?.getCurrentUser?.();
        if (currentUser?.username) {
            username = currentUser.username;
            console.log('[EDIT MODAL] Пользователь из UserSystem:', username);
        }

        // Если не нашли, пробуем qaSessionUser
        if (!username) {
            try {
                const sessionUserRaw = localStorage.getItem('qaSessionUser');
                if (sessionUserRaw) {
                    const sessionUser = JSON.parse(sessionUserRaw);
                    if (sessionUser?.username) {
                        username = sessionUser.username;
                        console.log('[EDIT MODAL] Пользователь из qaSessionUser:', username);
                    }
                }
            } catch (e) {
                console.warn('[EDIT MODAL] Не удалось получить пользователя из qaSessionUser:', e);
            }
        }

        if (!username) {
            throw new Error('Пользователь не авторизован');
        }

        // БЕРЕМ oldQuestion ИЗ SESSION.CURRENTCARD ПЕРЕД ОТПРАВКОЙ
        // Это гарантирует, что мы используем актуальные данные карточки
        const currentCard = session?.currentCard;
        const oldQuestion = currentCard?.question;
        const oldAnswer = currentCard?.answer || currentCard?.item?.answer;

        console.log('[EDIT MODAL] Отправка данных на сервер', {
            username,
            oldQuestion: oldQuestion?.substring(0, 50),
            newQuestion: newQuestion.substring(0, 50),
            hasNewAnswer: newAnswer !== oldAnswer
        });

        console.log('[EDIT MODAL] session.currentCard.question:', currentCard?.question?.substring(0, 50));
        console.log('[EDIT MODAL] editModalState.oldQuestion:', editModalState.oldQuestion?.substring(0, 50));
        console.log('[EDIT MODAL] editor text:', newQuestion.substring(0, 50));

        const requestUrl = `/api/card/update?username=${encodeURIComponent(username)}&_t=${Date.now()}`;
        console.log('[EDIT MODAL] Request URL:', requestUrl);

        // Отправляем на сервер
        const response = await fetch(requestUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            },
            body: JSON.stringify({
                oldQuestion: oldQuestion,
                newQuestion: newQuestion,
                newAnswer: newAnswer,
                formatting: currentFormatting
            })
        });

        console.log('[EDIT MODAL] Status:', response.status);

        const result = await response.json();

        console.log('[EDIT MODAL] Ответ сервера:', result);

        // Выводим debug информацию от сервера
        if (result.debug) {
            console.log('[EDIT MODAL] SERVER DEBUG:', result.debug);
            if (result.debug.questionsInFile) {
                console.log('[EDIT MODAL] Questions in file:', result.debug.questionsInFile);
            }
        }

        if (response.ok && result.ok) {
            // Успех
            console.log('[EDIT MODAL] Карточка успешно обновлена');

            const currentIndex = session.currentIndex || 0;

            // 1. Обновляем session.queue
            if (session.queue && session.queue[currentIndex]) {
                session.queue[currentIndex].question = newQuestion;
                session.queue[currentIndex].answer = newAnswer;
                session.queue[currentIndex].formatting = currentFormatting;
                if (session.queue[currentIndex].item) {
                    session.queue[currentIndex].item.question = newQuestion;
                    session.queue[currentIndex].item.answer = newAnswer;
                    session.queue[currentIndex].item.formatting = currentFormatting;
                }
            }

            // 2. Обновляем session.currentCard ПОСЛЕ goTo()
            session.goTo(currentIndex);

            if (session && session.currentCard) {
                session.currentCard.question = newQuestion;
                session.currentCard.answer = newAnswer;
                session.currentCard.formatting = currentFormatting;
                session.currentCard.item.question = newQuestion;
                session.currentCard.item.answer = newAnswer;
                session.currentCard.item.formatting = currentFormatting;

                console.log('[EDIT MODAL] Updated session.currentCard:', session.currentCard.question?.substring(0, 50));
            }

            // 3. Обновляем localStorage (ВАЖНО для сохранения после перезагрузки!)
            try {
                let allCardsRaw = localStorage.getItem('qaUserCards');
                let allCards = [];

                // Если qaUserCards пустой, берём данные из session.queue
                if (!allCardsRaw || allCardsRaw === '[]') {
                    console.log('[EDIT MODAL] ⚠️ qaUserCards пуст, берём из session.queue');
                    if (session && session.queue && session.queue.length > 0) {
                        allCards = session.queue.map(q => ({
                            question: q.question || q.item?.question,
                            answer: q.answer || q.item?.answer,
                            category: q.category || q.item?.category || 'Без категории',
                            subcategory: q.subcategory || q.item?.subcategory || 'Общее',
                            formatting: q.formatting || q.item?.formatting || createEmptyFormatting()
                        }));
                        console.log('[EDIT MODAL] 📦 Загружено карточек из session.queue:', allCards.length);
                    }
                } else {
                    allCards = JSON.parse(allCardsRaw);
                }

                if (allCards.length > 0) {
                    const cardIndex = allCards.findIndex(c => c.question === editModalState.originalCard.question);
                    if (cardIndex !== -1) {
                        allCards[cardIndex].question = newQuestion;
                        allCards[cardIndex].answer = newAnswer;
                        allCards[cardIndex].formatting = currentFormatting;
                        localStorage.setItem('qaUserCards', JSON.stringify(allCards));

                        // 🔥 ОБНОВЛЯЕМ также qaUserCards_{username} для getQaUserCards()
                        const sessionUserRaw = localStorage.getItem('qaSessionUser');
                        if (sessionUserRaw) {
                            try {
                                const user = JSON.parse(sessionUserRaw);
                                if (user && user.username) {
                                    const userKey = `qaUserCards_${user.username}`;
                                    localStorage.setItem(userKey, JSON.stringify(allCards));
                                    console.log('[EDIT MODAL] ✅ Сохранено в', userKey);
                                }
                            } catch (e) {
                                console.warn('[EDIT MODAL] ⚠️ Ошибка сохранения в userKey:', e);
                            }
                        }

                        console.log('[EDIT MODAL] ✅ localStorage обновлён');

                        // 🔥 УСТАНАВЛИВАЕМ ФЛАГ для отложенного обновления UI
                        localStorage.setItem('qaCardsUpdated', 'true');
                        localStorage.setItem('qaCardsUpdatedTimestamp', Date.now().toString());
                        console.log('[EDIT MODAL] ✅ Флаг qaCardsUpdated установлен');

                        // 🔥 ОБНОВЛЯЕМ uniqueQaData через setUniqueQaData
                        if (typeof window.setUniqueQaData === 'function') {
                            window.setUniqueQaData(allCards);
                            console.log('[EDIT MODAL] ✅ uniqueQaData обновлён через setUniqueQaData');
                        } else {
                            console.warn('[EDIT MODAL] ⚠️ window.setUniqueQaData не найден');
                        }

                        // 🔥 ДИСПАТЧИМ СОБЫТИЕ для обновления UI
                        window.dispatchEvent(new CustomEvent('qaDataUpdated', {
                            detail: {
                                updatedCard: allCards[cardIndex],
                                oldQuestion: editModalState.originalCard.question,
                                newQuestion: newQuestion
                            }
                        }));
                        console.log('[EDIT MODAL] ✅ Событие qaDataUpdated отправлено');
                    } else {
                        console.warn('[EDIT MODAL] ❌ Карточка не найдена в localStorage');
                    }
                } else {
                    console.error('[EDIT MODAL] ❌ Нет данных для сохранения');
                }
            } catch (e) {
                console.error('[EDIT MODAL] ❌ Ошибка обновления localStorage:', e);
            }

            // 4. Обновляем originalCard в state
            editModalState.originalCard.question = newQuestion;
            editModalState.originalCard.answer = newAnswer;
            editModalState.originalCard.formatting = currentFormatting;

            console.log('[EDIT MODAL] editModalState.originalCard обновлён:', {
                question: editModalState.originalCard.question?.substring(0, 50)
            });

            // Закрываем модальное окно
            closeEditModal(false);

            // Показываем уведомление
            showEditNotification('Изменения сохранены', 'success');

            // Синхронизируем с сервером
            syncWithServer();
        } else {
            // Ошибка сервера
            console.error('[EDIT MODAL] Ошибка сервера:', result);
            throw new Error(result.error || 'Ошибка сервера');
        }
    } catch (error) {
        console.error('[EDIT MODAL] Ошибка сохранения:', error);
        showEditNotification(`Ошибка сохранения: ${error.message}`, 'error');
    } finally {
        // Разблокируем кнопку
        const saveBtn = document.getElementById('edit-save-btn');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Сохранить';
        }
    }
}

// Показ уведомления
function showEditNotification(message, type = 'success') {
    console.log('[EDIT NOTIFICATION] Показ уведомления:', message, type);

    // Удаляем предыдущее уведомление если есть
    const existingNotification = document.querySelector('.edit-notification');
    if (existingNotification) {
        console.log('[EDIT NOTIFICATION] Удаляем старое уведомление');
        existingNotification.remove();
    }

    const iconSVG = type === 'success'
        ? '<svg class="edit-notification-icon success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'
        : '<svg class="edit-notification-icon error" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';

    const notificationHTML = `
        <div class="edit-notification ${type}" id="edit-notification" style="position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%) translateY(20px); background: #1e1e1e; border-radius: 8px; padding: 12px 24px; box-shadow: 0 4px 16px rgba(0,0,0,0.3); z-index: 10001; display: flex; align-items: center; gap: 12px; opacity: 0; transition: all 0.3s ease-out;">
            ${iconSVG}
            <span class="edit-notification-message" style="color: #fff; font-size: 14px;">${message}</span>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', notificationHTML);

    // Показываем уведомление
    const notification = document.getElementById('edit-notification');
    console.log('[EDIT NOTIFICATION] Notification element:', notification);
    console.log('[EDIT NOTIFICATION] Computed styles:', notification ? getComputedStyle(notification) : 'N/A');

    setTimeout(() => {
        if (notification) {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(-50%) translateY(0)';
            console.log('[EDIT NOTIFICATION] Notification shown');
        }
    }, 10);

    // Скрываем через 3 секунды
    setTimeout(() => {
        notification?.classList.remove('show');
        setTimeout(() => {
            notification?.remove();
        }, 300);
    }, 3000);
}

// Stub for Smart Pause feature to prevent errors
// function showSmartPause(recommendation) {
//    if (!recommendation) return;
//    console.log('[SmartPause] Recommendation:', recommendation);
//    // Auto-resume for now to avoid blocking UI without modal implementation
//    if (session) session.resumeFromPause();
//}

async function handleKeydown(e) {
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
        if (e.key === '1') { userScrolled = false; await session.rate(0); }
        if (e.key === '2') { userScrolled = false; await session.rate(1); }
        if (e.key === '3') { userScrolled = false; await session.rate(2); }
        if (e.key === '4') { userScrolled = false; await session.rate(3); }
    }

    // Navigation arrows (Left/Right)
    if (e.key === 'ArrowLeft') {
        userScrolled = false;
        if (session) session.goTo((session.currentIndex || 0) - 1);
    }
    if (e.key === 'ArrowRight') {
        userScrolled = false;
        if (session) session.goTo((session.currentIndex || 0) + 1);
    }
}

/**
 * Starts a learning session with the given list of candidate questions.
 * @param {Array} candidateQuestions
 */
export function startLearnSession(candidateQuestions, options = {}) {
    // 🔧 Очищаем любой pending таймаут перед запуском новой сессии
    if (window._learnTimerStartTimeout) {
        clearTimeout(window._learnTimerStartTimeout);
        window._learnTimerStartTimeout = null;
    }

    // Проверяем, не перешли ли мы на главную во время запуска
    if (window.__navigatingToHome) {
        window.__navigatingToHome = false;
        return;
    }

    // ВАЖНО: Если сессия уже существует, принудительно завершаем её
    if (session) {
        // Принудительно очищаем таймер
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        // Сбрасываем сессию
        session = null;
    }

    initLearnUI(); // Ensure UI exists

    // 🔧 ПЕРЕЗАПУСК ОБРАБОТЧИКОВ КАРТОЧКИ
    // При повторном запуске сессии нужно перерегистрировать обработчики
    const flashcard = container.querySelector('.flashcard');
    const flashcardFront = container.querySelector('.flashcard-front');
    const flashcardBack = container.querySelector('.flashcard-back');

    // Удаляем старые обработчики клонированием карточки
    if (flashcard && flashcard.parentNode) {
        const newFlashcard = flashcard.cloneNode(true);
        flashcard.parentNode.replaceChild(newFlashcard, flashcard);

        // Добавляем новый обработчик
        function handleCardClick(e) {
            // ⚠️ ПРОВЕРЯЕМ: клик должен быть именно по карточке, а не по кнопкам
            const target = e.target;
            if (target.closest('.rate-btn') ||
                target.closest('.learn-fav-btn') ||
                target.closest('.learn-edit-btn') ||
                target.closest('.nav-arrow-btn')) {
                e.stopPropagation();
                return;
            }

            if (session && !session.isFlipped) {
                session.flip();
            }
        }

        newFlashcard.addEventListener('click', handleCardClick);
        newFlashcard.querySelector('.flashcard-front')?.addEventListener('click', handleCardClick);
        newFlashcard.querySelector('.flashcard-back')?.addEventListener('click', handleCardClick);

        // 🔧 ПЕРЕРЕГИСТРИРУЕМ обработчики кнопок на НОВЫХ элементах после клонирования

        // Favorite buttons
        newFlashcard.querySelectorAll('.learn-fav-btn').forEach(btn => {
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
                newFlashcard.querySelectorAll('.learn-fav-btn').forEach(b => {
                    b.innerHTML = starSvg(newIsFav);
                    b.classList.toggle('active', newIsFav);
                });
            });
        });

        // Edit buttons
        newFlashcard.querySelectorAll('.learn-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!session || !session.currentCard) {
                    return;
                }
                openEditModal(session.currentCard);
            });
        });

        // 🔧 Rate buttons (оценка) - перерегистрируем после клонирования
        const rates = newFlashcard.querySelectorAll('.rate-btn');
        console.log('[startLearnSession] 🔄 Re-registering rate buttons:', rates.length);

        let isRatingInProgress = false;

        rates.forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();

                if (isRatingInProgress) {
                    return;
                }

                const grade = parseInt(btn.dataset.grade);

                isRatingInProgress = true;
                btn.style.pointerEvents = 'none';
                userScrolled = false;

                if (session) {
                    await session.rate(grade);
                }

                btn.blur();

                setTimeout(() => {
                    btn.style.pointerEvents = '';
                    isRatingInProgress = false;
                }, 300);
            });
        });

        // 🔧 Navigation buttons (вперед/назад) - перерегистрируем после клонирования
        const navBtns = newFlashcard.querySelectorAll('.nav-arrow-btn');
        console.log('[startLearnSession] 🔄 Re-registering nav buttons:', navBtns.length);

        navBtns.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();

                if (!session) return;

                const direction = btn.classList.contains('right') ? 1 : -1;
                console.log('[NAV BUTTON CLICK] 🖱️ Nav clicked! Direction:', direction);

                session.goTo(session.currentIndex + direction);
                btn.blur();
            });
        });
    }

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
    // Показываем learn-schedule-info только для обычного режима обучения (не cram)
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
            // В режиме углубленного обучения скрываем этот блок
            infoEl.style.display = 'none';
        } else {
            // Убираем День X/Y и Прогресс - не нужно в режиме обучения
            infoEl.textContent = '';
            infoEl.style.display = '';
        }
    }

    // 🔧 ПЕРЕМЕЩАЕМ ТАЙМЕР И СЧЁТЧИК В .learn-header
    const timerEl2 = document.getElementById('mode-timer');
    const counterEl = document.getElementById('learn-counter');
    const learnHeader2 = document.querySelector('.learn-header');
    const exitBtn = document.getElementById('learn-exit-btn');

    // 🔧 КЛОНИРОВАНИЕ ЭЛЕМЕНТОВ ТАЙМЕРА ДЛЯ СБРОСА ОБРАБОТЧИКОВ
    // СНАЧАЛА очищаем старый таймер если есть
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    // Клонируем timer-controls чтобы сбросить все старые обработчики
    const timerControls = document.getElementById('timer-controls');
    if (timerControls) {
        // Удаляем старые обработчики перед клонированием
        if (timerPauseHandler) {
            const pauseBtn = document.getElementById('timer-pause-btn');
            if (pauseBtn) pauseBtn.removeEventListener('click', timerPauseHandler);
        }
        if (timerClickHandler) {
            const timerEl = document.getElementById('mode-timer');
            if (timerEl) timerEl.removeEventListener('click', timerClickHandler);
        }
        if (timerControlsHandler) {
            timerControls.removeEventListener('click', timerControlsHandler);
        }
        const newTimerControls = timerControls.cloneNode(true);
        timerControls.parentNode.replaceChild(newTimerControls, timerControls);
    }

    // НЕ перемещаем таймер! Он остаётся внутри .timer-controls внутри .flashcard
    // Просто обновляем стили для ПК версии через CSS классы

    // Перемещаем только learn-counter в learn-header
    if (counterEl && learnHeader2) {
        learnHeader2.appendChild(counterEl);
    }

    // 🔧 ВЫНОСИМ .learn-progress ИЗ .learn-header - будет отдельным блоком снизу
    const learnProgressEl = document.querySelector('.learn-progress');
    if (learnProgressEl && learnHeader2) {
        learnHeader2.parentNode.insertBefore(learnProgressEl, learnHeader2.nextSibling);
    }

    // Start Timer
    // ⚠️ ВАЖНО: Сначала выключаем флаг и очищаем ВСЕ интервалы
    isTimerRunning = false;

    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    // 🛡️ Дополнительная защита: ждём 200мс перед запуском нового таймера
    sessionTimerStart = Date.now();
    timerPaused = false;
    pausedTimeRemaining = 0;

    // Сохраняем ссылку на текущий таймаут для возможной отмены
    const startTimerTimeout = setTimeout(() => {
        // ⚠️ ПРОВЕРЯЕМ: не была ли сессия закрыта во время задержки
        if (!session) {
            return;
        }

        isTimerRunning = true;
        updateTimerDisplay();
        timerInterval = setInterval(updateTimerDisplay, 1000);
        currentIntervalId = timerInterval; // Сохраняем ID текущего интервала
    }, 200);

    // Сохраняем ссылку на таймаут для отмены при stopLearnSession
    window._learnTimerStartTimeout = startTimerTimeout;

    // Setup timer pause/resume functionality
    setupTimerControls();

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
    const progressBar = container.querySelector('.learn-progress-bar');
    const learnProgress = container.querySelector('.learn-progress');
    const learnHeader = container.querySelector('.learn-header');

    if (progressFill) {
        progressFill.style.width = '0%';
        progressFill.style.pointerEvents = 'none';
    }

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
    console.log('========================================');
    console.log('[STOP LEARN SESSION] ========== START ==========');
    console.log('[STOP LEARN SESSION] Timestamp:', new Date().toISOString());
    console.log('[STOP LEARN SESSION] Current hash:', location.hash);
    console.log('[STOP LEARN SESSION] container:', container ? 'exists' : 'null');
    console.log('[STOP LEARN SESSION] mainContainer:', mainContainer ? 'exists' : 'null');

    // 🔥 ПЕРЕНАПРАВЛЯЕМ НА СТРАНИЦУ СТАТИСТИКИ
    // Устанавливаем hash для истории браузера
    const wasOnStats = location.hash === '#/stats';
    console.log('[STOP LEARN SESSION] Was on stats page:', wasOnStats);

    if (wasOnStats) {
        console.log('[STOP LEARN SESSION] Already on stats, using intermediate hash');
        location.hash = '#/learning-exit';
    }

    location.hash = '#/stats';
    console.log('[STOP LEARN SESSION] Hash after set:', location.hash);

    // 🔥 ВАЖНО: Вызываем initStatsPage() напрямую, а не ждем hashchange
    // Это гарантирует мгновенный переход без задержек и мелькания главной страницы
    console.log('[STOP LEARN SESSION] Calling initStatsPage() directly...');

    // 🔥 ВАЖНО: НЕ восстанавливаем UI пока статистика не загрузится
    // Иначе главная страница успеет показаться раньше статистики
    import('./stats-ui.js?v=6.24.0').then(({ initStatsPage }) => {
        console.log('[STOP LEARN SESSION] Stats module loaded, calling initStatsPage...');
        initStatsPage(window.currentAppVersion || '6.09');
        console.log('[STOP LEARN SESSION] initStatsPage called');

        // Теперь восстанавливаем UI ПОСЛЕ инициализации статистики
        // 1. Очищаем таймер
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
            console.log('[STOP LEARN SESSION] Timer interval cleared');
        }

        // 1.5. Отменяем отложенный запуск таймера если он есть
        if (window._learnTimerStartTimeout) {
            clearTimeout(window._learnTimerStartTimeout);
            window._learnTimerStartTimeout = null;
            console.log('[STOP LEARN SESSION] Deferred timer start cleared');
        }

        // 2. Выключаем глобальный флаг - это заблокирует все orphaned setInterval
        isTimerRunning = false;
        currentIntervalId = null;
        console.log('[STOP LEARN SESSION] isTimerRunning=false, currentIntervalId=null');

        // 3. Сбрасываем флаги таймера
        timerPaused = false;
        pausedTimeRemaining = 0;
        sessionTimerStart = 0;

        // 3. Скрываем таймер
        const timerEl = document.getElementById('mode-timer');
        if (timerEl) {
            timerEl.textContent = '00:00';
            console.log('[STOP LEARN SESSION] Timer element hidden');
        }

        // 4. Сбрасываем иконку паузы
        const pauseBtn = document.getElementById('timer-pause-btn');
        if (pauseBtn) {
            pauseBtn.classList.remove('paused');
            pauseBtn.classList.add('running');
            console.log('[STOP LEARN SESSION] Pause button reset');
        }

        // 5. Очищаем обработчики таймера
        const timerControls = document.getElementById('timer-controls');
        // timerEl уже объявлен выше
        if (timerPauseHandler && pauseBtn) {
            pauseBtn.removeEventListener('click', timerPauseHandler);
        }
        if (timerClickHandler && timerEl) {
            timerEl.removeEventListener('click', timerClickHandler);
        }
        if (timerControlsHandler && timerControls) {
            timerControls.removeEventListener('click', timerControlsHandler);
        }
        timerPauseHandler = null;
        timerClickHandler = null;
        timerControlsHandler = null;
        console.log('[STOP LEARN SESSION] Timer event handlers cleaned');

        if (container) {
            container.style.display = 'none';
            console.log('[STOP LEARN SESSION] container.style.display = "none"');
        }
        if (mainContainer) {
            mainContainer.style.display = 'block';
            console.log('[STOP LEARN SESSION] mainContainer.style.display = "block"');
        }
        // Restore sidebar
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.style.display = '';
            console.log('[STOP LEARN SESSION] sidebar display reset');
        }

        // Возвращаем навигацию и убираем класс с body
        document.body.classList.remove('learning-mode');
        console.log('[STOP LEARN SESSION] learning-mode class removed from body');
        const bottomNav = document.getElementById('bottom-nav');
        if (bottomNav) {
            bottomNav.style.display = 'flex';
            console.log('[STOP LEARN SESSION] bottomNav displayed');
        }

        // Восстанавливаем search-container и top-actions-bar
        const searchContainer = document.querySelector('.search-container');
        if (searchContainer) {
            searchContainer.style.display = '';
            console.log('[STOP LEARN SESSION] search-container display reset');
        }

        const topActionsBar = document.querySelector('.top-actions-bar');
        if (topActionsBar) {
            topActionsBar.style.display = 'flex';
        }

        window.dispatchEvent(new Event('favoritesUpdated'));

        // 6. Очищаем сессию
        if (session) {
            session = null;
        }

        // 🔧 СБРАСЫВАЕМ флаг инициализации UI чтобы можно было переинициализировать при необходимости
        window.__learnUIInitialized = false;

        console.log('[STOP LEARN SESSION] ========== END ==========');
    }).catch(err => {
        console.error('[STOP LEARN SESSION] Failed to load stats-ui:', err);
    });
}

function renderCardState(state) {
    if (state.pauseRecommendation) {
        try { showSmartPause(state.pauseRecommendation); } catch (e) { console.error('Pause error', e); }
    }

    if (!container) return; // Guard against missing container

    console.log('[RENDER CARD STATE] === CALLED ===');
    console.log('[RENDER CARD STATE] state.results=', state.results, 'length=', state.results.length);
    console.log('[RENDER CARD STATE] session=', session ? 'exists' : 'null');
    console.log('[RENDER CARD STATE] session.results=', session ? session.results : 'null');
    console.log('[RENDER CARD STATE] session.currentIndex=', session ? session.currentIndex : 'null');

    const cardEl = container.querySelector('.flashcard');
    const front = container.querySelector('.flashcard-front');
    const back = container.querySelector('.flashcard-back');
    const qEl = document.getElementById('learn-question');
    const aEl = document.getElementById('learn-answer');
    const counter = document.getElementById('learn-counter');
    const progressFill = container.querySelector('.learn-progress-fill');

    // Update segments
    // Используем session.currentIndex вместо state.currentIndex
    const currentIndex = session ? (session.currentIndex || 0) : 0;
    console.log('[SEGMENTS DEBUG] Перед updateSegments: currentIndex=', currentIndex, 'total=', state.total);
    console.log('[SEGMENTS DEBUG] results=', state.results, 'length=', state.results.length);
    console.log('[SEGMENTS DEBUG] session.results=', session ? session.results : 'no session', 'session.currentIndex=', session ? session.currentIndex : 'no session');
    updateSegments(state.results, state.total, currentIndex, true);
    console.log('[SEGMENTS DEBUG] После updateSegments');
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
    } catch { }

    if (qEl && state.card) {
        // Применяем форматирование к вопросу
        // Берём formatting из session.currentCard (там актуальные данные)
        const sessionCard = session?.currentCard;
        const questionFormatting = sessionCard?.formatting?.question || state.card.formatting?.question || [];
        const questionText = sessionCard?.question || state.card.question || '(Пустой вопрос)';
        const questionHTML = applyFormatting(questionText, questionFormatting);
        qEl.innerHTML = questionHTML;

        // DEBUG: Проверяем, что вставилось
        console.log('[RENDER CARD] Question rendered:', {
            text: questionText,
            formatting: questionFormatting,
            html: questionHTML,
            innerHTML: qEl.innerHTML,
            childrenCount: qEl.children.length,
            spans: Array.from(qEl.querySelectorAll('span')).map(s => s.outerHTML)
        });

        // DEBUG: Проверяем стили первого span
        setTimeout(() => {
            const firstSpan = qEl.querySelector('span');
            if (firstSpan) {
                const styles = window.getComputedStyle(firstSpan);
                console.log('[RENDER CARD] ❗ First QUESTION span STYLES:', {
                    display: styles.display,
                    color: styles.color,
                    textDecoration: styles.textDecoration,
                    fontFamily: styles.fontFamily,
                    fontWeight: styles.fontWeight,
                    fontStyle: styles.fontStyle
                });
            }
        }, 100);
    }
    if (aEl && state.card) {
        // Применяем форматирование к ответу
        const sessionCard = session?.currentCard;
        const answerFormatting = sessionCard?.formatting?.answer || state.card.formatting?.answer || [];
        const answerText = sessionCard?.answer || state.card.answer || '(Пустой ответ)';
        const answerHTML = applyFormatting(answerText, answerFormatting);
        aEl.innerHTML = answerHTML;

        // DEBUG: Проверяем, что вставилось
        console.log('[RENDER CARD] Answer rendered:', {
            text: answerText,
            formatting: answerFormatting,
            html: answerHTML,
            innerHTML: aEl.innerHTML,
            childrenCount: aEl.children.length,
            spans: Array.from(aEl.querySelectorAll('span')).map(s => s.outerHTML)
        });

        // DEBUG: Проверяем стили первого span
        setTimeout(() => {
            const firstSpan = aEl.querySelector('span');
            if (firstSpan) {
                const styles = window.getComputedStyle(firstSpan);
                console.log('[RENDER CARD] ❗ First ANSWER span STYLES:', {
                    display: styles.display,
                    color: styles.color,
                    textDecoration: styles.textDecoration,
                    fontFamily: styles.fontFamily,
                    fontWeight: styles.fontWeight,
                    fontStyle: styles.fontStyle
                });
            }
        }, 100);
    }

    // DEBUG: Логируем стили ответа
    console.log('\n📦 FLASHCARD ANSWER DEBUG:');
    console.log('   #learn-answer элемент:', aEl);
    if (aEl) {
        const styles = window.getComputedStyle(aEl);
        console.log('   padding-top:', styles.paddingTop);
        console.log('   margin-top:', styles.marginTop);
        console.log('   font-size:', styles.fontSize);
        console.log('   display:', styles.display);
        console.log('   align-items:', styles.alignItems);
        console.log('   Parent (.flashcard-back) styles:');
        const backStyles = window.getComputedStyle(back);
        console.log('      padding:', backStyles.padding);
        console.log('      display:', backStyles.display);
    }

    // Проверка перекрытия front/back
    console.log('\n🔄 FRONT/BACK OVERLAP CHECK:');
    if (front && back) {
        const frontStyles = window.getComputedStyle(front);
        const backStyles = window.getComputedStyle(back);
        const frontRect = front.getBoundingClientRect();
        const backRect = back.getBoundingClientRect();

        console.log('   .flashcard-front:');
        console.log('      display:', frontStyles.display);
        console.log('      position:', frontStyles.position);
        console.log('      z-index:', frontStyles.zIndex);
        console.log('      transform:', frontStyles.transform);
        console.log('      opacity:', frontStyles.opacity);
        console.log('      rect:', frontRect);

        console.log('   .flashcard-back:');
        console.log('      display:', backStyles.display);
        console.log('      position:', backStyles.position);
        console.log('      z-index:', backStyles.zIndex);
        console.log('      transform:', backStyles.transform);
        console.log('      opacity:', backStyles.opacity);
        console.log('      rect:', backRect);

        console.log('   .flashcard (parent):');
        const cardStyles = window.getComputedStyle(cardEl);
        console.log('      display:', cardStyles.display);
        console.log('      position:', cardStyles.position);
        console.log('      perspective:', cardStyles.perspective);
        console.log('      transform-style:', cardStyles.transformStyle);
    }

    // Проверка custom-styles.css
    console.log('\n📜 CUSTOM-styles.css CHECK:');
    const allStyles = Array.from(document.styleSheets);
    console.log('   Всего style sheets:', allStyles.length);
    allStyles.forEach((sheet, i) => {
        try {
            const rules = Array.from(sheet.cssRules || []);
            const hasFlashcardBack = rules.some(r => r.selectorText && r.selectorText.includes('.flashcard-back'));
            if (hasFlashcardBack) {
                console.log(`   Sheet ${i}: содержит .flashcard-back правила`);
                rules.forEach(r => {
                    if (r.selectorText && r.selectorText.includes('.flashcard-back .flashcard-content')) {
                        console.log(`      Rule: ${r.selectorText} -> padding-top: ${r.style.paddingTop}, margin-top: ${r.style.marginTop}`);
                    }
                });
            }
        } catch (e) {
            // CORS
        }
    });

    // Обновляем вопрос на back-стороне С ФОРМАТИРОВАНИЕМ
    const backQuestionEl = document.getElementById('learn-back-question');
    if (backQuestionEl && state.card) {
        const sessionCard = session?.currentCard;
        const questionFormatting = sessionCard?.formatting?.question || state.card.formatting?.question || [];
        const questionText = sessionCard?.question || state.card.question || '(Пустой вопрос)';
        const questionHTML = applyFormatting(questionText, questionFormatting);
        backQuestionEl.innerHTML = questionHTML;

        console.log('[RENDER CARD] Back question rendered:', {
            text: questionText,
            formatting: questionFormatting,
            html: questionHTML,
            innerHTML: backQuestionEl.innerHTML
        });

        // DEBUG: Проверяем стили первого span
        setTimeout(() => {
            const firstSpan = backQuestionEl.querySelector('span');
            if (firstSpan) {
                const styles = window.getComputedStyle(firstSpan);
                console.log('[RENDER CARD] ❗ First BACK QUESTION span STYLES:', {
                    display: styles.display,
                    color: styles.color,
                    textDecoration: styles.textDecoration,
                    fontFamily: styles.fontFamily,
                    fontWeight: styles.fontWeight,
                    fontStyle: styles.fontStyle
                });
            }
        }, 100);
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
                easyBtn.setAttribute('data-locked', 'true');
                easyBtn.innerHTML = 'Легко 🔒 (4)';
            } else {
                easyBtn.style.opacity = '1';
                easyBtn.style.cursor = 'pointer';
                easyBtn.title = '';
                easyBtn.removeAttribute('data-locked');
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
        } else if (state.mode === 'time_attack') {
            // В режиме time_attack скрываем таймер, если время не показано
            timerEl.style.display = 'none';
        }
        // Для остальных режимов (cram, ordinary) НЕ скрываем таймер - он управляется через updateTimerDisplay
    }
}

function updateSegments(results, total, currentIndex = 0, autoScroll = true) {
    const segs = document.getElementById('learn-segments');
    if (!segs) return;

    // Всегда показываем 6 сегментов: 3 пройденных + 1 текущий + 2 следующих
    const visibleCount = 6;
    let startIdx = currentIndex - 3; // 3 до текущего
    let endIdx = currentIndex + 2;   // 2 после текущего

    // Если не хватает сегментов после текущего, сдвигаем диапазон вправо
    if (endIdx >= total) {
        endIdx = total - 1;
        startIdx = Math.max(0, endIdx - visibleCount + 1);
    }

    // Если не хватает сегментов до текущего, сдвигаем диапазон влево
    if (startIdx < 0) {
        startIdx = 0;
        endIdx = Math.min(total - 1, visibleCount - 1);
    }

    // Создаём все сегменты один раз
    if (segs.childElementCount !== total) {
        segs.innerHTML = '';
        for (let i = 0; i < total; i++) {
            const s = document.createElement('div');
            s.className = 'learn-progress-segment';
            s.dataset.index = i;
            segs.appendChild(s);
        }
    }

    // Показываем ВСЕ сегменты
    // Закрашенные сегменты - яркие, непройденные - серые
    Array.from(segs.children).forEach((el, i) => {
        // isColored: результат для этого сегмента существует и не null
        const isColored = results && i < results.length && results[i] !== null && results[i] !== undefined;

        if (isColored) {
            // Закрашенный сегмент - полностью видимый
            el.style.opacity = '1';
        } else {
            // Непройденный сегмент - полупрозрачный серый
            el.style.opacity = '0.5';
        }
    });

    // Центрируем текущий сегмент
    const currentEl = segs.children[currentIndex];
    console.log('[SEGMENTS] currentEl=', currentEl, 'autoScroll=', autoScroll, 'userScrolled=', userScrolled);

    // Если был ручной скролл и autoScroll не включён принудительно - не скроллим
    const shouldScroll = autoScroll && !userScrolled;

    if (currentEl && shouldScroll) {
        // Принудительно показываем текущий сегмент для прокрутки
        currentEl.style.opacity = '1';

        // Позиционируем так, чтобы текущий был 4-м слева (3-1-2)
        // Для этого скроллим так, чтобы startIdx был виден слева
        const segWidth = currentEl.offsetWidth + 2; // width + gap
        const targetPosition = startIdx * segWidth;

        console.log('[SEGMENTS SCROLL] segWidth=', segWidth, 'startIdx=', startIdx, 'targetPosition=', targetPosition, 'current scrollLeft=', segs.scrollLeft);

        segs.scrollTo({
            left: Math.max(0, targetPosition),
            behavior: 'smooth'
        });

        currentEl.classList.add('current');
        console.log('[SEGMENTS] Added class current to segment', currentIndex);
    } else if (currentEl) {
        // Просто добавляем класс current без скролла
        currentEl.classList.add('current');
        console.log('[SEGMENTS] Added class current (no scroll) to segment', currentIndex);
    }

    // Убираем класс current у остальных
    Array.from(segs.children).forEach((el, i) => {
        if (i !== currentIndex) {
            el.classList.remove('current');
        }
    });

    // Color segments by results
    console.log('[SEGMENTS COLOR] === START ===');
    console.log('[SEGMENTS COLOR] results=', results, 'total=', total, 'currentIndex=', currentIndex);
    console.log('[SEGMENTS COLOR] segs.children.count=', segs.children.length);

    if (results && results.length) {
        // results[i] содержит оценку для карточки с индексом i
        // null означает, что карточка ещё не пройдена
        let coloredCount = 0;
        for (let idx = 0; idx < results.length && idx < total; idx++) {
            const g = results[idx];
            if (g === null || g === undefined) {
                // Карточка ещё не пройдена, пропускаем
                continue;
            }
            const el = segs.children[idx];
            if (!el) {
                console.log('[SEGMENTS COLOR] el NOT FOUND for idx=', idx, 'grade=', g);
                continue;
            }

            // Проверяем, является ли этот сегмент текущим
            const isCurrent = (idx === currentIndex);
            console.log('[SEGMENTS COLOR] idx=', idx, 'grade=', g, 'isCurrent=', isCurrent, 'currentIndex=', currentIndex);
            console.log('[SEGMENTS COLOR] el.className BEFORE=', el.className);

            // Устанавливаем базовый класс + цвет
            el.className = 'learn-progress-segment';
            if (g === 0) el.classList.add('seg-again');
            else if (g === 1) el.classList.add('seg-hard');
            else if (g === 2) el.classList.add('seg-good');
            else if (g === 3) el.classList.add('seg-easy');

            // Добавляем класс current, если это текущий сегмент
            if (isCurrent) {
                el.classList.add('current');
                console.log('[SEGMENTS COLOR] Added .current to idx=', idx);
            }

            console.log('[SEGMENTS COLOR] el.className AFTER=', el.className);
            console.log('[SEGMENTS COLOR] el.classList=', Array.from(el.classList));
            coloredCount++;
        }
        console.log('[SEGMENTS COLOR] Colored', coloredCount, 'segments out of', total);
    } else {
        console.log('[SEGMENTS COLOR] NO RESULTS to color');
    }
    console.log('[SEGMENTS COLOR] === END ===');

    // Финальная отладка
    console.log('[SEGMENTS] currentIndex:', currentIndex, 'visible:', startIdx, '-', endIdx, 'count:', (endIdx - startIdx + 1), 'autoScroll:', autoScroll);

    // Проверяем все сегменты после покраски
    console.log('[SEGMENTS FINAL] === ALL SEGMENTS STATE ===');
    Array.from(segs.children).forEach((el, i) => {
        console.log('[SEGMENTS FINAL] idx=', i, 'className=', el.className, 'classList=', Array.from(el.classList));
    });
}

function wireSegmentsInteractions(sess) {
    const segs = document.getElementById('learn-segments');
    if (!segs) return;

    // Отслеживаем ручной скролл пользователя
    segs.addEventListener('scroll', () => {
        console.log('[SEGMENTS] user scrolled');
        userScrolled = true;
    }, { passive: true });

    // Прокрутка колесиком
    segs.addEventListener('wheel', (e) => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            e.preventDefault();
            segs.scrollLeft += e.deltaY;
        }
    }, { passive: false });

    // === Инерционная прокрутка для touch устройств ===
    let isDragging = false;
    let startX = 0;
    let scrollLeft = 0;
    let startTime = 0;
    let lastX = 0;
    let lastTime = 0;
    let velocity = 0;
    let animationFrame = null;

    // Обработка начала касания
    segs.addEventListener('touchstart', (e) => {
        isDragging = true;
        startX = e.touches[0].clientX;
        scrollLeft = segs.scrollLeft;
        startTime = Date.now();
        lastX = startX;
        lastTime = startTime;
        velocity = 0;

        // Останавливаем предыдущую анимацию
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }
    }, { passive: true });

    // Обработка движения пальца
    segs.addEventListener('touchmove', (e) => {
        if (!isDragging) return;

        const currentX = e.touches[0].clientX;
        const currentTime = Date.now();

        // Вычисляем смещение
        const walk = (currentX - startX) * 1.5; // Увеличенный коэффициент для чувствительности
        segs.scrollLeft = scrollLeft - walk;

        // Вычисляем скорость для инерции
        const deltaX = currentX - lastX;
        const deltaTime = currentTime - lastTime;

        if (deltaTime > 0) {
            velocity = deltaX / deltaTime; // пикселей в миллисекунду
        }

        lastX = currentX;
        lastTime = currentTime;
    }, { passive: true });

    // Обработка окончания касания - запуск инерции
    segs.addEventListener('touchend', (e) => {
        isDragging = false;

        // Если скорость достаточная, запускаем инерционную прокрутку
        if (Math.abs(velocity) > 0.3) {
            const inertialScroll = () => {
                velocity *= 0.92; // Коэффициент затухания (0.92 = плавное замедление)

                const newScrollLeft = segs.scrollLeft - (velocity * 16); // 16ms ≈ 60fps
                segs.scrollLeft = Math.max(0, Math.min(newScrollLeft, segs.scrollWidth - segs.clientWidth));

                // Продолжаем анимацию, пока скорость значимая
                if (Math.abs(velocity) > 0.1) {
                    animationFrame = requestAnimationFrame(inertialScroll);
                } else {
                    animationFrame = null;
                }
            };

            animationFrame = requestAnimationFrame(inertialScroll);
        }
    }, { passive: true });

    // Обработка отмены касания
    segs.addEventListener('touchcancel', (e) => {
        isDragging = false;
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }
    }, { passive: true });

    // Drag перетаскивание для мыши
    let isMouseDragging = false;
    let mouseStartX = 0;
    let mouseScrollLeft = 0;
    let mouseLastX = 0;
    let mouseLastTime = 0;
    let mouseVelocity = 0;

    segs.addEventListener('mousedown', (e) => {
        isMouseDragging = true;
        mouseStartX = e.pageX - segs.offsetLeft;
        mouseScrollLeft = segs.scrollLeft;
        startTime = Date.now();
        mouseLastX = mouseStartX;
        mouseLastTime = startTime;
        mouseVelocity = 0;
        segs.style.cursor = 'grabbing';

        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }
    });

    segs.addEventListener('mouseleave', () => {
        isMouseDragging = false;
        segs.style.cursor = 'grab';
    });

    segs.addEventListener('mouseup', () => {
        isMouseDragging = false;
        segs.style.cursor = 'grab';

        // Инерция для мыши тоже
        if (Math.abs(mouseVelocity) > 0.3) {
            const inertialScroll = () => {
                mouseVelocity *= 0.92;

                const newScrollLeft = segs.scrollLeft - (mouseVelocity * 16);
                segs.scrollLeft = Math.max(0, Math.min(newScrollLeft, segs.scrollWidth - segs.clientWidth));

                if (Math.abs(mouseVelocity) > 0.1) {
                    animationFrame = requestAnimationFrame(inertialScroll);
                } else {
                    animationFrame = null;
                }
            };

            animationFrame = requestAnimationFrame(inertialScroll);
        }
    });

    segs.addEventListener('mousemove', (e) => {
        if (!isMouseDragging) return;
        e.preventDefault();

        const currentX = e.pageX - segs.offsetLeft;
        const currentTime = Date.now();

        const walk = (currentX - mouseStartX) * 2;
        segs.scrollLeft = mouseScrollLeft - walk;

        // Вычисляем скорость
        const deltaX = currentX - mouseLastX;
        const deltaTime = currentTime - mouseLastTime;

        if (deltaTime > 0) {
            mouseVelocity = deltaX / deltaTime;
        }

        mouseLastX = currentX;
        mouseLastTime = currentTime;
    });

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
            el.style.pointerEvents = 'auto'; /* Разрешаем клики */
            el.style.cursor = 'pointer';
            el.onclick = (e) => {
                e.stopPropagation(); /* Останавливаем всплытие */
                e.preventDefault();
                hidePreview();
            };
            el.ontouchend = (e) => {
                e.stopPropagation(); /* Останавливаем всплытие */
                e.preventDefault();
                hidePreview();
            };
            document.body.appendChild(el);
        }
        return el;
    };
    const showPreview = (index, anchor) => {
        const el = ensurePreviewEl();
        const q = sess.queue[index]?.item?.question || '';
        const a = sess.queue[index]?.item?.answer || '';
        el.innerHTML = `<div style="font-weight:600;margin-bottom:6px;">${q}</div><div style="opacity:0.8">${a}</div><div style="font-size:11px;opacity:0.5;margin-top:8px;">Нажмите, чтобы закрыть</div>`;
        const r = anchor.getBoundingClientRect();
        const isMobile = window.innerWidth < 768;
        el.style.display = 'block';
        el.style.pointerEvents = 'auto'; /* Разрешаем клики */
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
            e.stopPropagation(); /* Останавливаем всплытие к карточке */
            e.preventDefault();

            console.log('[SEGMENT CLICK] === CLICK START ===');
            console.log('[SEGMENT CLICK] Clicked on segment', i);
            console.log('[SEGMENT CLICK] sess.currentIndex BEFORE goTo=', sess.currentIndex);
            console.log('[SEGMENT CLICK] sess.results BEFORE goTo=', sess.results);

            // Переходим к карточке
            sess.goTo(i);
            hidePreview();

            console.log('[SEGMENT CLICK] sess.currentIndex AFTER goTo=', sess.currentIndex);
            console.log('[SEGMENT CLICK] sess.results AFTER goTo=', sess.results);

            // Сбрасываем флаг ручного скролла
            userScrolled = false;

            // Вызываем updateSegments с autoScroll=true для возврата к 3-1-2
            // sess.results - это уже массив чисел (оценок)
            console.log('[SEGMENT CLICK] Calling updateSegments with results=', sess.results);
            updateSegments(sess.results, sess.queue.length, i, true);

            console.log('[SEGMENT CLICK] === CLICK END ===');
            console.log('[SEGMENT CLICK] Done');
        });
        seg.addEventListener('mouseenter', () => showPreview(i, seg));
        seg.addEventListener('mouseleave', hidePreview);
        seg.addEventListener('touchstart', (e) => {
            if (touchTimer) clearTimeout(touchTimer);
            const target = seg;
            touchTimer = setTimeout(() => { showPreview(i, target); touchTimer = null; }, 300);
        }, { passive: true });
        seg.addEventListener('touchend', (e) => {
            e.stopPropagation(); /* Останавливаем всплытие к карточке */
            if (touchTimer) {
                clearTimeout(touchTimer);
                touchTimer = null;

                // Сбрасываем флаг ручного скролла
                userScrolled = false;

                sess.goTo(i);

                // Вызываем updateSegments с autoScroll=true для возврата к 3-1-2
                // sess.results - это уже массив чисел (оценок)
                console.log('[SEGMENT TOUCHEND] sess.results=', sess.results);
                updateSegments(sess.results, sess.queue.length, i, true);
            }
        });
    });
    document.addEventListener('scroll', hidePreview, { passive: true });
    window.addEventListener('resize', hidePreview);
}

function showStats(stats, results, total) {
    console.log('[MODAL.TEMPLATE] === CREATING MODAL ===');

    // Update segments one last time to show the final card's result
    if (results && total && session) {
        updateSegments(results, total, session.currentIndex || 0);
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
        overlay.querySelector('#sum-exit').addEventListener('click', () => {
            console.log('========================================');
            console.log('[STATS BUTTON] ========== STATS BUTTON CLICKED ==========');
            console.log('[STATS BUTTON] Timestamp:', new Date().toISOString());
            console.log('[STATS BUTTON] currentScheduler:', currentScheduler);
            console.log('[STATS BUTTON] document.body.classList:', document.body.classList.toString());

            // ПРИНУДИТЕЛЬНО завершаем сессию обучения
            if (currentScheduler) {
                currentScheduler = null;
                console.log('[STATS BUTTON] Cleared currentScheduler');
            }

            // ПРИНУДИТЕЛЬНО убираем класс learning-mode
            document.body.classList.remove('learning-mode');
            console.log('[STATS BUTTON] Removed learning-mode');

            // ПРИНУДИТЕЛЬНО показываем навигацию
            const bottomNav = document.getElementById('bottom-nav');
            if (bottomNav) {
                bottomNav.style.display = 'flex';
                console.log('[STATS BUTTON] Showed bottomNav');
            }

            // ПРИНУДИТЕЛЬНО скрываем контейнер обучения
            const learnContainer = document.getElementById('learn-container');
            if (learnContainer) {
                learnContainer.style.display = 'none';
                console.log('[STATS BUTTON] Hid learn-container');
            }

            // Закрываем модалку
            overlay.remove();
            console.log('[STATS BUTTON] Removed overlay');

            // ИСПРАВЛЕНИЕ: Вызываем initStatsPage() напрямую, а не через hashchange
            // Потому что если hash уже #/stats, событие hashchange не сработает
            console.log('[STATS BUTTON] Calling initStatsPage() directly...');

            // Показываем placeholder ДО загрузки модуля
            console.log('[STATS BUTTON] Creating loading placeholder...');
            const skeletonPlaceholder = document.createElement('div');
            skeletonPlaceholder.id = 'stats-skeleton-placeholder';
            skeletonPlaceholder.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: #0E1117;
                z-index: 1998;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            skeletonPlaceholder.innerHTML = `
                <div style="color: #8B949E; font-size: 14px;">Загрузка статистики...</div>
            `;
            document.body.appendChild(skeletonPlaceholder);
            console.log('[STATS BUTTON] Loading placeholder shown');

            // Импортируем и вызываем initStatsPage
            import('./stats-ui.js?v=6.24.0').then(({ initStatsPage }) => {
                console.log('[STATS BUTTON] Stats module loaded, calling initStatsPage...');
                initStatsPage(window.currentAppVersion || '6.09');
            }).catch(err => {
                console.error('[STATS BUTTON] Failed to load stats-ui:', err);
                skeletonPlaceholder.remove();
            });

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
    accEl.classList.remove('acc-good', 'acc-mid', 'acc-bad');
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
    try { window.dispatchEvent(new Event('xpUpdated')); } catch { }

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
    // Обновляем .mode-timer вместо #learn-timer
    const el = document.querySelector('.mode-timer');
    if (!el) {
        return;
    }

    // Если таймер не запущен или на паузе - не обновляем время
    if (!isTimerRunning || timerPaused) {
        return;
    }

    // Show time for current continuous block
    const now = Date.now();
    const elapsed = Math.floor((now - sessionTimerStart) / 1000);
    const totalTime = pausedTimeRemaining + elapsed;

    const m = Math.floor(totalTime / 60).toString().padStart(2, '0');
    const s = (totalTime % 60).toString().padStart(2, '0');
    el.textContent = `${m}:${s}`;
}

/**
 * Toggle timer pause/resume
 */
function toggleTimerPause() {
    console.log('[TIMER] toggleTimerPause called, timerPaused BEFORE:', timerPaused);
    const pauseBtn = document.getElementById('timer-pause-btn');
    const timerControls = document.getElementById('timer-controls');

    if (!pauseBtn) {
        console.warn('[TIMER] pauseBtn NOT FOUND in toggleTimerPause');
        return;
    }

    if (timerPaused) {
        // RESUME: продолжаем отсчёт
        console.log('[TIMER] ▶️ RESUMING timer');

        // Проверяем, нет ли уже активного интервала
        if (timerInterval) {
            console.log('[TIMER] ⚠️ timerInterval already exists (ID=' + timerInterval + '), skipping restart');
        } else {
            sessionTimerStart = Date.now();

            // Запускаем интервал
            timerInterval = setInterval(updateTimerDisplay, 1000);
            console.log('[TIMER] ✅ timerInterval restarted, ID=' + timerInterval);
            updateTimerDisplay();
        }

        // Визуально: иконка play, белое свечение
        pauseBtn.classList.remove('paused');
        pauseBtn.classList.add('running');

        if (timerControls) timerControls.title = 'Нажмите для паузы таймера';
    } else {
        // PAUSE: сохраняем накопленное время
        console.log('[TIMER] ⏸️ PAUSING timer');
        const now = Date.now();
        const startTime = sessionTimerStart;
        const elapsed = Math.floor((now - startTime) / 1000);
        pausedTimeRemaining += elapsed;
        console.log('[TIMER] elapsed:', elapsed, 'seconds, pausedTimeRemaining:', pausedTimeRemaining);

        // Останавливаем интервал
        if (timerInterval) {
            console.log('[TIMER] ⏹️ Clearing timerInterval (ID=' + timerInterval + ')');
            clearInterval(timerInterval);
            timerInterval = null;
            console.log('[TIMER] ✅ timerInterval cleared');
        }

        // Визуально: иконка паузы, мятное свечение
        pauseBtn.classList.remove('running');
        pauseBtn.classList.add('paused');

        if (timerControls) timerControls.title = 'Нажмите для запуска таймера';
    }

    timerPaused = !timerPaused;
    console.log('[TIMER] timerPaused AFTER:', timerPaused);
}

// Глобальные переменные для обработчиков таймера
let timerPauseHandler = null;
let timerClickHandler = null;
let timerControlsHandler = null;

/**
 * Setup timer controls event listeners
 */
function setupTimerControls() {
    // Получаем элементы после клонирования
    const pauseBtn = document.getElementById('timer-pause-btn');
    const timerControls = document.getElementById('timer-controls');
    const timerEl = document.getElementById('mode-timer');

    // Флаг: была ли ручная пауза пользователем
    let wasManuallyPausedByUser = false;

    // Удаляем старые обработчики если они есть
    if (timerPauseHandler || timerClickHandler || timerControlsHandler) {
        if (pauseBtn && timerPauseHandler) pauseBtn.removeEventListener('click', timerPauseHandler);
        if (timerEl && timerClickHandler) timerEl.removeEventListener('click', timerClickHandler);
        if (timerControls && timerControlsHandler) timerControls.removeEventListener('click', timerControlsHandler);
    }

    // Создаём новые обработчики
    timerPauseHandler = (e) => {
        e.stopPropagation();
        wasManuallyPausedByUser = !timerPaused;
        toggleTimerPause();
    };

    timerClickHandler = (e) => {
        e.stopPropagation();
        wasManuallyPausedByUser = !timerPaused;
        toggleTimerPause();
    };

    timerControlsHandler = (e) => {
        if (e.target !== pauseBtn && e.target !== timerEl) {
            wasManuallyPausedByUser = !timerPaused;
            toggleTimerPause();
        }
    };

    // Клик по кнопке паузы
    if (pauseBtn) {
        pauseBtn.addEventListener('click', timerPauseHandler);
    }

    // Клик по таймеру (тоже пауза/старт)
    if (timerEl) {
        timerEl.addEventListener('click', timerClickHandler);
    }

    // Клик по контейнеру timer-controls
    if (timerControls) {
        timerControls.addEventListener('click', timerControlsHandler);
    }

    // Инициализация: устанавливаем иконку play (режим воспроизведения)
    if (pauseBtn) {
        pauseBtn.classList.add('running');
        pauseBtn.classList.remove('paused');
    }
    if (timerControls) {
        timerControls.title = 'Нажмите для паузы таймера';
    }

    // Автоматическая пауза при уходе со страницы (visibilitychange)
    let autoPaused = false;

    document.addEventListener('visibilitychange', () => {
        const isHidden = document.hidden;
        const pauseBtn = document.getElementById('timer-pause-btn');
        const timerControls = document.getElementById('timer-controls');

        if (isHidden) {
            // Страница скрыта (ушли на другую вкладку, свернули браузер, заблокировали телефон)
            // Всегда ставим на паузу при уходе
            if (!timerPaused) {
                // PAUSE: сохраняем накопленное время
                const now = Date.now();
                const elapsed = Math.floor((now - sessionTimerStart) / 1000);
                pausedTimeRemaining += elapsed;

                // Останавливаем интервал
                if (timerInterval) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                }

                timerPaused = true;
                autoPaused = true;

                // Визуально: иконка паузы, мятное свечение
                if (pauseBtn) {
                    pauseBtn.classList.remove('running');
                    pauseBtn.classList.add('paused');
                }
                if (timerControls) timerControls.title = 'Нажмите для запуска таймера';
            }
        } else {
            // Страница снова видима
            // Если не было ручной паузы пользователем - автоматически запускаем таймер
            if (!wasManuallyPausedByUser && timerPaused && autoPaused) {
                // Проверяем, нет ли уже активного интервала
                if (timerInterval) {
                    console.log('[TIMER] visibilitychange: timerInterval already exists, skipping');
                } else {
                    // RESUME: продолжаем отсчёт
                    console.log('[TIMER] visibilitychange: resuming timer');
                    sessionTimerStart = Date.now();

                    // Запускаем интервал
                    timerInterval = setInterval(updateTimerDisplay, 1000);
                    updateTimerDisplay();

                    timerPaused = false;
                    autoPaused = false;

                    // Визуально: иконка play, белое свечение
                    if (pauseBtn) {
                        pauseBtn.classList.remove('paused');
                        pauseBtn.classList.add('running');
                    }
                    if (timerControls) timerControls.title = 'Нажмите для паузы таймера';
                }
            }
        }
    });

    // Обработчики первого взаимодействия для снятия ручной паузы
    const handleFirstInteraction = () => {
        // Если была ручная пауза - не делаем ничего, пользователь сам нажмёт
        // Если не было - таймер уже запущен при visibilitychange
        document.removeEventListener('click', handleFirstInteraction);
        document.removeEventListener('mousemove', handleFirstInteraction);
        document.removeEventListener('touchstart', handleFirstInteraction);
        document.removeEventListener('keydown', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('mousemove', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);
    document.addEventListener('keydown', handleFirstInteraction);
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

// Простая отладка сегментов
window.debugSegments = () => {
    const segs = document.getElementById('learn-segments');
    if (!segs) {
        console.log('❌ learn-segments не найден');
        return;
    }
    console.log('✅ learn-segments найден');
    console.log('   Всего сегментов:', segs.children.length);
    console.log('   Ширина контейнера:', segs.offsetWidth, 'px');
    console.log('   scrollLeft:', segs.scrollLeft);

    const visible = Array.from(segs.children).filter(el => el.style.display !== 'none').length;
    console.log('   Видимые сегменты:', visible);

    // Показываем индексы видимых
    const visibleIndices = [];
    segs.children.forEach((el, i) => {
        if (el.style.display !== 'none') visibleIndices.push(i);
    });
    console.log('   Индексы видимых:', visibleIndices);
};

console.log('[LEARN-UI] debugSegments loaded. Run window.debugSegments() in console');
