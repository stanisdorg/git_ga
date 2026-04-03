/**
 * Push Notifications & Feature Announcements Manager
 * Работает без сервера для демонстрации (локальные уведомления)
 */

const PushNotifications = {
    promptModal: document.getElementById('push-prompt-modal'),

    // Ключи для localStorage
    KEYS: {
        PERMISSION: 'pushPermissionGranted',
        SKIPPED: 'pushPromptSkipped',
        SUBSCRIPTION: 'pushSubscription'
    },

    init() {
        // Кнопки prompt
        document.getElementById('push-prompt-skip')?.addEventListener('click', () => this.skipPermission());
        document.getElementById('push-prompt-allow')?.addEventListener('click', () => this.requestPermission());

        // Закрытие prompt по клику вне
        this.promptModal?.addEventListener('click', (e) => {
            if (e.target === this.promptModal) this.skipPermission();
        });

        // Проверяем показ prompt (с задержкой)
        setTimeout(() => this.checkPrompt(), 3000);
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

                // Отключено до настройки VAPID ключа
                // await this.subscribeToPush();
                this.showTestNotification();
            } else if (permission === 'denied') {
                localStorage.setItem(this.KEYS.PERMISSION, 'false');
            }
        } catch (error) {
            console.error('[Push] Error requesting permission:', error);
        }

        this.hidePrompt();
    },

    async subscribeToPush() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            return null;
        }

        try {
            const registration = await navigator.serviceWorker.ready;

            // TODO: Заменить на реальный VAPID public key с бэкенда
            // Временно отключена подписка — нужен валидный base64 ключ
            // Сгенерировать: npx web-push generate-vapid-keys --json
            const VAPID_PUBLIC_KEY = null; // 'ЗДЕСЬ_ВАЛИДНЫЙ_BASE64_КЛЮЧ'

            if (!VAPID_PUBLIC_KEY) {
                console.warn('[Push] VAPID key не установлен, подписка пропущена');
                return null;
            }

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
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
