'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Briefcase, Shield, Package, Calculator, Droplets, Users, Lock } from 'lucide-react';
import { useTicketContext, hasModuleAccess } from './context/TicketContext';
import LogoutExpandButton from './components/LogoutExpandButton';

export default function Landing() {
  const { currentUser, isAuthenticated, loading, logout, isMobile } = useTicketContext();
  const router = useRouter();

  const moduleRoutes: Record<string, string> = {
    logistica: '/logistica',
    tecnico: '/seguridad-electronica',
    cotizacion: '/cotizacion/panel',
    limpieza: '/operaciones-limpieza',
    rrhh: '/rrhh',
  };

  const noPanelAccess = !!currentUser
    && currentUser.role !== 'admin'
    && Number(currentUser.panel_access) === 0;

  const assignedDest = (() => {
    if (!currentUser) return '/login';
    const roleRoute = moduleRoutes[currentUser.role as string];
    const mods = currentUser.modules?.split(',').map(m => m.trim()).filter(Boolean) ?? [];
    const moduleRoute = mods.map(m => moduleRoutes[m]).find(Boolean);
    return roleRoute || moduleRoute || '/login';
  })();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace('/login');
    } else if (currentUser?.role === 'funcionario') {
      router.replace('/tasks');
    } else if (noPanelAccess) {
      router.replace(assignedDest);
    }
  }, [loading, isAuthenticated, currentUser, noPanelAccess, assignedDest, router]);

  // Mostrar loader mientras cargamos O cuando el usuario NO debe ver el hub.
  // Esto evita que el hub aparezca durante el split-second antes del redirect.
  if (loading || !currentUser || currentUser.role === 'funcionario' || noPanelAccess) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '1rem',
        height: '100vh',
        backgroundColor: 'var(--bg-color)',
      }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid #e2e2e2', borderTopColor: 'var(--primary-color)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
          {noPanelAccess ? 'Redirigiendo a tu módulo…' : 'Cargando, espere por favor…'}
        </p>
      </div>
    );
  }

  const moduleList = [
    { key: 'panel',      label: 'Panel General',                 description: 'Tickets, bitácora y gestión operativa',         icon: Briefcase,  href: '/administracion',        access: true },
    { key: 'tecnico',    label: 'Seguridad Electrónica',          description: 'Monitoreo, mantenimiento e historial',           icon: Shield,     href: '/seguridad-electronica', access: hasModuleAccess(currentUser, 'tecnico') },
    { key: 'logistica',  label: 'Logística',                      description: 'Solicitudes de materiales y órdenes de compra', icon: Package,    href: '/logistica',             access: hasModuleAccess(currentUser, 'logistica') },
    { key: 'cotizacion', label: 'Cotización',                     description: 'Tarifas, liquidaciones y reportes',              icon: Calculator, href: '/cotizacion',            access: hasModuleAccess(currentUser, 'cotizacion') },
    { key: 'limpieza',   label: 'Operaciones Limpieza/Seguridad', description: 'Tareas, informes y control operativo',           icon: Droplets,   href: '/operaciones-limpieza',  access: hasModuleAccess(currentUser, 'limpieza') },
    { key: 'rrhh',       label: 'Recursos Humanos',               description: 'Gestión de personal y RRHH',                    icon: Users,      href: '/rrhh',                  access: hasModuleAccess(currentUser, 'rrhh') },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>

      {/* Header fijo */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '56px',
        backgroundColor: '#29416b',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '0 1rem' : '0 2rem',
        zIndex: 100,
        borderBottom: '3px solid #e04951',
        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="GSS Facility Services" style={{ maxHeight: isMobile ? '32px' : '30px', width: 'auto', filter: 'brightness(0) invert(1)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {!isMobile && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.8rem', fontWeight: 500 }}>{currentUser.name}</span>
              <span style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)', padding: '0.2rem 0.6rem', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', borderRadius: '4px' }}>
                {currentUser.role}
              </span>
            </>
          )}
          <LogoutExpandButton onClick={() => { logout(); router.push('/login'); }} />
        </div>
      </header>

      {/* Contenido: escritorio ocupa casi todo el ancho y alinea arriba; móvil sin cambios */}
      <main
        className="standalone-page"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: 'flex-start',
          minHeight: 'calc(100vh - 56px)',
          marginTop: '56px',
          padding: isMobile ? '1.5rem 1rem 2rem' : '2rem clamp(1.5rem, 5vw, 4rem)',
          marginLeft: 0,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ width: '100%', maxWidth: isMobile ? '1100px' : 'min(1680px, 100%)', margin: isMobile ? undefined : '0 auto', padding: 0 }}>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: isMobile ? '1.25rem' : '1.75rem' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="GSS Facility Services"
              style={{ maxWidth: isMobile ? '168px' : 'min(320px, 28vw)', width: '100%', height: 'auto', objectFit: 'contain' }}
            />
          </div>

          <h1 style={{ fontSize: isMobile ? '1.1rem' : 'clamp(1.5rem, 2.2vw, 2rem)', fontWeight: 700, color: '#0f172a', margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>
            Módulos del Sistema
          </h1>
          <p style={{ fontSize: isMobile ? '0.8rem' : 'clamp(0.9rem, 1.1vw, 1.05rem)', color: '#64748b', margin: '0 0 1.5rem', maxWidth: isMobile ? undefined : '48rem' }}>
            GSS Management Hub · Seleccione un módulo para continuar
          </p>

          <div className="landing-modules-grid">
            {moduleList.map((mod) => {
              const IconComp = mod.icon;
              if (mod.access) {
                return (
                  <Link key={mod.key} href={mod.href} className="landing-card-btn">
                    <div className="landing-card-icon">
                      <IconComp size={26} color="white" />
                    </div>
                    <div className="landing-card-content">
                      <p className="landing-card-label">{mod.label}</p>
                      <p className="landing-card-desc">{mod.description}</p>
                    </div>
                  </Link>
                );
              }
              return (
                <div key={mod.key} className="landing-card-btn landing-card-btn--locked">
                  <div className="landing-card-icon landing-card-icon--locked">
                    <IconComp size={26} color="#94a3b8" />
                  </div>
                  <div className="landing-card-content">
                    <p className="landing-card-label landing-card-label--locked">{mod.label}</p>
                    <span className="landing-card-no-access">
                      <Lock size={11} /> Sin acceso asignado
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </main>
    </div>
  );
}
