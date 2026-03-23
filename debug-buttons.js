// Логирование стилей для кнопок навигации и блока прогресса
(function() {
    console.log('=== НАЧАЛО ЛОГИРОВАНИЯ СТИЛЕЙ ===');
    
    function logStyles() {
        const buttons = document.querySelectorAll('.top-actions-bar .nav-icon-btn');
        const topActionsBar = document.querySelector('.top-actions-bar');
        
        console.log('--- top-actions-bar стили ---');
        if (topActionsBar) {
            const computed = window.getComputedStyle(topActionsBar);
            console.log('display:', computed.display);
            console.log('justify-content:', computed.justifyContent);
            console.log('gap:', computed.gap);
            console.log('padding:', computed.padding);
            console.log('width:', computed.width);
        } else {
            console.log('.top-actions-bar не найден!');
        }
        
        console.log('--- Кнопки nav-icon-btn ---');
        buttons.forEach((btn, index) => {
            const computed = window.getComputedStyle(btn);
            console.log(`Кнопка ${index + 1}:`, btn.title || 'без title');
            console.log('  padding:', computed.padding);
            console.log('  margin:', computed.margin);
            console.log('  gap:', computed.gap);
            console.log('  display:', computed.display);
            console.log('  width:', computed.width);
            console.log('  min-width:', computed.minWidth);
        });
        
        console.log('--- Блок прогресса (stc-content) ---');
        const stcContent = document.querySelector('.stc-content');
        if (stcContent) {
            const computed = window.getComputedStyle(stcContent);
            console.log('display:', computed.display);
            console.log('justify-content:', computed.justifyContent);
            console.log('gap:', computed.gap);
            console.log('flex-wrap:', computed.flexWrap);
            console.log('flex-direction:', computed.flexDirection);
            
            const stcBlockTitle = stcContent.querySelector('.stc-block-title');
            if (stcBlockTitle) {
                const titleComputed = window.getComputedStyle(stcBlockTitle);
                console.log('--- stc-block-title ---');
                console.log('  white-space:', titleComputed.whiteSpace);
                console.log('  flex-shrink:', titleComputed.flexShrink);
                console.log('  min-width:', titleComputed.minWidth);
                console.log('  width:', titleComputed.width);
            }
            
            const stcForecast = stcContent.querySelector('.stc-forecast-text');
            if (stcForecast) {
                const forecastComputed = window.getComputedStyle(stcForecast);
                console.log('--- stc-forecast-text ---');
                console.log('  white-space:', forecastComputed.whiteSpace);
                console.log('  flex-shrink:', forecastComputed.flexShrink);
                console.log('  min-width:', forecastComputed.minWidth);
            }
            
            const stcInfoBtn = stcContent.querySelector('.st-info-btn');
            if (stcInfoBtn) {
                const btnComputed = window.getComputedStyle(stcInfoBtn);
                console.log('--- st-info-btn ---');
                console.log('  width:', btnComputed.width);
                console.log('  min-width:', btnComputed.minWidth);
                console.log('  flex-shrink:', btnComputed.flexShrink);
            }
        } else {
            console.log('.stc-content не найден!');
        }
        
        console.log('=== КОНЕЦ ЛОГИРОВАНИЯ ===\n');
    }
    
    // Запускаем после загрузки страницы
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(logStyles, 500);
        });
    } else {
        setTimeout(logStyles, 500);
    }
    
    // Также логируем при изменении размера окна
    window.addEventListener('resize', () => {
        console.log('>>> RESIZE detected, ширина:', window.innerWidth);
        setTimeout(logStyles, 100);
    });
    
    // Делаем функцию доступной для ручного вызова в консоли
    window.logButtonStyles = logStyles;
    console.log('Для повторного запуска введите: logButtonStyles()');
    
    // === ФИКС для stc-content ===
    // Удаляем проблемные inline-стили после загрузки
    function fixStcContent() {
        const stcContent = document.querySelector('.stc-content');
        if (stcContent) {
            const style = stcContent.style;
            // Переопределяем проблемные inline-стили
            style.setProperty('justify-content', 'flex-start', 'important');
            style.setProperty('gap', '4px', 'important');
            style.setProperty('flex-wrap', 'nowrap', 'important');
            console.log('[FIX] stc-content исправлен');
        }
        
        const stcBlockTitle = document.querySelector('.stc-block-title');
        if (stcBlockTitle) {
            const style = stcBlockTitle.style;
            style.setProperty('white-space', 'normal', 'important');
            style.setProperty('font-size', '11px', 'important');
            style.setProperty('flex-shrink', '1', 'important');
            style.setProperty('min-width', '0', 'important');
            console.log('[FIX] stc-block-title исправлен');
        }
        
        const stcForecast = document.querySelector('.stc-forecast-text');
        if (stcForecast) {
            const style = stcForecast.style;
            style.setProperty('font-size', '8px', 'important');
            style.setProperty('white-space', 'nowrap', 'important');
            style.setProperty('flex-shrink', '0', 'important');
            style.setProperty('margin-left', 'auto', 'important');
            style.setProperty('display', 'flex', 'important');
            style.setProperty('align-items', 'center', 'important');
            style.setProperty('gap', '2px', 'important');
            style.setProperty('line-height', '1', 'important');
            console.log('[FIX] stc-forecast-text исправлен');
        }

        // Обновляем stc-block-title (второе исправление)
        if (stcBlockTitle) {
            const style = stcBlockTitle.style;
            style.setProperty('font-size', '10px', 'important');
            style.setProperty('white-space', 'normal', 'important');
            style.setProperty('flex-shrink', '1', 'important');
            style.setProperty('min-width', '0', 'important');
            style.setProperty('line-height', '1', 'important');
            console.log('[FIX] stc-block-title исправлен (обновление)');
        }
        
        const stcInfoBtn = document.querySelector('.stc-forecast-text .st-info-btn');
        if (stcInfoBtn) {
            const style = stcInfoBtn.style;
            style.setProperty('flex-shrink', '0', 'important');
            style.setProperty('min-width', '18px', 'important');
            style.setProperty('min-height', '18px', 'important');
            style.setProperty('max-width', '18px', 'important');
            style.setProperty('max-height', '18px', 'important');
            style.setProperty('font-size', '11px', 'important');
            style.setProperty('margin-left', '0', 'important');
            style.setProperty('line-height', '1', 'important');
            console.log('[FIX] st-info-btn исправлен');
        }
    }
    
    // Запускаем фикс после загрузки и с задержкой
    setTimeout(fixStcContent, 600);
    setTimeout(fixStcContent, 1500); // Повторный фикс
    window.fixStcContent = fixStcContent;
    console.log('Для ручного фикса введите: fixStcContent()');
})();
