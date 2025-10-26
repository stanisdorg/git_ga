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
    
    // Автоматическая загрузка всех карточек
    setTimeout(() => {
        if (typeof showAllQuestions === 'function') {
            showAllQuestions();
        }
    }, 300);
    
    // Массив для хранения истории поиска
    let searchHistoryArray = [];
    
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
    
    // Проверка поддержки Web Speech API
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        if (statusIndicator) statusIndicator.textContent = 'Ваш браузер не поддерживает распознавание речи';
        micButton.disabled = true;
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
                
                // Добавление запроса в историю
                addToSearchHistory(finalTranscript);
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
        
        // Обработчик нажатия на кнопку микрофона
        micButton.addEventListener('click', toggleSpeechRecognition);
        
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
                if (statusIndicator) statusIndicator.textContent = 'Готов к прослушиванию';
            } else {
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
    
    // Функция выполнения поиска
    function performSearch(query) {
        const filteredData = uniqueQaData.filter(item =>
            item.question.toLowerCase().includes(query.toLowerCase())
        );
        
        displaySearchResults(filteredData, query);
    }
    
    // Функция отображения результатов поиска
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
        resultsHeader.innerHTML = `<p class="results-count">Найдено вопросов: ${filteredData.length}</p>`;
        resultsList.appendChild(resultsHeader);
        
        // Добавляем результаты
        filteredData.forEach(item => {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            
            resultItem.innerHTML = `
                <div class="question">${item.question}</div>
                <div class="answer">${item.answer}</div>
                <div class="result-meta">
                    <span class="result-category">Категория: ${item.category}</span>
                    <span class="result-subcategory">Подкатегория: ${item.subcategory}</span>
                </div>
            `;
            
            // Hover effects are now handled by CSS
            
            resultsList.appendChild(resultItem);
        });
    }
});