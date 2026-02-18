'use client';

import { useEffect } from 'react';

export default function SWRegistration() {
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', function () {
                navigator.serviceWorker.register('/sw.js').then(
                    function (registration) {
                        console.log('Service Worker registration successful with scope: ', registration.scope);
                        // Check for updates periodically
                        setInterval(() => {
                            registration.update();
                        }, 60 * 60 * 1000); // Check every hour
                    },
                    function (err) {
                        console.log('Service Worker registration failed: ', err);
                    }
                );
            });
        }
    }, []);

    return null;
}
