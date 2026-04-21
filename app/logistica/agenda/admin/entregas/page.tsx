'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search, Download, PackageCheck, CheckCircle, FileText, RotateCcw, Printer, AlertTriangle, X } from 'lucide-react';
import { useTicketContext, canAccessAgenda } from '@/app/context/TicketContext';
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
  has_return?: number | null;
  remito_return_number?: string | null;
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
  const [revertTarget, setRevertTarget] = useState<Appointment | null>(null);
  const [revertReason, setRevertReason] = useState('');
  const [reverting, setReverting] = useState(false);
  const [revertError, setRevertError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (currentUser && !canAccessAgenda(currentUser)) { router.push('/'); return; }
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
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>Entregas</span>
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

          {/* Listado (grid de cards, responsive) */}
          {fetching ? (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>Cargando...</div>
          ) : appointments.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>No hay entregas con los filtros aplicados</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.9rem' }}>
              {appointments.map(appt => {
                const items = parseOrderItems(appt.delivered_order_items);
                return (
                  <div key={appt.id} className="card" style={{ padding: '0.95rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {/* Header: nombre + empresa badge + acciones */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' }}>{appt.employee_nombre}</span>
                          {appt.has_return ? (
                            <span title={`Con cambio${appt.remito_return_number ? ` · Remito dev. ${appt.remito_return_number}` : ''}`}
                              style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', borderRadius: '4px', padding: '0.05rem 0.3rem', fontSize: '0.62rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                              <RotateCcw size={9} /> Con cambio
                            </span>
                          ) : null}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>
                          CI <span style={{ fontFamily: 'monospace' }}>{appt.employee_documento}</span>
                          {appt.employee_empresa && (
                            <> · <span style={{ background: '#eff6ff', color: '#1e40af', borderRadius: '4px', padding: '0.02rem 0.35rem', fontSize: '0.65rem', fontWeight: 700 }}>{appt.employee_empresa}</span></>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => { setRevertTarget(appt); setRevertReason(''); setRevertError(null); }}
                        title="Entrega errónea: revierte la entrega y rehabilita al empleado"
                        style={{ flexShrink: 0, background: 'none', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.3rem', cursor: 'pointer', color: '#b45309', display: 'inline-flex' }}>
                        <AlertTriangle size={14} />
                      </button>
                    </div>

                    {/* Fechas */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.72rem', color: '#475569' }}>
                      <span>Turno: <strong style={{ color: '#1e293b' }}>{appt.fecha}{appt.start_time ? ` · ${appt.start_time}` : ''}</strong></span>
                      <span>Entregado: <strong style={{ color: '#1e293b' }}>{appt.delivered_at ? appt.delivered_at.split('T')[0] : '—'}</strong></span>
                    </div>

                    {/* Remito + firmas */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', fontSize: '0.72rem', color: '#475569', alignItems: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <FileText size={12} color="#2563eb" />
                        Remito {appt.remito_number ? <strong style={{ color: '#1e293b', fontFamily: 'monospace' }}>{appt.remito_number}</strong> : <span style={{ color: '#94a3b8' }}>—</span>}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                        Emp. {appt.employee_signature_url ? <CheckCircle size={12} color="#059669" /> : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                        Resp. {appt.responsible_signature_url ? <CheckCircle size={12} color="#059669" /> : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </span>
                    </div>

                    {/* Prendas chips */}
                    <div>
                      <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.3rem' }}>Prendas entregadas</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {items.length > 0 ? items.map((item, idx) => (
                          <span key={idx} style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '4px', padding: '0.1rem 0.4rem', fontSize: '0.72rem' }}>
                            {renderOrderItemLabel(item)}
                          </span>
                        )) : <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Sin prendas registradas</span>}
                      </div>
                    </div>

                    {/* Links de acción */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', paddingTop: '0.3rem', borderTop: '1px solid #f1f5f9' }}>
                      <Link href={`/logistica/agenda/admin/citas/${appt.id}`}
                        style={{ fontSize: '0.72rem', color: '#2563eb', textDecoration: 'none', background: '#eff6ff', borderRadius: '4px', padding: '0.2rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <FileText size={12} /> Detalle
                      </Link>
                      <Link href={`/logistica/agenda/admin/citas/${appt.id}?print=1`} target="_blank"
                        style={{ fontSize: '0.72rem', color: '#7c3aed', textDecoration: 'none', background: '#faf5ff', borderRadius: '4px', padding: '0.2rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Printer size={12} /> Constancia
                      </Link>
                      {appt.remito_pdf_url && (
                        <a href={`/api/logistica/agenda/appointments/${appt.id}/remito-pdf`} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: '0.72rem', color: '#059669', textDecoration: 'none', background: '#f0fdf4', borderRadius: '4px', padding: '0.2rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Download size={12} /> Remito
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

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

      {revertTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card modal-responsive" style={{ width: '520px', maxWidth: '95vw', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#b45309', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertTriangle size={18} /> Marcar entrega como errónea
                </h3>
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  <strong>{revertTarget.employee_nombre}</strong> · CI {revertTarget.employee_documento}
                </p>
              </div>
              <button onClick={() => setRevertTarget(null)} disabled={reverting} style={{ background: 'none', border: 'none', cursor: reverting ? 'wait' : 'pointer', color: '#94a3b8' }}><X size={18} /></button>
            </div>

            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '0.65rem 0.85rem', marginBottom: '1rem', fontSize: '0.78rem', color: '#92400e' }}>
              Esta acción <strong>cancela</strong> la entrega, da de baja los artículos registrados y habilita al empleado para volver a reservar un turno.
            </div>

            {revertError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.55rem 0.8rem', marginBottom: '0.8rem', fontSize: '0.8rem', color: '#7f1d1d' }}>{revertError}</div>
            )}

            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Motivo *</label>
            <textarea
              value={revertReason}
              onChange={e => setRevertReason(e.target.value)}
              rows={3}
              placeholder="Ej: se entregó talle XXL en lugar de M"
              style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.55rem 0.75rem', fontSize: '0.85rem', boxSizing: 'border-box', resize: 'vertical' }}
            />

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button onClick={() => setRevertTarget(null)} disabled={reverting} className="btn btn-secondary" style={{ fontSize: '0.82rem' }}>Cancelar</button>
              <button
                onClick={async () => {
                  if (!revertTarget) return;
                  if (!revertReason.trim()) { setRevertError('Motivo requerido'); return; }
                  setReverting(true);
                  setRevertError(null);
                  try {
                    const res = await fetch(`/api/logistica/agenda/appointments/${revertTarget.id}/revert-delivery`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ reason: revertReason.trim() }),
                    });
                    const data = await res.json();
                    if (!res.ok) { setRevertError(data.error || 'Error al revertir'); return; }
                    setRevertTarget(null);
                    setRevertReason('');
                    fetchEntregas(1, false);
                  } finally {
                    setReverting(false);
                  }
                }}
                disabled={reverting}
                style={{ background: '#b45309', color: 'white', border: 'none', borderRadius: '6px', padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 600, cursor: reverting ? 'wait' : 'pointer', opacity: reverting ? 0.7 : 1 }}>
                {reverting ? 'Revirtiendo...' : 'Confirmar reversión'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
