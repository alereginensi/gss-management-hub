'use client';

import { useTicketContext } from '../context/TicketContext';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import PushManager from '../components/PushManager';
import { useState } from 'react';
import Link from 'next/link';

export default function NotificationsPage() {
    const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead, deleteNotification, clearAllNotifications, loading, isSidebarOpen, isMobile } = useTicketContext();

    const handleNotificationClick = (notificationId: number) => {
        markNotificationRead(notificationId);
    };

    const formatTimestamp = (timestamp: Date | string) => {
        const now = new Date();
        const timestampDate = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
        const diff = Math.floor((now.getTime() - timestampDate.getTime()) / 1000); // seconds

        if (diff < 60) return 'Hace unos segundos';
        if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
        if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} horas`;
        return `Hace ${Math.floor(diff / 86400)} días`;
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>
            <Sidebar />
            <main style={{
                flex: 1,
                marginLeft: (!isMobile && isSidebarOpen) ? '260px' : '0',
                transition: 'margin-left 0.3s ease-in-out',
                padding: isMobile ? '1rem' : '2rem',
                backgroundColor: 'var(--bg-color)'
            }}>
                <Header title="Notificaciones" />

                <div className="container" style={{ maxWidth: '800px', margin: '0 auto' }}>
                    {/* Push Notifications Settings */}
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <PushManager />
                    </div>

                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Tus Notificaciones ({unreadCount} sin leer)</h2>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {notifications.length > 0 && notifications.some(n => !n.read) && (
                                    <button
                                        onClick={markAllNotificationsRead}
                                        className="btn btn-secondary"
                                        style={{ fontSize: '0.875rem' }}
                                    >
                                        Marcar todo como leído
                                    </button>
                                )}
                                {notifications.length > 0 && (
                                    <button
                                        onClick={clearAllNotifications}
                                        className="btn"
                                        style={{ fontSize: '0.875rem', border: '1px solid #ef4444', color: '#ef4444', backgroundColor: 'transparent' }}
                                    >
                                        Limpiar todo
                                    </button>
                                )}
                            </div>
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
                                    <div
                                        key={notification.id}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            padding: '1rem',
                                            borderBottom: '1px solid var(--border-color)',
                                            borderLeft: notification.read ? '4px solid transparent' : '4px solid #3b82f6',
                                            backgroundColor: notification.read ? 'transparent' : 'rgba(59, 130, 246, 0.05)',
                                            transition: 'background-color 0.2s',
                                            gap: '0.75rem'
                                        }}
                                    >
                                        {/* Top row: title + timestamp */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                                            <div style={{ fontWeight: notification.read ? 400 : 700, fontSize: '0.95rem', flex: 1, minWidth: 0 }}>
                                                {notification.type === 'ticket_assigned' ? '🎫 Ticket Asignado' : '🔔 Notificación'}
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                                {formatTimestamp(notification.created_at)}
                                            </div>
                                        </div>

                                        {/* Message */}
                                        <Link
                                            href={notification.ticket_id ? `/tickets/${notification.ticket_id}` : '#'}
                                            onClick={() => !notification.read && handleNotificationClick(notification.id)}
                                            style={{
                                                cursor: 'pointer',
                                                textDecoration: 'none',
                                                color: 'inherit',
                                            }}
                                        >
                                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, wordBreak: 'break-word' }}>
                                                {notification.message}
                                            </p>
                                        </Link>

                                        {/* Action buttons */}
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            {!notification.read && (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        markNotificationRead(notification.id);
                                                    }}
                                                    className="btn"
                                                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', backgroundColor: 'var(--accent-color)', color: 'white' }}
                                                    title="Marcar como leído"
                                                >
                                                    Leer
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    if (confirm('¿Eliminar esta notificación?')) {
                                                        deleteNotification(notification.id);
                                                    }
                                                }}
                                                className="btn"
                                                style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444' }}
                                                title="Eliminar"
                                            >
                                                Borrar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
