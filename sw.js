const CACHE_NAME = 'bytecards-v2';  // Увеличиваем версию при изменениях статики

// Ресурсы для кэширования (статика)
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/custom-styles.css',
    '/manifest.json',
    '/icons/icon-192x192.svg',
    '/icons/icon-512x512.svg',
    '/icons/favicon.svg'
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
