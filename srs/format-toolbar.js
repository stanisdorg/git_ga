/**
 * format-toolbar.js
 * Компонент панели форматирования текста для редактора карточек
 * 
 * Использование:
 *   import { createFormatToolbar, initFormatToolbar } from './format-toolbar.js';
 * 
 *   // Создать toolbar
 *   const toolbar = createFormatToolbar('question');
 *   container.appendChild(toolbar);
 * 
 *   // Инициализировать с редактором
 *   initFormatToolbar(toolbar, editorElement, formatting, field, onChange);
 */

import {
    COLORS,
    BACKGROUND_COLORS,
    applyColorToSelection,
    applyBackgroundColorToSelection,
    applyStyleToSelection,
    getSelectionFromEditor,
    clearFormatting,
    applyFormatting
} from './text-formatter.js';

/**
 * Создаёт HTML toolbar
 * @param {string} field - 'question', 'answer' или 'both' (общая панель)
 * @returns {HTMLElement} toolbar элемент
 */
export function createFormatToolbar(field) {
    const toolbar = document.createElement('div');
    toolbar.className = 'format-toolbar';
    toolbar.dataset.field = field || 'both';

    // Структура: 2 ряда
    // Ряд 1: 11 кнопок в grid (4 формата + 7 цветов)
    // Ряд 2: 8 кнопок в grid (7 цветов + ✕)
    toolbar.innerHTML = `
        <div class="format-toolbar-row">
            <button class="format-btn" data-action="bold" title="Жирный (Ctrl+B)">
                <strong>B</strong>
            </button>
            <button class="format-btn" data-action="italic" title="Курсив (Ctrl+I)">
                <em>I</em>
            </button>
            <button class="format-btn" data-action="underline" title="Подчёркивание (Ctrl+U)">
                <u>U</u>
            </button>
            <button class="format-btn" data-action="code" title="Код (Ctrl+E)">
                &lt;/&gt;
            </button>
            <button class="format-color-btn format-text-color-btn" data-color="#F5B042" style="background-color: #F5B042" title="Цвет текста #F5B042"></button>
            <button class="format-color-btn format-text-color-btn" data-color="#FF8C42" style="background-color: #FF8C42" title="Цвет текста #FF8C42"></button>
            <button class="format-color-btn format-text-color-btn" data-color="#4ECDC4" style="background-color: #4ECDC4" title="Цвет текста #4ECDC4"></button>
            <button class="format-color-btn format-text-color-btn" data-color="#B794F4" style="background-color: #B794F4" title="Цвет текста #B794F4"></button>
            <button class="format-color-btn format-text-color-btn" data-color="#FF9F7C" style="background-color: #FF9F7C" title="Цвет текста #FF9F7C"></button>
            <button class="format-color-btn format-text-color-btn" data-color="#7FCDCD" style="background-color: #7FCDCD" title="Цвет текста #7FCDCD"></button>
            <button class="format-color-btn format-text-color-btn" data-color="#FF6B6B" style="background-color: #FF6B6B" title="Цвет текста #FF6B6B"></button>
        </div>
        <div class="format-toolbar-row">
            <button class="format-btn format-clear-btn" data-action="clear" title="Очистить всё форматирование">
                ✕
            </button>
            <button class="format-color-btn format-bg-color-btn" data-color="rgba(245, 176, 66, 0.2)" style="background-color: rgba(245, 176, 66, 0.2)" title="Цвет фона"></button>
            <button class="format-color-btn format-bg-color-btn" data-color="rgba(255, 140, 66, 0.2)" style="background-color: rgba(255, 140, 66, 0.2)" title="Цвет фона"></button>
            <button class="format-color-btn format-bg-color-btn" data-color="rgba(78, 205, 196, 0.2)" style="background-color: rgba(78, 205, 196, 0.2)" title="Цвет фона"></button>
            <button class="format-color-btn format-bg-color-btn" data-color="rgba(183, 148, 244, 0.2)" style="background-color: rgba(183, 148, 244, 0.2)" title="Цвет фона"></button>
            <button class="format-color-btn format-bg-color-btn" data-color="rgba(255, 159, 124, 0.2)" style="background-color: rgba(255, 159, 124, 0.2)" title="Цвет фона"></button>
            <button class="format-color-btn format-bg-color-btn" data-color="rgba(127, 205, 205, 0.2)" style="background-color: rgba(127, 205, 205, 0.2)" title="Цвет фона"></button>
            <button class="format-color-btn format-bg-color-btn" data-color="rgba(255, 107, 107, 0.2)" style="background-color: rgba(255, 107, 107, 0.2)" title="Цвет фона"></button>
        </div>
    `;

    return toolbar;
}

/**
 * Инициализирует toolbar с редактором (или двумя редакторами)
 * @param {HTMLElement} toolbar - toolbar элемент
 * @param {HTMLElement} editor1 - первый contenteditable редактор (вопрос)
 * @param {HTMLElement} editor2 - второй contenteditable редактор (ответ, опционально)
 * @param {Object} formatting - текущий formatting объект
 * @param {Function} onChange - callback при изменении форматирования (newFormatting) => void
 */
