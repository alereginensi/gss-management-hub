'use client';

import { useTicketContext } from '../context/TicketContext';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import PushManager from '../components/PushManager';
import { useState } from 'react';
import Link from 'next/link';

export default function NotificationsPage() {
    const { notifications, unreadCount, markNotificationRead, clearAllNotifications, loading, isSidebarOpen } = useTicketContext();

    const handleNotificationClick = (notificationId: string) => {
        markNotificationRead(notificationId);
    };

    const formatTimestamp = (timestamp: Date) => {
        const now = new Date();
        const diff = Math.floor((now.getTime() - timestamp.getTime()) / 1000); // seconds

        if (diff < 60) return 'Hace unos segundos';
        if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
        if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} hora${Math.floor(diff / 3600) > 1 ? 's' : ''}`;
        return `Hace ${Math.floor(diff / 86400)} día${Math.floor(diff / 86400) > 1 ? 's' : ''}`;
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>
            <Sidebar />
            <main style={{
                flex: 1,
                marginLeft: isSidebarOpen ? '260px' : '0',
                transition: 'margin-left 0.3s ease-in-out',
                padding: '2rem'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <Header title="Notificaciones" />
                </div>

                <div className="container" style={{ maxWidth: '800px', margin: '0 auto' }}>
                    {/* Push Notifications Settings */}
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <PushManager />
                    </div>

                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Tus Notificaciones</h2>
                            {notifications.length > 0 && (
                                <button
                                    onClick={clearAllNotifications}
                                    className="btn btn-outline"
                                    style={{ fontSize: '0.875rem' }}
                                >
                                    Limpiar todo
                                </button>
                            )}
                        </div>

                        {loading ? (
                            <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>
                        ) : notifications.length === 0 ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔕</div>
                                <p>No tienes notificaciones pendientes</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {notifications.map(notification => (
                                    <Link
                                        key={notification.id}
                                        href={`/tickets/${notification.ticketId}`}
                                        onClick={() => handleNotificationClick(notification.id)}
                                        style={{
                                            display: 'block',
                                            padding: '1rem',
                                            borderBottom: '1px solid var(--border-color)',
                                            borderLeft: notification.statusColor ? `4px solid ${notification.statusColor}` : 'none',
                                            backgroundColor: notification.read ? 'transparent' : 'rgba(59, 130, 246, 0.05)',
                                            cursor: 'pointer',
                                            textDecoration: 'none',
                                            color: 'inherit',
                                            transition: 'background-color 0.2s'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                            <div style={{ fontWeight: notification.read ? 400 : 700, fontSize: '1rem' }}>
                                                {notification.ticketSubject}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                {formatTimestamp(notification.timestamp)}
                                            </div>
                                        </div>
                                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
                                            {notification.message}
                                        </p>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
