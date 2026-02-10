'use client';

import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import { User, Paperclip } from 'lucide-react';
import Link from 'next/link';
import { useTicketContext } from '../../context/TicketContext';
import { useState, use } from 'react';

export default function TicketDetail({ params }: { params: Promise<{ id: string }> }) {
    const { tickets, getActivitiesByTicket, addActivity, updateTicketStatus, currentUser } = useTicketContext();
    const [comment, setComment] = useState('');

    const resolvedParams = use(params);
    const ticketId = resolvedParams.id;
    const ticket = tickets.find(t => t.id === ticketId);
    const activities = getActivitiesByTicket(ticketId);

    const isOwner = ticket?.requesterEmail === currentUser.email;
    const isAdmin = currentUser.role === 'admin';
    const canSeeTicket = ticket && (isAdmin || isOwner);

    const handleSubmitComment = (e: React.FormEvent) => {
        e.preventDefault();
        if (comment.trim()) {
            addActivity(ticketId, currentUser.name, comment);
            setComment('');
        }
    };

    const formatTimestamp = (timestamp: Date) => {
        const now = new Date();
        const diff = Math.floor((now.getTime() - timestamp.getTime()) / 1000);

        if (diff < 60) return 'Hace unos segundos';
        if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
        if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} hora${Math.floor(diff / 3600) > 1 ? 's' : ''}`;
        return `Hace ${Math.floor(diff / 86400)} día${Math.floor(diff / 86400) > 1 ? 's' : ''}`;
    };

    const getUserInitials = (user: string) => {
        if (!user) return '??';
        const words = user.split(' ');
        return words.map(w => w[0]).join('').substring(0, 2).toUpperCase();
    };

    if (!canSeeTicket) {
        return (
            <div style={{ display: 'flex', minHeight: '100vh' }}>
                <Sidebar />
                <main style={{
                    flex: 1,
                    marginLeft: '260px',
                    padding: '2rem',
                    backgroundColor: 'var(--bg-color)'
                }}>
                    <Header title="Ticket no encontrado" />
                    <div className="card">
                        <p>El ticket #{ticketId} no existe.</p>
                        <Link href="/tickets" style={{ color: 'var(--accent-color)' }}>← Volver a Mis Tickets</Link>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar />

            <main style={{
                flex: 1,
                marginLeft: '260px',
                padding: '2rem',
                backgroundColor: 'var(--bg-color)'
            }}>
                <div style={{ marginBottom: '1rem' }}>
                    <Link href="/tickets" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>← Volver a Mis Tickets</Link>
                </div>

                <Header title={`Ticket #T-${ticketId}`} />

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div className="card">
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>{ticket.subject}</h2>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                {ticket.description || 'Sin descripción'}
                            </p>
                        </div>

                        <div className="card">
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.5rem' }}>Actividad</h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {activities.map(activity => (
                                    <div key={activity.id} style={{ display: 'flex', gap: '1rem' }}>
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '50%',
                                            backgroundColor: activity.user === 'Demo User' ? 'var(--accent-color)' : 'var(--border-color)',
                                            color: activity.user === 'Demo User' ? 'white' : 'var(--text-primary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold'
                                        }}>
                                            {activity.user === 'Demo User' ? getUserInitials(activity.user) : <User size={16} />}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                                <span style={{ fontWeight: 500 }}>{activity.user}</span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                    {formatTimestamp(activity.timestamp)}
                                                </span>
                                            </div>
                                            <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{activity.message}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <form onSubmit={handleSubmitComment} style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                                <input
                                    type="text"
                                    placeholder="Escribir un comentario..."
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem',
                                        borderRadius: 'var(--radius)',
                                        border: '1px solid var(--border-color)',
                                        backgroundColor: 'var(--surface-color)',
                                        color: 'var(--text-primary)'
                                    }}
                                />
                                <button type="submit" className="btn btn-primary">Enviar</button>
                            </form>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="card">
                            <h3 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Detalles</h3>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.5rem' }}>Estado</label>
                                <select
                                    value={ticket.status}
                                    onChange={(e) => updateTicketStatus(ticketId, e.target.value as 'Nuevo' | 'En Progreso' | 'Resuelto')}
                                    style={{
                                        padding: '0.5rem 0.75rem',
                                        borderRadius: 'var(--radius)',
                                        border: '1px solid var(--border-color)',
                                        backgroundColor: ticket.statusColor,
                                        color: 'white',
                                        fontSize: '0.875rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        width: '100%'
                                    }}
                                >
                                    <option value="Nuevo" style={{ backgroundColor: 'var(--status-new)', color: 'white' }}>🔵 Nuevo</option>
                                    <option value="En Progreso" style={{ backgroundColor: 'var(--status-progress)', color: 'white' }}>🟡 En Progreso</option>
                                    <option value="Resuelto" style={{ backgroundColor: 'var(--status-resolved)', color: 'white' }}>🟢 Resuelto</option>
                                </select>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500 }}>Prioridad</label>
                                <span className="tag" style={{ backgroundColor: ticket.priorityColor, marginTop: '0.25rem', display: 'inline-block' }}>{ticket.priority}</span>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500 }}>Departamento</label>
                                <div style={{ marginTop: '0.25rem' }}>{ticket.department || 'N/A'}</div>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500 }}>Solicitante</label>
                                <div style={{ marginTop: '0.25rem' }}>{ticket.requester || 'Demo User'}</div>
                            </div>

                            {ticket.startedAt && (
                                <div style={{ marginBottom: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Trabajo iniciado</label>
                                    <div style={{ marginTop: '0.25rem', fontSize: '0.875rem' }}>
                                        {formatTimestamp(ticket.startedAt)}
                                    </div>
                                </div>
                            )}

                            {ticket.resolvedAt && (
                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Resuelto</label>
                                    <div style={{ marginTop: '0.25rem', fontSize: '0.875rem' }}>
                                        {formatTimestamp(ticket.resolvedAt)}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
