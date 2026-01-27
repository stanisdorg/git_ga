// Построение списка категорий/подкатегорий по данным

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-а-яё]/g, '');
}

export function buildCategoriesFromData(data) {
  const map = new Map();
  data.forEach(item => {
    const cat = item.category || 'Без категории';
    const sub = item.subcategory || 'Общее';
    if (!map.has(cat)) {
      map.set(cat, new Set());
    }
    map.get(cat).add(sub);
  });

  // Добавляем плейсхолдеры из localStorage, чтобы можно было создавать категории/подкатегории до наличия карточек
  try {
    const placeholders = JSON.parse(localStorage.getItem('qaCategoryPlaceholders') || '[]');
    const subPlaceholders = JSON.parse(localStorage.getItem('qaSubcategoryPlaceholders') || '{}');
    if (Array.isArray(placeholders)) {
      placeholders.forEach(catName => {
        if (!map.has(catName)) map.set(catName, new Set());
        const subs = subPlaceholders[catName];
        if (Array.isArray(subs)) {
          subs.forEach(s => map.get(catName).add(s || 'Общее'));
        } else {
          // Если нет подкатегорий-плейсхолдеров, гарантируем хотя бы 'Общее'
          map.get(catName).add('Общее');
        }
      });
    }
  } catch (_) {}

  const categories = [];
  let catId = 1;
  for (const [catName, subSet] of map.entries()) {
    const subcategories = [];
    let subId = 1;
    for (const subName of Array.from(subSet).sort((a, b) => a.localeCompare(b))) {
      subcategories.push({ id: subId++, name: subName, slug: slugify(subName) });
    }
    categories.push({ id: catId++, name: catName, displayName: catName, slug: slugify(catName), subcategories });
  }
  // Сортируем категории по имени для стабильности
  categories.sort((a, b) => a.name.localeCompare(b.name));
  // Перепризначаем id после сортировки
  categories.forEach((c, idx) => (c.id = idx + 1));
  return categories;
}
