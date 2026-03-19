'use client';

import Link from 'next/link';
import {
    LayoutDashboard,
    Ticket as TicketIcon,
    PlusCircle,
    Settings,
    LogOut,
    Users,
    BookOpen,
    Menu,
    X,
    Bell,
    Clock,
    Folder,
    FolderPlus,
    Trash2,
    Pencil,
    Check,
    Home
} from 'lucide-react';
import { useTicketContext } from '../context/TicketContext';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function Sidebar() {
    const { currentUser, logout, isAuthenticated, unreadCount, isSidebarOpen, toggleSidebar, folders, fetchFolders, createFolder, deleteFolder, renameFolder } = useTicketContext();
    const router = useRouter();
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [showNewFolderInput, setShowNewFolderInput] = useState(false);
    const [editingFolderId, setEditingFolderId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const [showMoreFolders, setShowMoreFolders] = useState(false);
    const FOLDER_LIMIT = 3;


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

    // Load folders when user is authenticated
    useEffect(() => {
        if (isAuthenticated && currentUser) {
            fetchFolders();
        }
    }, [isAuthenticated, currentUser]);

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        await createFolder(newFolderName.trim());
        setNewFolderName('');
        setShowNewFolderInput(false);
    };

    const handleRenameFolder = async (folderId: number) => {
        if (!editingName.trim()) return;
        await renameFolder(folderId, editingName.trim());
        setEditingFolderId(null);
        setEditingName('');
    };

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

    if (!currentUser) return null;

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
                            <li>
                                <NavItem href="/" icon={<Home size={18} />} label="Inicio" active={pathname === '/'} />
                            </li>
                            {(currentUser?.role?.toLowerCase() === 'admin' || currentUser?.role?.toLowerCase() === 'jefe') && (
                                <li>
                                    <NavItem href="/administracion" icon={<LayoutDashboard size={18} />} label="Dashboard" active={pathname === '/administracion'} />
                                </li>
                            )}
                            <li>
                                <NavItem href="/tickets" icon={<TicketIcon size={18} />} label="Mis Tickets" active={pathname === '/tickets' && !new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').has('view')} />
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

                {/* --- SECCIÓN CARPETAS --- */}
                {currentUser.role !== 'funcionario' && (
                    <div style={{ marginBottom: '2rem' }}>
                        <div style={{ paddingLeft: '1rem', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.5rem', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '0.5rem' }}>
                            <span>Carpetas</span>
                            <button
                                onClick={() => setShowNewFolderInput(v => !v)}
                                title="Nueva carpeta"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: '0', display: 'flex' }}
                            >
                                <FolderPlus size={14} />
                            </button>
                        </div>
                        {/* New folder input — full row on mobile so the tick never overlaps */}
                        {showNewFolderInput && (
                            <div style={{ padding: '0.25rem 0.5rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <input
                                    autoFocus
                                    value={newFolderName}
                                    onChange={e => setNewFolderName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolderInput(false); }}
                                    placeholder="Nombre de la carpeta..."
                                    style={{ width: '100%', fontSize: '0.8rem', padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'white', outline: 'none', boxSizing: 'border-box' }}
                                />
                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    <button onClick={handleCreateFolder} style={{ flex: 1, padding: '0.35rem', borderRadius: '4px', border: 'none', cursor: 'pointer', background: 'rgba(59,130,246,0.5)', color: 'white', fontSize: '0.8rem', fontWeight: 600 }}>
                                        Crear
                                    </button>
                                    <button onClick={() => setShowNewFolderInput(false)} style={{ padding: '0.35rem 0.6rem', borderRadius: '4px', border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}

                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: 0, margin: 0 }}>
                            {folders.slice(0, FOLDER_LIMIT).map((f: any) => (
                                <FolderItem key={f.id} f={f} pathname={pathname} editingFolderId={editingFolderId} editingName={editingName} setEditingName={setEditingName} setEditingFolderId={setEditingFolderId} handleRenameFolder={handleRenameFolder} deleteFolder={deleteFolder} />
                            ))}

                            {/* "Ver más" — proper floating dropdown */}
                            {folders.length > FOLDER_LIMIT && (
                                <li style={{ position: 'relative' }}>
                                    <button
                                        onClick={() => setShowMoreFolders(v => !v)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem 1rem', background: showMoreFolders ? 'rgba(255,255,255,0.08)' : 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.65)', fontSize: '0.8rem', borderRadius: 'var(--radius)' }}
                                    >
                                        <Folder size={14} />
                                        <span style={{ flex: 1, textAlign: 'left' }}>+{folders.length - FOLDER_LIMIT} más carpetas</span>
                                        <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>{showMoreFolders ? '▲' : '▼'}</span>
                                    </button>
                                    {showMoreFolders && (
                                        <div style={{ position: 'absolute', left: 0, right: 0, zIndex: 50, marginTop: '2px', backgroundColor: 'var(--sidebar-bg)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 'var(--radius)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                                            <ul style={{ listStyle: 'none', padding: '0.25rem 0', margin: 0, maxHeight: '260px', overflowY: 'auto' }}>
                                                {folders.slice(FOLDER_LIMIT).map((f: any) => (
                                                    <FolderItem key={f.id} f={f} pathname={pathname} editingFolderId={editingFolderId} editingName={editingName} setEditingName={setEditingName} setEditingFolderId={setEditingFolderId} handleRenameFolder={handleRenameFolder} deleteFolder={deleteFolder} />
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </li>
                            )}

                            {folders.length === 0 && !showNewFolderInput && (
                                <li style={{ paddingLeft: '1rem', fontSize: '0.8rem', opacity: 0.4, fontStyle: 'italic' }}>Sin carpetas</li>
                            )}
                        </ul>
                    </div>
                )}

                {/* --- SECCIÓN BITÁCORA --- */}
                {(currentUser.role === 'admin' || currentUser.role === 'supervisor' || currentUser.role === 'jefe') && (
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

function FolderItem({ f, pathname, editingFolderId, editingName, setEditingName, setEditingFolderId, handleRenameFolder, deleteFolder }: any) {
    return (
        <li style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', paddingRight: '0.25rem' }}>
            {editingFolderId === f.id ? (
                <div style={{ display: 'flex', flex: 1, gap: '0.25rem', padding: '0.25rem 0.5rem' }}>
                    <input
                        autoFocus
                        value={editingName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingName(e.target.value)}
                        onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handleRenameFolder(f.id); if (e.key === 'Escape') setEditingFolderId(null); }}
                        style={{ flex: 1, fontSize: '0.8rem', padding: '0.3rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}
                    />
                    <button onClick={() => handleRenameFolder(f.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', display: 'flex' }}>
                        <Check size={14} />
                    </button>
                </div>
            ) : (
                <>
                    <Link
                        href={`/tickets/folders/${f.id}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, padding: '0.6rem 1rem', borderRadius: 'var(--radius)', color: pathname === `/tickets/folders/${f.id}` ? 'white' : 'var(--text-inverse)', backgroundColor: pathname === `/tickets/folders/${f.id}` ? 'rgba(255,255,255,0.1)' : 'transparent', textDecoration: 'none', fontSize: '0.875rem', opacity: pathname === `/tickets/folders/${f.id}` ? 1 : 0.8, minHeight: '40px' }}
                    >
                        <Folder size={16} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                        {f.ticketCount > 0 && <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>{f.ticketCount}</span>}
                    </Link>
                    <button onClick={() => { setEditingFolderId(f.id); setEditingName(f.name); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: '0.25rem', display: 'flex' }}>
                        <Pencil size={12} />
                    </button>
                    <button onClick={() => { if (confirm(`¿Eliminar carpeta "${f.name}"?`)) deleteFolder(f.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: '0.25rem', display: 'flex' }}>
                        <Trash2 size={12} />
                    </button>
                </>
            )}
        </li>
    );
}
