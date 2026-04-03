/**
 * text-formatter.js
 * Модуль для работы с форматированием текста (цвета, фон, жирный, курсив, подчёркивание, код)
 * 
 * Структура formatting:
 * {
 *   question: [ { start, end, color, backgroundColor, bold, italic, underline, code }, ... ],
 *   answer: [ { start, end, color, backgroundColor, bold, italic, underline, code }, ... ]
 * }
 */

// Цвета для форматирования
export const COLORS = [
    '#F5B042',  // оранжевый
    '#FF8C42',  // тёмно-оранжевый
    '#4ECDC4',  // бирюза
    '#B794F4',  // фиолетовый
    '#FF9F7C',  // коралловый
    '#7FCDCD',  // мята
    '#FF6B6B',  // красный
];

// Фоновые цвета (те же, но с прозрачностью для лучшей читаемости)
export const BACKGROUND_COLORS = [
    'rgba(245, 176, 66, 0.2)',   // оранжевый
    'rgba(255, 140, 66, 0.2)',   // тёмно-оранжевый
    'rgba(78, 205, 196, 0.2)',   // бирюза
    'rgba(183, 148, 244, 0.2)',  // фиолетовый
    'rgba(255, 159, 124, 0.2)',  // коралловый
    'rgba(127, 205, 205, 0.2)',  // мята
    'rgba(255, 107, 107, 0.2)',  // красный
];

/**
 * Создаёт пустую структуру formatting
 */
export function createEmptyFormatting() {
    return {
        question: [],
        answer: []
    };
}

/**
 * Применяет форматирование к тексту, возвращает HTML
 * @param {string} text - чистый текст
 * @param {Array} rules - массив правил форматирования [{start, end, color, backgroundColor, bold, italic, underline, code}]
 * @returns {string} HTML с применённым форматированием
 */
export function applyFormatting(text, rules = []) {
    if (!text || !rules || rules.length === 0) {
        return escapeHtml(text);
    }

    // Создаём массив "символов" с их стилями
    const chars = text.split('').map(char => ({
        char,
        styles: {
            color: null,
            backgroundColor: null,
            bold: false,
            italic: false,
            underline: false,
            code: false
        }
    }));

    // Применяем каждое правило к соответствующим символам
    rules.forEach(rule => {
        const start = Math.max(0, rule.start || 0);
        const end = Math.min(chars.length, rule.end || 0);

        for (let i = start; i < end; i++) {
            if (rule.color !== undefined && rule.color !== null) {
                chars[i].styles.color = rule.color;
            }
            if (rule.backgroundColor !== undefined && rule.backgroundColor !== null) {
                chars[i].styles.backgroundColor = rule.backgroundColor;
            }
            if (rule.bold !== undefined) {
                chars[i].styles.bold = rule.bold;
            }
            if (rule.italic !== undefined) {
                chars[i].styles.italic = rule.italic;
            }
            if (rule.underline !== undefined) {
                chars[i].styles.underline = rule.underline;
            }
            if (rule.code !== undefined) {
                chars[i].styles.code = rule.code;
            }
        }
    });

    // Генерируем HTML, объединяя символы с одинаковыми стилями
    return generateHtmlFromChars(chars);
}

/**
 * Генерирует HTML из массива символов со стилями
 */
function generateHtmlFromChars(chars) {
    if (chars.length === 0) return '';

    const segments = [];
    let currentSegment = {
        styles: { ...chars[0].styles },
        text: chars[0].char
    };

    for (let i = 1; i < chars.length; i++) {
        const char = chars[i];
        const isSameStyle = (
            char.styles.color === currentSegment.styles.color &&
            char.styles.backgroundColor === currentSegment.styles.backgroundColor &&
            char.styles.bold === currentSegment.styles.bold &&
            char.styles.italic === currentSegment.styles.italic &&
            char.styles.underline === currentSegment.styles.underline &&
            char.styles.code === currentSegment.styles.code
        );

        if (isSameStyle) {
            currentSegment.text += char.char;
        } else {
            segments.push({ ...currentSegment });
            currentSegment = {
                styles: { ...char.styles },
                text: char.char
            };
        }
    }
    segments.push(currentSegment);

    // Преобразуем сегменты в HTML
    return segments.map(segment => {
        const { styles, text } = segment;
        const escapedText = escapeHtml(text);

        // Если нет стилей — возвращаем просто текст
        if (!styles.color && !styles.backgroundColor && !styles.bold && 
            !styles.italic && !styles.underline && !styles.code) {
            return escapedText;
        }

        // Строим тег с стилями
        const styleParts = [];
        if (styles.color) styleParts.push(`color: ${styles.color}`);
        if (styles.backgroundColor) styleParts.push(`background-color: ${styles.backgroundColor}`);
        if (styles.bold) styleParts.push('font-weight: bold');
        if (styles.italic) styleParts.push('font-style: italic');
        if (styles.underline) styleParts.push('text-decoration: underline');
        if (styles.code) styleParts.push('font-family: monospace; background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 3px;');

        const styleAttr = styleParts.length > 0 ? ` style="${styleParts.join('; ')}"` : '';
        const tagName = styles.code ? 'code' : 'span';

        return `<${tagName}${styleAttr}>${escapedText}</${tagName}>`;
    }).join('');
}

