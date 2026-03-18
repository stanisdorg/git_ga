import re

with open('srs/stats-ui.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Удаляем кнопку из старого места (перед .st-main)
content = re.sub(
    r'      <!-- Кнопка продолжить на всю ширину -->\s*<button class="st-cta-btn st-continue-mobile" id="st-continue-btn" onclick="window\.startDailySession\(\)">.*?</button>\s*\n\s*\n      <div class="st-main">',
    r'      <div class="st-main">',
    content,
    flags=re.DOTALL
)

with open('srs/stats-ui.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')
