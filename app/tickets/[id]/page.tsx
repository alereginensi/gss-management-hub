'use client';

import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import { User, Paperclip, UserPlus, X } from 'lucide-react';
import Link from 'next/link';
import { useTicketContext } from '../../context/TicketContext';
import { useState, use, useEffect } from 'react';

export default function TicketDetail({ params }: { params: Promise<{ id: string }> }) {
    const { tickets, getActivitiesByTicket, addActivity, updateTicketStatus, currentUser, transferTicket, addCollaborator, removeCollaborator, getTicketCollaborators, allUsers, fetchAllUsers } = useTicketContext();
    const [comment, setComment] = useState('');
    const [collaborators, setCollaborators] = useState<any[]>([]);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showAddCollaboratorModal, setShowAddCollaboratorModal] = useState(false);
    const [selectedSupervisor, setSelectedSupervisor] = useState('');
    const [selectedCollaborator, setSelectedCollaborator] = useState('');

    const resolvedParams = use(params);
    const ticketId = resolvedParams.id;
    const ticket = tickets.find(t => t.id === ticketId);
    const activities = getActivitiesByTicket(ticketId);

    const isOwner = ticket?.requesterEmail === currentUser.email;
    const isAdmin = currentUser.role === 'admin';
    const isSupervisor = ticket?.supervisor === currentUser.name;
    const isCollaborator = collaborators.some(c => c.user_id === currentUser.id);
    const canSeeTicket = ticket && (isAdmin || isOwner || isSupervisor || isCollaborator);

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

    // Load collaborators on mount
    useEffect(() => {
        if (ticketId) {
            getTicketCollaborators(ticketId).then(setCollaborators);
        }
        // Load all users for dropdowns
        fetchAllUsers();
        console.log('🔍 Ticket Detail - allUsers:', allUsers);
    }, [ticketId]);

    // Debug: log when allUsers changes
    useEffect(() => {
        console.log('✅ allUsers updated:', allUsers.length, 'users');
    }, [allUsers]);

    const handleTransferTicket = async () => {
        if (!selectedSupervisor) return;
        const supervisorUser = allUsers.find(u => u.name === selectedSupervisor);
        if (!supervisorUser) return;

        console.log('🔄 Transferring ticket:', ticketId, 'to:', supervisorUser.name, 'ID:', supervisorUser.id);

        try {
            const success = await transferTicket(ticketId, supervisorUser.id, currentUser.id);
            console.log('Transfer result:', success);
            if (success) {
                setShowTransferModal(false);
                setSelectedSupervisor('');
                addActivity(ticketId, 'Sistema', `Ticket transferido a ${supervisorUser.name}`);
                alert('Ticket transferido exitosamente');
            } else {
                alert('Error al transferir el ticket');
            }
        } catch (error) {
            console.error('Error in handleTransferTicket:', error);
            alert('Error al transferir el ticket: ' + error);
        }
    };

    const handleAddCollaborator = async () => {
        if (!selectedCollaborator) return;
        const collaboratorUser = allUsers.find(u => u.name === selectedCollaborator);
        if (!collaboratorUser) return;

        const success = await addCollaborator(ticketId, collaboratorUser.id, currentUser.id);
        if (success) {
            setShowAddCollaboratorModal(false);
            setSelectedCollaborator('');
            getTicketCollaborators(ticketId).then(setCollaborators);
            addActivity(ticketId, 'Sistema', `${collaboratorUser.name} agregado como colaborador`);
        }
    };

    const handleRemoveCollaborator = async (userId: number, userName: string) => {
        const success = await removeCollaborator(ticketId, userId);
        if (success) {
            getTicketCollaborators(ticketId).then(setCollaborators);
            addActivity(ticketId, 'Sistema', `${userName} removido como colaborador`);
        }
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
                                            backgroundColor: activity.user === currentUser.name ? 'var(--accent-color)' : 'var(--border-color)',
                                            color: activity.user === currentUser.name ? 'white' : 'var(--text-primary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold'
                                        }}>
                                            {activity.user === currentUser.name ? getUserInitials(activity.user) : <User size={16} />}
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
                                <div style={{ marginTop: '0.25rem' }}>{ticket.requester || 'Sin asignar'}</div>
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

                        {/* Transfer Ticket Section - Admin/Supervisor only */}
                        {(isAdmin || currentUser.role === 'supervisor') && (
                            <div className="card">
                                <h3 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Transferir Ticket</h3>
                                <button
                                    onClick={() => setShowTransferModal(true)}
                                    className="btn btn-secondary"
                                    style={{ width: '100%' }}
                                >
                                    Cambiar Supervisor
                                </button>
                            </div>
                        )}

                        {/* Collaborators Section */}
                        <div className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-secondary)', margin: 0 }}>Colaboradores</h3>
                                <button
                                    onClick={() => setShowAddCollaboratorModal(true)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--accent-color)',
                                        cursor: 'pointer',
                                        padding: '0.25rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.25rem'
                                    }}
                                >
                                    <UserPlus size={16} />
                                </button>
                            </div>

                            {collaborators.length === 0 ? (
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Sin colaboradores</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {collaborators.map((collab: any) => (
                                        <div key={collab.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{
                                                    width: '28px',
                                                    height: '28px',
                                                    borderRadius: '50%',
                                                    backgroundColor: 'var(--accent-color)',
                                                    color: 'white',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 'bold'
                                                }}>
                                                    {getUserInitials(collab.name)}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{collab.name}</div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{collab.role}</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveCollaborator(collab.user_id, collab.name)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: 'var(--text-secondary)',
                                                    cursor: 'pointer',
                                                    padding: '0.25rem'
                                                }}
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Transfer Modal */}
                {showTransferModal && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}>
                        <div className="card" style={{ width: '400px', maxWidth: '90%' }}>
                            <h3 style={{ marginBottom: '1rem' }}>Transferir Ticket</h3>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Supervisor Actual</label>
                                <div style={{ padding: '0.5rem', backgroundColor: 'var(--surface-color)', borderRadius: 'var(--radius)' }}>
                                    {ticket.supervisor || 'Sin asignar'}
                                </div>
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Nuevo Supervisor</label>
                                <select
                                    value={selectedSupervisor}
                                    onChange={(e) => setSelectedSupervisor(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '0.5rem',
                                        borderRadius: 'var(--radius)',
                                        border: '1px solid var(--border-color)',
                                        backgroundColor: 'var(--surface-color)',
                                        color: 'var(--text-primary)'
                                    }}
                                >
                                    <option value="">Seleccionar supervisor...</option>
                                    {allUsers.filter(u => u.role === 'supervisor' || u.role === 'admin').map(user => (
                                        <option key={user.id} value={user.name}>{user.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => { setShowTransferModal(false); setSelectedSupervisor(''); }}
                                    className="btn btn-secondary"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleTransferTicket}
                                    className="btn btn-primary"
                                    disabled={!selectedSupervisor}
                                >
                                    Transferir
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Add Collaborator Modal */}
                {showAddCollaboratorModal && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}>
                        <div className="card" style={{ width: '400px', maxWidth: '90%' }}>
                            <h3 style={{ marginBottom: '1rem' }}>Agregar Colaborador</h3>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Seleccionar Usuario</label>
                                <select
                                    value={selectedCollaborator}
                                    onChange={(e) => setSelectedCollaborator(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '0.5rem',
                                        borderRadius: 'var(--radius)',
                                        border: '1px solid var(--border-color)',
                                        backgroundColor: 'var(--surface-color)',
                                        color: 'var(--text-primary)'
                                    }}
                                >
                                    <option value="">Seleccionar usuario...</option>
                                    {allUsers.filter(u => !collaborators.some(c => c.user_id === u.id)).map(user => (
                                        <option key={user.id} value={user.name}>{user.name} ({user.role})</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => { setShowAddCollaboratorModal(false); setSelectedCollaborator(''); }}
                                    className="btn btn-secondary"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleAddCollaborator}
                                    className="btn btn-primary"
                                    disabled={!selectedCollaborator}
                                >
                                    Agregar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
