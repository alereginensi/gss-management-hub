'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search, Download, X, ClipboardList, LogOut } from 'lucide-react';
import { useTicketContext, hasModuleAccess } from '@/app/context/TicketContext';

interface Registro {
    id: number;
    nombre: string;
    cedula: string;
    email: string;
    sector: string;
    ubicacion: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    tareas: string;
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

    const handleExport = () => {
        const params = new URLSearchParams();
        if (desde) params.set('desde', desde);
        if (hasta) params.set('hasta', hasta);
        if (search) params.set('search', search);
        window.open(`/api/limpieza/registros/export?${params.toString()}`, '_blank');
    };

    const clearFilters = () => {
        setSearch('');
        setDesde('');
        setHasta('');
    };

    const hasFilters = !!(search || desde || hasta);

    if (loading || !currentUser) return null;

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', display: 'flex', flexDirection: 'column' }}>
            <header style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--surface-color)'
            }}>
                <Link href="/operaciones-limpieza" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}>
                    <ArrowLeft size={15} /> Operaciones Limpieza
                </Link>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="GSS" style={{ height: '36px' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{currentUser.name}</span>
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
                <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        {/* Search */}
                        <div style={{ flex: '1', minWidth: '200px' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Buscar</label>
                            <div style={{ position: 'relative' }}>
                                <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Nombre, cédula, sector..."
                                    style={{ width: '100%', paddingLeft: '2rem', padding: '0.55rem 0.75rem 0.55rem 2rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', fontSize: '0.875rem', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                                />
                            </div>
                        </div>
                        {/* Desde */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Desde</label>
                            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ padding: '0.55rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', fontSize: '0.875rem', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }} />
                        </div>
                        {/* Hasta */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Hasta</label>
                            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ padding: '0.55rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', fontSize: '0.875rem', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }} />
                        </div>
                        {/* Apply & Clear */}
                        <button onClick={fetchRegistros} style={{ padding: '0.55rem 1.1rem', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-end' }}>
                            Aplicar
                        </button>
                        {hasFilters && (
                            <button onClick={clearFilters} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.55rem 0.9rem', backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', fontSize: '0.875rem', color: 'var(--text-secondary)', cursor: 'pointer', alignSelf: 'flex-end' }}>
                                <X size={13} /> Limpiar
                            </button>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {fetching ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando registros...</div>
                    ) : registros.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            <ClipboardList size={40} style={{ opacity: 0.25, marginBottom: '0.75rem' }} />
                            <p>{hasFilters ? 'No se encontraron registros con los filtros aplicados.' : 'No hay registros todavía.'}</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                <thead>
                                    <tr style={{ backgroundColor: 'var(--surface-color)', borderBottom: '2px solid var(--border-color)' }}>
                                        {['Nombre', 'Cédula', 'Sector', 'Ubicación', 'Fecha', 'Hora Inicio', 'Hora Fin', 'Tareas', 'Observaciones'].map(h => (
                                            <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {registros.map((r, i) => (
                                        <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)' }}>
                                            <td style={{ padding: '0.7rem 1rem', fontWeight: 500, whiteSpace: 'nowrap' }}>{r.nombre}</td>
                                            <td style={{ padding: '0.7rem 1rem', color: 'var(--text-secondary)' }}>{r.cedula}</td>
                                            <td style={{ padding: '0.7rem 1rem' }}>{r.sector}</td>
                                            <td style={{ padding: '0.7rem 1rem', color: 'var(--text-secondary)' }}>{r.ubicacion || '-'}</td>
                                            <td style={{ padding: '0.7rem 1rem', whiteSpace: 'nowrap' }}>{r.fecha}</td>
                                            <td style={{ padding: '0.7rem 1rem', whiteSpace: 'nowrap' }}>{r.hora_inicio || '-'}</td>
                                            <td style={{ padding: '0.7rem 1rem', whiteSpace: 'nowrap' }}>{r.hora_fin || '-'}</td>
                                            <td style={{ padding: '0.7rem 1rem', maxWidth: '260px' }}>
                                                {r.tareas ? (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                                        {(() => {
                                                            try {
                                                                const arr: string[] = JSON.parse(r.tareas);
                                                                return arr.map((t, i) => (
                                                                    <span key={i} style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '9999px', backgroundColor: 'rgba(29,52,97,0.1)', color: '#1d3461', fontWeight: 500, whiteSpace: 'nowrap' }}>{t}</span>
                                                                ));
                                                            } catch {
                                                                return <span>{r.tareas}</span>;
                                                            }
                                                        })()}
                                                    </div>
                                                ) : '-'}
                                            </td>
                                            <td style={{ padding: '0.7rem 1rem', maxWidth: '180px', color: 'var(--text-secondary)' }}>
                                                <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>{r.observaciones || '-'}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                {registros.length} registro{registros.length !== 1 ? 's' : ''}{hasFilters ? ' (filtrado)' : ''}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <button onClick={() => { logout(); router.push('/login'); }} style={{ position: 'fixed', bottom: '1.5rem', left: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.5rem 0.9rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <LogOut size={14} /> Cerrar sesión
            </button>
        </div>
    );
}
