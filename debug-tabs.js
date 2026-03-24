// Debug: логирование стилей для табов и контейнеров
(function() {
    console.log('[DEBUG-TABS] Debug script loaded');
    
    // Логирование после загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', logTabStyles);
    } else {
        logTabStyles();
    }
    
    function logTabStyles() {
        console.log('[DEBUG-TABS] DOMContentLoaded, starting style analysis');
        
        // Ждём немного, чтобы стили применились
        setTimeout(() => {
            const tabsHeader = document.querySelector('.tabs-header');
            const tabsContainer = document.querySelector('.tabs-container');
            const topActionsBar = document.querySelector('.top-actions-bar');
            const appWrapper = document.querySelector('.app-wrapper');
            
            console.log('[DEBUG-TABS] === PARENT ELEMENTS ===');
            console.log('[DEBUG-TABS] .tabs-header:', tabsHeader);
            console.log('[DEBUG-TABS] .tabs-header styles:', tabsHeader ? {
                overflow: window.getComputedStyle(tabsHeader).overflow,
                overflowY: window.getComputedStyle(tabsHeader).overflowY,
                overflowX: window.getComputedStyle(tabsHeader).overflowX,
                padding: window.getComputedStyle(tabsHeader).padding,
                background: window.getComputedStyle(tabsHeader).background
            } : 'NOT FOUND');
            
            console.log('[DEBUG-TABS] .tabs-container:', tabsContainer);
            console.log('[DEBUG-TABS] .tabs-container styles:', tabsContainer ? {
                overflow: window.getComputedStyle(tabsContainer).overflow,
                overflowY: window.getComputedStyle(tabsContainer).overflowY,
                overflowX: window.getComputedStyle(tabsContainer).overflowX,
                position: window.getComputedStyle(tabsContainer).position,
                zIndex: window.getComputedStyle(tabsContainer).zIndex
            } : 'NOT FOUND');
            
            console.log('[DEBUG-TABS] .top-actions-bar:', topActionsBar);
            console.log('[DEBUG-TABS] .top-actions-bar styles:', topActionsBar ? {
                overflow: window.getComputedStyle(topActionsBar).overflow,
                overflowY: window.getComputedStyle(topActionsBar).overflowY,
                overflowX: window.getComputedStyle(topActionsBar).overflowX,
                position: window.getComputedStyle(topActionsBar).position,
                zIndex: window.getComputedStyle(topActionsBar).zIndex
            } : 'NOT FOUND');
            
            console.log('[DEBUG-TABS] .app-wrapper:', appWrapper);
            console.log('[DEBUG-TABS] .app-wrapper styles:', appWrapper ? {
                overflow: window.getComputedStyle(appWrapper).overflow,
                overflowY: window.getComputedStyle(appWrapper).overflowY,
                overflowX: window.getComputedStyle(appWrapper).overflowX
            } : 'NOT FOUND');
            
            console.log('[DEBUG-TABS] === TABS ===');
            const tabs = document.querySelectorAll('.tab');
            console.log('[DEBUG-TABS] Total tabs found:', tabs.length);
            
            tabs.forEach((tab, index) => {
                if (index < 5) {
                    console.log(`[DEBUG-TABS] Tab ${index} (${tab.textContent.trim()}):`, {
                        element: tab,
                        background: window.getComputedStyle(tab).background,
                        position: window.getComputedStyle(tab).position,
                        zIndex: window.getComputedStyle(tab).zIndex,
                        transform: window.getComputedStyle(tab).transform,
                        overflow: window.getComputedStyle(tab).overflow
                    });
                }
            });
            
            // Логирование при наведении
            document.addEventListener('mouseover', function(e) {
                if (e.target.classList.contains('tab')) {
                    console.log('[DEBUG-TABS] HOVER on tab:', e.target.textContent.trim());
                    console.log('[DEBUG-TABS] Tab styles on hover:', {
                        transform: window.getComputedStyle(e.target).transform,
                        zIndex: window.getComputedStyle(e.target).zIndex,
                        position: window.getComputedStyle(e.target).position,
                        background: window.getComputedStyle(e.target).background,
                        boxShadow: window.getComputedStyle(e.target).boxShadow
                    });
                    
                    // Проверяем родителей
                    let parent = e.target.parentElement;
                    let depth = 0;
                    while (parent && depth < 5) {
                        console.log(`[DEBUG-TABS] Parent ${depth} (${parent.className}):`, {
                            overflow: window.getComputedStyle(parent).overflow,
                            overflowY: window.getComputedStyle(parent).overflowY
                        });
                        parent = parent.parentElement;
                        depth++;
                    }
                }
            }, true);
            
        }, 500);
    }
})();
