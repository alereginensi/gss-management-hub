'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Pencil, Trash2, Check, X, Users, LogOut, Search } from 'lucide-react';
import { useTicketContext, hasModuleAccess } from '@/app/context/TicketContext';

interface LimpiezaUser {
    id: number;
    nombre: string;
    cedula: string;
    sector: string;
    cliente: string;
    activo: number;
}

const emptyForm = { nombre: '', cedula: '', sector: '', cliente: '' };

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
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCliente, setFilterCliente] = useState('');
    const [filterSector, setFilterSector] = useState('');
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
        setForm({ nombre: u.nombre, cedula: u.cedula || '', sector: u.sector || '', cliente: u.cliente || '' });
        setEditingId(u.id); setFormError(''); setShowForm(true);
    };
    const closeForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm); };

    const handleSave = async () => {
        setFormError('');
        if (!form.nombre) { setFormError('El nombre es obligatorio.'); return; }
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

    // Unique clients and sectors derived from loaded data
    const clientesDisponibles = [...new Set(usuarios.map(u => u.cliente).filter(Boolean))].sort();
    const sectoresDisponibles = [...new Set(
        usuarios.filter(u => !filterCliente || u.cliente === filterCliente).map(u => u.sector).filter(Boolean)
    )].sort();

    const filteredUsuarios = usuarios.filter(u => {
        if (filterCliente && u.cliente !== filterCliente) return false;
        if (filterSector && u.sector !== filterSector) return false;
        if (searchTerm) {
            const s = searchTerm.toLowerCase();
            return u.nombre.toLowerCase().includes(s) || (u.cedula && u.cedula.includes(s));
        }
        return true;
    });

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', display: 'flex', flexDirection: 'column' }}>
            <header style={{ 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', 
                backgroundColor: 'var(--surface-color)', position: 'sticky', top: 0, zIndex: 50 
            }}>
                <Link href="/operaciones-limpieza" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}>
                    <ArrowLeft size={16} /> <span className="mobile-hide">Operaciones Limpieza/Seguridad</span>
                </Link>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="GSS" style={{ height: '32px' }} className="mobile-hide" />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }} className="mobile-hide">{currentUser.name}</span>
                    <button 
                        onClick={() => { logout(); router.push('/login'); }} 
                        style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', padding: '0.4rem' }}
                        title="Cerrar sesión"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            <main style={{ flex: 1, padding: '1.25rem 1rem', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', backgroundColor: 'rgba(41,65,107,0.1)', borderRadius: '10px' }}>
                            <Users size={22} color="var(--primary-color)" />
                        </div>
                        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Personal</h1>
                    </div>
                    <button onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1.1rem', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
                        <Plus size={16} /> <span className="mobile-hide">Nuevo</span>
                    </button>
                </div>

                {/* Search + Filters */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    {/* Search */}
                    <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                            <Search size={18} />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por nombre o cédula..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.8rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', fontSize: '0.9rem', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none' }}
                        />
                    </div>

                    {/* Client + Sector filters */}
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <select
                            value={filterCliente}
                            onChange={e => { setFilterCliente(e.target.value); setFilterSector(''); }}
                            style={{ flex: 1, minWidth: '140px', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', fontSize: '0.85rem', backgroundColor: 'var(--surface-color)', color: filterCliente ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer' }}
                        >
                            <option value="">Todos los clientes</option>
                            {clientesDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>

                        <select
                            value={filterSector}
                            onChange={e => setFilterSector(e.target.value)}
                            disabled={sectoresDisponibles.length === 0}
                            style={{ flex: 1, minWidth: '140px', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', fontSize: '0.85rem', backgroundColor: 'var(--surface-color)', color: filterSector ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: sectoresDisponibles.length === 0 ? 'not-allowed' : 'pointer', opacity: sectoresDisponibles.length === 0 ? 0.5 : 1 }}
                        >
                            <option value="">Todos los sectores</option>
                            {sectoresDisponibles.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>

                        {(filterCliente || filterSector) && (
                            <button
                                onClick={() => { setFilterCliente(''); setFilterSector(''); }}
                                style={{ padding: '0.55rem 0.75rem', background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.82rem', cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap' }}
                            >
                                Limpiar filtros
                            </button>
                        )}
                    </div>

                    {/* Result count */}
                    {(filterCliente || filterSector || searchTerm) && (
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                            {filteredUsuarios.length} resultado{filteredUsuarios.length !== 1 ? 's' : ''}
                            {filterCliente ? ` · ${filterCliente}` : ''}
                            {filterSector ? ` › ${filterSector}` : ''}
                        </p>
                    )}
                </div>



                {/* Form modal */}
                {showForm && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0' }}>
                        <div className="card modal-responsive" style={{ width: '100%', maxWidth: '480px', padding: '1.75rem', position: 'relative', overflowY: 'auto' }}>
                            <button onClick={closeForm} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.5rem' }}><X size={24} /></button>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 1.5rem', color: 'var(--primary-color)' }}>{editingId ? 'Editar' : 'Nuevo'} Funcionario</h3>

                            {formError && <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#b91c1c', padding: '0.75rem', borderRadius: 'var(--radius)', fontSize: '0.85rem', marginBottom: '1.25rem', border: '1px solid rgba(239,68,68,0.2)' }}>{formError}</div>}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    <div>
                                        <label style={labelStyle}>Nombre *</label>
                                        <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="" style={inputStyle} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Cédula</label>
                                        <input value={form.cedula} onChange={e => setForm(p => ({ ...p, cedula: e.target.value }))} placeholder="" style={inputStyle} />
                                    </div>
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

                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem' }}>
                                <button onClick={closeForm} style={{ flex: 1, padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                                <button onClick={handleSave} disabled={saving} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', backgroundColor: saving ? '#9ca3af' : 'var(--primary-color)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontSize: '0.9rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                                    <Check size={18} /> {saving ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* List Container */}
                <div style={{ width: '100%' }}>
                    {fetching ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', backgroundColor: 'var(--surface-color)', borderRadius: 'var(--radius)' }}>Cargando personal...</div>
                    ) : filteredUsuarios.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', backgroundColor: 'var(--surface-color)', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                            <Users size={40} style={{ opacity: 0.2, marginBottom: '0.75rem' }} />
                            <p>{usuarios.length === 0 ? 'No hay funcionarios registrados.' : 'No se encontraron resultados para la búsqueda.'}</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table View */}
                            <div className="desktop-view card" style={{ padding: 0, overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: 'var(--surface-color)', borderBottom: '2px solid var(--border-color)' }}>
                                            {['Nombre', 'Cédula', 'Sector', 'Cliente', 'Estado', ''].map(h => (
                                                <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredUsuarios.map(u => (
                                            <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: u.activo ? 1 : 0.5 }}>
                                                <td style={{ padding: '0.7rem 1rem', fontWeight: 500 }}>{u.nombre}</td>
                                                <td style={{ padding: '0.7rem 1rem', color: 'var(--text-secondary)' }}>{u.cedula || '-'}</td>
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
                            </div>

                            {/* Mobile Card View */}
                            <div className="mobile-view">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {filteredUsuarios.map(u => (
                                        <div key={u.id} className="logbook-card" style={{ opacity: u.activo ? 1 : 0.7 }}>
                                            <div className="logbook-card-header" style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <span style={{ fontWeight: 700, color: 'var(--primary-color)' }}>{u.nombre}</span>
                                                <button onClick={() => handleToggleActivo(u)} style={{ fontSize: '0.7rem', padding: '0.1rem 0.6rem', borderRadius: '9999px', border: 'none', cursor: 'pointer', fontWeight: 600, backgroundColor: u.activo ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.1)', color: u.activo ? '#15803d' : '#b91c1c' }}>
                                                    {u.activo ? 'Activo' : 'Inactivo'}
                                                </button>
                                            </div>
                                            <div className="logbook-card-body">
                                                <div className="logbook-row">
                                                    <span className="logbook-label">CI:</span>
                                                    <span className="logbook-value">{u.cedula || '-'}</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                                                    <button onClick={() => openEdit(u)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 600 }}>
                                                        <Pencil size={14} /> Editar
                                                    </button>
                                                    <button onClick={() => handleDelete(u.id, u.nombre)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem', backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>
                                                        <Trash2 size={14} /> Eliminar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </main>

            {/* Logout button removed from here, now in header */}
        </div>
    );
}