export function initFormatToolbar(toolbar, editor1, editor2, formatting, onChange) {
    let currentFormatting = formatting || { question: [], answer: [] };
    let currentEditor = null;  // Текущий активный редактор
    let currentField = 'question';  // Текущее поле

    console.log('[FORMAT-TOOLBAR] initFormatToolbar called', { toolbar, editor1, editor2 });
    console.log('[FORMAT-TOOLBAR] Initial formatting:', currentFormatting);

    // 🔍 ЛОГИРОВАНИЕ РАЗМЕРОВ
    setTimeout(() => {
        const rows = toolbar.querySelectorAll('.format-toolbar-row');
        const allBtns = toolbar.querySelectorAll('.format-btn, .format-color-btn');

        const rowData = Array.from(rows).map((row, i) => ({
            row: i + 1,
            width: row.offsetWidth,
            children: row.children.length
        }));
        console.log('[FORMAT-TOOLBAR] 🔵 Размеры рядов:', JSON.stringify(rowData, null, 2));

        const btnData = Array.from(allBtns).map((btn, i) => ({
            index: i,
            width: btn.offsetWidth,
            height: btn.offsetHeight,
            className: btn.className
        }));
        console.log('[FORMAT-TOOLBAR] 🔵 Размеры ВСЕХ кнопок:', JSON.stringify(btnData, null, 2));
    }, 100);

    // Функция для получения актуального formatting (всегда берём свежий)
    function getFormatting() {
        return currentFormatting;
    }

    // Функция для обновления отображения форматирования в редакторе
    function updateEditorVisuals(field) {
        const editor = field === 'question' ? editor1 : editor2;
        const rules = currentFormatting[field] || [];
        const text = editor.innerText;

        console.log('[FORMAT-TOOLBAR] updateEditorVisuals:', {
            field,
            text: text.substring(0, 30),
            rules: JSON.stringify(rules),
            editor: editor?.id
        });

        // Сохраняем позицию курсора
        const selection = window.getSelection();
        let range = null;
        let offset = 0;
        if (selection.rangeCount > 0 && editor.contains(selection.anchorNode)) {
            range = selection.getRangeAt(0);
            offset = range.startOffset;
        }

        // Применяем форматирование
        editor.innerHTML = applyFormatting(text, rules);

        console.log('[FORMAT-TOOLBAR] After applyFormatting:', editor.innerHTML.substring(0, 50));

        // Восстанавливаем курсор (примерно)
        if (range && editor.childNodes.length > 0) {
            try {
                const newRange = document.createRange();
                const textNode = editor.childNodes[0];
                if (textNode.nodeType === Node.TEXT_NODE) {
                    const safeOffset = Math.min(offset, textNode.length);
                    newRange.setStart(textNode, safeOffset);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                }
            } catch (e) {
                console.log('[FORMAT-TOOLBAR] Could not restore selection:', e);
            }
        }
    }

    // Функция для определения текущего редактора по выделению (НЕ по фокусу!)
    function getCurrentEditor() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const commonAncestor = range.commonAncestorContainer;

            // Проверяем, в каком редакторе находится выделение
            if (editor2 && (editor2 === commonAncestor || editor2.contains(commonAncestor))) {
                currentField = 'answer';
                currentEditor = editor2;
                console.log('[FORMAT-TOOLBAR] getCurrentEditor: answer (by selection)');
                return { editor: editor2, field: 'answer' };
            } else if (editor1 === commonAncestor || editor1.contains(commonAncestor)) {
                currentField = 'question';
                currentEditor = editor1;
                console.log('[FORMAT-TOOLBAR] getCurrentEditor: question (by selection)');
                return { editor: editor1, field: 'question' };
            }
        }

        // Если нет выделения, используем последний известный редактор
        console.log('[FORMAT-TOOLBAR] getCurrentEditor: using cached', { field: currentField });
        return { editor: currentEditor, field: currentField };
    }

    // Обработчик фокуса на редакторах (только для кэширования)
    editor1?.addEventListener('focus', () => {
        currentField = 'question';
        currentEditor = editor1;
        console.log('[FORMAT-TOOLBAR] Focus on question editor');
    });

    editor2?.addEventListener('focus', () => {
        currentField = 'answer';
        currentEditor = editor2;
        console.log('[FORMAT-TOOLBAR] Focus on answer editor');
    });

    // Обработчик кнопок форматирования (B, I, U, Code)
    const formatButtons = toolbar.querySelectorAll('.format-btn[data-action]');
    console.log('[FORMAT-TOOLBAR] Format buttons found:', formatButtons.length);

    formatButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const action = btn.dataset.action;
            const { editor, field } = getCurrentEditor();  // Определяем по выделению!
            const currentFmt = getFormatting();

            console.log('[FORMAT-TOOLBAR] Format button clicked:', action, 'field:', field);
            console.log('[FORMAT-TOOLBAR] Before formatting:', currentFmt);

            if (action === 'clear') {
                currentFormatting = clearFormatting(field, currentFmt);
                console.log('[FORMAT-TOOLBAR] After clear:', currentFormatting);
                onChange?.(currentFormatting);
                updateEditorVisuals(field);
                editor?.focus();
                return;
            }

            const selection = getSelectionFromEditor(editor);
            if (!selection || selection.start === selection.end) {
                showToolbarHint('Выделите текст для применения форматирования');
                return;
            }

            currentFormatting = applyStyleToSelection(action, selection.start, selection.end, true, currentFmt[field], field, currentFmt);
            console.log('[FORMAT-TOOLBAR] After applyStyle:', currentFormatting);
            onChange?.(currentFormatting);
            updateEditorVisuals(field);
            editor?.focus();
        });
    });

    // Обработчик кнопок цвета текста
    const textColorButtons = toolbar.querySelectorAll('.format-text-color-btn');
    textColorButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const color = btn.dataset.color || null;
            const { editor, field } = getCurrentEditor();  // Определяем по выделению!
            const currentFmt = getFormatting();

            console.log('[FORMAT-TOOLBAR] Text color button clicked:', {
                color,
                field,
                editorId: editor?.id,
                editor1Id: editor1?.id,
                editor2Id: editor2?.id
            });
            console.log('[FORMAT-TOOLBAR] Before color:', currentFmt);

            const selection = getSelectionFromEditor(editor);
            console.log('[FORMAT-TOOLBAR] Selection:', selection);

            if (!selection || selection.start === selection.end) {
                showToolbarHint('Выделите текст для применения цвета');
                return;
            }

            currentFormatting = applyColorToSelection(selection.start, selection.end, color, currentFmt[field], field, currentFmt);
            console.log('[FORMAT-TOOLBAR] After color:', currentFormatting);
            onChange?.(currentFormatting);
            updateEditorVisuals(field);
            editor?.focus();
        });
    });

    // Обработчик кнопок цвета фона
    const bgColorButtons = toolbar.querySelectorAll('.format-bg-color-btn');
    bgColorButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const backgroundColor = btn.dataset.color || null;
            const { editor, field } = getCurrentEditor();  // Определяем по выделению!
            const currentFmt = getFormatting();

            console.log('[FORMAT-TOOLBAR] BG color button clicked:', backgroundColor, 'field:', field);
            console.log('[FORMAT-TOOLBAR] Before bg color:', currentFmt);

            const selection = getSelectionFromEditor(editor);
            if (!selection || selection.start === selection.end) {
                showToolbarHint('Выделите текст для применения цвета фона');
                return;
            }

            currentFormatting = applyBackgroundColorToSelection(selection.start, selection.end, backgroundColor, currentFmt[field], field, currentFmt);
            console.log('[FORMAT-TOOLBAR] After bg color:', currentFormatting);
            onChange?.(currentFormatting);
            updateEditorVisuals(field);
            editor?.focus();
        });
    });

    // Горячие клавиши
    const setupHotkeys = (editor) => {
        editor?.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'b':
                        e.preventDefault();
                        formatButtons.find(btn => btn.dataset.action === 'bold')?.click();
                        break;
                    case 'i':
                        e.preventDefault();
                        formatButtons.find(btn => btn.dataset.action === 'italic')?.click();
                        break;
                    case 'u':
                        e.preventDefault();
                        formatButtons.find(btn => btn.dataset.action === 'underline')?.click();
                        break;
                    case 'e':
                        e.preventDefault();
                        formatButtons.find(btn => btn.dataset.action === 'code')?.click();
                        break;
                }
            }
        });
    };

    setupHotkeys(editor1);
    setupHotkeys(editor2);

    console.log('[FORMAT-TOOLBAR] Toolbar initialized successfully');
}

