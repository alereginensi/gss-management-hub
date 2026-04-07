'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Globe, Package, ShoppingCart, CalendarDays, LogOut } from 'lucide-react';
import { useTicketContext, hasModuleAccess } from '@/app/context/TicketContext';

const AGENDA_URL = 'https://capable-possibility-production-8da3.up.railway.app/login';

export default function LogisticaPage() {
    const { currentUser, isAuthenticated, loading, logout } = useTicketContext();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;
        if (!isAuthenticated) router.push('/login');
        else if (currentUser && !hasModuleAccess(currentUser, 'logistica')) router.push('/');
    }, [loading, isAuthenticated, currentUser, router]);

    if (loading || !currentUser) return null;

    return (
        <div style={{ height: '100vh', backgroundColor: 'var(--bg-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)' }}>
                <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}>
                    <ArrowLeft size={15} /> Inicio
                </Link>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="GSS" style={{ height: '36px' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{currentUser.name}</span>
            </header>

            <main className="hub-main standalone-page" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
                    <div style={{ textAlign: 'center' }}>
                        <h1 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.35rem' }}>MENÚ PRINCIPAL</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>Logística y Operaciones</p>
                    </div>

                    <div className="hub-menu-grid">
                        {/* Agenda Web — external link */}
                        <a href={AGENDA_URL} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                            <div
                                className="hub-menu-card"
                                style={{ backgroundColor: 'var(--primary-color)', borderRadius: 'var(--radius)', transition: 'transform 0.15s, background-color 0.15s, box-shadow 0.15s', boxShadow: '0 4px 12px rgba(41,65,107,0.2)' }}
                                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#1e3a8a'; e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(41,65,107,0.35)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary-color)'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(41,65,107,0.2)'; }}
                            >
                                <Globe size={32} color="white" />
                                <span>Agenda{'\n'}Web</span>
                            </div>
                        </a>

                        {/* Envíos al Interior — internal link */}
                        <Link href="/logistica/envios" style={{ textDecoration: 'none' }}>
                            <div
                                className="hub-menu-card"
                                style={{ backgroundColor: 'var(--primary-color)', borderRadius: 'var(--radius)', transition: 'transform 0.15s, background-color 0.15s, box-shadow 0.15s', boxShadow: '0 4px 12px rgba(41,65,107,0.2)' }}
                                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#1e3a8a'; e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(41,65,107,0.35)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary-color)'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(41,65,107,0.2)'; }}
                            >
                                <Package size={32} color="white" />
                                <span>Envíos al{'\n'}Interior</span>
                            </div>
                        </Link>

                        {/* Órdenes de Compra */}
                        <Link href="/logistica/ordenes-compra" style={{ textDecoration: 'none' }}>
                            <div
                                className="hub-menu-card"
                                style={{ backgroundColor: 'var(--primary-color)', borderRadius: 'var(--radius)', transition: 'transform 0.15s, background-color 0.15s, box-shadow 0.15s', boxShadow: '0 4px 12px rgba(41,65,107,0.2)' }}
                                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#1e3a8a'; e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(41,65,107,0.35)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary-color)'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(41,65,107,0.2)'; }}
                            >
                                <ShoppingCart size={32} color="white" />
                                <span>Órdenes de{'\n'}Compra</span>
                            </div>
                        </Link>

                        {/* Calendario */}
                        <Link href="/logistica/calendario" style={{ textDecoration: 'none' }}>
                            <div
                                className="hub-menu-card"
                                style={{ backgroundColor: 'var(--primary-color)', borderRadius: 'var(--radius)', transition: 'transform 0.15s, background-color 0.15s, box-shadow 0.15s', boxShadow: '0 4px 12px rgba(41,65,107,0.2)' }}
                                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#1e3a8a'; e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(41,65,107,0.35)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary-color)'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(41,65,107,0.2)'; }}
                            >
                                <CalendarDays size={32} color="white" />
                                <span style={{ minHeight: '2.4em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Calendario</span>
                            </div>
                        </Link>
                    </div>
                </div>
            </main>

            <button onClick={() => { logout(); router.push('/login'); }} style={{ position: 'fixed', bottom: '1.5rem', left: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.5rem 0.9rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <LogOut size={14} /> Cerrar sesión
            </button>
        </div>
    );
}
