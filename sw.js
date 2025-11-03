const CACHE_NAME = 'trae-app-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icons/icon-192x192.svg',
  '/icons/icon-512x512.svg'
];

// Установка Service Worker и кэширование ресурсов
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    })
  );
});

// Перехват запросов и обслуживание из кэша
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Возвращаем кэшированный ответ, если он есть
        if (response) {
          return response;
        }
        
        // Иначе делаем сетевой запрос
        return fetch(event.request)
          .then(response => {
            // Проверяем валидность ответа
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Клонируем ответ, так как он может быть использован только один раз
            const responseToCache = response.clone();
            
            // Добавляем ответ в кэш
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
              
            return response;
          })
          .catch(() => {
            // Если сеть недоступна и запрос не в кэше, возвращаем страницу оффлайн
            if (event.request.mode === 'navigate') {
              return caches.match('/');
            }
          });
      })
  );
});