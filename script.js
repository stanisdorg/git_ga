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
    const inputGroup = document.querySelector('.input-group');
    
    // Добавляем кнопки слева от поля ввода и создаем контейнер голосовой истории
    let historyButton = document.getElementById('history-button');
    let libraryButton = document.getElementById('library-button');
    let libraryHistory = document.getElementById('library-history');
    
    if (inputGroup) {
        if (!historyButton) {
            historyButton = document.createElement('button');
            historyButton.id = 'history-button';
            historyButton.className = 'history-button';
            historyButton.title = 'История';
            historyButton.setAttribute('aria-label', 'История');
            historyButton.textContent = 'История';
            inputGroup.prepend(historyButton);
        }
        if (!libraryButton) {
            libraryButton = document.createElement('button');
            libraryButton.id = 'library-button';
            libraryButton.className = 'library-button';
            libraryButton.title = 'Библиотека';
            libraryButton.setAttribute('aria-label', 'Библиотека');
            libraryButton.textContent = 'Библиотека';
            inputGroup.prepend(libraryButton);
        }
    }
    
    if (sidebar && !libraryHistory) {
        libraryHistory = document.createElement('div');
        libraryHistory.id = 'library-history';
        libraryHistory.style.display = 'none';
        sidebar.appendChild(libraryHistory);
    }
    
    // Автоматическая загрузка всех карточек
    setTimeout(() => {
        if (typeof showAllQuestions === 'function') {
            showAllQuestions();
        }
    }, 300);
    
    // Массив для хранения истории поиска
    let searchHistoryArray = [];
    let libraryHistoryArray = [];
    let libraryMode = false; // активен ли режим «Библиотека»
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
            if (!searchHistory || !libraryHistory) return;
            // Показать обычную историю
            searchHistory.style.display = 'block';
            libraryHistory.style.display = 'none';
            libraryMode = false;
            libraryButton.classList.toggle('active', false);
        });
    }
    if (libraryButton) {
        libraryButton.addEventListener('click', () => {
            if (!searchHistory || !libraryHistory) return;
            // Показать библиотеку и активировать режим
            searchHistory.style.display = 'none';
            libraryHistory.style.display = 'block';
            libraryMode = true;
            libraryButton.classList.toggle('active', true);
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
            
            // Если есть финальный результат, выполняем поиск
            if (finalTranscript !== '') {
                searchInput.value = finalTranscript;
                if (statusIndicator) statusIndicator.textContent = 'Поиск: ' + finalTranscript;
                
                // Выполнение поиска по распознанному тексту
                performSearch(finalTranscript);
                
                // Сохранение в нужное хранилище
                if (pressHoldActive || libraryMode) {
                    addToLibraryHistory(finalTranscript);
                } else {
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
    
    // Обработчик нажатия Enter в поле поиска
    searchInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            const query = this.value.trim();
            if (query) {
                if (libraryMode) {
                    addToLibraryHistory(query);
                } else {
                    performSearch(query);
                    addToSearchHistory(query);
                }
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
    
    // Функции для библиотеки
    function addToLibraryHistory(text) {
        if (!text.trim()) return;
        const item = {
            text,
            timestamp: new Date().toLocaleTimeString(),
            id: Date.now()
        };
        libraryHistoryArray.unshift(item);
        renderLibraryHistory();
    }
    
    function renderLibraryHistory() {
        if (!libraryHistory) return;
        libraryHistory.innerHTML = '';
        libraryHistoryArray.forEach(item => {
            const el = document.createElement('div');
            el.className = 'library-item';
            el.dataset.id = item.id;
            // Построить слова
            const words = item.text.split(/\s+/);
            const wordsHtml = words.map((w, idx) => `<span class="library-word" data-index="${idx}">${escapeHtml(w)}</span>`).join(' ');
            el.innerHTML = `
                <div class="library-item-text">${wordsHtml}</div>
                <div class="library-item-actions">
                    <button class="library-search">Искать по выбранным</button>
                    <button class="library-edit">Редактировать</button>
                    <button class="library-delete">Удалить</button>
                </div>
                <div class="library-item-time">${item.timestamp}</div>
            `;
            // Обработчик клика по словам
            el.querySelectorAll('.library-word').forEach(span => {
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
                });
            });
            // Кнопка поиска
            el.querySelector('.library-search').addEventListener('click', () => {
                const id = item.id;
                const set = selectedKeywordsById.get(id) || new Set();
                const keywords = Array.from(set);
                if (keywords.length === 0) return;
                searchLibraryByKeywords(keywords);
            });
            // Кнопка редактирования
            el.querySelector('.library-edit').addEventListener('click', () => {
                const updated = prompt('Изменить текст записи:', item.text);
                if (updated !== null) {
                    item.text = updated;
                    renderLibraryHistory();
                }
            });
            // Кнопка удаления
            el.querySelector('.library-delete').addEventListener('click', () => {
                libraryHistoryArray = libraryHistoryArray.filter(x => x.id !== item.id);
                selectedKeywordsById.delete(item.id);
                renderLibraryHistory();
            });
            libraryHistory.appendChild(el);
        });
    }
    
    function searchLibraryByKeywords(keywords) {
        const lower = keywords.map(k => k.toLowerCase());
        const filtered = uniqueQaData.filter(item => {
            const hay = `${item.question} ${item.answer}`.toLowerCase();
            return lower.some(k => hay.includes(k));
        });
        displaySearchResults(filtered, keywords.join(', '));
    }
    
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