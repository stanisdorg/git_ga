// Вариант 2: Выпадающие списки для категорий и подкатегорий

// Импортируем категории и данные
import { categories } from '../categories.js';
import { uniqueQaData } from '../all-data.js';

// Функция для инициализации навигации с выпадающими списками
export function initDropdownNavigation() {
    const container = document.querySelector('.container');
    const searchContainer = document.querySelector('.search-container');
    
    // Создаем контейнер для навигации
    const navigationContainer = document.createElement('div');
    navigationContainer.className = 'dropdown-navigation';
    
    // Создаем селект для категорий
    const categorySelect = document.createElement('select');
    categorySelect.id = 'category-select';
    categorySelect.className = 'category-select';
    
    // Добавляем опцию "Все вопросы"
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'Все вопросы';
    categorySelect.appendChild(allOption);
    
    // Добавляем опции для всех категорий
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        categorySelect.appendChild(option);
    });
    
    // Создаем селект для подкатегорий
    const subcategorySelect = document.createElement('select');
    subcategorySelect.id = 'subcategory-select';
    subcategorySelect.className = 'subcategory-select';
    subcategorySelect.disabled = true;
    
    // Добавляем опцию "Все подкатегории"
    const allSubcategoryOption = document.createElement('option');
    allSubcategoryOption.value = 'all';
    allSubcategoryOption.textContent = 'Все подкатегории';
    subcategorySelect.appendChild(allSubcategoryOption);
    
    // Добавляем обработчик изменения категории
    categorySelect.addEventListener('change', function() {
        // Очищаем селект подкатегорий
        subcategorySelect.innerHTML = '';
        subcategorySelect.appendChild(allSubcategoryOption);
        
        if (categorySelect.value === 'all') {
            // Если выбраны все вопросы, отключаем селект подкатегорий
            subcategorySelect.disabled = true;
            showAllQuestions();
        } else {
            // Если выбрана конкретная категория, включаем селект подкатегорий
            subcategorySelect.disabled = false;
            
            // Находим выбранную категорию
            const selectedCategory = categories.find(cat => cat.id == categorySelect.value);
            
            // Добавляем опции для подкатегорий выбранной категории
            selectedCategory.subcategories.forEach(subcategory => {
                const option = document.createElement('option');
                option.value = subcategory.id;
                option.textContent = subcategory.name;
                subcategorySelect.appendChild(option);
            });
            
            // Фильтруем и отображаем вопросы по категории
            filterQuestionsByCategory(selectedCategory.name);
        }
    });
    
    // Добавляем обработчик изменения подкатегории
    subcategorySelect.addEventListener('change', function() {
        if (subcategorySelect.value === 'all') {
            // Если выбраны все подкатегории, фильтруем только по категории
            const selectedCategory = categories.find(cat => cat.id == categorySelect.value);
            filterQuestionsByCategory(selectedCategory.name);
        } else {
            // Если выбрана конкретная подкатегория, фильтруем по категории и подкатегории
            const selectedCategory = categories.find(cat => cat.id == categorySelect.value);
            const selectedSubcategory = selectedCategory.subcategories.find(
                subcat => subcat.id == subcategorySelect.value
            );
            
            filterQuestionsBySubcategory(selectedCategory.name, selectedSubcategory.name);
        }
    });
    
    // Создаем контейнер для кнопки сброса фильтров
    const resetButtonContainer = document.createElement('div');
    resetButtonContainer.className = 'reset-button-container';
    
    // Создаем кнопку сброса фильтров
    const resetButton = document.createElement('button');
    resetButton.id = 'reset-filters';
    resetButton.className = 'reset-button';
    resetButton.textContent = 'Сбросить фильтры';
    
    // Добавляем обработчик клика по кнопке сброса
    resetButton.addEventListener('click', function() {
        categorySelect.value = 'all';
        subcategorySelect.innerHTML = '';
        subcategorySelect.appendChild(allSubcategoryOption);
        subcategorySelect.disabled = true;
        showAllQuestions();
    });
    
    resetButtonContainer.appendChild(resetButton);
    
    // Добавляем элементы в контейнер навигации
    navigationContainer.appendChild(categorySelect);
    navigationContainer.appendChild(subcategorySelect);
    navigationContainer.appendChild(resetButtonContainer);
    
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
    
    // Добавляем заголовок
    const resultsHeader = document.createElement('div');
    resultsHeader.className = 'results-header';
    resultsHeader.innerHTML = `<h2>${title}</h2><p>Найдено вопросов: ${questions.length}</p>`;
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
            resultItem.style.transformOrigin = 'center top';
        }
        
        // Добавляем обработчики событий для эффекта при наведении
        resultItem.addEventListener('mouseenter', function() {
            // Увеличиваем только по вертикали, чтобы сохранить ширину
            this.style.transform = 'scaleX(0.95) scaleY(1.15)';
            
            // Соседние карточки отталкиваем на ±8px
            const items = document.querySelectorAll('.result-item');
            items.forEach(item => {
                if (item !== this) {
                    const idx = Array.from(resultsList.querySelectorAll('.result-item')).indexOf(item);
                    if (idx % 2 === 0) {
                        item.style.transform = 'scale(0.95) translateX(-8px)';
                    } else {
                        item.style.transform = 'scale(0.95) translateX(8px)';
                    }
                }
            });
        });

        resultItem.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(0.95)';
            const items = document.querySelectorAll('.result-item');
            items.forEach(item => {
                if (item !== this) {
                    item.style.transform = 'scale(0.95)';
                }
            });
        });
        
        resultsList.appendChild(resultItem);
    });
}