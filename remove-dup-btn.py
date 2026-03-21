import re

with open('srs/stats-ui.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Находим и удаляем дублирующуюся кнопку (первую)
# Паттерн: <!-- Кнопка продолжить на всю ширину --> + кнопка + пустая строка
pattern = r'\s*<!-- Кнопка продолжить на всю ширину -->\s*<button class="st-cta-btn st-continue-mobile" id="st-continue-btn" onclick="window\.startDailySession\(\)">.*?</button>\s*\n'

# Заменяем на пустую строку
content = re.sub(pattern, '\n', content, flags=re.DOTALL)

with open('srs/stats-ui.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done - duplicate button removed')
