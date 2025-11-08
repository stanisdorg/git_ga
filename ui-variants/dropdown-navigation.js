// Вариант 2: Выпадающие списки для категорий и подкатегорий

// Импортируем данные и генератор категорий
import { uniqueQaData } from '../all-data.js';
import { buildCategoriesFromData } from '../computed-categories.js';

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
        option.textContent = category.displayName || category.name;
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
    
    // Кнопка сброса фильтров удалена по требованиям — оставляем навигацию без неё
    
    // Добавляем элементы в контейнер навигации
    navigationContainer.appendChild(categorySelect);
    navigationContainer.appendChild(subcategorySelect);
    
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
    // Без заголовка категории — только счётчик
    resultsHeader.innerHTML = `<p class="results-count">Найдено: ${questions.length}</p>`;
    resultsList.appendChild(resultsHeader);
    
    // Добавляем вопросы
    questions.forEach(item => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';

        const favorites = JSON.parse(localStorage.getItem('qaFavorites') || '[]');
        const isFav = favorites.includes(item.question);
        const favClass = isFav ? 'fav-active' : '';

        resultItem.innerHTML = `
            <div class="question-row">
                <span class="category-badge">${item.category || ''}</span>
                <span class="subcategory-badge">${item.subcategory || ''}</span>
                <button class="fav-btn ${favClass}" title="В избранное">★</button>
                ${location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? '<button class="edit-btn" title="Редактировать">✎</button>' : ''}
            </div>
            <div class="question">${item.question}</div>
            <div class="answer">${item.answer}</div>
        `;

        const favBtn = resultItem.querySelector('.fav-btn');
        favBtn.addEventListener('click', () => {
            const current = new Set(JSON.parse(localStorage.getItem('qaFavorites') || '[]'));
            if (current.has(item.question)) {
                current.delete(item.question);
                favBtn.classList.remove('fav-active');
            } else {
                current.add(item.question);
                favBtn.classList.add('fav-active');
            }
            localStorage.setItem('qaFavorites', JSON.stringify(Array.from(current)));
        });

        const editBtn = resultItem.querySelector('.edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                const newCategory = prompt('Новая категория:', item.category || '');
                const newSubcategory = prompt('Новая подкатегория:', item.subcategory || '');
                if (newCategory) {
                    const overrides = JSON.parse(localStorage.getItem('qaAdminOverrides') || '{}');
                    overrides[item.question] = { category: newCategory, subcategory: newSubcategory || '' };
                    localStorage.setItem('qaAdminOverrides', JSON.stringify(overrides));
                    item.category = newCategory;
                    item.subcategory = newSubcategory || '';
                    resultItem.querySelector('.category-badge').textContent = item.category || '';
                    resultItem.querySelector('.subcategory-badge').textContent = item.subcategory || '';
                }
            });
        }

        resultsList.appendChild(resultItem);
    });
}
    const categories = buildCategoriesFromData(uniqueQaData);
