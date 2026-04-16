const CACHE_NAME = 'gss-hub-v8';
const urlsToCache = [
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
            self.clients.claim()
        ])
    );
});

self.addEventListener('fetch', (event) => {
    // Exclude API calls and non-GET requests
    if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
        return;
    }

    // No interceptar requests cross-origin (Cloudinary, CDNs externos, etc.).
    // El browser los hace directo bajo su propio CSP del documento.
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) {
        return;
    }

    const path = url.pathname;
    // Favicon / marca: NO pasar por cache-first del SW (evita icono viejo, 503 cacheado, MIME raro en Railway).
    if (
        path === '/favicon.ico' ||
        path === '/logo.png' ||
        path === '/logo-2.png' ||
        path === '/icon.png' ||
        path === '/manifest.webmanifest' ||
        path.startsWith('/icon')
    ) {
        return;
    }

    // IMPORTANT: Never cache Next.js static chunks (_next/static/)
    // These have content-hashed filenames, but new deployments generate new hashes.
    // The SW should always let these through to the network so new chunks are loaded correctly.
    if (event.request.url.includes('/_next/')) {
        return;
    }

    // For navigation requests (page loads), use network-first strategy
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.match('/offline.html');
            })
        );
        return;
    }

    // For other static assets (icons, etc.), use cache-first
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                return fetch(event.request).catch(() => {
                    // Network unavailable - fail silently for non-navigation requests
                    return new Response('', { status: 503, statusText: 'Service Unavailable' });
                });
            })
    );
});

self.addEventListener('push', function (event) {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/logo.png',
            badge: '/logo.png',
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
