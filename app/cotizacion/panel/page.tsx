'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, DollarSign, Users, CalendarDays, LogOut } from 'lucide-react';
import { useTicketContext } from '@/app/context/TicketContext';

interface PanelData {
    period: { id: number; label: string; date_from: string; date_to: string; status: string } | null;
    total_hours: number;
    total_employees: number;
    estimated_cost: number;
    by_service_type: { name: string; hours: number; cost: number; count: number }[];
}

const STATUS_LABELS: Record<string, string> = { draft: 'Borrador', approved: 'Aprobado', closed: 'Cerrado' };
const STATUS_COLORS: Record<string, string> = { draft: '#f59e0b', approved: '#22c55e', closed: '#94a3b8' };

export default function CotizacionPanelPage() {
    const { currentUser, isAuthenticated, loading, logout } = useTicketContext();
    const router = useRouter();
    const [data, setData] = useState<PanelData | null>(null);
    const [fetching, setFetching] = useState(true);

    const getAuthHeaders = (): HeadersInit => {
        return {};
    };

    useEffect(() => {
        if (loading) return;
        if (!isAuthenticated) { router.push('/login'); return; }
        if (currentUser && currentUser.role !== 'admin' && currentUser.role !== 'contador') { router.push('/'); return; }
        fetch('/api/cotizacion/panel', { headers: getAuthHeaders() })
            .then(r => r.json()).then(setData).catch(console.error).finally(() => setFetching(false));
    }, [loading, isAuthenticated, currentUser, router]);

    if (loading || !currentUser) return null;

    const maxHours = data?.by_service_type?.length ? Math.max(...data.by_service_type.map(s => s.hours)) : 1;

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
                <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Panel de Comercial</h1>

                {fetching ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                        <div style={{ width: '32px', height: '32px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary-color)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    </div>
                ) : !data?.period ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        <p>No hay períodos activos.</p>
                        <Link href="/cotizacion/liquidacion" style={{ color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 500 }}>Crear un período →</Link>
                    </div>
                ) : (
                    <>
                        {/* KPI Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                            {[
                                { label: 'Total Horas', value: `${data.total_hours} hs`, icon: Clock, color: '#3b82f6' },
                                { label: 'Costo Estimado', value: `$${data.estimated_cost.toLocaleString('es-UY')}`, icon: DollarSign, color: '#22c55e' },
                                { label: 'Funcionarios', value: data.total_employees, icon: Users, color: '#8b5cf6' },
                                { label: 'Período', value: STATUS_LABELS[data.period.status] || data.period.status, icon: CalendarDays, color: STATUS_COLORS[data.period.status] || '#94a3b8' },
                            ].map(({ label, value, icon: Icon, color }) => (
                                <div key={label} className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ padding: '0.75rem', backgroundColor: `${color}20`, borderRadius: '50%', flexShrink: 0 }}>
                                        <Icon size={22} color={color} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>{label}</div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Period info */}
                        <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{data.period.label}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{data.period.date_from} → {data.period.date_to}</div>
                            </div>
                            <Link href="/cotizacion/liquidacion" style={{ fontSize: '0.82rem', color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 500 }}>
                                Ver detalle →
                            </Link>
                        </div>

                        {/* Distribution by service type */}
                        {data.by_service_type.length > 0 && (
                            <div className="card" style={{ padding: '1.25rem' }}>
                                <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>Distribución por Tipo de Servicio</h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                                    {data.by_service_type.sort((a, b) => b.hours - a.hours).map(s => (
                                        <div key={s.name}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                                                <span>{s.name}</span>
                                                <span style={{ color: 'var(--text-secondary)' }}>{s.hours} hs · ${s.cost.toLocaleString('es-UY')}</span>
                                            </div>
                                            <div style={{ height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${(s.hours / maxHours) * 100}%`, backgroundColor: 'var(--primary-color)', borderRadius: '4px', transition: 'width 0.4s ease' }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>

            <button onClick={() => { logout(); router.push('/login'); }} style={{ position: 'fixed', bottom: '1.5rem', left: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.5rem 0.9rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <LogOut size={14} /> Cerrar sesión
            </button>
        </div>
    );
}