/**
 * Экранирует HTML-символы
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Получает форматирование для выделенного текста
 * @param {number} start - позиция начала выделения
 * @param {number} end - позиция конца выделения
 * @param {Array} existingRules - существующие правила
 * @returns {Object} текущие стили выделения
 */
export function getSelectionStyles(start, end, existingRules = []) {
    const styles = {
        color: null,
        backgroundColor: null,
        bold: false,
        italic: false,
        underline: false,
        code: false
    };

    // Проверяем все правила, которые пересекаются с выделением
    existingRules.forEach(rule => {
        const ruleStart = rule.start || 0;
        const ruleEnd = rule.end || 0;

        // Если есть пересечение
        if (start < ruleEnd && end > ruleStart) {
            if (rule.color !== undefined && rule.color !== null) {
                styles.color = rule.color;
            }
            if (rule.backgroundColor !== undefined && rule.backgroundColor !== null) {
                styles.backgroundColor = rule.backgroundColor;
            }
            if (rule.bold !== undefined) {
                styles.bold = rule.bold;
            }
            if (rule.italic !== undefined) {
                styles.italic = rule.italic;
            }
            if (rule.underline !== undefined) {
                styles.underline = rule.underline;
            }
            if (rule.code !== undefined) {
                styles.code = rule.code;
            }
        }
    });

    return styles;
}

/**
 * Применяет цвет к выделению
 */
export function applyColorToSelection(start, end, color, existingRules = [], field, formatting) {
    const fieldRules = formatting[field] || [];
    const newRules = [];
    const segments = splitRulesIntoSegments(fieldRules, start, end);

    segments.forEach(segment => {
        const segStart = segment.start;
        const segEnd = segment.end;
        const styles = { ...segment.styles };
        const isInSelection = segStart >= start && segEnd <= end;

        if (isInSelection) {
            if (color !== null) {
                styles.color = color;
            } else {
                delete styles.color;
            }
        }

        if (hasStyles(styles)) {
            newRules.push({
                start: segStart,
                end: segEnd,
                ...styles
            });
        }
    });

    newRules.sort((a, b) => a.start - b.start);
    const mergedRules = mergeRules(newRules);

    return {
        ...formatting,
        [field]: mergedRules
    };
}

/**
 * Применяет цвет фона к выделению
 */
export function applyBackgroundColorToSelection(start, end, backgroundColor, existingRules = [], field, formatting) {
    const fieldRules = formatting[field] || [];
    const newRules = [];
    const segments = splitRulesIntoSegments(fieldRules, start, end);

    segments.forEach(segment => {
        const segStart = segment.start;
        const segEnd = segment.end;
        const styles = { ...segment.styles };
        const isInSelection = segStart >= start && segEnd <= end;

        if (isInSelection) {
            if (backgroundColor !== null) {
                styles.backgroundColor = backgroundColor;
            } else {
                delete styles.backgroundColor;
            }
        }

        if (hasStyles(styles)) {
            newRules.push({
                start: segStart,
                end: segEnd,
                ...styles
            });
        }
    });

    newRules.sort((a, b) => a.start - b.start);
    const mergedRules = mergeRules(newRules);

    return {
        ...formatting,
        [field]: mergedRules
    };
}

/**
 * Применяет стиль (жирный/курсив/подчёркивание/код) к выделению
 */
