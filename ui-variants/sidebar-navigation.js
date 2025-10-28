// Вариант 1: Боковая панель с категориями и подкатегориями

// Импортируем категории и данные
import { categories } from '../categories.js';
import { uniqueQaData } from '../all-data.js';

// Функция для инициализации боковой навигации по категориям
export function initSidebarNavigation() {
    const sidebar = document.querySelector('.sidebar');
    
    // Создаем контейнер для категорий
    const categoriesContainer = document.createElement('div');
    categoriesContainer.className = 'categories-container';
    
    // Добавляем заголовок для категорий
    const categoriesHeader = document.createElement('div');
    categoriesHeader.className = 'sidebar-header';
    categoriesHeader.innerHTML = '<h2>Категории</h2>';
    categoriesContainer.appendChild(categoriesHeader);
    
    // Создаем список категорий
    const categoriesList = document.createElement('div');
    categoriesList.className = 'categories-list';
    
    // Добавляем пункт "Все вопросы"
    const allQuestionsItem = document.createElement('div');
    allQuestionsItem.className = 'category-item active';
    allQuestionsItem.textContent = 'Все вопросы';
    allQuestionsItem.dataset.categoryId = 'all';
    categoriesList.appendChild(allQuestionsItem);
    
    // Добавляем все категории
    categories.forEach(category => {
        const categoryItem = document.createElement('div');
        categoryItem.className = 'category-item';
        categoryItem.textContent = category.displayName || category.name;
        categoryItem.dataset.categoryId = category.id;
        categoriesList.appendChild(categoryItem);
        
        // Создаем контейнер для подкатегорий
        const subcategoriesContainer = document.createElement('div');
        subcategoriesContainer.className = 'subcategories-container';
        subcategoriesContainer.style.display = 'none';
        
        // Добавляем подкатегории
        category.subcategories.forEach(subcategory => {
            const subcategoryItem = document.createElement('div');
            subcategoryItem.className = 'subcategory-item';
            subcategoryItem.textContent = subcategory.name;
            subcategoryItem.dataset.categoryId = category.id;
            subcategoryItem.dataset.subcategoryId = subcategory.id;
            subcategoriesContainer.appendChild(subcategoryItem);
        });
        
        categoriesList.appendChild(subcategoriesContainer);
        
        // Добавляем обработчик клика по категории
        categoryItem.addEventListener('click', function() {
            // Скрываем все контейнеры подкатегорий
            document.querySelectorAll('.subcategories-container').forEach(container => {
                container.style.display = 'none';
            });
            
            // Показываем подкатегории текущей категории
            subcategoriesContainer.style.display = 'block';
            
            // Устанавливаем активную категорию
            document.querySelectorAll('.category-item').forEach(item => {
                item.classList.remove('active');
            });
            categoryItem.classList.add('active');
            
            // Фильтруем и отображаем вопросы по категории
            filterQuestionsByCategory(category.name);
        });
    });
    
    // Добавляем обработчик клика по "Все вопросы"
    allQuestionsItem.addEventListener('click', function() {
        // Скрываем все контейнеры подкатегорий
        document.querySelectorAll('.subcategories-container').forEach(container => {
            container.style.display = 'none';
        });
        
        // Устанавливаем активную категорию
        document.querySelectorAll('.category-item').forEach(item => {
            item.classList.remove('active');
        });
        allQuestionsItem.classList.add('active');
        
        // Отображаем все вопросы
        showAllQuestions();
    });
    
    // Добавляем обработчики клика по подкатегориям
    document.querySelectorAll('.subcategory-item').forEach(item => {
        item.addEventListener('click', function() {
            // Устанавливаем активную подкатегорию
            document.querySelectorAll('.subcategory-item').forEach(subItem => {
                subItem.classList.remove('active');
            });
            item.classList.add('active');
            
            // Фильтруем и отображаем вопросы по подкатегории
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
        
        resultItem.innerHTML = `
            <div class="question">${item.question}</div>
            <div class="answer">${item.answer}</div>
        `;
        
        resultsList.appendChild(resultItem);
    });
}