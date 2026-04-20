'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, ArrowLeft, Check } from 'lucide-react';
import type { AgendaEmployee, AgendaTimeSlot } from '@/lib/agenda-types';

const HOLD_TOKEN = () => `hold_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

function StepIndicator({ current }: { current: 1 | 2 | 3 | 4 }) {
  const steps = [1, 2, 3, 4];
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: '1.5rem' }}>
      {steps.map((step, i) => {
        const done = step < current;
        const active = step === current;
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '0.9rem',
              background: done ? '#22c55e' : active ? '#29416b' : '#e2e8f0',
              color: done || active ? 'white' : '#94a3b8',
              flexShrink: 0,
            }}>
              {done ? <Check size={16} strokeWidth={3} /> : step}
            </div>
            {i < steps.length - 1 && (
              <div style={{
                width: '32px', height: '2px',
                background: step < current ? '#22c55e' : '#e2e8f0',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

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
      if (res.ok) setSlots(await res.json());
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
    if (holding) return;
    if (selected && holdTokenRef.current) await releaseCurrentHold();

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
      setHoldError(data.error || 'No se pudo reservar el turno. Intentá de nuevo.');
      setSelected(null);
      holdTokenRef.current = null;
      fetchSlots();
      return;
    }

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
        setHoldError('Tiempo agotado. Seleccione otro horario.');
        fetchSlots();
      }
    }, 1000);
  };

  const handleConfirm = () => {
    if (!selected || !holdTokenRef.current) return;
    clearCountdown();
    sessionStorage.setItem('agenda_slot', JSON.stringify(selected));
    sessionStorage.setItem('agenda_hold_token', holdTokenRef.current);
    router.push('/logistica/agenda/confirmacion');
  };

  useEffect(() => () => clearCountdown(), []);

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

  const canConfirm = !!selected && holdCountdown > 0 && !holding;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <style>{`
        .turno-actions-bar {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          background: white;
          border-top: 1px solid #e2e8f0;
          padding: 0.75rem 1rem;
          z-index: 100;
        }
        .turno-actions-inner {
          max-width: 480px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        @media (min-width: 640px) {
          .turno-actions-bar {
            position: static;
            background: transparent;
            border-top: none;
            padding: 0;
            margin-top: 1rem;
          }
          .turno-actions-inner {
            flex-direction: row;
            align-items: center;
          }
        }
      `}</style>
      <div style={{ width: '100%', maxWidth: '480px', padding: '1.5rem 1rem 9rem' }}>

        {/* Título de la app */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.2rem' }}>
            Agenda de Uniformes
          </h1>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
            Seleccione su horario para el retiro de uniformes
          </p>
        </div>

        {/* Step indicator */}
        <StepIndicator current={3} />

        {/* Card principal */}
        <div style={{
          background: 'white', borderRadius: '16px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          padding: '1.5rem 1.25rem',
        }}>
          {/* Ícono + título */}
          <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <div style={{
              width: '52px', height: '52px', background: '#f1f5f9',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 0.75rem',
            }}>
              <Clock size={24} color="#64748b" />
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.25rem' }}>
              Seleccione un horario
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
              Elija el día y la hora que más le convenga
            </p>
          </div>

          {/* Banner de error / tiempo agotado */}
          {holdError && (
            <div style={{
              background: '#fff7ed', border: '1px solid #fed7aa',
              borderRadius: '8px', padding: '0.65rem 1rem',
              marginBottom: '1rem', fontSize: '0.83rem', color: '#c2410c', fontWeight: 500,
            }}>
              {holdError}
            </div>
          )}

          {/* Slots */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.88rem' }}>
              Cargando horarios...
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              <Calendar size={32} color="#cbd5e1" style={{ marginBottom: '0.5rem' }} />
              <p style={{ fontSize: '0.85rem', margin: 0 }}>
                No hay turnos disponibles por el momento.<br />Consultá con logística.
              </p>
            </div>
          ) : (
            Object.entries(grouped).map(([fecha, daySlots]) => (
              <div key={fecha} style={{ marginBottom: '1.5rem' }}>
                {/* Encabezado de día */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
                  <Calendar size={14} color="#3b82f6" />
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'lowercase' }}>
                    {formatFecha(fecha)}
                  </span>
                </div>

                {/* Grid 3 columnas */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {daySlots.map(slot => {
                    const isSel = selected?.id === slot.id;
                    const places = slot.available ?? ((slot.capacity || 1) - slot.current_bookings);
                    return (
                      <button
                        key={slot.id}
                        onClick={() => handleSelectSlot(slot)}
                        disabled={holding}
                        style={{
                          flex: '0 0 calc(33.333% - 0.34rem)',
                          boxSizing: 'border-box',
                          borderRadius: '10px',
                          padding: '0.65rem 0.4rem',
                          textAlign: 'center',
                          cursor: holding ? 'wait' : 'pointer',
                          transition: 'all 150ms',
                          background: isSel ? '#29416b' : 'white',
                          border: isSel ? '2px solid #29416b' : '1px solid #e5e7eb',
                          boxShadow: isSel ? '0 2px 8px rgba(41,65,107,0.2)' : 'none',
                        }}
                      >
                        <p style={{
                          margin: '0 0 0.1rem', fontWeight: 700, fontSize: '1rem',
                          color: isSel ? 'white' : '#1e3a5f',
                        }}>
                          {slot.start_time}
                        </p>
                        <p style={{
                          margin: '0 0 0.2rem', fontSize: '0.68rem',
                          color: isSel ? 'rgba(255,255,255,0.7)' : '#9ca3af',
                        }}>
                          a {slot.end_time}
                        </p>
                        <p style={{
                          margin: 0, fontSize: '0.7rem', fontWeight: 600,
                          color: isSel ? '#fbbf24' : '#f59e0b',
                        }}>
                          {places} lugar{places !== 1 ? 'es' : ''}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}

        </div>

      </div>

      {/* Barra de acciones — sticky en mobile, inline en desktop */}
      <div className="turno-actions-bar">
        <div className="turno-actions-inner">
          {/* Timer (solo cuando hay hold activo) */}
          {selected && holdCountdown > 0 && (
            <div style={{
              flex: 1, background: '#fff7ed', border: '1px solid #fed7aa',
              borderRadius: '8px', padding: '0.55rem 0.85rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '0.8rem', color: '#92400e', fontWeight: 500 }}>
                Turno reservado para vos
              </span>
              <span style={{
                fontSize: '1rem', fontWeight: 800,
                color: holdCountdown <= 15 ? '#e04951' : '#d97706',
              }}>
                {holdCountdown}s
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button
              onClick={async () => { await releaseCurrentHold(); router.back(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.8rem 1rem', borderRadius: '10px',
                border: '1px solid #d1d5db', background: 'white',
                color: '#374151', fontSize: '0.88rem', fontWeight: 600,
                cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              <ArrowLeft size={16} /> Atrás
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              style={{
                flex: 1, padding: '0.8rem', borderRadius: '10px', border: 'none',
                background: canConfirm ? '#29416b' : '#94a3b8',
                color: 'white', fontSize: '0.9rem', fontWeight: 700,
                cursor: canConfirm ? 'pointer' : 'not-allowed',
                transition: 'background 200ms',
              }}
            >
              {holding ? 'Reservando...' : canConfirm ? 'Confirmar Cita' : selected ? 'Tiempo agotado' : 'Seleccioná un turno'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
