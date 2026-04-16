'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shirt, Search, AlertCircle, CheckCircle, Phone, ArrowRight } from 'lucide-react';
import Image from 'next/image';

export default function TurnoPublicPage() {
  const router = useRouter();
  const [documento, setDocumento] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<'not_found' | 'not_enabled' | null>(null);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documento.trim()) return;

    setSubmitting(true);
    setError(null);
    setErrorReason(null);
    setWhatsapp(null);

    try {
      const res = await fetch('/api/logistica/agenda/public/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documento: documento.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al buscar el documento');
        setErrorReason(data.reason ?? null);
        if (data.whatsapp) setWhatsapp(data.whatsapp);
        return;
      }

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
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <Image src="/logo.png" alt="GSS" width={120} height={40} style={{ objectFit: 'contain', marginBottom: '0.75rem' }} />
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

      <div style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        padding: '2rem',
        width: '100%',
        maxWidth: '420px',
      }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.4rem' }}>
          Identificate con tu documento
        </h2>
        <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1.5rem' }}>
          Ingresá tu cédula o DNI sin puntos ni guiones para verificar si estás habilitado para retirar uniformes.
        </p>

        <form onSubmit={handleLookup} style={{ display: errorReason === 'not_enabled' ? 'none' : undefined }}>
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
              autoFocus
              disabled={submitting}
              style={{
                width: '100%',
                border: error ? '2px solid #e04951' : '2px solid #e2e8f0',
                borderRadius: '8px',
                padding: '0.7rem 1rem',
                fontSize: '1.1rem',
                letterSpacing: '0.08em',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && errorReason === 'not_found' && (
            <div style={{
              background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px',
              padding: '1rem', marginBottom: '1rem', textAlign: 'center',
            }}>
              <AlertCircle size={28} color="#b45309" style={{ marginBottom: '0.5rem' }} />
              <p style={{ margin: '0 0 0.25rem', fontWeight: 700, fontSize: '0.9rem', color: '#92400e' }}>
                No estás registrado
              </p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#78350f' }}>
                Tu documento no figura en el sistema. Comunicáte con Recursos Humanos para más información.
              </p>
            </div>
          )}

          {error && errorReason === 'not_enabled' && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
              padding: '1rem', marginBottom: '1rem', textAlign: 'center',
            }}>
              <AlertCircle size={28} color="#e04951" style={{ marginBottom: '0.5rem' }} />
              <p style={{ margin: '0 0 0.25rem', fontWeight: 700, fontSize: '0.9rem', color: '#7f1d1d' }}>
                No está habilitado
              </p>
              <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#7f1d1d' }}>
                Su documento no se encuentra habilitado para el retiro de uniformes. Por favor, comuníquese con Recursos Humanos para más información.
              </p>
              {whatsapp && (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    background: '#4d7c0f', color: 'white', borderRadius: '8px',
                    padding: '0.75rem 1rem', fontSize: '0.88rem', fontWeight: 600,
                    textDecoration: 'none', marginBottom: '0.5rem',
                  }}
                >
                  <Phone size={15} /> Contactar a Recursos Humanos
                </a>
              )}
              <button
                type="button"
                onClick={() => { setError(null); setErrorReason(null); setDocumento(''); }}
                style={{
                  width: '100%', background: 'white', border: '1px solid #e2e8f0',
                  borderRadius: '8px', padding: '0.7rem', fontSize: '0.85rem',
                  color: '#374151', cursor: 'pointer', fontWeight: 500,
                }}
              >
                ← Volver al inicio
              </button>
            </div>
          )}

          {error && !errorReason && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
              padding: '0.75rem 1rem', marginBottom: '1rem',
              display: 'flex', gap: '0.5rem', alignItems: 'flex-start',
            }}>
              <AlertCircle size={16} color="#e04951" style={{ flexShrink: 0, marginTop: '1px' }} />
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#7f1d1d' }}>{error}</p>
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
            }}
          >
            {submitting ? <>Verificando...</> : <><Search size={16} /> Verificar documento <ArrowRight size={16} /></>}
          </button>
        </form>

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
      </div>

      <p style={{ marginTop: '1.5rem', fontSize: '0.72rem', color: '#94a3b8', textAlign: 'center' }}>
        GSS Facility Services · Sistema interno de gestión de uniformes
      </p>
    </div>
  );
}
