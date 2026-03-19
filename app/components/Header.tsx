'use client';

import { Bell, Search, X, Trash2, CheckCheck } from 'lucide-react';
import { useTicketContext } from '../context/TicketContext';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function Header({ title, actions }: { title: string, actions?: React.ReactNode }) {
    const {
        searchQuery, setSearchQuery,
        notifications, unreadCount,
        markNotificationRead, deleteNotification, clearAllNotifications,
        currentUser
    } = useTicketContext();
    const [showNotifications, setShowNotifications] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    // Show search only on Dashboard and Tickets list
    const showSearch = pathname === '/administracion' || pathname === '/tickets';

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    };

    const handleNotificationClick = (notificationId: number, ticketId?: string) => {
        markNotificationRead(notificationId);
        setShowNotifications(false);
        if (ticketId) {
            router.push(`/tickets/${ticketId}`);
        }
    };

    const handleDeleteNotification = (e: React.MouseEvent, notificationId: number) => {
        e.stopPropagation();
        deleteNotification(notificationId);
    };

    const handleClearAll = () => {
        clearAllNotifications();
        setShowNotifications(false);
    };

    const formatTimestamp = (timestamp: string | Date) => {
        const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
        const now = new Date();
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

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
                {actions && <div className="header-actions">{actions}</div>}
                {showSearch && (
                    <div className="search-wrapper" style={{ position: 'relative' }}>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Buscar tickets..."
                            value={searchQuery}
                            onChange={handleSearchChange}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: 'var(--radius)',
                                border: '1px solid var(--border-color)',
                                fontSize: '0.875rem',
                                width: '250px',
                                backgroundColor: 'var(--surface-color)',
                                color: 'var(--text-primary)',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>
                )}

                {/* Notification Bell */}
                <div style={{ position: 'relative', marginLeft: 'auto' }}>
                    <button
                        onClick={() => setShowNotifications(!showNotifications)}
                        style={{
                            position: 'relative',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0.5rem',
                            borderRadius: 'var(--radius)',
                            color: 'var(--text-primary)',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                        title="Notificaciones"
                    >
                        <Bell size={22} />
                        {unreadCount > 0 && (
                            <span style={{
                                position: 'absolute',
                                top: '2px',
                                right: '2px',
                                backgroundColor: 'var(--priority-high)',
                                color: 'white',
                                borderRadius: '50%',
                                width: '18px',
                                height: '18px',
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                lineHeight: 1
                            }}>
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Notifications Dropdown */}
                    {showNotifications && (
                        <>
                            {/* Backdrop */}
                            <div
                                style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                                onClick={() => setShowNotifications(false)}
                            />
                            <div style={{
                                position: 'absolute',
                                right: 0,
                                top: 'calc(100% + 8px)',
                                width: '360px',
                                maxWidth: '90vw',
                                backgroundColor: 'var(--surface-color)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius)',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                                zIndex: 50,
                                overflow: 'hidden'
                            }}>
                                {/* Header */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '0.875rem 1rem',
                                    borderBottom: '1px solid var(--border-color)'
                                }}>
                                    <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                                        Notificaciones {unreadCount > 0 && <span style={{ color: 'var(--priority-high)' }}>({unreadCount} nuevas)</span>}
                                    </span>
                                    {notifications.length > 0 && (
                                        <button
                                            onClick={handleClearAll}
                                            title="Borrar todas"
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: 'var(--text-secondary)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.25rem',
                                                fontSize: '0.75rem',
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: 'var(--radius)'
                                            }}
                                        >
                                            <Trash2 size={13} /> Borrar todas
                                        </button>
                                    )}
                                </div>

                                {/* Notification List */}
                                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                    {notifications.length === 0 ? (
                                        <div style={{
                                            padding: '2rem',
                                            textAlign: 'center',
                                            color: 'var(--text-secondary)',
                                            fontSize: '0.875rem'
                                        }}>
                                            No hay notificaciones
                                        </div>
                                    ) : (
                                        notifications.map(notif => (
                                            <div
                                                key={notif.id}
                                                onClick={() => handleNotificationClick(notif.id, notif.ticket_id || notif.ticketId)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: '0.75rem',
                                                    padding: '0.875rem 1rem',
                                                    borderBottom: '1px solid var(--border-color)',
                                                    cursor: 'pointer',
                                                    backgroundColor: notif.read === 0 ? 'var(--background-color)' : 'transparent',
                                                    transition: 'background-color 0.15s'
                                                }}
                                            >
                                                {/* Unread indicator */}
                                                <div style={{
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '50%',
                                                    backgroundColor: notif.read === 0 ? 'var(--priority-high)' : 'transparent',
                                                    flexShrink: 0,
                                                    marginTop: '5px'
                                                }} />

                                                {/* Content */}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{
                                                        fontSize: '0.8rem',
                                                        color: 'var(--text-primary)',
                                                        margin: 0,
                                                        lineHeight: 1.4,
                                                        wordBreak: 'break-word'
                                                    }}>
                                                        {notif.message}
                                                    </p>
                                                    <span style={{
                                                        fontSize: '0.7rem',
                                                        color: 'var(--text-secondary)',
                                                        marginTop: '0.25rem',
                                                        display: 'block'
                                                    }}>
                                                        {formatTimestamp(notif.created_at || notif.timestamp || new Date())}
                                                    </span>
                                                </div>

                                                {/* Delete button */}
                                                <button
                                                    onClick={(e) => handleDeleteNotification(e, notif.id)}
                                                    title="Eliminar notificación"
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        color: 'var(--text-secondary)',
                                                        padding: '0.2rem',
                                                        borderRadius: '4px',
                                                        flexShrink: 0,
                                                        opacity: 0.6,
                                                        display: 'flex',
                                                        alignItems: 'center'
                                                    }}
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
