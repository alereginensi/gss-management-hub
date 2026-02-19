'use client';

import { useEffect } from 'react';

export default function SWRegistration() {
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', function () {
                navigator.serviceWorker.register('/sw.js').then(
                    function (registration) {
                        console.log('SW registered:', registration.scope);

                        // When a new SW is found, immediately activate it
                        registration.addEventListener('updatefound', () => {
                            const newWorker = registration.installing;
                            if (!newWorker) return;

                            newWorker.addEventListener('statechange', () => {
                                // When the new SW is installed and active, reload the page
                                // so the browser picks up new JS chunks from the latest deploy
                                if (newWorker.state === 'activated') {
                                    console.log('New SW activated, reloading for fresh chunks...');
                                    window.location.reload();
                                }
                            });
                        });

                        // Check for updates frequently (every 5 minutes) to catch new deploys sooner
                        setInterval(() => {
                            registration.update();
                        }, 5 * 60 * 1000);
                    },
                    function (err) {
                        console.log('Service Worker registration failed: ', err);
                    }
                );

                // Also reload when we regain control from a new SW (handles edge cases)
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    console.log('SW controller changed, reloading...');
                    window.location.reload();
                });
            });
        }
    }, []);

    return null;
}
