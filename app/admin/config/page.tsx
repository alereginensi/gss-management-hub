'use client';

import { useState, useEffect } from 'react';
import { useTicketContext, DEPARTMENTS } from '../../context/TicketContext';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { MapPin, Briefcase, Plus, Trash2, Edit, Save, X, Zap, Mail, Database, Download, ShieldCheck, RefreshCw } from 'lucide-react';

const LocationItem = ({ location, onDelete, onRefresh }: { location: any, onDelete: (id: number) => void, onRefresh: () => void }) => {
    const [isAddingSector, setIsAddingSector] = useState(false);
    const [newSectorName, setNewSectorName] = useState('');

    const handleAddSector = async () => {
        if (!newSectorName.trim()) return;
        try {
            const res = await fetch('/api/config/sectors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newSectorName, location_id: location.id })
            });
            if (res.ok) {
                setNewSectorName('');
                setIsAddingSector(false);
                onRefresh();
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleDeleteSector = async (sectorId: number) => {
        if (!confirm('¿Eliminar este sector?')) return;
        try {
            const res = await fetch(`/api/config/sectors?id=${sectorId}`, { method: 'DELETE' });
            if (res.ok) onRefresh();
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <li style={{ borderBottom: '1px solid var(--border-color)', padding: '1.5rem 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontWeight: 600, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MapPin size={20} style={{ color: 'var(--accent-color)' }} />
                    {location.name}
                </h3>
                <button
                    onClick={() => onDelete(location.id)}
                    className="btn"
                    style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '0.4rem' }}
                >
                    <Trash2 size={18} />
                </button>
            </div>

            <div style={{ marginLeft: '1rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                    {location.sectors?.map((sector: any) => (
                        <div
                            key={sector.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.4rem 0.75rem',
                                backgroundColor: 'var(--bg-secondary)',
                                borderRadius: '30px',
                                fontSize: '0.85rem',
                                border: '1px solid var(--border-color)',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                            }}
                        >
                            <span style={{ fontWeight: 500 }}>{sector.name}</span>
                            <button onClick={() => handleDeleteSector(sector.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', padding: '0.2rem', opacity: 0.5 }}>
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                    {isAddingSector ? (
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <input
                                autoFocus
                                value={newSectorName}
                                onChange={e => setNewSectorName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddSector()}
                                placeholder="Nombre del sector"
                                className="input"
                                style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem', width: '180px', borderRadius: '20px' }}
                            />
                            <button onClick={handleAddSector} className="btn btn-primary" style={{ padding: '0.4rem', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Save size={14} /></button>
                            <button onClick={() => setIsAddingSector(false)} className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
                        </div>
                    ) : (
                        <button onClick={() => setIsAddingSector(true)} className="btn btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'transparent', border: '1px dashed var(--border-color)' }}>
                            <Plus size={16} /> Añadir Sector
                        </button>
                    )}
                </div>
            </div>
        </li>
    );
};

export default function ConfigPage() {
    const { currentUser, systemSettings, updateSystemSettings, isSidebarOpen, isMobile, getAuthHeaders } = useTicketContext() as any;
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'locations' | 'roles' | 'integrations' | 'backup'>('locations');
    const [backupLoading, setBackupLoading] = useState(false);
    const [logbookStats, setLogbookStats] = useState<{ total: number; first: { date: string; time: string } | null; last: { date: string; time: string } | null; last_changed_at: string | null } | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [locations, setLocations] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Form States
    const [newLocation, setNewLocation] = useState('');
    const [editingRole, setEditingRole] = useState<any | null>(null);
    const [newRoleName, setNewRoleName] = useState('');
    const [roleTasks, setRoleTasks] = useState<string[]>([]);
    const [newTask, setNewTask] = useState('');

    useEffect(() => {
        if (currentUser && currentUser.role !== 'admin') {
            router.push('/dashboard');
            return;
        }
        fetchData();
    }, [currentUser]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [locRes, roleRes] = await Promise.all([
                fetch('/api/config/locations'),
                fetch('/api/config/roles')
            ]);
            if (locRes.ok) setLocations(await locRes.json());
            if (roleRes.ok) setRoles(await roleRes.json());
        } catch (error) {
            console.error('Error fetching config:', error);
        } finally {
            setLoading(false);
        }
    };

    // Location Handlers
    const handleAddLocation = async () => {
        if (!newLocation.trim()) return;
        try {
            const res = await fetch('/api/config/locations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newLocation })
            });
            if (res.ok) {
                setNewLocation('');
                fetchData();
            } else {
                alert('Error al agregar lugar');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleDeleteLocation = async (id: number) => {
        if (!confirm('¿Estás seguro de eliminar este lugar?')) return;
        try {
            await fetch(`/api/config/locations?id=${id}`, { method: 'DELETE' });
            fetchData();
        } catch (error) {
            console.error(error);
        }
    };

    // Role Handlers
    const openRoleModal = (role?: any) => {
        if (role) {
            setEditingRole(role);
            setNewRoleName(role.name);
            setRoleTasks(role.tasks || []);
        } else {
            setEditingRole({ id: null }); // New Role
            setNewRoleName('');
            setRoleTasks([]);
        }
    };

    const handleSaveRole = async () => {
        if (!newRoleName.trim()) return alert('El nombre del rubro es obligatorio');

        const body = {
            id: editingRole.id,
            name: newRoleName,
            tasks: roleTasks
        };

        try {
            const res = await fetch('/api/config/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                setEditingRole(null);
                fetchData();
            } else {
                alert('Error al guardar rubro');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleDeleteRole = async (id: number) => {
        if (!confirm('¿Estás seguro de eliminar este rubro?')) return;
        try {
            await fetch(`/api/config/roles?id=${id}`, { method: 'DELETE' });
            fetchData();
        } catch (error) {
            console.error(error);
        }
    };

    const addTaskToRole = () => {
        if (newTask.trim()) {
            setRoleTasks([...roleTasks, newTask.trim()]);
            setNewTask('');
        }
    };

    const removeTaskFromRole = (idx: number) => {
        setRoleTasks(roleTasks.filter((_, i) => i !== idx));
    };

    const fetchLogbookStats = async () => {
        setStatsLoading(true);
        try {
            const res = await fetch('/api/logbook/debug');
            if (res.ok) setLogbookStats(await res.json());
        } catch { /* silent */ }
        finally { setStatsLoading(false); }
    };

    const handleDownloadBackup = async () => {
        setBackupLoading(true);
        try {
            const res = await fetch('/api/admin/backup', { headers: getAuthHeaders() });
            if (!res.ok) { alert('Error al generar backup'); return; }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            a.href = url;
            a.download = `gss_backup_${timestamp}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch { alert('Error de conexión'); }
        finally { setBackupLoading(false); }
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>
            <Sidebar />
            <div className="main-content" style={{
                flex: 1,
                marginLeft: (!isMobile && isSidebarOpen) ? '260px' : '0',
                transition: 'margin-left 0.3s ease-in-out',
                padding: isMobile ? '4rem 1rem 1rem' : '2rem',
                backgroundColor: 'var(--bg-color)',
                width: '100%',
                overflowX: 'hidden'
            }}>
                <Header title="Configuración del Sistema" />

                <div className="tabs" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid #ddd', justifyContent: 'center' }}>
                    <button
                        onClick={() => setActiveTab('locations')}
                        style={{ padding: '0.5rem 1rem', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: activeTab === 'locations' ? '2px solid #29416b' : '1px solid transparent', fontWeight: activeTab === 'locations' ? 600 : 400, color: activeTab === 'locations' ? '#29416b' : '#666', background: 'none', cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                    >
                        <MapPin size={18} /> Lugares
                    </button>
                    <button
                        onClick={() => setActiveTab('roles')}
                        style={{ padding: '0.5rem 1rem', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: activeTab === 'roles' ? '2px solid #29416b' : '1px solid transparent', fontWeight: activeTab === 'roles' ? 600 : 400, color: activeTab === 'roles' ? '#29416b' : '#666', background: 'none', cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                    >
                        <Briefcase size={18} /> Rubros y Tareas
                    </button>
                    <button
                        onClick={() => setActiveTab('integrations')}
                        style={{ padding: '0.5rem 1rem', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: activeTab === 'integrations' ? '2px solid #29416b' : '1px solid transparent', fontWeight: activeTab === 'integrations' ? 600 : 400, color: activeTab === 'integrations' ? '#29416b' : '#666', background: 'none', cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                    >
                        <Zap size={18} /> Integraciones
                    </button>
                    <button
                        onClick={() => setActiveTab('backup')}
                        style={{ padding: '0.5rem 1rem', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: activeTab === 'backup' ? '2px solid #29416b' : '1px solid transparent', fontWeight: activeTab === 'backup' ? 600 : 400, color: activeTab === 'backup' ? '#29416b' : '#666', background: 'none', cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                    >
                        <Database size={18} /> Respaldo
                    </button>
                </div>

                {loading ? <p>Cargando configuración...</p> : (
                    <>
                        {/* LOCATIONS TAB */}
                        {activeTab === 'locations' && (
                            <div className="card" style={{ padding: '2rem' }}>
                                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
                                    <div style={{ flex: 1 }}>
                                        <input
                                            type="text"
                                            value={newLocation}
                                            onChange={(e) => setNewLocation(e.target.value)}
                                            placeholder="Nuevo Lugar (Cliente)"
                                            style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}
                                        />
                                    </div>
                                    <button onClick={handleAddLocation} className="btn btn-primary">
                                        <Plus size={18} style={{ marginRight: '0.5rem' }} /> Agregar
                                    </button>
                                </div>

                                <ul style={{ listStyle: 'none', padding: 0 }}>
                                    {locations.map(loc => (
                                        <LocationItem
                                            key={loc.id}
                                            location={loc}
                                            onDelete={handleDeleteLocation}
                                            onRefresh={fetchData}
                                        />
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* ROLES TAB */}
                        {activeTab === 'roles' && (
                            <div className="card" style={{ padding: '2rem' }}>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <button onClick={() => openRoleModal()} className="btn btn-primary">
                                        <Plus size={18} style={{ marginRight: '0.5rem' }} /> Nuevo Rubro
                                    </button>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                                    {roles.map(role => (
                                        <div key={role.id} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '1.5rem', backgroundColor: 'var(--bg-color)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                                                <h3 style={{ fontWeight: 600, color: 'var(--primary-color)', fontSize: '1.1rem' }}>{role.name}</h3>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button onClick={() => openRoleModal(role)} className="btn btn-secondary" style={{ padding: '0.4rem' }}>
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteRole(role.id)}
                                                        className="btn"
                                                        style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '0.4rem' }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                                <strong>{role.tasks.length}</strong> tareas definidas
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* INTEGRATIONS TAB */}
                        {activeTab === 'integrations' && (
                            <div className="card" style={{ padding: '2rem' }}>
                                <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: 'rgba(59, 130, 246, 0.05)', borderRadius: 'var(--radius)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', color: '#2563eb' }}>
                                        <Zap size={18} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                                        Power Automate Webhook URL (Recomendado)
                                    </label>
                                    <input
                                        type="text"
                                        defaultValue={systemSettings.power_automate_url || ''}
                                        onBlur={(e) => updateSystemSettings({ power_automate_url: e.target.value })}
                                        placeholder="https://prod-XX.westus.logic.azure.com:443/workflows/..."
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)' }}
                                    />
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
                                        Si se configura, todas las notificaciones se enviarán a través de Microsoft 365 Power Automate.
                                    </p>
                                </div>

                                <div style={{ marginBottom: '2rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.75rem', color: 'var(--accent-color)' }}>
                                        <Mail size={18} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                                        Email Global de Notificaciones (Fallback)
                                    </label>
                                    <input
                                        type="text"
                                        defaultValue={systemSettings.notification_emails || systemSettings.notification_email}
                                        onBlur={(e) => updateSystemSettings({ notification_emails: e.target.value })}
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}
                                        placeholder="admin@empresa.com"
                                    />
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
                                        Se usará si el departamento no tiene mails configurados específicos.
                                    </p>
                                </div>

                                <div style={{ padding: '1.5rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-color)' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.5rem', opacity: 0.9 }}>Notificaciones por Departamento</h3>
                                    <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                                        {DEPARTMENTS.map(dept => {
                                            const deptKey = `notification_emails_${dept}`.replace(/\s+/g, '_');
                                            return (
                                                <div key={dept}>
                                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                                                        {dept}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        defaultValue={systemSettings[deptKey] || ''}
                                                        onBlur={(e) => updateSystemSettings({ [deptKey]: e.target.value })}
                                                        placeholder="mail1@gss.com, mail2@gss.com"
                                                        style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* BACKUP TAB */}
                        {activeTab === 'backup' && (
                            <>
                            <div className="card" style={{ padding: '2rem', maxWidth: '560px', marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                                    <ShieldCheck size={22} color="#29416b" />
                                    <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Integridad de Bitácora</h2>
                                    <button
                                        onClick={fetchLogbookStats}
                                        disabled={statsLoading}
                                        title="Actualizar estadísticas"
                                        style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: statsLoading ? 'not-allowed' : 'pointer', color: '#29416b', display: 'flex', alignItems: 'center', opacity: statsLoading ? 0.5 : 1 }}
                                    >
                                        <RefreshCw size={16} style={{ animation: statsLoading ? 'spin 1s linear infinite' : 'none' }} />
                                    </button>
                                </div>
                                {!logbookStats && !statsLoading && (
                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                        Verificá que no se hayan eliminado registros históricos de la bitácora.
                                    </p>
                                )}
                                {statsLoading && (
                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Consultando…</p>
                                )}
                                {logbookStats && !statsLoading && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                                        <div style={{ padding: '1rem', backgroundColor: 'rgba(41,65,107,0.06)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                                            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#29416b', lineHeight: 1.1 }}>{logbookStats.total.toLocaleString('es-UY')}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.3rem', fontWeight: 600 }}>REPORTES TOTALES</div>
                                        </div>
                                        <div style={{ padding: '1rem', backgroundColor: 'rgba(41,65,107,0.06)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#29416b', lineHeight: 1.3 }}>{logbookStats.first?.date ?? '—'}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{logbookStats.first?.time ?? ''}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.3rem', fontWeight: 600 }}>PRIMER REPORTE</div>
                                        </div>
                                        <div style={{ padding: '1rem', backgroundColor: 'rgba(41,65,107,0.06)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#29416b', lineHeight: 1.3 }}>{logbookStats.last?.date ?? '—'}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{logbookStats.last?.time ?? ''}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.3rem', fontWeight: 600 }}>ÚLTIMO REPORTE</div>
                                        </div>
                                    </div>
                                )}
                                {logbookStats?.last_changed_at && !statsLoading && (
                                    <p style={{ margin: '0.75rem 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                                        Stats detectados por primera vez con estos valores el <strong>{new Date(logbookStats.last_changed_at).toLocaleString('es-UY', { timeZone: 'America/Montevideo' })}</strong>
                                    </p>
                                )}
                                {!logbookStats && !statsLoading && (
                                    <button
                                        onClick={fetchLogbookStats}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', backgroundColor: '#29416b', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}
                                    >
                                        <ShieldCheck size={16} /> Ver estadísticas
                                    </button>
                                )}
                            </div>
                            <div className="card" style={{ padding: '2rem', maxWidth: '560px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                                    <Database size={22} color="#29416b" />
                                    <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Respaldo de Base de Datos</h2>
                                </div>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                                    Descargá un archivo <strong>.json</strong> con todos los datos del sistema (tickets, bitácora, registros de limpieza, usuarios, configuración, etc.).
                                    Guardá el archivo en un lugar seguro. Podés automatizar la descarga programando una tarea en Windows.
                                </p>
                                <button
                                    onClick={handleDownloadBackup}
                                    disabled={backupLoading}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1.5rem', backgroundColor: backupLoading ? '#9ca3af' : '#29416b', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontSize: '0.9rem', fontWeight: 600, cursor: backupLoading ? 'not-allowed' : 'pointer' }}
                                >
                                    <Download size={18} />
                                    {backupLoading ? 'Generando backup...' : 'Descargar Backup Ahora'}
                                </button>
                                <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: 'rgba(41,65,107,0.05)', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', fontWeight: 700, color: '#29416b' }}>Automatizar con Windows Task Scheduler</p>
                                    <p style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Creá un archivo <code>.bat</code> con este contenido y programalo en el Programador de Tareas de Windows:</p>
                                    <pre style={{ margin: 0, fontSize: '0.72rem', backgroundColor: '#1e293b', color: '#e2e8f0', padding: '0.85rem', borderRadius: '6px', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{`@echo off
set TIMESTAMP=%DATE:~6,4%-%DATE:~3,2%-%DATE:~0,2%_%TIME:~0,2%-%TIME:~3,2%
set BACKUP_DIR=C:\\Backups\\GSS
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
curl -s -o "%BACKUP_DIR%\\gss_backup_%TIMESTAMP%.json" ^
  "https://TU-APP.railway.app/api/admin/backup" ^
  -H "Cookie: gss_session=TU_SESSION_TOKEN"
echo Backup guardado en %BACKUP_DIR%`}</pre>
                                    <p style={{ margin: '0.75rem 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Reemplazá <strong>TU-APP.railway.app</strong> con tu URL y <strong>TU_SESSION_TOKEN</strong> con el valor de tu cookie de sesión (inspeccioná el navegador → DevTools → Application → Cookies).</p>
                                </div>
                            </div>
                            </>
                        )}
                    </>
                )}

                {/* MODAL FOR ROLE EDITING */}
                {editingRole && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
                        <div className="card" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{editingRole.id ? 'Editar Rubro' : 'Nuevo Rubro'}</h3>
                                <button onClick={() => setEditingRole(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                    <X size={24} />
                                </button>
                            </div>

                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Nombre del Rubro</label>
                            <input
                                type="text"
                                value={newRoleName}
                                onChange={(e) => setNewRoleName(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', marginBottom: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}
                            />

                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Tareas Predeterminadas</label>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                <input
                                    type="text"
                                    value={newTask}
                                    onChange={(e) => setNewTask(e.target.value)}
                                    placeholder="Nueva tarea..."
                                    style={{ flex: 1, padding: '0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}
                                />
                                <button onClick={addTaskToRole} className="btn btn-secondary">
                                    <Plus size={18} />
                                </button>
                            </div>

                            <ul style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '2rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-color)' }}>
                                {roleTasks.length === 0 && (
                                    <li style={{ padding: '1rem', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.9rem' }}>No hay tareas definidas</li>
                                )}
                                {roleTasks.map((task, idx) => (
                                    <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', alignItems: 'center' }}>
                                        <span>{task}</span>
                                        <button onClick={() => removeTaskFromRole(idx)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
                                    </li>
                                ))}
                            </ul>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button onClick={() => setEditingRole(null)} className="btn btn-secondary">Cancelar</button>
                                <button onClick={handleSaveRole} className="btn btn-primary">
                                    <Save size={18} style={{ marginRight: '0.5rem' }} /> Guardar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
