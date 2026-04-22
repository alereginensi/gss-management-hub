'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, LogOut, Search, LogOut as LogOutIcon, FileText, Calendar,
  PackageMinus, User, Building2, PenSquare, Plus, RefreshCw,
} from 'lucide-react';
import { useTicketContext, canAccessAgenda } from '@/app/context/TicketContext';

interface EgressReturn {
  id: number;
  employee_id: number;
  employee_nombre: string;
  employee_documento: string;
  employee_empresa?: string | null;
  employee_sector?: string | null;
  returned_items: Array<{ article_type: string; size?: string; qty?: number }>;
  remito_number?: string | null;
  remito_pdf_url?: string | null;
  employee_signature_url?: string | null;
  responsible_signature_url?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  const ymd = d.toISOString();
  const [y, m, day] = ymd.slice(0, 10).split('-');
  return `${day}/${m}/${y}`;
}

export default function DevolucionesEgresoPage() {
  const { currentUser, isAuthenticated, loading, logout } = useTicketContext();
  const router = useRouter();

  const [items, setItems] = useState<EgressReturn[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (currentUser && !canAccessAgenda(currentUser)) { router.push('/'); return; }
  }, [loading, isAuthenticated, currentUser, router]);

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const p = new URLSearchParams({ limit: '200' });
      if (search) p.set('search', search);
      if (from) p.set('from', from);
      if (to) p.set('to', to);
      const res = await fetch(`/api/logistica/agenda/egress-returns?${p}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      setItems([]);
    } finally {
      setFetching(false);
    }
  }, [search, from, to]);

  useEffect(() => {
    if (!isAuthenticated || loading) return;
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load, isAuthenticated, loading]);

  if (loading || !currentUser) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)' }}>
        <Link href="/logistica/agenda/admin" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}>
          <ArrowLeft size={15} /> Admin Agenda
        </Link>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="GSS" style={{ height: '36px' }} />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{currentUser.name}</span>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem 2rem 4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PackageMinus size={22} color="#dc2626" /> Devoluciones por egreso
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Historial de devoluciones al finalizar relación laboral. Al registrar un egreso, el empleado queda inactivo y sus artículos activos se marcan como devueltos.
            </p>
          </div>
          <Link
            href="/logistica/agenda/admin/devoluciones-egreso/nueva"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.6rem 1.1rem', background: '#dc2626', color: '#fff', textDecoration: 'none', borderRadius: 'var(--radius)', fontSize: '0.85rem', fontWeight: 600 }}
          >
            <Plus size={14} /> Nueva devolución
          </Link>
        </div>

        {/* Filtros */}
        <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.35rem 0.6rem', background: 'var(--bg-color)' }}>
              <Search size={13} color="var(--text-secondary)" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre o cédula"
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.83rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Desde</label>
              <input
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
                style={{ width: '100%', padding: '0.35rem 0.55rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: '0.83rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Hasta</label>
              <input
                type="date"
                value={to}
                onChange={e => setTo(e.target.value)}
                style={{ width: '100%', padding: '0.35rem 0.55rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: '0.83rem' }}
              />
            </div>
            <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', border: '1px solid var(--border-color)', background: 'transparent', borderRadius: 'var(--radius)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.8rem', alignSelf: 'end' }}>
              <RefreshCw size={13} /> Actualizar
            </button>
          </div>
        </div>

        {fetching ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <div style={{ width: '30px', height: '30px', border: '3px solid var(--border-color)', borderTopColor: '#dc2626', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : items.length === 0 ? (
          <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <PackageMinus size={32} style={{ opacity: 0.35, marginBottom: '0.5rem' }} />
            <p style={{ margin: 0 }}>No hay devoluciones registradas todavía.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.85rem' }}>
            {items.map(it => (
              <div key={it.id} className="card" style={{ padding: '1rem', borderLeft: '4px solid #dc2626', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <User size={14} color="var(--text-secondary)" /> {it.employee_nombre}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      CI {it.employee_documento}
                      {it.employee_empresa && <> · <Building2 size={10} style={{ verticalAlign: 'middle' }} /> {it.employee_empresa}</>}
                      {it.employee_sector && <> · {it.employee_sector}</>}
                    </div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', background: '#fee2e2', color: '#991b1b', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    <LogOutIcon size={10} /> Egreso
                  </span>
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Calendar size={11} /> {formatDate(it.created_at)}
                </div>
                {it.returned_items.length > 0 && (
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-primary)', background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.5rem 0.6rem' }}>
                    <strong>{it.returned_items.length} ítem{it.returned_items.length !== 1 ? 's' : ''}:</strong>{' '}
                    {it.returned_items.map(i => i.article_type + (i.size ? ` (${i.size})` : '')).join(', ')}
                  </div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', paddingTop: '0.3rem', borderTop: '1px solid var(--border-color)' }}>
                  {it.remito_pdf_url && (
                    <a
                      href={`/api/logistica/agenda/egress-returns/${it.id}/remito-pdf?t=${it.updated_at}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '0.72rem', color: '#059669', textDecoration: 'none', background: '#f0fdf4', borderRadius: '4px', padding: '0.2rem 0.55rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <FileText size={11} /> Remito{it.remito_number ? ` N° ${it.remito_number}` : ''}
                    </a>
                  )}
                  {(it.employee_signature_url || it.responsible_signature_url) && (
                    <span style={{ fontSize: '0.72rem', color: '#1d4ed8', background: '#eff6ff', borderRadius: '4px', padding: '0.2rem 0.55rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <PenSquare size={11} /> Firmas
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <button
        onClick={() => { logout(); router.push('/login'); }}
        style={{ position: 'fixed', bottom: '1.5rem', left: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.5rem 0.9rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}
      >
        <LogOut size={14} /> Cerrar sesión
      </button>
    </div>
  );
}