export function applyStyleToSelection(styleName, start, end, value, existingRules = [], field, formatting) {
    const fieldRules = formatting[field] || [];
    const newRules = [];
    const segments = splitRulesIntoSegments(fieldRules, start, end);

    segments.forEach(segment => {
        const segStart = segment.start;
        const segEnd = segment.end;
        const styles = { ...segment.styles };
        const isInSelection = segStart >= start && segEnd <= end;

        if (isInSelection) {
            styles[styleName] = value;
        }

        if (hasStyles(styles)) {
            newRules.push({
                start: segStart,
                end: segEnd,
                ...styles
            });
        }
    });

    newRules.sort((a, b) => a.start - b.start);
    const mergedRules = mergeRules(newRules);

    return {
        ...formatting,
        [field]: mergedRules
    };
}

/**
 * Разбивает правила на сегменты для точного применения стилей
 * Создаёт сегменты ТОЛЬКО для областей внутри нового выделения + существующие правила
 */
function splitRulesIntoSegments(existingRules, newStart, newEnd) {
    const segments = [];

    if (!existingRules || existingRules.length === 0) {
        return [{
            start: newStart,
            end: newEnd,
            styles: {}
        }];
    }

    const points = new Set([0, newStart, newEnd]);
    existingRules.forEach(rule => {
        points.add(rule.start || 0);
        points.add(rule.end || 0);
    });

    const sortedPoints = Array.from(points).sort((a, b) => a - b);

    for (let i = 0; i < sortedPoints.length - 1; i++) {
        const segStart = sortedPoints[i];
        const segEnd = sortedPoints[i + 1];

        if (segStart >= segEnd) continue;

        const isInNewSelection = segStart >= newStart && segEnd <= newEnd;

        const styles = {};
        let hasExistingStyles = false;

        existingRules.forEach(rule => {
            const ruleStart = rule.start || 0;
            const ruleEnd = rule.end || 0;

            if (segStart >= ruleStart && segEnd <= ruleEnd) {
                if (rule.color !== undefined) { styles.color = rule.color; hasExistingStyles = true; }
                if (rule.backgroundColor !== undefined) { styles.backgroundColor = rule.backgroundColor; hasExistingStyles = true; }
                if (rule.bold !== undefined) { styles.bold = rule.bold; hasExistingStyles = true; }
                if (rule.italic !== undefined) { styles.italic = rule.italic; hasExistingStyles = true; }
                if (rule.underline !== undefined) { styles.underline = rule.underline; hasExistingStyles = true; }
                if (rule.code !== undefined) { styles.code = rule.code; hasExistingStyles = true; }
            }
        });

        if (isInNewSelection || hasExistingStyles) {
            segments.push({
                start: segStart,
                end: segEnd,
                styles
            });
        }
    }

    if (segments.length === 0) {
        segments.push({
            start: newStart,
            end: newEnd,
            styles: {}
        });
    }

    return segments;
}

/**
 * Проверяет, есть ли в объекте стили
 */
function hasStyles(styles) {
    return !!(
        styles.color ||
        styles.backgroundColor ||
        styles.bold ||
        styles.italic ||
        styles.underline ||
        styles.code
    );
}

/**
 * Объединяет соседние правила с одинаковыми стилями
 */
function mergeRules(rules) {
    if (rules.length === 0) return [];

    const merged = [];
    let current = { ...rules[0] };

    for (let i = 1; i < rules.length; i++) {
        const rule = rules[i];

        const isSameStyle = (
            rule.color === current.color &&
            rule.backgroundColor === current.backgroundColor &&
            rule.bold === current.bold &&
            rule.italic === current.italic &&
            rule.underline === current.underline &&
            rule.code === current.code &&
            rule.end === current.end
        );

        if (isSameStyle && rule.start === current.end) {
            // Объединяем
            current.end = rule.end;
        } else {
            merged.push(current);
            current = { ...rule };
        }
    }

    merged.push(current);
    return merged;
}

/**
 * Удаляет всё форматирование в поле
 */
export function clearFormatting(field, formatting) {
    return {
        ...formatting,
        [field]: []
    };
}

/**
 * Получает выделение из contenteditable элемента
 * @param {HTMLElement} editor - contenteditable элемент
 * @returns {Object|null} { start, end, text } или null если нет выделения
 */
export function getSelectionFromEditor(editor) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return null;
    }

    const range = selection.getRangeAt(0);

    // Проверяем, что выделение внутри редактора
    if (!editor.contains(range.commonAncestorContainer)) {
        return null;
    }

    // Получаем текст до курсора/выделения
    const preRangeRange = range.cloneRange();
    preRangeRange.selectNodeContents(editor);
    preRangeRange.setEnd(range.startContainer, range.startOffset);

    const start = preRangeRange.toString().length;
    const end = start + range.toString().length;
    const text = range.toString();

    return { start, end, text };
}

