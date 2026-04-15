'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search, ClipboardList, Eye, Calendar, X } from 'lucide-react';
import { useTicketContext, hasModuleAccess } from '@/app/context/TicketContext';
import LogoutExpandButton from '@/app/components/LogoutExpandButton';
import { getAppointmentStatusBadge } from '@/lib/agenda-ui';
import type { AppointmentStatus } from '@/lib/agenda-types';

const EMPRESAS = ['REIMA', 'ORBIS', 'SCOUT', 'ERGON'];
const STATUSES: AppointmentStatus[] = ['confirmada', 'en_proceso', 'completada', 'cancelada', 'ausente', 'reprogramada'];

const today = new Date().toISOString().split('T')[0];
const sevenAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

export default function CitasPage() {
  const { currentUser, isAuthenticated, loading, logout, isMobile } = useTicketContext();
  const router = useRouter();

  const [appointments, setAppointments] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [fetching, setFetching] = useState(true);

  const [search, setSearch] = useState('');
  const [filterFrom, setFilterFrom] = useState(sevenAgo);
  const [filterTo, setFilterTo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const filtersInitialized = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (currentUser && !hasModuleAccess(currentUser, 'logistica')) { router.push('/'); return; }
    // Para rol logística: default hoy + solo confirmadas
    if (currentUser && !filtersInitialized.current) {
      filtersInitialized.current = true;
      if (currentUser.role === 'logistica') {
        setFilterFrom(today);
        setFilterTo(today);
        setFilterStatus('confirmada');
      }
    }
  }, [loading, isAuthenticated, currentUser, router]);

  const fetchAppointments = useCallback(async () => {
    setFetching(true);
    try {
      const p = new URLSearchParams({ limit: '100' });
      if (search) p.set('search', search);
      if (filterFrom) p.set('from', filterFrom);
      if (filterTo) p.set('to', filterTo);
      if (filterStatus) p.set('status', filterStatus);
      if (filterEmpresa) p.set('empresa', filterEmpresa);
      const res = await fetch(`/api/logistica/agenda/appointments?${p}`);
      const data = await res.json();
      setAppointments(data.appointments || []);
      setTotal(data.total || 0);
    } finally {
      setFetching(false);
    }
  }, [search, filterFrom, filterTo, filterStatus, filterEmpresa]);

  useEffect(() => {
    if (!isAuthenticated || loading) return;
    const t = setTimeout(fetchAppointments, 300);
    return () => clearTimeout(t);
  }, [fetchAppointments, isAuthenticated, loading]);

  if (loading || !currentUser) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '56px',
        backgroundColor: '#29416b', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '0 1rem' : '0 1.5rem', zIndex: 100, borderBottom: '3px solid #e04951', boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/logistica/agenda/admin" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.78rem' }}>
            <ArrowLeft size={13} />{!isMobile && ' Admin'}
          </Link>
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>Citas ({total})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {!isMobile && <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem' }}>{currentUser.name}</span>}
          <LogoutExpandButton onClick={() => { logout(); router.push('/login'); }} />
        </div>
      </header>

      <main style={{ marginTop: '56px', padding: isMobile ? '1.25rem 1rem' : '1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <h1 style={{ margin: 0, fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: 700, color: '#0f172a' }}>
              <ClipboardList size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />Citas de Uniformes
            </h1>
          </div>
          {/* Filtros */}
          <div className="card" style={{ padding: isMobile ? '1rem' : '0.85rem 1rem', marginBottom: '1rem' }}>
            {currentUser.role === 'logistica' && (
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={() => { setFilterFrom(today); setFilterTo(today); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: filterFrom === today && filterTo === today ? '#29416b' : '#f1f5f9', color: filterFrom === today && filterTo === today ? 'white' : '#475569', border: 'none', borderRadius: '6px', padding: '0.4rem 0.75rem', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                  <Calendar size={12} /> Hoy
                </button>
                <button
                  onClick={() => { setFilterStatus(filterStatus === 'confirmada' ? '' : 'confirmada'); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: filterStatus === 'confirmada' ? '#1e40af' : '#f1f5f9', color: filterStatus === 'confirmada' ? 'white' : '#475569', border: 'none', borderRadius: '6px', padding: '0.4rem 0.75rem', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                  Solo confirmadas
                </button>
                <button
                  onClick={() => { setSearch(''); setFilterFrom(today); setFilterTo(today); setFilterStatus('confirmada'); setFilterEmpresa(''); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.78rem', color: '#94a3b8', cursor: 'pointer' }}>
                  <X size={11} /> Restablecer
                </button>
              </div>
            )}
            
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.6rem'
            }}>
              <div style={{ flex: isMobile ? '1 1 100%' : '2 1 220px', minWidth: 0 }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre o documento..."
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.55rem 0.75rem', fontSize: '0.85rem', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: isMobile ? '1 1 48%' : '1 1 140px', minWidth: 0 }}>
                <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.55rem 0.7rem', fontSize: '0.85rem', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: isMobile ? '1 1 48%' : '1 1 140px', minWidth: 0 }}>
                <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.55rem 0.7rem', fontSize: '0.85rem', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: isMobile ? '1 1 48%' : '1 1 180px', minWidth: 0 }}>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.55rem 1.8rem 0.55rem 0.6rem', fontSize: '0.85rem', boxSizing: 'border-box' }}>
                  <option value="">Todos los estados</option>
                  {STATUSES.map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div style={{ flex: isMobile ? '1 1 48%' : '1 1 180px', minWidth: 0 }}>
                <select value={filterEmpresa} onChange={e => setFilterEmpresa(e.target.value)} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.55rem 1.8rem 0.55rem 0.6rem', fontSize: '0.85rem', boxSizing: 'border-box' }}>
                  <option value="">Todas las empresas</option>
                  {EMPRESAS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>
          </div>
 
          {/* Listado (Tabla Desktop / Tarjetas Mobile) */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: isMobile ? 'none' : undefined, background: isMobile ? 'transparent' : undefined }}>
            
            {/* VISTA DESKTOP: Tabla */}
            <div className="desktop-view scroll-container" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['Fecha/Hora', 'Empleado', 'Empresa', 'Ítems', 'Estado', 'Remito', 'Acción'].map(h => (
                      <th key={h} style={{ padding: '0.7rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fetching ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Cargando...</td></tr>
                  ) : appointments.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No hay citas con esos filtros</td></tr>
                  ) : appointments.map((a: any) => {
                    const badge = getAppointmentStatusBadge(a.status);
                    const itemCount = Array.isArray(a.order_items) ? a.order_items.length : 0;
                    return (
                      <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                        onClick={() => router.push(`/logistica/agenda/admin/citas/${a.id}`)}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                        <td style={{ padding: '0.7rem 1rem', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{a.slot_fecha}</div>
                          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{a.slot_start} – {a.slot_end}</div>
                        </td>
                        <td style={{ padding: '0.7rem 1rem' }}>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{a.employee_nombre}</div>
                          <div style={{ color: '#64748b', fontSize: '0.75rem', fontFamily: 'monospace' }}>{a.employee_documento}</div>
                        </td>
                        <td style={{ padding: '0.7rem 1rem' }}>
                          {a.employee_empresa && <span style={{ background: '#eff6ff', color: '#1e40af', borderRadius: '4px', padding: '0.1rem 0.4rem', fontSize: '0.72rem', fontWeight: 700 }}>{a.employee_empresa}</span>}
                        </td>
                        <td style={{ padding: '0.7rem 1rem', color: '#64748b' }}>{itemCount} ítem{itemCount !== 1 ? 's' : ''}</td>
                        <td style={{ padding: '0.7rem 1rem' }}>
                          <span style={{ background: badge.bg, color: badge.color, borderRadius: '4px', padding: '0.15rem 0.5rem', fontSize: '0.72rem', fontWeight: 700 }}>{badge.label}</span>
                        </td>
                        <td style={{ padding: '0.7rem 1rem', color: '#64748b', fontSize: '0.75rem' }}>
                          {a.remito_number || (a.remito_pdf_url ? '✓' : '—')}
                        </td>
                        <td style={{ padding: '0.7rem 1rem' }}>
                          <Link href={`/logistica/agenda/admin/citas/${a.id}`} onClick={e => e.stopPropagation()}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', background: 'none', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '0.25rem 0.5rem', color: '#374151', fontSize: '0.75rem', textDecoration: 'none' }}>
                            <Eye size={11} /> Ver
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* VISTA MOBILE: Tarjetas */}
            <div className="mobile-view">
              {fetching ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Cargando...</div>
              ) : appointments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No hay citas registradas</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {appointments.map((a: any) => {
                    const badge = getAppointmentStatusBadge(a.status);
                    const itemCount = Array.isArray(a.order_items) ? a.order_items.length : 0;
                    return (
                      <div key={a.id} className="agenda-mobile-card" onClick={() => router.push(`/logistica/agenda/admin/citas/${a.id}`)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                          <div>
                            <div className="agenda-mobile-card-title">{a.employee_nombre}</div>
                            <div className="agenda-mobile-card-subtitle">CI: {a.employee_documento}</div>
                          </div>
                          <span style={{ background: badge.bg, color: badge.color, borderRadius: '6px', padding: '0.2rem 0.6rem', fontSize: '0.65rem', fontWeight: 700 }}>
                            {badge.label.toUpperCase()}
                          </span>
                        </div>

                        <div className="agenda-mobile-card-row">
                          <span className="agenda-mobile-card-label">Turno:</span>
                          <span className="agenda-mobile-card-value">{a.slot_fecha} • {a.slot_start}</span>
                        </div>
                        <div className="agenda-mobile-card-row">
                          <span className="agenda-mobile-card-label">Empresa:</span>
                          <span className="agenda-mobile-card-value">{a.employee_empresa || '—'}</span>
                        </div>
                        <div className="agenda-mobile-card-row">
                          <span className="agenda-mobile-card-label">Artículos:</span>
                          <span className="agenda-mobile-card-value" style={{ color: '#1e40af', fontWeight: 700 }}>{itemCount} ítem{itemCount !== 1 ? 's' : ''}</span>
                        </div>
                        
                        <div className="agenda-mobile-card-actions">
                          <Link href={`/logistica/agenda/admin/citas/${a.id}`} className="agenda-mobile-btn" style={{ color: '#29416b' }}>
                            <Eye size={14} /> Ver Detalle
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
