// Вариант 3: Табы для категорий и карточки для подкатегорий

// Импортируем категории и данные
import { categories } from '../categories.js';
import { uniqueQaData } from '../all-data.js';

// Функция для инициализации навигации с табами
export function initTabsNavigation() {
    const container = document.querySelector('.container');
    const searchContainer = document.querySelector('.search-container');
    
    // Создаем контейнер для навигации
    const navigationContainer = document.createElement('div');
    navigationContainer.className = 'tabs-navigation';
    
    // Создаем контейнер для табов
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'tabs-container';
    
    // Создаем таб "Все вопросы"
    const allTab = document.createElement('div');
    allTab.className = 'tab active';
    allTab.dataset.category = 'all';
    allTab.textContent = 'Все вопросы';
    tabsContainer.appendChild(allTab);
    
    // Добавляем табы для всех категорий
    categories.forEach(category => {
        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.dataset.category = category.id;
        tab.textContent = category.name;
        tabsContainer.appendChild(tab);
    });
    
    // Создаем контейнер для подкатегорий
    const subcategoriesContainer = document.createElement('div');
    subcategoriesContainer.className = 'subcategories-container';
    subcategoriesContainer.style.display = 'none';
    
    // Добавляем обработчики клика по табам
    tabsContainer.addEventListener('click', function(e) {
        if (e.target.classList.contains('tab')) {
            // Удаляем класс active у всех табов
            const tabs = tabsContainer.querySelectorAll('.tab');
            tabs.forEach(tab => tab.classList.remove('active'));
            
            // Добавляем класс active выбранному табу
            e.target.classList.add('active');
            
            const categoryId = e.target.dataset.category;
            
            if (categoryId === 'all') {
                // Если выбраны все вопросы, скрываем контейнер подкатегорий
                subcategoriesContainer.style.display = 'none';
                showAllQuestions();
            } else {
                // Если выбрана конкретная категория, показываем контейнер подкатегорий
                subcategoriesContainer.style.display = 'flex';
                
                // Очищаем контейнер подкатегорий
                subcategoriesContainer.innerHTML = '';
                
                // Находим выбранную категорию
                const selectedCategory = categories.find(cat => cat.id == categoryId);
                
                // Добавляем карточку "Все подкатегории"
                const allSubcategoryCard = document.createElement('div');
                allSubcategoryCard.className = 'subcategory-card active';
                allSubcategoryCard.dataset.subcategory = 'all';
                allSubcategoryCard.textContent = 'Все подкатегории';
                subcategoriesContainer.appendChild(allSubcategoryCard);
                
                // Добавляем карточки для подкатегорий выбранной категории
                selectedCategory.subcategories.forEach(subcategory => {
                    const card = document.createElement('div');
                    card.className = 'subcategory-card';
                    card.dataset.subcategory = subcategory.id;
                    card.dataset.category = categoryId;
                    card.textContent = subcategory.name;
                    subcategoriesContainer.appendChild(card);
                });
                
                // Фильтруем и отображаем вопросы по категории
                filterQuestionsByCategory(selectedCategory.name);
            }
        }
    });
    
    // Добавляем обработчики клика по карточкам подкатегорий
    subcategoriesContainer.addEventListener('click', function(e) {
        if (e.target.classList.contains('subcategory-card')) {
            // Удаляем класс active у всех карточек
            const cards = subcategoriesContainer.querySelectorAll('.subcategory-card');
            cards.forEach(card => card.classList.remove('active'));
            
            // Добавляем класс active выбранной карточке
            e.target.classList.add('active');
            
            const subcategoryId = e.target.dataset.subcategory;
            const categoryId = e.target.dataset.category || tabsContainer.querySelector('.tab.active').dataset.category;
            
            if (subcategoryId === 'all') {
                // Если выбраны все подкатегории, фильтруем только по категории
                const selectedCategory = categories.find(cat => cat.id == categoryId);
                filterQuestionsByCategory(selectedCategory.name);
            } else {
                // Если выбрана конкретная подкатегория, фильтруем по категории и подкатегории
                const selectedCategory = categories.find(cat => cat.id == categoryId);
                const selectedSubcategory = selectedCategory.subcategories.find(
                    subcat => subcat.id == subcategoryId
                );
                
                filterQuestionsBySubcategory(selectedCategory.name, selectedSubcategory.name);
            }
        }
    });
    
    // Создаем контейнер для кнопки сброса фильтров
    const resetButtonContainer = document.createElement('div');
    resetButtonContainer.className = 'reset-button-container';
    
    // Создаем кнопку сброса фильтров
    const resetButton = document.createElement('button');
    resetButton.id = 'reset-filters';
    resetButton.className = 'reset-button';
    // Заменяем текст на иконку (красная квадратная кнопка со скруглениями, внутри круг со стрелкой)
    resetButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <circle cx="12" cy="12" r="8" fill="none" stroke="white" stroke-width="2" />
            <path d="M10 8l4 4-4 4" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
    `;
    resetButton.title = 'Сбросить фильтры';
    
    // Добавляем обработчик клика по кнопке сброса
    resetButton.addEventListener('click', function() {
        // Удаляем класс active у всех табов
        const tabs = tabsContainer.querySelectorAll('.tab');
        tabs.forEach(tab => tab.classList.remove('active'));
        
        // Добавляем класс active табу "Все вопросы"
        allTab.classList.add('active');
        
        // Скрываем контейнер подкатегорий
        subcategoriesContainer.style.display = 'none';
        
        // Отображаем все вопросы
        showAllQuestions();
    });
    
    resetButtonContainer.appendChild(resetButton);
    
    // Создаем верхнюю строку навигации: табы + кнопка сброса в одну линию
    const tabsHeader = document.createElement('div');
    tabsHeader.className = 'tabs-header';
    tabsHeader.appendChild(tabsContainer);
    tabsHeader.appendChild(resetButtonContainer);
    
    // Добавляем элементы в контейнер навигации
    // navigationContainer.appendChild(tabsContainer);
    navigationContainer.appendChild(tabsHeader);
    navigationContainer.appendChild(subcategoriesContainer);
    
    // Вставляем контейнер навигации перед контейнером поиска
    container.insertBefore(navigationContainer, searchContainer);
}

// Функция для фильтрации вопросов по категории
function filterQuestionsByCategory(categoryName) {
    const filteredData = uniqueQaData.filter(item => item.category === categoryName);
    displayQuestions(filteredData, `Категория: ${categoryName}`);
}

// Функция для фильтрации вопросов по подкатегории
function filterQuestionsBySubcategory(categoryName, subcategoryName) {
    const filteredData = uniqueQaData.filter(
        item => item.category === categoryName && item.subcategory === subcategoryName
    );
    displayQuestions(filteredData, `Подкатегория: ${subcategoryName}`);
}

// Функция для отображения всех вопросов
function showAllQuestions() {
    displayQuestions(uniqueQaData, 'Все вопросы');
}

// Функция для отображения вопросов
function displayQuestions(questions, title) {
    const resultsList = document.getElementById('results-list');
    resultsList.innerHTML = '';
    
    // Добавляем только счетчик, без заголовка h2
    const resultsHeader = document.createElement('div');
    resultsHeader.className = 'results-header';
    resultsHeader.innerHTML = `<p class="results-count">Найдено вопросов: ${questions.length}</p>`;
    resultsList.appendChild(resultsHeader);
    
    // Добавляем вопросы
    questions.forEach(item => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';
        
        resultItem.innerHTML = `
            <div class="question">${item.question}</div>
            <div class="answer">${item.answer}</div>
            <div class="category-info">
                <span class="category-badge">${item.category}</span>
                <span class="subcategory-badge">${item.subcategory}</span>
            </div>
        `;
        
        // Определяем, является ли карточка левой или правой в сетке
        const itemIndex = resultsList.querySelectorAll('.result-item').length;
        const isLeftCard = itemIndex % 2 === 0;
        
        // Устанавливаем точку трансформации в зависимости от положения карточки
        if (isLeftCard) {
            resultItem.style.transformOrigin = 'left center';
        } else {
            // Устанавливаем точку трансформации для аккуратной вертикальной анимации
            resultItem.style.transformOrigin = 'center top';
        }
        
        // Добавляем обработчики событий для эффекта при наведении
        resultItem.addEventListener('mouseenter', function() {
            // Увеличиваем только текущую карточку по вертикали
            this.style.transform = 'scaleY(1.15)';
            this.style.zIndex = '100';
            this.style.boxShadow = '0 8px 15px rgba(0, 0, 0, 0.4)';
            
            // Соседние карточки: только горизонтальное смещение, без вертикального масштабирования
            document.querySelectorAll('.result-item').forEach(item => {
                if (item !== this) {
                    const itemIsLeftCard = Array.from(resultsList.querySelectorAll('.result-item')).indexOf(item) % 2 === 0;
                    if (itemIsLeftCard) {
                        item.style.transform = 'scale(0.95) translateX(-8px)';
                    } else {
                        item.style.transform = 'scale(0.95) translateX(8px)';
                    }
                }
            });
        });
        
        resultItem.addEventListener('mouseleave', function() {
            // Возвращаем текущую карточку в исходное состояние
            this.style.transform = 'scale(0.95)';
            this.style.zIndex = '1';
            this.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
            
            // Возвращаем остальные карточки в исходное состояние
            document.querySelectorAll('.result-item').forEach(item => {
                if (item !== this) {
                    item.style.transform = 'scale(0.95)';
                }
            });
        });
        
        resultsList.appendChild(resultItem);
    });
}