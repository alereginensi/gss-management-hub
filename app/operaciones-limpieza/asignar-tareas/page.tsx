'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, LogOut, ClipboardCheck, X, User, Building2, Layers } from 'lucide-react';
import { useTicketContext, hasModuleAccess } from '@/app/context/TicketContext';

interface Asignacion {
    id: number;
    titulo: string;
    descripcion: string;
    tareas: string;
    scope: 'individual' | 'cliente' | 'sector';
    cedula: string;
    cliente: string;
    sector: string;
    fecha: string;
    creado_por: string;
}

interface Worker { id: number; nombre: string; cedula: string; cliente: string; sector: string; activo?: number; }

const TAREAS_PRESET = [
    'Limpieza de pisos',
    'Limpieza de sanitarios',
    'Limpieza de superficies y escritorios',
    'Vaciado de papeleros',
    'Limpieza de cocina / comedor',
    'Limpieza de vidrios',
    'Desinfección de áreas',
    'Reposición de insumos',
    'Barrido exterior',
    'Otros',
];

const today = () => new Date().toISOString().split('T')[0];

export default function AsignarTareasPage() {
    const { currentUser, isAuthenticated, loading, logout, getAuthHeaders } = useTicketContext() as any;
    const router = useRouter();

    const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
    const [permanentes, setPermanentes] = useState<Asignacion[]>([]);
    const [fetching, setFetching] = useState(false);
    const [filterFecha, setFilterFecha] = useState(today());
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [clientSectorMap, setClientSectorMap] = useState<Record<string, string[]>>({});

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [scope, setScope] = useState<'individual' | 'cliente' | 'sector'>('cliente');
    const [formFecha, setFormFecha] = useState(today());
    const [formPermanente, setFormPermanente] = useState(false);
    const [formCedula, setFormCedula] = useState('');
    const [formCliente, setFormCliente] = useState('');
    const [formSector, setFormSector] = useState('');
    const [formTareas, setFormTareas] = useState<string[]>([]);
    const [formTareaInput, setFormTareaInput] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

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
            }).catch(() => {});
        fetch('/api/limpieza/usuarios', { headers: getAuthHeaders() })
            .then(r => r.ok ? r.json() : [])
            .then(setWorkers).catch(() => {});
    }, [getAuthHeaders]);

    const fetchAsignaciones = useCallback(async () => {
        setFetching(true);
        try {
            const params = new URLSearchParams();
            if (filterFecha) params.set('fecha', filterFecha);
            const [res, resP] = await Promise.all([
                fetch(`/api/limpieza/tareas-asignadas?${params}`, { headers: getAuthHeaders() }),
                fetch(`/api/limpieza/tareas-asignadas?permanentes=1`, { headers: getAuthHeaders() }),
            ]);
            if (res.ok) setAsignaciones(await res.json());
            if (resP.ok) setPermanentes(await resP.json());
        } finally { setFetching(false); }
    }, [filterFecha, getAuthHeaders]);

    useEffect(() => {
        if (isAuthenticated && currentUser && hasModuleAccess(currentUser, 'limpieza')) fetchAsignaciones();
    }, [isAuthenticated, currentUser, fetchAsignaciones]);

    const handleDelete = async (id: number) => {
        if (!confirm('¿Eliminar esta asignación?')) return;
        await fetch(`/api/limpieza/tareas-asignadas?id=${id}`, { method: 'DELETE', headers: getAuthHeaders() });
        setAsignaciones(prev => prev.filter(a => a.id !== id));
        setPermanentes(prev => prev.filter(a => a.id !== id));
    };

    const openModal = () => {
        setScope('cliente'); setFormFecha(today()); setFormPermanente(false); setFormCedula('');
        setFormCliente(''); setFormSector(''); setFormTareas([]);
        setFormTareaInput(''); setError(''); setShowModal(true);
    };

    const addTarea = (t: string) => {
        const v = t.trim();
        if (v && !formTareas.includes(v)) setFormTareas(prev => [...prev, v]);
        setFormTareaInput('');
    };

    const togglePreset = (t: string) => {
        setFormTareas(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
    };

    const buildTitulo = () => {
        if (scope === 'individual') {
            const w = workers.find(w => w.cedula === formCedula);
            return w ? `Tareas para ${w.nombre}` : 'Tareas individuales';
        }
        if (scope === 'sector') return `Tareas · ${formCliente} / ${formSector}`;
        return `Tareas · ${formCliente}`;
    };

    const handleSave = async () => {
        setError('');
        if (formTareas.length === 0) { setError('Agregá al menos una tarea.'); return; }
        if (scope === 'individual' && !formCedula) { setError('Seleccioná un funcionario.'); return; }
        if ((scope === 'cliente' || scope === 'sector') && !formCliente) { setError('Seleccioná un cliente.'); return; }
        if (scope === 'sector' && !formSector) { setError('Seleccioná un sector.'); return; }

        setSaving(true);
        try {
            const res = await fetch('/api/limpieza/tareas-asignadas', {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    titulo: buildTitulo(),
                    tareas: formTareas,
                    scope,
                    cedula: scope === 'individual' ? formCedula : null,
                    cliente: scope !== 'individual' ? formCliente : null,
                    sector: scope === 'sector' ? formSector : null,
                    fecha: formPermanente ? null : formFecha,
                }),
            });
            if (!res.ok) { const d = await res.json(); setError(d.error || 'Error'); return; }
            setShowModal(false);
            fetchAsignaciones();
        } finally { setSaving(false); }
    };

    const scopeLabel = (a: Asignacion) => {
        if (a.scope === 'individual') return `Funcionario · ${a.cedula}`;
        if (a.scope === 'sector') return `${a.cliente} › ${a.sector}`;
        return `Cliente · ${a.cliente}`;
    };

    const scopeColor = (scope: string) => {
        if (scope === 'individual') return { bg: 'rgba(59,130,246,0.1)', color: '#1d4ed8' };
        if (scope === 'sector') return { bg: 'rgba(168,85,247,0.1)', color: '#7e22ce' };
        return { bg: 'rgba(34,197,94,0.1)', color: '#15803d' };
    };

    const ScopeIcon = ({ scope }: { scope: string }) => {
        if (scope === 'individual') return <User size={13} />;
        if (scope === 'sector') return <Layers size={13} />;
        return <Building2 size={13} />;
    };

    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius)',
        border: '1px solid var(--border-color)', fontSize: '0.875rem',
        backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)', boxSizing: 'border-box',
    };
    const labelStyle: React.CSSProperties = {
        display: 'block', fontSize: '0.72rem', fontWeight: 700,
        color: 'var(--text-secondary)', marginBottom: '0.3rem', textTransform: 'uppercase',
    };

    if (loading || !currentUser) return null;

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', display: 'flex', flexDirection: 'column' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', position: 'sticky', top: 0, zIndex: 50 }}>
                <Link href="/operaciones-limpieza" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}>
                    <ArrowLeft size={16} /> <span className="mobile-hide">Operaciones Limpieza/Seguridad</span>
                </Link>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="GSS" style={{ height: '32px' }} className="mobile-hide" />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }} className="mobile-hide">{currentUser.name}</span>
                    <button onClick={() => { logout(); router.push('/login'); }} style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', padding: '0.4rem' }} title="Cerrar sesión">
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            <main style={{ flex: 1, padding: '1.25rem 1rem', maxWidth: '860px', margin: '0 auto', width: '100%' }}>
                {/* Title row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', backgroundColor: 'rgba(41,65,107,0.1)', borderRadius: '10px' }}>
                            <ClipboardCheck size={22} color="var(--primary-color)" />
                        </div>
                        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Asignar Tareas</h1>
                    </div>
                    <button onClick={openModal} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1.1rem', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
                        <Plus size={16} /> Nueva Asignación
                    </button>
                </div>

                {/* Date filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Fecha:</label>
                    <input type="date" value={filterFecha} onChange={e => setFilterFecha(e.target.value)}
                        style={{ padding: '0.45rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', fontSize: '0.875rem', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)' }} />
                    {filterFecha !== today() && (
                        <button onClick={() => setFilterFecha(today())} style={{ fontSize: '0.78rem', color: 'var(--primary-color)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Hoy</button>
                    )}
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                        {asignaciones.length} asignación{asignaciones.length !== 1 ? 'es' : ''}
                    </span>
                </div>

                {/* Permanent tasks section */}
                {permanentes.length > 0 && (
                    <div style={{ marginBottom: '1.5rem' }}>
                        <p style={{ fontSize: '0.72rem', fontWeight: 800, color: '#92400e', textTransform: 'uppercase', marginBottom: '0.6rem', letterSpacing: '0.05em' }}>Tareas Permanentes</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {permanentes.map(a => {
                                let tareasArr: string[] = [];
                                try { tareasArr = JSON.parse(a.tareas); } catch {}
                                return (
                                    <div key={a.id} className="card" style={{ padding: '0.85rem 1.1rem', borderLeft: '3px solid #d97706' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: '9999px', backgroundColor: 'rgba(217,119,6,0.12)', color: '#92400e' }}>Permanente</span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{scopeLabel(a)}</span>
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                                    {tareasArr.map((t, i) => (
                                                        <span key={i} style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '6px', backgroundColor: 'rgba(41,65,107,0.08)', color: 'var(--primary-color)', fontWeight: 500 }}>{t}</span>
                                                    ))}
                                                </div>
                                            </div>
                                            <button onClick={() => handleDelete(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.25rem', flexShrink: 0 }} title="Eliminar"><Trash2 size={15} /></button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Date-filtered list */}
                {fetching ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando...</div>
                ) : asignaciones.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', backgroundColor: 'var(--surface-color)', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                        <p style={{ margin: 0, fontSize: '0.875rem' }}>No hay asignaciones para esta fecha.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {asignaciones.map(a => {
                            const clr = scopeColor(a.scope);
                            let tareasArr: string[] = [];
                            try { tareasArr = JSON.parse(a.tareas); } catch {}
                            return (
                                <div key={a.id} className="card" style={{ padding: '1rem 1.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '9999px', backgroundColor: clr.bg, color: clr.color }}>
                                                    <ScopeIcon scope={a.scope} />
                                                    {a.scope === 'individual' ? 'Individual' : a.scope === 'sector' ? 'Sector' : 'Cliente'}
                                                </span>
                                                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{scopeLabel(a)}</span>
                                            </div>
                                            <p style={{ margin: '0 0 0.5rem', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{a.titulo}</p>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                                {tareasArr.map((t, i) => (
                                                    <span key={i} style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '6px', backgroundColor: 'rgba(41,65,107,0.08)', color: 'var(--primary-color)', fontWeight: 500 }}>{t}</span>
                                                ))}
                                            </div>
                                            {a.creado_por && <p style={{ margin: '0.5rem 0 0', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Por: {a.creado_por}</p>}
                                        </div>
                                        <button onClick={() => handleDelete(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.25rem', flexShrink: 0 }} title="Eliminar">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Modal */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '540px', maxHeight: '92vh', overflowY: 'auto', padding: '1.75rem', position: 'relative' }}>
                        <button onClick={() => setShowModal(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1.5rem', color: 'var(--primary-color)' }}>Nueva Asignación</h2>

                        {error && <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#b91c1c', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius)', fontSize: '0.83rem', marginBottom: '1rem', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}

                        {/* Fecha / Permanente */}
                        <div style={{ marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                <label style={{ ...labelStyle, marginBottom: 0 }}>Fecha</label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 600, color: formPermanente ? 'var(--primary-color)' : 'var(--text-secondary)', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={formPermanente} onChange={e => setFormPermanente(e.target.checked)} style={{ cursor: 'pointer' }} />
                                    Permanente (sin fecha)
                                </label>
                            </div>
                            {!formPermanente && <input type="date" value={formFecha} onChange={e => setFormFecha(e.target.value)} style={inputStyle} />}
                        </div>

                        {/* Scope */}
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={labelStyle}>Asignar a</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {(['individual', 'cliente', 'sector'] as const).map(s => (
                                    <button key={s} onClick={() => { setScope(s); setFormCedula(''); setFormCliente(''); setFormSector(''); }}
                                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', padding: '0.55rem 0.5rem', borderRadius: 'var(--radius)', border: `2px solid ${scope === s ? 'var(--primary-color)' : 'var(--border-color)'}`, backgroundColor: scope === s ? 'rgba(41,65,107,0.07)' : 'var(--surface-color)', color: scope === s ? 'var(--primary-color)' : 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                                        {s === 'individual' ? <><User size={13} /> Individual</> : s === 'cliente' ? <><Building2 size={13} /> Cliente</> : <><Layers size={13} /> Sector</>}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Target based on scope */}
                        {scope === 'individual' && (
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={labelStyle}>Funcionario *</label>
                                <select value={formCedula} onChange={e => setFormCedula(e.target.value)} style={inputStyle}>
                                    <option value="">Seleccionar...</option>
                                    {workers.filter(w => w.activo !== 0).map(w => (
                                        <option key={w.cedula} value={w.cedula}>{w.nombre} — {w.cliente || 'Sin cliente'}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {(scope === 'cliente' || scope === 'sector') && (
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={labelStyle}>Cliente *</label>
                                <select value={formCliente} onChange={e => { setFormCliente(e.target.value); setFormSector(''); }} style={inputStyle}>
                                    <option value="">Seleccionar...</option>
                                    {Object.keys(clientSectorMap).sort().map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        )}

                        {scope === 'sector' && (
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={labelStyle}>Sector *</label>
                                <select
                                    value={formSector}
                                    onChange={e => setFormSector(e.target.value)}
                                    disabled={!formCliente}
                                    style={{ ...inputStyle, backgroundColor: !formCliente ? '#f1f5f9' : 'var(--bg-color)', color: !formCliente ? '#94a3b8' : 'var(--text-primary)', cursor: !formCliente ? 'not-allowed' : 'pointer' }}
                                >
                                    <option value="">{formCliente ? 'Seleccionar sector...' : '← Primero elegí un cliente'}</option>
                                    {(clientSectorMap[formCliente] || []).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        )}

                        {/* Task picker */}
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={labelStyle}>Tareas a asignar *</label>
                            {/* Presets */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
                                {TAREAS_PRESET.map(t => {
                                    const sel = formTareas.includes(t);
                                    return (
                                        <button key={t} onClick={() => togglePreset(t)} style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '9999px', border: `1px solid ${sel ? 'var(--primary-color)' : 'var(--border-color)'}`, backgroundColor: sel ? 'var(--primary-color)' : 'var(--surface-color)', color: sel ? 'white' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 500 }}>
                                            {t}
                                        </button>
                                    );
                                })}
                            </div>
                            {/* Custom task input */}
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input value={formTareaInput} onChange={e => setFormTareaInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTarea(formTareaInput); } }}
                                    placeholder="Tarea personalizada..."
                                    style={{ ...inputStyle, flex: 1 }} />
                                <button onClick={() => addTarea(formTareaInput)} style={{ padding: '0.55rem 0.85rem', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                                    <Plus size={15} />
                                </button>
                            </div>
                            {/* Selected */}
                            {formTareas.length > 0 && (
                                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                    {formTareas.map((t, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.65rem', backgroundColor: 'rgba(41,65,107,0.06)', borderRadius: '6px', fontSize: '0.82rem' }}>
                                            <span>{t}</span>
                                            <button onClick={() => setFormTareas(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0 0.1rem' }}><X size={13} /></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                            <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '0.65rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                            <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '0.65rem', backgroundColor: saving ? '#9ca3af' : 'var(--primary-color)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontSize: '0.875rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                                {saving ? 'Guardando...' : `Asignar ${formTareas.length > 0 ? `(${formTareas.length})` : ''}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
