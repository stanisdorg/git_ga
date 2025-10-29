// Импортируем данные из отдельного файла
import { uniqueQaData } from './all-data.js';

document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('search-input');
    const micButton = document.getElementById('mic-button');
    const statusIndicator = document.getElementById('status-indicator');
    const resultsList = document.getElementById('results-list');
    const searchHistory = document.getElementById('search-history');
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const screenAudioButton = document.getElementById('screen-audio-button');
    const micVisualizer = document.getElementById('mic-visualizer');
    const screenVisualizer = document.getElementById('screen-visualizer');
    // Элементы режимов (кнопки в сайдбаре)
    const historyButton = document.getElementById('history-button');
    const transcriptionButton = document.getElementById('transcription-button');
    const transcriptionHistory = document.getElementById('transcription-history');
    
    // Автоматическая загрузка всех карточек
    setTimeout(() => {
        if (typeof showAllQuestions === 'function') {
            showAllQuestions();
        }
    }, 300);
    
    // Массив для хранения истории поиска
    let searchHistoryArray = [];
    // Единый текст транскрипции вместо разбивки на блоки
    let transcriptionText = '';
    let transcriptionMode = false; // активен ли режим «transcription»
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
        micButton.addEventListener('click', function() {
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

        async function startMicVisualizer() {
            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
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
            try { if (micVizRAF) cancelAnimationFrame(micVizRAF); } catch(_){}
            try { if (micAudioContext) micAudioContext.close(); } catch(_){}
            if (micVizStream) {
                micVizStream.getTracks().forEach(t => t.stop());
            }
            micVizStream = null;
            micAudioContext = null;
            micAnalyser = null;
            micDataArray = null;
            clearCanvas(micVisualizer);
        }
        
        // Живое обновление транскрипции: финальный и промежуточный хвост
        let transcriptionFinalText = '';
        let transcriptionInterim = '';
        // Обработка результатов распознавания
        recognition.onresult = function(event) {
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
        
        recognition.onstart = function() {
            if (statusIndicator) statusIndicator.textContent = 'Слушаю...';
            micButton.classList.add('listening');
            document.body.classList.add('listening');
            startMicVisualizer();
        };
        
        recognition.onend = function() {
            // Если кнопка всё ещё в режиме прослушивания, перезапускаем распознавание
            if (micButton.classList.contains('listening')) {
                recognition.start();
            } else {
                if (statusIndicator) statusIndicator.textContent = 'Готов к прослушиванию';
            }
            stopMicVisualizer();
        };
        
        recognition.onerror = function(event) {
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
        document.addEventListener('keydown', function(event) {
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

    // Захват звука экрана (getDisplayMedia + MediaRecorder)
    let screenMediaRecorder = null;
    let screenChunks = [];
    let screenStream = null;
    let screenAudioContext = null;
    let screenAnalyser = null;
    let screenDataArray = null;
    let screenVizRAF = null;

    async function startScreenAudioCapture() {
        try {
            // Просим пользователя выбрать экран/окно со звуком
            screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,  // видео нужно, чтобы в браузере можно было включить «звук вкладки»
                audio: true
            });
            if (!screenStream.getAudioTracks().length) {
                throw new Error('Аудиодорожка не предоставлена системой');
            }
            screenChunks = [];
            screenMediaRecorder = new MediaRecorder(screenStream, { mimeType: 'audio/webm' });
            let hasData = false;
            screenMediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    hasData = true;
                    screenChunks.push(e.data);
                }
            };
            screenMediaRecorder.onstop = () => {
                if (hasData && screenChunks.length > 0) {
                    const blob = new Blob(screenChunks, { type: 'audio/webm' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = `screen-audio-${Date.now()}.webm`;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }, 0);
                }
            };
            screenMediaRecorder.start(250);
            if (screenAudioButton) screenAudioButton.classList.add('listening');
            screenAudioButton.setAttribute('aria-pressed', 'true');

            // Визуализация системного аудио
            try {
                screenAudioContext = new (window.AudioContext || window.webkitAudioContext)();
                const source = screenAudioContext.createMediaStreamSource(screenStream);
                screenAnalyser = screenAudioContext.createAnalyser();
                screenAnalyser.fftSize = 1024;
                screenAnalyser.smoothingTimeConstant = 0.85;
                source.connect(screenAnalyser);
                const bufferLength = screenAnalyser.frequencyBinCount;
                screenDataArray = new Uint8Array(bufferLength);
                visualizeCanvas(screenAnalyser, screenDataArray, screenVisualizer, (id) => screenVizRAF = id);
            } catch (e) {
                console.warn('Screen visualizer not started:', e);
            }
        } catch (err) {
            console.error('Не удалось начать захват звука экрана:', err);
            alert('Не удалось начать захват звука экрана. Выберите вкладку и включите "Поделиться звуком вкладки".');
            stopScreenAudioCapture();
        }
    }

    function stopScreenAudioCapture() {
        try {
            if (screenMediaRecorder && screenMediaRecorder.state !== 'inactive') {
                screenMediaRecorder.stop();
            }
        } catch (_) {}
        if (screenStream) {
            screenStream.getTracks().forEach(t => t.stop());
            screenStream = null;
        }
        if (screenAudioButton) screenAudioButton.classList.remove('listening');
        if (screenAudioButton) screenAudioButton.setAttribute('aria-pressed', 'false');
        try { if (screenVizRAF) cancelAnimationFrame(screenVizRAF); } catch(_){}
        try { if (screenAudioContext) screenAudioContext.close(); } catch(_){}
        screenAnalyser = null;
        screenDataArray = null;
        clearCanvas(screenVisualizer);
    }

    if (screenAudioButton && navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        screenAudioButton.addEventListener('click', async () => {
            if (screenMediaRecorder && screenMediaRecorder.state === 'recording') {
                stopScreenAudioCapture();
            } else {
                await startScreenAudioCapture();
            }
        });
    }

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
    document.addEventListener('keydown', (e) => {
        const key = e.key ? e.key.toLowerCase() : '';
        const active = document.activeElement;
        const isEditable = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
        const isSearchFocused = active && active.id === 'search-input';
        // Сброс по Ctrl+Я (русская раскладка) или Ctrl+Z (undo) — ограничиваем: либо фокус в поиске, либо нет редактируемого элемента
        if (e.ctrlKey && (key === 'я' || key === 'z') && (isSearchFocused || !isEditable)) {
            e.preventDefault();
            resetSearch();
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
    
    // Обработчик ввода текста в поле поиска
    searchInput.addEventListener('input', function() {
        performSearch(this.value);
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

    // Отобразить все карточки на старте
    displaySearchResults(uniqueQaData, '');
    
    // Обработчик нажатия Enter в поле поиска — всегда выполняет поиск и пишет в историю
    searchInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            const query = this.value.trim();
            if (query) {
                performSearch(query);
                addToSearchHistory(query);
            }
        }
    });
    
    // Функция добавления запроса в историю поиска
    function addToSearchHistory(query) {
        // Проверяем, что запрос не пустой
        if (!query.trim()) return;
        
        // Создаем объект с запросом и временем
        const historyItem = {
            query: query,
            timestamp: new Date().toLocaleTimeString(),
            id: Date.now() // уникальный идентификатор для элемента истории
        };
        
        // Добавляем в начало массива истории
        searchHistoryArray.unshift(historyItem);
        
        // Обновляем отображение истории
        renderSearchHistory();
    }
    
    // Функция отображения истории поиска
    function renderSearchHistory() {
        // Очищаем текущую историю
        searchHistory.innerHTML = '';
        
        // Добавляем элементы истории
        searchHistoryArray.forEach(item => {
            const historyElement = document.createElement('div');
            historyElement.className = 'history-item';
            historyElement.dataset.id = item.id;
            historyElement.innerHTML = `
                <div class="history-item-query">${item.query}</div>
                <div class="history-item-time">${item.timestamp}</div>
            `;
            
            // Добавляем обработчик клика по элементу истории
            historyElement.addEventListener('click', function() {
                searchInput.value = item.query;
                performSearch(item.query);
            });
            
            searchHistory.appendChild(historyElement);
        });
    }
    
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
        const filteredData = uniqueQaData.filter(item =>
            item.question.toLowerCase().includes(query.toLowerCase())
        );
        
        displaySearchResults(filteredData, query);
    }
    
    // Функция для отображения результатов поиска
    function displaySearchResults(filteredData, query) {
        const resultsList = document.getElementById('results-list');
        resultsList.innerHTML = '';
        
        if (filteredData.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'no-results';
            noResults.textContent = 'Ничего не найдено по вашему запросу';
            resultsList.appendChild(noResults);
            return;
        }
        
        // Информация о поиске
        const resultsHeader = document.createElement('div');
        resultsHeader.className = 'results-header';
        resultsHeader.innerHTML = `<span>Найдено: ${filteredData.length}</span>`;
        resultsList.appendChild(resultsHeader);
        
        // Добавляем результаты
        filteredData.forEach(item => {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            
            resultItem.innerHTML = `
                <div class="question">${item.question}</div>
                <div class="answer">${item.answer}</div>
            `;
            
            // Hover effects are now handled by CSS
            
            resultsList.appendChild(resultItem);
        });
    }
});