'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search, Download, PackageCheck, CheckCircle, FileText } from 'lucide-react';
import { useTicketContext, hasModuleAccess } from '@/app/context/TicketContext';
import LogoutExpandButton from '@/app/components/LogoutExpandButton';
import { getAppointmentStatusBadge, parseOrderItems, renderOrderItemLabel } from '@/lib/agenda-ui';

const EMPRESAS = ['REIMA', 'ORBIS', 'SCOUT', 'ERGON'];

interface Appointment {
  id: number;
  status: string;
  remito_number: string | null;
  delivered_at: string | null;
  delivered_order_items: string | unknown[];
  employee_nombre: string;
  employee_documento: string;
  employee_empresa: string | null;
  fecha: string;
  start_time: string;
  employee_signature_url: string | null;
  responsible_signature_url: string | null;
  remito_pdf_url?: string | null;
}

export default function EntregasPage() {
  const { currentUser, isAuthenticated, loading, logout, isMobile } = useTicketContext();
  const router = useRouter();

  const today = new Date().toISOString().split('T')[0];
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState('');

  const PAGE_SIZE = 10;
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [fetching, setFetching] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (currentUser && !hasModuleAccess(currentUser, 'logistica')) { router.push('/'); return; }
  }, [loading, isAuthenticated, currentUser, router]);

  const fetchEntregas = useCallback(async (targetPage: number, append: boolean) => {
    if (append) setLoadingMore(true); else setFetching(true);
    try {
      const params = new URLSearchParams({
        status: 'completada',
        limit: String(PAGE_SIZE),
        page: String(targetPage),
      });
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo);
      if (filterSearch) params.set('search', filterSearch);
      if (filterEmpresa) params.set('empresa', filterEmpresa);
      const res = await fetch(`/api/logistica/agenda/appointments?${params}`);
      const data = await res.json();
      const incoming: Appointment[] = data.appointments || [];
      setAppointments(prev => append ? [...prev, ...incoming] : incoming);
      setTotal(data.total || 0);
      setPage(targetPage);
    } finally {
      setFetching(false);
      setLoadingMore(false);
    }
  }, [filterFrom, filterTo, filterSearch, filterEmpresa]);

  useEffect(() => {
    if (!isAuthenticated || loading) return;
    const timer = setTimeout(() => fetchEntregas(1, false), 350);
    return () => clearTimeout(timer);
  }, [fetchEntregas, isAuthenticated, loading]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ type: 'citas', status: 'completada' });
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo);
      if (filterSearch) params.set('search', filterSearch);
      if (filterEmpresa) params.set('empresa', filterEmpresa);
      const res = await fetch(`/api/logistica/agenda/export?${params}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `entregas_${today}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  if (loading || !currentUser) return null;

  const badge = getAppointmentStatusBadge('completada');

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
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>Historial de Entregas</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {!isMobile && <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem' }}>{currentUser.name}</span>}
          <LogoutExpandButton onClick={() => { logout(); router.push('/login'); }} />
        </div>
      </header>

      <main style={{ marginTop: '56px', padding: isMobile ? '1.25rem 1rem' : '1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h1 style={{ margin: 0, fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <PackageCheck size={16} />Entregas completadas ({total})
            </h1>
            <button
              onClick={handleExport}
              disabled={exporting}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', padding: '0.45rem 0.9rem', fontSize: '0.8rem', fontWeight: 600, cursor: exporting ? 'wait' : 'pointer', opacity: exporting ? 0.7 : 1 }}>
              <Download size={14} />{exporting ? 'Exportando...' : 'Exportar Excel'}
            </button>
          </div>

          {/* Filtros */}
          <div className="card" style={{ padding: isMobile ? '1rem' : '0.85rem 1rem', marginBottom: '1rem' }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: isMobile ? '1fr' : '1.3fr 1fr 1fr 1.2fr auto', 
              gap: '0.6rem', 
              alignItems: 'end' 
            }}>
              <div style={{ position: 'relative' }}>
                <input
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                  placeholder="Nombre o cédula..."
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.55rem 0.75rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>
              
              <div className="grid-2-mobile" style={{ display: isMobile ? 'grid' : 'contents', gap: '0.6rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', marginBottom: '0.2rem', fontWeight: 600 }}>Desde</label>
                  <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                    style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.55rem 0.7rem', fontSize: '0.85rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', marginBottom: '0.2rem', fontWeight: 600 }}>Hasta</label>
                  <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                    style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.55rem 0.7rem', fontSize: '0.85rem' }} />
                </div>
              </div>

              <div>
                {!isMobile && <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', marginBottom: '0.2rem', fontWeight: 600 }}>Empresa</label>}
                <select value={filterEmpresa} onChange={e => setFilterEmpresa(e.target.value)}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.55rem 0.4rem', fontSize: '0.85rem' }}>
                  <option value="">Todas las empresas</option>
                  {EMPRESAS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>

              {(filterFrom || filterTo || filterSearch || filterEmpresa) && (
                <button
                  onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterSearch(''); setFilterEmpresa(''); }}
                  style={{ width: isMobile ? '100%' : 'auto', background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.55rem 0.7rem', fontSize: '0.8rem', color: '#64748b', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          {/* Listado (Tabla Desktop / Citas Mobile) */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: isMobile ? 'none' : undefined, background: isMobile ? 'transparent' : undefined }}>
            
            {/* VISTA DESKTOP: Tabla */}
            <div className="desktop-view" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['Fecha turno', 'Empleado', 'Cédula', 'Empresa', 'Ítems entregados', 'Remito', 'Firma emp.', 'Firma resp.', 'Fecha entrega', ''].map(h => (
                      <th key={h} style={{ padding: '0.7rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fetching ? (
                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>Cargando...</td></tr>
                  ) : appointments.length === 0 ? (
                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>No hay entregas con los filtros aplicados</td></tr>
                  ) : appointments.map(appt => {
                    const items = parseOrderItems(appt.delivered_order_items);
                    const itemsLabel = items.length > 0
                      ? items.map(i => renderOrderItemLabel(i)).join(', ')
                      : '—';
                    return (
                      <tr key={appt.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                        <td style={{ padding: '0.7rem 1rem', whiteSpace: 'nowrap', color: '#374151' }}>
                          {appt.fecha} {appt.start_time && <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{appt.start_time}</span>}
                        </td>
                        <td style={{ padding: '0.7rem 1rem', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{appt.employee_nombre}</td>
                        <td style={{ padding: '0.7rem 1rem', fontFamily: 'monospace', color: '#374151' }}>{appt.employee_documento}</td>
                        <td style={{ padding: '0.7rem 1rem' }}>
                          {appt.employee_empresa && (
                            <span style={{ background: '#eff6ff', color: '#1e40af', borderRadius: '4px', padding: '0.1rem 0.4rem', fontSize: '0.72rem', fontWeight: 700 }}>{appt.employee_empresa}</span>
                          )}
                        </td>
                        <td style={{ padding: '0.7rem 1rem', color: '#374151', maxWidth: '220px' }}>
                          <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.78rem' }}>{itemsLabel}</span>
                        </td>
                        <td style={{ padding: '0.7rem 1rem', color: '#64748b', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                          {appt.remito_number ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <FileText size={12} color="#2563eb" />{appt.remito_number}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '0.7rem 1rem', textAlign: 'center' }}>
                          {appt.employee_signature_url ? <CheckCircle size={16} color="#059669" /> : <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>—</span>}
                        </td>
                        <td style={{ padding: '0.7rem 1rem', textAlign: 'center' }}>
                          {appt.responsible_signature_url ? <CheckCircle size={16} color="#059669" /> : <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>—</span>}
                        </td>
                        <td style={{ padding: '0.7rem 1rem', whiteSpace: 'nowrap', color: '#64748b', fontSize: '0.78rem' }}>
                          {appt.delivered_at ? appt.delivered_at.split('T')[0] : '—'}
                        </td>
                        <td style={{ padding: '0.7rem 1rem', display: 'flex', gap: '0.4rem', flexWrap: 'nowrap' }}>
                          <Link href={`/logistica/agenda/admin/citas/${appt.id}`}
                            style={{ fontSize: '0.72rem', color: '#2563eb', textDecoration: 'none', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '0.2rem 0.5rem', whiteSpace: 'nowrap' }}>
                            Detalle
                          </Link>
                          {appt.remito_pdf_url && (
                             <a href={appt.remito_pdf_url} target="_blank" rel="noopener noreferrer"
                               style={{ fontSize: '0.72rem', color: '#059669', textDecoration: 'none', border: '1px solid #bbf7d0', borderRadius: '4px', padding: '0.2rem 0.5rem', whiteSpace: 'nowrap' }}>
                               Remito
                             </a>
                          )}
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
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No hay registros</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {appointments.map(appt => {
                    const items = parseOrderItems(appt.delivered_order_items);
                    return (
                      <div key={appt.id} className="agenda-mobile-card">
                        <div className="agenda-mobile-card-title">{appt.employee_nombre}</div>
                        <div className="agenda-mobile-card-subtitle">
                          CI: {appt.employee_documento} • {appt.employee_empresa}
                        </div>

                        <div className="agenda-mobile-card-row">
                          <span className="agenda-mobile-card-label">Turno:</span>
                          <span className="agenda-mobile-card-value">{appt.fecha} {appt.start_time}</span>
                        </div>
                        <div className="agenda-mobile-card-row">
                          <span className="agenda-mobile-card-label">Entregado:</span>
                          <span className="agenda-mobile-card-value">{appt.delivered_at ? appt.delivered_at.split('T')[0] : '—'}</span>
                        </div>
                        <div className="agenda-mobile-card-row">
                          <span className="agenda-mobile-card-label">Remito:</span>
                          <span className="agenda-mobile-card-value">{appt.remito_number || '—'}</span>
                        </div>

                        <div className="agenda-mobile-card-chips">
                          {items.length > 0 ? items.map((item, idx) => (
                            <span key={idx} className="agenda-mobile-chip">
                              {renderOrderItemLabel(item)}
                            </span>
                          )) : <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Sin prendas registradas</span>}
                        </div>

                        <div className="agenda-mobile-card-actions">
                          <Link href={`/logistica/agenda/admin/citas/${appt.id}`} className="agenda-mobile-btn" style={{ color: '#2563eb' }}>
                            <FileText size={14} /> Ver Detalle
                          </Link>
                          {appt.remito_pdf_url && (
                             <a href={appt.remito_pdf_url} target="_blank" rel="noopener noreferrer" className="agenda-mobile-btn" style={{ color: '#059669' }}>
                               <Download size={14} /> Ver Remito
                             </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {!fetching && appointments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: 0 }}>
                Mostrando {appointments.length} de {total} entregas
              </p>
              {appointments.length < total && (
                <button
                  onClick={() => fetchEntregas(page + 1, true)}
                  disabled={loadingMore}
                  style={{ background: '#29416b', color: 'white', border: 'none', borderRadius: '6px', padding: '0.5rem 1.1rem', fontSize: '0.8rem', fontWeight: 600, cursor: loadingMore ? 'wait' : 'pointer', opacity: loadingMore ? 0.7 : 1 }}>
                  {loadingMore ? 'Cargando...' : `Mostrar ${Math.min(PAGE_SIZE, total - appointments.length)} más`}
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
