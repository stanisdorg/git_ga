export function initSyncIndicator() {
    // Avoid duplicate initialization
    if (document.getElementById('sync-indicator')) return;

    const container = document.createElement('div');
    container.id = 'sync-indicator';
    container.title = 'Статус синхронизации';
    document.body.appendChild(container);

    // Icons
    const icons = {
        idle: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-cloud"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>`,
        syncing: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" opacity="0.3"></path>
            <g class="spin" style="transform-origin: center;">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </g>
        </svg>`,
        success: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4caf50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-check-circle"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
        error: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f44336" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-alert-circle"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
    };

    // Set initial state
    container.innerHTML = icons.idle;
    container.className = 'sync-idle';

    // Event listeners
    window.addEventListener('sync-start', () => {
        container.innerHTML = icons.syncing;
        container.className = 'sync-active';
        container.title = 'Синхронизация...';
    });

    window.addEventListener('sync-success', () => {
        container.innerHTML = icons.success;
        container.className = 'sync-success';
        container.title = 'Синхронизировано';
        
        // Revert to idle after 2 seconds
        setTimeout(() => {
            if (container.className === 'sync-success') {
                container.innerHTML = icons.idle;
                container.className = 'sync-idle';
                container.title = 'Готов к синхронизации';
            }
        }, 2000);
    });

    window.addEventListener('sync-error', () => {
        container.innerHTML = icons.error;
        container.className = 'sync-error';
        container.title = 'Ошибка синхронизации';
    });
}
