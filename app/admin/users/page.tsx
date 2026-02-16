'use client';

import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import { useTicketContext } from '../../context/TicketContext';
import { useEffect, useState } from 'react';
import { UserCheck, UserPlus, Info, Mail, Shield, X, Check } from 'lucide-react';

export default function UserManagement() {
    const { pendingUsers, fetchAllUsers, approveUser, rejectUser, currentUser, isSidebarOpen } = useTicketContext();
    const [loading, setLoading] = useState(false);
    const [newAdmin, setNewAdmin] = useState({ name: '', email: '', password: '', department: 'Administración' });

    useEffect(() => {
        if (currentUser.role === 'admin') {
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

    if (currentUser.role !== 'admin') {
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
                                                <div style={{ fontWeight: 600 }}>{user.name === 'Solicitante Pendiente' ? 'Nueva Solicitud' : user.name}</div>
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
        </div>
    );
}
