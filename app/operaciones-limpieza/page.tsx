'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ClipboardList, FileText, Users, LogOut, History, BarChart3 } from 'lucide-react';
import { useTicketContext, hasModuleAccess } from '@/app/context/TicketContext';

const MENU_ITEMS = [
    { label: 'Informes\nOperativos', href: '/operaciones-limpieza/informes', icon: FileText },
    { label: 'Historial de\nInformes', href: '/operaciones-limpieza/historial', icon: History },
    { label: 'Recuento\nde Tareas', href: '/operaciones-limpieza/tareas', icon: ClipboardList },
    { label: 'Personal', href: '/operaciones-limpieza/personal', icon: Users },
];

export default function OperacionesLimpiezaPage() {
    const { currentUser, isAuthenticated, loading, logout } = useTicketContext();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;
        if (!isAuthenticated) router.push('/login');
        else if (currentUser && !hasModuleAccess(currentUser, 'limpieza')) router.push('/');
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

            <main className="hub-main standalone-page" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
                    <div style={{ textAlign: 'center' }}>
                        <h1 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.35rem' }}>MENÚ PRINCIPAL</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>Operaciones de Limpieza</p>
                    </div>
                    <div className="hub-menu-grid">
                        {MENU_ITEMS.map((item) => {
                            const Icon = item.icon;
                            return (
                                <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                                    <div
                                        className="hub-menu-card"
                                        style={{ backgroundColor: 'var(--primary-color)', borderRadius: 'var(--radius)', transition: 'transform 0.15s, background-color 0.15s, box-shadow 0.15s', boxShadow: '0 4px 12px rgba(41,65,107,0.2)' }}
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
