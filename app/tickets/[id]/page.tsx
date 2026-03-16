'use client';

import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import { User, Paperclip, UserPlus, X, Folder, CheckSquare, Square, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTicketContext } from '../../context/TicketContext';
import { useState, use, useEffect } from 'react';

export default function TicketDetail({ params }: { params: Promise<{ id: string }> }) {
    const { tickets, getActivitiesByTicket, addActivity, updateTicketStatus, currentUser, transferTicket, addCollaborator, removeCollaborator, getTicketCollaborators, allUsers, fetchAllUsers, loadTicketActivities, isSidebarOpen, isMobile, loading, folders, addTicketToFolder, removeTicketFromFolder, getTicketFolderId, fetchTickets } = useTicketContext() as any;
    const router = useRouter();
    const [comment, setComment] = useState('');
    const [collaborators, setCollaborators] = useState<any[]>([]);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showAddCollaboratorModal, setShowAddCollaboratorModal] = useState(false);
    const [selectedSupervisor, setSelectedSupervisor] = useState('');
    const [selectedCollaborator, setSelectedCollaborator] = useState('');
    const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
    const [showFolderMenu, setShowFolderMenu] = useState(false);
    const [teamTasks, setTeamTasks] = useState<any[]>([]);
    const [completingTask, setCompletingTask] = useState<number | null>(null);

    const resolvedParams = use(params);
    const ticketId = resolvedParams.id;
    const [fetchedTicket, setFetchedTicket] = useState<any>(null);
    const [fetchError, setFetchError] = useState(false);
    const ticket = tickets.find((t: any) => t.id === ticketId) || fetchedTicket;
    const activities = getActivitiesByTicket(ticketId);

    const isOwner = ticket?.requesterEmail === currentUser?.email;
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'jefe';
    const isSupervisor = ticket?.supervisor === currentUser?.name;
    const isCollaborator = collaborators.some((c: any) => c.user_id === currentUser?.id);
    const isTeamMember = teamTasks.some((t: any) => Number(t.user_id) === Number(currentUser?.id));
    const canSeeTicket = ticket && (isAdmin || isOwner || isSupervisor || isCollaborator || isTeamMember || !!(ticket.isTeamTicket || ticket.is_team_ticket));

    const handleSubmitComment = (e: React.FormEvent) => {
        e.preventDefault();
        if (comment.trim()) {
            addActivity(ticketId, currentUser?.name || 'Usuario', comment);
            setComment('');
        }
    };

    const formatTimestamp = (timestamp: Date | string) => {
        const now = new Date();
        const ts = timestamp instanceof Date ? timestamp : new Date(timestamp);
        if (isNaN(ts.getTime())) return 'Fecha desconocida';
        const diff = Math.floor((now.getTime() - ts.getTime()) / 1000);

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

    // If ticket not in context, fetch it directly from API
    useEffect(() => {
        if (!ticketId || tickets.find((t: any) => t.id === ticketId)) return;
        const token = localStorage.getItem('authToken');
        fetch(`/api/tickets/${ticketId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(setFetchedTicket)
            .catch(() => setFetchError(true));
    }, [ticketId, tickets]);

    // Load collaborators, activities and team tasks on mount
    useEffect(() => {
        if (ticketId) {
            getTicketCollaborators(ticketId).then(setCollaborators);
            loadTicketActivities(ticketId);
        }
        fetchAllUsers();
    }, [ticketId]);

    useEffect(() => {
        const isTeamTicket = ticket?.is_team_ticket || ticket?.isTeamTicket;
        if (isTeamTicket && ticketId) {
            const token = localStorage.getItem('authToken');
            fetch(`/api/tickets/${ticketId}/tasks`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            })
                .then(r => r.ok ? r.json() : [])
                .then(setTeamTasks);
        }
    }, [ticket?.is_team_ticket, ticket?.isTeamTicket, ticketId]);

    const handleCompleteTask = async (taskId: number) => {
        setCompletingTask(taskId);
        try {
            const token = localStorage.getItem('authToken');
            const res = await fetch(`/api/tickets/${ticketId}/tasks`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ taskId })
            });
            const data = await res.json();
            if (res.ok) {
                setTeamTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: 1 } : t));
                if (data.allDone) {
                    // Refresh ticket from API so status reflects "Resuelto"
                    const token = localStorage.getItem('authToken');
                    fetch(`/api/tickets/${ticketId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
                        .then(r => r.ok ? r.json() : null)
                        .then(updated => { if (updated) setFetchedTicket(updated); });
                    fetchTickets();
                }
            } else {
                alert(data.error || 'Error al completar la tarea');
            }
        } finally {
            setCompletingTask(null);
        }
    };

    // Debug: log when allUsers changes
    useEffect(() => {
        console.log('✅ allUsers updated:', allUsers.length, 'users');
    }, [allUsers]);

    const handleTransferTicket = async () => {
        if (!selectedSupervisor) return;
        const supervisorUser = allUsers.find((u: any) => u.name === selectedSupervisor);
        if (!supervisorUser) return;

        console.log('🔄 Transferring ticket:', ticketId, 'to:', supervisorUser.name, 'ID:', supervisorUser.id);

        try {
            const success = await transferTicket(ticketId, supervisorUser.id, currentUser?.id ?? 0);
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
        const collaboratorUser = allUsers.find((u: any) => u.name === selectedCollaborator);
        if (!collaboratorUser) return;

        const success = await addCollaborator(ticketId, collaboratorUser.id, currentUser?.id ?? 0);
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

    if (loading) {
        return (
            <div style={{ display: 'flex', minHeight: '100vh' }}>
                <Sidebar />
                <main style={{
                    flex: 1,
                    marginLeft: (!isMobile && isSidebarOpen) ? '260px' : '0',
                    transition: 'margin-left 0.3s ease-in-out',
                    padding: isMobile ? '1rem' : '2rem',
                    backgroundColor: 'var(--bg-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div className="spinner" style={{
                            width: '40px',
                            height: '40px',
                            border: '4px solid var(--border-color)',
                            borderTop: '4px solid var(--accent-color)',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            margin: '0 auto 1rem'
                        }}></div>
                        <p style={{ color: 'var(--text-secondary)' }}>Cargando ticket...</p>
                        <style jsx>{`
                            @keyframes spin {
                                0% { transform: rotate(0deg); }
                                100% { transform: rotate(360deg); }
                            }
                        `}</style>
                    </div>
                </main>
            </div>
        );
    }

    if (!canSeeTicket) {
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
                    <Header title="Ticket no encontrado" />
                    <div className="card">
                        <p>El ticket #{ticketId} no existe o no tienes permiso para verlo.</p>
                        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-color)', fontSize: '0.875rem', padding: 0 }}>← Volver</button>
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
                marginLeft: (!isMobile && isSidebarOpen) ? '260px' : '0',
                transition: 'margin-left 0.3s ease-in-out',
                padding: isMobile ? '1rem' : '2rem',
                backgroundColor: 'var(--bg-color)'
            }}>
                <div style={{ marginBottom: '1rem' }}>
                    <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.875rem', padding: 0 }}>← Volver</button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                    <h1 style={{ fontSize: isMobile ? '1.25rem' : '1.5rem', fontWeight: 700, flex: 1 }}>Ticket #T-{ticketId}</h1>
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowFolderMenu(v => !v)}
                            title="Mover a carpeta"
                            style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', cursor: 'pointer', padding: '0.4rem 0.75rem', color: getTicketFolderId(ticketId) ? 'var(--accent-color)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
                        >
                            <Folder size={16} />
                            {getTicketFolderId(ticketId) ? (folders.find((f: any) => f.id === getTicketFolderId(ticketId))?.name ?? 'Carpeta') : 'Carpeta'}
                        </button>
                        {showFolderMenu && (
                            <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 100, backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '180px', overflow: 'hidden' }}>
                                {folders.length === 0 && (
                                    <div style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No tenés carpetas aún</div>
                                )}
                                {getTicketFolderId(ticketId) && (
                                    <button
                                        onClick={async () => { await removeTicketFromFolder(ticketId, getTicketFolderId(ticketId)); setShowFolderMenu(false); }}
                                        style={{ width: '100%', textAlign: 'left', padding: '0.65rem 1rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', color: '#ef4444', borderBottom: folders.length > 0 ? '1px solid var(--border-color)' : 'none' }}
                                    >
                                        Quitar de carpeta
                                    </button>
                                )}
                                {folders.map((f: any) => (
                                    <button
                                        key={f.id}
                                        onClick={async () => { await addTicketToFolder(ticketId, f.id); setShowFolderMenu(false); }}
                                        style={{ width: '100%', textAlign: 'left', padding: '0.65rem 1rem', background: getTicketFolderId(ticketId) === f.id ? 'rgba(59,130,246,0.08)' : 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', color: getTicketFolderId(ticketId) === f.id ? 'var(--accent-color)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                    >
                                        <Folder size={14} /> {f.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr',
                    gap: isMobile ? '1.5rem' : '2rem'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '1.5rem' : '2rem' }}>
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
                                            backgroundColor: activity.user === currentUser?.name ? 'var(--accent-color)' : 'var(--border-color)',
                                            color: activity.user === currentUser?.name ? 'white' : 'var(--text-primary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold'
                                        }}>
                                            {activity.user === currentUser?.name ? getUserInitials(activity.user) : <User size={16} />}
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
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Resuelto el</label>
                                    <div style={{ marginTop: '0.25rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--status-resolved)' }}>
                                        {new Date(ticket.resolvedAt).toLocaleString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            )}

                            {ticket.attachmentUrl && (
                                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Adjuntos</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {(() => {
                                            let urls: string[] = [];
                                            try {
                                                // Try to parse as JSON array (new format)
                                                urls = JSON.parse(ticket.attachmentUrl);
                                                if (!Array.isArray(urls)) {
                                                    urls = [ticket.attachmentUrl];
                                                }
                                            } catch (e) {
                                                // Fallback to single string or comma separated legacy format (mostly single string)
                                                urls = ticket.attachmentUrl.includes(',')
                                                    ? ticket.attachmentUrl.split(',')
                                                    : [ticket.attachmentUrl];
                                            }

                                            return urls.map((url, i) => {
                                                const trimmedUrl = url.trim();
                                                if (!trimmedUrl) return null;
                                                // Extract original file name if possible
                                                let fileName = `Archivo adjunto ${i + 1}`;
                                                const match = trimmedUrl.match(/filename=\d+-(.+)$/);
                                                if (match && match[1]) {
                                                    fileName = decodeURIComponent(match[1]);
                                                } else {
                                                    const parts = trimmedUrl.split('/');
                                                    const lastPart = parts[parts.length - 1];
                                                    if (lastPart && lastPart !== 'download') {
                                                        fileName = decodeURIComponent(lastPart);
                                                    }
                                                }

                                                const isDownloading = downloadingFile === trimmedUrl;
                                                const handleDownload = async () => {
                                                    if (isDownloading) return;
                                                    setDownloadingFile(trimmedUrl);
                                                    try {
                                                        const token = localStorage.getItem('authToken');
                                                        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
                                                        const res = await fetch(trimmedUrl, { headers });
                                                        if (!res.ok) { alert('Error al descargar el archivo'); return; }
                                                        const blob = await res.blob();
                                                        const blobUrl = URL.createObjectURL(blob);
                                                        const a = document.createElement('a');
                                                        a.href = blobUrl;
                                                        a.download = fileName;
                                                        a.click();
                                                        URL.revokeObjectURL(blobUrl);
                                                    } catch {
                                                        alert('Error al descargar el archivo');
                                                    } finally {
                                                        setDownloadingFile(null);
                                                    }
                                                };

                                                return (
                                                    <button
                                                        key={i}
                                                        onClick={handleDownload}
                                                        disabled={isDownloading}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.5rem',
                                                            padding: '0.75rem',
                                                            backgroundColor: 'var(--bg-color)',
                                                            borderRadius: 'var(--radius)',
                                                            border: '1px solid var(--border-color)',
                                                            color: isDownloading ? 'var(--text-secondary)' : 'var(--accent-color)',
                                                            cursor: isDownloading ? 'wait' : 'pointer',
                                                            fontSize: '0.875rem',
                                                            fontWeight: 500,
                                                            width: '100%',
                                                            textAlign: 'left'
                                                        }}
                                                    >
                                                        <Paperclip size={16} />
                                                        {isDownloading ? 'Descargando...' : fileName}
                                                    </button>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Team Tasks Section */}
                        {ticket?.is_team_ticket === 1 && teamTasks.length > 0 && (
                            <div className="card">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <Users size={16} color="var(--accent-color)" />
                                    <h3 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-secondary)', margin: 0 }}>Equipo de Trabajo</h3>
                                </div>

                                {/* Progress bar */}
                                {(() => {
                                    const done = teamTasks.filter(t => t.completed === 1 || t.completed === true).length;
                                    const total = teamTasks.length;
                                    const pct = Math.round((done / total) * 100);
                                    return (
                                        <div style={{ marginBottom: '1rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                                                <span>{done}/{total} completadas</span>
                                                <span>{pct}%</span>
                                            </div>
                                            <div style={{ height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                                                <div style={{ width: `${pct}%`, height: '100%', backgroundColor: pct === 100 ? 'var(--status-resolved)' : 'var(--accent-color)', borderRadius: '3px', transition: 'width 0.4s ease' }} />
                                            </div>
                                        </div>
                                    );
                                })()}

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                    {teamTasks.map((task: any) => {
                                        const isMyTask = Number(task.user_id) === Number(currentUser?.id);
                                        const isDone = task.completed === 1 || task.completed === true;
                                        const isLoading = completingTask === task.id;
                                        return (
                                            <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius)', backgroundColor: isDone ? 'rgba(34,197,94,0.07)' : isMyTask ? 'rgba(59,130,246,0.06)' : 'var(--bg-color)', border: `1px solid ${isDone ? 'rgba(34,197,94,0.25)' : isMyTask ? 'rgba(59,130,246,0.25)' : 'var(--border-color)'}`, transition: 'all 0.2s' }}>
                                                <button
                                                    onClick={() => !isDone && isMyTask && handleCompleteTask(task.id)}
                                                    disabled={isDone || !isMyTask || isLoading}
                                                    style={{ background: 'none', border: 'none', padding: 0, cursor: isDone || !isMyTask ? 'default' : 'pointer', color: isDone ? 'var(--status-resolved)' : isMyTask ? 'var(--accent-color)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', flexShrink: 0, marginTop: '1px' }}
                                                    title={isMyTask && !isDone ? 'Marcar como completada' : isDone ? 'Completada' : 'Solo el responsable puede marcar esta tarea'}
                                                >
                                                    {isLoading ? (
                                                        <div style={{ width: 18, height: 18, border: '2px solid var(--accent-color)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                                    ) : isDone ? (
                                                        <CheckSquare size={18} />
                                                    ) : (
                                                        <Square size={18} />
                                                    )}
                                                </button>
                                                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: isDone ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {task.user_name} {isMyTask && <span style={{ fontWeight: 400, color: 'var(--accent-color)' }}>(vos)</span>}
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem', wordBreak: 'break-word' }}>{task.task_description}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                            </div>
                        )}

                        {/* Transfer Ticket Section - Admin/Supervisor only */}
                        {(isAdmin || currentUser?.role === 'supervisor') && (
                            <div className="card">
                                <h3 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Transferir Ticket</h3>
                                <button
                                    onClick={() => setShowTransferModal(true)}
                                    className="btn btn-secondary"
                                    style={{ width: '100%' }}
                                >
                                    Cambiar Colaborador
                                </button>
                            </div>
                        )}

                        {/* Collaborators Section - visible to all, add/remove only for admin/supervisor */}
                        <div className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-secondary)', margin: 0 }}>Colaboradores</h3>
                                {(isAdmin || currentUser?.role === 'supervisor') && (
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
                                        title="Agregar colaborador"
                                    >
                                        <UserPlus size={16} />
                                    </button>
                                )}
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
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{collab.role}</div>
                                                </div>
                                            </div>
                                            {(isAdmin || currentUser?.role === 'supervisor') && (
                                                <button
                                                    onClick={() => handleRemoveCollaborator(collab.user_id, collab.name)}
                                                    title="Remover colaborador"
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: 'var(--text-secondary)',
                                                        cursor: 'pointer',
                                                        padding: '0.25rem',
                                                        opacity: 0.6
                                                    }}
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
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
                        alignItems: isMobile ? 'flex-end' : 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}>
                        <div className="card" style={{
                            width: isMobile ? '100%' : '400px',
                            maxWidth: isMobile ? '100%' : '90%',
                            borderRadius: isMobile ? '20px 20px 0 0' : 'var(--radius)',
                            padding: isMobile ? '2rem 1.5rem 3rem' : '2rem'
                        }}>
                            <h3 style={{ marginBottom: '1rem' }}>Transferir Ticket</h3>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Colaborador Actual</label>
                                <div style={{ padding: '0.5rem', backgroundColor: 'var(--surface-color)', borderRadius: 'var(--radius)' }}>
                                    {ticket.supervisor || 'Sin asignar'}
                                </div>
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Nuevo Colaborador</label>
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
                                    <option value="">Seleccionar colaborador...</option>
                                    {allUsers.filter((u: any) => u.role === 'supervisor' || u.role === 'admin' || u.role === 'jefe').map((user: any) => (
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
                        alignItems: isMobile ? 'flex-end' : 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}>
                        <div className="card" style={{
                            width: isMobile ? '100%' : '400px',
                            maxWidth: isMobile ? '100%' : '90%',
                            borderRadius: isMobile ? '20px 20px 0 0' : 'var(--radius)',
                            padding: isMobile ? '2rem 1.5rem 3rem' : '2rem'
                        }}>
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
                                    {allUsers.filter((u: any) => !collaborators.some((c: any) => c.user_id === u.id)).map((user: any) => (
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
