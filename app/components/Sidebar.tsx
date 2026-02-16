'use client';

import Link from 'next/link';
import {
    LayoutDashboard,
    Ticket as TicketIcon,
    PlusCircle,
    Settings,
    ShieldCheck,
    LogOut,
    Users,
    BookOpen,
    Menu,
    X,
    Bell,
    Clock,
    UserMinus
} from 'lucide-react';
import { useTicketContext } from '../context/TicketContext';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function Sidebar() {
    const { currentUser, logout, isAuthenticated, unreadCount, deleteUser, isSidebarOpen, toggleSidebar } = useTicketContext();
    const router = useRouter();
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    const handleDeleteUser = async () => {
        const email = prompt('Ingrese el correo electrónico del usuario que desea eliminar:');
        if (!email) return;

        if (confirm(`¿Estás seguro de que deseas eliminar permanentemente al usuario "${email}"? Esta acción no se puede deshacer.`)) {
            const success = await deleteUser(email);
            if (success) {
                alert('Usuario eliminado con éxito.');
            } else {
                alert('No se pudo eliminar al usuario. Verifique el correo electrónico e intente nuevamente.');
            }
        }
    };

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Close mobile menu when route changes
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [pathname]);

    const handleLogout = async () => {
        if (confirm('¿Estás seguro que deseas cerrar sesión?')) {
            try {
                await fetch('/api/auth/logout', { method: 'POST' });
                logout();
                router.push('/login');
            } catch (error) {
                console.error('Logout error:', error);
                logout();
                router.push('/login');
            }
        }
    };

    if (!isAuthenticated) return null;

    const initials = currentUser.name ? currentUser.name.split(' ').map(n => n[0]).join('') : 'DU';

    const sidebarContent = (
        <>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: '100%', maxWidth: '160px' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.png" alt="GSS Logo" style={{ width: '100%', height: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
                </div>
            </div>

            <nav style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
                {/* --- SECCIÓN PRINCIPAL (Restringida para Funcionarios) --- */}
                {currentUser.role !== 'funcionario' && (
                    <div style={{ marginBottom: '2rem' }}>
                        <div style={{ paddingLeft: '1rem', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                            Menu Principal
                        </div>
                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: 0, margin: 0 }}>
                            {currentUser.role === 'admin' && (
                                <li>
                                    <NavItem href="/" icon={<LayoutDashboard size={18} />} label="Dashboard" active={pathname === '/'} />
                                </li>
                            )}
                            <li>
                                <NavItem href="/tickets" icon={<TicketIcon size={18} />} label="Mis Tickets" active={pathname === '/tickets'} />
                            </li>
                            <li>
                                <NavItem href="/new-ticket" icon={<PlusCircle size={18} />} label="Nuevo Ticket" active={pathname === '/new-ticket'} />
                            </li>
                            <li>
                                <NavItem
                                    href="/notifications"
                                    icon={<Bell size={18} />}
                                    label="Notificaciones"
                                    active={pathname === '/notifications'}
                                    badge={unreadCount > 0 ? unreadCount : undefined}
                                />
                            </li>
                        </ul>
                    </div>
                )}

                {/* --- SECCIÓN BITÁCORA --- */}
                {(currentUser.role === 'admin' || currentUser.role === 'supervisor') && (
                    <div style={{ marginBottom: '2rem' }}>
                        <div style={{ paddingLeft: '1rem', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                            Operaciones
                        </div>
                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: 0, margin: 0 }}>
                            <li>
                                <NavItem
                                    href="/admin/attendance"
                                    icon={<Clock size={18} />}
                                    label="Asistencia"
                                    active={pathname === '/admin/attendance'}
                                />
                            </li>
                            <li>
                                <NavItem
                                    href="/logbook"
                                    icon={<BookOpen size={18} />}
                                    label="Bitácora"
                                    active={pathname === '/logbook'}
                                />
                            </li>
                        </ul>
                    </div>
                )}

                {/* --- SECCIÓN ADMINISTRACIÓN --- */}
                {currentUser.role === 'admin' && (
                    <div style={{ marginTop: 'auto' }}>
                        <div style={{ paddingLeft: '1rem', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                            Sistema
                        </div>
                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: 0, margin: 0 }}>
                            <li>
                                <NavItem href="/admin/users" icon={<Users size={18} />} label="Usuarios" active={pathname === '/admin/users'} />
                            </li>
                            <li>
                                <button
                                    onClick={handleDeleteUser}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        padding: '0.75rem 1rem',
                                        borderRadius: 'var(--radius)',
                                        color: 'var(--text-inverse)',
                                        backgroundColor: 'transparent',
                                        textDecoration: 'none',
                                        transition: 'all 0.2s',
                                        position: 'relative',
                                        opacity: 0.8,
                                        fontSize: '0.9rem',
                                        minHeight: '44px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        width: '100%',
                                        textAlign: 'left'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    <UserMinus size={18} />
                                    <span>Eliminar Usuario</span>
                                </button>
                            </li>
                            <li>
                                <NavItem href="/admin/config" icon={<Settings size={18} />} label="Configuración" active={pathname === '/admin/config'} />
                            </li>
                        </ul>
                    </div>
                )}
            </nav>

            <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                        {initials}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser.name}</div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{currentUser.department}</div>
                    </div>
                </div>

                <button
                    onClick={handleLogout}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.6rem',
                        borderRadius: 'var(--radius)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        width: '100%',
                        transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                >
                    <LogOut size={18} />
                    Cerrar Sesión
                </button>
            </div>
        </>
    );

    return (
        <>
            {/* Desktop Toggle Button - Only show when closed */}
            {!isMobile && !isSidebarOpen && (
                <button
                    onClick={toggleSidebar}
                    style={{
                        position: 'fixed',
                        top: '1rem',
                        left: '1rem',
                        zIndex: 1001,
                        backgroundColor: 'var(--sidebar-bg)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                    }}
                >
                    <Menu size={24} />
                </button>
            )}

            {/* Mobile Hamburger Button - Only show when closed */}
            {isMobile && !isMobileMenuOpen && (
                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    style={{
                        position: 'fixed',
                        top: '1rem',
                        left: '1rem',
                        zIndex: 1001,
                        backgroundColor: 'var(--sidebar-bg)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                    }}
                >
                    <Menu size={24} />
                </button>
            )}

            {/* Overlay for mobile */}
            {isMobile && isMobileMenuOpen && (
                <div
                    onClick={() => setIsMobileMenuOpen(false)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        zIndex: 999,
                    }}
                />
            )}

            {/* Sidebar */}
            <aside style={{
                width: '260px',
                backgroundColor: 'var(--sidebar-bg)',
                color: 'var(--text-inverse)',
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                position: 'fixed',
                top: 0,
                left: isMobile
                    ? (isMobileMenuOpen ? 0 : '-260px')
                    : (isSidebarOpen ? 0 : '-260px'),
                zIndex: 1000,
                transition: 'left 0.3s ease-in-out',
                boxShadow: (isMobile || !isSidebarOpen) ? '2px 0 8px rgba(0,0,0,0.3)' : 'none'
            }}>
                {/* Close Button inside Sidebar (Mobile and Desktop) */}
                <button
                    onClick={isMobile ? () => setIsMobileMenuOpen(false) : toggleSidebar}
                    style={{
                        position: 'absolute',
                        top: '1rem',
                        right: '1rem',
                        background: 'none',
                        border: 'none',
                        color: 'white',
                        cursor: 'pointer',
                        padding: '0.5rem',
                        zIndex: 1002
                    }}
                >
                    <X size={24} />
                </button>
                {sidebarContent}
            </aside>
        </>
    );
}

function NavItem({ href, icon, label, active, badge }: { href: string, icon: React.ReactNode, label: string, active: boolean, badge?: number }) {
    return (
        <Link href={href} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius)',
            color: active ? 'white' : 'var(--text-inverse)',
            backgroundColor: active ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
            textDecoration: 'none',
            transition: 'all 0.2s',
            position: 'relative',
            opacity: active ? 1 : 0.8,
            fontSize: '0.9rem',
            minHeight: '44px'
        }}>
            {icon}
            <span style={{ fontSize: '0.9rem', flex: 1 }}>{label}</span>
            {badge !== undefined && badge > 0 && (
                <span style={{
                    backgroundColor: '#ef4444',
                    color: 'white',
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '9999px',
                    minWidth: '1.25em',
                    textAlign: 'center'
                }}>
                    {badge}
                </span>
            )}
        </Link>
    );
}
