'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Search, History, User, ShieldAlert, CalendarX, XCircle, CheckCircle,
  CalendarClock, Building2, Calendar, Clock, FileText, AlertTriangle,
} from 'lucide-react';
import { useTicketContext, canAccessAgenda } from '@/app/context/TicketContext';
import LogoutExpandButton from '@/app/components/LogoutExpandButton';
import { getAppointmentStatusBadge } from '@/lib/agenda-ui';

interface Employee {
  id: number;
  documento: string;
  nombre: string;
  empresa?: string | null;
  sector?: string | null;
  puesto?: string | null;
  enabled?: number;
  estado?: string;
}

interface Appointment {
  id: number;
  status: string;
  remito_number?: string | null;
  delivered_at?: string | null;
  employee_nombre: string;
  employee_documento: string;
  employee_empresa?: string | null;
  slot_fecha: string;
  slot_start: string;
  slot_end?: string;
}

interface FailedAttempt {
  id: number;
  documento: string;
  motivo: string;
  ip?: string | null;
  context?: string | null;
  created_at: string;
}

function formatDate(s?: string | null) {
  if (!s) return '';
  const ymd = s.slice(0, 10).split('-');
  if (ymd.length !== 3) return s;
  return `${ymd[2]}/${ymd[1]}/${ymd[0]}`;
}

