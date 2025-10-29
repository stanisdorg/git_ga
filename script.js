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
    let transcriptionHistoryArray = [];
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
    const isSpeechSupported = ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window);
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
            
            // Если есть финальный результат
            if (finalTranscript !== '') {
                searchInput.value = finalTranscript;
                if (statusIndicator) statusIndicator.textContent = 'Получено: ' + finalTranscript;
                
                // В режиме транскрипции/удержания: фиксируем строку, не ищем и не пишем в историю
                if (pressHoldActive || transcriptionMode) {
                    addToTranscriptionHistory(finalTranscript);
                } else {
                    // Обычный режим: выполняем поиск и записываем в историю
                    performSearch(finalTranscript);
                    addToSearchHistory(finalTranscript);
                }
            } else if (interimTranscript !== '') {
                // Показываем промежуточный результат
                searchInput.value = interimTranscript;
                if (statusIndicator) statusIndicator.textContent = 'Слушаю: ' + interimTranscript;
            }
        };
        
        recognition.onstart = function() {
            if (statusIndicator) statusIndicator.textContent = 'Слушаю...';
            micButton.classList.add('listening');
            document.body.classList.add('listening');
        };
        
        recognition.onend = function() {
            // Если кнопка всё ещё в режиме прослушивания, перезапускаем распознавание
            if (micButton.classList.contains('listening')) {
                recognition.start();
            } else {
                if (statusIndicator) statusIndicator.textContent = 'Готов к прослушиванию';
            }
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
        
        // Обработчик нажатия на кнопку микрофона (клик — обычный режим)
        micButton.addEventListener('click', toggleSpeechRecognition);
        // Режим зажатой кнопки: удержание — слушаем, отпуск — останавливаем
        micButton.addEventListener('mousedown', () => {
            pressHoldActive = true;
            micButton.classList.add('active');
            micButton.setAttribute('aria-pressed', 'true');
            recognition.start();
        });
        micButton.addEventListener('mouseup', () => {
            pressHoldActive = false;
            recognition.stop();
            micButton.classList.remove('active');
            micButton.setAttribute('aria-pressed', 'false');
        });
        micButton.addEventListener('mouseleave', () => {
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
                recognition.start();
            }
        }
    }
    
    // Обработчик ввода текста в поле поиска
    searchInput.addEventListener('input', function() {
        performSearch(this.value);
    });

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
    
    // Функции для транскрипции
    function addToTranscriptionHistory(text) {
        if (!text.trim()) return;
        const item = {
            text,
            timestamp: new Date().toLocaleTimeString(),
            id: Date.now()
        };
        transcriptionHistoryArray.unshift(item);
        renderTranscriptionHistory();
    }
    
    function renderTranscriptionHistory() {
        if (!transcriptionHistory) return;
        transcriptionHistory.innerHTML = '';
        transcriptionHistoryArray.forEach(item => {
            const el = document.createElement('div');
            el.className = 'transcription-item';
            el.dataset.id = item.id;
            // Построить слова
            const words = item.text.split(/\s+/);
            const wordsHtml = words.map((w, idx) => `<span class="transcription-word" data-index="${idx}">${escapeHtml(w)}</span>`).join(' ');
            el.innerHTML = `
                <div class="transcription-item-text">${wordsHtml}</div>
            `;
            // Обработчик клика по словам
            el.querySelectorAll('.transcription-word').forEach(span => {
                span.addEventListener('click', () => {
                    const selected = span.classList.toggle('selected');
                    const id = item.id;
                    const word = span.textContent.trim();
                    const set = selectedKeywordsById.get(id) || new Set();
                    if (selected) {
                        set.add(word);
                    } else {
                        set.delete(word);
                    }
                    selectedKeywordsById.set(id, set);
                    // Обновляем поле поиска выбранными словами
                    const keywords = Array.from(set);
                    searchInput.value = keywords.join(' ');
                });
            });
            transcriptionHistory.appendChild(el);
        });
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