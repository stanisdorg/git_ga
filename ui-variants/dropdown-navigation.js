// Вариант 2: Выпадающие списки для колод и тем

// Импортируем данные и генератор колод
import { uniqueQaData } from '../all-data.js';
import { buildCategoriesFromData } from '../computed-categories.js';
import { applyFormatting } from '../srs/text-formatter.js';

// Функция для инициализации навигации с выпадающими списками
export function initDropdownNavigation() {
    const container = document.querySelector('.container');
    const searchContainer = document.querySelector('.search-container');

    // Создаем контейнер для навигации
    const navigationContainer = document.createElement('div');
    navigationContainer.className = 'dropdown-navigation';

    // Создаем селект для колод
    const categorySelect = document.createElement('select');
    categorySelect.id = 'category-select';
    categorySelect.className = 'category-select';

    // Добавляем опцию "Все колоды"
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'Все колоды';
    categorySelect.appendChild(allOption);

    // Добавляем опции для всех колод
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.displayName || category.name;
        categorySelect.appendChild(option);
    });

    // Создаем селект для тем
    const subcategorySelect = document.createElement('select');
    subcategorySelect.id = 'subcategory-select';
    subcategorySelect.className = 'subcategory-select';
    subcategorySelect.disabled = true;

    // Добавляем опцию "Все темы"
    const allSubcategoryOption = document.createElement('option');
    allSubcategoryOption.value = 'all';
    allSubcategoryOption.textContent = 'Все темы';
    subcategorySelect.appendChild(allSubcategoryOption);

    // Добавляем обработчик изменения колоды
    categorySelect.addEventListener('change', function () {
        // Очищаем селект тем
        subcategorySelect.innerHTML = '';
        subcategorySelect.appendChild(allSubcategoryOption);

        if (categorySelect.value === 'all') {
            // Если выбраны все вопросы, отключаем селект тем
            subcategorySelect.disabled = true;
            showAllQuestions();
        } else {
            // Если выбрана конкретная колода, включаем селект тем
            subcategorySelect.disabled = false;

            // Находим выбранную колоду
            const selectedCategory = categories.find(cat => cat.id == categorySelect.value);

            // Добавляем опции для тем выбранной колоды
            selectedCategory.subcategories.forEach(subcategory => {
                const option = document.createElement('option');
                option.value = subcategory.id;
                option.textContent = subcategory.name;
                subcategorySelect.appendChild(option);
            });

            // Фильтруем и отображаем вопросы по колоде
            filterQuestionsByCategory(selectedCategory.name);
        }
    });

    // Добавляем обработчик изменения темы
    subcategorySelect.addEventListener('change', function () {
        if (subcategorySelect.value === 'all') {
            // Если выбраны все темы, фильтруем только по колоде
            const selectedCategory = categories.find(cat => cat.id == categorySelect.value);
            filterQuestionsByCategory(selectedCategory.name);
        } else {
            // Если выбрана конкретная тема, фильтруем по колоде и теме
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

// Функция для фильтрации вопросов по колоде
function filterQuestionsByCategory(categoryName) {
    const filteredData = uniqueQaData.filter(item => item.category === categoryName);
    displayQuestions(filteredData, `Колода: ${categoryName}`);
}

// Функция для фильтрации вопросов по теме
function filterQuestionsBySubcategory(categoryName, subcategoryName) {
    const filteredData = uniqueQaData.filter(
        item => item.category === categoryName && item.subcategory === subcategoryName
    );
    displayQuestions(filteredData, `Тема: ${subcategoryName}`);
}

// Функция для отображения всех вопросов
function showAllQuestions() {
    displayQuestions(uniqueQaData, 'Все колоды');
}

// Функция для отображения вопросов
function displayQuestions(questions, title) {
    const resultsList = document.getElementById('results-list');
    resultsList.innerHTML = '';

    // Добавляем заголовок
    const resultsHeader = document.createElement('div');
    resultsHeader.className = 'results-header';
    // Без заголовка колоды — только счётчик
    resultsHeader.innerHTML = `<p class="results-count">Найдено: ${questions.length}</p>`;
    resultsList.appendChild(resultsHeader);

    // Добавляем вопросы
    questions.forEach(item => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';

        const favorites = JSON.parse(localStorage.getItem('qaFavorites') || '[]');
        const isFav = favorites.includes(item.question);
        const favClass = isFav ? 'fav-active' : '';

        const starSvg = (filled) => `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                    style="fill: ${filled ? '#ffd700' : 'none'}; stroke: ${filled ? '#ffd700' : 'currentColor'}; stroke-width: 2px;"
                />
            </svg>
        `;

        // Применяем форматирование к вопросу и ответу
        const questionFormatting = item.formatting?.question || [];
        const answerFormatting = item.formatting?.answer || [];
        const questionHTML = applyFormatting(item.question, questionFormatting);
        const answerHTML = applyFormatting(item.answer, answerFormatting);

        resultItem.innerHTML = `
            <div class="question-row">
                <span class="category-badge">${item.category || ''}</span>
                <span class="subcategory-badge">${item.subcategory || ''}</span>
                <button class="fav-btn ${favClass}" title="В избранное" style="background:none;border:none;cursor:pointer;padding:0;display:flex;align-items:center">${starSvg(isFav)}</button>
                ${location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? '<button class="edit-btn" title="Редактировать">✎</button>' : ''}
            </div>
            <div class="question">${questionHTML}</div>
            <div class="answer">${answerHTML}</div>
        `;

        const favBtn = resultItem.querySelector('.fav-btn');
        favBtn.addEventListener('click', () => {
            const current = new Set(JSON.parse(localStorage.getItem('qaFavorites') || '[]'));
            if (current.has(item.question)) {
                current.delete(item.question);
                favBtn.classList.remove('fav-active');
                favBtn.innerHTML = starSvg(false);
            } else {
                current.add(item.question);
                favBtn.classList.add('fav-active');
                favBtn.innerHTML = starSvg(true);
            }
            localStorage.setItem('qaFavorites', JSON.stringify(Array.from(current)));
        });

        const editBtn = resultItem.querySelector('.edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                const newCategory = prompt('Новая колода:', item.category || '');
                const newSubcategory = prompt('Новая тема:', item.subcategory || '');
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
