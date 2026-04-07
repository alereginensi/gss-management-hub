'use client';

import { useState, useEffect } from 'react';
import { useTicketContext } from '../context/TicketContext';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import { CheckCircle, FileText, Calendar, MapPin } from 'lucide-react';
import { JOB_ROLES, JobRole } from '../config/rubros';
import { getAvailableClients, getSectorsForClient } from '../config/clients';

interface Task {
    id: number;
    description: string | null;
    type: 'task' | 'check_in' | 'check_out';
    created_at: string;
    location?: string;
}

export default function TasksPage() {
    const { currentUser, isSidebarOpen, isMobile } = useTicketContext();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [description, setDescription] = useState('');
    const [client, setClient] = useState('');
    const [sector, setSector] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const availableClients = getAvailableClients();
    const availableSectors = client ? getSectorsForClient(client) : [];

    useEffect(() => {
        if (currentUser && currentUser.id !== undefined && currentUser.id !== null) {
            fetchTasks();
        }
    }, [currentUser]);

    const fetchTasks = async () => {
        if (!currentUser || currentUser.id === undefined || currentUser.id === null) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/tasks?userId=${currentUser.id}`);
            if (res.ok) {
                const data = await res.json();
                // Show only today's tasks
                const todayStr = new Date().toDateString();
                setTasks(data.filter((t: Task) => new Date(t.created_at).toDateString() === todayStr));
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRegisterTask = async () => {
        if (!currentUser || currentUser.id === undefined || currentUser.id === null) {
            alert('Error: No se detectó ID de usuario. Por favor cerrá sesión e ingresá de nuevo.');
            return;
        }

        if (!description.trim()) {
            alert('Por favor seleccioná o describí la tarea');
            return;
        }

        if (!client) {
            alert('Por favor seleccioná el cliente/lugar donde te encuentras');
            return;
        }

        if (availableSectors.length > 0 && !sector) {
            alert('Por favor seleccioná el sector dentro del cliente');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser.id,
                    description: description.trim(),
                    type: 'task',
                    location: client,
                    sector: sector || null,
                    localTimestamp: new Date().toISOString()
                })
            });

            const result = await res.json();
            if (res.ok) {
                setDescription('');
                fetchTasks();
            } else {
                alert('Error del servidor: ' + (result.error || 'Error desconocido'));
            }
        } catch (error) {
            console.error('Error submitting task:', error);
            alert('Error de conexión. No se pudo contactar con el servidor.');
        } finally {
            setSubmitting(false);
        }
    };

    const hasRubroTasks = currentUser?.rubro && JOB_ROLES[currentUser.rubro as JobRole];

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>
            <Sidebar />
            <div className="main-content" style={{
                flex: 1,
                marginLeft: (!isMobile && isSidebarOpen) ? '260px' : '0',
                transition: 'margin-left 0.3s ease-in-out',
                padding: isMobile ? '4rem 1rem 1rem' : '2rem',
                paddingTop: isMobile ? '4.5rem' : '2rem'
            }}>
                <Header title="Registro de Tareas" />

                <div style={{ maxWidth: '600px', margin: '0 auto', paddingBottom: '4rem' }}>

                    {/* TASK ENTRY PANEL */}
                    <div className="card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                            {new Date().toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </h2>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Seleccioná una tarea y confirmá para registrar la hora exacta.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* Client & Sector Selection */}
                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0 0.5rem' }}>
                                    <MapPin size={18} color="var(--text-secondary)" style={{ marginLeft: '0.5rem' }} />
                                    <select
                                        value={client}
                                        onChange={(e) => {
                                            const newClient = e.target.value;
                                            setClient(newClient);
                                            const sectors = getSectorsForClient(newClient);
                                            setSector(sectors.length === 1 && sectors[0] === 'Sector Único' ? 'Sector Único' : '');
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            border: 'none',
                                            backgroundColor: 'transparent',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.95rem',
                                            outline: 'none',
                                            appearance: 'none'
                                        }}
                                    >
                                        <option value="">Seleccioná el Cliente...</option>
                                        {availableClients.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>

                                {availableSectors.length > 0 && (
                                    <div style={{ flex: '1 1 200px' }}>
                                        {availableSectors.length === 1 && availableSectors[0] === 'Sector Único' ? (
                                            <div style={{
                                                width: '100%',
                                                padding: '0.75rem',
                                                borderRadius: 'var(--radius)',
                                                border: '1px solid var(--border-color)',
                                                backgroundColor: 'rgba(0,0,0,0.05)',
                                                color: 'var(--text-secondary)',
                                                fontSize: '0.95rem',
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}>
                                                Sector Único
                                            </div>
                                        ) : (
                                            <select
                                                value={sector}
                                                onChange={(e) => setSector(e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.75rem',
                                                    borderRadius: 'var(--radius)',
                                                    border: '1px solid var(--border-color)',
                                                    backgroundColor: 'var(--surface-color)',
                                                    color: 'var(--text-primary)',
                                                    fontSize: '0.95rem',
                                                    appearance: 'none',
                                                    outline: 'none'
                                                }}
                                            >
                                                <option value="">Selecc. Sector...</option>
                                                {availableSectors.map(s => (
                                                    <option key={s} value={s}>{s}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'stretch' }}>
                                {hasRubroTasks ? (
                                    <select
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        style={{
                                            flex: 1,
                                            padding: '0.75rem',
                                            borderRadius: 'var(--radius)',
                                            border: '1px solid var(--border-color)',
                                            backgroundColor: 'var(--surface-color)',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.95rem',
                                            appearance: 'none'
                                        }}
                                    >
                                        <option value="">Seleccioná una tarea...</option>
                                        {JOB_ROLES[currentUser!.rubro as JobRole].map(task => (
                                            <option key={task} value={task}>{task}</option>
                                        ))}
                                        <option value="Otra">Otra / No listada</option>
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Describí la tarea realizada..."
                                        onKeyDown={(e) => e.key === 'Enter' && !submitting && description.trim() && handleRegisterTask()}
                                        style={{
                                            flex: 1,
                                            padding: '0.75rem',
                                            borderRadius: 'var(--radius)',
                                            border: '1px solid var(--border-color)',
                                            backgroundColor: 'var(--surface-color)',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.95rem'
                                        }}
                                    />
                                )}

                                <button
                                    onClick={handleRegisterTask}
                                    disabled={submitting || !description.trim()}
                                    className="btn btn-primary"
                                    style={{
                                        padding: '0.75rem 1.25rem',
                                        borderRadius: 'var(--radius)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        fontWeight: 600,
                                        opacity: (!description.trim() || submitting) ? 0.6 : 1,
                                        cursor: (!description.trim() || submitting) ? 'not-allowed' : 'pointer'
                                    }}
                                    title="Registrar tarea con hora actual"
                                >
                                    <CheckCircle size={20} />
                                    {submitting ? 'Guardando...' : 'Confirmar'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* TODAY'S TIMELINE */}
                    <div style={{ position: 'relative', paddingLeft: '2rem' }}>
                        <div style={{ position: 'absolute', left: '15px', top: '0', bottom: '0', width: '2px', backgroundColor: '#e5e7eb' }}></div>

                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#374151' }}>
                            <Calendar size={18} />
                            Actividades de hoy
                        </h3>

                        {loading ? (
                            <p style={{ color: '#6b7280', fontStyle: 'italic', paddingLeft: '1rem' }}>Cargando...</p>
                        ) : tasks.length === 0 ? (
                            <p style={{ color: '#6b7280', fontStyle: 'italic', paddingLeft: '1rem' }}>
                                Aún no hay actividad registrada hoy.
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {tasks.map((task) => {
                                    const time = new Date(task.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    return (
                                        <div key={task.id} style={{ position: 'relative' }}>
                                            <div style={{
                                                position: 'absolute',
                                                left: '-2.15rem',
                                                top: '0.25rem',
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '50%',
                                                backgroundColor: '#dbeafe',
                                                color: '#29416b',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                border: `2px solid #fff`,
                                                boxShadow: '0 0 0 1px #e5e7eb',
                                                zIndex: 10
                                            }}>
                                                <FileText size={16} />
                                            </div>

                                            <div className="card" style={{ padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                                    <span style={{ fontWeight: 600, color: '#29416b', fontSize: '0.875rem' }}>Tarea Registrada</span>
                                                    <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600 }}>{time}</span>
                                                </div>
                                                {task.description && (
                                                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#1f2937', lineHeight: 1.5 }}>
                                                        {task.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
