'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Users, Calendar, Shirt, ClipboardList, Truck,
  AlertTriangle, Clock, TrendingUp, Settings, Upload, History, ShieldAlert, PackageCheck, PackageMinus,
} from 'lucide-react';
import { useTicketContext, canAccessAgenda } from '@/app/context/TicketContext';
import LogoutExpandButton from '@/app/components/LogoutExpandButton';

interface Stats {
  hoy: { fecha: string; citas_total: number; citas_pendientes: number; citas_completadas: number; cupos_disponibles: number; intentos_fallidos: number; total_historico: number };
  empleados: { total: number; habilitados: number };
  alertas: { articulos_vencidos: number; articulos_habilitados_renovacion: number; solicitudes_pendientes: number; solicitudes_emergentes: number };
}

const QUICK_LINKS = [
  { label: 'Citas', href: '/logistica/agenda/admin/citas', icon: Calendar, desc: 'Gestionar turnos del día' },
  { label: 'Entregas', href: '/logistica/agenda/admin/entregas', icon: PackageCheck, desc: 'Uniformes entregados (citas completadas)' },
  { label: 'Egresos', href: '/logistica/agenda/admin/devoluciones-egreso', icon: PackageMinus, desc: 'Devoluciones al finalizar relación laboral' },
  { label: 'Ingresos', href: '/logistica/agenda/admin/ingresos', icon: PackageCheck, desc: 'Alta de turno para empleado que recién ingresa' },
  { label: 'Historial', href: '/logistica/agenda/admin/historial', icon: History, desc: 'Buscar por cédula: citas, ausencias, intentos fallidos' },
  { label: 'No Habilitados', href: '/logistica/agenda/admin/no-habilitados', icon: ShieldAlert, desc: 'Intentos fallidos de registro' },
  { label: 'Empleados', href: '/logistica/agenda/admin/empleados', icon: Users, desc: 'Alta, edición, habilitación' },
  { label: 'Horarios', href: '/logistica/agenda/admin/horarios', icon: Clock, desc: 'Slots y generación mensual' },
  { label: 'Catálogo', href: '/logistica/agenda/admin/catalogo', icon: Shirt, desc: 'Prendas por empresa/sector' },
  { label: 'Solicitudes', href: '/logistica/agenda/admin/solicitudes', icon: ClipboardList, desc: 'Casos especiales / emergentes' },
  { label: 'Artículos', href: '/logistica/agenda/admin/articulos', icon: Shirt, desc: 'Entregas y renovaciones' },
  { label: 'Interior', href: '/logistica/agenda/admin/envios-interior', icon: Truck, desc: 'Envíos al interior del país' },
  { label: 'Importar', href: '/logistica/agenda/admin/importaciones', icon: Upload, desc: 'Carga masiva de empleados' },
  { label: 'Migración', href: '/logistica/agenda/admin/migracion', icon: History, desc: 'Historial del sistema anterior' },
  { label: 'Auditoría', href: '/logistica/agenda/admin/auditoria', icon: ShieldAlert, desc: 'Log de acciones críticas' },
  { label: 'Configuración', href: '/logistica/agenda/admin/configuracion', icon: Settings, desc: 'Reglas globales del sistema' },
];

// Paths visibles para usuarios no-admin (vista restringida: gestión operativa + solicitudes + envíos)
const LOGISTICA_ALLOWED_PATHS: readonly string[] = [
  '/logistica/agenda/admin/citas',
  '/logistica/agenda/admin/entregas',
  '/logistica/agenda/admin/devoluciones-egreso',
  '/logistica/agenda/admin/ingresos',
  '/logistica/agenda/admin/solicitudes',
  '/logistica/agenda/admin/envios-interior',
];

// Regla: SOLO el rol "logistica" tiene vista restringida (6 cards).
// Admin, rrhh, jefe, supervisor y demás ven todo el panel admin.
function isAgendaRestricted(role?: string): boolean {
  if (!role) return false;
  const norm = role.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return norm === 'logistica';
}
// Alias mantenido para minimizar diff: "full access" = NO restringido.
function isAgendaFullAccess(role?: string): boolean {
  return !isAgendaRestricted(role);
}

