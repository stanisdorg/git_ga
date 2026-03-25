/**
 * Push Notifications & Feature Announcements Manager
 * Работает без сервера для демонстрации (локальные уведомления)
 */

const PushNotifications = {
    promptModal: document.getElementById('push-prompt-modal'),
    announcementBanner: document.getElementById('announcement-banner'),
    announcementClose: document.getElementById('announcement-close'),
    
    // Ключи для localStorage
    KEYS: {
        PERMISSION: 'pushPermissionGranted',
        SKIPPED: 'pushPromptSkipped',
        ANNOUNCEMENT: 'announcementDismissed',
        SUBSCRIPTION: 'pushSubscription'
    },
    
    // Текущая версия для announcement
    CURRENT_VERSION: '6.10.0',

    init() {
        // Кнопки prompt
        document.getElementById('push-prompt-skip')?.addEventListener('click', () => this.skipPermission());
        document.getElementById('push-prompt-allow')?.addEventListener('click', () => this.requestPermission());
        
        // Кнопка закрытия announcement
        this.announcementClose?.addEventListener('click', () => this.dismissAnnouncement());
        
        // Закрытие announcement по клику вне
        this.announcementBanner?.addEventListener('click', (e) => {
            if (e.target === this.announcementBanner) this.dismissAnnouncement();
        });

        // Проверяем показ announcement
        this.checkAnnouncement();
        
        // Проверяем показ prompt (с задержкой)
        setTimeout(() => this.checkPrompt(), 3000);
    },

    // ===================================================================
    // Announcement Banner
    // ===================================================================
    
    checkAnnouncement() {
        const dismissed = localStorage.getItem(this.KEYS.ANNOUNCEMENT);
        const dismissedVersion = dismissed ? JSON.parse(dismissed).version : null;
        
        // Показываем если не было.dismissed или версия изменилась
        if (dismissedVersion !== this.CURRENT_VERSION) {
            this.showAnnouncement();
        }
    },

    showAnnouncement() {
        if (this.announcementBanner) {
            setTimeout(() => {
                this.announcementBanner.classList.add('show');
            }, 1000);
        }
    },

    dismissAnnouncement() {
        if (this.announcementBanner) {
            this.announcementBanner.classList.remove('show');
            localStorage.setItem(this.KEYS.ANNOUNCEMENT, JSON.stringify({
                version: this.CURRENT_VERSION,
                dismissedAt: new Date().toISOString()
            }));
        }
    },

    // ===================================================================
    // Push Permission Prompt
    // ===================================================================
    
    checkPrompt() {
        const permissionGranted = localStorage.getItem(this.KEYS.PERMISSION);
        const skipped = localStorage.getItem(this.KEYS.SKIPPED);
        
        // Не показываем если уже разрешили или скипнули
        if (permissionGranted === 'true') return;
        
        // Проверяем когда был скип (не показываем чаще раза в 7 дней)
        if (skipped) {
            const skippedData = JSON.parse(skipped);
            const daysSinceSkip = (Date.now() - new Date(skippedData.timestamp).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceSkip < 7) return;
        }
        
        this.showPrompt();
    },

    showPrompt() {
        if (this.promptModal) {
            this.promptModal.classList.add('show');
        }
    },

    hidePrompt() {
        if (this.promptModal) {
            this.promptModal.classList.remove('show');
        }
    },

    skipPermission() {
        localStorage.setItem(this.KEYS.SKIPPED, JSON.stringify({
            timestamp: Date.now()
        }));
        this.hidePrompt();
    },

    async requestPermission() {
        if (!('Notification' in window)) {
            alert('Ваш браузер не поддерживает уведомления');
            this.hidePrompt();
            return;
        }

        try {
            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
                localStorage.setItem(this.KEYS.PERMISSION, 'true');
                
                // Подписываемся на push (для демонстрации сохраняем в localStorage)
                await this.subscribeToPush();
                
                // Показываем тестовое уведомление
                this.showTestNotification();
                
                console.log('[Push] Permission granted & subscribed');
            } else if (permission === 'denied') {
                localStorage.setItem(this.KEYS.PERMISSION, 'false');
                console.log('[Push] Permission denied');
            }
        } catch (error) {
            console.error('[Push] Error requesting permission:', error);
        }
        
        this.hidePrompt();
    },

    // ===================================================================
    // Push Subscription (без сервера - демо режим)
    // ===================================================================
    
    async subscribeToPush() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.log('[Push] Push not supported');
            return null;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            
            // Для работы без сервера используем demo VAPID key
            // В продакшене нужен реальный VAPID ключ с бэкенда
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(
                    'BKagOu7jQjJpR8sT9vXx2qL5mN3oP1qR7sT9vXx2qL5mN3oP1qR7sT9vXx2qL5mN3oP1qR7sT9vXx2qL5mN3oP1qR'
                )
            });

            // Сохраняем подписку локально (в демо режиме)
            localStorage.setItem(this.KEYS.SUBSCRIPTION, JSON.stringify(subscription));
            
            return subscription;
        } catch (error) {
            console.error('[Push] Subscribe error:', error);
            return null;
        }
    },

    async unsubscribeFromPush() {
        if (!('serviceWorker' in navigator)) return;
        
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            
            if (subscription) {
                await subscription.unsubscribe();
                localStorage.removeItem(this.KEYS.SUBSCRIPTION);
                localStorage.removeItem(this.KEYS.PERMISSION);
                console.log('[Push] Unsubscribed');
            }
        } catch (error) {
            console.error('[Push] Unsubscribe error:', error);
        }
    },

    // ===================================================================
    // Test Notification (для демонстрации)
    // ===================================================================
    
    showTestNotification() {
        // Показываем локальное уведомление
        if (Notification.permission === 'granted') {
            new Notification('🎉 ByteCards', {
                body: 'Push-уведомления работают! Теперь вы будете получать уведомления о новых функциях.',
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-96x96.png',
                vibrate: [200, 100, 200],
                tag: 'test-notification'
            });
        }
    },

    // ===================================================================
    // Utility
    // ===================================================================
    
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    },

    // Публичный метод для отправки тестового уведомления
    sendTestPush() {
        this.showTestNotification();
    }
};

// Экспортируем для доступа из консоли
window.PushNotifications = PushNotifications;

// Авто-инит при загрузке DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => PushNotifications.init());
} else {
    PushNotifications.init();
}
