// Вариант 1: Боковая панель с колодами и темами

// Импортируем данные и генератор колод
import { uniqueQaData } from '../all-data.js';
import { buildCategoriesFromData } from '../computed-categories.js';
import { applyFormatting } from '../srs/text-formatter.js';

// Функция для инициализации боковой навигации по колодам
export function initSidebarNavigation() {
    const sidebar = document.querySelector('.sidebar');

    // Создаем контейнер для колод
    const categoriesContainer = document.createElement('div');
    categoriesContainer.className = 'categories-container';

    // Добавляем заголовок для колод
    const categoriesHeader = document.createElement('div');
    categoriesHeader.className = 'sidebar-header';
    categoriesHeader.innerHTML = '<h2>Колоды</h2>';
    categoriesContainer.appendChild(categoriesHeader);

    // Создаем список колод
    const categoriesList = document.createElement('div');
    categoriesList.className = 'categories-list';

    // Добавляем пункт "Все колоды"
    const allQuestionsItem = document.createElement('div');
    allQuestionsItem.className = 'category-item active';
    allQuestionsItem.textContent = 'Все колоды';
    allQuestionsItem.dataset.categoryId = 'all';
    categoriesList.appendChild(allQuestionsItem);

    // Строим колоды по данным
    const categories = buildCategoriesFromData(uniqueQaData);

    // Добавляем все колоды
    categories.forEach(category => {
        const categoryItem = document.createElement('div');
        categoryItem.className = 'category-item';
        categoryItem.textContent = category.displayName || category.name;
        categoryItem.dataset.categoryId = category.id;
        categoriesList.appendChild(categoryItem);

        // Создаем контейнер для тем
        const subcategoriesContainer = document.createElement('div');
        subcategoriesContainer.className = 'subcategories-container';
        subcategoriesContainer.style.display = 'none';

        // Добавляем темы
        category.subcategories.forEach(subcategory => {
            const subcategoryItem = document.createElement('div');
            subcategoryItem.className = 'subcategory-item';
            subcategoryItem.textContent = subcategory.name;
            subcategoryItem.dataset.categoryId = category.id;
            subcategoryItem.dataset.subcategoryId = subcategory.id;
            subcategoriesContainer.appendChild(subcategoryItem);
        });

        categoriesList.appendChild(subcategoriesContainer);

        // Добавляем обработчик клика по колоде
        categoryItem.addEventListener('click', function () {
            // Скрываем все контейнеры тем
            document.querySelectorAll('.subcategories-container').forEach(container => {
                container.style.display = 'none';
            });

            // Показываем темы текущей колоды
            subcategoriesContainer.style.display = 'block';

            // Устанавливаем активную колоду
            document.querySelectorAll('.category-item').forEach(item => {
                item.classList.remove('active');
            });
            categoryItem.classList.add('active');

            // Фильтруем и отображаем вопросы по колоде
            filterQuestionsByCategory(category.name);
        });
    });

    // Добавляем обработчик клика по "Все колоды"
    allQuestionsItem.addEventListener('click', function () {
        // Скрываем все контейнеры тем
        document.querySelectorAll('.subcategories-container').forEach(container => {
            container.style.display = 'none';
        });

        // Устанавливаем активную колоду
        document.querySelectorAll('.category-item').forEach(item => {
            item.classList.remove('active');
        });
        allQuestionsItem.classList.add('active');

        // Отображаем все вопросы
        showAllQuestions();
    });

    // Добавляем обработчики клика по темам
    document.querySelectorAll('.subcategory-item').forEach(item => {
        item.addEventListener('click', function () {
            // Устанавливаем активную тему
            document.querySelectorAll('.subcategory-item').forEach(subItem => {
                subItem.classList.remove('active');
            });
            item.classList.add('active');

            // Фильтруем и отображаем вопросы по теме
            const categoryName = categories.find(cat => cat.id == item.dataset.categoryId).name;
            const subcategoryName = categories
                .find(cat => cat.id == item.dataset.categoryId)
                .subcategories
                .find(subcat => subcat.id == item.dataset.subcategoryId).name;

            filterQuestionsBySubcategory(categoryName, subcategoryName);
        });
    });

    categoriesContainer.appendChild(categoriesList);
    sidebar.appendChild(categoriesContainer);
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
