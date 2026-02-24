'use client';

import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import { useTicketContext } from '../../context/TicketContext';
import { useEffect, useState } from 'react';
import { UserCheck, UserPlus, Info, Mail, Shield, X, Check, Edit2, Search, Trash2 } from 'lucide-react';

export default function UserManagement() {
    const { pendingUsers, fetchAllUsers, approveUser, rejectUser, currentUser, isSidebarOpen, allUsers, updateUser, deleteUser } = useTicketContext();
    const [loading, setLoading] = useState(false);
    const [newAdmin, setNewAdmin] = useState({ name: '', email: '', password: '', department: 'Administración' });
    const [editingUser, setEditingUser] = useState<any>(null);
    const [editForm, setEditForm] = useState({ name: '', email: '', department: '', role: 'user', rubro: '', password: '', confirmPassword: '' });
    const [assignedWorkers, setAssignedWorkers] = useState<number[]>([]);
    const [funcionarios, setFuncionarios] = useState<any[]>([]);
    const [showApprovedUsers, setShowApprovedUsers] = useState(false);
    const [userSearchQuery, setUserSearchQuery] = useState('');

    useEffect(() => {
        if (currentUser?.role === 'admin') {
            fetchAllUsers();
        }
    }, [currentUser]);

    const handleApprove = async (email: string) => {
        setLoading(true);
        await approveUser(email);
        setLoading(false);
    };

    const handleReject = async (email: string) => {
        if (!confirm('¿Estás seguro de que deseas rechazar y eliminar esta solicitud?')) return;
        setLoading(true);
        await rejectUser(email);
        setLoading(false);
    };

    const handleCreateAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newAdmin, action: 'create_admin' })
            });
            if (res.ok) {
                alert('Administrador creado con éxito');
                setNewAdmin({ name: '', email: '', password: '', department: 'Administración' });
            }
        } catch (error) {
            alert('Error al crear administrador');
        } finally {
            setLoading(false);
        }
    };

    const handleEditUser = async (user: any) => {
        setEditingUser(user);
        setEditForm({
            name: user.name || '',
            email: user.email || '',
            department: user.department || '',
            role: user.role || 'user',
            rubro: user.rubro || '',
            password: '',
            confirmPassword: ''
        });

        // Always reset assigned workers first
        setAssignedWorkers([]);

        // Fetch existing assigned workers if supervisor (or role in form is supervisor)
        if (user.role === 'supervisor') {
            try {
                const workersRes = await fetch(`/api/admin/users/${user.id}/workers`);
                if (workersRes.ok) {
                    const data = await workersRes.json();
                    setAssignedWorkers(data.workerIds || []);
                }
            } catch (error) {
                console.error('Error loading supervisor workers:', error);
            }
        }
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate passwords if provided
        if (editForm.password && editForm.password !== editForm.confirmPassword) {
            alert('Las contraseñas no coinciden');
            return;
        }

        if (editForm.password && editForm.password.length < 6) {
            alert('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setLoading(true);
        try {
            const updateData: any = {
                name: editForm.name,
                email: editForm.email,
                department: editForm.department,
                role: editForm.role,
                rubro: editForm.rubro
            };

            // Only include password if it was provided
            if (editForm.password) {
                updateData.password = editForm.password;
            }

            const success = await updateUser(editingUser.id, updateData);
            if (success) {
                // If supervisor: sync assigned workers
                if (editForm.role === 'supervisor') {
                    await fetch(`/api/admin/users/${editingUser.id}/workers`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ workerIds: assignedWorkers, department: editForm.rubro })
                    });
                }
                alert('Usuario actualizado correctamente');
                setEditingUser(null);
            } else {
                alert('Error al actualizar usuario');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!editingUser || !editingUser.email) return;

        if (confirm(`¿Estás seguro de que deseas eliminar permanentemente al usuario "${editingUser.name} (${editingUser.email})"? Esta acción no se puede deshacer.`)) {
            setLoading(true);
            try {
                const success = await deleteUser(editingUser.email);
                if (success) {
                    alert('Usuario eliminado con éxito');
                    handleCloseEdit();
                } else {
                    alert('Error al eliminar usuario');
                }
            } catch (error) {
                alert('Error al eliminar usuario');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleCloseEdit = () => {
        setEditingUser(null);
        setAssignedWorkers([]);
        setFuncionarios([]);
        setEditForm({ name: '', email: '', department: '', role: 'user', rubro: '', password: '', confirmPassword: '' });
    };

    if (currentUser?.role !== 'admin') {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>Acceso denegado</div>;
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar />

            <main style={{
                flex: 1,
                marginLeft: isSidebarOpen ? '260px' : '0',
                transition: 'margin-left 0.3s ease-in-out',
                padding: '2rem',
                backgroundColor: 'var(--bg-color)'
            }}>
                <Header title="Gestión de Usuarios" />



                <div className="user-management-grid">

                    {/* Approvals Section */}
                    <div>
                        <div className="card" style={{ marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <UserCheck size={20} color="var(--accent-color)" />
                                Solicitudes de Acceso Pendientes
                            </h3>

                            {pendingUsers.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius)', opacity: 0.6 }}>
                                    <Info size={32} style={{ marginBottom: '0.5rem' }} />
                                    <p>No hay solicitudes pendientes en este momento.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {pendingUsers.map(user => (
                                        <div key={user.email} className="user-card-item">
                                            <div className="user-info">
                                                <div style={{ fontWeight: 600 }}>{user.name}</div>
                                                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                                    {user.email} {user.department !== 'Sin Asignar' && `• ${user.department}`}
                                                </div>
                                            </div>
                                            <div className="user-actions">
                                                <button
                                                    className="btn"
                                                    style={{
                                                        fontSize: '0.875rem',
                                                        padding: '0.5rem 1rem',
                                                        backgroundColor: '#fee2e2',
                                                        color: '#b91c1c',
                                                        border: '1px solid #fecaca',
                                                        display: 'flex', alignItems: 'center', gap: '0.25rem'
                                                    }}
                                                    onClick={() => handleReject(user.email!)}
                                                    disabled={loading}
                                                    title="Rechazar solicitud"
                                                >
                                                    <X size={16} /> Rechazar
                                                </button>
                                                <button
                                                    className="btn btn-primary"
                                                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                                    onClick={() => handleApprove(user.email!)}
                                                    disabled={loading}
                                                    title="Aprobar solicitud"
                                                >
                                                    <Check size={16} /> Aprobar
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Approved Users Section - Button to open modal */}
                    <div>
                        <div className="card">
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <UserCheck size={20} color="var(--accent-color)" />
                                Usuarios Aprobados
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                                Total de usuarios registrados: {allUsers.filter(u => u.approved).length}
                            </p>
                            <button
                                className="btn btn-primary"
                                onClick={() => setShowApprovedUsers(true)}
                                style={{ width: '100%', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                            >
                                <UserCheck size={18} />
                                Ver y Editar Usuarios
                            </button>
                        </div>
                    </div>

                    {/* Create Admin Section */}
                    <div>
                        <div className="card">
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <UserPlus size={20} color="var(--accent-color)" />
                                Crear Nuevo Administrador
                            </h3>

                            <form onSubmit={handleCreateAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Nombre</label>
                                    <input
                                        type="text"
                                        required
                                        value={newAdmin.name}
                                        onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                                        className="input"
                                        style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Email</label>
                                    <input
                                        type="email"
                                        required
                                        value={newAdmin.email}
                                        onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                                        className="input"
                                        style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Contraseña</label>
                                    <input
                                        type="password"
                                        required
                                        value={newAdmin.password}
                                        onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                                        className="input"
                                        style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                                <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding: '0.75rem' }}>
                                    <Shield size={16} style={{ marginRight: '0.5rem' }} />
                                    Registrar Admin
                                </button>
                            </form>
                        </div>
                    </div>

                </div>
            </main>

            {/* Approved Users Modal */}
            {showApprovedUsers && (
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
                    zIndex: 1000,
                    padding: '1rem'
                }}>
                    <div className="card" style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <UserCheck size={20} color="var(--accent-color)" />
                                Usuarios Aprobados ({allUsers.filter(u => u.approved &&
                                    (u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                                        u.email?.toLowerCase().includes(userSearchQuery.toLowerCase()))
                                ).length})
                            </h3>
                            <button onClick={() => { setShowApprovedUsers(false); setUserSearchQuery(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <X size={24} />
                            </button>
                        </div>

                        {/* Search Input */}
                        <div style={{ marginBottom: '1rem' }}>
                            <input
                                type="text"
                                placeholder="Buscar por nombre o email..."
                                value={userSearchQuery}
                                onChange={(e) => setUserSearchQuery(e.target.value)}
                                className="input"
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    borderRadius: 'var(--radius)',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: 'var(--bg-color)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.875rem'
                                }}
                            />
                        </div>

                        {/* Users List */}
                        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {allUsers
                                .filter(u => u.approved &&
                                    (u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                                        u.email?.toLowerCase().includes(userSearchQuery.toLowerCase()))
                                )
                                .length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                    <Info size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                                    <p>No se encontraron usuarios</p>
                                </div>
                            ) : (
                                allUsers
                                    .filter(u => u.approved &&
                                        (u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                                            u.email?.toLowerCase().includes(userSearchQuery.toLowerCase()))
                                    )
                                    .map(user => (
                                        <div key={user.id} className="user-card-item" style={{ padding: '1rem' }}>
                                            <div className="user-info">
                                                <div style={{ fontWeight: 600 }}>{user.name}</div>
                                                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                                    {user.email} • {user.department} • {user.role}
                                                    {user.rubro && ` • ${user.rubro}`}
                                                </div>
                                            </div>
                                            <button
                                                className="btn btn-secondary"
                                                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                                onClick={() => {
                                                    setShowApprovedUsers(false);
                                                    setUserSearchQuery('');
                                                    handleEditUser(user);
                                                }}
                                                title="Editar usuario"
                                            >
                                                <Edit2 size={16} /> Editar
                                            </button>
                                        </div>
                                    ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {editingUser && (
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
                    zIndex: 1000,
                    padding: '1rem'
                }}>
                    <div className="card" style={{ maxWidth: '500px', width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Edit2 size={20} color="var(--accent-color)" />
                                Editar Usuario
                            </h3>
                            <button onClick={handleCloseEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Nombre</label>
                                <input
                                    type="text"
                                    required
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    className="input"
                                    style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Email</label>
                                <input
                                    type="email"
                                    required
                                    value={editForm.email}
                                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                    className="input"
                                    style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Departamento</label>
                                <input
                                    type="text"
                                    required
                                    value={editForm.department}
                                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                                    className="input"
                                    style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Rol</label>
                                <select
                                    required
                                    value={editForm.role}
                                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                                    className="input"
                                    style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}
                                >
                                    <option value="user">Usuario</option>
                                    <option value="supervisor">Supervisor</option>
                                    <option value="admin">Administrador</option>
                                    <option value="funcionario">Funcionario</option>
                                </select>
                            </div>

                            {editForm.role === 'funcionario' && (
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Rubro</label>
                                    <input
                                        type="text"
                                        value={editForm.rubro}
                                        onChange={(e) => setEditForm({ ...editForm, rubro: e.target.value })}
                                        className="input"
                                        style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}
                                        placeholder="Ej: Limpieza, Seguridad, etc."
                                    />
                                </div>
                            )}

                            {editForm.role === 'supervisor' && (
                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-color)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Asignación de Supervisor</p>

                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Departamento supervisado (rubro)</label>
                                        <input
                                            type="text"
                                            value={editForm.rubro}
                                            onChange={(e) => setEditForm({ ...editForm, rubro: e.target.value })}
                                            className="input"
                                            style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}
                                            placeholder="Ej: Limpieza, Seguridad, Vigilancia..."
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                                            Funcionarios asignados
                                            <span style={{ color: 'var(--text-secondary)', fontWeight: 400, marginLeft: '0.4rem' }}>(selección múltiple)</span>
                                        </label>
                                        <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            {allUsers.filter(u => u.role === 'funcionario').length === 0 ? (
                                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '0.5rem' }}>No hay funcionarios registrados.</p>
                                            ) : (
                                                allUsers.filter(u => u.role === 'funcionario').map((func: any) => (
                                                    <label key={func.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.35rem 0.5rem', borderRadius: '6px', cursor: 'pointer', backgroundColor: assignedWorkers.includes(Number(func.id)) ? 'rgba(59,130,246,0.08)' : 'transparent' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={assignedWorkers.includes(Number(func.id))}
                                                            onChange={(e) => {
                                                                const id = Number(func.id);
                                                                if (e.target.checked) {
                                                                    setAssignedWorkers(prev => [...prev, id]);
                                                                } else {
                                                                    setAssignedWorkers(prev => prev.filter(w => w !== id));
                                                                }
                                                            }}
                                                            style={{ cursor: 'pointer' }}
                                                        />
                                                        <span style={{ fontSize: '0.875rem' }}>{func.name}</span>
                                                        {func.rubro && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>({func.rubro})</span>}
                                                    </label>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                    Dejar en blanco para mantener la contraseña actual
                                </p>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Nueva Contraseña</label>
                                    <input
                                        type="password"
                                        value={editForm.password}
                                        onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                                        className="input"
                                        style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}
                                        placeholder="Mínimo 6 caracteres"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Confirmar Contraseña</label>
                                    <input
                                        type="password"
                                        value={editForm.confirmPassword}
                                        onChange={(e) => setEditForm({ ...editForm, confirmPassword: e.target.value })}
                                        className="input"
                                        style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}
                                        placeholder="Repetir contraseña"
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
                                <button
                                    type="button"
                                    onClick={handleDeleteUser}
                                    disabled={loading}
                                    className="btn"
                                    style={{
                                        padding: '0.75rem 1rem',
                                        backgroundColor: '#fee2e2',
                                        color: '#b91c1c',
                                        border: '1px solid #fecaca',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}
                                >
                                    <Trash2 size={16} />
                                    Eliminar Usuario
                                </button>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <button
                                        type="button"
                                        onClick={handleCloseEdit}
                                        className="btn btn-secondary"
                                        style={{ padding: '0.75rem 1.5rem' }}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="btn btn-primary"
                                        style={{ padding: '0.75rem 1.5rem' }}
                                    >
                                        <Check size={16} style={{ marginRight: '0.5rem' }} />
                                        Guardar Cambios
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
