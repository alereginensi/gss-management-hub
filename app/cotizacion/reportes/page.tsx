'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, LogOut } from 'lucide-react';
import { useTicketContext } from '@/app/context/TicketContext';

interface Period { id: number; label: string; date_from: string; date_to: string; status: string; entry_count: number; total_hours: number; }
interface Entry { funcionario: string; category_name: string | null; date: string; regular_hours: string; overtime_hours: string; location: string | null; estimated_cost: number; }

const STATUS_LABELS: Record<string, string> = { draft: 'Borrador', approved: 'Aprobado', closed: 'Cerrado' };
const STATUS_COLORS: Record<string, string> = { draft: '#f59e0b', approved: '#22c55e', closed: '#94a3b8' };

export default function ReportesPage() {
    const { currentUser, isAuthenticated, loading, logout } = useTicketContext();
    const router = useRouter();
    const [periods, setPeriods] = useState<Period[]>([]);
    const [selectedId, setSelectedId] = useState<string>('');
    const [preview, setPreview] = useState<Entry[]>([]);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [exporting, setExporting] = useState(false);

    const getAuthHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    useEffect(() => {
        if (loading) return;
        if (!isAuthenticated) { router.push('/login'); return; }
        if (currentUser && currentUser.role !== 'admin' && currentUser.role !== 'contador') { router.push('/'); return; }
        fetch('/api/cotizacion/periods', { headers: getAuthHeaders() })
            .then(r => r.json()).then(setPeriods).catch(console.error);
    }, [loading, isAuthenticated, currentUser, router]);

    useEffect(() => {
        if (!selectedId) { setPreview([]); return; }
        setLoadingPreview(true);
        fetch(`/api/cotizacion/periods/${selectedId}/entries`, { headers: getAuthHeaders() })
            .then(r => r.json()).then(setPreview).catch(console.error).finally(() => setLoadingPreview(false));
    }, [selectedId]);

    const exportExcel = async () => {
        if (!selectedId) return;
        setExporting(true);
        const res = await fetch(`/api/cotizacion/periods/${selectedId}/export`, { headers: getAuthHeaders() });
        if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = res.headers.get('content-disposition')?.split('filename="')[1]?.replace('"', '') || `liquidacion_${selectedId}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } else {
            alert('Error al generar el Excel.');
        }
        setExporting(false);
    };

    if (loading || !currentUser) return null;

    const selectedPeriod = periods.find(p => String(p.id) === selectedId);
    const totalHours = preview.reduce((s, e) => s + parseFloat(e.regular_hours) + parseFloat(e.overtime_hours), 0);
    const totalCost = preview.reduce((s, e) => s + (e.estimated_cost || 0), 0);
    const byCategory: Record<string, { hours: number; cost: number; count: number }> = {};
    for (const e of preview) {
        const k = e.category_name || 'Sin categoría';
        if (!byCategory[k]) byCategory[k] = { hours: 0, cost: 0, count: 0 };
        byCategory[k].hours += parseFloat(e.regular_hours) + parseFloat(e.overtime_hours);
        byCategory[k].cost += e.estimated_cost || 0;
        byCategory[k].count++;
    }

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

            <main className="standalone-page" style={{ flex: 1, padding: '1.5rem 2rem', maxWidth: '900px', width: '100%', margin: '0 auto' }}>
                <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Reportes y Exportación</h1>

                <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.5rem' }}>Seleccionar período</label>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="form-control" style={{ flex: 1, minWidth: '200px' }}>
                            <option value="">— Elegir período —</option>
                            {periods.map(p => (
                                <option key={p.id} value={p.id}>{p.label} ({p.date_from} → {p.date_to}) · {STATUS_LABELS[p.status]}</option>
                            ))}
                        </select>
                        <button
                            onClick={exportExcel}
                            disabled={!selectedId || exporting}
                            className="btn"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', opacity: !selectedId ? 0.5 : 1 }}
                        >
                            <Download size={15} /> {exporting ? 'Generando...' : 'Descargar Excel'}
                        </button>
                    </div>
                </div>

                {selectedPeriod && (
                    <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                            <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>{selectedPeriod.label}</h2>
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: STATUS_COLORS[selectedPeriod.status], backgroundColor: `${STATUS_COLORS[selectedPeriod.status]}20`, borderRadius: '4px', padding: '0.15rem 0.4rem' }}>{STATUS_LABELS[selectedPeriod.status]}</span>
                        </div>

                        {loadingPreview ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Cargando preview...</div>
                        ) : preview.length === 0 ? (
                            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Este período no tiene entradas.</div>
                        ) : (
                            <>
                                {/* Summary by category */}
                                <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
                                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Resumen por Categoría</h3>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                                <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', fontWeight: 500 }}>Categoría</th>
                                                <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 500 }}>Entradas</th>
                                                <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 500 }}>Total Hs</th>
                                                <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 500 }}>Costo Est.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(byCategory).map(([cat, data]) => (
                                                <tr key={cat} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                    <td style={{ padding: '0.4rem 0.5rem' }}>{cat}</td>
                                                    <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: 'var(--text-secondary)' }}>{data.count}</td>
                                                    <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>{data.hours.toFixed(1)} hs</td>
                                                    <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 500 }}>${data.cost.toLocaleString('es-UY', { minimumFractionDigits: 2 })}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: 700 }}>
                                                <td style={{ padding: '0.4rem 0.5rem' }}>TOTAL</td>
                                                <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>{preview.length}</td>
                                                <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>{totalHours.toFixed(1)} hs</td>
                                                <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>${totalCost.toLocaleString('es-UY', { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                    El Excel incluye la hoja <strong>Resumen</strong> (por categoría) y <strong>Detalle</strong> (todas las entradas).
                                </p>
                            </>
                        )}
                    </div>
                )}
            </main>

            <button onClick={() => { logout(); router.push('/login'); }} style={{ position: 'fixed', bottom: '1.5rem', left: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.5rem 0.9rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <LogOut size={14} /> Cerrar sesión
            </button>
        </div>
    );
}
