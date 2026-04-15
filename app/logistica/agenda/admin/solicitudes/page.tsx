'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Search, Upload, Printer, X, Check, XCircle, Trash2, Edit2, Eye } from 'lucide-react';
import { useTicketContext, hasModuleAccess } from '@/app/context/TicketContext';
import LogoutExpandButton from '@/app/components/LogoutExpandButton';
import { LEGAL_TEXT_V1 } from '@/lib/agenda-types';
import type { RequestStatus } from '@/lib/agenda-types';

const STATUS_LABELS: Record<RequestStatus, string> = {
  pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada', entregada: 'Entregada',
};
const STATUS_COLORS: Record<RequestStatus, { color: string; bg: string }> = {
  pendiente: { color: '#92400e', bg: '#fef3c7' },
  aprobada: { color: '#065f46', bg: '#d1fae5' },
  rechazada: { color: '#7f1d1d', bg: '#fee2e2' },
  entregada: { color: '#1e40af', bg: '#dbeafe' },
};

export default function SolicitudesPage() {
  const { currentUser, isAuthenticated, loading, logout, isMobile } = useTicketContext();
  const router = useRouter();

  const [requests, setRequests] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const signRef = useRef<HTMLInputElement>(null);

  const [showNewModal, setShowNewModal] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [newForm, setNewForm] = useState({ employee_id: '', article_type: '', size: '', reason: '', notes: '' });
  const [newError, setNewError] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (currentUser && !hasModuleAccess(currentUser, 'logistica')) { router.push('/'); return; }
  }, [loading, isAuthenticated, currentUser, router]);

  const fetchRequests = useCallback(async () => {
    setFetching(true);
    try {
      const p = new URLSearchParams({ limit: '100' });
      if (search) p.set('search', search);
      if (filterStatus) p.set('status', filterStatus);
      const res = await fetch(`/api/logistica/agenda/requests?${p}`);
      const data = await res.json();
      setRequests(data.requests || []);
      setTotal(data.total || 0);
    } finally { setFetching(false); }
  }, [search, filterStatus]);

  useEffect(() => {
    if (!isAuthenticated || loading) return;
    const t = setTimeout(fetchRequests, 300);
    return () => clearTimeout(t);
  }, [fetchRequests, isAuthenticated, loading]);

  const loadEmployees = async () => {
    const res = await fetch('/api/logistica/agenda/employees?limit=500');
    const data = await res.json();
    setEmployees(data.employees || []);
  };

  const openNew = async () => {
    await loadEmployees();
    setEditId(null);
    setNewForm({ employee_id: '', article_type: '', size: '', reason: '', notes: '' });
    setNewError(null);
    setShowNewModal(true);
  };

  const openEdit = async (req: any) => {
    await loadEmployees();
    setEditId(req.id);
    setNewForm({
      employee_id: String(req.employee_id),
      article_type: req.article_type,
      size: req.size || '',
      reason: req.reason,
      notes: req.notes || '',
    });
    setNewError(null);
    setShowNewModal(true);
  };

  const handleCreateRequest = async () => {
    if (!newForm.employee_id) { setNewError('Seleccionar empleado'); return; }
    if (!newForm.article_type.trim()) { setNewError('Artículo requerido'); return; }
    if (!newForm.reason.trim()) { setNewError('Motivo requerido'); return; }
    setSaving(true); setNewError(null);
    try {
      const url = editId ? `/api/logistica/agenda/requests/${editId}` : '/api/logistica/agenda/requests';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: parseInt(newForm.employee_id), article_type: newForm.article_type, size: newForm.size || undefined, reason: newForm.reason, notes: newForm.notes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setNewError(data.error || 'Error al guardar'); return; }
      setShowNewModal(false);
      fetchRequests();
    } finally { setSaving(false); }
  };

  const handleDeleteRequest = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar esta solicitud?')) return;
    await fetch(`/api/logistica/agenda/requests/${id}`, { method: 'DELETE' });
    fetchRequests();
  };

  const handleUpdateStatus = async (id: number, status: RequestStatus) => {
    await fetch(`/api/logistica/agenda/requests/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    fetchRequests();
    if (selected?.id === id) setSelected((s: any) => ({ ...s, status }));
  };

  const handleUploadSign = async (file: File) => {
    if (!selected) return;
    setSaving(true); setSignError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/logistica/agenda/requests/${selected.id}/sign`, { method: 'POST', body: fd });
      if (!res.ok) { const d = await res.json(); setSignError(d.error || 'Error al subir firma'); return; }
      const d = await res.json();
      setSelected((s: any) => ({ ...s, approval_signature_url: d.fileUrl, status: 'aprobada' }));
      fetchRequests();
    } finally { setSaving(false); }
  };

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
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>Solicitudes Emergentes ({total})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {!isMobile && <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem' }}>{currentUser.name}</span>}
          <LogoutExpandButton onClick={() => { logout(); router.push('/login'); }} />
        </div>
      </header>

      <main style={{ marginTop: '56px', padding: isMobile ? '1.25rem 1rem' : '1.5rem' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h1 style={{ margin: 0, fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: 700, color: '#0f172a' }}>Solicitudes Emergentes</h1>
            <button onClick={openNew} className="btn btn-primary" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Plus size={14} /> Nueva solicitud
            </button>
          </div>

          {/* Filtros */}
          <div className="card" style={{ padding: isMobile ? '1rem' : '0.85rem 1rem', marginBottom: '1rem' }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: isMobile ? '1fr' : '2fr 1.5fr', 
              gap: '0.6rem' 
            }}>
              <div style={{ position: 'relative' }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar empleado..."
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.55rem 0.75rem', fontSize: '0.85rem', boxSizing: 'border-box' }} />
              </div>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.55rem 0.7rem', fontSize: '0.85rem' }}>
                <option value="">Todos los estados</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* Listado (Tabla Desktop / Tarjetas Mobile) */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: isMobile ? 'none' : undefined, background: isMobile ? 'transparent' : undefined }}>
            
            {/* VISTA DESKTOP: Tabla */}
            <div className="desktop-view scroll-container" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['Empleado', 'Empresa', 'Artículo', 'Motivo', 'Estado', 'Firma', 'Acciones'].map(h => (
                      <th key={h} style={{ padding: '0.7rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '0.75rem' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fetching ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Cargando...</td></tr>
                  ) : requests.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Sin solicitudes</td></tr>
                  ) : requests.map((r: any) => {
                    const sc = STATUS_COLORS[r.status as RequestStatus] || { color: '#374151', bg: '#f9fafb' };
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                        <td style={{ padding: '0.7rem 1rem' }}>
                          <div style={{ fontWeight: 600 }}>{r.employee_nombre}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>{r.employee_documento}</div>
                        </td>
                        <td style={{ padding: '0.7rem 1rem' }}>
                          {r.employee_empresa && <span style={{ background: '#eff6ff', color: '#1e40af', borderRadius: '4px', padding: '0.1rem 0.4rem', fontSize: '0.72rem', fontWeight: 700 }}>{r.employee_empresa}</span>}
                        </td>
                        <td style={{ padding: '0.7rem 1rem' }}>
                          <div>{r.article_type}</div>
                          {r.size && <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Talle: {r.size}</div>}
                        </td>
                        <td style={{ padding: '0.7rem 1rem', color: '#64748b', maxWidth: '180px' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason}</div>
                        </td>
                        <td style={{ padding: '0.7rem 1rem' }}>
                          <span style={{ background: sc.bg, color: sc.color, borderRadius: '4px', padding: '0.15rem 0.5rem', fontSize: '0.72rem', fontWeight: 700 }}>{STATUS_LABELS[r.status as RequestStatus] || r.status}</span>
                        </td>
                        <td style={{ padding: '0.7rem 1rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                          {r.approval_signature_url ? '✓' : '—'}
                        </td>
                        <td style={{ padding: '0.7rem 1rem' }}>
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                             <button onClick={() => { setSelected(r); setSignError(null); setShowModal(true); }} title="Ver detalle"
                              style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '0.25rem', cursor: 'pointer', color: '#64748b' }}>
                              <Eye size={14} />
                            </button>
                            <button onClick={() => openEdit(r)} title="Editar"
                              style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '0.25rem', cursor: 'pointer', color: '#2563eb' }}>
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => handleDeleteRequest(r.id)} title="Eliminar"
                              style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '0.25rem', cursor: 'pointer', color: '#ef4444' }}>
                              <Trash2 size={14} />
                            </button>
                            
                            {r.status === 'pendiente' && (
                              <button onClick={() => handleUpdateStatus(r.id, 'aprobada')} title="Aprobar"
                                style={{ background: 'none', border: '1px solid #bbf7d0', borderRadius: '4px', padding: '0.25rem', cursor: 'pointer', color: '#065f46' }}>
                                <Check size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* VISTA MOBILE: Tarjetas */}
            <div className="mobile-view">
              {fetching && requests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Cargando...</div>
              ) : requests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Sin solicitudes</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: isMobile ? '0' : '1rem' }}>
                  {requests.map((r: any) => {
                    const sc = STATUS_COLORS[r.status as RequestStatus] || { color: '#374151', bg: '#f9fafb' };
                    return (
                      <div key={r.id} className="agenda-mobile-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div className="agenda-mobile-card-title">{r.employee_nombre}</div>
                          <span style={{ 
                            background: sc.bg, color: sc.color, borderRadius: '4px', padding: '0.1rem 0.4rem', fontSize: '0.65rem', fontWeight: 700 
                          }}>
                            {STATUS_LABELS[r.status as RequestStatus]?.toUpperCase() || r.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="agenda-mobile-card-subtitle">CI: {r.employee_documento} • {r.employee_empresa || 'S/E'}</div>
                        
                        <div className="agenda-mobile-card-row">
                          <span className="agenda-mobile-card-label">Artículo:</span>
                          <span className="agenda-mobile-card-value">{r.article_type} {r.size ? `(${r.size})` : ''}</span>
                        </div>
                        <div className="agenda-mobile-card-row">
                          <span className="agenda-mobile-card-label">Motivo:</span>
                          <span className="agenda-mobile-card-value" style={{ maxWidth: '60%' }}>{r.reason}</span>
                        </div>
                        <div className="agenda-mobile-card-row">
                          <span className="agenda-mobile-card-label">Firmada:</span>
                          <span className="agenda-mobile-card-value">{r.approval_signature_url ? 'SÍ' : 'NO'}</span>
                        </div>

                        <div className="agenda-mobile-card-actions">
                          <button onClick={() => { setSelected(r); setSignError(null); setShowModal(true); }} className="agenda-mobile-btn">
                            <Eye size={14} /> Detalle
                          </button>
                          <button onClick={() => openEdit(r)} className="agenda-mobile-btn" style={{ color: '#2563eb' }}>
                            <Edit2 size={14} /> Editar
                          </button>
                          <button onClick={() => handleDeleteRequest(r.id)} className="agenda-mobile-btn" style={{ color: '#ef4444', borderColor: '#fee2e2' }}>
                            <Trash2 size={14} />
                          </button>
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

      {/* Modal detalle/firma */}
      {showModal && selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '600px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Solicitud emergente #{selected.id}</h3>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button onClick={() => window.print()} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '0.3rem 0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem', color: '#374151' }}>
                  <Printer size={12} /> Imprimir
                </button>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
              </div>
            </div>

            {/* Texto legal */}
            <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: '6px', padding: '0.75rem', fontSize: '0.72rem', color: '#78350f', marginBottom: '1rem', lineHeight: '1.5' }}>
              <strong>Texto legal (v1):</strong><br />{LEGAL_TEXT_V1}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.82rem', marginBottom: '1rem' }}>
              <div><span style={{ color: '#64748b' }}>Empleado:</span> <strong>{selected.employee_nombre}</strong></div>
              <div><span style={{ color: '#64748b' }}>Documento:</span> {selected.employee_documento}</div>
              <div><span style={{ color: '#64748b' }}>Empresa:</span> {selected.employee_empresa || '—'}</div>
              <div><span style={{ color: '#64748b' }}>Artículo:</span> {selected.article_type} {selected.size ? `(${selected.size})` : ''}</div>
              <div style={{ gridColumn: '1/-1' }}><span style={{ color: '#64748b' }}>Motivo:</span> {selected.reason}</div>
              {selected.notes && <div style={{ gridColumn: '1/-1' }}><span style={{ color: '#64748b' }}>Notas:</span> {selected.notes}</div>}
            </div>

            {/* Firma */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#374151', marginBottom: '0.5rem' }}>Firma del autorizante</div>
              {selected.approval_signature_url
                ? <img src={selected.approval_signature_url} alt="Firma" style={{ maxWidth: '100%', maxHeight: '100px', objectFit: 'contain' }} />
                : <div style={{ color: '#cbd5e1', fontSize: '0.75rem', marginBottom: '0.5rem' }}>Sin firma</div>}
              {signError && <div style={{ color: '#7f1d1d', fontSize: '0.78rem', marginBottom: '0.5rem' }}>{signError}</div>}
              <input type="file" ref={signRef} style={{ display: 'none' }} accept="image/*"
                onChange={e => { if (e.target.files?.[0]) handleUploadSign(e.target.files[0]); }} />
              <button onClick={() => signRef.current?.click()} disabled={saving} className="btn btn-secondary" style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Upload size={12} /> {saving ? 'Subiendo...' : selected.approval_signature_url ? 'Reemplazar firma' : 'Subir firma'}
              </button>
            </div>

            {/* Cambio de estado */}
            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {selected.status === 'pendiente' && (
                <>
                  <button onClick={() => handleUpdateStatus(selected.id, 'rechazada')} className="btn btn-secondary" style={{ fontSize: '0.78rem', color: '#7f1d1d' }}>Rechazar</button>
                  <button onClick={() => handleUpdateStatus(selected.id, 'aprobada')} className="btn btn-primary" style={{ fontSize: '0.78rem' }}>Aprobar</button>
                </>
              )}
              {selected.status === 'aprobada' && (
                <button onClick={() => handleUpdateStatus(selected.id, 'entregada')} className="btn btn-primary" style={{ fontSize: '0.78rem' }}>Marcar entregada</button>
              )}
            </div>
          </div>
        </div>
      )}

      {showNewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '480px', maxWidth: '95vw', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>{editId ? 'Editar solicitud' : 'Nueva solicitud emergente'}</h3>
              <button onClick={() => setShowNewModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
            </div>
            {newError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.6rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#7f1d1d' }}>{newError}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Empleado *</label>
                <select value={newForm.employee_id} onChange={e => setNewForm(f => ({ ...f, employee_id: e.target.value }))}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem' }}>
                  <option value="">Seleccionar...</option>
                  {employees.map((e: any) => <option key={e.id} value={e.id}>{e.nombre} ({e.documento})</option>)}
                </select>
              </div>
              {[
                { label: 'Artículo *', key: 'article_type', placeholder: 'Ej: Camisa manga larga' },
                { label: 'Talle', key: 'size', placeholder: 'M / L / XL / 42...' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>{label}</label>
                  <input value={(newForm as any)[key]} onChange={e => setNewForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
                    style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Motivo *</label>
                <textarea value={newForm.reason} onChange={e => setNewForm(f => ({ ...f, reason: e.target.value }))} rows={2}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Notas adicionales</label>
                <textarea value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button onClick={() => setShowNewModal(false)} className="btn btn-secondary" style={{ fontSize: '0.82rem' }}>Cancelar</button>
              <button onClick={handleCreateRequest} disabled={saving} className="btn btn-primary" style={{ fontSize: '0.82rem' }}>
                {saving ? 'Guardando...' : editId ? 'Guardar cambios' : 'Crear solicitud'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
