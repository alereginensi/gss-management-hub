'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { useTicketContext } from '../context/TicketContext';

// Base64 to Uint8Array converter for VAPID key
const urlBase64ToUint8Array = (base64String: string) => {
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
};

export default function PushManager() {
    const { currentUser } = useTicketContext();
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
            // Register SW
            navigator.serviceWorker.register('/sw.js')
                .then(reg => {
                    setRegistration(reg);
                    reg.pushManager.getSubscription().then(sub => {
                        setIsSubscribed(!!sub);
                    });
                })
                .catch(err => console.error('SW Registration failed', err));
        }
    }, []);

    const subscribe = async () => {
        if (!registration) return;

        try {
            const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!vapidKey) {
                alert('VAPID Key not found');
                return;
            }

            const convertedKey = urlBase64ToUint8Array(vapidKey);
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedKey
            });

            // Send subscription to backend
            await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription,
                    email: currentUser?.email
                })
            });

            setIsSubscribed(true);
            alert('Notificaciones activadas!');
        } catch (error) {
            console.error('Subscription failed', error);
            alert('Error al activar notificaciones. Verifica permisos del navegador.');
        }
    };

    const unsubscribe = async () => {
        if (!registration) return;
        const sub = await registration.pushManager.getSubscription();
        if (sub) {
            await sub.unsubscribe();
            // TODO: Call API to remove from DB if needed
            setIsSubscribed(false);
        }
    };

    if (!('serviceWorker' in navigator)) {
        return null; // Not supported
    }

    return (
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', marginTop: '2rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Notificaciones Push</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Recibe alertas en tu dispositivo incluso si la app está cerrada.
            </p>

            {isSubscribed ? (
                <button
                    onClick={unsubscribe}
                    className="btn btn-outline"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}
                >
                    <BellOff size={16} />
                    Desactivar Notificaciones
                </button>
            ) : (
                <button
                    onClick={subscribe}
                    className="btn"
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        backgroundColor: 'var(--accent-color)', color: 'white'
                    }}
                >
                    <Bell size={16} />
                    Activar Notificaciones
                </button>
            )}
        </div>
    );
}
