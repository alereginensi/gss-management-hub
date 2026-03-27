'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import Link from 'next/link';
import { useTicketContext, DEPARTMENTS } from '../context/TicketContext';
import { X, ArrowRight, Eye, Trash2, Check } from 'lucide-react';

export default function TicketList() {
    const { tickets, searchQuery, filter, setFilter, currentUser, isSidebarOpen, deleteTicket, isMobile, fetchTickets } = useTicketContext() as any;
    const [departmentFilter, setDepartmentFilter] = useState<string>('Todos');
    const [selectedTicket, setSelectedTicket] = useState<any>(null);
    const router = useRouter();
    const [adminView, setAdminView] = useState<'personal' | 'all'>('personal');

    // Handle view param from URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const viewParam = params.get('view');
        if (viewParam === 'all' && currentUser?.role === 'admin') {
            setAdminView('all');
        }
    }, [currentUser]);

    useEffect(() => {
        if (currentUser && currentUser.role === 'funcionario') {
            router.push('/tasks');
        }
    }, [currentUser, router]);

    // Refresh ticket list on every mount so collaborators see newly assigned tickets
    useEffect(() => {
        if (fetchTickets) fetchTickets();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    if (currentUser && currentUser.role === 'funcionario') {
        return null;
    }

    // Apply filters
    const filteredTickets = (tickets as any[]).filter((ticket: any) => {
        // 1. Visibility & Filter for Admins vs Users
        const role = currentUser?.role?.toLowerCase();
        const isTeamTicket = !!(ticket.isTeamTicket || (ticket as any).is_team_ticket);
        const isRequester = ticket.requesterEmail?.toLowerCase() === currentUser?.email?.toLowerCase();
        const isSupervisor = ticket.supervisor && currentUser?.name && 
                           ticket.supervisor.toLowerCase().trim() === currentUser.name.toLowerCase().trim();
        // Support both new multi-collaborator IDs and legacy single affectedWorker name
        const isCollaborator = (Array.isArray(ticket.collaboratorIds) && ticket.collaboratorIds.includes(currentUser?.id || 0)) || 
                             (ticket.affectedWorker && currentUser?.name && 
                              ticket.affectedWorker.toLowerCase().trim() === currentUser.name.toLowerCase().trim());
        
        const isInvolved = isRequester || isSupervisor || isCollaborator || isTeamTicket;

        if (role === 'admin') {
            // Admins can see everything in 'all' view, or only their own in 'personal'
            if (adminView === 'personal' && !isRequester) {
                return false;
            }
            if (departmentFilter !== 'Todos' && ticket.department !== departmentFilter) {
                return false;
            }
        } else if (role === 'jefe') {
            // Jefes see everything the API returns (which is already filtered by department)
        } else {
            // Supervisors, Técnicos, and standard Users
            if (adminView === 'personal' || !adminView) {
                if (!isInvolved) {
                    return false;
                }
            }
        }

        // 2. Status filter
        let matchesStatus = true;
        if (filter === 'Abiertos') {
            matchesStatus = ticket.status === 'Nuevo' || ticket.status === 'En Progreso';
        } else if (filter === 'Cerrados') {
            matchesStatus = ticket.status === 'Resuelto';
        }

        // 4. Search filter
        const matchesSearch = ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ticket.id.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesStatus && matchesSearch;
    });

    const departments = ['Todos', ...DEPARTMENTS];


    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar />

            <main style={{
                flex: 1,
                marginLeft: (!isMobile && isSidebarOpen) ? '260px' : '0',
                transition: 'margin-left 0.3s ease-in-out',
                padding: isMobile ? '1rem' : '2rem',
                backgroundColor: 'var(--bg-color)'
            }}>
                <Header title={
                    currentUser?.role === 'admin'
                        ? (adminView === 'all' ? "Panel de Control de Tickets" : "Mis Tickets (Personal)")
                        : "Mis Tickets"
                } />

                <div className="card">
                    {currentUser?.role === 'admin' && (
                        <div style={{
                            display: 'flex',
                            backgroundColor: 'var(--bg-color)',
                            borderRadius: 'var(--radius)',
                            padding: '0.25rem',
                            marginBottom: '1.5rem',
                            border: '1px solid var(--border-color)',
                            width: 'fit-content'
                        }}>
                            <button
                                onClick={() => setAdminView('personal')}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: 'calc(var(--radius) - 2px)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    fontWeight: 500,
                                    backgroundColor: adminView === 'personal' ? 'var(--accent-color)' : 'transparent',
                                    color: adminView === 'personal' ? 'white' : 'var(--text-secondary)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Mis Tickets
                            </button>
                            <button
                                onClick={() => setAdminView('all')}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: 'calc(var(--radius) - 2px)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    fontWeight: 500,
                                    backgroundColor: adminView === 'all' ? 'var(--accent-color)' : 'transparent',
                                    color: adminView === 'all' ? 'white' : 'var(--text-secondary)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Todos los Tickets (Control)
                            </button>
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                className={`btn ${filter === 'Todos' ? 'btn-primary' : ''}`}
                                onClick={() => setFilter('Todos')}
                                style={filter !== 'Todos' ? { fontSize: '0.875rem', padding: '0.5rem 1rem', backgroundColor: 'transparent', border: '1px solid var(--border-color)' } : { fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                            >
                                Todos
                            </button>
                            <button
                                className={`btn ${filter === 'Abiertos' ? 'btn-primary' : ''}`}
                                onClick={() => setFilter('Abiertos')}
                                style={filter !== 'Abiertos' ? { fontSize: '0.875rem', padding: '0.5rem 1rem', backgroundColor: 'transparent', border: '1px solid var(--border-color)' } : { fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                            >
                                Abiertos
                            </button>
                            <button
                                className={`btn ${filter === 'Cerrados' ? 'btn-primary' : ''}`}
                                onClick={() => setFilter('Cerrados')}
                                style={filter !== 'Cerrados' ? { fontSize: '0.875rem', padding: '0.5rem 1rem', backgroundColor: 'transparent', border: '1px solid var(--border-color)' } : { fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                            >
                                Cerrados
                            </button>
                        </div>

                        {currentUser?.role === 'admin' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Filtrar por Departamento:</span>
                                <select
                                    value={departmentFilter}
                                    onChange={(e) => setDepartmentFilter(e.target.value)}
                                    style={{
                                        padding: '0.5rem',
                                        borderRadius: 'var(--radius)',
                                        border: '1px solid var(--border-color)',
                                        backgroundColor: 'var(--surface-color)',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.875rem'
                                    }}
                                >
                                    {departments.map(dept => (
                                        <option key={dept} value={dept}>{dept}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                        <button
                            onClick={() => {
                                const params = new URLSearchParams();
                                params.append('filter', filter);
                                if (currentUser?.role?.toLowerCase() === 'admin') {
                                    params.append('department', departmentFilter);
                                }
                                window.open(`/api/tickets/export?${params.toString()}`, '_blank');
                            }}
                            className="btn btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            Exportar Excel
                        </button>
                    </div>

                    <div className="desktop-view">
                        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                    <th style={{ padding: '1rem 0.5rem', fontWeight: 500 }}>ID</th>
                                    <th style={{ padding: '1rem 0.5rem', fontWeight: 500 }}>Asunto</th>
                                    <th style={{ padding: '1rem 0.5rem', fontWeight: 500 }}>Prioridad</th>
                                    <th style={{ padding: '1rem 0.5rem', fontWeight: 500 }}>Estado</th>
                                    <th style={{ padding: '1rem 0.5rem', fontWeight: 500 }}>Fecha</th>
                                    <th style={{ padding: '1rem 0.5rem', fontWeight: 500 }}>Acción</th>
                                </tr>
                            </thead>
                            <tbody style={{ fontSize: '0.875rem' }}>
                                {filteredTickets.length > 0 ? (
                                    filteredTickets.map((ticket: any) => (
                                        <tr key={ticket.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '1rem 0.5rem', color: 'var(--text-secondary)' }}>#{`T-${ticket.id}`}</td>
                                            <td style={{ padding: '1rem 0.5rem', fontWeight: 500 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                    {ticket.subject}
                                                    {ticket.requesterEmail === currentUser?.email && ticket.isViewedByOthers && (
                                                        <div style={{ display: 'flex', alignItems: 'center', color: '#3b82f6' }} title="Visto por destinatarios">
                                                            <Check size={14} />
                                                            <Check size={14} style={{ marginLeft: '-8px' }} />
                                                        </div>
                                                    )}
                                                    {!!(ticket.isTeamTicket || (ticket as any).is_team_ticket) && (
                                                        <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '10px', backgroundColor: 'rgba(139,92,246,0.15)', color: '#7c3aed', fontWeight: 600, whiteSpace: 'nowrap', border: '1px solid rgba(139,92,246,0.3)' }}>En equipo</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem 0.5rem' }}><span className="tag" style={{ backgroundColor: ticket.priorityColor }}>{ticket.priority}</span></td>
                                            <td style={{ padding: '1rem 0.5rem' }}><span className="tag" style={{ backgroundColor: ticket.statusColor }}>{ticket.status}</span></td>
                                            <td style={{ padding: '1rem 0.5rem', color: 'var(--text-secondary)' }}>{ticket.date}</td>
                                            <td style={{ padding: '1rem 0.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                                <Link href={`/tickets/${ticket.id}`} style={{ color: 'var(--accent-color)', fontWeight: 500 }}>Ver Detalle</Link>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                            {searchQuery ? `No se encontraron tickets que coincidan con "${searchQuery}"` : 'No hay tickets en esta categoría'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile View */}
                    <div className="mobile-view">
                        {filteredTickets.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {filteredTickets.map((ticket: any) => (
                                    <div key={ticket.id} style={{
                                        padding: '1rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.5rem',
                                        backgroundColor: 'var(--bg-color)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>#{ticket.id} • {ticket.date}</span>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                padding: '0.2rem 0.5rem',
                                                borderRadius: '12px',
                                                backgroundColor: ticket.statusColor,
                                                color: '#fff',
                                                fontWeight: 600
                                            }}>
                                                {ticket.status}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{ fontWeight: 600, fontSize: '1rem' }}>{ticket.subject}</div>
                                                {ticket.requesterEmail === currentUser?.email && ticket.isViewedByOthers && (
                                                    <div style={{ display: 'flex', alignItems: 'center', color: '#3b82f6' }}>
                                                        <Check size={14} />
                                                        <Check size={14} style={{ marginLeft: '-8px' }} />
                                                    </div>
                                                )}
                                            </div>
                                            {!!(ticket.isTeamTicket || (ticket as any).is_team_ticket) && (
                                                <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '10px', backgroundColor: 'rgba(139,92,246,0.15)', color: '#7c3aed', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, border: '1px solid rgba(139,92,246,0.3)' }}>En equipo</span>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                padding: '0.2rem 0.5rem',
                                                borderRadius: '4px',
                                                backgroundColor: ticket.priorityColor,
                                                color: '#fff',
                                                fontWeight: 500
                                            }}>
                                                {ticket.priority}
                                            </span>
                                            <button
                                                onClick={() => setSelectedTicket(ticket)}
                                                className="btn btn-secondary"
                                                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                            >
                                                <Eye size={14} /> Vista Rápida
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                {searchQuery ? `No se encontraron tickets` : 'No hay tickets'}
                            </div>
                        )}
                    </div>
                </div>

                {/* Ticket Quick View Modal */}
                {selectedTicket && (
                    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                        <div className="card modal-responsive" style={{ width: '500px', maxWidth: '95vw', padding: '2rem', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
                            <button onClick={() => setSelectedTicket(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-color)', opacity: 0.5 }}><X size={24} /></button>
                            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', fontWeight: 700, paddingRight: '2rem' }}>Vista Rápida del Ticket</h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ID</span>
                                        <div style={{ fontWeight: 600 }}>#{selectedTicket.id}</div>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fecha</span>
                                        <div>{selectedTicket.date}</div>
                                    </div>
                                </div>

                                <div>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Asunto</span>
                                    <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{selectedTicket.subject}</div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estado</span>
                                        <div>
                                            <span style={{
                                                fontSize: '0.8rem',
                                                padding: '0.2rem 0.6rem',
                                                borderRadius: '12px',
                                                backgroundColor: selectedTicket.statusColor,
                                                color: '#fff',
                                                fontWeight: 600
                                            }}>
                                                {selectedTicket.status}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prioridad</span>
                                        <div>
                                            <span style={{
                                                fontSize: '0.8rem',
                                                padding: '0.2rem 0.6rem',
                                                borderRadius: '4px',
                                                backgroundColor: selectedTicket.priorityColor,
                                                color: '#fff',
                                                fontWeight: 500
                                            }}>
                                                {selectedTicket.priority}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Departamento</span>
                                    <div>{selectedTicket.department}</div>
                                </div>
                            </div>

                            <Link
                                href={`/tickets/${selectedTicket.id}`}
                                className="btn btn-primary"
                                style={{ width: '100%', justifyContent: 'center', padding: '0.8rem' }}
                            >
                                Ir a Gestión Completa <ArrowRight size={18} style={{ marginLeft: '0.5rem' }} />
                            </Link>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
