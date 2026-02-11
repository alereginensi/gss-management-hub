'use client';

import { Search, Bell, X } from 'lucide-react';
import { useTicketContext } from '../context/TicketContext';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

export default function Header({ title }: { title: string }) {
    const { searchQuery, setSearchQuery, notifications, unreadCount, markNotificationRead, clearAllNotifications, currentUser, setCurrentUser } = useTicketContext();
    const [showNotifications, setShowNotifications] = useState(false);
    const pathname = usePathname();

    // Show search only on Dashboard, Tickets list, and New Ticket (as requested)
    const showSearch = pathname === '/' || pathname === '/tickets' || pathname === '/new-ticket';

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    };

    const handleNotificationClick = (notificationId: string) => {
        markNotificationRead(notificationId);
        setShowNotifications(false);
    };

    const formatTimestamp = (timestamp: Date) => {
        const now = new Date();
        const diff = Math.floor((now.getTime() - timestamp.getTime()) / 1000);

        if (diff < 60) return 'Hace unos segundos';
        if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
        if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} hora${Math.floor(diff / 3600) > 1 ? 's' : ''}`;
        return `Hace ${Math.floor(diff / 86400)} día${Math.floor(diff / 86400) > 1 ? 's' : ''}`;
    };

    return (
        <header className="header-responsive" style={{
            marginBottom: '2rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: '1rem',
            borderBottom: '1px solid var(--border-color)'
        }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h1>

            <div className="header-controls" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                {showSearch && (
                    <div className="search-wrapper" style={{ position: 'relative' }}>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Buscar tickets..."
                            value={searchQuery}
                            onChange={handleSearchChange}
                            style={{
                                padding: '0.5rem 1rem 0.5rem 2.25rem',
                                borderRadius: 'var(--radius)',
                                border: '1px solid var(--border-color)',
                                fontSize: '0.875rem',
                                width: '250px',
                                backgroundColor: 'var(--surface-color)',
                                color: 'var(--text-primary)'
                            }}
                        />
                        <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, zIndex: 10, color: 'var(--text-primary)' }} />
                    </div>
                )}

                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => setShowNotifications(!showNotifications)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative' }}
                    >
                        <Bell size={20} color="var(--text-secondary)" />
                        {unreadCount > 0 && (
                            <span style={{
                                position: 'absolute',
                                top: '-4px',
                                right: '-4px',
                                minWidth: '18px',
                                height: '18px',
                                backgroundColor: 'red',
                                borderRadius: '50%',
                                color: 'white',
                                fontSize: '0.7rem',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '0 4px'
                            }}>{unreadCount}</span>
                        )}
                    </button>

                    {showNotifications && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '0.5rem',
                            width: '350px',
                            maxHeight: '400px',
                            backgroundColor: 'var(--surface-color)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius)',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                            zIndex: 1000,
                            overflow: 'hidden'
                        }}>
                            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontSize: '0.875rem', fontWeight: 600 }}>Notificaciones</h3>
                                {notifications.length > 0 && (
                                    <button
                                        onClick={clearAllNotifications}
                                        style={{ fontSize: '0.75rem', color: 'var(--accent-color)', background: 'none', border: 'none', cursor: 'pointer' }}
                                    >
                                        Limpiar todo
                                    </button>
                                )}
                            </div>
                            <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                                {notifications.length === 0 ? (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                        No hay notificaciones
                                    </div>
                                ) : (
                                    notifications.map(notification => (
                                        <Link
                                            key={notification.id}
                                            href={`/tickets/${notification.ticketId}`}
                                            onClick={() => handleNotificationClick(notification.id)}
                                            style={{
                                                display: 'block',
                                                padding: '0.75rem 1rem',
                                                borderBottom: '1px solid var(--border-color)',
                                                borderLeft: notification.statusColor ? `4px solid ${notification.statusColor}` : 'none',
                                                backgroundColor: notification.read ? 'transparent' : 'rgba(59, 130, 246, 0.05)',
                                                cursor: 'pointer',
                                                textDecoration: 'none',
                                                color: 'inherit'
                                            }}
                                        >
                                            <div style={{ fontSize: '0.875rem', fontWeight: notification.read ? 400 : 600, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {notification.statusColor && (
                                                    <span style={{
                                                        display: 'inline-block',
                                                        width: '8px',
                                                        height: '8px',
                                                        borderRadius: '50%',
                                                        backgroundColor: notification.statusColor
                                                    }}></span>
                                                )}
                                                {notification.ticketSubject}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                                                {notification.message}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                                {formatTimestamp(notification.timestamp)}
                                            </div>
                                        </Link>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
