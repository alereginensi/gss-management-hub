'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ClipboardList, FileText, Users, History, ClipboardCheck, Settings } from 'lucide-react';
import { useTicketContext, hasModuleAccess } from '@/app/context/TicketContext';
import LogoutExpandButton from '@/app/components/LogoutExpandButton';

const MENU_ITEMS: Array<{ label: string; description: string; href: string; icon: any; adminOnly?: boolean }> = [
    { label: 'Informes Operativos', description: 'Planilla de asistencia y firma digital', href: '/operaciones-limpieza/informes', icon: FileText },
    { label: 'Historial de Informes', description: 'Vista por meses con buscador', href: '/operaciones-limpieza/historial', icon: History },
    { label: 'Recuento de Tareas', description: 'Historial de registros con filtros y exportación', href: '/operaciones-limpieza/tareas', icon: ClipboardList },
    { label: 'Asignar Tareas', description: 'Asignación de tareas al personal', href: '/operaciones-limpieza/asignar-tareas', icon: ClipboardCheck },
    { label: 'Personal', description: 'CRUD de funcionarios de limpieza', href: '/operaciones-limpieza/personal', icon: Users },
    { label: 'Editor de Planillas', description: 'Clientes, sectores, turnos y puestos (solo admin)', href: '/operaciones-limpieza/planillas-config', icon: Settings, adminOnly: true },
];

export default function OperacionesLimpiezaPage() {
    const { currentUser, isAuthenticated, loading, logout, isMobile } = useTicketContext();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;
        if (!isAuthenticated) router.push('/login');
        else if (currentUser && !hasModuleAccess(currentUser, 'limpieza')) router.push('/');
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
                    <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.78rem', transition: 'color 200ms' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,1)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}>
                        <ArrowLeft size={13} />{!isMobile && ' Inicio'}
                    </Link>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {isMobile
                      ? <img src="/logo.png" alt="GSS" style={{ maxHeight: '32px', width: 'auto', filter: 'brightness(0) invert(1)' }} />
                      : <img src="/logo.png" alt="GSS Facility Services" style={{ maxHeight: '30px', width: 'auto', filter: 'brightness(0) invert(1)' }} />
                    }
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {!isMobile && (
                        <>
                            <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.8rem', fontWeight: 500 }}>{currentUser.name}</span>
                            <span style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)', padding: '0.2rem 0.6rem', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', borderRadius: '4px' }}>
                                {currentUser.role}
                            </span>
                        </>
                    )}
                    <LogoutExpandButton onClick={() => { logout(); router.push('/login'); }} />
                </div>
            </header>

            <main className="standalone-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', minHeight: 'calc(100vh - 56px)', marginTop: '56px', padding: isMobile ? '1.5rem 1rem 2rem' : '2rem 1.5rem', marginLeft: 0 }}>
                <div style={{ width: '100%', maxWidth: '960px', margin: '0 auto', padding: 0 }}>

                    <h1 style={{ fontSize: isMobile ? '1.1rem' : '1.3rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.2rem', letterSpacing: '-0.01em' }}>
                        Operaciones Limpieza/Seguridad
                    </h1>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1.25rem' }}>
                        GSS Management Hub · Tareas, informes y control operativo
                    </p>

                    <div className="landing-modules-grid">
                        {MENU_ITEMS.filter(i => !i.adminOnly || currentUser.role === 'admin').map((item) => {
                            const Icon = item.icon;
                            return (
                                <Link key={item.href} href={item.href} className="landing-card-btn">
                                    <div className="landing-card-icon"><Icon size={26} color="white" /></div>
                                    <div className="landing-card-content">
                                        <p className="landing-card-label">{item.label}</p>
                                        <p className="landing-card-desc">{item.description}</p>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>

                </div>
            </main>
        </div>
    );
}