/**
 * Показывает подсказку в toolbar
 */
function showToolbarHint(message) {
    // Удаляем старую подсказку если есть
    const existing = document.querySelector('.format-toolbar-hint');
    if (existing) existing.remove();

    const hint = document.createElement('div');
    hint.className = 'format-toolbar-hint';
    hint.textContent = message;
    hint.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%) translateY(10px);
        background: rgba(0, 0, 0, 0.85);
        color: white;
        padding: 10px 16px;
        border-radius: 6px;
        font-size: 14px;
        z-index: 100000;
        opacity: 0;
        transition: all 0.2s ease-out;
    `;

    document.body.appendChild(hint);

    // Показываем
    requestAnimationFrame(() => {
        hint.style.opacity = '1';
        hint.style.transform = 'translateX(-50%) translateY(0)';
    });

    // Скрываем через 2 секунды
    setTimeout(() => {
        hint.style.opacity = '0';
        hint.style.transform = 'translateX(-50%) translateY(10px)';
        setTimeout(() => hint.remove(), 200);
    }, 2000);
}

/**
 * Обновляет состояние toolbar (активные кнопки)
 * @param {HTMLElement} toolbar - toolbar элемент
 * @param {Object} formatting - formatting объект
 * @param {string} field - 'question' или 'answer'
 */
export function updateToolbarState(toolbar, formatting, field) {
    // TODO: можно добавить подсветку активных кнопок
    // для этого нужно отслеживать текущую позицию курсора
    // и проверять какие стили к нему применяются
}
