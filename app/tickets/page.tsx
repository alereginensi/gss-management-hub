'use client';

import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import Link from 'next/link';
import { useTicketContext } from '../context/TicketContext';

export default function TicketList() {
    const { tickets, searchQuery, filter, setFilter, currentUser } = useTicketContext();
    const [departmentFilter, setDepartmentFilter] = useState<string>('Todos');

    // Apply filters
    const filteredTickets = tickets.filter(ticket => {
        // 1. Visibility: Requesters ONLY see their own tickets
        if (currentUser.role === 'user' && ticket.requesterEmail && ticket.requesterEmail !== currentUser.email) {
            return false;
        }

        // 2. Admin Department Filter
        if (currentUser.role === 'admin' && departmentFilter !== 'Todos' && ticket.department !== departmentFilter) {
            return false;
        }

        // 3. Status filter
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

    const departments = ['Todos', 'Mantenimiento', 'Limpieza', 'IT', 'Seguridad', 'RRHH'];

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar />

            <main style={{
                flex: 1,
                marginLeft: '260px',
                padding: '2rem',
                backgroundColor: 'var(--bg-color)'
            }}>
                <Header title={currentUser.role === 'admin' ? "Panel de Control de Tickets" : "Mis Tickets"} />

                <div className="card">
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

                        {currentUser.role === 'admin' && (
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
                                filteredTickets.map(ticket => (
                                    <tr key={ticket.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '1rem 0.5rem', color: 'var(--text-secondary)' }}>#{`T-${ticket.id}`}</td>
                                        <td style={{ padding: '1rem 0.5rem', fontWeight: 500 }}>{ticket.subject}</td>
                                        <td style={{ padding: '1rem 0.5rem' }}><span className="tag" style={{ backgroundColor: ticket.priorityColor }}>{ticket.priority}</span></td>
                                        <td style={{ padding: '1rem 0.5rem' }}><span className="tag" style={{ backgroundColor: ticket.statusColor }}>{ticket.status}</span></td>
                                        <td style={{ padding: '1rem 0.5rem', color: 'var(--text-secondary)' }}>{ticket.date}</td>
                                        <td style={{ padding: '1rem 0.5rem' }}>
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
            </main>
        </div>
    );
}
