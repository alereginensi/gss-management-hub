'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Shield, AlertTriangle } from 'lucide-react';
import { useTicketContext } from '@/app/context/TicketContext';
import LogoutExpandButton from '@/app/components/LogoutExpandButton';

const TABS = [
  { id: 'audit', label: 'Log de auditoría' },
  { id: 'failed', label: 'Intentos fallidos' },
] as const;
type TabId = typeof TABS[number]['id'];

const ACTION_COLORS: Record<string, { color: string; bg: string }> = {
  create: { color: '#065f46', bg: '#d1fae5' },
  update: { color: '#1e40af', bg: '#dbeafe' },
  delete: { color: '#7f1d1d', bg: '#fee2e2' },
  approve: { color: '#065f46', bg: '#d1fae5' },
  reject: { color: '#7f1d1d', bg: '#fee2e2' },
  import: { color: '#5b21b6', bg: '#ede9fe' },
  config_change: { color: '#92400e', bg: '#fef3c7' },
  complete_delivery: { color: '#065f46', bg: '#d1fae5' },
  upload_remito: { color: '#1e40af', bg: '#dbeafe' },
  upload_signature: { color: '#1e40af', bg: '#dbeafe' },
  lookup_failed: { color: '#7f1d1d', bg: '#fee2e2' },
};

const MOTIVO_COLORS: Record<string, { color: string; bg: string }> = {
  not_found: { color: '#7f1d1d', bg: '#fee2e2' },
  not_enabled: { color: '#92400e', bg: '#fef3c7' },
  validation_error: { color: '#5b21b6', bg: '#ede9fe' },
};

const today = new Date().toISOString().split('T')[0];
const sevenAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

