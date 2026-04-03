// Импортируем данные из отдельного файла
import { uniqueQaData } from './all-data.js';
import { displayQuestions } from './ui-variants/tabs-navigation.js';
import { applyFormatting } from './srs/text-formatter.js';
import { setSearchQuery } from './search-highlight.js';
let transcriptionMode = false; // глобальное состояние режима транскрипции

document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('search-input');
    const micButton = document.getElementById('mic-button');
    const statusIndicator = document.getElementById('status-indicator');
    const resultsList = document.getElementById('results-list');
    const searchHistory = document.getElementById('search-history');
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const micVisualizer = document.getElementById('mic-visualizer');
    const historyButton = document.getElementById('history-button');
    const transcriptionButton = document.getElementById('transcription-button');
    const transcriptionHistory = document.getElementById('transcription-history');

    if (!uniqueQaData || uniqueQaData.length === 0) {
        document.addEventListener('dataLoaded', () => {
            initializeSearch();
        }, { once: true });
    } else {
        initializeSearch();
    }

    function initializeSearch() {

        // По умолчанию открываем вкладку транскрипции
        if (searchHistory && transcriptionHistory && transcriptionButton) {
            searchHistory.style.display = 'none';
            transcriptionHistory.style.display = 'block';
            transcriptionMode = true;
            transcriptionButton.classList.toggle('active', true);
        }

        // Мобильная версия: по умолчанию сворачиваем левую панель
        if (sidebar && sidebarToggle) {
            const isMobile = window.matchMedia('(max-width: 600px)').matches;
            if (isMobile) {
                sidebar.classList.add('collapsed');
                sidebarToggle.setAttribute('aria-expanded', 'false');
                sidebarToggle.setAttribute('aria-label', 'Развернуть историю');
            }
        }

        // Автоматическая загрузка всех карточек - ОТКЛЮЧЕНО (конфликт с ui-manager.js)
        /*
        setTimeout(() => {
            if (typeof showAllQuestions === 'function') {
                showAllQuestions();
            }
        }, 300);
        */

        // Массив для хранения истории поиска
        let searchHistoryArray = [];
        // 🔥 Элемент для подсказок
        const searchSuggestions = document.getElementById('search-suggestions');

        // Загружаем историю из localStorage
        try {
            const savedHistory = localStorage.getItem('qaSearchHistory');
            if (savedHistory) {
                searchHistoryArray = JSON.parse(savedHistory);
            }
        } catch (e) {
            console.error('[SEARCH] Ошибка загрузки истории:', e);
            searchHistoryArray = [];
        }

        // Единый текст транскрипции вместо разбивки на блоки
        let transcriptionText = '';
        let pressHoldActive = false;
        const selectedKeywordsById = new Map();

        // Тоггл боковой панели (сворачивание истории поиска)
        if (sidebarToggle && sidebar && searchHistory) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                const isCollapsed = sidebar.classList.contains('collapsed');

                if (isCollapsed) {
                    sidebarToggle.setAttribute('aria-expanded', 'false');
                    sidebarToggle.setAttribute('aria-label', 'Развернуть историю');
                } else {
                    sidebarToggle.setAttribute('aria-expanded', 'true');
                    sidebarToggle.setAttribute('aria-label', 'Свернуть историю');
                }
            });
        }
        // Кнопка показа/скрытия истории
        if (historyButton) {
            historyButton.addEventListener('click', () => {
                if (!searchHistory || !transcriptionHistory) return;
                // Показать обычную историю
                searchHistory.style.display = 'block';
                transcriptionHistory.style.display = 'none';
                transcriptionMode = false;
                if (transcriptionButton) transcriptionButton.classList.toggle('active', false);
            });
        }
        if (transcriptionButton) {
            transcriptionButton.addEventListener('click', () => {
                if (!searchHistory || !transcriptionHistory) return;
                // Показать транскрипцию и активировать режим
                searchHistory.style.display = 'none';
                transcriptionHistory.style.display = 'block';
                transcriptionMode = true;
                transcriptionButton.classList.toggle('active', true);
            });
        }

        // Проверка поддержки Web Speech API
        const preferElectronSTT = typeof window.sttBridge !== 'undefined';
        const isSpeechSupported = !preferElectronSTT && (('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window));
        if (!isSpeechSupported) {
            if (statusIndicator) statusIndicator.textContent = 'Ваш браузер не поддерживает распознавание речи';
            // Не отключаем кнопку, даём визуальную обратную связь
            micButton.removeAttribute('disabled');
            micButton.setAttribute('aria-disabled', 'true');
            micButton.setAttribute('aria-pressed', 'false');
            micButton.addEventListener('click', function () {
                micButton.classList.toggle('active');
                const pressed = micButton.classList.contains('active');
                micButton.setAttribute('aria-pressed', pressed ? 'true' : 'false');
            });
        } else {
            // Инициализация распознавания речи
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.lang = 'ru-RU';
            recognition.continuous = true;
            recognition.interimResults = true;

            // Визуализация микрофона отдельным потоком getUserMedia
            let micVizStream = null;
            let micAudioContext = null;
            let micAnalyser = null;
            let micDataArray = null;
            let micVizRAF = null;
            let equalizerContainer = null;

            async function startMicVisualizer() {
                try {
                    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

                    // Используем Apple Neon Equalizer если доступен
                    if (window.AppleNeonEqualizer) {
                        equalizerContainer = document.getElementById('apple-neon-equalizer');
                        if (equalizerContainer) {
                            window.AppleNeonEqualizer.create(equalizerContainer);
                            await window.AppleNeonEqualizer.start();
                        }
                        return;
                    }

                    // Fallback на старый canvas визуализатор
                    micVizStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    micAudioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const source = micAudioContext.createMediaStreamSource(micVizStream);
                    micAnalyser = micAudioContext.createAnalyser();
                    micAnalyser.fftSize = 1024;
                    micAnalyser.smoothingTimeConstant = 0.85;
                    source.connect(micAnalyser);
                    const bufferLength = micAnalyser.frequencyBinCount;
                    micDataArray = new Uint8Array(bufferLength);
                    visualizeCanvas(micAnalyser, micDataArray, micVisualizer, (id) => micVizRAF = id);
                } catch (e) {
                    console.warn('Mic visualizer not started:', e);
                }
            }

            function stopMicVisualizer() {
                // Останавливаем Apple Neon Equalizer
                if (window.AppleNeonEqualizer && window.AppleNeonEqualizer.isRecording()) {
                    window.AppleNeonEqualizer.stop();
                    return;
                }

                // Fallback на старый canvas
                try { if (micVizRAF) cancelAnimationFrame(micVizRAF); } catch (_) { }
                try { if (micAudioContext) micAudioContext.close(); } catch (_) { }
                if (micVizStream) {
                    micVizStream.getTracks().forEach(t => t.stop());
                }
                micVizStream = null;
                micAudioContext = null;
                micAnalyser = null;
                micDataArray = null;
                if (micVisualizer) clearCanvas(micVisualizer);
            }

            // Живое обновление транскрипции: финальный и промежуточный хвост
            let transcriptionFinalText = '';
            let transcriptionInterim = '';
            // Обработка результатов распознавания
            recognition.onresult = function (event) {
                let finalTranscript = '';
                let interimTranscript = '';

                // Обработка промежуточных и финальных результатов
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }

                // Финальный текст накапливаем, промежуточный показываем без задержек
                if (finalTranscript !== '') {
                    transcriptionFinalText = (transcriptionFinalText ? (transcriptionFinalText + ' ') : '') + finalTranscript.trim();
                    transcriptionInterim = '';
                    renderTranscriptionCombined(transcriptionFinalText, transcriptionInterim);
                    if (statusIndicator) statusIndicator.textContent = 'Получено: ' + finalTranscript;
                } else if (interimTranscript !== '') {
                    transcriptionInterim = interimTranscript.trim();
                    renderTranscriptionCombined(transcriptionFinalText, transcriptionInterim);
                    if (statusIndicator) statusIndicator.textContent = 'Слушаю: ' + interimTranscript;
                }
            };

            recognition.onstart = function () {
                if (statusIndicator) statusIndicator.textContent = 'Слушаю...';
                micButton.classList.add('listening');
                document.body.classList.add('listening');
                startMicVisualizer();
            };

            recognition.onend = function () {
                // Если кнопка всё ещё в режиме прослушивания, перезапускаем распознавание
                if (micButton.classList.contains('listening')) {
                    recognition.start();
                } else {
                    if (statusIndicator) statusIndicator.textContent = 'Готов к прослушиванию';
                }
                stopMicVisualizer();
            };

            recognition.onerror = function (event) {
                if (statusIndicator) statusIndicator.textContent = 'Ошибка распознавания: ' + event.error;
                if (event.error !== 'no-speech') {
                    micButton.classList.remove('listening');
                    document.body.classList.remove('listening');
                } else if (micButton.classList.contains('listening')) {
                    // Перезапускаем при ошибке no-speech, если микрофон всё ещё активен
                    setTimeout(() => recognition.start(), 500);
                }
            };

            // Логика короткого клика (переключение) vs долгого удержания (на время удержания)
            let holdTimer = null;
            let holdStartTime = 0;
            const HOLD_THRESHOLD_MS = 250;

            micButton.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return; // только ЛКМ
                holdStartTime = Date.now();
                holdTimer = setTimeout(() => {
                    // Долгое удержание: включаем прослушивание на время удержания
                    pressHoldActive = true;
                    micButton.classList.add('active');
                    micButton.setAttribute('aria-pressed', 'true');
                    recognition.start();
                }, HOLD_THRESHOLD_MS);
            });

            micButton.addEventListener('mouseup', (e) => {
                if (e.button !== 0) return;
                const duration = Date.now() - holdStartTime;
                clearTimeout(holdTimer);
                holdTimer = null;
                if (pressHoldActive) {
                    // Завершаем режим удержания
                    pressHoldActive = false;
                    recognition.stop();
                    micButton.classList.remove('active');
                    micButton.setAttribute('aria-pressed', 'false');
                } else if (duration < HOLD_THRESHOLD_MS) {
                    // Короткий клик: переключение режима прослушивания
                    toggleSpeechRecognition();
                }
            });

            micButton.addEventListener('mouseleave', () => {
                clearTimeout(holdTimer);
                holdTimer = null;
                if (pressHoldActive) {
                    pressHoldActive = false;
                    recognition.stop();
                    micButton.classList.remove('active');
                    micButton.setAttribute('aria-pressed', 'false');
                }
            });

            // Обработчик горячих клавиш
            document.addEventListener('keydown', function (event) {
                if (event.altKey && event.key === 'm') {
                    event.preventDefault();
                    toggleSpeechRecognition();
                }
            });

            // Функция для переключения состояния распознавания речи
            function toggleSpeechRecognition() {
                if (micButton.classList.contains('listening')) {
                    recognition.stop();
                    micButton.classList.remove('listening');
                    document.body.classList.remove('listening');
                    micButton.classList.remove('active');
                    micButton.setAttribute('aria-pressed', 'false');
                    if (statusIndicator) statusIndicator.textContent = 'Готов к прослушиванию';
                } else {
                    micButton.classList.add('active');
                    micButton.setAttribute('aria-pressed', 'true');
                    // очищаем поле поиска перед новым поиском, чтобы не тянуть старый запрос
                    if (searchInput) {
                        searchInput.value = '';
                        performSearch('');
                    }
                    recognition.start();
                }
            }
        }

        // Логика захвата звука экрана удалена

        // Кнопка сброса поиска и горячая клавиша Ctrl+Я
        const resetSearchBtn = document.getElementById('reset-search');
        function resetSearch() {
            if (searchInput) searchInput.value = '';
            performSearch('');
            // Сбрасываем выбранные слова
            selectedKeywordsById.set('global', new Set());
            // Перерисуем транскрипцию, чтобы снять подсветку
            if (typeof renderTranscriptionCombined === 'function') {
                // У нас нет доступа к внутренним переменным final/interim здесь, поэтому просто ререндерим из накопленного текста
                renderTranscriptionCombined(transcriptionText, '');
            } else if (typeof renderTranscription === 'function') {
                renderTranscription();
            }
        }
        if (resetSearchBtn) {
            resetSearchBtn.addEventListener('click', resetSearch);
        }

        // 🔥 ESC - закрытие подсказок или очистка поля
        let escapePressCount = 0;
        let escapePressTimer = null;

        document.addEventListener('keydown', (e) => {
            const key = e.key ? e.key.toLowerCase() : '';
            const active = document.activeElement;
            const isEditable = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
            const isSearchFocused = active && active.id === 'search-input';

            // Сброс по Ctrl+Я (русская раскладка) или Ctrl+Z (undo)
            if (e.ctrlKey && (key === 'я' || key === 'z') && (isSearchFocused || !isEditable)) {
                e.preventDefault();
                resetSearch();
            }

            // 🔥 ESC - закрытие подсказок или очистка поля
            if (e.key === 'Escape') {
                e.preventDefault();

                const suggestionsVisible = searchSuggestions && searchSuggestions.style.display !== 'none';
                const hasValue = searchInput && searchInput.value.trim() !== '';

                if (suggestionsVisible) {
                    // Первое нажатие: скрываем подсказки
                    hideSearchSuggestions();
                    escapePressCount = 0;
                    if (escapePressTimer) {
                        clearTimeout(escapePressTimer);
                        escapePressTimer = null;
                    }
                } else if (hasValue) {
                    // Подсказки скрыты, но поле не пустое: очищаем поле
                    searchInput.value = '';
                    performSearch('');
                    hideSearchSuggestions();
                    escapePressCount = 0;
                    if (escapePressTimer) {
                        clearTimeout(escapePressTimer);
                        escapePressTimer = null;
                    }
                } else {
                    // Поле пустое и подсказки скрыты: снимаем фокус
                    if (searchInput) {
                        searchInput.blur();
                    }
                }
            }
        });

        // Сохранение выбранного текста из транскрипции по Enter
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && transcriptionMode) {
                const set = selectedKeywordsById.get('global');
                if (set && set.size > 0) {
                    const query = Array.from(set).join(' ');
                    addToSearchHistory(query);
                    performSearch(query);
                    if (searchInput) searchInput.value = query;
                    e.preventDefault();
                }
            }
        });

        // Универсальная отрисовка в канвас (анализатор -> амплитуда/простая волна)
        function visualizeCanvas(analyser, dataArray, canvasEl, setRAF) {
            if (!canvasEl || !analyser) return;
            const ctx = canvasEl.getContext('2d');
            const width = canvasEl.width = canvasEl.clientWidth;
            const height = canvasEl.height = canvasEl.clientHeight;

            function draw() {
                const rafId = requestAnimationFrame(draw);
                if (setRAF) setRAF(rafId);
                analyser.getByteTimeDomainData(dataArray);
                ctx.clearRect(0, 0, width, height);
                ctx.lineWidth = 1;
                ctx.strokeStyle = '#ff4d4d';
                ctx.beginPath();
                const sliceWidth = width * 1.0 / dataArray.length;
                let x = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    const v = (dataArray[i] - 128) / 128.0; // -1..1
                    const y = (height / 2) + v * (height / 2) * 5.0; // чувствительность x5
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                    x += sliceWidth;
                }
                ctx.lineTo(width, height / 2);
                ctx.stroke();
            }
            draw();
        }

        function clearCanvas(canvasEl) {
            if (!canvasEl) return;
            const ctx = canvasEl.getContext('2d');
            ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        }

        // Debounce utility
        function debounce(fn, delay) {
            let timer = null;
            return function (...args) {
                if (timer) clearTimeout(timer);
                timer = setTimeout(() => fn.apply(this, args), delay);
            };
        }

        // Обработчик ввода текста в поле поиска (с debounce 200мс)
        const handleSearchInput = debounce(function (value) {
            if (searchSuggestions && searchHistoryArray.length > 0) {
                renderSearchSuggestions();
            }
            performSearch(value);
        }, 200);

        searchInput.addEventListener('input', function () {
            handleSearchInput(this.value);
        });

        // Показ подсказок при фокусе на поле поиска
        searchInput.addEventListener('focus', function () {
            if (searchSuggestions && searchHistoryArray.length > 0) {
                renderSearchSuggestions();
            }
        });

        // Скрытие подсказок при потере фокуса
        searchInput.addEventListener('blur', function () {
            setTimeout(() => {
                hideSearchSuggestions();
            }, 200);
        });

        // Поддержка событий Electron STT для живого обновления
        if (preferElectronSTT) {
            let finalText = '';
            let interim = '';
            window.addEventListener('electron-stt-partial', (e) => {
                interim = (e.detail || '').trim();
                renderTranscriptionCombined(finalText, interim);
            });
            window.addEventListener('electron-stt-final', (e) => {
                const t = (e.detail || '').trim();
                if (t) finalText = (finalText ? finalText + ' ' : '') + t;
                interim = '';
                transcriptionText = finalText;
                renderTranscriptionCombined(finalText, interim);
            });
        }

        // Отобразить все карточки на старте, если данные уже есть - ОТКЛЮЧЕНО (конфликт с ui-manager.js)
        /*
        if (uniqueQaData && uniqueQaData.length > 0) {
            displaySearchResults(uniqueQaData, '');
        } else {
            // Если данные еще не загружены, ждем события
            document.addEventListener('dataLoaded', () => {
                 displaySearchResults(uniqueQaData, '');
            });
        }
        */

        // Обработчик нажатия Enter в поле поиска — всегда выполняет поиск и пишет в историю
        searchInput.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                const query = this.value.trim();
                if (query) {
                    performSearch(query);
                    addToSearchHistory(query);
                }
            }
        });

        // Функция отображения истории поиска в боковой панели
        function renderSearchHistory() {
            if (!searchHistory) return;
            searchHistory.innerHTML = '';

            if (searchHistoryArray.length === 0) {
                searchHistory.innerHTML = '<p style="padding: 12px; color: #888; font-size: 13px;">История пуста</p>';
                return;
            }

            searchHistoryArray.slice(0, 20).forEach(item => {
                const historyItem = document.createElement('div');
                historyItem.className = 'search-history-item';
                historyItem.textContent = item.query;
                historyItem.addEventListener('click', () => {
                    if (searchInput) {
                        searchInput.value = item.query;
                        performSearch(item.query);
                    }
                });
                searchHistory.appendChild(historyItem);
            });
        }

        // Функция добавления запроса в историю поиска
        function addToSearchHistory(query) {
            if (!query.trim()) {
                return;
            }

            const historyItem = {
                query: query,
                timestamp: new Date().toLocaleTimeString(),
                id: Date.now()
            };

            searchHistoryArray.unshift(historyItem);

            try {
                const limitedHistory = searchHistoryArray.slice(0, 20);
                localStorage.setItem('qaSearchHistory', JSON.stringify(limitedHistory));
            } catch (e) {
                console.error('[SEARCH] Ошибка сохранения истории:', e);
            }

            renderSearchHistory();
        }

        // Функция отображения подсказок (выпадающий список)
        function renderSearchSuggestions() {
            if (!searchSuggestions) {
                console.error('[SEARCH] searchSuggestions element не найден!');
                return;
            }

            if (searchHistoryArray.length === 0) {
                searchSuggestions.style.display = 'none';
                searchSuggestions.innerHTML = '';
                return;
            }

            searchSuggestions.innerHTML = '';
            const recentHistory = searchHistoryArray.slice(0, 10);

            recentHistory.forEach(item => {
                const suggestionEl = document.createElement('div');
                suggestionEl.className = 'search-suggestion-item';

                const querySpan = document.createElement('span');
                querySpan.className = 'search-suggestion-query';
                querySpan.textContent = item.query;
                suggestionEl.appendChild(querySpan);

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'search-suggestion-delete';
                deleteBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                `;
                deleteBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    deleteSearchSuggestion(item.id);
                });
                suggestionEl.appendChild(deleteBtn);

                suggestionEl.addEventListener('click', function () {
                    searchInput.value = item.query;
                    searchSuggestions.style.display = 'none';
                    performSearch(item.query);
                });

                searchSuggestions.appendChild(suggestionEl);
            });

            searchSuggestions.style.display = 'flex';
        }

        // Функция удаления подсказки
        function deleteSearchSuggestion(id) {
            const index = searchHistoryArray.findIndex(item => item.id === id);
            if (index !== -1) {
                searchHistoryArray.splice(index, 1);

                try {
                    localStorage.setItem('qaSearchHistory', JSON.stringify(searchHistoryArray));
                } catch (e) {
                    console.error('[SEARCH] Ошибка сохранения:', e);
                }

                renderSearchSuggestions();

                if (searchHistoryArray.length === 0) {
                    searchSuggestions.style.display = 'none';
                }
            }
        }

        // Функция скрытия подсказок
        function hideSearchSuggestions() {
            if (searchSuggestions) {
                searchSuggestions.style.display = 'none';
            }
        }

        // ------------------------


        // Функции для транскрипции: единое поле без разбиения на блоки
        function appendToTranscription(text) {
            if (!text.trim()) return;
            transcriptionText = (transcriptionText ? (transcriptionText + ' ') : '') + text.trim();
            renderTranscriptionCombined(transcriptionText, '');
        }

        function renderTranscriptionCombined(finalText, interimText) {
            if (!transcriptionHistory) return;
            transcriptionHistory.innerHTML = '';
            const wrapper = document.createElement('div');
            wrapper.className = 'transcription-item';
            const combined = (finalText + ' ' + (interimText || '')).trim();
            const words = combined.split(/\s+/).filter(Boolean);
            const selectedSet = selectedKeywordsById.get('global') || new Set();
            const wordsHtml = words.map((w, idx) => {
                const isSelected = selectedSet.has(w);
                const cls = 'transcription-word' + (isSelected ? ' selected' : '');
                return `<span class="${cls}" data-index="${idx}">${escapeHtml(w)}</span>`;
            }).join(' ');
            wrapper.innerHTML = `<div class="transcription-item-text">${wordsHtml}</div>`;
            wrapper.querySelectorAll('.transcription-word').forEach(span => {
                span.addEventListener('click', () => {
                    const selected = span.classList.toggle('selected');
                    const word = span.textContent.trim();
                    // Глобальный набор выбранных слов по всей транскрипции
                    const set = selectedKeywordsById.get('global') || new Set();
                    if (selected) {
                        set.add(word);
                    } else {
                        set.delete(word);
                    }
                    selectedKeywordsById.set('global', set);
                    const keywords = Array.from(set);
                    searchInput.value = keywords.join(' ');
                    performSearch(searchInput.value);
                });
            });
            transcriptionHistory.appendChild(wrapper);
            // Автопрокрутка вниз при добавлении нового текста
            transcriptionHistory.scrollTop = transcriptionHistory.scrollHeight;
        }

        // Поиск выполняется через поле ввода, здесь дополнительная функция не требуется

        function escapeHtml(str) {
            return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        // Функция выполнения поиска
        function performSearch(query) {
            // Сохраняем поисковый запрос для подсветки
            setSearchQuery(query);

            if (!query) {
                displaySearchResults(uniqueQaData, '');
                return;
            }

            const lowerQuery = query.toLowerCase();
            const filteredData = uniqueQaData.filter(item => {
                const inQuestion = item.question && item.question.toLowerCase().includes(lowerQuery);
                const inAnswer = item.answer && item.answer.toLowerCase().includes(lowerQuery);
                const inCategory = item.category && item.category.toLowerCase().includes(lowerQuery);
                const inSubcategory = item.subcategory && item.subcategory.toLowerCase().includes(lowerQuery);

                return inQuestion || inAnswer || inCategory || inSubcategory;
            });

            displaySearchResults(filteredData, query);
        }

        // Функция отображения результатов поиска
        function displaySearchResults(filteredData, query) {
            // Use the advanced display logic from tabs-navigation if available
            if (typeof displayQuestions === 'function') {
                displayQuestions(filteredData, query ? `Результаты поиска: ${query}` : 'Результаты поиска');
                return;
            }

            const resultsList = document.getElementById('results-list');
            resultsList.innerHTML = '';

            // Обновляем счетчик результатов (вынесен из grid)
            let countContainer = document.getElementById('results-count-container');
            if (!countContainer) {
                countContainer = document.createElement('div');
                countContainer.id = 'results-count-container';
                countContainer.className = 'results-header';
                countContainer.style.padding = '0 20px 10px 20px';
                countContainer.style.marginBottom = '0';
                resultsList.parentNode.insertBefore(countContainer, resultsList);
            }
            countContainer.innerHTML = `<span class="results-count">Найдено: ${filteredData.length}</span>`;

            if (filteredData.length === 0) {
                const noResults = document.createElement('div');
                noResults.className = 'no-results';
                noResults.textContent = 'Ничего не найдено по вашему запросу';
                resultsList.appendChild(noResults);
                return;
            }

            // Добавляем результаты
            filteredData.forEach(item => {
                const resultItem = document.createElement('div');
                resultItem.className = 'result-item';

                // Формируем бейджи категорий
                const badges = [];
                if (item.category) {
                    badges.push(`<span class="category-badge">${item.category}</span>`);
                }
                if (item.subcategory) {
                    badges.push(`<span class="subcategory-badge">${item.subcategory}</span>`);
                }
                const metaHtml = badges.length ? `<div class="result-meta" style="margin-bottom:4px">${badges.join('')}</div>` : '';

                // Применяем форматирование к вопросу и ответу
                const questionFormatting = item.formatting?.question || [];
                const answerFormatting = item.formatting?.answer || [];
                const questionHTML = applyFormatting(item.question, questionFormatting);
                const answerHTML = applyFormatting(item.answer, answerFormatting);

                resultItem.innerHTML = `
                ${metaHtml}
                <div class="question">${questionHTML}</div>
                <div class="answer">${answerHTML}</div>
            `;

                // Hover effects are now handled by CSS

                resultsList.appendChild(resultItem);
            });
        }
    } // 🔥 Закрываем initializeSearch
});
