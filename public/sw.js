const CACHE_NAME = 'gss-hub-v2';
const urlsToCache = [
    '/',
    '/login',
    '/manifest.webmanifest',
    '/logo.png',
    '/offline.html'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(urlsToCache);
            })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            self.clients.claim() // Take control immediately
        ])
    );
});

self.addEventListener('fetch', (event) => {
    // Exclude API calls and non-GET requests from caching strategies
    if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

self.addEventListener('push', function (event) {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/icon-192x192.png',
            badge: '/badge.png',
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                primaryKey: '2',
                url: data.url || '/'
            },
            actions: [
                { action: 'explore', title: 'Ver Ticket', icon: '/checkmark.png' },
            ]
        };
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

self.addEventListener('notificationclick', function (event) {
    console.log('[Service Worker] Notification click Received.');
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
