// Функция для загрузки данных из JSON файлов
import { normalizeDataset } from './category-normalizer.js';

// Флаг: отключить нормализацию (например, при редактировании)
let normalizationDisabled = false;
export function setNormalizationDisabled(disabled) {
    normalizationDisabled = !!disabled;
}

export async function loadJsonData() {
    try {
        // Пробуем загрузить файл Копия вопросы.json
        // Всегда тянем свежие данные, минуя кэш браузера/Service Worker
        const response = await fetch(`./data/Копия вопросы.json?t=${Date.now()}` , { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Не удалось загрузить файл: ${response.status}`);
        }
        
        const text = await response.text();
        const data = JSON.parse(text);
        
        // Проверяем структуру данных
        if (data.questions && Array.isArray(data.questions)) {
            console.log(`Загружено ${data.questions.length} вопросов из файла Копия вопросы.json`);
            const base = normalizationDisabled ? data.questions : normalizeDataset(data.questions);
            return removeDuplicates(base, 'question');
        } else if (Array.isArray(data)) {
            console.log(`Загружено ${data.length} вопросов из файла Копия вопросы.json`);
            const base = normalizationDisabled ? data : normalizeDataset(data);
            return removeDuplicates(base, 'question');
        }
        
        return [];
    } catch (error) {
        console.error('Ошибка при загрузке данных:', error);
        return [];
    }
}

// Функция для удаления дубликатов из массива объектов по указанному ключу
export function removeDuplicates(array, key) {
    const seen = new Set();
    return array.filter(item => {
        const value = item[key];
        if (value === undefined || seen.has(value)) {
            return false;
        }
        seen.add(value);
        return true;
    });
}
