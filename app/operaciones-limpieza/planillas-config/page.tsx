'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Edit2, Save, X, Settings, AlertTriangle, Upload } from 'lucide-react';
import { useTicketContext } from '@/app/context/TicketContext';

interface Cliente { id: number; name: string; active: number; }
interface Sector { id: number; cliente_id: number; name: string; active: number; }
interface Puesto { id: number; sector_id: number; turno: string; nombre: string; cantidad: number; orden: number; active: number; lugar_sistema?: string | null; }

const TURNOS_SUGERIDOS = ['6 A 14', '14 A 22', '22 A 06', '12 A 20', '15 A 23', 'HEMOTERAPIA'];

export default function PlanillasConfigPage() {
    const { currentUser, isAuthenticated, loading } = useTicketContext();
    const router = useRouter();

    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [sectores, setSectores] = useState<Sector[]>([]);
    const [puestos, setPuestos] = useState<Puesto[]>([]);
    const [clienteSel, setClienteSel] = useState<number | null>(null);
    const [sectorSel, setSectorSel] = useState<number | null>(null);
    const [newClienteName, setNewClienteName] = useState('');
    const [newSectorName, setNewSectorName] = useState('');
    const [newTurnoName, setNewTurnoName] = useState('');
    const [editingCliente, setEditingCliente] = useState<{ id: number; name: string } | null>(null);
    const [editingSector, setEditingSector] = useState<{ id: number; name: string } | null>(null);
    const [fetching, setFetching] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [applying, setApplying] = useState(false);
    interface ImportMatch { puesto_id: number; sector: string; turno: string; nombre: string; lugar_sistema_actual: string | null; lugar_sistema_nuevo: string; }
    interface ImportUnmatched { sheet: string; turno: string; puesto: string; lugar_sistema: string; }
    interface ImportToCreate { sector: string; turno: string; nombre: string; lugar_sistema: string; sector_exists: boolean; }
    interface ImportPreview { matches: ImportMatch[]; unmatched: ImportUnmatched[]; to_create: ImportToCreate[]; matches_count: number; to_create_count: number; skipped: number; }
    const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
    const [importApplied, setImportApplied] = useState<{ updated: number; created: number; createdSectors: number } | null>(null);
    const [createMissing, setCreateMissing] = useState(true);

    interface DupInfo { sector: string; turno: string; puesto: string; winner_id: number; losers_ids: number[]; merged_lugar_sistema: string | null; }
    interface TurnoRename { id: number; turno_actual: string; turno_nuevo: string; }
    interface DupPreview { turnos_renombrados: TurnoRename[]; duplicados: DupInfo[]; total_turnos_normalizar: number; total_grupos_duplicados: number; total_borrar: number; }
    const [dupPreview, setDupPreview] = useState<DupPreview | null>(null);
    const [dupApplying, setDupApplying] = useState(false);

    const runDupLimpieza = async (apply: boolean) => {
        if (!clienteSel) return;
        setDupApplying(true);
        try {
            const fd = new FormData();
            fd.append('cliente_id', String(clienteSel));
            fd.append('apply', apply ? '1' : '0');
            const res = await fetch('/api/limpieza/admin/puestos/limpiar-duplicados', { method: 'POST', body: fd });
            const data = await res.json();
            if (!res.ok) { alert(data.error || 'Error'); return; }
            if (apply) {
                alert(`Limpieza aplicada: ${data.total_turnos_normalizar} turnos normalizados · ${data.total_borrar} puestos duplicados fusionados.`);
                setDupPreview(null);
                if (sectorSel) fetchPuestos(sectorSel);
            } else {
                setDupPreview({
                    turnos_renombrados: data.turnos_renombrados || [],
                    duplicados: data.duplicados || [],
                    total_turnos_normalizar: data.total_turnos_normalizar || 0,
                    total_grupos_duplicados: data.total_grupos_duplicados || 0,
                    total_borrar: data.total_borrar || 0,
                });
            }
        } catch (e: any) {
            alert('Error: ' + (e?.message || e));
        } finally {
            setDupApplying(false);
        }
    };

    const isAdmin = currentUser?.role === 'admin';

    const runImport = async (apply: boolean) => {
        if (!importFile || !clienteSel) { alert('Seleccioná un cliente y un archivo.'); return; }
        apply ? setApplying(true) : setAnalyzing(true);
        try {
            const fd = new FormData();
            fd.append('file', importFile);
            fd.append('cliente_id', String(clienteSel));
            fd.append('apply', apply ? '1' : '0');
            fd.append('create_missing', createMissing ? '1' : '0');
            const res = await fetch('/api/limpieza/admin/puestos/import-mapeo', { method: 'POST', body: fd });
            const data = await res.json();
            if (!res.ok) { alert(data.error || 'Error'); return; }
            if (apply) {
                setImportApplied({ updated: data.updated, created: data.created || 0, createdSectors: data.createdSectors || 0 });
                if (sectorSel) fetchPuestos(sectorSel);
                // Refrescar sectores si se crearon nuevos
                if (data.createdSectors > 0 && clienteSel) fetchSectores(clienteSel);
            } else {
                setImportPreview({
                    matches: data.matches || [],
                    unmatched: data.unmatched || [],
                    to_create: data.to_create || [],
                    matches_count: data.matches_count || 0,
                    to_create_count: data.to_create_count || 0,
                    skipped: data.skipped || 0,
                });
            }
        } catch (e: any) {
            alert('Error: ' + (e?.message || e));
        } finally {
            setAnalyzing(false);
            setApplying(false);
        }
    };

    const resetImport = () => {
        setImportFile(null);
        setImportPreview(null);
        setImportApplied(null);
    };

    useEffect(() => {
        if (loading) return;
        if (!isAuthenticated) router.push('/login');
    }, [loading, isAuthenticated, router]);

    const fetchClientes = useCallback(async () => {
        const res = await fetch('/api/limpieza/admin/clientes');
        if (res.ok) setClientes(await res.json());
    }, []);

    const fetchSectores = useCallback(async (clienteId: number) => {
        const res = await fetch(`/api/limpieza/admin/sectores?cliente_id=${clienteId}`);
        if (res.ok) setSectores(await res.json());
    }, []);

    const fetchPuestos = useCallback(async (sectorId: number) => {
        const res = await fetch(`/api/limpieza/admin/puestos?sector_id=${sectorId}`);
        if (res.ok) setPuestos(await res.json());
    }, []);

    useEffect(() => { if (isAdmin) fetchClientes(); }, [isAdmin, fetchClientes]);
    useEffect(() => { if (clienteSel) { setSectorSel(null); setPuestos([]); fetchSectores(clienteSel); } }, [clienteSel, fetchSectores]);
    useEffect(() => { if (sectorSel) fetchPuestos(sectorSel); }, [sectorSel, fetchPuestos]);

    if (loading || !currentUser) return null;
    if (!isAdmin) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <h1>Acceso denegado</h1>
                <p>Solo administradores.</p>
                <Link href="/operaciones-limpieza">Volver</Link>
            </div>
        );
    }

    // --- Cliente handlers ---
    const crearCliente = async () => {
        if (!newClienteName.trim()) return;
        const res = await fetch('/api/limpieza/admin/clientes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newClienteName }) });
        if (res.ok) { setNewClienteName(''); fetchClientes(); }
        else { const e = await res.json(); alert(e.error); }
    };
    const renombrarCliente = async (id: number, name: string) => {
        const res = await fetch(`/api/limpieza/admin/clientes/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
        if (res.ok) { setEditingCliente(null); fetchClientes(); }
    };
    const borrarCliente = async (id: number) => {
        if (!confirm('Desactivar cliente. Los informes guardados quedan intactos. ¿Continuar?')) return;
        await fetch(`/api/limpieza/admin/clientes/${id}`, { method: 'DELETE' });
        if (clienteSel === id) setClienteSel(null);
        fetchClientes();
    };

    // --- Sector handlers ---
    const crearSector = async () => {
        if (!newSectorName.trim() || !clienteSel) return;
        const res = await fetch('/api/limpieza/admin/sectores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cliente_id: clienteSel, name: newSectorName }) });
        if (res.ok) { setNewSectorName(''); fetchSectores(clienteSel); }
        else { const e = await res.json(); alert(e.error); }
    };
    const renombrarSector = async (id: number, name: string) => {
        const res = await fetch(`/api/limpieza/admin/sectores/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
        if (res.ok && clienteSel) { setEditingSector(null); fetchSectores(clienteSel); }
    };
    const borrarSector = async (id: number) => {
        if (!confirm('Desactivar sector. Los informes guardados quedan intactos. ¿Continuar?')) return;
        await fetch(`/api/limpieza/admin/sectores/${id}`, { method: 'DELETE' });
        if (sectorSel === id) setSectorSel(null);
        if (clienteSel) fetchSectores(clienteSel);
    };

    // --- Turno/puesto handlers ---
    const agregarTurno = async () => {
        if (!newTurnoName.trim() || !sectorSel) return;
        setFetching(true);
        const res = await fetch('/api/limpieza/admin/puestos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sector_id: sectorSel, turno: newTurnoName.trim(), nombre: 'NUEVO PUESTO', cantidad: 1, orden: 0 }) });
        setFetching(false);
        if (res.ok) { setNewTurnoName(''); fetchPuestos(sectorSel); }
    };
    const agregarPuesto = async (turno: string) => {
        if (!sectorSel) return;
        const existentes = puestos.filter(p => p.turno === turno);
        const maxOrden = existentes.reduce((m, p) => Math.max(m, p.orden), -1);
        const res = await fetch('/api/limpieza/admin/puestos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sector_id: sectorSel, turno, nombre: 'NUEVO', cantidad: 1, orden: maxOrden + 1 }) });
        if (res.ok) fetchPuestos(sectorSel);
    };
    const actualizarPuesto = async (id: number, patch: Partial<Puesto>) => {
        await fetch(`/api/limpieza/admin/puestos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
        if (sectorSel) fetchPuestos(sectorSel);
    };
    const borrarPuesto = async (id: number) => {
        await fetch(`/api/limpieza/admin/puestos/${id}`, { method: 'DELETE' });
        if (sectorSel) fetchPuestos(sectorSel);
    };
    const borrarTurno = async (turno: string) => {
        if (!sectorSel) return;
        const delPuestos = puestos.filter(p => p.turno === turno && p.active === 1);
        const count = delPuestos.length;
        if (!confirm(`¿Eliminar el turno "${turno}"${count > 0 ? ` y sus ${count} puesto${count !== 1 ? 's' : ''}` : ''}?\n\nEsta acción no afecta los informes ya guardados.`)) return;
        await Promise.all(delPuestos.map(p => fetch(`/api/limpieza/admin/puestos/${p.id}`, { method: 'DELETE' })));
        fetchPuestos(sectorSel);
    };

    const activos = clientes.filter(c => c.active === 1);
    const sectoresActivos = sectores.filter(s => s.active === 1);
    const turnosDelSector = Array.from(new Set(puestos.filter(p => p.active === 1).map(p => p.turno))).sort();

    const colCard: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', minHeight: '400px' };
    const inputStyle: React.CSSProperties = { padding: '0.5rem 0.7rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', flex: 1 };
    const btnPrimary: React.CSSProperties = { padding: '0.5rem 0.8rem', background: '#1d3461', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' };
    const btnMuted: React.CSSProperties = { background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center', color: '#64748b' };

    return (
        <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
            <header style={{ background: '#29416b', padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '3px solid #e04951' }}>
                <Link href="/operaciones-limpieza" style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', textDecoration: 'none' }}><ArrowLeft size={14}/> Volver</Link>
                <h1 style={{ color: '#fff', fontSize: '1rem', margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Settings size={18}/> Editor de planillas</h1>
            </header>

            <main style={{ maxWidth: '1400px', margin: '1rem auto', padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', padding: '0.65rem 0.9rem', borderRadius: '8px', display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.8rem', color: '#78350f' }}>
                    <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>Los cambios solo afectan planillas futuras. Los informes ya guardados conservan su configuración original. Eliminar un cliente/sector no borra los informes históricos — sólo los oculta del selector.</span>
                </div>

                {/* Bulk import de "Lugar en sistema" desde Excel (p.ej. Casmu) */}
                {clienteSel && (
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '0.75rem 0.9rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', color: '#1e3a8a' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                            <Upload size={15} /> Importar mapeo "Lugar en sistema" desde Excel
                        </div>
                        <p style={{ margin: 0, fontSize: '0.76rem', color: '#334155' }}>
                            Subí el Excel de distribución de puestos (ej. Planillas Casmu) para autocompletar el campo "Lugar en sistema" de cada puesto de <strong>{activos.find(c => c.id === clienteSel)?.name || ''}</strong>. Cada hoja debe corresponder a un sector. Match por sector + turno + nombre del puesto.
                        </p>

                        {/* PASO 1: elegir archivo y analizar */}
                        {!importPreview && !importApplied && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <input type="file" accept=".xlsx,.xls" onChange={e => setImportFile(e.target.files?.[0] || null)} style={{ flex: 1, minWidth: 0 }} />
                                    <button onClick={() => runImport(false)} disabled={!importFile || analyzing} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.9rem', border: 'none', borderRadius: '6px', background: importFile ? '#29416b' : '#94a3b8', color: '#fff', cursor: importFile && !analyzing ? 'pointer' : 'not-allowed', fontSize: '0.8rem', fontWeight: 700 }}>
                                        {analyzing ? 'Analizando...' : 'Analizar y ver preview →'}
                                    </button>
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem', color: '#334155', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={createMissing} onChange={e => setCreateMissing(e.target.checked)} />
                                    Crear sectores y puestos faltantes automáticamente (recomendado para primer import)
                                </label>
                            </div>
                        )}

                        {/* PASO 2: preview, confirmar o cancelar */}
                        {importPreview && !importApplied && (
                            <div style={{ marginTop: '0.25rem', padding: '0.6rem 0.8rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.78rem', color: '#1e293b' }}>
                                <div style={{ fontWeight: 700, marginBottom: '0.4rem', color: '#0f172a' }}>
                                    Preview de cambios (nada aplicado todavía)
                                </div>
                                <div style={{ marginBottom: '0.5rem' }}>
                                    <strong style={{ color: '#15803d' }}>{importPreview.matches_count}</strong> puestos a actualizar
                                    {createMissing && (
                                        <> · <strong style={{ color: '#2563eb' }}>{importPreview.to_create_count}</strong> puestos nuevos a crear</>
                                    )}
                                    {!createMissing && (
                                        <> · <strong style={{ color: '#b91c1c' }}>{importPreview.skipped}</strong> filas sin match</>
                                    )}
                                </div>

                                {importPreview.matches.length > 0 && (
                                    <details open style={{ marginBottom: '0.4rem' }}>
                                        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Puestos a actualizar ({importPreview.matches.length})</summary>
                                        <div style={{ marginTop: '0.3rem', maxHeight: '220px', overflow: 'auto', border: '1px solid #f1f5f9', borderRadius: '4px' }}>
                                            <table style={{ width: '100%', fontSize: '0.72rem', borderCollapse: 'collapse' }}>
                                                <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                                                    <tr>
                                                        <th style={{ padding: '0.3rem 0.5rem', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Sector</th>
                                                        <th style={{ padding: '0.3rem 0.5rem', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Turno</th>
                                                        <th style={{ padding: '0.3rem 0.5rem', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Puesto</th>
                                                        <th style={{ padding: '0.3rem 0.5rem', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Actual</th>
                                                        <th style={{ padding: '0.3rem 0.5rem', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Nuevo</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {importPreview.matches.map(m => (
                                                        <tr key={m.puesto_id} style={{ borderTop: '1px solid #f1f5f9' }}>
                                                            <td style={{ padding: '0.25rem 0.5rem' }}>{m.sector}</td>
                                                            <td style={{ padding: '0.25rem 0.5rem' }}>{m.turno}</td>
                                                            <td style={{ padding: '0.25rem 0.5rem' }}>{m.nombre}</td>
                                                            <td style={{ padding: '0.25rem 0.5rem', color: '#94a3b8' }}>{m.lugar_sistema_actual || '—'}</td>
                                                            <td style={{ padding: '0.25rem 0.5rem', color: '#15803d', fontWeight: 600 }}>{m.lugar_sistema_nuevo}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </details>
                                )}

                                {createMissing && importPreview.to_create.length > 0 && (
                                    <details open style={{ marginBottom: '0.4rem' }}>
                                        <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#2563eb' }}>Puestos nuevos a crear ({importPreview.to_create.length})</summary>
                                        <div style={{ marginTop: '0.3rem', maxHeight: '220px', overflow: 'auto', border: '1px solid #f1f5f9', borderRadius: '4px' }}>
                                            <table style={{ width: '100%', fontSize: '0.72rem', borderCollapse: 'collapse' }}>
                                                <thead style={{ background: '#eff6ff', position: 'sticky', top: 0 }}>
                                                    <tr>
                                                        <th style={{ padding: '0.3rem 0.5rem', textAlign: 'left', fontWeight: 700, color: '#1e3a8a' }}>Sector</th>
                                                        <th style={{ padding: '0.3rem 0.5rem', textAlign: 'left', fontWeight: 700, color: '#1e3a8a' }}>Turno</th>
                                                        <th style={{ padding: '0.3rem 0.5rem', textAlign: 'left', fontWeight: 700, color: '#1e3a8a' }}>Puesto</th>
                                                        <th style={{ padding: '0.3rem 0.5rem', textAlign: 'left', fontWeight: 700, color: '#1e3a8a' }}>Lugar en sistema</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {importPreview.to_create.map((u, i) => (
                                                        <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                                                            <td style={{ padding: '0.25rem 0.5rem' }}>
                                                                {u.sector}
                                                                {!u.sector_exists && <span style={{ marginLeft: '0.35rem', fontSize: '0.65rem', color: '#2563eb', background: '#dbeafe', padding: '0.1rem 0.3rem', borderRadius: '3px', fontWeight: 600 }}>NUEVO</span>}
                                                            </td>
                                                            <td style={{ padding: '0.25rem 0.5rem' }}>{u.turno}</td>
                                                            <td style={{ padding: '0.25rem 0.5rem' }}>{u.nombre}</td>
                                                            <td style={{ padding: '0.25rem 0.5rem', color: '#059669', fontWeight: 500 }}>{u.lugar_sistema}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </details>
                                )}
                                {!createMissing && importPreview.unmatched.length > 0 && (
                                    <details>
                                        <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#b91c1c' }}>Filas no matcheadas ({importPreview.unmatched.length})</summary>
                                        <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.3rem', fontSize: '0.72rem', maxHeight: '180px', overflow: 'auto' }}>
                                            {importPreview.unmatched.map((u, i) => (
                                                <li key={i} style={{ marginBottom: '0.15rem' }}>
                                                    <strong>{u.sheet}</strong> · {u.turno} · "{u.puesto}" → <em>{u.lugar_sistema}</em>
                                                </li>
                                            ))}
                                        </ul>
                                        <p style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: '#64748b' }}>
                                            Estas filas del Excel no encontraron un puesto configurado con ese sector + turno + nombre. Activá "Crear faltantes" arriba o creá los puestos manualmente.
                                        </p>
                                    </details>
                                )}

                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.7rem' }}>
                                    <button onClick={resetImport} disabled={applying} style={{ padding: '0.4rem 0.9rem', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Cancelar</button>
                                    {(() => {
                                        const totalOps = importPreview.matches_count + (createMissing ? importPreview.to_create_count : 0);
                                        return (
                                            <button onClick={() => runImport(true)} disabled={applying || totalOps === 0} style={{ padding: '0.4rem 0.9rem', border: 'none', borderRadius: '6px', background: totalOps === 0 ? '#94a3b8' : '#16a34a', color: '#fff', cursor: (applying || totalOps === 0) ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
                                                {applying ? 'Aplicando...' : `Aplicar cambios (${totalOps})`}
                                            </button>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}

                        {/* Limpieza de duplicados de turnos */}
                        {!importPreview && !importApplied && (
                            <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed #bfdbfe' }}>
                                {!dupPreview ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.76rem', color: '#334155' }}>
                                            ¿Ves turnos duplicados (ej. "22 A 06" y "22 A 6")? Correr limpieza:
                                        </span>
                                        <button onClick={() => runDupLimpieza(false)} disabled={dupApplying} style={{ padding: '0.35rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#fff', cursor: dupApplying ? 'wait' : 'pointer', fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>
                                            {dupApplying ? 'Analizando...' : 'Buscar duplicados'}
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ background: '#fff', border: '1px solid #fcd34d', borderRadius: '6px', padding: '0.55rem 0.75rem', fontSize: '0.78rem', color: '#78350f' }}>
                                        <div style={{ fontWeight: 700, marginBottom: '0.3rem' }}>Limpieza preview</div>
                                        <div style={{ marginBottom: '0.35rem' }}>
                                            <strong>{dupPreview.total_turnos_normalizar}</strong> turnos a normalizar · <strong>{dupPreview.total_grupos_duplicados}</strong> grupos duplicados · <strong>{dupPreview.total_borrar}</strong> puestos a fusionar (borrar)
                                        </div>
                                        {dupPreview.duplicados.length > 0 && (
                                            <details style={{ marginBottom: '0.3rem' }}>
                                                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Duplicados a fusionar ({dupPreview.duplicados.length})</summary>
                                                <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.3rem', fontSize: '0.72rem', maxHeight: '160px', overflow: 'auto' }}>
                                                    {dupPreview.duplicados.map((d, i) => (
                                                        <li key={i} style={{ marginBottom: '0.15rem' }}>
                                                            <strong>{d.sector}</strong> · {d.turno} · "{d.puesto}" — quedan {d.losers_ids.length} duplicados a borrar
                                                        </li>
                                                    ))}
                                                </ul>
                                            </details>
                                        )}
                                        {dupPreview.turnos_renombrados.length > 0 && (
                                            <details>
                                                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Turnos a normalizar ({dupPreview.turnos_renombrados.length})</summary>
                                                <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.3rem', fontSize: '0.72rem', maxHeight: '160px', overflow: 'auto' }}>
                                                    {dupPreview.turnos_renombrados.map((t, i) => (
                                                        <li key={i}>"{t.turno_actual}" → <strong>{t.turno_nuevo}</strong></li>
                                                    ))}
                                                </ul>
                                            </details>
                                        )}
                                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', marginTop: '0.4rem' }}>
                                            <button onClick={() => setDupPreview(null)} style={{ padding: '0.3rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>Cancelar</button>
                                            <button onClick={() => runDupLimpieza(true)} disabled={dupApplying} style={{ padding: '0.3rem 0.75rem', border: 'none', borderRadius: '6px', background: '#d97706', color: '#fff', cursor: dupApplying ? 'wait' : 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>
                                                {dupApplying ? 'Aplicando...' : 'Aplicar limpieza'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* PASO 3: resultado aplicado */}
                        {importApplied && (
                            <div style={{ marginTop: '0.25rem', padding: '0.55rem 0.75rem', background: '#dcfce7', border: '1px solid #86efac', borderRadius: '6px', fontSize: '0.78rem', color: '#14532d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <div>
                                    ✓ <strong>{importApplied.updated}</strong> puestos actualizados
                                    {importApplied.created > 0 && <> · <strong>{importApplied.created}</strong> puestos nuevos creados</>}
                                    {importApplied.createdSectors > 0 && <> · <strong>{importApplied.createdSectors}</strong> sectores nuevos</>}
                                </div>
                                <button onClick={resetImport} style={{ padding: '0.3rem 0.7rem', border: '1px solid #86efac', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: '#14532d' }}>Importar otro</button>
                            </div>
                        )}
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    {/* Clientes */}
                    <div style={colCard}>
                        <h2 style={{ margin: 0, fontSize: '0.95rem', color: '#1d3461', fontWeight: 800 }}>Clientes</h2>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <input style={inputStyle} placeholder="Nuevo cliente..." value={newClienteName} onChange={e => setNewClienteName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') crearCliente(); }} />
                            <button style={btnPrimary} onClick={crearCliente}><Plus size={14}/></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', overflowY: 'auto', maxHeight: '420px' }}>
                            {activos.map(c => (
                                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.5rem', background: clienteSel === c.id ? '#dbeafe' : '#f8fafc', borderRadius: '6px', border: clienteSel === c.id ? '1px solid #1d3461' : '1px solid transparent' }}>
                                    {editingCliente?.id === c.id ? (
                                        <>
                                            <input style={{ ...inputStyle, padding: '0.3rem 0.5rem' }} value={editingCliente.name} onChange={e => setEditingCliente({ ...editingCliente, name: e.target.value })} />
                                            <button style={btnMuted} onClick={() => renombrarCliente(c.id, editingCliente.name)}><Save size={14}/></button>
                                            <button style={btnMuted} onClick={() => setEditingCliente(null)}><X size={14}/></button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => setClienteSel(c.id)} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#1d3461', padding: '0.1rem 0' }}>{c.name}</button>
                                            <button style={btnMuted} onClick={() => setEditingCliente({ id: c.id, name: c.name })}><Edit2 size={13}/></button>
                                            <button style={{ ...btnMuted, color: '#dc2626' }} onClick={() => borrarCliente(c.id)}><Trash2 size={13}/></button>
                                        </>
                                    )}
                                </div>
                            ))}
                            {activos.length === 0 && <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>No hay clientes.</p>}
                        </div>
                    </div>

                    {/* Sectores */}
                    <div style={colCard}>
                        <h2 style={{ margin: 0, fontSize: '0.95rem', color: '#1d3461', fontWeight: 800 }}>Sectores {clienteSel && <span style={{ color: '#64748b', fontWeight: 500 }}>— {activos.find(c => c.id === clienteSel)?.name}</span>}</h2>
                        {!clienteSel ? (
                            <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>Seleccioná un cliente.</p>
                        ) : (
                            <>
                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    <input style={inputStyle} placeholder="Nuevo sector..." value={newSectorName} onChange={e => setNewSectorName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') crearSector(); }} />
                                    <button style={btnPrimary} onClick={crearSector}><Plus size={14}/></button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', overflowY: 'auto', maxHeight: '420px' }}>
                                    {sectoresActivos.map(s => (
                                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.5rem', background: sectorSel === s.id ? '#dbeafe' : '#f8fafc', borderRadius: '6px', border: sectorSel === s.id ? '1px solid #1d3461' : '1px solid transparent' }}>
                                            {editingSector?.id === s.id ? (
                                                <>
                                                    <input style={{ ...inputStyle, padding: '0.3rem 0.5rem' }} value={editingSector.name} onChange={e => setEditingSector({ ...editingSector, name: e.target.value })} />
                                                    <button style={btnMuted} onClick={() => renombrarSector(s.id, editingSector.name)}><Save size={14}/></button>
                                                    <button style={btnMuted} onClick={() => setEditingSector(null)}><X size={14}/></button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => setSectorSel(s.id)} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#1d3461', padding: '0.1rem 0' }}>{s.name}</button>
                                                    <button style={btnMuted} onClick={() => setEditingSector({ id: s.id, name: s.name })}><Edit2 size={13}/></button>
                                                    <button style={{ ...btnMuted, color: '#dc2626' }} onClick={() => borrarSector(s.id)}><Trash2 size={13}/></button>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                    {sectoresActivos.length === 0 && <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>Sin sectores.</p>}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Turnos + Puestos */}
                    <div style={{ ...colCard, gridColumn: 'auto / span 1' }}>
                        <h2 style={{ margin: 0, fontSize: '0.95rem', color: '#1d3461', fontWeight: 800 }}>Turnos y puestos {sectorSel && <span style={{ color: '#64748b', fontWeight: 500 }}>— {sectoresActivos.find(s => s.id === sectorSel)?.name}</span>}</h2>
                        {!sectorSel ? (
                            <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>Seleccioná un sector.</p>
                        ) : (
                            <>
                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    <input list="turnos-sugeridos" style={inputStyle} placeholder="Nuevo turno (ej: 6 A 14)..." value={newTurnoName} onChange={e => setNewTurnoName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') agregarTurno(); }} />
                                    <datalist id="turnos-sugeridos">
                                        {TURNOS_SUGERIDOS.filter(t => !turnosDelSector.includes(t)).map(t => <option key={t} value={t}/>)}
                                    </datalist>
                                    <button style={btnPrimary} onClick={agregarTurno} disabled={fetching}><Plus size={14}/></button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', overflowY: 'auto', maxHeight: '500px' }}>
                                    {turnosDelSector.map(turno => (
                                        <div key={turno} style={{ background: '#f1f5f9', borderRadius: '8px', padding: '0.7rem', border: '1px solid #cbd5e1' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem', gap: '0.4rem' }}>
                                                <span style={{ fontWeight: 800, color: '#1d3461', fontSize: '0.82rem', letterSpacing: '0.04em' }}>{turno}</span>
                                                <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                                                    <button style={{ ...btnPrimary, padding: '0.3rem 0.55rem', fontSize: '0.72rem' }} onClick={() => agregarPuesto(turno)}><Plus size={12}/> Puesto</button>
                                                    <button style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.3rem 0.5rem', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 700 }} onClick={() => borrarTurno(turno)} title="Eliminar turno completo"><Trash2 size={12}/> Turno</button>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                                {puestos.filter(p => p.turno === turno && p.active === 1).map(p => (
                                                    <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', background: '#fff', padding: '0.4rem 0.55rem', borderRadius: '5px', border: '1px solid #e2e8f0' }}>
                                                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                                            <input
                                                                style={{ ...inputStyle, padding: '0.3rem 0.5rem', flex: 2 }}
                                                                defaultValue={p.nombre}
                                                                placeholder="Nombre del puesto (ej. Asilo)"
                                                                onBlur={e => { if (e.target.value.trim() && e.target.value !== p.nombre) actualizarPuesto(p.id, { nombre: e.target.value.trim() }); }}
                                                            />
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                style={{ ...inputStyle, padding: '0.3rem 0.5rem', flex: 0.5, width: '60px' }}
                                                                defaultValue={p.cantidad}
                                                                onBlur={e => { const v = Math.max(1, Number(e.target.value) || 1); if (v !== p.cantidad) actualizarPuesto(p.id, { cantidad: v }); }}
                                                            />
                                                            <button style={{ ...btnMuted, color: '#dc2626' }} onClick={() => borrarPuesto(p.id)}><Trash2 size={13}/></button>
                                                        </div>
                                                        <input
                                                            style={{ ...inputStyle, padding: '0.25rem 0.5rem', fontSize: '0.74rem', color: '#475569', background: '#f8fafc' }}
                                                            defaultValue={p.lugar_sistema || ''}
                                                            placeholder="Lugar en sistema (ej. Casmu - Asilo - Limpiador) — para cruzar con Panel Mitrabajo"
                                                            onBlur={e => {
                                                                const val = e.target.value.trim();
                                                                if (val !== (p.lugar_sistema || '')) actualizarPuesto(p.id, { lugar_sistema: val || null });
                                                            }}
                                                        />
                                                    </div>
                                                ))}
                                                {puestos.filter(p => p.turno === turno && p.active === 1).length === 0 && <p style={{ color: '#94a3b8', fontSize: '0.72rem', margin: 0 }}>Turno sin puestos.</p>}
                                            </div>
                                        </div>
                                    ))}
                                    {turnosDelSector.length === 0 && <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>Sin turnos configurados.</p>}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
