const CACHE_NAME = 'bytecards-v58';  // Увеличиваем версию при изменениях статики

// Ресурсы для кэширования (статика)
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/custom-styles.css',
    '/update-modal.css',
    '/push-notifications.css',
    '/push-notifications.js',
    '/manifest.json',
    '/icons/icon-96x96.png',
    '/icons/icon-144x144.png',
    '/icons/icon-192x192.png',
    '/icons/icon-384x384.png',
    '/icons/icon-512x512.png',
    '/icons/favicon.png',
    '/search-highlight.js'
];

// Установка Service Worker - кэшируем статику
self.addEventListener('install', event => {
    console.log('[SW] Install');
    // Пропускаем ожидание и сразу активируем для быстрых обновлений
    self.skipWaiting();
});

// Активация Service Worker - удаляем старые кэши и обновляем статику
self.addEventListener('activate', event => {
    console.log('[SW] Activate');
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name !== CACHE_NAME)
                        .map(name => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Claiming clients');
                // Сообщаем всем клиентам что нужно перезагрузиться
                return self.clients.matchAll().then(clients => {
                    clients.forEach(client => {
                        client.postMessage({ type: 'UPDATE_AVAILABLE' });
                    });
                    return self.clients.claim();
                });
            })
    );
});

// Перехват запросов - стратегия: Cache First, затем Network
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Не кэшируем POST запросы и запросы к API
    if (request.method !== 'GET') {
        return;
    }

    // Не кэшируем данные пользователя (JSON файлы в data/)
    if (url.pathname.includes('/data/')) {
        event.respondWith(
            fetch(request).catch(() => {
                console.log('[SW] Offline, data request failed:', url.pathname);
                return new Response(JSON.stringify({ error: 'offline' }), {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }

    // Стратегия Cache First для статики
    event.respondWith(
        caches.match(request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    // Возвращаем из кэша + обновляем кэш в фоне
                    event.waitUntil(
                        fetch(request)
                            .then(networkResponse => {
                                if (networkResponse && networkResponse.status === 200) {
                                    return caches.open(CACHE_NAME)
                                        .then(cache => cache.put(request, networkResponse));
                                }
                            })
                            .catch(() => {
                                // Network failed, but we have cache - that's fine
                            })
                    );
                    return cachedResponse;
                }

                // Нет в кэше - загружаем из сети
                return fetch(request)
                    .then(networkResponse => {
                        // Кэшируем успешные ответы
                        if (networkResponse && networkResponse.status === 200) {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => cache.put(request, responseClone));
                        }
                        return networkResponse;
                    })
                    .catch(err => {
                        console.log('[SW] Fetch failed, no cache:', request.url);
                        // Для навигации возвращаем index.html из кэша
                        if (request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        throw err;
                    });
            })
    );
});

// ===================================================================
// Push Notifications Handler
// ===================================================================

// Обработка входящих push-уведомлений
self.addEventListener('push', event => {
    console.log('[SW] Push received');

    let data = {};

    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = { title: 'ByteCards', body: event.data.text() };
        }
    }

    const title = data.title || 'ByteCards';
    const options = {
        body: data.body || 'Новое уведомление',
        icon: data.icon || '/icons/icon-192x192.png',
        badge: data.badge || '/icons/icon-96x96.png',
        vibrate: data.vibrate || [200, 100, 200],
        data: data.data || {},
        tag: data.tag || 'default',
        requireInteraction: data.requireInteraction || false,
        actions: data.actions || [
            { action: 'open', title: 'Открыть' },
            { action: 'dismiss', title: 'Закрыть' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', event => {
    console.log('[SW] Notification click:', event.action);

    event.notification.close();

    if (event.action === 'dismiss') {
        return;
    }

    // Открываем приложение или фокусируем существующую вкладку
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                for (const client of clientList) {
                    if (client.url === '/' && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
    );
});
