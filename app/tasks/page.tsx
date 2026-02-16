'use client';

import { useState, useEffect } from 'react';
import { useTicketContext } from '../context/TicketContext';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import { Clock, CheckCircle, LogIn, LogOut, FileText, Calendar, AlertCircle } from 'lucide-react';
import { JOB_ROLES, JobRole } from '../config/rubros';

interface Task {
    id: number;
    description: string | null;
    type: 'task' | 'check_in' | 'check_out';
    created_at: string;
    location?: string;
}

export default function TasksPage() {
    const { currentUser, isSidebarOpen } = useTicketContext();
    const router = useRouter();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [description, setDescription] = useState('');
    const [selectedLocation, setSelectedLocation] = useState<string | ''>('');
    const [selectedSector, setSelectedSector] = useState<string | ''>('');
    const [locations, setLocations] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        // Log for debugging
        console.log("TasksPage: Render with user", currentUser);
        if (currentUser && (currentUser.id !== undefined && currentUser.id !== null)) {
            fetchTasks();
            fetchLocations();
        }
    }, [currentUser]);

    const fetchLocations = async () => {
        try {
            const res = await fetch('/api/config/locations');
            if (res.ok) {
                setLocations(await res.json());
            }
        } catch (error) {
            console.error('Error fetching locations:', error);
        }
    };

    const fetchTasks = async () => {
        if (!currentUser || (currentUser.id === undefined || currentUser.id === null)) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/tasks?userId=${currentUser.id}`);
            if (res.ok) {
                const data = await res.json();
                setTasks(data);
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (type: 'task' | 'check_in' | 'check_out') => {
        // EXPLICIT ALERT TO CONFIRM CLICK
        console.log("handleRegister started:", type);

        if (!currentUser || (currentUser.id === undefined || currentUser.id === null)) {
            alert('Error: No se detectó ID de usuario. Por favor intenta cerrar sesión e ingresar de nuevo.');
            return;
        }

        if (type === 'task' && !description.trim()) {
            alert('Por favor describe la tarea');
            return;
        }

        if (type === 'check_in' && !selectedLocation) {
            alert('Debe seleccionar en qué lugar está trabajando.');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser.id,
                    description: type === 'task' ? description : (type === 'check_in' ? `Ingreso en: ${selectedLocation}${selectedSector ? ' - ' + selectedSector : ''}` : 'Salida registrada'),
                    type: type,
                    location: type === 'check_in' ? selectedLocation : null,
                    sector: type === 'check_in' ? selectedSector : null,
                    localTimestamp: new Date().toISOString()
                })
            });

            const result = await res.json();

            if (res.ok) {
                alert('¡Éxito! Actividad registrada.');
                if (type === 'task') setDescription('');
                fetchTasks();
            } else {
                alert('Error del servidor: ' + (result.error || 'Error desconocido'));
            }
        } catch (error) {
            console.error('Error submitting:', error);
            alert('Error de conexión: No se pudo contactar con el servidor.');
        } finally {
            setSubmitting(false);
        }
    };

    // Helper to get sectors for selected location
    const getSectorsForLocation = (locName: string) => {
        const location = locations.find(l => l.name === locName);
        return location?.sectors || [];
    };

    // Determine state logic
    const chronoTasks = [...tasks].reverse();
    let isCheckedIn = false;
    let hasCheckInToday = false;
    let hasCheckOutToday = false;

    const todayStr = new Date().toDateString();

    chronoTasks.forEach(t => {
        const taskDate = new Date(t.created_at).toDateString();
        if (taskDate === todayStr) {
            if (t.type === 'check_in') {
                isCheckedIn = true;
                hasCheckInToday = true;
            } else if (t.type === 'check_out') {
                isCheckedIn = false;
                hasCheckOutToday = true;
            }
        }
    });

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>
            <Sidebar />
            <div className="main-content" style={{
                flex: 1,
                marginLeft: isSidebarOpen ? '260px' : '0',
                transition: 'margin-left 0.3s ease-in-out',
                padding: '2rem'
            }}>
                <Header title="Registro de Tareas" />

                <div style={{ maxWidth: '600px', margin: '0 auto', paddingBottom: '4rem' }}>

                    {/* DEBUG PANEL (Visible for troubleshooting) */}
                    <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: '1rem', padding: '0.5rem', border: '1px dashed #ccc' }}>
                        DEBUG: UserID: {currentUser?.id ?? 'NULL'} | Role: {currentUser?.role ?? 'NULL'} | InToday: {hasCheckInToday ? 'YES' : 'NO'} | OutToday: {hasCheckOutToday ? 'YES' : 'NO'}
                    </div>

                    {/* CONTROL PANEL */}
                    <div className="card" style={{ padding: '2rem', marginBottom: '2rem', textAlign: 'center' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                            Control de Jornada ({new Date().toLocaleDateString()})
                        </h2>

                        {!isCheckedIn && !hasCheckInToday && (
                            <div style={{ marginBottom: '1.5rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                                        ¿Dónde estás ingresando? <span style={{ color: 'red' }}>*</span>
                                    </label>
                                    <select
                                        value={selectedLocation}
                                        onChange={(e) => {
                                            setSelectedLocation(e.target.value);
                                            setSelectedSector('');
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            borderRadius: 'var(--radius)',
                                            border: '1px solid var(--border-color)',
                                            backgroundColor: '#fff',
                                            color: '#000',
                                            appearance: 'none'
                                        }}
                                    >
                                        <option value="">Seleccione un lugar...</option>
                                        {locations.map(loc => (
                                            <option key={loc.id} value={loc.name}>{loc.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {selectedLocation && getSectorsForLocation(selectedLocation).length > 0 && (
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                                            Sector (Opcional)
                                        </label>
                                        <select
                                            value={selectedSector}
                                            onChange={(e) => setSelectedSector(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '0.75rem',
                                                borderRadius: 'var(--radius)',
                                                border: '1px solid var(--border-color)',
                                                backgroundColor: '#fff',
                                                color: '#000',
                                                appearance: 'none'
                                            }}
                                        >
                                            <option value="">Todos los sectores (General)</option>
                                            {getSectorsForLocation(selectedLocation).map((s: any) => (
                                                <option key={s.id} value={s.name}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '2rem' }}>
                            <button
                                id="btn-checkin"
                                onClick={() => handleRegister('check_in')}
                                disabled={submitting || loading || hasCheckInToday}
                                className="btn"
                                style={{
                                    backgroundColor: hasCheckInToday ? '#eee' : '#22c55e',
                                    color: hasCheckInToday ? '#888' : '#fff',
                                    border: 'none',
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '8px',
                                    cursor: hasCheckInToday ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    opacity: hasCheckInToday ? 0.6 : 1
                                }}
                            >
                                <LogIn size={20} />
                                Marcar Ingreso
                            </button>

                            <button
                                id="btn-checkout"
                                onClick={() => handleRegister('check_out')}
                                disabled={submitting || loading || !isCheckedIn || hasCheckOutToday}
                                className="btn"
                                style={{
                                    backgroundColor: (!isCheckedIn || hasCheckOutToday) ? '#eee' : '#ef4444',
                                    color: (!isCheckedIn || hasCheckOutToday) ? '#888' : '#fff',
                                    border: 'none',
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '8px',
                                    cursor: (!isCheckedIn || hasCheckOutToday) ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    opacity: (!isCheckedIn || hasCheckOutToday) ? 0.6 : 1
                                }}
                            >
                                <LogOut size={20} />
                                Marcar Salida
                            </button>
                        </div>

                        {isCheckedIn ? (
                            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', textAlign: 'left' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Nueva Actividad / Tarea</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {currentUser?.rubro && JOB_ROLES[currentUser.rubro as JobRole] ? (
                                        <select
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            style={{ flex: 1, padding: '0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', backgroundColor: '#fff', color: '#000', appearance: 'none' }}
                                        >
                                            <option value="">Seleccione una tarea...</option>
                                            {JOB_ROLES[currentUser.rubro as JobRole].map(task => (
                                                <option key={task} value={task}>{task}</option>
                                            ))}
                                            <option value="Otra">Otra / No listada</option>
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="Describa la tarea realizada..."
                                            style={{ flex: 1, padding: '0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', backgroundColor: '#fff', color: '#000' }}
                                        />
                                    )}
                                    <button
                                        onClick={() => handleRegister('task')}
                                        disabled={submitting || !description.trim()}
                                        className="btn btn-primary"
                                        style={{ backgroundColor: '#29416b', color: '#fff', padding: '0.75rem', borderRadius: '8px' }}
                                    >
                                        <CheckCircle size={20} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius)', color: '#ef4444', fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                <AlertCircle size={16} />
                                {hasCheckOutToday ? 'Jornada finalizada por hoy.' : 'Debes marcar el ingreso para registrar tareas.'}
                            </div>
                        )}
                    </div>

                    {/* TIMELINE */}
                    <div style={{ position: 'relative', paddingLeft: '2rem' }}>
                        <div style={{ position: 'absolute', left: '15px', top: '0', bottom: '0', width: '2px', backgroundColor: '#e5e7eb' }}></div>

                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#374151' }}>
                            <Calendar size={18} />
                            Linea de Tiempo (Hoy)
                        </h3>

                        {tasks.length === 0 ? (
                            <p style={{ color: '#6b7280', fontStyle: 'italic', paddingLeft: '1rem' }}>No hay actividad registrada hoy.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {tasks.map((task) => {
                                    const date = new Date(task.created_at);
                                    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                                    let icon = <FileText size={16} />;
                                    let color = '#6b7280';
                                    let bg = '#f3f4f6';
                                    let title = 'Tarea Registrada';

                                    if (task.type === 'check_in') {
                                        icon = <LogIn size={16} />;
                                        color = '#22c55e';
                                        bg = '#dcfce7';
                                        title = 'Ingreso a Jornada';
                                    } else if (task.type === 'check_out') {
                                        icon = <LogOut size={16} />;
                                        color = '#ef4444';
                                        bg = '#fee2e2';
                                        title = 'Salida de Jornada';
                                    } else {
                                        icon = <CheckCircle size={16} />;
                                        color = '#29416b';
                                        bg = '#dbeafe';
                                    }

                                    return (
                                        <div key={task.id} style={{ position: 'relative' }}>
                                            <div style={{
                                                position: 'absolute',
                                                left: '-2.15rem',
                                                top: '0.25rem',
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '50%',
                                                backgroundColor: bg,
                                                color: color,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                border: `2px solid #fff`,
                                                boxShadow: '0 0 0 1px #e5e7eb',
                                                zIndex: 10
                                            }}>
                                                {icon}
                                            </div>

                                            <div className="card" style={{ padding: '1rem', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                    <span style={{ fontWeight: 600, color: color, fontSize: '0.875rem' }}>{title}</span>
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
