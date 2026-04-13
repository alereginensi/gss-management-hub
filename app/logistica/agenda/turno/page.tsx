'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, ArrowLeft, ArrowRight, AlertCircle, Lock } from 'lucide-react';
import type { AgendaEmployee, AgendaTimeSlot } from '@/lib/agenda-types';

const HOLD_TOKEN = () => `hold_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export default function AgendaTurnoPage() {
  const router = useRouter();
  const [employee, setEmployee] = useState<AgendaEmployee | null>(null);
  const [slots, setSlots] = useState<AgendaTimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AgendaTimeSlot | null>(null);
  const [holding, setHolding] = useState(false);
  const [holdError, setHoldError] = useState<string | null>(null);
  const [holdCountdown, setHoldCountdown] = useState(0);
  const holdTokenRef = useRef<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const emp = sessionStorage.getItem('agenda_employee');
    const order = sessionStorage.getItem('agenda_order');
    if (!emp || !order) { router.replace('/logistica/agenda'); return; }
    setEmployee(JSON.parse(emp));
    fetchSlots();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/logistica/agenda/public/slots');
      if (res.ok) {
        const data = await res.json();
        setSlots(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const clearCountdown = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const releaseCurrentHold = useCallback(async () => {
    if (!selected || !holdTokenRef.current) return;
    clearCountdown();
    await fetch(`/api/logistica/agenda/public/slots/${selected.id}/hold`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hold_token: holdTokenRef.current }),
    });
    holdTokenRef.current = null;
    setHoldCountdown(0);
  }, [selected]);

  const handleSelectSlot = async (slot: AgendaTimeSlot) => {
    // Liberar hold anterior si había
    if (selected && holdTokenRef.current) {
      await releaseCurrentHold();
    }

    setHoldError(null);
    setHolding(true);
    setSelected(slot);

    const token = HOLD_TOKEN();
    holdTokenRef.current = token;

    const res = await fetch(`/api/logistica/agenda/public/slots/${slot.id}/hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hold_token: token }),
    });
    const data = await res.json();
    setHolding(false);

    if (!res.ok) {
      setHoldError(data.error || 'No se pudo reservar el turno');
      setSelected(null);
      holdTokenRef.current = null;
      fetchSlots(); // Refrescar disponibilidad
      return;
    }

    // Iniciar countdown del hold
    let secs = data.expires_in_seconds || 60;
    setHoldCountdown(secs);
    clearCountdown();
    countdownRef.current = setInterval(() => {
      secs -= 1;
      setHoldCountdown(secs);
      if (secs <= 0) {
        clearCountdown();
        setSelected(null);
        holdTokenRef.current = null;
        setHoldCountdown(0);
        setHoldError('El tiempo para confirmar el turno expiró. Seleccioná otro.');
        fetchSlots();
      }
    }, 1000);
  };

  const handleContinue = () => {
    if (!selected || !holdTokenRef.current) return;
    clearCountdown();
    sessionStorage.setItem('agenda_slot', JSON.stringify(selected));
    sessionStorage.setItem('agenda_hold_token', holdTokenRef.current);
    router.push('/logistica/agenda/confirmacion');
  };

  // Cleanup al desmontar
  useEffect(() => () => clearCountdown(), []);

  // Agrupar slots por fecha
  const grouped: Record<string, AgendaTimeSlot[]> = {};
  slots.forEach(s => {
    if (!grouped[s.fecha]) grouped[s.fecha] = [];
    grouped[s.fecha].push(s);
  });

  const formatFecha = (f: string) => {
    const d = new Date(f + 'T12:00:00');
    return d.toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  if (!employee) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f4f8' }}>
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, backgroundColor: '#29416b',
        borderBottom: '3px solid #e04951', padding: '0.8rem 1.25rem',
        display: 'flex', alignItems: 'center', gap: '1rem', zIndex: 50,
      }}>
        <button
          onClick={async () => { await releaseCurrentHold(); router.back(); }}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
        >
          <ArrowLeft size={14} /> Volver
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>Elegir Turno</p>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>{employee.nombre}</p>
        </div>
        {selected && holdCountdown > 0 && (
          <div style={{
            background: holdCountdown < 20 ? '#e04951' : 'rgba(255,255,255,0.2)',
            borderRadius: '999px', padding: '0.3rem 0.8rem',
            color: 'white', fontSize: '0.78rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: '0.3rem',
          }}>
            <Lock size={12} /> {holdCountdown}s
          </div>
        )}
      </header>

      {/* Pasos */}
      <div style={{ backgroundColor: 'white', padding: '0.75rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.72rem', color: '#94a3b8' }}>
          <span>✓ Identidad</span><span>›</span>
          <span>✓ Prendas</span><span>›</span>
          <span style={{ color: '#29416b', fontWeight: 700 }}>③ Turno</span><span>›</span>
          <span>④ Confirmación</span>
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Calendar size={18} color="#29416b" />
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Turnos disponibles</h2>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>
          Seleccioná un turno. Tenés {60} segundos para confirmar una vez elegido.
        </p>

        {holdError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
            <AlertCircle size={16} color="#e04951" />
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#7f1d1d' }}>{holdError}</p>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Cargando turnos...</div>
        ) : Object.keys(grouped).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
            <Calendar size={36} color="#cbd5e1" style={{ marginBottom: '0.5rem' }} />
            <p style={{ fontSize: '0.85rem' }}>No hay turnos disponibles por el momento.<br />Consultá con logística.</p>
          </div>
        ) : (
          Object.entries(grouped).map(([fecha, daySlots]) => (
            <div key={fecha} style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'capitalize', marginBottom: '0.5rem' }}>
                {formatFecha(fecha)}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem' }}>
                {daySlots.map(slot => {
                  const isSelected = selected?.id === slot.id;
                  return (
                    <button
                      key={slot.id}
                      onClick={() => { if (!holding) handleSelectSlot(slot); }}
                      disabled={holding}
                      style={{
                        border: isSelected ? '2px solid #29416b' : '1px solid #e2e8f0',
                        background: isSelected ? '#eff6ff' : 'white',
                        borderRadius: '8px', padding: '0.7rem',
                        cursor: holding ? 'wait' : 'pointer',
                        textAlign: 'left',
                        transition: 'all 200ms',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: isSelected ? '#29416b' : '#374151' }}>
                        <Clock size={13} />
                        <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{slot.start_time}</span>
                      </div>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.7rem', color: '#94a3b8' }}>
                        hasta {slot.end_time}
                      </p>
                      {slot.available !== undefined && slot.available <= 2 && (
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.68rem', color: '#f59e0b', fontWeight: 600 }}>
                          ¡{slot.available} lugar{slot.available !== 1 ? 'es' : ''} disponible{slot.available !== 1 ? 's' : ''}!
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {/* Hold info */}
        {selected && holdCountdown > 0 && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#1e40af', fontWeight: 600 }}>
              <Lock size={13} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
              Turno reservado temporalmente por {holdCountdown} segundos
            </p>
          </div>
        )}

        <button
          onClick={handleContinue}
          disabled={!selected || holdCountdown === 0 || holding}
          style={{
            marginTop: '0.5rem',
            width: '100%',
            backgroundColor: (!selected || holdCountdown === 0 || holding) ? '#94a3b8' : '#29416b',
            color: 'white', border: 'none', borderRadius: '8px',
            padding: '0.85rem', fontSize: '0.9rem', fontWeight: 600,
            cursor: (!selected || holdCountdown === 0 || holding) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          }}
        >
          Confirmar selección <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