/**
 * Восстанавливает выделение в contenteditable после изменений
 */
export function restoreSelectionInEditor(editor, start, end) {
    const selection = window.getSelection();
    const range = document.createRange();

    // Находим текстовый узел по позиции
    const textNode = findTextNodeAtPosition(editor, start);
    if (!textNode) return;

    try {
        range.setStart(textNode.node, textNode.offset);
        range.setEnd(textNode.node, textNode.offset + (end - start));
        selection.removeAllRanges();
        selection.addRange(range);
    } catch (e) {
        console.warn('[text-formatter] Не удалось восстановить выделение:', e);
    }
}

/**
 * Находит текстовый узел и смещение по абсолютной позиции в тексте
 */
function findTextNodeAtPosition(editor, targetPosition) {
    let currentPos = 0;
    const textNodes = [];

    // Собираем все текстовые узлы
    const walker = document.createTreeWalker(
        editor,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    let node;
    while ((node = walker.nextNode())) {
        const nodeLength = node.textContent.length;
        textNodes.push({ node, start: currentPos, end: currentPos + nodeLength });
        currentPos += nodeLength;
    }

    // Находим нужный узел
    for (const textNode of textNodes) {
        if (targetPosition >= textNode.start && targetPosition <= textNode.end) {
            return {
                node: textNode.node,
                offset: targetPosition - textNode.start
            };
        }
    }

    // Если не нашли точно, возвращаем последний узел
    if (textNodes.length > 0) {
        const last = textNodes[textNodes.length - 1];
        return { node: last.node, offset: last.node.textContent.length };
    }

    return null;
}

/**
 * Конвертирует HTML из contenteditable в чистый текст + formatting
 * @param {string} html - HTML из contenteditable
 * @returns {Object} { text, formatting }
 */
export function convertHtmlToTextAndFormatting(html) {
    // Создаём временный элемент для парсинга
    const temp = document.createElement('div');
    temp.innerHTML = html;

    let text = '';
    const rules = [];
    let currentPos = 0;

    // Рекурсивно обходим узлы
    function processNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent;
            currentPos += node.textContent.length;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const styles = parseStylesFromElement(node);

            if (hasStyles(styles)) {
                const start = currentPos;
                // Обрабатываем детей
                Array.from(node.childNodes).forEach(child => processNode(child));
                const end = currentPos;

                if (end > start) {
                    rules.push({
                        start,
                        end,
                        ...styles
                    });
                }
            } else {
                Array.from(node.childNodes).forEach(child => processNode(child));
            }
        }
    }

    Array.from(temp.childNodes).forEach(child => processNode(child));

    return {
        text,
        formatting: rules
    };
}

/**
 * Парсит стили из HTML элемента
 */
function parseStylesFromElement(element) {
    const styles = {};

    if (element instanceof HTMLElement) {
        const computedStyle = window.getComputedStyle(element);

        // Цвет текста
        const color = element.style.color || computedStyle.color;
        if (color && color !== 'rgb(0, 0, 0)' && color !== '#000000') {
            styles.color = rgbToHex(color);
        }

        // Цвет фона
        const backgroundColor = element.style.backgroundColor || computedStyle.backgroundColor;
        if (backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'transparent') {
            styles.backgroundColor = rgbToHex(backgroundColor);
        }

        // Жирный
        const fontWeight = parseInt(computedStyle.fontWeight);
        styles.bold = fontWeight >= 700 || element.style.fontWeight === 'bold';

        // Курсив
        styles.italic = computedStyle.fontStyle === 'italic' || element.style.fontStyle === 'italic';

        // Подчёркивание
        styles.underline = computedStyle.textDecoration.includes('underline') || 
                          element.style.textDecoration.includes('underline');

        // Код
        styles.code = element.tagName === 'CODE' || 
                     computedStyle.fontFamily.includes('monospace') ||
                     element.style.fontFamily.includes('monospace');
    }

    return hasStyles(styles) ? styles : {};
}

/**
 * Конвертирует RGB в HEX
 */
function rgbToHex(rgb) {
    if (!rgb || rgb.startsWith('#')) return rgb;

    const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return rgb;

    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);

    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Применяет форматирование к contenteditable элементу
 * @param {HTMLElement} editor - contenteditable элемент
 * @param {string} text - чистый текст
 * @param {Array} rules - правила форматирования
 */
export function renderFormattingInEditor(editor, text, rules = []) {
    const html = applyFormatting(text, rules);
    editor.innerHTML = html;
}
