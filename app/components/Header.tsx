'use client';

import { Search, X } from 'lucide-react';
import { useTicketContext } from '../context/TicketContext';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

export default function Header({ title, actions }: { title: string, actions?: React.ReactNode }) {
    const { searchQuery, setSearchQuery, notifications, unreadCount, markNotificationRead, clearAllNotifications, currentUser, setCurrentUser } = useTicketContext();
    const [showNotifications, setShowNotifications] = useState(false);
    const pathname = usePathname();

    // Show search only on Dashboard and Tickets list
    const showSearch = pathname === '/' || pathname === '/tickets';

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

                <div style={{ position: 'relative' }}>
                    {/* User Profile or other controls could go here */}
                </div>
            </div>
        </header>
    );
}
