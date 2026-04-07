'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ClipboardList, FileText, Users, LogOut, History, ClipboardCheck } from 'lucide-react';
import { useTicketContext, hasModuleAccess } from '@/app/context/TicketContext';

const MENU_ITEMS = [
    { label: 'Informes\nOperativos', href: '/operaciones-limpieza/informes', icon: FileText },
    { label: 'Historial de\nInformes', href: '/operaciones-limpieza/historial', icon: History },
    { label: 'Recuento\nde Tareas', href: '/operaciones-limpieza/tareas', icon: ClipboardList },
    { label: 'Asignar\nTareas', href: '/operaciones-limpieza/asignar-tareas', icon: ClipboardCheck },
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
            minHeight: '100vh',
            backgroundColor: 'var(--bg-color)',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Top Nav */}
            <header style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 1rem',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--surface-color)',
                position: 'sticky',
                top: 0,
                zIndex: 50
            }}>
                <Link href="/" style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem'
                }}>
                    <ArrowLeft size={16} />
                    <span className="mobile-hide">Inicio</span>
                </Link>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="GSS" style={{ height: '32px' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }} className="mobile-hide">{currentUser.name}</span>
                    <button
                        onClick={() => { logout(); router.push('/login'); }}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', padding: '0.4rem' }}
                        title="Cerrar sesión"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            <main className="standalone-page" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', width: '100%', textAlign: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                        <h1 style={{ color: 'var(--text-primary)', fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Módulo de Limpieza</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>GSS Management Hub</p>
                    </div>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                        <div className="hub-menu-grid">
                            {MENU_ITEMS.map((item) => {
                                const Icon = item.icon;
                                return (
                                <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
                                    <div
                                        className="hub-menu-card"
                                        style={{ backgroundColor: 'var(--primary-color)', borderRadius: 'var(--radius)', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(41,65,107,0.15)', height: '100%' }}
                                    >
                                        <div style={{ padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Icon size={24} color="white" />
                                        </div>
                                        <span style={{ whiteSpace: 'pre-line', fontSize: '0.9rem' }}>{item.label}</span>
                                    </div>
                                </Link>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