function formatDateTime(s?: string | null) {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Traduce códigos internos de "motivo" a texto humano para mostrar en UI
const MOTIVO_LABELS: Record<string, string> = {
  not_enabled: 'Empleado no habilitado',
  not_found: 'Documento no registrado',
  rate_limited: 'Demasiados intentos — bloqueado temporalmente',
  slot_full: 'Turno sin cupo disponible',
  already_has_appointment: 'Ya tiene una cita activa',
  invalid_document: 'Documento inválido',
};

function formatMotivo(m?: string | null): string {
  if (!m) return '—';
  if (MOTIVO_LABELS[m]) return MOTIVO_LABELS[m];
  // Fallback: convertir snake_case a texto
  return m.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function HistorialPage() {
  const { currentUser, isAuthenticated, loading, logout, isMobile } = useTicketContext();
  const router = useRouter();
  const [cedula, setCedula] = useState('');
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [failedAttempts, setFailedAttempts] = useState<FailedAttempt[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!loading && !isAuthenticated) { router.push('/login'); return null; }
  if (!loading && currentUser && !canAccessAgenda(currentUser)) { router.push('/'); return null; }

  async function handleSearch() {
    const doc = cedula.trim();
    if (!doc) { setError('Ingresá una cédula'); return; }
    setSearching(true);
    setError(null);
    setSearched(false);
    setEmployee(null);
    setAppointments([]);
    setFailedAttempts([]);

    try {
      const [empRes, apptRes, failRes] = await Promise.all([
        fetch(`/api/logistica/agenda/employees?search=${encodeURIComponent(doc)}&limit=5`),
        fetch(`/api/logistica/agenda/appointments?search=${encodeURIComponent(doc)}&limit=500`),
        fetch(`/api/logistica/agenda/failed-attempts?search=${encodeURIComponent(doc)}&limit=500`),
      ]);

      const empData = empRes.ok ? await empRes.json() : { employees: [] };
      const apptData = apptRes.ok ? await apptRes.json() : { appointments: [] };
      const failData = failRes.ok ? await failRes.json() : { attempts: [] };

      const exactMatch = (empData.employees || []).find((e: Employee) => e.documento === doc) || (empData.employees || [])[0] || null;
      setEmployee(exactMatch);
      setAppointments((apptData.appointments || []).filter((a: Appointment) => a.employee_documento === doc));
      setFailedAttempts((failData.attempts || []).filter((f: FailedAttempt) => f.documento === doc));
      setSearched(true);
    } catch (err: any) {
      setError(err?.message || 'Error al buscar');
    } finally {
      setSearching(false);
    }
  }

  const byStatus = {
    completada: appointments.filter(a => a.status === 'completada'),
    ausente: appointments.filter(a => a.status === 'ausente' || a.status === 'no_asistio'),
    cancelada: appointments.filter(a => a.status === 'cancelada'),
    confirmada: appointments.filter(a => a.status === 'confirmada' || a.status === 'en_proceso' || a.status === 'reprogramada'),
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
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>Historial del Empleado</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {!isMobile && <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem' }}>{currentUser.name}</span>}
          <LogoutExpandButton onClick={() => { logout(); router.push('/login'); }} />
        </div>
      </header>

      <main style={{ marginTop: '56px', padding: isMobile ? '1.25rem 1rem' : '1.5rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h1 style={{ margin: '0 0 1rem', fontSize: isMobile ? '1.05rem' : '1.2rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <History size={16} /> Historial
          </h1>

          {/* Búsqueda */}
          <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>Cédula</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input
                value={cedula}
                onChange={e => setCedula(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
                placeholder="Ej: 12345678"
                style={{ flex: '1 1 200px', minWidth: 0, border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.55rem 0.75rem', fontSize: '0.9rem', boxSizing: 'border-box' }}
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#29416b', color: 'white', border: 'none', borderRadius: '8px', padding: '0.55rem 1.2rem', fontSize: '0.88rem', fontWeight: 600, cursor: searching ? 'wait' : 'pointer', opacity: searching ? 0.7 : 1 }}
              >
                <Search size={14} /> {searching ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
            {error && <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: '#b91c1c' }}>{error}</p>}
          </div>

          {/* Resultados */}
          {searching ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Buscando...</div>
          ) : searched ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Datos del empleado */}
              {employee ? (
                <div className="card" style={{ padding: '1rem 1.1rem', borderLeft: '4px solid #29416b' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <User size={15} style={{ color: '#29416b' }} />
                    <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#29416b' }}>Datos del empleado</h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '0.5rem 1rem', fontSize: '0.82rem', color: '#475569' }}>
                    <div><strong style={{ color: '#1e293b' }}>{employee.nombre}</strong> <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>({employee.documento})</span></div>
                    <div><Building2 size={11} style={{ verticalAlign: 'middle', color: '#94a3b8' }} /> {employee.empresa || '—'}{employee.sector ? ` / ${employee.sector}` : ''}</div>
                    <div>
                      Estado:{' '}
                      <span style={{ background: employee.enabled ? '#dcfce7' : '#fee2e2', color: employee.enabled ? '#166534' : '#991b1b', borderRadius: '4px', padding: '0.1rem 0.45rem', fontSize: '0.72rem', fontWeight: 700 }}>
                        {employee.enabled ? 'Habilitado' : 'No habilitado'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
                  <div style={{ fontSize: '0.82rem', color: '#78350f', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <AlertTriangle size={14} /> No se encontró un empleado con esa cédula. Se muestran solo los registros asociados (si hay).
                  </div>
                </div>
              )}

              {/* No habilitados / Intentos fallidos */}
              <SectionCard
                title="Intentos de registro no habilitados"
                count={failedAttempts.length}
                icon={<ShieldAlert size={15} />}
                color="#b91c1c"
                bg="#fef2f2"
                isMobile={isMobile}
              >
                {failedAttempts.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>Sin intentos fallidos.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {failedAttempts.map(f => (
                      <div key={f.id} style={{ background: 'white', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.6rem 0.75rem', fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, color: '#991b1b' }}>{formatMotivo(f.motivo)}</span>
                          <span style={{ color: '#94a3b8', fontSize: '0.74rem' }}>{formatDateTime(f.created_at)}</span>
                        </div>
                        {f.context && <div style={{ marginTop: '0.25rem', fontSize: '0.74rem', color: '#64748b' }}>{f.context}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              {/* Citas: no asistió */}
              <SectionCard
                title="Citas a las que no asistió"
                count={byStatus.ausente.length}
                icon={<CalendarX size={15} />}
                color="#c2410c"
                bg="#fff7ed"
                isMobile={isMobile}
              >
                <AppointmentList list={byStatus.ausente} isMobile={isMobile} router={router} />
              </SectionCard>

              {/* Citas: canceladas */}
              <SectionCard
                title="Citas canceladas"
                count={byStatus.cancelada.length}
                icon={<XCircle size={15} />}
                color="#64748b"
                bg="#f1f5f9"
                isMobile={isMobile}
              >
                <AppointmentList list={byStatus.cancelada} isMobile={isMobile} router={router} />
              </SectionCard>

              {/* Citas: agendadas / en proceso */}
              <SectionCard
                title="Citas agendadas / en curso"
                count={byStatus.confirmada.length}
                icon={<CalendarClock size={15} />}
                color="#1e40af"
                bg="#eff6ff"
                isMobile={isMobile}
              >
                <AppointmentList list={byStatus.confirmada} isMobile={isMobile} router={router} />
              </SectionCard>

              {/* Citas: completadas */}
              <SectionCard
                title="Citas completadas (entregas)"
                count={byStatus.completada.length}
                icon={<CheckCircle size={15} />}
                color="#047857"
                bg="#ecfdf5"
                isMobile={isMobile}
              >
                <AppointmentList list={byStatus.completada} isMobile={isMobile} router={router} showRemito />
              </SectionCard>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8', fontSize: '0.85rem' }}>
              Ingresá una cédula para ver el historial completo del empleado.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function SectionCard({
  title, count, icon, color, bg, isMobile, children,
}: {
  title: string; count: number; icon: React.ReactNode; color: string; bg: string; isMobile: boolean; children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ padding: '1rem 1.1rem', borderLeft: `4px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.7rem' }}>
        <span style={{ color }}>{icon}</span>
        <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color }}>
          {title} <span style={{ marginLeft: '0.3rem', background: bg, color, borderRadius: '4px', padding: '0.1rem 0.45rem', fontSize: '0.72rem' }}>{count}</span>
        </h3>
      </div>
      {children}
    </div>
  );
}

function AppointmentList({
  list, isMobile, router, showRemito,
}: {
  list: Appointment[]; isMobile: boolean; router: any; showRemito?: boolean;
}) {
  if (list.length === 0) {
    return <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>Sin registros.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      {list.map(a => {
        const badge = getAppointmentStatusBadge(a.status);
        return (
          <div key={a.id}
            onClick={() => router.push(`/logistica/agenda/admin/citas/${a.id}`)}
            style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.55rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
            onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#475569' }}>
                <Calendar size={11} style={{ color: '#94a3b8' }} /> {formatDate(a.slot_fecha)}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#64748b' }}>
                <Clock size={11} style={{ color: '#94a3b8' }} /> {a.slot_start}
              </span>
              {a.employee_empresa && <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{a.employee_empresa}</span>}
              {showRemito && a.remito_number && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#047857', fontWeight: 600 }}>
                  <FileText size={11} /> {a.remito_number}
                </span>
              )}
            </div>
            <span style={{ background: badge.bg, color: badge.color, borderRadius: '4px', padding: '0.1rem 0.45rem', fontSize: '0.7rem', fontWeight: 700 }}>
              {badge.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
