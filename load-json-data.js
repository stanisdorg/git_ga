// Функция для загрузки данных из JSON файлов
async function loadJsonData() {
    try {
        // Получаем список JSON-файлов из директории ./data
        const jsonFiles = await listDataJsonFiles();
        if (!jsonFiles || jsonFiles.length === 0) {
            console.warn('В директории ./data не найдено JSON-файлов.');
            return [];
        }

        // Загружаем данные из всех найденных файлов
        const dataPromises = jsonFiles.map(async (fileName) => {
            const filePath = `./data/${fileName}`;
            try {
                const response = await fetch(filePath);
                if (!response.ok) {
                    throw new Error(`Не удалось загрузить файл ${filePath}: ${response.status}`);
                }
                // Пытаемся распарсить как корректный JSON
                const text = await response.text();
                try {
                    const parsed = JSON.parse(text);
                    return Array.isArray(parsed) ? parsed : [];
                } catch (jsonErr) {
                    // Попытка: файл может содержать последовательность JSON-объектов без массива
                    const concatenatedParsed = parseConcatenatedJsonObjects(text);
                    if (Array.isArray(concatenatedParsed) && concatenatedParsed.length > 0) {
                        console.warn(`Файл ${filePath} не является валидным JSON-массивом, но успешно распарсен как последовательность объектов (${concatenatedParsed.length} элементов).`);
                        return concatenatedParsed;
                    }
                    // Фолбэк: парсим как кастомный текстовый формат (ключ TAB "значение")
                    const fallbackParsed = parseCustomQaFormat(text);
                    if (Array.isArray(fallbackParsed) && fallbackParsed.length > 0) {
                        console.warn(`Файл ${filePath} не является валидным JSON, но успешно распарсен как текстовый формат (${fallbackParsed.length} элементов).`);
                        return fallbackParsed;
                    }
                    console.warn(`Файл ${filePath} не удалось распарсить ни как JSON, ни как последовательность объектов, ни как текстовый формат.`);
                    return [];
                }
            } catch (error) {
                console.warn(`Файл ${filePath} не найден или недоступен, пропускаем.`, error);
                return [];
            }
        });

        // Ждем загрузки всех данных
        const allDataArrays = await Promise.all(dataPromises);

        // Объединяем все массивы данных
        let combinedData = [];
        allDataArrays.forEach(dataArray => {
            if (Array.isArray(dataArray)) {
                combinedData = combinedData.concat(dataArray);
            }
        });

        // Удаляем дубликаты по вопросам
        const uniqueData = removeDuplicates(combinedData, 'question');

        console.log(`Загружено ${combinedData.length} вопросов из ${jsonFiles.length} файлов, после удаления дубликатов: ${uniqueData.length}`);
        return uniqueData;
    } catch (error) {
        console.error('Ошибка при загрузке данных:', error);
        return [];
    }
}

// Пытаемся получить список файлов из ./data двумя способами:
// 1) Парсим HTML-индекса директории, если сервер отдает листинг
// 2) Фолбэк: читаем файл ./data/data-files.json (массив имён файлов)
async function listDataJsonFiles() {
    const dirPath = './data/';
    // Пытаемся получить листинг директории
    try {
        const response = await fetch(dirPath);
        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        if (response.ok && contentType.includes('text/html')) {
            const html = await response.text();
            const matches = Array.from(html.matchAll(/href=["']([^"']+\.json)["']/gi)).map(m => m[1]);
            // Нормализуем пути: оставляем только имя файла внутри директории
            const files = matches.map(href => {
                try {
                    const url = new URL(href, window.location.href);
                    const pathname = url.pathname;
                    if (pathname.startsWith('/')) {
                        const parts = pathname.split('/').filter(Boolean);
                        // Ищем компонент после 'data'
                        const dataIndex = parts.indexOf('data');
                        if (dataIndex !== -1 && parts.length > dataIndex + 1) {
                            return decodeURIComponent(parts[dataIndex + 1]);
                        }
                    }
                } catch (_) {
                    // Если не удалось распарсить как URL, пробуем относительный путь
                    if (href.startsWith('./')) return decodeURIComponent(href.replace('./', ''));
                    if (href.startsWith('data/')) return decodeURIComponent(href.replace('data/', ''));
                    return decodeURIComponent(href);
                }
                return null;
            }).filter(Boolean);
            const uniqueFiles = Array.from(new Set(files));
            if (uniqueFiles.length > 0) {
                return uniqueFiles;
            }
        }
    } catch (e) {
        console.warn('Листинг директории ./data недоступен, используем фолбэк data-files.json', e);
    }

    // Фолбэк: читаем ./data/data-files.json
    try {
        const idxResp = await fetch('./data/data-files.json');
        if (idxResp.ok) {
            const list = await idxResp.json();
            if (Array.isArray(list)) {
                return list;
            }
        }
    } catch (e) {
        console.warn('Файл data-files.json недоступен', e);
    }
    return [];
}

