'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Search, Edit2, Upload, X, Users, Trash2, PackagePlus } from 'lucide-react';
import { useTicketContext, canAccessAgenda } from '@/app/context/TicketContext';
import LogoutExpandButton from '@/app/components/LogoutExpandButton';
import type { AgendaEmployee } from '@/lib/agenda-types';

const EMPRESAS = ['REIMA', 'ORBIS', 'SCOUT', 'ERGON'];

const EMPTY_FORM = {
  documento: '', nombre: '', empresa: '', sector: '', puesto: '',
  workplace_category: '',
  fecha_ingreso: '', talle_superior: '', talle_inferior: '', calzado: '',
  enabled: 1, allow_reorder: 0, estado: 'activo' as string, observaciones: '',
};

export default function AgendaEmpleadosPage() {
  const { currentUser, isAuthenticated, loading, logout, isMobile } = useTicketContext();
  const router = useRouter();
  const [employees, setEmployees] = useState<AgendaEmployee[]>([]);
  const [total, setTotal] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterEnabled, setFilterEnabled] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editEmployee, setEditEmployee] = useState<AgendaEmployee | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AgendaEmployee | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [categoriasSugeridas, setCategoriasSugeridas] = useState<string[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (currentUser && !canAccessAgenda(currentUser)) { router.push('/'); return; }
  }, [loading, isAuthenticated, currentUser, router]);

  useEffect(() => {
    if (!isAuthenticated || loading) return;
    fetch('/api/logistica/agenda/catalog')
      .then(r => r.json())
      .then((data: any[]) => {
        if (!Array.isArray(data)) return;
        const s = new Set<string>();
        for (const c of data) {
          const v = (c.workplace_category || c.puesto || c.sector || '').toString().trim();
          if (v) s.add(v);
        }
        setCategoriasSugeridas(Array.from(s).sort());
      })
      .catch(() => {});
  }, [isAuthenticated, loading]);

  const fetchEmployees = useCallback(async (isLoadMore = false) => {
    setFetching(true);
    try {
      const currentPage = isLoadMore ? page + 1 : 1;
      const params = new URLSearchParams({ limit: '50', page: String(currentPage) });
      if (search) params.set('search', search);
      if (filterEmpresa) params.set('empresa', filterEmpresa);
      if (filterEnabled !== '') params.set('enabled', filterEnabled);
      
      const res = await fetch(`/api/logistica/agenda/employees?${params}`);
      const data = await res.json();
      
      if (isLoadMore) {
        setEmployees(prev => [...prev, ...(data.employees || [])]);
        setPage(currentPage);
      } else {
        setEmployees(data.employees || []);
        setPage(1);
      }
      setTotal(data.total || 0);
    } finally {
      setFetching(false);
    }
  }, [search, filterEmpresa, filterEnabled, page]);

  useEffect(() => {
    if (!isAuthenticated || loading) return;
    const timer = setTimeout(() => fetchEmployees(false), 300);
    return () => clearTimeout(timer);
  }, [search, filterEmpresa, filterEnabled, isAuthenticated, loading]); // Remove fetchEmployees from here to avoid recursive trigger when page changes

  const openCreate = () => {
    setEditEmployee(null);
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (emp: AgendaEmployee) => {
    setEditEmployee(emp);
    setForm({
      documento: emp.documento, nombre: emp.nombre, empresa: emp.empresa || '',
      sector: emp.sector || '', puesto: emp.puesto || '',
      workplace_category: emp.workplace_category || '',
      fecha_ingreso: emp.fecha_ingreso || '', talle_superior: emp.talle_superior || '',
      talle_inferior: emp.talle_inferior || '', calzado: emp.calzado || '',
      enabled: emp.enabled, allow_reorder: emp.allow_reorder,
      estado: emp.estado, observaciones: emp.observaciones || '',
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.documento.trim()) { setFormError('Documento requerido'); return; }
    if (!form.nombre.trim()) { setFormError('Nombre requerido'); return; }
    setSaving(true);
    setFormError(null);
    try {
      const url = editEmployee ? `/api/logistica/agenda/employees/${editEmployee.id}` : '/api/logistica/agenda/employees';
      const method = editEmployee ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || 'Error al guardar'); return; }
      setShowModal(false);
      fetchEmployees();
    } finally {
      setSaving(false);
    }
  };

  const showToast = (msg: string, ok: boolean) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  const toggleEnabled = async (emp: AgendaEmployee) => {
    if (togglingId === emp.id) return;
    setTogglingId(emp.id);
    const newEnabled = emp.enabled ? 0 : 1;
    try {
      const res = await fetch(`/api/logistica/agenda/employees/${emp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: emp.nombre, empresa: emp.empresa, sector: emp.sector,
          puesto: emp.puesto, workplace_category: emp.workplace_category,
          fecha_ingreso: emp.fecha_ingreso, talle_superior: emp.talle_superior,
          talle_inferior: emp.talle_inferior, calzado: emp.calzado,
          enabled: newEnabled, allow_reorder: emp.allow_reorder,
          estado: emp.estado, observaciones: emp.observaciones,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || 'Error al actualizar', false);
      } else {
        showToast(newEnabled ? `${emp.nombre} habilitado` : `${emp.nombre} deshabilitado`, true);
        await fetchEmployees();
      }
    } finally {
      setTogglingId(null);
    }
  };

  const toggleAllowReorder = async (emp: AgendaEmployee) => {
    if (togglingId === emp.id) return;
    setTogglingId(emp.id);
    const newVal = emp.allow_reorder ? 0 : 1;
    try {
      const res = await fetch(`/api/logistica/agenda/employees/${emp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: emp.nombre, empresa: emp.empresa, sector: emp.sector,
          puesto: emp.puesto, workplace_category: emp.workplace_category,
          fecha_ingreso: emp.fecha_ingreso, talle_superior: emp.talle_superior,
          talle_inferior: emp.talle_inferior, calzado: emp.calzado,
          enabled: emp.enabled, allow_reorder: newVal,
          estado: emp.estado, observaciones: emp.observaciones,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || 'Error al actualizar', false);
      } else {
        showToast(newVal ? `Reorden habilitado para ${emp.nombre}` : `Reorden deshabilitado`, true);
        await fetchEmployees();
      }
    } finally {
      setTogglingId(null);
    }
  };

  const deleteEmployee = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/logistica/agenda/employees/${confirmDelete.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || 'Error al eliminar', false);
      } else {
        showToast(`${confirmDelete.nombre} eliminado`, true);
        setConfirmDelete(null);
        await fetchEmployees();
      }
    } finally {
      setDeleting(false);
    }
  };

  if (loading || !currentUser) return null;
  const isAdmin = currentUser.role === 'admin';

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
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>Empleados</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {!isMobile && <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem' }}>{currentUser.name}</span>}
          <LogoutExpandButton onClick={() => { logout(); router.push('/login'); }} />
        </div>
      </header>

      <main style={{ marginTop: '56px', padding: isMobile ? '1.25rem 1rem' : '1.5rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h1 style={{ margin: 0, fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: 700, color: '#0f172a' }}>
              <Users size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />Empleados ({total})
            </h1>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Link href="/logistica/agenda/admin/importaciones" className="btn btn-secondary" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none', padding: '0.45rem 0.85rem' }}>
                <Upload size={14} /> Importar
              </Link>
              <button onClick={openCreate} className="btn btn-primary" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Plus size={14} /> Nuevo empleado
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className="card" style={{ padding: isMobile ? '1rem' : '0.85rem 1rem', marginBottom: '1rem' }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: isMobile ? '1fr' : '1.2fr 0.9fr 0.9fr', 
              gap: '0.6rem' 
            }}>
              <div style={{ position: 'relative' }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar empleado..."
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.55rem 0.75rem', fontSize: '0.85rem', boxSizing: 'border-box' }} />
              </div>

              <div className="grid-2-mobile" style={{ display: isMobile ? 'grid' : 'contents', gap: '0.6rem' }}>
                <select value={filterEmpresa} onChange={e => setFilterEmpresa(e.target.value)} 
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.55rem 0.4rem', fontSize: '0.85rem' }}>
                  <option value="">Todas las empresas</option>
                  {EMPRESAS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <select value={filterEnabled} onChange={e => setFilterEnabled(e.target.value)} 
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.55rem 0.4rem', fontSize: '0.85rem' }}>
                  <option value="">Todos los estados</option>
                  <option value="1">Habilitados</option>
                  <option value="0">No habilitados</option>
                </select>
              </div>
            </div>
          </div>

          {/* Listado (Tabla Desktop / Tarjetas Mobile) */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: isMobile ? 'none' : undefined, background: isMobile ? 'transparent' : undefined }}>
            <div className="desktop-view scroll-container" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['Documento', 'Nombre', 'Empresa', 'Sector / Puesto', 'Categoría', 'Habilitado', 'Estado', 'Acciones'].map(h => (
                      <th key={h} style={{ padding: '0.7rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fetching ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Cargando...</td></tr>
                  ) : employees.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No hay empleados</td></tr>
                  ) : employees.map(emp => (
                    <tr key={emp.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                      <td style={{ padding: '0.7rem 1rem', fontFamily: 'monospace', color: '#374151' }}>{emp.documento}</td>
                      <td style={{ padding: '0.7rem 1rem', fontWeight: 600, color: '#1e293b' }}>{emp.nombre}</td>
                      <td style={{ padding: '0.7rem 1rem' }}>
                        {emp.empresa && <span style={{ background: '#eff6ff', color: '#1e40af', borderRadius: '4px', padding: '0.1rem 0.4rem', fontSize: '0.72rem', fontWeight: 700 }}>{emp.empresa}</span>}
                      </td>
                      <td style={{ padding: '0.7rem 1rem', color: '#64748b' }}>{[emp.sector, emp.puesto].filter(Boolean).join(' / ') || '—'}</td>
                      <td style={{ padding: '0.7rem 1rem', color: '#64748b', textTransform: 'capitalize' }}>{emp.workplace_category || '—'}</td>
                      <td style={{ padding: '0.7rem 1rem' }}>
                        <button
                          onClick={() => toggleEnabled(emp)}
                          disabled={togglingId === emp.id}
                          title={emp.enabled ? 'Deshabilitar' : 'Habilitar'}
                          type="button"
                          style={{
                            border: 'none', background: 'none', padding: 0,
                            cursor: togglingId === emp.id ? 'wait' : 'pointer',
                            opacity: togglingId === emp.id ? 0.5 : 1,
                            transition: 'opacity 0.15s',
                          }}>
                          {/* Track */}
                          <div style={{
                            width: '36px', height: '20px', borderRadius: '999px',
                            background: emp.enabled ? '#22c55e' : '#cbd5e1',
                            position: 'relative', transition: 'background 0.2s',
                          }}>
                            {/* Thumb */}
                            <div style={{
                              position: 'absolute', top: '2px',
                              left: emp.enabled ? '18px' : '2px',
                              width: '16px', height: '16px', borderRadius: '50%',
                              background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                              transition: 'left 0.2s',
                            }} />
                          </div>
                        </button>
                      </td>
                      <td style={{ padding: '0.7rem 1rem' }}>
                        <span style={{ background: emp.estado === 'activo' ? '#d1fae5' : '#fee2e2', color: emp.estado === 'activo' ? '#065f46' : '#7f1d1d', borderRadius: '4px', padding: '0.15rem 0.5rem', fontSize: '0.72rem', fontWeight: 700, textTransform: 'capitalize' }}>
                          {emp.estado}
                        </span>
                      </td>
                      <td style={{ padding: '0.7rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <button onClick={() => openEdit(emp)} type="button" style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '0.25rem 0.5rem', cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem' }}>
                            <Edit2 size={11} /> Editar
                          </button>
                          <button
                            onClick={() => toggleAllowReorder(emp)}
                            disabled={togglingId === emp.id}
                            type="button"
                            title={emp.allow_reorder ? 'Deshabilitar reorden' : 'Habilitar reorden'}
                            style={{ background: 'none', border: `1px solid ${emp.allow_reorder ? '#93c5fd' : '#e2e8f0'}`, borderRadius: '4px', padding: '0.25rem 0.4rem', cursor: togglingId === emp.id ? 'wait' : 'pointer', color: emp.allow_reorder ? '#2563eb' : '#94a3b8', display: 'flex', alignItems: 'center', opacity: togglingId === emp.id ? 0.5 : 1 }}>
                            <PackagePlus size={13} />
                          </button>
                          {isAdmin && (
                            <button onClick={() => setConfirmDelete(emp)} type="button" title="Eliminar empleado (borra todas sus referencias)" style={{ background: 'none', border: '1px solid #fecaca', borderRadius: '4px', padding: '0.25rem 0.4rem', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* VISTA MOBILE: Tarjetas */}
            <div className="mobile-view">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {employees.map(emp => (
                  <div key={emp.id} className="agenda-mobile-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div className="agenda-mobile-card-title">{emp.nombre}</div>
                      <span style={{ 
                        background: emp.estado === 'activo' ? '#d1fae5' : '#fee2e2', 
                        color: emp.estado === 'activo' ? '#065f46' : '#7f1d1d', 
                        borderRadius: '4px', padding: '0.1rem 0.4rem', fontSize: '0.6rem', fontWeight: 700 
                      }}>
                        {emp.estado.toUpperCase()}
                      </span>
                    </div>
                    <div className="agenda-mobile-card-subtitle">CI: {emp.documento} • {emp.empresa || 'S/E'}</div>
                    
                    <div className="agenda-mobile-card-row">
                      <span className="agenda-mobile-card-label">Sector/Puesto:</span>
                      <span className="agenda-mobile-card-value" style={{ maxWidth: '60%' }}>
                        {[emp.sector, emp.puesto].filter(Boolean).join(' / ') || '—'}
                      </span>
                    </div>
                    
                    <div className="agenda-mobile-card-row">
                      <span className="agenda-mobile-card-label">Habilitado:</span>
                      <button 
                        onClick={() => toggleEnabled(emp)} 
                        disabled={togglingId === emp.id} 
                        style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                      >
                        <div style={{ width: '32px', height: '18px', borderRadius: '999px', background: emp.enabled ? '#22c55e' : '#cbd5e1', position: 'relative' }}>
                          <div style={{ position: 'absolute', top: '2px', left: emp.enabled ? '16px' : '2px', width: '14px', height: '14px', borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                        </div>
                      </button>
                    </div>

                    <div className="agenda-mobile-card-actions">
                      <button onClick={() => openEdit(emp)} className="agenda-mobile-btn">
                        <Edit2 size={14} /> Editar
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => setConfirmDelete(emp)}
                          className="agenda-mobile-btn"
                          style={{ color: '#ef4444', borderColor: '#fee2e2' }}
                        >
                          <Trash2 size={14} /> Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {!fetching && employees.length < total && (
              <div style={{ padding: '1.25rem', textAlign: 'center', borderTop: '1px solid #e2e8f0', background: 'white' }}>
                <button 
                  onClick={() => fetchEmployees(true)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '0.5rem 2rem' }}
                >
                  Cargar más empleados ({total - employees.length} restantes)
                </button>
              </div>
            )}
            {fetching && employees.length > 0 && (
              <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                Cargando más...
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal confirmar eliminación */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '380px', maxWidth: '95vw', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ background: '#fee2e2', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 size={16} color="#ef4444" />
              </div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>Eliminar empleado</h3>
            </div>
            <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
              ¿Confirmar eliminación de <strong>{confirmDelete.nombre}</strong> ({confirmDelete.documento})?
            </p>
            <div style={{ margin: '0 0 1.25rem', padding: '0.65rem 0.8rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '0.78rem', color: '#7f1d1d', lineHeight: 1.45 }}>
              <strong>Esta acción borra TODO lo asociado al empleado:</strong>
              <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.1rem' }}>
                <li>Citas (pasadas, futuras, completadas)</li>
                <li>Artículos entregados / vencidos / renovados</li>
                <li>Solicitudes emergentes y envíos al interior</li>
                <li>Egresos registrados</li>
                <li>Intentos fallidos de registro (por cédula)</li>
              </ul>
              <div style={{ marginTop: '0.4rem', color: '#991b1b', fontWeight: 600 }}>No se puede deshacer.</div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)} disabled={deleting} className="btn btn-secondary" style={{ fontSize: '0.82rem' }}>Cancelar</button>
              <button onClick={deleteEmployee} disabled={deleting} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', padding: '0.45rem 1rem', cursor: deleting ? 'wait' : 'pointer', fontSize: '0.82rem', fontWeight: 600, opacity: deleting ? 0.7 : 1 }}>
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? '#065f46' : '#7f1d1d', color: 'white',
          padding: '0.6rem 1.25rem', borderRadius: '999px', fontSize: '0.82rem', fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)', zIndex: 2000, whiteSpace: 'nowrap',
          animation: 'fadeInUp 0.2s ease',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Modal crear/editar */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card modal-responsive" style={{ width: '580px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
                {editEmployee ? 'Editar empleado' : 'Nuevo empleado'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
            </div>

            {formError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.6rem 0.8rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#7f1d1d' }}>{formError}</div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {[
                { label: 'Documento *', key: 'documento', type: 'text', disabled: !!editEmployee },
                { label: 'Nombre completo *', key: 'nombre', type: 'text' },
                { label: 'Fecha de ingreso', key: 'fecha_ingreso', type: 'date' },
                { label: 'Sector', key: 'sector', type: 'text' },
                { label: 'Puesto', key: 'puesto', type: 'text' },
                { label: 'Talle superior', key: 'talle_superior', type: 'text', placeholder: 'M / L / XL' },
                { label: 'Talle inferior', key: 'talle_inferior', type: 'text', placeholder: '40 / 42 / 44' },
                { label: 'Calzado', key: 'calzado', type: 'text', placeholder: '40 / 41 / 42' },
              ].map(({ label, key, type, disabled, placeholder }) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>{label}</label>
                  <input
                    type={type} value={(form as any)[key]} disabled={disabled}
                    placeholder={placeholder}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem', boxSizing: 'border-box', background: disabled ? '#f8fafc' : 'white' }}
                  />
                </div>
              ))}

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Empresa</label>
                <select value={form.empresa} onChange={e => setForm(f => ({ ...f, empresa: e.target.value }))} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem' }}>
                  <option value="">Sin empresa asignada</option>
                  {EMPRESAS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Categoría</label>
                <input
                  list="empleados-categorias-suggest"
                  value={form.workplace_category}
                  onChange={e => setForm(f => ({ ...f, workplace_category: e.target.value }))}
                  placeholder="Ej: Servicios Hospitalarios"
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
                <datalist id="empleados-categorias-suggest">
                  {categoriasSugeridas.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Estado</label>
                <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem' }}>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                  <option value="baja">Baja</option>
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.enabled === 1} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked ? 1 : 0 }))} />
                  Habilitado para retirar uniformes
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.allow_reorder === 1} onChange={e => setForm(f => ({ ...f, allow_reorder: e.target.checked ? 1 : 0 }))} />
                  Permite reorden de prendas previas
                </label>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Observaciones</label>
                <textarea
                  value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                  rows={2} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button onClick={() => setShowModal(false)} className="btn btn-secondary" style={{ fontSize: '0.82rem' }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ fontSize: '0.82rem' }}>
                {saving ? 'Guardando...' : editEmployee ? 'Guardar cambios' : 'Crear empleado'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
