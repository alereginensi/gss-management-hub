'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search, ShieldAlert, Calendar } from 'lucide-react';
import { useTicketContext, canAccessAgenda } from '@/app/context/TicketContext';
import LogoutExpandButton from '@/app/components/LogoutExpandButton';

interface FailedAttempt {
  id: number;
  documento: string;
  motivo: string;
  created_at: string;
  ip?: string;
}

export default function AgendaNoHabilitadosPage() {
  const { currentUser, isAuthenticated, loading, logout, isMobile } = useTicketContext();
  const router = useRouter();
  const [attempts, setAttempts] = useState<FailedAttempt[]>([]);
  const [total, setTotal] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (currentUser && !canAccessAgenda(currentUser)) { router.push('/'); return; }
  }, [loading, isAuthenticated, currentUser, router]);

  const fetchAttempts = useCallback(async (isLoadMore = false) => {
    setFetching(true);
    try {
      const currentPage = isLoadMore ? page + 1 : 1;
      const params = new URLSearchParams({ 
        limit: '50', 
        page: String(currentPage) 
      });
      if (search) params.set('search', search);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/logistica/agenda/failed-attempts?${params}`);
      const data = await res.json();
      
      if (isLoadMore) {
        setAttempts(prev => [...prev, ...(data.attempts || [])]);
        setPage(currentPage);
      } else {
        setAttempts(data.attempts || []);
        setPage(1);
      }
      setTotal(data.total || 0);
    } finally {
      setFetching(false);
    }
  }, [search, dateFrom, dateTo, page]);

  useEffect(() => {
    if (!isAuthenticated || loading) return;
    const timer = setTimeout(() => fetchAttempts(false), 300);
    return () => clearTimeout(timer);
  }, [search, dateFrom, dateTo, isAuthenticated, loading]);

  if (loading || !currentUser) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '56px',
        backgroundColor: '#29416b', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 1rem', zIndex: 100, borderBottom: '3px solid #e04951'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/logistica/agenda/admin" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.78rem' }}>
            <ArrowLeft size={13} /> Admin
          </Link>
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>No Habilitados</span>
        </div>
        <LogoutExpandButton onClick={() => { logout(); router.push('/login'); }} />
      </header>

      <main style={{ marginTop: '56px', padding: isMobile ? '1rem' : '2rem' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={20} color="#e04951" /> Intentos Rechazados
            </h1>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
              Registro de personas que intentaron agendar turno pero no estaban habilitadas o activas en el sistema.
            </p>
          </div>

          {/* Filtros */}
          <div className="card" style={{ padding: isMobile ? '1rem' : '0.85rem 1rem', marginBottom: '1.5rem' }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1.5fr', 
              gap: '0.6rem' 
            }}>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por DNI o motivo..."
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.55rem 0.75rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>
              <div className="grid-2-mobile" style={{ display: 'grid', gap: '0.6rem' }}>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} 
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.55rem 0.7rem', fontSize: '0.85rem' }} />
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} 
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.55rem 0.7rem', fontSize: '0.85rem' }} />
              </div>
            </div>
          </div>

          {/* Listado (Tabla Desktop / Tarjetas Mobile) */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: isMobile ? 'none' : undefined, background: isMobile ? 'transparent' : undefined }}>
            <div className="desktop-view scroll-container" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['Fecha y Hora', 'Documento', 'Motivo del Rechazo'].map(h => (
                      <th key={h} style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: 600, color: '#475569' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fetching && attempts.length === 0 ? (
                    <tr><td colSpan={3} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Cargando registros...</td></tr>
                  ) : attempts.length === 0 ? (
                    <tr><td colSpan={3} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>No se encontraron intentos de registro.</td></tr>
                  ) : attempts.map(att => (
                    <tr key={att.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1rem', color: '#1e293b', whiteSpace: 'nowrap' }}>
                        {new Date(att.created_at).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#29416b', fontFamily: 'monospace' }}>{att.documento}</td>
                      <td style={{ padding: '0.85rem 1rem', color: '#e04951', fontWeight: 500 }}>
                        {att.motivo === 'not_enabled' || att.motivo.toLowerCase().includes('no habilitado') ? 'No habilitado' : att.motivo}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* VISTA MOBILE: Tarjetas */}
            <div className="mobile-view">
              {fetching && attempts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Cargando...</div>
              ) : attempts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No hay registros</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
                  {attempts.map(att => (
                    <div key={att.id} className="agenda-mobile-card">
                      <div className="agenda-mobile-card-title">{att.documento}</div>
                      <div className="agenda-mobile-card-subtitle">
                        {new Date(att.created_at).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                      <div style={{ marginTop: '0.5rem', padding: '0.6rem', background: '#fef2f2', borderRadius: '8px', color: '#cc3232', fontSize: '0.82rem', fontWeight: 600 }}>
                        {att.motivo === 'not_enabled' || att.motivo.toLowerCase().includes('no habilitado') ? 'No habilitado' : att.motivo}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!fetching && attempts.length < total && (
              <div style={{ padding: '1.25rem', textAlign: 'center', borderTop: '1px solid #e2e8f0', background: 'white' }}>
                <button 
                  onClick={() => fetchAttempts(true)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '0.5rem 2rem' }}
                >
                  Cargar más registros ({total - attempts.length} restantes)
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