export default function AuditoriaPage() {
  const { currentUser, isAuthenticated, loading, logout, isMobile } = useTicketContext();
  const router = useRouter();

  const [tab, setTab] = useState<TabId>('audit');
  const [logs, setLogs] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [fetching, setFetching] = useState(true);

  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterFrom, setFilterFrom] = useState(sevenAgo);
  const [filterTo, setFilterTo] = useState('');

  const [filterDocumento, setFilterDocumento] = useState('');
  const [filterMotivo, setFilterMotivo] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (currentUser && currentUser.role !== 'admin') { router.push('/logistica/agenda/admin'); return; }
  }, [loading, isAuthenticated, currentUser, router]);

  const fetchData = useCallback(async () => {
    setFetching(true);
    try {
      if (tab === 'audit') {
        const p = new URLSearchParams({ limit: '200' });
        if (filterAction) p.set('action', filterAction);
        if (filterEntity) p.set('entity_type', filterEntity);
        if (filterFrom) p.set('from', filterFrom);
        if (filterTo) p.set('to', filterTo);
        const res = await fetch(`/api/logistica/agenda/audit?${p}`);
        const data = await res.json();
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      } else {
        const p = new URLSearchParams({ limit: '200' });
        if (filterDocumento) p.set('documento', filterDocumento);
        if (filterMotivo) p.set('motivo', filterMotivo);
        if (filterFrom) p.set('from', filterFrom);
        if (filterTo) p.set('to', filterTo);
        const res = await fetch(`/api/logistica/agenda/failed-attempts?${p}`);
        const data = await res.json();
        setAttempts(data.attempts || []);
        setTotal(data.total || 0);
      }
    } finally { setFetching(false); }
  }, [tab, filterAction, filterEntity, filterFrom, filterTo, filterDocumento, filterMotivo]);

  useEffect(() => {
    if (!isAuthenticated || loading) return;
    const t = setTimeout(fetchData, 300);
    return () => clearTimeout(t);
  }, [fetchData, isAuthenticated, loading]);

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
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>Auditoría</span>
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
              <Shield size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />Auditoría ({total} registros)
            </h1>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', borderBottom: '2px solid #e2e8f0' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? '#1e40af' : '#64748b', borderBottom: tab === t.id ? '2px solid #1e40af' : '2px solid transparent', marginBottom: '-2px', background: 'none', border: 'none', cursor: 'pointer' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Filtros comunes */}
          <div className="card" style={{ padding: '0.85rem 1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem' }} />
              <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem' }} />
              {tab === 'audit' && (
                <>
                  <input value={filterAction} onChange={e => setFilterAction(e.target.value)} placeholder="Acción (create, update...)"
                    style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem', width: '180px' }} />
                  <input value={filterEntity} onChange={e => setFilterEntity(e.target.value)} placeholder="Entidad (employee, slot...)"
                    style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem', width: '180px' }} />
                </>
              )}
              {tab === 'failed' && (
                <>
                  <input value={filterDocumento} onChange={e => setFilterDocumento(e.target.value)} placeholder="Documento"
                    style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem', width: '150px' }} />
                  <select value={filterMotivo} onChange={e => setFilterMotivo(e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem' }}>
                    <option value="">Todos los motivos</option>
                    <option value="not_found">No encontrado</option>
                    <option value="not_enabled">No habilitado</option>
                    <option value="validation_error">Error de validación</option>
                  </select>
                </>
              )}
            </div>
          </div>

          {/* Tabla audit */}
          {tab === 'audit' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      {['Fecha/Hora', 'Acción', 'Entidad', 'ID Entidad', 'Usuario', 'Detalles'].map(h => (
                        <th key={h} style={{ padding: '0.7rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fetching ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Cargando...</td></tr>
                    ) : logs.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Sin registros en este rango</td></tr>
                    ) : logs.map((l: any) => {
                      const ac = ACTION_COLORS[l.action] || { color: '#374151', bg: '#f9fafb' };
                      let details = '';
                      try { details = l.details ? JSON.stringify(JSON.parse(l.details), null, 0).slice(0, 120) : ''; } catch { details = l.details || ''; }
                      return (
                        <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.6rem 1rem', whiteSpace: 'nowrap', color: '#64748b', fontSize: '0.75rem' }}>
                            {new Date(l.created_at).toLocaleString('es-UY', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td style={{ padding: '0.6rem 1rem' }}>
                            <span style={{ background: ac.bg, color: ac.color, borderRadius: '4px', padding: '0.1rem 0.4rem', fontSize: '0.7rem', fontWeight: 700, fontFamily: 'monospace' }}>{l.action}</span>
                          </td>
                          <td style={{ padding: '0.6rem 1rem', color: '#64748b', fontFamily: 'monospace', fontSize: '0.75rem' }}>{l.entity_type}</td>
                          <td style={{ padding: '0.6rem 1rem', color: '#94a3b8', fontSize: '0.75rem' }}>{l.entity_id ?? '—'}</td>
                          <td style={{ padding: '0.6rem 1rem', color: '#374151', fontSize: '0.75rem' }}>{l.user_name || `#${l.user_id}` || '—'}</td>
                          <td style={{ padding: '0.6rem 1rem', color: '#94a3b8', fontSize: '0.72rem', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={details}>{details}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tabla intentos fallidos */}
          {tab === 'failed' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {attempts.length > 0 && (
                <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', borderBottom: '1px solid #fecaca', display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.8rem', color: '#7f1d1d' }}>
                  <AlertTriangle size={14} /> {total} intentos fallidos — posibles ataques de enumeración o documentos mal ingresados.
                </div>
              )}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      {['Fecha/Hora', 'Documento', 'Motivo', 'IP', 'User Agent'].map(h => (
                        <th key={h} style={{ padding: '0.7rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '0.75rem' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fetching ? (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Cargando...</td></tr>
                    ) : attempts.length === 0 ? (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Sin intentos fallidos</td></tr>
                    ) : attempts.map((a: any) => {
                      const mc = MOTIVO_COLORS[a.motivo] || { color: '#374151', bg: '#f9fafb' };
                      return (
                        <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.6rem 1rem', whiteSpace: 'nowrap', color: '#64748b', fontSize: '0.75rem' }}>
                            {new Date(a.created_at).toLocaleString('es-UY', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td style={{ padding: '0.6rem 1rem', fontFamily: 'monospace', fontWeight: 600 }}>{a.documento}</td>
                          <td style={{ padding: '0.6rem 1rem' }}>
                            <span style={{ background: mc.bg, color: mc.color, borderRadius: '4px', padding: '0.1rem 0.4rem', fontSize: '0.7rem', fontWeight: 700 }}>{a.motivo}</span>
                          </td>
                          <td style={{ padding: '0.6rem 1rem', color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.72rem' }}>{a.ip || '—'}</td>
                          <td style={{ padding: '0.6rem 1rem', color: '#94a3b8', fontSize: '0.72rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.user_agent || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
