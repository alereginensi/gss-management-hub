'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Pencil, Trash2, Check, X, Users, LogOut, Upload } from 'lucide-react';
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

    // Bulk upload state
    const [showBulk, setShowBulk] = useState(false);
    const [bulkCliente, setBulkCliente] = useState('');
    const [bulkSector, setBulkSector] = useState('');
    const [bulkWorkers, setBulkWorkers] = useState<{ nombre: string; cedula: string }[]>([]);
    const [bulkError, setBulkError] = useState('');
    const [bulkSaving, setBulkSaving] = useState(false);
    const [bulkResult, setBulkResult] = useState<{ inserted: number; skipped: number } | null>(null);
    const bulkFileRef = useRef<HTMLInputElement>(null);
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

    const handleBulkFile = async (file: File) => {
        setBulkError(''); setBulkWorkers([]); setBulkResult(null);
        try {
            const ExcelJS = (await import('exceljs')).default;
            const wb = new ExcelJS.Workbook();
            await wb.xlsx.load(await file.arrayBuffer());
            const ws = wb.worksheets[0];
            const workers: { nombre: string; cedula: string }[] = [];

            // Step 1: detect columns from header row
            let nombreCols: number[] = [];
            let cedulaCol = -1;
            let startRow = 1;

            const firstRow = ws.getRow(1);
            const headerMap: Record<number, string> = {};
            firstRow.eachCell((cell, colNum) => {
                headerMap[colNum] = (cell.value ?? '').toString().toLowerCase().trim();
            });

            const headerKeywords = ['nombre', 'apellido', 'cedula', 'cédula', 'ci', 'documento', 'rut'];
            const hasHeader = Object.values(headerMap).some(h => headerKeywords.some(k => h.includes(k)));

            if (hasHeader) {
                startRow = 2;
                Object.entries(headerMap).forEach(([colStr, h]) => {
                    const col = Number(colStr);
                    if (h.includes('cedula') || h.includes('cédula') || h === 'ci' || h.includes('documento') || h.includes('rut')) {
                        cedulaCol = col;
                    } else if (h.includes('nombre') || h.includes('apellido')) {
                        nombreCols.push(col);
                    }
                });
            }

            // Step 2: if columns not identified via headers, auto-detect by content
            if (cedulaCol === -1 || nombreCols.length === 0) {
                const dataRow = ws.getRow(startRow);
                let maxCols = 0;
                dataRow.eachCell((_, c) => { if (c > maxCols) maxCols = c; });
                // Cédula column = first col whose value looks numeric (digits, dots, dashes)
                for (let c = 1; c <= maxCols; c++) {
                    const val = (dataRow.getCell(c).value ?? '').toString().trim();
                    if (cedulaCol === -1 && /^\d[\d.\-/]*$/.test(val)) {
                        cedulaCol = c;
                    }
                }
                // Nombre cols = all others
                for (let c = 1; c <= maxCols; c++) {
                    if (c !== cedulaCol && nombreCols.length < 2) nombreCols.push(c);
                }
            }

            // Step 3: parse rows
            ws.eachRow((row, rowNum) => {
                if (rowNum < startRow) return;
                const nombreParts = nombreCols.map(c => (row.getCell(c).value ?? '').toString().trim()).filter(Boolean);
                const nombre = nombreParts.join(' ');
                const cedula = cedulaCol > 0 ? (row.getCell(cedulaCol).value ?? '').toString().trim() : '';
                if (nombre) workers.push({ nombre, cedula });
            });

            if (workers.length === 0) { setBulkError('No se encontraron filas válidas. Verificá el formato.'); return; }
            setBulkWorkers(workers);
        } catch {
            setBulkError('Error al leer el archivo. Asegurate de subir un .xlsx válido.');
        }
    };

    const handleBulkSave = async () => {
        if (!bulkCliente) { setBulkError('Seleccioná un cliente.'); return; }
        if (bulkWorkers.length === 0) { setBulkError('Cargá un archivo primero.'); return; }
        setBulkSaving(true); setBulkError('');
        try {
            const res = await fetch('/api/limpieza/usuarios/bulk', {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ workers: bulkWorkers, cliente: bulkCliente, sector: bulkSector || null }),
            });
            const data = await res.json();
            if (!res.ok) { setBulkError(data.error || 'Error'); return; }
            setBulkResult(data);
            fetchUsuarios();
        } finally {
            setBulkSaving(false);
        }
    };

    const closeBulk = () => {
        setShowBulk(false); setBulkCliente(''); setBulkSector('');
        setBulkWorkers([]); setBulkError(''); setBulkResult(null);
        if (bulkFileRef.current) bulkFileRef.current.value = '';
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
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => setShowBulk(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1.1rem', backgroundColor: 'var(--surface-color)', color: 'var(--primary-color)', border: '1px solid var(--primary-color)', borderRadius: 'var(--radius)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
                            <Upload size={16} /> <span className="mobile-hide">Carga Masiva</span>
                        </button>
                        <button onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1.1rem', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
                            <Plus size={16} /> <span className="mobile-hide">Nuevo</span>
                        </button>
                    </div>
                </div>

                {/* Search + Filters */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    {/* Search */}
                    <input
                        type="text"
                        placeholder="Buscar por nombre o cédula..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', fontSize: '0.9rem', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none' }}
                    />

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

            {/* ── Bulk Upload Modal ── */}
            {showBulk && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '560px', padding: '1.75rem', overflowY: 'auto', maxHeight: '90vh' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Carga Masiva de Personal</h2>
                            <button onClick={closeBulk} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
                        </div>

                        {/* File format hint */}
                        <div style={{ backgroundColor: 'rgba(41,65,107,0.07)', border: '1px solid rgba(41,65,107,0.15)', borderRadius: 'var(--radius)', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            Se detectan automáticamente las columnas de <strong>Nombre</strong>, <strong>Apellido</strong> y <strong>Cédula</strong> por encabezado o contenido. Si hay nombre y apellido en columnas separadas se combinan.
                        </div>

                        {/* Cliente */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={labelStyle}>Cliente *</label>
                            <select
                                value={bulkCliente}
                                onChange={e => { setBulkCliente(e.target.value); setBulkSector(''); }}
                                style={inputStyle}
                            >
                                <option value="">Seleccionar cliente...</option>
                                {Object.keys(clientSectorMap).sort().map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        {/* Sector */}
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={labelStyle}>Sector (opcional)</label>
                            <select
                                value={bulkSector}
                                onChange={e => setBulkSector(e.target.value)}
                                disabled={!bulkCliente}
                                style={{ ...inputStyle, opacity: bulkCliente ? 1 : 0.5 }}
                            >
                                <option value="">Sin sector específico</option>
                                {(clientSectorMap[bulkCliente] || []).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        {/* File input */}
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={labelStyle}>Archivo Excel (.xlsx)</label>
                            <input
                                ref={bulkFileRef}
                                type="file"
                                accept=".xlsx"
                                onChange={e => { const f = e.target.files?.[0]; if (f) handleBulkFile(f); }}
                                style={{ display: 'block', width: '100%', fontSize: '0.85rem' }}
                            />
                        </div>

                        {/* Preview */}
                        {bulkWorkers.length > 0 && !bulkResult && (
                            <div style={{ marginBottom: '1.25rem' }}>
                                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                    {bulkWorkers.length} funcionario{bulkWorkers.length !== 1 ? 's' : ''} detectado{bulkWorkers.length !== 1 ? 's' : ''}:
                                </p>
                                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', fontSize: '0.8rem' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: 'var(--bg-color)' }}>
                                                <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Nombre</th>
                                                <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Cédula</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {bulkWorkers.map((w, i) => (
                                                <tr key={i} style={{ borderTop: '1px solid var(--border-color)' }}>
                                                    <td style={{ padding: '0.35rem 0.6rem' }}>{w.nombre}</td>
                                                    <td style={{ padding: '0.35rem 0.6rem', color: 'var(--text-secondary)' }}>{w.cedula}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Result */}
                        {bulkResult && (
                            <div style={{ backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 'var(--radius)', padding: '0.9rem 1rem', marginBottom: '1.25rem', fontSize: '0.88rem' }}>
                                <strong style={{ color: '#15803d' }}>✓ Carga completada</strong>
                                <div style={{ marginTop: '0.35rem', color: 'var(--text-secondary)' }}>
                                    {bulkResult.inserted} insertado{bulkResult.inserted !== 1 ? 's' : ''} · {bulkResult.skipped} omitido{bulkResult.skipped !== 1 ? 's' : ''} (cédula ya existente)
                                </div>
                            </div>
                        )}

                        {bulkError && <p style={{ color: '#ef4444', fontSize: '0.83rem', marginBottom: '1rem' }}>{bulkError}</p>}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button onClick={closeBulk} style={{ padding: '0.55rem 1.1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-color)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.875rem' }}>
                                {bulkResult ? 'Cerrar' : 'Cancelar'}
                            </button>
                            {!bulkResult && (
                                <button onClick={handleBulkSave} disabled={bulkSaving || bulkWorkers.length === 0} style={{ padding: '0.55rem 1.25rem', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', opacity: bulkSaving || bulkWorkers.length === 0 ? 0.6 : 1 }}>
                                    {bulkSaving ? 'Cargando...' : `Cargar ${bulkWorkers.length > 0 ? bulkWorkers.length + ' funcionarios' : ''}`}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
