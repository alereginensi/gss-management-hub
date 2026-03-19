'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Video, Wrench, History, LogOut } from 'lucide-react';
import { useTicketContext } from '@/app/context/TicketContext';

const MENU_ITEMS = [
    { label: 'Historial\nMonitoreo', href: '/seguridad-electronica/historial?tipo=monitoreo', icon: History },
    { label: 'Historial\nMantenimiento', href: '/seguridad-electronica/historial?tipo=mantenimiento', icon: History },
    { label: 'Monitoreo', href: '/seguridad-electronica/monitoreo', icon: Video },
    { label: 'Mantenimiento', href: '/seguridad-electronica/mantenimiento', icon: Wrench },
];

export default function SeguridadElectronicaPage() {
    const { currentUser, isAuthenticated, loading, logout } = useTicketContext();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;
        if (!isAuthenticated) router.push('/login');
        else if (currentUser && currentUser.role !== 'admin' && currentUser.role !== 'tecnico') router.push('/');
    }, [loading, isAuthenticated, currentUser, router]);

    if (loading || !currentUser) return null;

    return (
        <div style={{
            height: '100vh',
            backgroundColor: 'var(--bg-color)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            {/* Top Nav */}
            <header style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem 1.5rem',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--surface-color)'
            }}>
                <Link href="/" style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem'
                }}>
                    <ArrowLeft size={15} />
                    Inicio
                </Link>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="GSS" style={{ height: '36px' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{currentUser.name}</span>
            </header>

            {/* Title + Grid centered together */}
            <main style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
                marginLeft: 0
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
                    <div style={{ textAlign: 'center' }}>
                        <h1 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.35rem' }}>MENÚ PRINCIPAL</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>Operaciones de Seguridad Electrónica</p>
                    </div>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '1rem',
                    width: '480px',
                    maxWidth: '100%'
                }}>
                    {MENU_ITEMS.map((item) => {
                        const Icon = item.icon;
                        return (
                            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                                <div
                                    style={{
                                        backgroundColor: 'var(--primary-color)',
                                        borderRadius: 'var(--radius)',
                                        padding: '1.75rem 1rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        cursor: 'pointer',
                                        transition: 'transform 0.15s, background-color 0.15s, box-shadow 0.15s',
                                        color: 'white',
                                        textAlign: 'center',
                                        fontWeight: 600,
                                        fontSize: '0.9rem',
                                        lineHeight: 1.3,
                                        minHeight: '130px',
                                        justifyContent: 'center',
                                        boxShadow: '0 4px 12px rgba(41,65,107,0.2)'
                                    }}
                                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#1e3a8a'; e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(41,65,107,0.35)'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary-color)'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(41,65,107,0.2)'; }}
                                >
                                    <Icon size={32} color="white" />
                                    <span style={{ whiteSpace: 'pre-line' }}>{item.label}</span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
                </div>
            </main>

            <button onClick={() => { logout(); router.push('/login'); }} style={{ position: 'fixed', bottom: '1.5rem', left: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.5rem 0.9rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <LogOut size={14} /> Cerrar sesión
            </button>
        </div>
    );
}
