'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search, Package, AlertTriangle, Clock } from 'lucide-react';
import { useTicketContext, hasModuleAccess } from '@/app/context/TicketContext';
import LogoutExpandButton from '@/app/components/LogoutExpandButton';
import { getArticleStatusBadge, daysUntilExpiration } from '@/lib/agenda-ui';

const EMPRESAS = ['REIMA', 'ORBIS', 'SCOUT', 'ERGON'];
const TABS = [
  { id: 'all', label: 'Todos', icon: Package },
  { id: 'enabled', label: 'Habilitados para renovar', icon: Clock },
  { id: 'expired', label: 'Vencidos', icon: AlertTriangle },
  { id: 'upcoming', label: 'Vencen en 30 días', icon: Clock },
] as const;

type TabId = typeof TABS[number]['id'];

export default function ArticulosPage() {
  const { currentUser, isAuthenticated, loading, logout, isMobile } = useTicketContext();
  const router = useRouter();

  const [articles, setArticles] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [tab, setTab] = useState<TabId>('all');
  const [search, setSearch] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (currentUser && !hasModuleAccess(currentUser, 'logistica')) { router.push('/'); return; }
  }, [loading, isAuthenticated, currentUser, router]);

  const fetchArticles = useCallback(async () => {
    setFetching(true);
    try {
      let url = '';
      if (tab === 'all') {
        const p = new URLSearchParams({ limit: '100' });
        if (search) p.set('search', search);
        if (filterEmpresa) p.set('empresa', filterEmpresa);
        if (filterStatus) p.set('status', filterStatus);
        url = `/api/logistica/agenda/articles?${p}`;
      } else {
        const p = new URLSearchParams({ mode: tab, limit: '100' });
        if (filterEmpresa) p.set('empresa', filterEmpresa);
        url = `/api/logistica/agenda/articles/renewal?${p}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setArticles(data.articles || []);
      setTotal(data.total || 0);
    } finally { setFetching(false); }
  }, [tab, search, filterEmpresa, filterStatus]);

  useEffect(() => {
    if (!isAuthenticated || loading) return;
    const t = setTimeout(fetchArticles, 300);
    return () => clearTimeout(t);
  }, [fetchArticles, isAuthenticated, loading]);

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
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>Artículos y Renovaciones ({total})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {!isMobile && <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem' }}>{currentUser.name}</span>}
          <LogoutExpandButton onClick={() => { logout(); router.push('/login'); }} />
        </div>
      </header>

      <main style={{ marginTop: '56px', padding: isMobile ? '1.25rem 1rem' : '1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', overflowX: 'auto', borderBottom: '2px solid #e2e8f0' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? '#1e40af' : '#64748b', marginBottom: '-2px', background: 'none', border: 'none', borderBottom: tab === t.id ? '2px solid #1e40af' : '2px solid transparent', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <t.icon size={13} />{t.label}
              </button>
            ))}
          </div>

          {/* Filtros */}
          <div className="card" style={{ padding: '0.85rem 1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {tab === 'all' && (
                <div style={{ position: 'relative', flex: '1 1 200px' }}>
                  <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Empleado, artículo..."
                    style={{ width: '100%', paddingLeft: '32px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem 0.45rem 32px', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                </div>
              )}
              <select value={filterEmpresa} onChange={e => setFilterEmpresa(e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem' }}>
                <option value="">Todas las empresas</option>
                {EMPRESAS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              {tab === 'all' && (
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem' }}>
                  <option value="">Todos los estados</option>
                  <option value="activo">Activo</option>
                  <option value="renovado">Renovado</option>
                  <option value="devuelto">Devuelto</option>
                  <option value="extraviado">Extraviado</option>
                </select>
              )}
            </div>
          </div>

          {/* Alertas para tabs especiales */}
          {tab === 'expired' && articles.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#7f1d1d' }}>
              <AlertTriangle size={15} /> {articles.length} artículo{articles.length !== 1 ? 's' : ''} con vida útil vencida. Requieren renovación o baja.
            </div>
          )}
          {tab === 'enabled' && articles.length > 0 && (
            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#78350f' }}>
              <Clock size={15} /> {articles.length} artículo{articles.length !== 1 ? 's' : ''} habilitados para renovación. Los empleados pueden sacar turno.
            </div>
          )}

          {/* Tabla */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['Empleado', 'Empresa', 'Artículo', 'Talle', 'Entregado', 'Vence', 'Estado', 'Origen'].map(h => (
                      <th key={h} style={{ padding: '0.7rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fetching ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Cargando...</td></tr>
                  ) : articles.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Sin artículos</td></tr>
                  ) : articles.map((a: any) => {
                    const badge = getArticleStatusBadge(a.current_status);
                    const days = a.expiration_date ? daysUntilExpiration(a.expiration_date) : null;
                    const isExpired = days !== null && days < 0;
                    const isUrgent = days !== null && days >= 0 && days <= 30;
                    return (
                      <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9', background: isExpired ? '#fef2f2' : isUrgent ? '#fffbeb' : 'white' }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                        <td style={{ padding: '0.7rem 1rem' }}>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{a.employee_nombre}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>{a.employee_documento}</div>
                        </td>
                        <td style={{ padding: '0.7rem 1rem' }}>
                          {a.employee_empresa && <span style={{ background: '#eff6ff', color: '#1e40af', borderRadius: '4px', padding: '0.1rem 0.4rem', fontSize: '0.72rem', fontWeight: 700 }}>{a.employee_empresa}</span>}
                        </td>
                        <td style={{ padding: '0.7rem 1rem', fontWeight: 600, color: '#1e293b' }}>{a.article_type}</td>
                        <td style={{ padding: '0.7rem 1rem', color: '#64748b' }}>{a.size || '—'}</td>
                        <td style={{ padding: '0.7rem 1rem', color: '#64748b', whiteSpace: 'nowrap' }}>{a.delivery_date}</td>
                        <td style={{ padding: '0.7rem 1rem', whiteSpace: 'nowrap' }}>
                          {a.expiration_date ? (
                            <span style={{ color: isExpired ? '#7f1d1d' : isUrgent ? '#92400e' : '#374151', fontWeight: isExpired || isUrgent ? 700 : 400 }}>
                              {a.expiration_date}
                              {days !== null && (
                                <span style={{ fontSize: '0.68rem', display: 'block', color: isExpired ? '#dc2626' : isUrgent ? '#d97706' : '#94a3b8' }}>
                                  {isExpired ? `Vencido hace ${Math.abs(days)} días` : `En ${days} días`}
                                </span>
                              )}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '0.7rem 1rem' }}>
                          <span style={{ background: badge.bg, color: badge.color, borderRadius: '4px', padding: '0.15rem 0.5rem', fontSize: '0.72rem', fontWeight: 700 }}>{badge.label}</span>
                        </td>
                        <td style={{ padding: '0.7rem 1rem', color: '#64748b', fontSize: '0.75rem', textTransform: 'capitalize' }}>
                          {a.origin_type?.replace('_', ' ') || '—'}
                          {a.migrated_flag ? <span style={{ marginLeft: '0.3rem', background: '#f1f5f9', borderRadius: '3px', padding: '0.05rem 0.3rem', fontSize: '0.65rem' }}>migrado</span> : ''}
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
    </div>
  );
}
