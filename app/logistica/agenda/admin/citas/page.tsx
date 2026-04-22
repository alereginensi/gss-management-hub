'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ClipboardList, ChevronDown, ChevronUp, Calendar, Clock, Building2,
  Pencil, XCircle, Trash2, CheckCircle, FileText, Printer, PenSquare, PackageMinus, PackageCheck,
} from 'lucide-react';
import { useTicketContext, canAccessAgenda } from '@/app/context/TicketContext';
import LogoutExpandButton from '@/app/components/LogoutExpandButton';
import { getAppointmentStatusBadge } from '@/lib/agenda-ui';
import type { AppointmentStatus } from '@/lib/agenda-types';

const EMPRESAS = ['REIMA', 'ORBIS', 'SCOUT', 'ERGON'];
const STATUSES: AppointmentStatus[] = ['confirmada', 'en_proceso', 'completada', 'cancelada', 'ausente', 'reprogramada'];

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDate(s: string | undefined): string {
  if (!s) return '';
  const ymd = s.slice(0, 10);
  const parts = ymd.split('-');
  if (parts.length !== 3) return ymd;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export default function CitasPage() {
  const { currentUser, isAuthenticated, loading, logout, isMobile } = useTicketContext();
  const router = useRouter();

  const [appointments, setAppointments] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [origin, setOrigin] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [onlyToday, setOnlyToday] = useState(true);
  const [onlyConfirmed, setOnlyConfirmed] = useState(true);
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (currentUser && !canAccessAgenda(currentUser)) { router.push('/'); return; }
  }, [loading, isAuthenticated, currentUser, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setOrigin(sessionStorage.getItem('agenda_origin'));
  }, []);

  const fetchAppointments = useCallback(async () => {
    setFetching(true);
    try {
      const p = new URLSearchParams({ limit: '200' });
      if (search) p.set('search', search);
      // Date filter: onlyToday overrides filterDate
      if (onlyToday) {
        const t = todayYmd();
        p.set('from', t);
        p.set('to', t);
      } else if (filterDate) {
        p.set('from', filterDate);
        p.set('to', filterDate);
      }
      if (onlyConfirmed) p.set('status', 'confirmada');
      else if (filterStatus) p.set('status', filterStatus);
      if (filterEmpresa) p.set('empresa', filterEmpresa);
      const res = await fetch(`/api/logistica/agenda/appointments?${p}`);
      const data = await res.json();
      setAppointments(data.appointments || []);
      setTotal(data.total || 0);
    } finally {
      setFetching(false);
    }
  }, [search, filterDate, onlyToday, onlyConfirmed, filterEmpresa, filterStatus]);

  useEffect(() => {
    if (!isAuthenticated || loading) return;
    const t = setTimeout(fetchAppointments, 300);
    return () => clearTimeout(t);
  }, [fetchAppointments, isAuthenticated, loading]);

  function showMessage(text: string, error = false) {
    setMessage({ text, error });
    setTimeout(() => setMessage(null), 2500);
  }

  async function updateStatus(id: number, status: AppointmentStatus, verbAsk: string) {
    if (!confirm(`¿Confirmás marcar esta cita como ${verbAsk}?`)) return;
    try {
      const res = await fetch(`/api/logistica/agenda/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Error'); }
      showMessage(`Cita marcada como ${verbAsk}`);
      fetchAppointments();
    } catch (err: any) {
      showMessage(err?.message || 'Error al actualizar', true);
    }
  }

  async function deleteCancelled() {
    const cancelled = appointments.filter(a => a.status === 'cancelada');
    if (cancelled.length === 0) { showMessage('No hay citas canceladas para eliminar.', true); return; }
    if (!confirm(`¿Eliminar ${cancelled.length} cita(s) cancelada(s)?`)) return;
    let ok = 0;
    for (const a of cancelled) {
      try {
        const res = await fetch(`/api/logistica/agenda/appointments/${a.id}`, { method: 'DELETE' });
        if (res.ok) ok++;
      } catch { /* ignore */ }
    }
    showMessage(`Se eliminaron ${ok} citas canceladas.`);
    fetchAppointments();
  }

  function clearFilters() {
    setSearch('');
    setFilterDate('');
    setOnlyToday(false);
    setOnlyConfirmed(false);
    setFilterEmpresa('');
    setFilterStatus('');
  }

  const canCancel = origin === 'rrhh' || currentUser?.role === 'admin' || currentUser?.role === 'rrhh' || currentUser?.role === 'jefe';
  const hasCancelled = appointments.some(a => a.status === 'cancelada');

  function handlePrint(apt: any) {
    const items: any[] = Array.isArray(apt.delivered_order_items) && apt.delivered_order_items.length
      ? apt.delivered_order_items
      : (Array.isArray(apt.order_items) ? apt.order_items : []);
    const rows = items
      .map(i => `<tr><td>${escapeHtml(i.article_type || '')}</td><td>${escapeHtml(i.size || '')}${i.color ? ` · ${escapeHtml(i.color)}` : ''}</td><td>${i.qty || 1}</td></tr>`)
      .join('');
    const remitoLine = apt.remito_number ? `<p class="remito">Remito N° ${escapeHtml(apt.remito_number)}</p>` : '';
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8" /><title>Constancia ${apt.id}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 32px; max-width: 680px; margin: auto; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .subtitle { color: #555; font-size: 12px; margin-bottom: 20px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { background: #f3f4f6; text-align: left; padding: 7px 10px; font-size: 12px; border: 1px solid #e5e7eb; }
  td { padding: 7px 10px; border: 1px solid #e5e7eb; }
  .remito { font-size: 12px; color: #555; margin-bottom: 20px; }
  @media print { body { padding: 16px; } }
</style></head><body>
<h1>Constancia de Entrega de Uniformes</h1>
<p class="subtitle">Fecha: ${formatDate(apt.slot_fecha)}</p>
<div class="info-grid">
  <div><strong>Empleado</strong><br/>${escapeHtml(apt.employee_nombre || '')}</div>
  <div><strong>Documento</strong><br/>${escapeHtml(apt.employee_documento || '')}</div>
  <div><strong>Empresa</strong><br/>${escapeHtml(apt.employee_empresa || '')}</div>
  <div><strong>Sector</strong><br/>${escapeHtml(apt.employee_sector || '—')}</div>
</div>
<table><thead><tr><th>Prenda</th><th>Talla / Color</th><th>Cant.</th></tr></thead><tbody>${rows}</tbody></table>
${remitoLine}
<script>window.onload = () => { window.print(); }</script>
</body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  }

  function escapeHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  if (loading || !currentUser) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '56px',
        backgroundColor: '#29416b', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '0 1rem' : '0 1.5rem', zIndex: 100, borderBottom: '3px solid #e04951', boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href={origin === 'logistica' ? '/logistica' : '/logistica/agenda/admin'} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.78rem' }}>
            <ArrowLeft size={13} />{!isMobile && ' Volver'}
          </Link>
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>Citas Agendadas ({total})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {!isMobile && <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem' }}>{currentUser.name}</span>}
          <LogoutExpandButton onClick={() => { logout(); router.push('/login'); }} />
        </div>
      </header>

      <main style={{ marginTop: '56px', padding: isMobile ? '1.25rem 1rem' : '1.5rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          {/* Header + acciones */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: isMobile ? '1.05rem' : '1.2rem', fontWeight: 700, color: '#0f172a' }}>
              <ClipboardList size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />Citas Agendadas
            </h1>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Link href="/logistica/agenda/admin/ingresos/nuevo"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.78rem', color: '#166534', fontWeight: 600, textDecoration: 'none' }}>
                <PackageCheck size={12} /> Registrar ingreso
              </Link>
              <Link href="/logistica/agenda/admin/devoluciones-egreso/nueva"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.78rem', color: '#b91c1c', fontWeight: 600, textDecoration: 'none' }}>
                <PackageMinus size={12} /> Devolución por egreso
              </Link>
              {hasCancelled && canCancel && (
                <button onClick={deleteCancelled}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.4rem 0.75rem', fontSize: '0.78rem', color: '#64748b', cursor: 'pointer' }}>
                  <Trash2 size={12} /> Limpiar canceladas
                </button>
              )}
            </div>
          </div>

          {/* Filtros */}
          <div className="card" style={{ padding: isMobile ? '1rem' : '0.85rem 1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '0 0 auto' }}>
                <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: 600 }}>Fecha del turno</label>
                <input type="date" value={filterDate}
                  onChange={e => { setFilterDate(e.target.value); setOnlyToday(false); }}
                  disabled={onlyToday}
                  style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.45rem 0.65rem', fontSize: '0.85rem', opacity: onlyToday ? 0.5 : 1 }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#374151', cursor: 'pointer', userSelect: 'none', paddingBottom: '0.45rem' }}>
                <input type="checkbox" checked={onlyToday} onChange={e => { setOnlyToday(e.target.checked); if (e.target.checked) setFilterDate(''); }} />
                Solo hoy
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#374151', cursor: 'pointer', userSelect: 'none', paddingBottom: '0.45rem' }}>
                <input type="checkbox" checked={onlyConfirmed} onChange={e => setOnlyConfirmed(e.target.checked)} />
                Solo confirmadas
              </label>
              <button onClick={clearFilters}
                style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', paddingBottom: '0.45rem' }}>
                Limpiar filtros
              </button>
            </div>

            {/* Filtros adicionales (búsqueda, empresa, estado) — siempre visibles pero compactos */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o documento..."
                style={{ flex: '1 1 220px', minWidth: 0, border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem 0.7rem', fontSize: '0.82rem' }} />
              <select value={filterEmpresa} onChange={e => setFilterEmpresa(e.target.value)}
                style={{ flex: '0 0 150px', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem 0.6rem', fontSize: '0.82rem' }}>
                <option value="">Todas las empresas</option>
                {EMPRESAS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              {!onlyConfirmed && (
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  style={{ flex: '0 0 160px', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem 0.6rem', fontSize: '0.82rem' }}>
                  <option value="">Todos los estados</option>
                  {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Lista en cards */}
          {fetching ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Cargando...</div>
          ) : appointments.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No hay citas con esos filtros</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {appointments.map((a: any) => {
                const badge = getAppointmentStatusBadge(a.status);
                const expanded = expandedId === a.id;
                const canFinalizar = a.status === 'confirmada' || a.status === 'en_proceso';
                const items: any[] = Array.isArray(a.order_items) ? a.order_items : [];
                return (
                  <div key={a.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '1rem 1.1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>{a.employee_nombre}</div>
                          <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: '0.15rem', fontFamily: 'monospace' }}>Doc: {a.employee_documento}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {a.status === 'completada' && (
                            <>
                              <button onClick={() => router.push(`/logistica/agenda/admin/citas/${a.id}`)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: '#eef2ff', color: '#29416b', border: '1px solid #c7d2fe', borderRadius: '6px', padding: '0.3rem 0.55rem', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                                <Pencil size={12} /> Editar entrega
                              </button>
                              <button onClick={() => handlePrint(a)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.3rem 0.55rem', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                                <Printer size={12} /> Imprimir
                              </button>
                            </>
                          )}
                          <span style={{ background: badge.bg, color: badge.color, borderRadius: '6px', padding: '0.2rem 0.6rem', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {badge.label}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.82rem', color: '#475569', marginBottom: canFinalizar ? '0.75rem' : '0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Building2 size={13} style={{ color: '#94a3b8' }} /> <span style={{ fontWeight: 600 }}>{a.employee_empresa || '—'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Calendar size={13} style={{ color: '#94a3b8' }} /> {formatDate(a.slot_fecha)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Clock size={13} style={{ color: '#94a3b8' }} /> {a.slot_start} – {a.slot_end}
                        </div>
                      </div>

                      {canFinalizar && (
                        <div style={{ display: 'flex', gap: '1rem', paddingTop: '0.6rem', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
                          <button onClick={() => router.push(`/logistica/agenda/admin/citas/${a.id}`)}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'none', border: 'none', color: '#059669', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                            <Pencil size={15} /> Finalizar entrega
                          </button>
                          <button onClick={() => updateStatus(a.id, 'ausente', 'no asistió')}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'none', border: 'none', color: '#ea580c', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                            <XCircle size={15} /> No asistió
                          </button>
                          {canCancel && (
                            <button onClick={() => updateStatus(a.id, 'cancelada', 'cancelada')}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}>
                              <XCircle size={15} /> Cancelar
                            </button>
                          )}
                        </div>
                      )}

                      <button onClick={() => setExpandedId(expanded ? null : a.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', width: '100%', background: 'none', border: 'none', borderTop: '1px solid #f1f5f9', padding: '0.6rem 0 0.1rem', marginTop: canFinalizar ? '0.6rem' : '0.3rem', color: '#2563eb', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', justifyContent: 'flex-start' }}>
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Ver detalle
                      </button>
                    </div>

                    {expanded && (
                      <div style={{ background: '#f8fafc', padding: '1rem 1.1rem', borderTop: '1px solid #e2e8f0' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1e293b', marginBottom: '0.5rem' }}>Detalle del Pedido</div>
                        {items.length === 0 ? (
                          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Sin ítems</div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.35rem' }}>
                            {items.map((it, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.78rem' }}>
                                <span style={{ fontWeight: 600, color: '#334155' }}>{it.article_type}</span>
                                <span style={{ color: '#64748b' }}>Talla: {it.size || '—'}{it.color ? ` · ${it.color}` : ''}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {a.remito_number && (
                          <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: '#64748b' }}>
                            <FileText size={12} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
                            Remito N°: <strong style={{ color: '#1e293b' }}>{a.remito_number}</strong>
                          </div>
                        )}
                        <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                          {a.remito_pdf_url && (
                            <a href={`/api/logistica/agenda/appointments/${a.id}/remito-pdf?t=${a.updated_at || Date.now()}`} target="_blank" rel="noopener noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.3rem 0.55rem', fontSize: '0.72rem', fontWeight: 600, textDecoration: 'none' }}>
                              <FileText size={12} /> Remito
                            </a>
                          )}
                          {(a.employee_signature_url || a.responsible_signature_url) && (
                            <a href={`/logistica/agenda/admin/citas/${a.id}`}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '0.3rem 0.55rem', fontSize: '0.72rem', fontWeight: 600, textDecoration: 'none' }}>
                              <PenSquare size={12} /> Firma
                            </a>
                          )}
                          {a.status === 'completada' && (
                            <>
                              <button onClick={() => router.push(`/logistica/agenda/admin/citas/${a.id}`)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: '#eef2ff', color: '#29416b', border: '1px solid #c7d2fe', borderRadius: '6px', padding: '0.3rem 0.55rem', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                                <Pencil size={12} /> Editar entrega
                              </button>
                              <button onClick={() => handlePrint(a)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.3rem 0.55rem', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                                <Printer size={12} /> Imprimir constancia
                              </button>
                            </>
                          )}
                          <Link href={`/logistica/agenda/admin/citas/${a.id}`}
                            style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                            Detalle completo →
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {message && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 200,
          background: message.error ? '#fee2e2' : '#dcfce7',
          color: message.error ? '#991b1b' : '#166534',
          border: `1px solid ${message.error ? '#fecaca' : '#bbf7d0'}`,
          borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        }}>
          {message.error ? <XCircle size={16} /> : <CheckCircle size={16} />}
          {message.text}
        </div>
      )}
    </div>
  );
}
