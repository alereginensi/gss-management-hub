'use client';

import './jornales.css';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useTicketContext, hasModuleAccess } from '@/app/context/TicketContext';
import LogoutExpandButton from '@/app/components/LogoutExpandButton';
import JornalesModule from './JornalesModule';

export default function RrhhJornalesPage() {
    const { currentUser, isAuthenticated, loading, logout, isMobile } = useTicketContext();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;
        if (!isAuthenticated) router.push('/login');
        else if (currentUser && !hasModuleAccess(currentUser, 'rrhh')) router.push('/');
    }, [loading, isAuthenticated, currentUser, router]);

    if (loading || !currentUser) return null;

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
            <header style={{
                position: 'fixed', top: 0, left: 0, right: 0, height: '56px',
                backgroundColor: '#29416b',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: isMobile ? '0 1rem' : '0 1.5rem',
                zIndex: 100, borderBottom: '3px solid #e04951', boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Link href="/rrhh" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.78rem', transition: 'color 200ms' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,1)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}>
                        <ArrowLeft size={13} />{!isMobile && ' RRHH'}
                    </Link>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.png" alt="GSS" style={{ maxHeight: isMobile ? '32px' : '30px', width: 'auto', filter: 'brightness(0) invert(1)' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {!isMobile && (
                        <>
                            <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.8rem', fontWeight: 500 }}>{currentUser.name}</span>
                            <span style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)', padding: '0.2rem 0.6rem', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', borderRadius: 0 }}>
                                {currentUser.role}
                            </span>
                        </>
                    )}
                    <LogoutExpandButton onClick={() => { logout(); router.push('/login'); }} />
                </div>
            </header>

            <main className="standalone-page" style={{ minHeight: 'calc(100vh - 56px)', marginTop: '56px', padding: isMobile ? '1.25rem 0.75rem 2rem' : '1.5rem 1.5rem 2rem', marginLeft: 0 }}>
                <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
                    <h1 style={{ fontSize: isMobile ? '1.1rem' : '1.3rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.2rem', letterSpacing: '-0.01em' }}>
                        Jornales
                    </h1>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1.25rem' }}>
                        Control de días trabajados del personal · umbral 100 jornales para efectividad
                    </p>

                    <JornalesModule umbralEfectividad={100} />
                </div>
            </main>
        </div>
    );
}
