'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Calendar, Clock, Shirt, ArrowLeft, Printer, AlertCircle } from 'lucide-react';
import type { AgendaEmployee, AgendaTimeSlot, OrderItem } from '@/lib/agenda-types';
import Image from 'next/image';

export default function AgendaConfirmacionPage() {
  const router = useRouter();
  const [employee, setEmployee] = useState<AgendaEmployee | null>(null);
  const [slot, setSlot] = useState<AgendaTimeSlot | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [holdToken, setHoldToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const emp = sessionStorage.getItem('agenda_employee');
    const sl = sessionStorage.getItem('agenda_slot');
    const order = sessionStorage.getItem('agenda_order');
    const token = sessionStorage.getItem('agenda_hold_token');
    if (!emp || !sl || !order || !token) { router.replace('/logistica/agenda'); return; }
    setEmployee(JSON.parse(emp));
    setSlot(JSON.parse(sl));
    setOrderItems(JSON.parse(order));
    setHoldToken(token);
  }, [router]);

  const handleConfirm = async () => {
    if (!employee || !slot || !holdToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/logistica/agenda/public/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employee.id,
          time_slot_id: slot.id,
          order_items: orderItems,
          hold_token: holdToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al confirmar la cita');
        if (data.conflict) {
          // Turno perdido, volver a elegir
          setTimeout(() => router.push('/logistica/agenda/turno'), 2000);
        }
        return;
      }
      // Limpiar session storage
      sessionStorage.removeItem('agenda_slot');
      sessionStorage.removeItem('agenda_hold_token');
      sessionStorage.removeItem('agenda_order');
      setConfirmed(data.appointment);
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const formatFecha = (f: string) => {
    if (!f) return '';
    const d = new Date(f + 'T12:00:00');
    return d.toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  if (!employee || !slot) return null;

  // ─── Vista de éxito ───────────────────────────────────────────────────────
  if (confirmed) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f0f4f8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '2rem', width: '100%', maxWidth: '480px', textAlign: 'center' }}>
          <CheckCircle size={48} color="#065f46" style={{ marginBottom: '1rem' }} />
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#065f46', marginBottom: '0.4rem' }}>¡Cita confirmada!</h1>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Tu turno ha sido registrado correctamente. Presentate el día indicado en el área de logística con tu documento.
          </p>

          <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '1rem', marginBottom: '1.5rem', textAlign: 'left' }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <Image src="/logo.png" alt="GSS" width={80} height={28} style={{ objectFit: 'contain' }} />
            </div>
            <p style={{ margin: '0 0 0.25rem', fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>{employee.nombre}</p>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', color: '#64748b' }}>Doc: {employee.documento}</p>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
              <Calendar size={14} color="#29416b" />
              <span style={{ fontSize: '0.83rem', color: '#1e293b', textTransform: 'capitalize' }}>{formatFecha(slot.fecha)}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
              <Clock size={14} color="#29416b" />
              <span style={{ fontSize: '0.83rem', color: '#1e293b' }}>{slot.start_time} – {slot.end_time} hs</span>
            </div>
            <div style={{ borderTop: '1px solid #d1fae5', paddingTop: '0.75rem' }}>
              <p style={{ margin: '0 0 0.4rem', fontSize: '0.75rem', fontWeight: 700, color: '#374151' }}>Prendas solicitadas:</p>
              {orderItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#475569', marginBottom: '0.2rem' }}>
                  <span><Shirt size={11} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />{item.article_type}{item.size ? ` (Talle ${item.size})` : ''}</span>
                  <span style={{ fontWeight: 600 }}>×{item.qty}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => window.print()}
            className="no-print"
            style={{ width: '100%', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.7rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}
          >
            <Printer size={15} /> Imprimir comprobante
          </button>

          <button
            onClick={() => { sessionStorage.clear(); router.push('/logistica/agenda'); }}
            style={{ width: '100%', background: '#29416b', border: 'none', borderRadius: '8px', padding: '0.7rem', fontSize: '0.85rem', fontWeight: 600, color: 'white', cursor: 'pointer' }}
          >
            Finalizar
          </button>
        </div>
      </div>
    );
  }

  // ─── Vista de resumen / confirmación ─────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f4f8' }}>
      <header style={{
        position: 'sticky', top: 0, backgroundColor: '#29416b',
        borderBottom: '3px solid #e04951', padding: '0.8rem 1.25rem',
        display: 'flex', alignItems: 'center', gap: '1rem', zIndex: 50,
      }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
        >
          <ArrowLeft size={14} /> Volver
        </button>
        <div>
          <p style={{ margin: 0, color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>Confirmar Cita</p>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>{employee.nombre}</p>
        </div>
      </header>

      <div style={{ backgroundColor: 'white', padding: '0.75rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.72rem', color: '#94a3b8' }}>
          <span>✓ Identidad</span><span>›</span>
          <span>✓ Prendas</span><span>›</span>
          <span>✓ Turno</span><span>›</span>
          <span style={{ color: '#29416b', fontWeight: 700 }}>④ Confirmación</span>
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>Revisá tu cita antes de confirmar</h2>

        {/* Resumen */}
        <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1.25rem', marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.75rem', fontWeight: 700, fontSize: '0.85rem', color: '#374151', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
            Datos del empleado
          </p>
          <p style={{ margin: '0 0 0.2rem', fontSize: '0.88rem', fontWeight: 600, color: '#1e293b' }}>{employee.nombre}</p>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>Documento: {employee.documento} · Empresa: {employee.empresa || 'GSS'}</p>
        </div>

        <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1.25rem', marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.75rem', fontWeight: 700, fontSize: '0.85rem', color: '#374151', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
            Turno seleccionado
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
            <Calendar size={15} color="#29416b" />
            <span style={{ fontSize: '0.85rem', color: '#1e293b', textTransform: 'capitalize' }}>{formatFecha(slot.fecha)}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Clock size={15} color="#29416b" />
            <span style={{ fontSize: '0.85rem', color: '#1e293b' }}>{slot.start_time} – {slot.end_time} hs</span>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1.25rem', marginBottom: '1.25rem' }}>
          <p style={{ margin: '0 0 0.75rem', fontWeight: 700, fontSize: '0.85rem', color: '#374151', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
            Prendas solicitadas
          </p>
          {orderItems.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: i < orderItems.length - 1 ? '1px solid #f8fafc' : 'none' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Shirt size={14} color="#29416b" />
                <span style={{ fontSize: '0.85rem', color: '#1e293b' }}>{item.article_type}</span>
                {item.size && <span style={{ fontSize: '0.72rem', background: '#f1f5f9', color: '#64748b', borderRadius: '4px', padding: '0.1rem 0.4rem' }}>T: {item.size}</span>}
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#29416b' }}>×{item.qty}</span>
            </div>
          ))}
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
            <AlertCircle size={16} color="#e04951" />
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#7f1d1d' }}>{error}</p>
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={loading}
          style={{
            width: '100%',
            backgroundColor: loading ? '#94a3b8' : '#29416b',
            color: 'white', border: 'none', borderRadius: '8px',
            padding: '0.9rem', fontSize: '0.95rem', fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          }}
        >
          {loading ? 'Confirmando...' : <><CheckCircle size={17} /> Confirmar mi cita</>}
        </button>

        <p style={{ textAlign: 'center', fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.75rem' }}>
          Al confirmar, aceptás presentarte en el horario indicado con tu documento.
        </p>
      </div>
    </div>
  );
}
