'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, LogOut, X, Download, Upload } from 'lucide-react';
import { useTicketContext } from '@/app/context/TicketContext';

interface Period { id: number; label: string; period_type: string; date_from: string; date_to: string; status: string; entry_count: number; total_hours: number; }
interface Entry { id: number; funcionario: string; category_id: number | null; category_name: string | null; date: string; regular_hours: string; overtime_hours: string; location: string | null; sector: string | null; service_type: string | null; source: string; notes: string | null; estimated_cost: number; }
interface Category { id: number; name: string; active: number; }

const STATUS_LABELS: Record<string, string> = { draft: 'Borrador', approved: 'Aprobado', closed: 'Cerrado' };
const STATUS_COLORS: Record<string, string> = { draft: '#f59e0b', approved: '#22c55e', closed: '#94a3b8' };
const today = new Date().toISOString().split('T')[0];
const firstOfMonth = today.slice(0, 8) + '01';

export default function LiquidacionPage() {
    const { currentUser, isAuthenticated, loading, logout } = useTicketContext();
    const router = useRouter();
    const [periods, setPeriods] = useState<Period[]>([]);
    const [selected, setSelected] = useState<Period | null>(null);
    const [entries, setEntries] = useState<Entry[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [showNewPeriod, setShowNewPeriod] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [showNewEntry, setShowNewEntry] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editHours, setEditHours] = useState({ regular: '', overtime: '' });

    const [periodForm, setPeriodForm] = useState({ label: '', period_type: 'monthly', date_from: firstOfMonth, date_to: today });
    const [importForm, setImportForm] = useState({ date_from: firstOfMonth, date_to: today, service_type: '', default_hours: '8', category_id: '' });
    const [entryForm, setEntryForm] = useState({ funcionario: '', category_id: '', date: today, regular_hours: '8', overtime_hours: '0', location: '', sector: '', service_type: '', notes: '' });

    const getAuthHeaders = (): HeadersInit => {
        return { 'Content-Type': 'application/json' };
    };

    useEffect(() => {
        if (loading) return;
        if (!isAuthenticated) { router.push('/login'); return; }
        if (currentUser && currentUser.role !== 'admin' && currentUser.role !== 'contador') { router.push('/'); return; }
        fetchPeriods();
        fetchCategories();
    }, [loading, isAuthenticated, currentUser, router]);

    const fetchPeriods = async () => {
        const res = await fetch('/api/cotizacion/periods', { headers: getAuthHeaders() });
        if (res.ok) setPeriods(await res.json());
    };

    const fetchCategories = async () => {
        const res = await fetch('/api/cotizacion/categories', { headers: getAuthHeaders() });
        if (res.ok) setCategories(await res.json());
    };

    const fetchEntries = async (periodId: number) => {
        const res = await fetch(`/api/cotizacion/periods/${periodId}/entries`, { headers: getAuthHeaders() });
        if (res.ok) setEntries(await res.json());
    };

    const selectPeriod = (p: Period) => { setSelected(p); fetchEntries(p.id); };

    const createPeriod = async () => {
        if (!periodForm.label || !periodForm.date_from || !periodForm.date_to) return;
        setSaving(true);
        const res = await fetch('/api/cotizacion/periods', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(periodForm) });
        setSaving(false);
        if (res.ok) { const p = await res.json(); setShowNewPeriod(false); setPeriodForm({ label: '', period_type: 'monthly', date_from: firstOfMonth, date_to: today }); await fetchPeriods(); selectPeriod(p); }
    };

    const changeStatus = async (newStatus: string) => {
        if (!selected) return;
        const res = await fetch(`/api/cotizacion/periods/${selected.id}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ status: newStatus }) });
        if (res.ok) { const updated = await res.json(); setSelected(updated); fetchPeriods(); }
    };

    const importFromLogbook = async () => {
        if (!selected) return;
        setSaving(true);
        const res = await fetch(`/api/cotizacion/periods/${selected.id}/import-logbook`, {
            method: 'POST', headers: getAuthHeaders(),
            body: JSON.stringify({ ...importForm, default_hours: parseFloat(importForm.default_hours), category_id: importForm.category_id ? parseInt(importForm.category_id) : null })
        });
        setSaving(false);
        if (res.ok) { const r = await res.json(); setShowImport(false); fetchEntries(selected.id); alert(`Importado: ${r.imported} entrada/s. Omitido (ya importado): ${r.skipped}.`); }
    };

    const createEntry = async () => {
        if (!selected || !entryForm.funcionario || !entryForm.date) return;
        setSaving(true);
        const res = await fetch(`/api/cotizacion/periods/${selected.id}/entries`, {
            method: 'POST', headers: getAuthHeaders(),
            body: JSON.stringify({ ...entryForm, category_id: entryForm.category_id ? parseInt(entryForm.category_id) : null })
        });
        setSaving(false);
        if (res.ok) { setShowNewEntry(false); setEntryForm({ funcionario: '', category_id: '', date: today, regular_hours: '8', overtime_hours: '0', location: '', sector: '', service_type: '', notes: '' }); fetchEntries(selected.id); }
    };

    const saveHours = async (entryId: number) => {
        if (!selected) return;
        await fetch(`/api/cotizacion/periods/${selected.id}/entries`, {
            method: 'PUT', headers: getAuthHeaders(),
            body: JSON.stringify({ entryId, regular_hours: parseFloat(editHours.regular), overtime_hours: parseFloat(editHours.overtime) })
        });
        setEditingId(null);
        fetchEntries(selected.id);
    };

    const deleteEntry = async (entryId: number) => {
        if (!selected || !confirm('¿Eliminar esta entrada?')) return;
        await fetch(`/api/cotizacion/periods/${selected.id}/entries?entryId=${entryId}`, { method: 'DELETE', headers: getAuthHeaders() });
        fetchEntries(selected.id);
    };

    if (loading || !currentUser) return null;

    const totalHours = entries.reduce((s, e) => s + parseFloat(e.regular_hours) + parseFloat(e.overtime_hours), 0);
    const totalCost = entries.reduce((s, e) => s + (e.estimated_cost || 0), 0);
    const isClosed = selected?.status === 'closed';

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', display: 'flex', flexDirection: 'column' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)' }}>
                <Link href="/cotizacion" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}>
                    <ArrowLeft size={15} /> Comercial
                </Link>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="GSS" style={{ height: '36px' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{currentUser.name}</span>
            </header>

            <main className="standalone-page" style={{ flex: 1, padding: '1.5rem 2rem', maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
                <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Liquidación de Horas</h1>

                <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem', alignItems: 'start' }}>
                    {/* Periods list */}
                    <div>
                        <button onClick={() => setShowNewPeriod(v => !v)} className="btn" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                            <Plus size={15} /> Nuevo Período
                        </button>
                        {showNewPeriod && (
                            <div className="card" style={{ padding: '1rem', marginBottom: '0.75rem' }}>
                                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.2rem' }}>Etiqueta *</label>
                                <input value={periodForm.label} onChange={e => setPeriodForm(p => ({ ...p, label: e.target.value }))} className="form-control" style={{ width: '100%', marginBottom: '0.5rem' }} placeholder="Ej: Marzo 2026" />
                                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.2rem' }}>Tipo</label>
                                <select value={periodForm.period_type} onChange={e => setPeriodForm(p => ({ ...p, period_type: e.target.value }))} className="form-control" style={{ width: '100%', marginBottom: '0.5rem' }}>
                                    <option value="monthly">Mensual</option>
                                    <option value="biweekly">Quincenal</option>
                                    <option value="weekly">Semanal</option>
                                </select>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                    <div><label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.2rem' }}>Desde</label><input type="date" value={periodForm.date_from} onChange={e => setPeriodForm(p => ({ ...p, date_from: e.target.value }))} className="form-control" style={{ width: '100%' }} /></div>
                                    <div><label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.2rem' }}>Hasta</label><input type="date" value={periodForm.date_to} onChange={e => setPeriodForm(p => ({ ...p, date_to: e.target.value }))} className="form-control" style={{ width: '100%' }} /></div>
                                </div>
                                <button onClick={createPeriod} disabled={saving} className="btn" style={{ width: '100%', fontSize: '0.82rem' }}>{saving ? 'Creando...' : 'Crear'}</button>
                            </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {periods.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No hay períodos.</p>}
                            {periods.map(p => (
                                <div key={p.id} onClick={() => selectPeriod(p)} className="card" style={{ padding: '0.75rem 1rem', cursor: 'pointer', border: selected?.id === p.id ? '2px solid var(--primary-color)' : '1px solid var(--border-color)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.87rem', color: 'var(--text-primary)' }}>{p.label}</span>
                                        <span style={{ fontSize: '0.68rem', fontWeight: 600, color: STATUS_COLORS[p.status], backgroundColor: `${STATUS_COLORS[p.status]}20`, borderRadius: '4px', padding: '0.1rem 0.4rem' }}>{STATUS_LABELS[p.status]}</span>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.date_from} → {p.date_to}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{p.entry_count} entradas · {parseFloat(String(p.total_hours)).toFixed(1)} hs</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Entries panel */}
                    {!selected ? (
                        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Seleccioná un período para ver sus entradas.</div>
                    ) : (
                        <div>
                            <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div>
                                        <span style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)', marginRight: '0.6rem' }}>{selected.label}</span>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: STATUS_COLORS[selected.status], backgroundColor: `${STATUS_COLORS[selected.status]}20`, borderRadius: '4px', padding: '0.2rem 0.5rem' }}>{STATUS_LABELS[selected.status]}</span>
                                    </div>
                                    {currentUser.role === 'admin' && !isClosed && (
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            {selected.status === 'draft' && <button onClick={() => changeStatus('approved')} className="btn" style={{ fontSize: '0.8rem', backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>Aprobar</button>}
                                            {selected.status === 'approved' && <button onClick={() => changeStatus('closed')} className="btn" style={{ fontSize: '0.8rem', backgroundColor: 'rgba(148,163,184,0.1)', color: '#64748b', border: '1px solid var(--border-color)' }}>Cerrar período</button>}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {!isClosed && (
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                    <button onClick={() => setShowImport(true)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}>
                                        <Upload size={14} /> Importar desde Bitácora
                                    </button>
                                    <button onClick={() => setShowNewEntry(true)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}>
                                        <Plus size={14} /> Agregar entrada manual
                                    </button>
                                </div>
                            )}

                            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)' }}>
                                                {['Funcionario', 'Categoría', 'Fecha', 'Ubicación', 'Hs Reg.', 'Hs Extra', 'Costo Est.', 'Fuente', ''].map(h => (
                                                    <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 500, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {entries.length === 0 ? (
                                                <tr><td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No hay entradas. Importá desde la bitácora o agregá manualmente.</td></tr>
                                            ) : entries.map(e => (
                                                <tr key={e.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                    <td style={{ padding: '0.5rem 0.75rem' }}>{e.funcionario}</td>
                                                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-secondary)' }}>{e.category_name || '—'}</td>
                                                    <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>{e.date}</td>
                                                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-secondary)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.location || '—'}</td>
                                                    <td style={{ padding: '0.5rem 0.75rem' }}>
                                                        {editingId === e.id ? (
                                                            <input type="number" value={editHours.regular} onChange={ev => setEditHours(h => ({ ...h, regular: ev.target.value }))} style={{ width: '55px', padding: '0.2rem', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.82rem' }} />
                                                        ) : (
                                                            <span onClick={() => !isClosed && (setEditingId(e.id), setEditHours({ regular: e.regular_hours, overtime: e.overtime_hours }))} style={{ cursor: isClosed ? 'default' : 'pointer', borderBottom: isClosed ? 'none' : '1px dashed var(--border-color)' }}>{e.regular_hours}</span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '0.5rem 0.75rem' }}>
                                                        {editingId === e.id ? (
                                                            <input type="number" value={editHours.overtime} onChange={ev => setEditHours(h => ({ ...h, overtime: ev.target.value }))} style={{ width: '55px', padding: '0.2rem', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.82rem' }} />
                                                        ) : (
                                                            <span onClick={() => !isClosed && (setEditingId(e.id), setEditHours({ regular: e.regular_hours, overtime: e.overtime_hours }))} style={{ cursor: isClosed ? 'default' : 'pointer', borderBottom: isClosed ? 'none' : '1px dashed var(--border-color)' }}>{e.overtime_hours}</span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>${(e.estimated_cost || 0).toLocaleString('es-UY', { minimumFractionDigits: 2 })}</td>
                                                    <td style={{ padding: '0.5rem 0.75rem' }}>
                                                        <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.35rem', borderRadius: '4px', backgroundColor: e.source === 'logbook' ? 'rgba(59,130,246,0.1)' : 'rgba(139,92,246,0.1)', color: e.source === 'logbook' ? '#3b82f6' : '#8b5cf6' }}>{e.source}</span>
                                                    </td>
                                                    <td style={{ padding: '0.5rem 0.75rem' }}>
                                                        {editingId === e.id ? (
                                                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                                                                <button onClick={() => saveHours(e.id)} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>✓</button>
                                                                <button onClick={() => setEditingId(null)} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}>×</button>
                                                            </div>
                                                        ) : !isClosed && (
                                                            <button onClick={() => deleteEntry(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.2rem' }}><X size={14} /></button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {entries.length > 0 && (
                                    <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '2rem', backgroundColor: 'var(--surface-color)', fontSize: '0.85rem' }}>
                                        <span>Total Horas: <strong>{totalHours.toFixed(1)}</strong></span>
                                        <span>Costo Estimado: <strong>${totalCost.toLocaleString('es-UY', { minimumFractionDigits: 2 })}</strong></span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Import Modal */}
            {showImport && selected && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="card" style={{ padding: '1.5rem', width: '420px', maxWidth: '90vw' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Importar desde Bitácora</h3>
                            <button onClick={() => setShowImport(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <div><label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.2rem' }}>Desde *</label><input type="date" value={importForm.date_from} onChange={e => setImportForm(f => ({ ...f, date_from: e.target.value }))} className="form-control" style={{ width: '100%' }} /></div>
                            <div><label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.2rem' }}>Hasta *</label><input type="date" value={importForm.date_to} onChange={e => setImportForm(f => ({ ...f, date_to: e.target.value }))} className="form-control" style={{ width: '100%' }} /></div>
                        </div>
                        <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.2rem' }}>Tipo de servicio (opcional)</label>
                        <input value={importForm.service_type} onChange={e => setImportForm(f => ({ ...f, service_type: e.target.value }))} className="form-control" style={{ width: '100%', marginBottom: '0.75rem' }} placeholder="Dejar vacío para todos" />
                        <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.2rem' }}>Categoría (opcional)</label>
                        <select value={importForm.category_id} onChange={e => setImportForm(f => ({ ...f, category_id: e.target.value }))} className="form-control" style={{ width: '100%', marginBottom: '0.75rem' }}>
                            <option value="">Sin categoría</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.2rem' }}>Horas por defecto por entrada</label>
                        <input type="number" value={importForm.default_hours} onChange={e => setImportForm(f => ({ ...f, default_hours: e.target.value }))} className="form-control" style={{ width: '100%', marginBottom: '1rem' }} />
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Se importarán las entradas de bitácora en el rango seleccionado. Las horas se pueden editar después.</p>
                        <button onClick={importFromLogbook} disabled={saving} className="btn" style={{ width: '100%' }}>{saving ? 'Importando...' : 'Importar'}</button>
                    </div>
                </div>
            )}

            {/* New Entry Modal */}
            {showNewEntry && selected && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="card" style={{ padding: '1.5rem', width: '440px', maxWidth: '90vw' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Entrada Manual</h3>
                            <button onClick={() => setShowNewEntry(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                        </div>
                        <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.2rem' }}>Funcionario *</label>
                        <input value={entryForm.funcionario} onChange={e => setEntryForm(f => ({ ...f, funcionario: e.target.value }))} className="form-control" style={{ width: '100%', marginBottom: '0.75rem' }} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <div><label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.2rem' }}>Fecha *</label><input type="date" value={entryForm.date} onChange={e => setEntryForm(f => ({ ...f, date: e.target.value }))} className="form-control" style={{ width: '100%' }} /></div>
                            <div><label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.2rem' }}>Categoría</label>
                                <select value={entryForm.category_id} onChange={e => setEntryForm(f => ({ ...f, category_id: e.target.value }))} className="form-control" style={{ width: '100%' }}>
                                    <option value="">Sin categoría</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <div><label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.2rem' }}>Hs Regulares</label><input type="number" value={entryForm.regular_hours} onChange={e => setEntryForm(f => ({ ...f, regular_hours: e.target.value }))} className="form-control" style={{ width: '100%' }} /></div>
                            <div><label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.2rem' }}>Hs Extra</label><input type="number" value={entryForm.overtime_hours} onChange={e => setEntryForm(f => ({ ...f, overtime_hours: e.target.value }))} className="form-control" style={{ width: '100%' }} /></div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <div><label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.2rem' }}>Ubicación</label><input value={entryForm.location} onChange={e => setEntryForm(f => ({ ...f, location: e.target.value }))} className="form-control" style={{ width: '100%' }} /></div>
                            <div><label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.2rem' }}>Sector</label><input value={entryForm.sector} onChange={e => setEntryForm(f => ({ ...f, sector: e.target.value }))} className="form-control" style={{ width: '100%' }} /></div>
                        </div>
                        <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.2rem' }}>Notas</label>
                        <input value={entryForm.notes} onChange={e => setEntryForm(f => ({ ...f, notes: e.target.value }))} className="form-control" style={{ width: '100%', marginBottom: '1rem' }} />
                        <button onClick={createEntry} disabled={saving || !entryForm.funcionario || !entryForm.date} className="btn" style={{ width: '100%' }}>{saving ? 'Guardando...' : 'Agregar'}</button>
                    </div>
                </div>
            )}

            <button onClick={() => { logout(); router.push('/login'); }} style={{ position: 'fixed', bottom: '1.5rem', left: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.5rem 0.9rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <LogOut size={14} /> Cerrar sesión
            </button>
        </div>
    );
}
