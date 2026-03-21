import re

with open('srs/stats-ui.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Удаляем первую кнопку (перед .st-main)
content = re.sub(
    r'\n\s*<!-- Кнопка продолжить на всю ширину -->\s*\n\s*<button class="st-cta-btn st-continue-mobile" id="st-continue-btn"[^>]*>.*?</button>\s*\n',
    '\n',
    content,
    flags=re.DOTALL
)

with open('srs/stats-ui.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done - первая кнопка удалена')
