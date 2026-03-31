'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Pencil, Trash2, Check, X, Users, LogOut } from 'lucide-react';
import { useTicketContext, hasModuleAccess } from '@/app/context/TicketContext';

interface LimpiezaUser {
    id: number;
    nombre: string;
    cedula: string;
    email: string;
    sector: string;
    cliente: string;
    activo: number;
}

const emptyForm = { nombre: '', cedula: '', email: '', sector: '', cliente: '' };

export default function PersonalLimpiezaPage() {
    const { currentUser, isAuthenticated, loading, logout, getAuthHeaders } = useTicketContext() as any;
    const router = useRouter();

    const [usuarios, setUsuarios] = useState<LimpiezaUser[]>([]);
    const [fetching, setFetching] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [clientSectorMap, setClientSectorMap] = useState<Record<string, string[]>>({});

    useEffect(() => {
        if (loading) return;
        if (!isAuthenticated) router.push('/login');
        else if (currentUser && !hasModuleAccess(currentUser, 'limpieza')) router.push('/');
    }, [loading, isAuthenticated, currentUser, router]);

    useEffect(() => {
        fetch('/api/config/locations', { headers: getAuthHeaders() })
            .then(r => r.ok ? r.json() : [])
            .then((locs: { name: string; sectors: { name: string }[] }[]) => {
                const map: Record<string, string[]> = {};
                locs.forEach(loc => { map[loc.name] = loc.sectors.map(s => s.name); });
                setClientSectorMap(map);
            })
            .catch(() => {});
    }, [getAuthHeaders]);

    const fetchUsuarios = useCallback(async () => {
        setFetching(true);
        try {
            const res = await fetch('/api/limpieza/usuarios', { headers: getAuthHeaders() });
            if (res.ok) setUsuarios(await res.json());
        } finally {
            setFetching(false);
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        if (isAuthenticated && currentUser && hasModuleAccess(currentUser, 'limpieza')) fetchUsuarios();
    }, [isAuthenticated, currentUser, fetchUsuarios]);

    const openNew = () => { setForm(emptyForm); setEditingId(null); setFormError(''); setShowForm(true); };
    const openEdit = (u: LimpiezaUser) => {
        setForm({ nombre: u.nombre, cedula: u.cedula || '', email: u.email, sector: u.sector || '', cliente: u.cliente || '' });
        setEditingId(u.id); setFormError(''); setShowForm(true);
    };
    const closeForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm); };

    const handleSave = async () => {
        setFormError('');
        if (!form.nombre || !form.email) { setFormError('Nombre y email son obligatorios.'); return; }
        setSaving(true);
        try {
            const method = editingId ? 'PUT' : 'POST';
            const body = editingId ? { ...form, id: editingId, activo: 1 } : form;
            const res = await fetch('/api/limpieza/usuarios', { method, headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            if (!res.ok) { const d = await res.json(); setFormError(d.error || 'Error al guardar.'); return; }
            closeForm();
            fetchUsuarios();
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number, nombre: string) => {
        if (!confirm(`¿Eliminar a ${nombre}?`)) return;
        await fetch(`/api/limpieza/usuarios?id=${id}`, { method: 'DELETE', headers: getAuthHeaders() });
        fetchUsuarios();
    };

    const handleToggleActivo = async (u: LimpiezaUser) => {
        await fetch('/api/limpieza/usuarios', {
            method: 'PUT',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...u, activo: u.activo ? 0 : 1 }),
        });
        fetchUsuarios();
    };

    if (loading || !currentUser) return null;

    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius)',
        border: '1px solid var(--border-color)', fontSize: '0.875rem',
        backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)', boxSizing: 'border-box',
    };
    const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', display: 'flex', flexDirection: 'column' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)' }}>
                <Link href="/operaciones-limpieza" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}>
                    <ArrowLeft size={15} /> Operaciones Limpieza
                </Link>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="GSS" style={{ height: '36px' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{currentUser.name}</span>
            </header>

            <main style={{ flex: 1, padding: '1.5rem 2rem', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Users size={22} color="var(--primary-color)" />
                        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Personal de Limpieza</h1>
                    </div>
                    <button onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1.1rem', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
                        <Plus size={15} /> Nuevo
                    </button>
                </div>

                {/* Form modal */}
                {showForm && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                        <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '1.75rem', position: 'relative' }}>
                            <button onClick={closeForm} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1.25rem' }}>{editingId ? 'Editar' : 'Nuevo'} funcionario</h3>

                            {formError && <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#b91c1c', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', fontSize: '0.85rem', marginBottom: '1rem' }}>{formError}</div>}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    <div>
                                        <label style={labelStyle}>Nombre *</label>
                                        <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Juan Pérez" style={inputStyle} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Cédula</label>
                                        <input value={form.cedula} onChange={e => setForm(p => ({ ...p, cedula: e.target.value }))} placeholder="12345678" style={inputStyle} />
                                    </div>
                                </div>
                                <div>
                                    <label style={labelStyle}>Email *</label>
                                    <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="correo@ejemplo.com" style={inputStyle} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    <div>
                                        <label style={labelStyle}>Cliente / Ubicación</label>
                                        <select value={form.cliente} onChange={e => setForm(p => ({ ...p, cliente: e.target.value, sector: '' }))} style={inputStyle}>
                                            <option value="">Seleccionar...</option>
                                            {Object.keys(clientSectorMap).sort().map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Sector</label>
                                        <select value={form.sector} onChange={e => setForm(p => ({ ...p, sector: e.target.value }))} style={inputStyle} disabled={!form.cliente}>
                                            <option value="">Seleccionar...</option>
                                            {(clientSectorMap[form.cliente] || []).map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                                <button onClick={closeForm} style={{ padding: '0.55rem 1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.875rem', cursor: 'pointer' }}>Cancelar</button>
                                <button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.55rem 1.2rem', backgroundColor: saving ? '#9ca3af' : 'var(--primary-color)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontSize: '0.875rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                                    <Check size={14} /> {saving ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {fetching ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando...</div>
                    ) : usuarios.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            <Users size={40} style={{ opacity: 0.2, marginBottom: '0.75rem' }} />
                            <p>No hay funcionarios registrados.</p>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                                <tr style={{ backgroundColor: 'var(--surface-color)', borderBottom: '2px solid var(--border-color)' }}>
                                    {['Nombre', 'Cédula', 'Email', 'Sector', 'Cliente', 'Estado', ''].map(h => (
                                        <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {usuarios.map(u => (
                                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: u.activo ? 1 : 0.5 }}>
                                        <td style={{ padding: '0.7rem 1rem', fontWeight: 500 }}>{u.nombre}</td>
                                        <td style={{ padding: '0.7rem 1rem', color: 'var(--text-secondary)' }}>{u.cedula || '-'}</td>
                                        <td style={{ padding: '0.7rem 1rem', color: 'var(--text-secondary)' }}>{u.email}</td>
                                        <td style={{ padding: '0.7rem 1rem' }}>{u.sector || '-'}</td>
                                        <td style={{ padding: '0.7rem 1rem' }}>{u.cliente || '-'}</td>
                                        <td style={{ padding: '0.7rem 1rem' }}>
                                            <button onClick={() => handleToggleActivo(u)} style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '9999px', border: 'none', cursor: 'pointer', fontWeight: 600, backgroundColor: u.activo ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)', color: u.activo ? '#15803d' : '#b91c1c' }}>
                                                {u.activo ? 'Activo' : 'Inactivo'}
                                            </button>
                                        </td>
                                        <td style={{ padding: '0.7rem 1rem' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button onClick={() => openEdit(u)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.2rem', borderRadius: '4px' }} title="Editar"><Pencil size={15} /></button>
                                                <button onClick={() => handleDelete(u.id, u.nombre)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.2rem', borderRadius: '4px' }} title="Eliminar"><Trash2 size={15} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </main>

            <button onClick={() => { logout(); router.push('/login'); }} style={{ position: 'fixed', bottom: '1.5rem', left: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.5rem 0.9rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <LogOut size={14} /> Cerrar sesión
            </button>
        </div>
    );
}
