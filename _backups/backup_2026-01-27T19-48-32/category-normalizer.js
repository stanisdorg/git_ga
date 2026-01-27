// Утилита нормализации категорий и подкатегорий

// Карта преобразований категорий к более логичным, близким к copy.json
const categoryMap = {
  'Архитектура клиент-серверная': 'Технические вопросы',
  'HTTP и методы': 'Технические вопросы',
  'CI/CD': 'Технические вопросы',
  'Жизненный цикл': 'Процесс тестирования'
};

// Ключевые слова для подкатегорий, если нужно уточнить по тексту
const subcategoryKeywords = [
  { match: ['REST'], subcategory: 'REST' },
  { match: ['HTTP', 'хэдер', 'метод', 'коды ошибок'], subcategory: 'HTTP' },
  { match: ['JSON', 'XML'], subcategory: 'JSON и XML' },
  { match: ['SSL', 'TLS'], subcategory: 'Безопасность' },
  { match: ['DHCP', 'TCP', 'UDP', 'DNS'], subcategory: 'Сетевые протоколы' },
  { match: ['клиент-сервер'], subcategory: 'Клиент-сервер' },
  { match: ['API', 'контракт'], subcategory: 'API' },
  { match: ['пайплайн', 'Jenkins', 'GitLab', 'CI/CD'], subcategory: 'CI/CD' },
  { match: ['релиз'], subcategory: 'Релизы' },
  { match: ['баг'], subcategory: 'Баг-репорты' }
];

function inferSubcategoryFromText(question, answer) {
  const text = `${question} ${answer}`.toLowerCase();
  for (const rule of subcategoryKeywords) {
    if (rule.match.some(k => text.includes(k.toLowerCase()))) {
      return rule.subcategory;
    }
  }
  return null;
}

export function normalizeEntry(entry) {
  const normalized = { ...entry };

  // Нормализуем категорию
  if (normalized.category && categoryMap[normalized.category]) {
    normalized.category = categoryMap[normalized.category];
  }

  // Не перезаписываем явную подкатегорию из данных сервера.
  // Инференс по ключевым словам применяем ТОЛЬКО если подкатегория отсутствует или пуста.
  const hasExplicitSubcategory = typeof normalized.subcategory === 'string' && normalized.subcategory.trim().length > 0;
  if (!hasExplicitSubcategory) {
    const inferred = inferSubcategoryFromText(entry.question || '', entry.answer || '');
    if (inferred) {
      normalized.subcategory = inferred;
    }
  }

  return normalized;
}

export function normalizeDataset(dataset) {
  return dataset.map(normalizeEntry);
}
