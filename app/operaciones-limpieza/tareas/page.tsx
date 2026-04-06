'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, X, ClipboardList, LogOut, Edit2, Trash2, Check } from 'lucide-react';
import { useTicketContext, hasModuleAccess } from '@/app/context/TicketContext';

interface Registro {
    id: number;
    nombre: string;
    cedula: string;
    cliente: string;
    sector: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    tareas: string;
    tareas_timestamps: string;
    fotos: string;
    observaciones: string;
    created_at: string;
}

export default function TareasPage() {
    const { currentUser, isAuthenticated, loading, logout, getAuthHeaders } = useTicketContext() as any;
    const router = useRouter();

    const [registros, setRegistros] = useState<Registro[]>([]);
    const [fetching, setFetching] = useState(false);
    const [search, setSearch] = useState('');
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');

    // Edit Modal State
    const [editingRegistro, setEditingRegistro] = useState<Registro | null>(null);
    const [editForm, setEditForm] = useState<Partial<Registro>>({});
    const [updating, setUpdating] = useState(false);

    const TAREAS_OPCIONES = [
        'Limpieza de Pisos', 'Limpieza de Baños', 'Limpieza de Vidrios',
        'Vaciado de Papeleras', 'Reposición de Insumos', 'Desinfección de Áreas',
        'Mantenimiento de Zonas Verdes', 'Barrido Exterior', 'Limpieza de Oficina',
        'Otros'
    ];

    useEffect(() => {
        if (loading) return;
        if (!isAuthenticated) router.push('/login');
        else if (currentUser && !hasModuleAccess(currentUser, 'limpieza')) router.push('/');
    }, [loading, isAuthenticated, currentUser, router]);

    const fetchRegistros = useCallback(async () => {
        setFetching(true);
        try {
            const params = new URLSearchParams();
            if (desde) params.set('desde', desde);
            if (hasta) params.set('hasta', hasta);
            if (search) params.set('search', search);
            const res = await fetch(`/api/limpieza/registros?${params.toString()}`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setRegistros(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setFetching(false);
        }
    }, [desde, hasta, search, getAuthHeaders]);

    useEffect(() => {
        if (isAuthenticated && currentUser && hasModuleAccess(currentUser, 'limpieza')) {
            fetchRegistros();
        }
    }, [isAuthenticated, currentUser, fetchRegistros]);

    const handleExport = async () => {
        const params = new URLSearchParams();
        if (desde) params.set('desde', desde);
        if (hasta) params.set('hasta', hasta);
        if (search) params.set('search', search);
        
        try {
            const res = await fetch(`/api/limpieza/registros/export?${params.toString()}`, {
                method: 'GET',
                headers: getAuthHeaders()
            });
            
            if (!res.ok) {
                alert('Error al exportar: Permiso denegado o problema en el servidor.');
                return;
            }
            
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `Recuento_Limpieza_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error al descargar Excel:', error);
            alert('Ocurrió un error al procesar la descarga del archivo.');
        }
    };

    const clearFilters = () => {
        setSearch('');
        setDesde('');
        setHasta('');
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Está seguro de que desea eliminar este registro permanentemente?')) return;
        
        try {
            const res = await fetch(`/api/limpieza/registros?id=${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (res.ok) {
                setRegistros(prev => prev.filter(r => r.id !== id));
            } else {
                alert('Error al eliminar el registro');
            }
        } catch (e) {
            console.error(e);
            alert('Error al eliminar');
        }
    };

    const handleEditClick = (reg: Registro) => {
        setEditingRegistro(reg);
        let parsedTareas: string[] = [];
        try {
            parsedTareas = JSON.parse(reg.tareas || '[]');
        } catch {
            parsedTareas = reg.tareas ? [reg.tareas] : [];
        }
        setEditForm({ 
            ...reg,
            tareas: JSON.stringify(parsedTareas)
        });
    };

    const handleUpdate = async () => {
        if (!editingRegistro) return;
        setUpdating(true);
        try {
            const res = await fetch('/api/limpieza/registros', {
                method: 'PUT',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(editForm)
            });
            if (res.ok) {
                await fetchRegistros();
                setEditingRegistro(null);
            } else {
                alert('Error al actualizar');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setUpdating(false);
        }
    };

    const toggleTareaInEdit = (tarea: string) => {
        let current: string[] = [];
        try {
            current = JSON.parse(editForm.tareas || '[]');
        } catch {
            current = editForm.tareas ? [editForm.tareas as string] : [];
        }

        if (current.includes(tarea)) {
            current = current.filter(t => t !== tarea);
        } else {
            current = [...current, tarea];
        }
        setEditForm(prev => ({ ...prev, tareas: JSON.stringify(current) }));
    };

    const hasFilters = !!(search || desde || hasta);

    const [photoViewer, setPhotoViewer] = useState<string | null>(null);

    const parseTareas = (r: Registro): { tarea: string; hora: string | null; fotos: string[] }[] => {
        let tareasArr: string[] = [];
        let timestamps: Record<string, string> = {};
        let fotosMap: Record<string, string[]> = {};
        try { tareasArr = JSON.parse(r.tareas || '[]'); } catch {}
        try { timestamps = JSON.parse(r.tareas_timestamps || '{}'); } catch {}
        try { fotosMap = JSON.parse(r.fotos || '{}'); } catch {}
        return tareasArr.map(t => ({ tarea: t, hora: timestamps[t] || null, fotos: fotosMap[t] || [] }));
    };

    if (loading || !currentUser) return null;

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

            <main style={{ flex: 1, padding: '1.5rem 2rem', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
                {/* Title row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <ClipboardList size={22} color="var(--primary-color)" />
                        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Recuento de Tareas</h1>
                    </div>
                    <button
                        onClick={handleExport}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1.1rem', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', fontSize: '0.875rem', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 500 }}
                    >
                        <Download size={15} /> Exportar Excel
                    </button>
                </div>

                {/* Filters */}
                <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        {/* Search */}
                        <div style={{ flex: '1', minWidth: '240px' }}>
                            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 850, color: 'var(--primary-color)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Buscar</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder=""
                                    style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', fontSize: '0.875rem', backgroundColor: 'white', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                                />
                            </div>
                        </div>
                        {/* Fecha Range */}
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flex: '1', minWidth: '240px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 850, color: 'var(--text-secondary)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Desde</label>
                                <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', fontSize: '0.875rem', backgroundColor: 'white', color: 'var(--text-primary)' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 850, color: 'var(--text-secondary)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Hasta</label>
                                <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', fontSize: '0.875rem', backgroundColor: 'white', color: 'var(--text-primary)' }} />
                            </div>
                        </div>
                        {/* Apply & Clear */}
                        <div style={{ display: 'flex', gap: '0.5rem', width: '100%', justifyContent: 'flex-end', marginTop: '0.5rem' }} className="mobile-only-flex">
                            {hasFilters && (
                                <button onClick={clearFilters} style={{ flex: 1, padding: '0.75rem', backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', fontSize: '0.875rem', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>
                                    Limpiar
                                </button>
                            )}
                            <button onClick={fetchRegistros} style={{ flex: 2, padding: '0.75rem', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
                                Aplicar filtros
                            </button>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }} className="desktop-only">
                            <button onClick={fetchRegistros} style={{ padding: '0.65rem 1.25rem', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
                                Aplicar
                            </button>
                            {hasFilters && (
                                <button onClick={clearFilters} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.65rem 1rem', backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', fontSize: '0.875rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                {/* Table / Cards Container */}
                <div style={{ width: '100%' }}>
                    {fetching ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', backgroundColor: 'var(--surface-color)', borderRadius: 'var(--radius)' }}>Cargando registros...</div>
                    ) : registros.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', backgroundColor: 'var(--surface-color)', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                            <ClipboardList size={40} style={{ opacity: 0.25, marginBottom: '0.75rem' }} />
                            <p>{hasFilters ? 'No se encontraron registros con los filtros aplicados.' : 'No hay registros todavía.'}</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table View */}
                            <div className="desktop-view card" style={{ padding: 0, overflow: 'hidden' }}>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: 'var(--surface-color)', borderBottom: '2px solid var(--border-color)' }}>
                                                {['Nombre', 'Cédula', 'Cliente', 'Sector', 'Fecha', 'Horario', 'Tareas', 'Observaciones', 'Acciones'].map(h => (
                                                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {registros.map((r, i) => (
                                                <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)' }}>
                                                    <td style={{ padding: '0.7rem 1rem', fontWeight: 500, whiteSpace: 'nowrap' }}>{r.nombre}</td>
                                                    <td style={{ padding: '0.7rem 1rem', color: 'var(--text-secondary)' }}>{r.cedula}</td>
                                                    <td style={{ padding: '0.7rem 1rem' }}>{r.cliente || '-'}</td>
                                                    <td style={{ padding: '0.7rem 1rem', color: 'var(--text-secondary)' }}>{r.sector || '-'}</td>
                                                    <td style={{ padding: '0.7rem 1rem', whiteSpace: 'nowrap' }}>{r.fecha}</td>
                                                    <td style={{ padding: '0.7rem 1rem', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{r.hora_inicio || '--:--'} - {r.hora_fin || '--:--'}</td>
                                                    <td style={{ padding: '0.7rem 1rem', maxWidth: '260px' }}>
                                                        {r.tareas ? (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                                                {parseTareas(r).map(({ tarea, hora, fotos }, i) => (
                                                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                                                        <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '9999px', backgroundColor: 'rgba(29,52,97,0.1)', color: '#1d3461', fontWeight: 500, whiteSpace: 'nowrap' }}>{tarea}</span>
                                                                        {hora && <span style={{ fontSize: '0.65rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{hora}</span>}
                                                                        {fotos.map((src, fi) => (
                                                                            // eslint-disable-next-line @next/next/no-img-element
                                                                            <img key={fi} src={src} alt="foto" onClick={() => setPhotoViewer(src)} style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid #d1d5db' }} />
                                                                        ))}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : '-'}
                                                    </td>
                                                    <td style={{ padding: '0.7rem 1rem', maxWidth: '150px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                                        <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>{r.observaciones || '-'}</span>
                                                    </td>
                                                    <td style={{ padding: '0.7rem 1rem' }}>
                                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                            <button 
                                                                onClick={() => handleEditClick(r)}
                                                                style={{ background: 'none', border: 'none', color: '#1d3461', cursor: 'pointer', padding: '0.25rem' }}
                                                                title="Editar"
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDelete(r.id)}
                                                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}
                                                                title="Eliminar"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {registros.length} registro{registros.length !== 1 ? 's' : ''}{hasFilters ? ' (filtrado)' : ''}
                                    </div>
                                </div>
                            </div>

                            {/* Mobile Card View */}
                            <div className="mobile-view">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {registros.map((r) => (
                                        <div key={r.id} className="logbook-card">
                                            <div className="logbook-card-header" style={{ backgroundColor: 'rgba(41,65,107,0.03)' }}>
                                                <span style={{ color: 'var(--primary-color)', fontWeight: 700 }}>{r.nombre}</span>
                                                <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--bg-color)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{r.fecha}</span>
                                            </div>
                                            <div className="logbook-card-body">
                                                <div className="logbook-row">
                                                    <span className="logbook-label">Cliente:</span>
                                                    <span className="logbook-value">{r.cliente || '-'}</span>
                                                </div>
                                                <div className="logbook-row">
                                                    <span className="logbook-label">Sector:</span>
                                                    <span className="logbook-value">{r.sector || '-'}</span>
                                                </div>
                                                <div className="logbook-row">
                                                    <span className="logbook-label">Horario:</span>
                                                    <span className="logbook-value">{r.hora_inicio || '--:--'} - {r.hora_fin || '--:--'}</span>
                                                </div>
                                                <div style={{ marginTop: '0.75rem' }}>
                                                    <span className="logbook-label" style={{ display: 'block', marginBottom: '0.4rem' }}>Tareas:</span>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                        {parseTareas(r).map(({ tarea, hora, fotos }, i) => (
                                                            <div key={i}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                                    <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '6px', backgroundColor: 'var(--primary-color)', color: 'white', fontWeight: 500 }}>{tarea}</span>
                                                                    {hora && <span style={{ fontSize: '0.65rem', color: '#6b7280' }}>{hora}</span>}
                                                                </div>
                                                                {fotos.length > 0 && (
                                                                    <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
                                                                        {fotos.map((src, fi) => (
                                                                            // eslint-disable-next-line @next/next/no-img-element
                                                                            <img key={fi} src={src} alt="foto" onClick={() => setPhotoViewer(src)} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer', border: '1px solid #d1d5db' }} />
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                {r.observaciones && (
                                                    <div style={{ marginTop: '0.75rem', padding: '0.6rem', backgroundColor: 'var(--bg-color)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                        <strong>Obs:</strong> {r.observaciones}
                                                    </div>
                                                )}
                                                
                                                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                                                    <button 
                                                        onClick={() => handleEditClick(r)}
                                                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem', backgroundColor: 'rgba(29,52,97,0.05)', color: '#1d3461', border: 'none', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                                                    >
                                                        <Edit2 size={14} /> Editar
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(r.id)}
                                                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem', backgroundColor: 'rgba(239,68,68,0.05)', color: '#ef4444', border: 'none', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                                                    >
                                                        <Trash2 size={14} /> Eliminar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        Total: {registros.length} registros
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </main>

            {/* Photo lightbox */}
            {photoViewer && (
                <div onClick={() => setPhotoViewer(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', cursor: 'zoom-out' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoViewer} alt="foto" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '8px', boxShadow: '0 0 40px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()} />
                    <button onClick={() => setPhotoViewer(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>
            )}

            {/* Edit Modal */}
            {editingRegistro && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="card modal-responsive" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', position: 'relative' }}>
                        <button onClick={() => setEditingRegistro(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
                        
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1d3461', margin: '0 0 1.5rem' }}>Editar Registro</h3>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Cliente</label>
                                    <input value={editForm.cliente || ''} onChange={e => setEditForm(p => ({ ...p, cliente: e.target.value }))} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: '#f1f5f9' }} readOnly />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Sector</label>
                                    <input value={editForm.sector || ''} onChange={e => setEditForm(p => ({ ...p, sector: e.target.value }))} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Hora Inicio</label>
                                    <input type="time" value={editForm.hora_inicio || ''} onChange={e => setEditForm(p => ({ ...p, hora_inicio: e.target.value }))} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Hora Fin</label>
                                    <input type="time" value={editForm.hora_fin || ''} onChange={e => setEditForm(p => ({ ...p, hora_fin: e.target.value }))} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Tareas Realizadas</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                                    {TAREAS_OPCIONES.map(t => {
                                        const isChecked = JSON.parse(editForm.tareas || '[]').includes(t);
                                        return (
                                            <div key={t} onClick={() => toggleTareaInEdit(t)} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', borderRadius: '6px', border: '1px solid', borderColor: isChecked ? '#1d3461' : '#e2e8f0', backgroundColor: isChecked ? 'rgba(29,52,97,0.05)' : '#fff', cursor: 'pointer' }}>
                                                <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: '1px solid', borderColor: isChecked ? '#1d3461' : '#cbd5e1', backgroundColor: isChecked ? '#1d3461' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                                    {isChecked && <Check size={14} />}
                                                </div>
                                                <span style={{ fontSize: '0.85rem', color: isChecked ? '#1d3461' : '#475569', fontWeight: isChecked ? 600 : 400 }}>{t}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Observaciones</label>
                                <textarea 
                                    value={editForm.observaciones || ''} 
                                    onChange={e => setEditForm(p => ({ ...p, observaciones: e.target.value }))} 
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', minHeight: '80px', fontSize: '0.85rem' }} 
                                />
                            </div>

                            <button
                                onClick={handleUpdate}
                                disabled={updating}
                                style={{
                                    width: '100%', padding: '0.85rem', backgroundColor: updating ? '#9ca3af' : '#1d3461',
                                    color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 700,
                                    cursor: updating ? 'not-allowed' : 'pointer', marginTop: '1rem'
                                }}
                            >
                                {updating ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