export default function AgendaAdminDashboard() {
  const { currentUser, isAuthenticated, loading, logout, isMobile } = useTicketContext();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [backHref, setBackHref] = useState('/logistica');
  const [backLabel, setBackLabel] = useState('Logística');
  const [origin, setOrigin] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (currentUser && !canAccessAgenda(currentUser)) { router.push('/'); return; }
  }, [loading, isAuthenticated, currentUser, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const o = sessionStorage.getItem('agenda_origin');
    setOrigin(o);
    if (o === 'rrhh') {
      setBackHref('/rrhh');
      setBackLabel('RRHH');
    }
    // Nota: antes había un redirect para origen=logistica que lo mandaba directo
    // a /admin/citas. Ya no es necesario: el dashboard filtra por rol y muestra
    // solo las 4 cards permitidas (Citas, Entregas, Egresos, Ingresos).
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated || loading) return;
    fetch('/api/logistica/agenda/stats')
      .then(r => r.json())
      .then((data: any) => {
        if (data && data.hoy && data.empleados && data.alertas) setStats(data as Stats);
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, [isAuthenticated, loading]);

  if (loading || !currentUser) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '56px',
        backgroundColor: '#29416b', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '0 1rem' : '0 1.5rem', zIndex: 100, borderBottom: '3px solid #e04951',
        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href={backHref} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.78rem' }}>
            <ArrowLeft size={13} />{!isMobile && ` ${backLabel}`}
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="GSS" style={{ maxHeight: '28px', filter: 'brightness(0) invert(1)' }} />
          <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.85rem', fontWeight: 700 }}>Agenda Web · Panel Admin</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {!isMobile && <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem' }}>{currentUser.name}</span>}
          <LogoutExpandButton onClick={() => { logout(); router.push('/login'); }} />
        </div>
      </header>

      <main style={{ marginTop: '56px', padding: isMobile ? '1.25rem 1rem' : '1.5rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

          <div style={{ marginBottom: '1.5rem' }}>
            <h1 style={{ fontSize: isMobile ? '1.1rem' : '1.3rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Panel de Gestión — Agenda Web
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0' }}>
              {new Date().toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          {/* Stats del día (filtradas para no-admin: solo Citas hoy e Historial) */}
          {!statsLoading && stats && stats.hoy && stats.empleados && stats.alertas && (() => {
            const isAdmin = isAgendaFullAccess(currentUser?.role);
            const allStats = [
              { label: 'Citas hoy', value: stats.hoy.citas_total ?? 0, sub: `${stats.hoy.citas_pendientes ?? 0} pend.`, color: '#29416b', icon: Calendar, href: '/logistica/agenda/admin/citas' },
              { label: 'Historial', value: stats.hoy.total_historico ?? 0, sub: 'registros', color: '#065f46', icon: History, href: '/logistica/agenda/admin/entregas' },
              { label: 'Empleados', value: stats.empleados.total ?? 0, sub: `${stats.empleados.habilitados ?? 0} hab.`, color: '#1e40af', icon: Users, href: '/logistica/agenda/admin/empleados' },
              { label: 'Solicitudes', value: stats.alertas.solicitudes_emergentes ?? 0, sub: 'emergentes pendientes', color: '#92400e', icon: ClipboardList, href: '/logistica/agenda/admin/solicitudes?emergency=1' },
            ];
            const visibleStats = isAdmin
              ? allStats
              : allStats.filter(s => s.label === 'Citas hoy' || s.label === 'Historial' || s.label === 'Solicitudes');
            return (<div className="stats-grid">{visibleStats.map(({ label, value, sub, color, icon: Icon, href }) => (
                <Link key={label} href={href} style={{ textDecoration: 'none', color: 'inherit' }}><div className="card" style={{
                  padding: isMobile ? '0.85rem 0.5rem' : '1.25rem 1rem', 
                  display: 'flex', 
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: isMobile ? '0.4rem' : '0.85rem', 
                  alignItems: isMobile ? 'center' : 'flex-start', 
                  textAlign: isMobile ? 'center' : 'left',
                  justifyContent: isMobile ? 'center' : 'flex-start',
                  minHeight: isMobile ? '110px' : '90px' 
                }}>
                  <div style={{ 
                    background: color, 
                    borderRadius: '10px', 
                    padding: isMobile ? '0.45rem' : '0.6rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    flexShrink: 0,
                    boxShadow: `0 2px 8px ${color}33`
                  }}>
                    <Icon size={isMobile ? 18 : 20} color="white" />
                  </div>
                  <div style={{ width: '100%', overflow: 'hidden' }}>
                    <p style={{ margin: 0, fontSize: isMobile ? '1.3rem' : '1.6rem', fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>{value}</p>
                    <p style={{ margin: '0.2rem 0 0', fontSize: isMobile ? '0.68rem' : '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{label}</p>
                    <p style={{ margin: '0.1rem 0 0', fontSize: '0.65rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</p>
                  </div>
                </div></Link>
              ))}</div>);
          })()}

          {/* Alertas destacadas: admin ve ambas; no-admin solo ve solicitudes emergentes (no artículos por renovación) */}
          {stats && stats.alertas && (
            (isAgendaFullAccess(currentUser?.role) && ((stats.alertas.articulos_habilitados_renovacion ?? 0) > 0 || (stats.alertas.solicitudes_emergentes ?? 0) > 0)) ||
            (!isAgendaFullAccess(currentUser?.role) && (stats.alertas.solicitudes_emergentes ?? 0) > 0)
          ) && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '0.85rem 1rem', marginBottom: '1.25rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <AlertTriangle size={16} color="#92400e" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div style={{ fontSize: '0.8rem', color: '#92400e', flex: 1 }}>
                {(stats.alertas.articulos_habilitados_renovacion ?? 0) > 0 && (
                  <p style={{ margin: '0 0 0.2rem' }}>
                    <Link
                      href="/logistica/agenda/admin/articulos?tab=enabled"
                      style={{ color: '#92400e', textDecoration: 'underline' }}
                    >
                      <strong>{stats.alertas.articulos_habilitados_renovacion}</strong> artículo{stats.alertas.articulos_habilitados_renovacion !== 1 ? 's' : ''} habilitado{stats.alertas.articulos_habilitados_renovacion !== 1 ? 's' : ''} para renovación →
                    </Link>
                  </p>
                )}
                {(stats.alertas.solicitudes_emergentes ?? 0) > 0 && <p style={{ margin: 0 }}>⚠ <strong>{stats.alertas.solicitudes_emergentes}</strong> solicitud{stats.alertas.solicitudes_emergentes !== 1 ? 'es' : ''} emergente{stats.alertas.solicitudes_emergentes !== 1 ? 's' : ''} pendiente{stats.alertas.solicitudes_emergentes !== 1 ? 's' : ''} de aprobación</p>}
              </div>
            </div>
          )}

          {/* Accesos rápidos (filtrados para rol logistica) */}
          <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#374151', marginBottom: '0.75rem' }}>Secciones</h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '0.75rem' }}>
            {(isAgendaFullAccess(currentUser?.role)
              ? QUICK_LINKS
              : QUICK_LINKS.filter(l => LOGISTICA_ALLOWED_PATHS.includes(l.href))
            ).map(({ label, href, icon: Icon, desc }) => (
              <Link key={href} href={href} style={{ textDecoration: 'none' }}>
                <div className="card" style={{ padding: '1rem', cursor: 'pointer', transition: 'box-shadow 200ms', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(41,65,107,0.15)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}>
                  <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={16} color="#29416b" />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>{label}</p>
                    <p style={{ margin: '0.1rem 0 0', fontSize: '0.72rem', color: '#64748b' }}>{desc}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Acceso público */}
          <div style={{ marginTop: '1.5rem', padding: '0.85rem 1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.82rem', color: '#065f46' }}>Acceso público para empleados</p>
              <p style={{ margin: 0, fontSize: '0.74rem', color: '#047857' }}>/logistica/agenda — Sin login requerido</p>
            </div>
            <a href="/logistica/agenda?preview=1" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: '0.78rem', color: '#065f46', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}>
              <TrendingUp size={13} /> Ver flujo del empleado →
            </a>
          </div>

        </div>
      </main>
    </div>
  );
}
