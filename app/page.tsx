'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Briefcase, Shield, LogOut } from 'lucide-react';
import { useTicketContext } from './context/TicketContext';

const cardHoverOn = (e: React.MouseEvent<HTMLDivElement>) => {
  e.currentTarget.style.transform = 'translateY(-4px)';
  e.currentTarget.style.boxShadow = '0 16px 32px rgba(41,65,107,0.35)';
  e.currentTarget.style.backgroundColor = '#1e3a8a';
};
const cardHoverOff = (e: React.MouseEvent<HTMLDivElement>) => {
  e.currentTarget.style.transform = 'translateY(0)';
  e.currentTarget.style.boxShadow = '0 4px 12px rgba(41,65,107,0.2)';
  e.currentTarget.style.backgroundColor = 'var(--primary-color)';
};

export default function Landing() {
  const { currentUser, isAuthenticated, loading, logout } = useTicketContext();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.push('/login');
    } else if (currentUser?.role === 'funcionario') {
      router.push('/tasks');
    }
  }, [loading, isAuthenticated, currentUser, router]);

  if (loading || !currentUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg-color)' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary-color)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (currentUser.role === 'funcionario') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg-color)' }}>
        Redirigiendo...
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-color)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      gap: '2rem'
    }}>
      {/* Logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="GSS Facility Services" style={{ maxWidth: '220px', height: 'auto' }} />

      <h1 style={{ color: 'var(--text-primary)', fontSize: '1.25rem', fontWeight: 600, textAlign: 'center', margin: 0 }}>
        Seleccione una sección
      </h1>

      {/* Section Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1.5rem',
        width: '100%',
        maxWidth: '620px'
      }}>
        <Link href="/administracion" style={{ textDecoration: 'none' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2.5rem 2rem',
              gap: '1rem',
              cursor: 'pointer',
              transition: 'transform 0.18s, box-shadow 0.18s, background-color 0.18s',
              minHeight: '180px',
              textAlign: 'center',
              backgroundColor: 'var(--primary-color)',
              borderRadius: 'var(--radius)',
              boxShadow: '0 4px 12px rgba(41,65,107,0.2)'
            }}
            onMouseOver={cardHoverOn}
            onMouseOut={cardHoverOff}
          >
            <div style={{ padding: '0.9rem', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '50%' }}>
              <Briefcase size={36} color="white" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', margin: 0 }}>Administración</h2>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.75)', margin: 0 }}>Tickets, bitácora y gestión operativa</p>
          </div>
        </Link>

        {(currentUser.role === 'admin' || currentUser.role === 'tecnico') ? (
          <Link href="/seguridad-electronica" style={{ textDecoration: 'none' }}>
            <div
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '2.5rem 2rem', gap: '1rem', cursor: 'pointer',
                transition: 'transform 0.18s, box-shadow 0.18s, background-color 0.18s',
                minHeight: '180px', textAlign: 'center',
                backgroundColor: 'var(--primary-color)', borderRadius: 'var(--radius)',
                boxShadow: '0 4px 12px rgba(41,65,107,0.2)'
              }}
              onMouseOver={cardHoverOn}
              onMouseOut={cardHoverOff}
            >
              <div style={{ padding: '0.9rem', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '50%' }}>
                <Shield size={36} color="white" />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', margin: 0 }}>Seguridad Electrónica</h2>
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.75)', margin: 0 }}>Monitoreo, mantenimiento e historial</p>
            </div>
          </Link>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '2.5rem 2rem', gap: '1rem', cursor: 'not-allowed',
            minHeight: '180px', textAlign: 'center',
            backgroundColor: '#e2e8f0', borderRadius: 'var(--radius)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
          }}>
            <div style={{ padding: '0.9rem', backgroundColor: 'rgba(100,116,139,0.15)', borderRadius: '50%' }}>
              <Shield size={36} color="#94a3b8" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#94a3b8', margin: 0 }}>Seguridad Electrónica</h2>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>Necesitás ser Técnico para acceder a esta sección</p>
          </div>
        )}
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
        {currentUser.name} · {currentUser.role}
      </p>

      <button onClick={() => { logout(); router.push('/login'); }} style={{ position: 'fixed', bottom: '1.5rem', left: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.5rem 0.9rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
        <LogOut size={14} /> Cerrar sesión
      </button>
    </div>
  );
}
