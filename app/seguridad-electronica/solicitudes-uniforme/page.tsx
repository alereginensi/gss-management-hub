'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Shirt, X } from 'lucide-react';
import { useTicketContext, hasModuleAccess } from '@/app/context/TicketContext';
import LogoutExpandButton from '@/app/components/LogoutExpandButton';
import SolicitudEmergenteForm from '@/app/components/agenda/SolicitudEmergenteForm';

interface RequestRow {
  id: number;
  employee_documento?: string;
  employee_nombre?: string;
  article_type: string;
  size?: string;
  reason: string;
  status: string;
  requested_at: string;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  pendiente: { bg: '#fef3c7', fg: '#92400e', label: 'Pendiente' },
  aprobada: { bg: '#d1fae5', fg: '#065f46', label: 'Aprobada' },
  rechazada: { bg: '#fee2e2', fg: '#7f1d1d', label: 'Rechazada' },
  entregada: { bg: '#dbeafe', fg: '#1e40af', label: 'Entregada' },
};

export default function SeguridadSolicitudesUniformePage() {
  const { currentUser, isAuthenticated, loading, logout, isMobile } = useTicketContext();
  const router = useRouter();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (currentUser && !hasModuleAccess(currentUser, 'tecnico')) { router.push('/'); return; }
  }, [loading, isAuthenticated, currentUser, router]);

  const fetchRows = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/logistica/agenda/requests?source=seguridad');
      const data = await res.json();
      setRows(Array.isArray(data) ? data : Array.isArray(data.requests) ? data.requests : []);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || loading) return;
    fetchRows();
  }, [isAuthenticated, loading, fetchRows]);

  if (loading || !currentUser) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '56px',
        backgroundColor: '#29416b', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '0 1rem' : '0 1.5rem', zIndex: 100, borderBottom: '3px solid #e04951', boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/seguridad-electronica" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.78rem' }}>
            <ArrowLeft size={13} />{!isMobile && ' Seguridad'}
          </Link>
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>Solicitudes de Uniformes</span>
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
              <Shirt size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />Solicitudes emergentes
            </h1>
            <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Plus size={14} /> Nueva solicitud
            </button>
          </div>

          <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
            Registrá pedidos urgentes de uniforme para empleados del área. Logística aprobará o rechazará desde el panel de Agenda.
          </p>

          {fetching ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Cargando...</div>
          ) : rows.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
              <Shirt size={36} color="#cbd5e1" style={{ marginBottom: '0.75rem' }} />
              <p style={{ fontWeight: 600, marginBottom: '0.3rem' }}>Sin solicitudes registradas</p>
              <p style={{ fontSize: '0.8rem' }}>Tocá "Nueva solicitud" para crear el primer pedido.</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['Fecha', 'Empleado', 'Artículo', 'Talle', 'Motivo', 'Estado'].map(h => (
                      <th key={h} style={{ padding: '0.6rem 0.9rem', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '0.74rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const color = STATUS_COLORS[r.status] || STATUS_COLORS.pendiente;
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.6rem 0.9rem', color: '#64748b', whiteSpace: 'nowrap' }}>{new Date(r.requested_at).toLocaleDateString('es-UY')}</td>
                        <td style={{ padding: '0.6rem 0.9rem' }}>
                          <strong>{r.employee_nombre || '—'}</strong>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>CI {r.employee_documento || '—'}</div>
                        </td>
                        <td style={{ padding: '0.6rem 0.9rem', color: '#1e293b' }}>{r.article_type}</td>
                        <td style={{ padding: '0.6rem 0.9rem', color: '#64748b' }}>{r.size || '—'}</td>
                        <td style={{ padding: '0.6rem 0.9rem', color: '#64748b', maxWidth: '260px' }}>{r.reason}</td>
                        <td style={{ padding: '0.6rem 0.9rem' }}>
                          <span style={{ background: color.bg, color: color.fg, fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '4px' }}>{color.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card modal-responsive" style={{ width: '560px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Nueva solicitud de uniforme</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
            </div>
            <SolicitudEmergenteForm
              source="seguridad"
              onCancel={() => setShowModal(false)}
              onCreated={() => { setShowModal(false); fetchRows(); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
