'use client';

import { useState, useEffect } from 'react';
import { useTicketContext, DEPARTMENTS } from '../../context/TicketContext';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { Settings, MapPin, Briefcase, Plus, Trash2, Edit, Save, X, Zap, Mail } from 'lucide-react';

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
    const { currentUser, systemSettings, updateSystemSettings, isSidebarOpen, isMobile } = useTicketContext();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'locations' | 'roles' | 'integrations'>('locations');
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

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>
            <Sidebar />
            <div className="main-content" style={{
                flex: 1,
                marginLeft: (!isMobile && isSidebarOpen) ? '260px' : '0',
                transition: 'margin-left 0.3s ease-in-out',
                padding: isMobile ? '1rem' : '2rem',
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
