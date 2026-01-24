// Простейшая админ-панель: добавление новых карточек и управление overrides
import { uniqueQaData } from './all-data.js';
import { generateTestStats } from './admin-data-generator.js';

export function initAdminPanel() {
  const params = new URLSearchParams(window.location.search);
  // Работает только на localhost/127.0.0.1 ИЛИ если в URL есть ?admin=true
  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const forceAdmin = params.get('admin') === 'true' || params.get('admin') === '1';

  if (!isLocal && !forceAdmin) return;
  // Возможность скрыть панель даже на localhost: добавьте ?admin=0
  if (params.get('admin') === '0') return;

  // Если панель уже создана — выходим
  if (document.querySelector('.admin-panel')) return;

  const container = document.querySelector('.container') || document.body;
  const panel = document.createElement('div');
  panel.className = 'admin-panel';
  panel.style.cssText = `
    position: sticky;
    top: 8px;
    z-index: 50;
    background: #1e1e1e;
    border: 1px solid #444;
    border-radius: 6px;
    padding: 8px;
    margin-bottom: 8px;
    color: #ddd;
  `;

  panel.innerHTML = `
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:flex-start;">
      <input type="text" id="ap-question" placeholder="Вопрос" style="flex:1;min-width:200px;" />
      <input type="text" id="ap-answer" placeholder="Ответ" style="flex:1;min-width:200px;" />
      <input type="text" id="ap-category" placeholder="Категория" style="width:160px;" />
      <input type="text" id="ap-subcategory" placeholder="Подкатегория" style="width:160px;" />
      <button id="ap-add" title="Добавить карточку">Добавить</button>
    </div>
    <div style="display:flex;gap:6px;margin-top:6px;">
      <button id="ap-clear-overrides" title="Сбросить overrides">Сбросить overrides</button>
      <button id="ap-clear-newitems" title="Сбросить новые карточки">Сбросить новые</button>
      <button id="ap-export-json" title="Экспорт текущих данных в JSON">Экспорт JSON</button>
      <button id="ap-gen-stats" title="Сгенерировать тестовую статистику">Gen Stats</button>
    </div>
  `;

  container.insertBefore(panel, container.firstChild);

  const qEl = panel.querySelector('#ap-question');
  const aEl = panel.querySelector('#ap-answer');
  const cEl = panel.querySelector('#ap-category');
  const sEl = panel.querySelector('#ap-subcategory');
  const addBtn = panel.querySelector('#ap-add');
  const clearOverridesBtn = panel.querySelector('#ap-clear-overrides');
  const clearNewItemsBtn = panel.querySelector('#ap-clear-newitems');
  const exportBtn = panel.querySelector('#ap-export-json');
  const genStatsBtn = panel.querySelector('#ap-gen-stats');

  genStatsBtn.addEventListener('click', () => {
     if (confirm('Сгенерировать тестовую статистику в SUPABASE за 6 месяцев? Это перезапишет данные в облаке для вашего пользователя.')) {
         generateTestStats();
     }
   });

  addBtn.addEventListener('click', () => {
    const question = qEl.value.trim();
    const answer = aEl.value.trim();
    const category = cEl.value.trim();
    const subcategory = sEl.value.trim();
    if (!question || !answer) {
      alert('Заполните поля Вопрос и Ответ');
      return;
    }
    const item = {
      id: Date.now(),
      question,
      answer,
      category: category || 'Без категории',
      subcategory: subcategory || 'Общее'
    };
    try {
      const arr = JSON.parse(localStorage.getItem('qaAdminNewItems') || '[]');
      arr.push(item);
      localStorage.setItem('qaAdminNewItems', JSON.stringify(arr));
      // Очистка
      qEl.value = '';
      aEl.value = '';
      cEl.value = '';
      sEl.value = '';
      // Сообщаем системе
      window.dispatchEvent(new Event('adminItemAdded'));
    } catch (e) {
      console.warn('Не удалось сохранить новую карточку:', e);
    }
  });

  clearOverridesBtn.addEventListener('click', () => {
    localStorage.removeItem('qaAdminOverrides');
    window.dispatchEvent(new Event('adminOverridesChanged'));
  });

  clearNewItemsBtn.addEventListener('click', () => {
    localStorage.removeItem('qaAdminNewItems');
    window.dispatchEvent(new Event('adminItemAdded'));
  });

  // Экспорт JSON: выгружаем актуальный массив данных (с учетом overrides/new items)
  exportBtn.addEventListener('click', () => {
    try {
      const dataToExport = uniqueQaData && Array.isArray(uniqueQaData) ? uniqueQaData : [];
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Копия вопросы.normalized.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed', err);
      alert('Не удалось экспортировать JSON. См. консоль для деталей.');
    }
  });
}
