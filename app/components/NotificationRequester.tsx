'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';

export default function NotificationRequester() {
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        if ('Notification' in window) {
            setPermission(Notification.permission);
            // Only show prompt if permission is 'default' (not asking if denied or granted)
            if (Notification.permission === 'default') {
                setShowPrompt(true);
            }
        }
    }, []);

    const requestPermission = async () => {
        if ('Notification' in window) {
            const result = await Notification.requestPermission();
            setPermission(result);
            setShowPrompt(false);

            if (result === 'granted') {
                // Ideally, subscribe to push manager here if using Web Push
                // For now, we just enable the browser permission
                new Notification('GSS Hub', {
                    body: 'Notificaciones activadas correctamente.',
                    icon: '/icon.svg'
                });
            }
        }
    };

    if (!showPrompt || permission !== 'default') return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            maxWidth: '350px',
            backgroundColor: 'var(--surface-color)',
            border: '1px solid var(--border-color)',
            padding: '1rem',
            borderRadius: 'var(--radius)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    color: '#3b82f6',
                    padding: '0.5rem',
                    borderRadius: '50%'
                }}>
                    <Bell size={20} />
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Activar Notificaciones</div>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Recibe alertas instantáneas cuando se actualicen tus tickets o haya novedades importantes.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button
                    onClick={() => setShowPrompt(false)}
                    style={{
                        flex: 1,
                        padding: '0.5rem',
                        backgroundColor: 'transparent',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius)',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)'
                    }}
                >
                    Más tarde
                </button>
                <button
                    onClick={requestPermission}
                    style={{
                        flex: 1,
                        padding: '0.5rem',
                        backgroundColor: 'var(--accent-color)',
                        border: 'none',
                        borderRadius: 'var(--radius)',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        color: 'white',
                        fontWeight: 500
                    }}
                >
                    Activar
                </button>
            </div>
        </div>
    );
}