// Функция для удаления дубликатов из массива объектов по указанному ключу
function removeDuplicates(array, key) {
    const seen = new Set();
    return array.filter(item => {
        const value = item[key];
        if (value && !seen.has(value)) {
            seen.add(value);
            return true;
        }
        return false;
    });
}

// Парсер для кастомного текстового формата: блоки, где строки имеют вид "key<TAB>\"value\""
function parseCustomQaFormat(text) {
    const lines = text.split(/\r?\n/);
    const items = [];
    let current = null;

    const pushCurrent = () => {
        if (current && current.question && current.answer) {
            // Нормализуем значения
            current.category = current.category || '';
            current.subcategory = current.subcategory || '';
            items.push(current);
        }
        current = null;
    };

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        if (!raw) continue;
        const line = raw.trim();
        if (!line) continue;

        // Новый блок начинается с строки, содержащей только номер (например: 0, 1, 2 ...)
        if (/^\d+$/.test(line)) {
            // Завершаем предыдущий блок
            pushCurrent();
            current = {};
            continue;
        }

        // Парсим строки вида: key\t"value"
        const tabIdx = line.indexOf('\t');
        if (tabIdx > 0) {
            const key = line.slice(0, tabIdx).trim();
            let value = line.slice(tabIdx + 1).trim();
            // Удаляем возможные обрамляющие кавычки
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (['question', 'answer', 'category', 'subcategory'].includes(key)) {
                if (!current) current = {};
                current[key] = value;
            }
        }
    }

    // Добавляем последний блок, если он завершён
    pushCurrent();
    return items;
}

// Экспортируем функцию
export { loadJsonData };

function parseConcatenatedJsonObjects(text) {
    // Удаляем BOM и лишние пробелы
    const cleaned = text.replace(/^\uFEFF/, '').trim();
    if (!cleaned) return [];

    // Если это уже JSON-массив — попробуем распарсить
    if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
        try {
            const arr = JSON.parse(cleaned);
            return Array.isArray(arr) ? arr : [];
        } catch (_) {
            // игнорируем, пойдём дальше
        }
    }

    // Преобразуем последовательность объектов вида "}{" в ",}{" и оборачиваем в массив
    let transformed = cleaned;
    // Если файл содержит объекты один за другим без запятых и скобок
    if (transformed.startsWith('{') && transformed.endsWith('}')) {
        transformed = `[${transformed.replace(/}\s*\{/g, '},{')}]`;
        try {
            const arr = JSON.parse(transformed);
            return Array.isArray(arr) ? arr : [];
        } catch (_) {
            // Если парсинг не удался, попробуем построчно (NDJSON)
        }
    }

    // NDJSON: одна строка — один объект JSON
    const lines = cleaned.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const result = [];
    let hadAny = false;
    for (const line of lines) {
        if (!(line.startsWith('{') && line.endsWith('}'))) continue;
        try {
            const obj = JSON.parse(line);
            // Валидируем минимальные поля
            if (obj && typeof obj === 'object') {
                result.push(obj);
                hadAny = true;
            }
        } catch (_) {
            // игнорируем строки, которые не удалось распарсить
        }
    }
    return hadAny ? result : [];
}