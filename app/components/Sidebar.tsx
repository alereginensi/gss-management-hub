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
    X
} from 'lucide-react';
import { useTicketContext } from '../context/TicketContext';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function Sidebar() {
    const { currentUser, logout, isAuthenticated } = useTicketContext();
    const router = useRouter();
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

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

    const handleLogout = () => {
        if (confirm('¿Estás seguro que deseas cerrar sesión?')) {
            logout();
            router.push('/register');
        }
    };

    if (!isAuthenticated) return null;

    const initials = currentUser.name ? currentUser.name.split(' ').map(n => n[0]).join('') : 'DU';

    const sidebarContent = (
        <>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <ShieldCheck size={24} color="#ffffff" />
                    <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.025em' }}>GSS Hub</h1>
                </div>
                <p style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '0.25rem' }}>Management Solutions</p>
            </div>

            <nav style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
                {/* --- SECCIÓN TICKETS --- */}
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ paddingLeft: '1rem', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                        Tickets y Soporte
                    </div>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: 0, margin: 0 }}>
                        {currentUser.role === 'admin' && (
                            <li>
                                <NavItem href="/" icon={<LayoutDashboard size={18} />} label="Dashboard" active={pathname === '/'} />
                            </li>
                        )}
                        <li>
                            <NavItem href="/tickets" icon={<TicketIcon size={18} />} label="Mis Tickets" active={pathname === '/tickets' || pathname.startsWith('/tickets/')} />
                        </li>
                        <li>
                            <NavItem href="/new-ticket" icon={<PlusCircle size={18} />} label="Nuevo Ticket" active={pathname === '/new-ticket'} />
                        </li>
                    </ul>
                </div>

                {/* --- SECCIÓN BITÁCORA --- */}
                {currentUser.role === 'admin' && (
                    <div style={{ marginBottom: '2rem' }}>
                        <div style={{ paddingLeft: '1rem', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                            Operaciones
                        </div>
                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: 0, margin: 0 }}>
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
                                <NavItem href="/settings" icon={<Settings size={18} />} label="Configuración" active={pathname === '/settings'} />
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
            {/* Mobile Hamburger Button */}
            {isMobile && (
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
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
                    {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
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
                left: isMobile ? (isMobileMenuOpen ? 0 : '-260px') : 0,
                zIndex: 1000,
                transition: 'left 0.3s ease-in-out',
                boxShadow: isMobile ? '2px 0 8px rgba(0,0,0,0.3)' : 'none'
            }}>
                {sidebarContent}
            </aside>
        </>
    );
}

function NavItem({ href, icon, label, active }: { href: string, icon: React.ReactNode, label: string, active: boolean }) {
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
            opacity: active ? 1 : 0.8,
            fontSize: '0.9rem',
            minHeight: '44px' // Touch-friendly
        }}>
            {icon}
            <span>{label}</span>
        </Link>
    );
}
