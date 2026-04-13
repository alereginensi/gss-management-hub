'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shirt, Search, AlertCircle, CheckCircle, Phone, ArrowRight, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { useTicketContext, hasModuleAccess } from '@/app/context/TicketContext';

export default function AgendaLookupPage() {
  const router = useRouter();
  const { currentUser, isAuthenticated, loading } = useTicketContext();

  // Usuario logueado con acceso logística → redirección automática al panel admin
  useEffect(() => {
    if (loading) return;
    if (isAuthenticated && currentUser && hasModuleAccess(currentUser, 'logistica')) {
      router.replace('/logistica/agenda/admin');
    }
  }, [loading, isAuthenticated, currentUser, router]);

  const [documento, setDocumento] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const [view, setView] = useState<'lookup' | 'not-enabled'>('lookup');

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documento.trim()) return;

    setSubmitting(true);
    setError(null);
    setWhatsapp(null);

    try {
      const res = await fetch('/api/logistica/agenda/public/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documento: documento.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error && data.error.includes('No habilitado')) {
          setView('not-enabled');
          if (data.whatsapp) setWhatsapp(data.whatsapp);
          return;
        }
        setError(data.error || 'Error al buscar el documento');
        if (data.whatsapp) setWhatsapp(data.whatsapp);
        return;
      }

      // Guardar en sessionStorage para las páginas siguientes
      sessionStorage.setItem('agenda_employee', JSON.stringify(data.employee));
      sessionStorage.setItem('agenda_catalog', JSON.stringify(data.catalog));
      sessionStorage.setItem('agenda_prev_appointments', JSON.stringify(data.previous_appointments || []));

      router.push('/logistica/agenda/pedido');
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  // Mientras carga la sesión → no mostrar nada
  if (loading) {
    return null;
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f0f4f8',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}>
      {isAuthenticated && currentUser && hasModuleAccess(currentUser, 'logistica') && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, background: '#29416b', color: 'white', padding: '0.4rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 600, zIndex: 1000 }}>
          Modo Vista Previa (Administrador)
        </div>
      )}

      {/* Header */}
      {view === 'lookup' && (
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="GSS" width={120} height={40} style={{ objectFit: 'contain', marginBottom: '0.75rem' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Shirt size={22} color="#29416b" />
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#29416b', margin: 0 }}>
              Agenda Web de Uniformes
            </h1>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
            GSS Facility Services · Retiro de prendas
          </p>
        </div>
      )}

      {/* Card principal / Error Card */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        padding: '2.5rem 2rem',
        width: '100%',
        maxWidth: '440px',
        textAlign: view === 'not-enabled' ? 'center' : 'left',
      }}>
        {view === 'lookup' ? (
          <>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.4rem' }}>
              Identificate con tu documento
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1.5rem' }}>
              Ingresá tu cédula o DNI sin puntos ni guiones para verificar si estás habilitado para retirar uniformes.
            </p>

            <form onSubmit={handleLookup}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
                  Documento (CI / DNI)
                </label>
                <input
                  type="text"
                  value={documento}
                  onChange={e => setDocumento(e.target.value.replace(/\D/g, ''))}
                  placeholder="Ej: 12345678"
                  maxLength={12}
                  inputMode="numeric"
                  style={{
                    width: '100%',
                    border: error ? '2px solid #e04951' : '2px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '0.7rem 1rem',
                    fontSize: '1.1rem',
                    letterSpacing: '0.08em',
                    outline: 'none',
                    transition: 'border-color 200ms',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => { if (!error) e.target.style.borderColor = '#29416b'; }}
                  onBlur={e => { if (!error) e.target.style.borderColor = '#e2e8f0'; }}
                  autoFocus
                  disabled={submitting}
                />
              </div>

              {error && (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'flex-start',
                  textAlign: 'left'
                }}>
                  <AlertCircle size={16} color="#e04951" style={{ flexShrink: 0, marginTop: '1px' }} />
                  <div>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#7f1d1d' }}>{error}</p>
                    {whatsapp && (
                      <a
                        href={whatsapp.startsWith('http') ? whatsapp : `https://wa.me/${whatsapp}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.4rem', fontSize: '0.78rem', color: '#065f46', fontWeight: 600 }}
                      >
                        <Phone size={12} /> Contactar a RRHH por WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !documento.trim()}
                style={{
                  width: '100%',
                  backgroundColor: submitting || !documento.trim() ? '#94a3b8' : '#29416b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.8rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: submitting || !documento.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'background-color 200ms',
                }}
              >
                {submitting ? (
                  <>Verificando...</>
                ) : (
                  <><Search size={16} /> Verificar documento <ArrowRight size={16} /></>
                )}
              </button>
            </form>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '64px', height: '64px', background: '#fef2f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <AlertCircle size={32} color="#cc3232" />
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>
              No está habilitado
            </h2>

            <p style={{ fontSize: '1rem', color: '#64748b', lineHeight: '1.6', marginBottom: '2rem' }}>
              Su documento no se encuentra habilitado para el retiro de uniformes. Por favor, comuníquese con Recursos Humanos para más información.
            </p>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <a
                href={whatsapp?.startsWith('http') ? whatsapp : `https://wa.me/${whatsapp || '59891234567'}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  width: '100%',
                  backgroundColor: '#86a041',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '1rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.6rem',
                }}
              >
                <Phone size={20} /> Contactar a Recursos Humanos
              </a>

              <button
                onClick={() => setView('lookup')}
                style={{
                  width: '100%',
                  backgroundColor: 'white',
                  color: '#29416b',
                  border: '2px solid #29416b',
                  borderRadius: '10px',
                  padding: '0.9rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                <ArrowLeft size={18} /> Volver al inicio
              </button>
            </div>
          </div>
        )}

        {/* Info footer (only in lookup) */}
        {view === 'lookup' && (
          <div style={{
            marginTop: '1.5rem',
            padding: '0.75rem',
            background: '#f8fafc',
            borderRadius: '8px',
            borderLeft: '3px solid #29416b',
          }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <CheckCircle size={14} color="#29416b" style={{ marginTop: '2px', flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#475569' }}>
                Solo empleados habilitados por GSS pueden retirar prendas. Si creés que hay un error, contactá a RRHH.
              </p>
            </div>
          </div>
        )}
      </div>

      <p style={{ marginTop: '1.5rem', fontSize: '0.72rem', color: '#94a3b8', textAlign: 'center' }}>
        GSS Facility Services · Sistema interno de gestión de uniformes
      </p>
    </div>
  );
}
