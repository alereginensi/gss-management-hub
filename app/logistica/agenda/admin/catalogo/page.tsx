'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Shirt, Edit2, Trash2, X, Upload } from 'lucide-react';
import { useTicketContext, canAccessAgenda } from '@/app/context/TicketContext';
import LogoutExpandButton from '@/app/components/LogoutExpandButton';
import type { AgendaUniformCatalogItem } from '@/lib/agenda-types';

const EMPRESAS = ['', 'REIMA', 'ORBIS', 'SCOUT', 'ERGON'];

const EMPTY_FORM = {
  empresa: '', workplace_category: '',
  article_type: '', article_name_normalized: '',
  quantity: 1, useful_life_months: 12,
  initial_enabled: 1, renewable: 1, reusable_allowed: 0, special_authorization_required: 0,
};

export default function AgendaCatalogoPage() {
  const { currentUser, isAuthenticated, loading, logout, isMobile } = useTicketContext();
  const router = useRouter();
  const [items, setItems] = useState<AgendaUniformCatalogItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<AgendaUniformCatalogItem | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [importPreview, setImportPreview] = useState<any | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (currentUser && !canAccessAgenda(currentUser)) { router.push('/'); return; }
  }, [loading, isAuthenticated, currentUser, router]);

  const fetchCatalog = useCallback(async () => {
    setFetching(true);
    try {
      const params = new URLSearchParams();
      if (filterEmpresa) params.set('empresa', filterEmpresa);
      const res = await fetch(`/api/logistica/agenda/catalog?${params}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setFetching(false);
    }
  }, [filterEmpresa]);

  useEffect(() => {
    if (!isAuthenticated || loading) return;
    fetchCatalog();
  }, [fetchCatalog, isAuthenticated, loading]);

  const openCreate = () => {
    setEditItem(null);
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (item: AgendaUniformCatalogItem) => {
    setEditItem(item);
    setForm({
      empresa: item.empresa || '',
      workplace_category: item.workplace_category || item.puesto || item.sector || '',
      article_type: item.article_type, article_name_normalized: item.article_name_normalized || '',
      quantity: item.quantity, useful_life_months: item.useful_life_months,
      initial_enabled: item.initial_enabled, renewable: item.renewable,
      reusable_allowed: item.reusable_allowed, special_authorization_required: item.special_authorization_required,
    });
    setFormError(null);
    setShowModal(true);
  };

  const categoriasSugeridas = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) {
      const v = (it.workplace_category || it.puesto || it.sector || '').trim();
      if (v) s.add(v);
    }
    return Array.from(s).sort();
  }, [items]);

  const handleSave = async () => {
    if (!form.article_type.trim()) { setFormError('Tipo de artículo requerido'); return; }
    setSaving(true);
    setFormError(null);
    try {
      const url = editItem ? `/api/logistica/agenda/catalog/${editItem.id}` : '/api/logistica/agenda/catalog';
      const method = editItem ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || 'Error al guardar'); return; }
      setShowModal(false);
      fetchCatalog();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este artículo del catálogo?')) return;
    await fetch(`/api/logistica/agenda/catalog/${id}`, { method: 'DELETE' });
    fetchCatalog();
  };

  // Agrupar por empresa
  const grouped: Record<string, AgendaUniformCatalogItem[]> = {};
  items.forEach(i => {
    const k = i.empresa || 'Sin empresa';
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(i);
  });

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
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>Catálogo de uniformes</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {!isMobile && <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem' }}>{currentUser.name}</span>}
          <LogoutExpandButton onClick={() => { logout(); router.push('/login'); }} />
        </div>
      </header>

      <main style={{ marginTop: '56px', padding: isMobile ? '1.25rem 1rem' : '1.5rem' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h1 style={{ margin: 0, fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: 700, color: '#0f172a' }}>
              <Shirt size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />Catálogo de prendas
            </h1>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select value={filterEmpresa} onChange={e => setFilterEmpresa(e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem' }}>
                {EMPRESAS.map(e => <option key={e} value={e}>{e || 'Todas las empresas'}</option>)}
              </select>
              <button onClick={() => setShowImportModal(true)} className="btn btn-secondary" style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Upload size={14} /> Importar
              </button>
              <button onClick={openCreate} className="btn btn-primary" style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Plus size={14} /> Nuevo artículo
              </button>
            </div>
          </div>

          <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
            Define qué prendas corresponden a cada empresa / sector. Los empleados solo verán artículos de su empresa al armar el pedido.
          </p>

          {fetching ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Cargando...</div>
          ) : items.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
              <Shirt size={36} color="#cbd5e1" style={{ marginBottom: '0.75rem' }} />
              <p style={{ fontWeight: 600, marginBottom: '0.3rem' }}>Sin artículos en el catálogo</p>
              <p style={{ fontSize: '0.8rem' }}>Agregá artículos para que los empleados puedan armar pedidos.</p>
            </div>
          ) : (
            Object.entries(grouped).map(([empresa, groupItems]) => (
              <div key={empresa} style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ background: '#eff6ff', color: '#1e40af', borderRadius: '4px', padding: '0.1rem 0.5rem', fontSize: '0.78rem' }}>{empresa}</span>
                  <span style={{ color: '#94a3b8', fontWeight: 400 }}>({groupItems.length} artículo{groupItems.length !== 1 ? 's' : ''})</span>
                </h2>
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        {['Artículo', 'Categoría', 'Cantidad', 'Vida útil', 'Reutilizable', 'Autorización', 'Acciones'].map(h => (
                          <th key={h} style={{ padding: '0.6rem 0.9rem', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '0.74rem', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {groupItems.map(item => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.6rem 0.9rem', fontWeight: 600, color: '#1e293b' }}>
                            {item.article_type}
                            {item.article_name_normalized && <span style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8', fontWeight: 400 }}>{item.article_name_normalized}</span>}
                          </td>
                          <td style={{ padding: '0.6rem 0.9rem', color: '#64748b' }}>{item.workplace_category || item.puesto || item.sector || '—'}</td>
                          <td style={{ padding: '0.6rem 0.9rem', textAlign: 'center', fontWeight: 700, color: '#29416b' }}>{item.quantity}</td>
                          <td style={{ padding: '0.6rem 0.9rem', color: '#64748b' }}>{item.useful_life_months} meses</td>
                          <td style={{ padding: '0.6rem 0.9rem', textAlign: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: item.reusable_allowed ? '#065f46' : '#94a3b8' }}>{item.reusable_allowed ? '✓' : '—'}</span>
                          </td>
                          <td style={{ padding: '0.6rem 0.9rem', textAlign: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: item.special_authorization_required ? '#92400e' : '#94a3b8' }}>{item.special_authorization_required ? '⚠' : '—'}</span>
                          </td>
                          <td style={{ padding: '0.6rem 0.9rem' }}>
                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                              <button onClick={() => openEdit(item)} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '0.2rem 0.45rem', cursor: 'pointer', color: '#374151' }}><Edit2 size={12} /></button>
                              <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: '1px solid #fecaca', borderRadius: '4px', padding: '0.2rem 0.45rem', cursor: 'pointer', color: '#e04951' }}><Trash2 size={12} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card modal-responsive" style={{ width: '520px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{editItem ? 'Editar artículo' : 'Nuevo artículo'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
            </div>
            {formError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.6rem 0.8rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#7f1d1d' }}>{formError}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Tipo de artículo *</label>
                <input value={form.article_type} onChange={e => setForm(f => ({ ...f, article_type: e.target.value }))} placeholder="Ej: Camisa manga larga" style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem', boxSizing: 'border-box' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Nombre interno normalizado (para reconciliación)</label>
                <input value={form.article_name_normalized} onChange={e => setForm(f => ({ ...f, article_name_normalized: e.target.value }))} placeholder="Ej: camisa_manga_larga" style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Empresa</label>
                <select value={form.empresa} onChange={e => setForm(f => ({ ...f, empresa: e.target.value }))} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem' }}>
                  {EMPRESAS.map(e => <option key={e} value={e}>{e || 'Aplica a todos'}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Categoría</label>
                <input
                  list="categorias-suggest"
                  value={form.workplace_category}
                  onChange={e => setForm(f => ({ ...f, workplace_category: e.target.value }))}
                  placeholder="Dejar vacío = aplica a todos"
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
                <datalist id="categorias-suggest">
                  {categoriasSugeridas.map((c: string) => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Cantidad máx.</label>
                <input type="number" min={1} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Vida útil (meses)</label>
                <input type="number" min={1} value={form.useful_life_months} onChange={e => setForm(f => ({ ...f, useful_life_months: parseInt(e.target.value) || 12 }))} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem', boxSizing: 'border-box' }} />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {[
                  { label: 'Habilitado en entrega inicial', key: 'initial_enabled' },
                  { label: 'Renovable', key: 'renewable' },
                  { label: 'Permite reutilizable', key: 'reusable_allowed' },
                  { label: 'Requiere autorización especial', key: 'special_authorization_required' },
                ].map(({ label, key }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={(form as any)[key] === 1} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked ? 1 : 0 }))} />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button onClick={() => setShowModal(false)} className="btn btn-secondary" style={{ fontSize: '0.82rem' }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ fontSize: '0.82rem' }}>
                {saving ? 'Guardando...' : editItem ? 'Guardar cambios' : 'Crear artículo'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Importar */}
      {showImportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '650px', maxWidth: '95vw', maxHeight: '90vh', padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Importar Catálogo (Excel)</h3>
              <button onClick={() => { setShowImportModal(false); setImportResult(null); setImportPreview(null); setImportFile(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
            </div>

            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
              Subí un archivo Excel con columnas <strong>article_type</strong>, <strong>empresa</strong>, <strong>categoria</strong>, <strong>cantidad</strong>, <strong>vida_util</strong>. Antes de insertar, verás una vista previa agrupada por empresa.
            </p>

            {importResult ? (
              <div style={{ background: importResult.failed > 0 ? '#fffbeb' : '#f0fdf4', border: '1px solid', borderColor: importResult.failed > 0 ? '#fde68a' : '#bbf7d0', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0 0 0.5rem', color: importResult.failed > 0 ? '#92400e' : '#166534' }}>
                  Importación finalizada
                </p>
                <ul style={{ fontSize: '0.8rem', margin: 0, paddingLeft: '1.2rem', color: '#475569' }}>
                  <li>Procesados: {importResult.processed}</li>
                  <li>Exitosos: {importResult.successful}</li>
                  <li>Fallidos: {importResult.failed}</li>
                </ul>
                {importResult.failed > 0 && (
                  <div style={{ marginTop: '0.75rem', maxHeight: '100px', overflowY: 'auto', fontSize: '0.72rem', color: '#7f1d1d', borderTop: '1px solid #fde68a', paddingTop: '0.5rem' }}>
                    <strong>Errores:</strong>
                    {importResult.errors.map((e: any, i: number) => (
                      <div key={i}>Fila {e.row}: {e.message}</div>
                    ))}
                  </div>
                )}
                <button onClick={() => { setShowImportModal(false); setImportResult(null); setImportPreview(null); setImportFile(null); fetchCatalog(); }} className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', fontSize: '0.82rem' }}>Cerrar y actualizar</button>
              </div>
            ) : importPreview ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.7rem 0.9rem', fontSize: '0.8rem', color: '#1e3a8a' }}>
                  <strong>Vista previa</strong> — {importPreview.total} artículo(s) en {Object.keys(importPreview.byEmpresa).length} empresa(s).
                  {importPreview.invalid?.length > 0 && <div style={{ color: '#92400e', marginTop: '0.3rem' }}>⚠ {importPreview.invalid.length} fila(s) inválidas se omitirán.</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  {Object.entries(importPreview.byEmpresa).map(([empresa, arr]: [string, any]) => (
                    <div key={empresa} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ background: '#f1f5f9', padding: '0.5rem 0.7rem', fontWeight: 700, fontSize: '0.82rem', color: '#1d3461', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{empresa}</span>
                        <span style={{ color: '#64748b', fontWeight: 500 }}>{arr.length} artículo(s)</span>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                        <thead>
                          <tr style={{ background: '#fafafa', color: '#64748b' }}>
                            <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem', fontWeight: 600 }}>Artículo</th>
                            <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem', fontWeight: 600 }}>Categoría</th>
                            <th style={{ textAlign: 'center', padding: '0.35rem 0.5rem', fontWeight: 600 }}>Cant.</th>
                            <th style={{ textAlign: 'center', padding: '0.35rem 0.5rem', fontWeight: 600 }}>Vida útil</th>
                          </tr>
                        </thead>
                        <tbody>
                          {arr.map((it: any, i: number) => (
                            <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '0.35rem 0.5rem', color: '#111827' }}>{it.article_type}</td>
                              <td style={{ padding: '0.35rem 0.5rem', color: '#475569' }}>{it.workplace_category || it.puesto || it.sector || '—'}</td>
                              <td style={{ padding: '0.35rem 0.5rem', textAlign: 'center', color: '#475569' }}>{it.quantity}</td>
                              <td style={{ padding: '0.35rem 0.5rem', textAlign: 'center', color: '#475569' }}>{it.useful_life_months} m</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => { setImportPreview(null); setImportFile(null); }}
                    className="btn btn-secondary"
                    style={{ flex: 1, fontSize: '0.82rem' }}
                    disabled={importing}
                  >Cancelar</button>
                  <button
                    onClick={async () => {
                      if (!importFile) return;
                      setImporting(true);
                      try {
                        const fd = new FormData();
                        fd.append('file', importFile);
                        const res = await fetch('/api/logistica/agenda/catalog/import', { method: 'POST', body: fd });
                        const data = await res.json();
                        if (!res.ok) { alert(data.error || 'Error importando'); return; }
                        setImportResult(data);
                        setImportPreview(null);
                      } finally {
                        setImporting(false);
                      }
                    }}
                    className="btn btn-primary"
                    style={{ flex: 2, fontSize: '0.82rem' }}
                    disabled={importing}
                  >{importing ? 'Importando...' : `Confirmar (${importPreview.total})`}</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <a href="/api/logistica/agenda/catalog/template" className="btn btn-secondary" style={{ fontSize: '0.8rem', textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                  Descargar Plantilla Excel
                </a>

                <input
                  type="file"
                  ref={importFileRef}
                  accept=".xlsx, .xls, .csv"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setImporting(true);
                    try {
                      const fd = new FormData();
                      fd.append('file', file);
                      const res = await fetch('/api/logistica/agenda/catalog/import/preview', { method: 'POST', body: fd });
                      const data = await res.json();
                      if (!res.ok) { alert(data.error || 'Error generando vista previa'); return; }
                      setImportPreview(data);
                      setImportFile(file);
                    } finally {
                      setImporting(false);
                      if (importFileRef.current) importFileRef.current.value = '';
                    }
                  }}
                />

                <button
                  onClick={() => importFileRef.current?.click()}
                  disabled={importing}
                  className="btn btn-primary"
                  style={{ fontSize: '0.85rem', padding: '0.75rem' }}
                >
                  {importing ? 'Procesando...' : 'Seleccionar archivo'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
