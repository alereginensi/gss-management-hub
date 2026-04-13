'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Search, X, Plus, AlertTriangle, PackageCheck, Clock } from 'lucide-react';
import { useTicketContext, hasModuleAccess } from '@/app/context/TicketContext';
import LogoutExpandButton from '@/app/components/LogoutExpandButton';

const EMPRESAS = ['REIMA', 'ORBIS', 'SCOUT', 'ERGON'];

const today = new Date().toISOString().split('T')[0];

function getStatusBadge(status: string) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    pendiente:  { label: 'Pendiente',  bg: '#fef3c7', color: '#92400e' },
    completado: { label: 'Completado', bg: '#d1fae5', color: '#065f46' },
    cancelado:  { label: 'Cancelado',  bg: '#fee2e2', color: '#7f1d1d' },
  };
  return map[status] || { label: status, bg: '#f3f4f6', color: '#374151' };
}

export default function CambiosPage() {
  const { currentUser, isAuthenticated, loading, logout, isMobile } = useTicketContext();
  const router = useRouter();

  // Historial
  const [changes, setChanges] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modal nuevo cambio
  const [showModal, setShowModal] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [empSearch, setEmpSearch] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [empArticles, setEmpArticles] = useState<any[]>([]);
  const [selectedReturnId, setSelectedReturnId] = useState('');
  const [selectedNewId, setSelectedNewId] = useState('');
  const [creating, setCreating] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (currentUser && !hasModuleAccess(currentUser, 'logistica')) { router.push('/'); return; }
  }, [loading, isAuthenticated, currentUser, router]);

  const fetchChanges = useCallback(async () => {
    setFetching(true);
    try {
      const p = new URLSearchParams({ limit: '100' });
      if (filterSearch) p.set('search', filterSearch);
      if (filterFrom) p.set('from', filterFrom);
      if (filterTo) p.set('to', filterTo);
      if (filterEmpresa) p.set('empresa', filterEmpresa);
      if (filterStatus) p.set('status', filterStatus);
      const res = await fetch(`/api/logistica/agenda/changes?${p}`);
      const data = await res.json();
      setChanges(data.changes || []);
      setTotal(data.total || 0);
    } finally {
      setFetching(false);
    }
  }, [filterSearch, filterFrom, filterTo, filterEmpresa, filterStatus]);

  useEffect(() => {
    if (!isAuthenticated || loading) return;
    const t = setTimeout(fetchChanges, 300);
    return () => clearTimeout(t);
  }, [fetchChanges, isAuthenticated, loading]);

  const openModal = async () => {
    setShowModal(true);
    setEmpSearch('');
    setSelectedEmp(null);
    setEmpArticles([]);
    setSelectedReturnId('');
    setSelectedNewId('');
    setModalError(null);
    if (employees.length === 0 || catalog.length === 0) {
      const [resEmp, resCat] = await Promise.all([
        fetch('/api/logistica/agenda/employees?limit=2000'),
        fetch('/api/logistica/agenda/catalog'),
      ]);
      const dEmp = await resEmp.json();
      const dCat = await resCat.json();
      setEmployees(dEmp.employees || []);
      setCatalog(dCat || []);
    }
  };

  const handleSelectEmp = async (emp: any) => {
    setSelectedEmp(emp);
    setEmpSearch(emp.nombre);
    setSelectedReturnId('');
    const res = await fetch(`/api/logistica/agenda/articles?employee_id=${emp.id}&status=activo`);
    const data = await res.json();
    setEmpArticles(data.articles || []);
  };

  const getEligibilityBadge = (emp: any) => {
    if (emp.allow_reorder === 1) return { label: 'Habilitado', bg: '#dbeafe', color: '#1e40af' };
    // Check if has article past renewal (we don't have that info in the employees list,
    // but articles will show it once selected)
    return null;
  };

  const handleCreate = async () => {
    if (!selectedEmp) { setModalError('Seleccionar un empleado'); return; }
    setCreating(true);
    setModalError(null);
    try {
      const fd = new FormData();
      fd.append('employee_id', String(selectedEmp.id));
      if (selectedReturnId) fd.append('returned_article_id', selectedReturnId);
      if (selectedNewId) {
        const cat = catalog.find((c: any) => c.id === parseInt(selectedNewId));
        if (cat) {
          fd.append('article_type_new', cat.article_type);
          fd.append('useful_life_new', String(cat.useful_life_months || 12));
        }
      }
      const res = await fetch('/api/logistica/agenda/changes', { method: 'POST', body: fd });
      if (!res.ok) {
        const d = await res.json();
        setModalError(d.error || 'Error al crear el cambio');
        return;
      }
      const data = await res.json();
      setShowModal(false);
      router.push(`/logistica/agenda/admin/cambios/${data.id}`);
    } finally {
      setCreating(false);
    }
  };

  if (loading || !currentUser) return null;

  const filteredEmps = employees.filter(e =>
    e.nombre.toLowerCase().includes(empSearch.toLowerCase()) ||
    e.documento.includes(empSearch)
  ).slice(0, 8);

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
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>Cambios de Prenda</span>
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
              <RefreshCw size={16} />Cambios ({total})
            </h1>
            <button
              onClick={openModal}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#29416b', color: 'white', border: 'none', borderRadius: '6px', padding: '0.45rem 0.9rem', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
              <Plus size={14} />Nuevo cambio
            </button>
          </div>

          {/* Filtros */}
          <div className="card" style={{ padding: '0.85rem 1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: '1 1 180px' }}>
                <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)} placeholder="Nombre o cédula..."
                  style={{ width: '100%', paddingLeft: '32px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem 0.45rem 32px', fontSize: '0.82rem', boxSizing: 'border-box' }} />
              </div>
              <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem' }} />
              <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem' }} />
              <select value={filterEmpresa} onChange={e => setFilterEmpresa(e.target.value)}
                style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem' }}>
                <option value="">Todas las empresas</option>
                {EMPRESAS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem' }}>
                <option value="">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="completado">Completado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>

          {/* Tabla */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['Fecha', 'Empleado', 'CI', 'Empresa', 'Prenda devuelta', 'Prenda entregada', 'Estado', 'Acciones'].map(h => (
                      <th key={h} style={{ padding: '0.7rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fetching ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>Cargando...</td></tr>
                  ) : changes.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>No hay cambios registrados</td></tr>
                  ) : changes.map(c => {
                    const badge = getStatusBadge(c.status || 'pendiente');
                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
                        <td style={{ padding: '0.7rem 1rem', whiteSpace: 'nowrap', color: '#64748b', fontSize: '0.78rem' }}>
                          {c.changed_at ? String(c.changed_at).split('T')[0] : '—'}
                        </td>
                        <td style={{ padding: '0.7rem 1rem', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{c.employee_nombre}</td>
                        <td style={{ padding: '0.7rem 1rem', fontFamily: 'monospace', color: '#374151' }}>{c.employee_documento}</td>
                        <td style={{ padding: '0.7rem 1rem' }}>
                          {c.employee_empresa && <span style={{ background: '#eff6ff', color: '#1e40af', borderRadius: '4px', padding: '0.1rem 0.4rem', fontSize: '0.72rem', fontWeight: 700 }}>{c.employee_empresa}</span>}
                        </td>
                        <td style={{ padding: '0.7rem 1rem', color: '#64748b', fontSize: '0.78rem' }}>
                          {c.returned_article_type ? `${c.returned_article_type}${c.returned_article_size ? ` (${c.returned_article_size})` : ''}` : '—'}
                        </td>
                        <td style={{ padding: '0.7rem 1rem', color: '#374151', fontSize: '0.78rem' }}>
                          {c.new_article_type ? `${c.new_article_type}${c.new_article_size ? ` (${c.new_article_size})` : ''}` : '—'}
                        </td>
                        <td style={{ padding: '0.7rem 1rem' }}>
                          <span style={{ background: badge.bg, color: badge.color, borderRadius: '4px', padding: '0.15rem 0.5rem', fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            {(c.status === 'pendiente' || !c.status) ? <Clock size={10} /> : <PackageCheck size={10} />}
                            {badge.label}
                          </span>
                        </td>
                        <td style={{ padding: '0.7rem 1rem' }}>
                          <Link href={`/logistica/agenda/admin/cambios/${c.id}`}
                            style={{ fontSize: '0.75rem', color: (c.status === 'pendiente' || !c.status) ? '#2563eb' : '#64748b', textDecoration: 'none', border: `1px solid ${(c.status === 'pendiente' || !c.status) ? '#bfdbfe' : '#e2e8f0'}`, borderRadius: '4px', padding: '0.2rem 0.5rem', whiteSpace: 'nowrap', fontWeight: (c.status === 'pendiente' || !c.status) ? 700 : 400 }}>
                            {(c.status === 'pendiente' || !c.status) ? 'Completar →' : 'Ver detalle'}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Modal Nuevo Cambio */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '520px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <RefreshCw size={16} color="#2563eb" />Nuevo cambio de prenda
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
            </div>

            {modalError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.6rem 0.8rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#7f1d1d', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertTriangle size={14} />{modalError}
              </div>
            )}

            {/* Búsqueda empleado */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Empleado</label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  value={empSearch}
                  onChange={e => { setEmpSearch(e.target.value); if (selectedEmp) setSelectedEmp(null); }}
                  placeholder="Buscar por nombre o CI..."
                  style={{ width: '100%', paddingLeft: '32px', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.55rem 0.75rem 0.55rem 32px', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>

              {empSearch && !selectedEmp && filteredEmps.length > 0 && (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', marginTop: '0.3rem', overflow: 'hidden', background: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  {filteredEmps.map(e => {
                    const badge = getEligibilityBadge(e);
                    return (
                      <button key={e.id} onClick={() => handleSelectEmp(e)}
                        style={{ width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', borderBottom: '1px solid #f1f5f9', background: 'none', cursor: 'pointer', fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span><strong>{e.nombre}</strong> <span style={{ color: '#94a3b8' }}>({e.documento})</span>{e.empresa && <span style={{ marginLeft: '0.4rem', background: '#eff6ff', color: '#1e40af', borderRadius: '3px', padding: '0.05rem 0.3rem', fontSize: '0.7rem' }}>{e.empresa}</span>}</span>
                        {badge && <span style={{ background: badge.bg, color: badge.color, borderRadius: '3px', padding: '0.1rem 0.4rem', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 }}>{badge.label}</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedEmp && (
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '0.6rem 0.75rem', marginTop: '0.3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{selectedEmp.nombre}</span>
                    <span style={{ color: '#64748b', fontSize: '0.78rem', marginLeft: '0.5rem' }}>{selectedEmp.documento}</span>
                    {selectedEmp.allow_reorder === 1 && (
                      <span style={{ marginLeft: '0.5rem', background: '#dbeafe', color: '#1e40af', borderRadius: '3px', padding: '0.1rem 0.4rem', fontSize: '0.7rem', fontWeight: 700 }}>Habilitado</span>
                    )}
                    {selectedEmp.allow_reorder !== 1 && (
                      <span style={{ marginLeft: '0.5rem', background: '#fef3c7', color: '#92400e', borderRadius: '3px', padding: '0.1rem 0.4rem', fontSize: '0.7rem', fontWeight: 600 }}>
                        <AlertTriangle size={9} style={{ verticalAlign: 'middle' }} /> Sin autorización de cambio
                      </span>
                    )}
                  </div>
                  <button onClick={() => { setSelectedEmp(null); setEmpSearch(''); setEmpArticles([]); setSelectedReturnId(''); }}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={14} /></button>
                </div>
              )}
            </div>

            {/* Artículo a devolver */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Prenda a DEVOLVER (activa del empleado)</label>
              <select value={selectedReturnId} onChange={e => setSelectedReturnId(e.target.value)} disabled={!selectedEmp}
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.55rem 0.7rem', fontSize: '0.85rem', background: !selectedEmp ? '#f8fafc' : 'white' }}>
                <option value="">Ninguna / No aplica</option>
                {empArticles.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.article_type}{a.size ? ` (${a.size})` : ''} — entregado {a.delivery_date}
                    {a.renewal_enabled_at && a.renewal_enabled_at <= today ? ' ✓ Renovación disponible' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Artículo nuevo del catálogo */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Prenda a ENTREGAR (catálogo)</label>
              <select value={selectedNewId} onChange={e => setSelectedNewId(e.target.value)} disabled={!selectedEmp}
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.55rem 0.7rem', fontSize: '0.85rem', background: !selectedEmp ? '#f8fafc' : 'white' }}>
                <option value="">Ninguna / No aplica</option>
                {catalog.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.article_type}{c.empresa ? ` (${c.empresa})` : ''}</option>
                ))}
              </select>
            </div>

            <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', color: '#64748b', background: '#f8fafc', borderRadius: '6px', padding: '0.6rem 0.75rem' }}>
              Al confirmar se creará el cambio en estado <strong>pendiente</strong>. Podrás completarlo con los remitos, firmas e impresión en el paso siguiente.
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 1rem', fontSize: '0.82rem', cursor: 'pointer', color: '#64748b' }}>Cancelar</button>
              <button onClick={handleCreate} disabled={creating || !selectedEmp}
                style={{ background: '#29416b', color: 'white', border: 'none', borderRadius: '6px', padding: '0.45rem 1.25rem', fontSize: '0.82rem', fontWeight: 600, cursor: creating || !selectedEmp ? 'not-allowed' : 'pointer', opacity: creating || !selectedEmp ? 0.7 : 1 }}>
                {creating ? 'Creando...' : 'Crear y completar →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
