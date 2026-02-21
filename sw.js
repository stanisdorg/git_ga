const CACHE_NAME = 'trae-app-v1';
const urlsToCache = []; // Отключаем кэширование

// Установка Service Worker БЕЗ кэширования
self.addEventListener('install', event => {
    // Пропускаем кэширование
    self.skipWaiting();
});

// Активация Service Worker
self.addEventListener('activate', event => {
    // Удаляем все кэши
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    return caches.delete(cacheName);
                })
            );
        })
    );
    self.clients.claim();
});

// Перехват запросов - всегда сеть, без кэша
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(new Request(event.request, { 
            cache: 'no-store',
            mode: 'cors'
        }))
    );
});
