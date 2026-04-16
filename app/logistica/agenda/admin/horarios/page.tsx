'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Calendar, Trash2, X, Zap, Move, RotateCcw } from 'lucide-react';
import { useTicketContext, canAccessAgenda } from '@/app/context/TicketContext';
import LogoutExpandButton from '@/app/components/LogoutExpandButton';
import type { AgendaTimeSlot } from '@/lib/agenda-types';

// ─── Tipos locales ────────────────────────────────────────────────────────────

type Appointment = {
  id: number;
  status: string;
  employee_id: number;
  employee_nombre: string;
};

type SlotWithAppt = AgendaTimeSlot & { appointment: Appointment | null };

// ─── Constantes ───────────────────────────────────────────────────────────────

const DAYS_OF_WEEK = [
  { value: 0, label: 'Dom' }, { value: 1, label: 'Lun' }, { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' }, { value: 4, label: 'Jue' }, { value: 5, label: 'Vie' }, { value: 6, label: 'Sáb' },
];

const HOUR_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    HOUR_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

const today = new Date().toISOString().split('T')[0];
const nextMonthDate = new Date();
nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);

const APPT_STATUS_LABEL: Record<string, string> = {
  confirmada: 'Confirmada',
  en_proceso: 'En proceso',
  completada: 'Completada',
  cancelada: 'Cancelada',
  ausente: 'No asistió',
  reprogramada: 'Reprogramada',
};

const APPT_STATUS_STYLE: Record<string, React.CSSProperties> = {
  confirmada:   { background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' },
  en_proceso:   { background: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe' },
  completada:   { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' },
  cancelada:    { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' },
  ausente:      { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' },
  reprogramada: { background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' },
};

const selectStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px',
  padding: '0.45rem 0.7rem', fontSize: '0.82rem', boxSizing: 'border-box', background: 'white',
};

// ─── Sub-componente: formulario de generación ─────────────────────────────────

type GenFormState = {
  year: number; month: number; days_of_week: number[];
  start_hour: string; end_hour: string; num_slots: number;
  has_break: boolean; break_start: string; break_end: string; capacity: number;
};

function GenFormFields({ genForm, setGenForm, toggleDayOfWeek }: {
  genForm: GenFormState;
  setGenForm: React.Dispatch<React.SetStateAction<GenFormState>>;
  toggleDayOfWeek: (d: number) => void;
}) {
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const currentYear = new Date().getFullYear();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Mes</label>
          <select value={genForm.month} onChange={e => setGenForm(f => ({ ...f, month: parseInt(e.target.value, 10) }))} style={selectStyle}>
            {monthNames.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Año</label>
          <select value={genForm.year} onChange={e => setGenForm(f => ({ ...f, year: parseInt(e.target.value, 10) }))} style={selectStyle}>
            {[currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>Días de la semana</label>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {DAYS_OF_WEEK.map(d => (
            <button key={d.value} type="button" onClick={() => toggleDayOfWeek(d.value)}
              style={{ padding: '0.3rem 0.65rem', borderRadius: '4px', border: '1px solid', fontSize: '0.78rem', cursor: 'pointer',
                background: genForm.days_of_week.includes(d.value) ? '#1e40af' : 'white',
                color: genForm.days_of_week.includes(d.value) ? 'white' : '#374151',
                borderColor: genForm.days_of_week.includes(d.value) ? '#1e40af' : '#e2e8f0' }}>
              {d.label}
            </button>
          ))}
        </div>
        <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0.3rem 0 0' }}>
          Se generan todos los {DAYS_OF_WEEK.filter(d => genForm.days_of_week.includes(d.value)).map(d => d.label).join(' y ')} del mes.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Hora inicio</label>
          <select value={genForm.start_hour} onChange={e => setGenForm(f => ({ ...f, start_hour: e.target.value }))} style={selectStyle}>
            {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Hora fin</label>
          <select value={genForm.end_hour} onChange={e => setGenForm(f => ({ ...f, end_hour: e.target.value }))} style={selectStyle}>
            {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Cantidad de turnos</label>
          <input type="number" min={1} max={200} value={genForm.num_slots}
            onChange={e => setGenForm(f => ({ ...f, num_slots: parseInt(e.target.value, 10) || 1 }))}
            style={{ ...selectStyle }} />
        </div>
      </div>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem', background: '#f8fafc' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: genForm.has_break ? '0.75rem' : 0 }}>
          <input type="checkbox" checked={genForm.has_break} onChange={e => setGenForm(f => ({ ...f, has_break: e.target.checked }))} style={{ width: '15px', height: '15px', cursor: 'pointer' }} />
          Incluir descanso
        </label>
        {genForm.has_break && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Inicio descanso</label>
              <select value={genForm.break_start} onChange={e => setGenForm(f => ({ ...f, break_start: e.target.value }))} style={selectStyle}>
                {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Fin descanso</label>
              <select value={genForm.break_end} onChange={e => setGenForm(f => ({ ...f, break_end: e.target.value }))} style={selectStyle}>
                {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      <div style={{ maxWidth: '160px' }}>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Capacidad por turno</label>
        <input type="number" min={1} value={genForm.capacity}
          onChange={e => setGenForm(f => ({ ...f, capacity: parseInt(e.target.value, 10) || 1 }))}
          style={{ ...selectStyle }} />
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function HorariosPage() {
  const { currentUser, isAuthenticated, loading, logout, isMobile } = useTicketContext();
  const router = useRouter();

  // Slots
  const [slots, setSlots] = useState<SlotWithAppt[]>([]);
  const [fetching, setFetching] = useState(true);
  const [filterFrom, setFilterFrom] = useState(today);
  const [filterTo, setFilterTo] = useState('');

  // Modales generales
  const [showManualModal, setShowManualModal] = useState(false);
  const [showGenModal, setShowGenModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [genResult, setGenResult] = useState<{ created: number; skipped: number } | null>(null);

  // Formulario slot manual
  const [manualForm, setManualForm] = useState({ fecha: today, start_time: '09:00', end_time: '09:30', capacity: 1 });

  // Formulario generación
  const [genForm, setGenForm] = useState<GenFormState>({
    year: nextMonthDate.getFullYear(),
    month: nextMonthDate.getMonth() + 1,
    days_of_week: [2, 4],
    start_hour: '09:00',
    end_hour: '17:00',
    num_slots: 20,
    has_break: true,
    break_start: '12:00',
    break_end: '13:00',
    capacity: 1,
  });

  // Modal mover cita
  const [movingAppt, setMovingAppt] = useState<{ apptId: number; currentSlotId: number; currentFecha: string } | null>(null);
  const [moveTargetDate, setMoveTargetDate] = useState('');
  const [moveSlots, setMoveSlots] = useState<SlotWithAppt[]>([]);
  const [moveTargetSlotId, setMoveTargetSlotId] = useState<number | null>(null);
  const [moveFetching, setMoveFetching] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [showCreateSlotInMove, setShowCreateSlotInMove] = useState(false);
  const [newSlotInMove, setNewSlotInMove] = useState({ start_time: '09:00', end_time: '09:30', capacity: 1 });

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (currentUser && !canAccessAgenda(currentUser)) { router.push('/'); return; }
  }, [loading, isAuthenticated, currentUser, router]);

  const fetchSlots = useCallback(async () => {
    setFetching(true);
    try {
      const p = new URLSearchParams({ limit: '500' });
      if (filterFrom) p.set('from', filterFrom);
      if (filterTo) p.set('to', filterTo);
      const res = await fetch(`/api/logistica/agenda/slots?${p}`);
      const data = await res.json();
      setSlots(data.slots || []);
    } finally {
      setFetching(false);
    }
  }, [filterFrom, filterTo]);

  useEffect(() => {
    if (!isAuthenticated || loading) return;
    fetchSlots();
  }, [fetchSlots, isAuthenticated, loading]);

  // ── Eliminar slot individual ──────────────────────────────────────────────

  const handleDeleteSlot = async (id: number) => {
    if (!confirm('¿Eliminar este turno?')) return;
    const res = await fetch(`/api/logistica/agenda/slots/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || 'Error al eliminar');
      return;
    }
    fetchSlots();
  };

  // ── Eliminar día completo ─────────────────────────────────────────────────

  const handleDeleteDay = async (fecha: string) => {
    if (!confirm(`¿Eliminar todos los turnos del ${formatFecha(fecha)}?\nLos que tengan citas activas no se eliminarán.`)) return;
    const res = await fetch(`/api/logistica/agenda/slots?fecha=${fecha}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Error'); return; }
    if (data.skipped > 0) {
      alert(`Eliminados: ${data.deleted} | Con citas activas (no eliminados): ${data.skipped}`);
    }
    fetchSlots();
  };

  // ── Restaurar cita (→ confirmada) ─────────────────────────────────────────

  const handleRestore = async (apptId: number) => {
    if (!confirm('¿Restaurar esta cita a "Confirmada"?')) return;
    const res = await fetch(`/api/logistica/agenda/appointments/${apptId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmada' }),
    });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || 'Error al restaurar');
      return;
    }
    fetchSlots();
  };

  // ── Mover cita ────────────────────────────────────────────────────────────

  const openMoveModal = (appt: Appointment, currentSlotId: number, fecha: string) => {
    setMovingAppt({ apptId: appt.id, currentSlotId, currentFecha: fecha });
    setMoveTargetDate(fecha);
    setMoveSlots([]);
    setMoveTargetSlotId(null);
    setMoveError(null);
    setShowCreateSlotInMove(false);
  };

  const loadMoveSlotsForDate = useCallback(async (fecha: string) => {
    if (!fecha) return;
    setMoveFetching(true);
    try {
      const res = await fetch(`/api/logistica/agenda/slots?from=${fecha}&to=${fecha}&limit=100`);
      const data = await res.json();
      setMoveSlots(data.slots || []);
    } finally {
      setMoveFetching(false);
    }
  }, []);

  useEffect(() => {
    if (movingAppt && moveTargetDate) loadMoveSlotsForDate(moveTargetDate);
  }, [moveTargetDate, movingAppt, loadMoveSlotsForDate]);

  const handleConfirmMove = async () => {
    if (!movingAppt || !moveTargetSlotId) return;
    setSaving(true); setMoveError(null);
    try {
      const res = await fetch(`/api/logistica/agenda/appointments/${movingAppt.apptId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_slot_id: moveTargetSlotId }),
      });
      const data = await res.json();
      if (!res.ok) { setMoveError(data.error || 'Error'); return; }
      setMovingAppt(null);
      fetchSlots();
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSlotInMove = async () => {
    if (!movingAppt || !moveTargetDate) return;
    setSaving(true); setMoveError(null);
    try {
      const res = await fetch('/api/logistica/agenda/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha: moveTargetDate, ...newSlotInMove }),
      });
      const data = await res.json();
      if (!res.ok) { setMoveError(data.error || 'Error al crear slot'); return; }
      // Mover a ese nuevo slot
      const moveRes = await fetch(`/api/logistica/agenda/appointments/${movingAppt.apptId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_slot_id: data.id }),
      });
      const moveData = await moveRes.json();
      if (!moveRes.ok) { setMoveError(moveData.error || 'Error al mover'); return; }
      setMovingAppt(null);
      fetchSlots();
    } finally {
      setSaving(false);
    }
  };

  // ── Crear slot manual ─────────────────────────────────────────────────────

  const handleSaveManual = async () => {
    setSaving(true); setSaveError(null);
    try {
      const res = await fetch('/api/logistica/agenda/slots', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(manualForm),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error || 'Error al guardar'); return; }
      setShowManualModal(false);
      fetchSlots();
    } finally {
      setSaving(false);
    }
  };

  // ── Auto-generar ──────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setSaving(true); setSaveError(null); setGenResult(null);
    try {
      const res = await fetch('/api/logistica/agenda/slots/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(genForm),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error || 'Error al generar'); return; }
      setGenResult({ created: data.created, skipped: data.skipped });
      fetchSlots();
    } finally {
      setSaving(false);
    }
  };

  const toggleDayOfWeek = (d: number) => {
    setGenForm(f => ({
      ...f,
      days_of_week: f.days_of_week.includes(d) ? f.days_of_week.filter(x => x !== d) : [...f.days_of_week, d],
    }));
  };

  // ── Agrupar slots por fecha ───────────────────────────────────────────────

  const slotsByDate: Record<string, SlotWithAppt[]> = {};
  for (const s of slots) {
    if (!slotsByDate[s.fecha]) slotsByDate[s.fecha] = [];
    slotsByDate[s.fecha].push(s);
  }

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
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>Horarios y Turnos</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {!isMobile && <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem' }}>{currentUser.name}</span>}
          <LogoutExpandButton onClick={() => { logout(); router.push('/login'); }} />
        </div>
      </header>

      <main style={{ marginTop: '56px', padding: isMobile ? '1.25rem 1rem' : '1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h1 style={{ margin: 0, fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: 700, color: '#0f172a' }}>
              <Calendar size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />Horarios ({slots.length} turnos)
            </h1>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => { setShowGenModal(true); setGenResult(null); setSaveError(null); }} className="btn btn-secondary" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Zap size={14} /> Auto-generar
              </button>
              <button onClick={() => { setShowManualModal(true); setSaveError(null); }} className="btn btn-primary" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Plus size={14} /> Turno manual
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className="card" style={{ padding: '0.85rem 1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Desde</label>
                <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Hasta</label>
                <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem' }} />
              </div>
              <button onClick={fetchSlots} className="btn btn-secondary" style={{ alignSelf: 'flex-end', fontSize: '0.8rem' }}>Filtrar</button>
            </div>
          </div>

          {/* Lista por día */}
          {fetching ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Cargando turnos...</div>
          ) : Object.keys(slotsByDate).length === 0 ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No hay turnos en este rango. Usa "Auto-generar" para crear el mes.</div>
          ) : Object.entries(slotsByDate).map(([fecha, daySlots]) => (
            <DayGroup
              key={fecha}
              fecha={fecha}
              slots={daySlots}
              isMobile={isMobile}
              onDeleteSlot={handleDeleteSlot}
              onDeleteDay={handleDeleteDay}
              onRestore={handleRestore}
              onMove={openMoveModal}
            />
          ))}
        </div>
      </main>

      {/* ── Modal: slot manual ────────────────────────────────────────────── */}
      {showManualModal && (
        <Modal title="Nuevo turno manual" onClose={() => setShowManualModal(false)} width={380}>
          {saveError && <ErrorBox msg={saveError} />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {([['Fecha','fecha','date'],['Hora inicio','start_time','time'],['Hora fin','end_time','time']] as [string,string,string][]).map(([label, key, type]) => (
              <div key={key}>
                <label style={labelStyle}>{label}</label>
                <input type={type} value={(manualForm as any)[key]} onChange={e => setManualForm(f => ({ ...f, [key]: e.target.value }))} style={{ ...selectStyle }} />
              </div>
            ))}
            <div>
              <label style={labelStyle}>Capacidad</label>
              <input type="number" min={1} value={manualForm.capacity} onChange={e => setManualForm(f => ({ ...f, capacity: parseInt(e.target.value,10)||1 }))} style={{ ...selectStyle }} />
            </div>
          </div>
          <ModalFooter>
            <button onClick={() => setShowManualModal(false)} className="btn btn-secondary" style={{ fontSize: '0.82rem' }}>Cancelar</button>
            <button onClick={handleSaveManual} disabled={saving} className="btn btn-primary" style={{ fontSize: '0.82rem' }}>{saving?'Creando...':'Crear turno'}</button>
          </ModalFooter>
        </Modal>
      )}

      {/* ── Modal: auto-generar ───────────────────────────────────────────── */}
      {showGenModal && (
        <Modal title="Auto-generar turnos" onClose={() => setShowGenModal(false)} width={500}>
          {saveError && <ErrorBox msg={saveError} />}
          {genResult && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.6rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#166534' }}>
              Creados: <strong>{genResult.created}</strong> | Omitidos: <strong>{genResult.skipped}</strong>
            </div>
          )}
          <GenFormFields genForm={genForm} setGenForm={setGenForm} toggleDayOfWeek={toggleDayOfWeek} />
          <ModalFooter>
            <button onClick={() => setShowGenModal(false)} className="btn btn-secondary" style={{ fontSize: '0.82rem' }}>Cerrar</button>
            <button onClick={handleGenerate} disabled={saving} className="btn btn-primary" style={{ fontSize: '0.82rem' }}>{saving?'Generando...':'Generar turnos'}</button>
          </ModalFooter>
        </Modal>
      )}

      {/* ── Modal: mover cita ─────────────────────────────────────────────── */}
      {movingAppt && (
        <Modal title="Mover cita a otro turno" onClose={() => setMovingAppt(null)} width={520}>
          {moveError && <ErrorBox msg={moveError} />}

          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Fecha destino</label>
            <input type="date" value={moveTargetDate} onChange={e => { setMoveTargetDate(e.target.value); setMoveTargetSlotId(null); setShowCreateSlotInMove(false); }}
              style={{ ...selectStyle }} />
          </div>

          {/* Lista de turnos disponibles */}
          {moveFetching ? (
            <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Cargando turnos...</p>
          ) : moveSlots.length === 0 && moveTargetDate ? (
            <p style={{ fontSize: '0.82rem', color: '#64748b' }}>No hay turnos para esa fecha.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {moveSlots.map(s => {
                const isFull = s.current_bookings >= s.capacity;
                const isCurrent = s.id === movingAppt.currentSlotId;
                const isSelected = s.id === moveTargetSlotId;
                const disabled = isFull || isCurrent;
                return (
                  <button key={s.id} type="button" disabled={disabled}
                    onClick={() => { setMoveTargetSlotId(s.id); setShowCreateSlotInMove(false); }}
                    style={{
                      padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.8rem', cursor: disabled ? 'not-allowed' : 'pointer',
                      border: '1px solid', fontWeight: isSelected ? 700 : 400,
                      background: isSelected ? '#1e40af' : isCurrent ? '#f1f5f9' : isFull ? '#f8fafc' : 'white',
                      color: isSelected ? 'white' : isCurrent ? '#94a3b8' : isFull ? '#cbd5e1' : '#1e293b',
                      borderColor: isSelected ? '#1e40af' : isCurrent ? '#e2e8f0' : isFull ? '#e2e8f0' : '#cbd5e1',
                      textDecoration: isCurrent ? 'line-through' : 'none',
                    }}>
                    {s.start_time}–{s.end_time}
                    <span style={{ fontSize: '0.7rem', marginLeft: '0.3rem', opacity: 0.7 }}>{s.current_bookings}/{s.capacity}</span>
                    {isCurrent && <span style={{ fontSize: '0.68rem', marginLeft: '0.3rem' }}>(actual)</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Opción crear nuevo slot en esa fecha */}
          <button type="button" onClick={() => { setShowCreateSlotInMove(v => !v); setMoveTargetSlotId(null); }}
            style={{ fontSize: '0.78rem', color: '#1d4ed8', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', marginBottom: showCreateSlotInMove ? '0.75rem' : 0 }}>
            {showCreateSlotInMove ? '↑ Cancelar creación' : '+ Crear nuevo turno en esta fecha'}
          </button>

          {showCreateSlotInMove && (
            <div style={{ marginTop: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem', background: '#f8fafc', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {([['Hora inicio','start_time','time'],['Hora fin','end_time','time']] as [string,string,string][]).map(([label, key, type]) => (
                <div key={key} style={{ flex: 1, minWidth: '120px' }}>
                  <label style={labelStyle}>{label}</label>
                  <input type={type} value={(newSlotInMove as any)[key]} onChange={e => setNewSlotInMove(f => ({ ...f, [key]: e.target.value }))} style={{ ...selectStyle }} />
                </div>
              ))}
              <div style={{ flex: 1, minWidth: '80px' }}>
                <label style={labelStyle}>Capacidad</label>
                <input type="number" min={1} value={newSlotInMove.capacity} onChange={e => setNewSlotInMove(f => ({ ...f, capacity: parseInt(e.target.value,10)||1 }))} style={{ ...selectStyle }} />
              </div>
            </div>
          )}

          <ModalFooter>
            <button onClick={() => setMovingAppt(null)} className="btn btn-secondary" style={{ fontSize: '0.82rem' }}>Cancelar</button>
            {showCreateSlotInMove ? (
              <button onClick={handleCreateSlotInMove} disabled={saving} className="btn btn-primary" style={{ fontSize: '0.82rem' }}>{saving?'Creando y moviendo...':'Crear turno y mover'}</button>
            ) : (
              <button onClick={handleConfirmMove} disabled={saving || !moveTargetSlotId} className="btn btn-primary" style={{ fontSize: '0.82rem' }}>{saving?'Moviendo...':'Confirmar movimiento'}</button>
            )}
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' };

function formatFecha(fecha: string, isMobile?: boolean) {
  const options: Intl.DateTimeFormatOptions = isMobile 
    ? { weekday: 'short', day: '2-digit', month: 'short' }
    : { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-UY', options);
}

function Modal({ title, onClose, children, width = 460 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div className="card" style={{ width: `${width}px`, maxWidth: '95vw', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>{children}</div>;
}

function ErrorBox({ msg }: { msg: string }) {
  return <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.6rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#7f1d1d' }}>{msg}</div>;
}

function DayGroup({ fecha, slots, isMobile, onDeleteSlot, onDeleteDay, onRestore, onMove }: {
  fecha: string;
  slots: SlotWithAppt[];
  isMobile: boolean;
  onDeleteSlot: (id: number) => void;
  onDeleteDay: (fecha: string) => void;
  onRestore: (apptId: number) => void;
  onMove: (appt: Appointment, slotId: number, fecha: string) => void;
}) {
  const cols = isMobile ? 2 : 5;

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {/* Cabecera del día */}
      <div style={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', 
        alignItems: isMobile ? 'flex-start' : 'center', 
        marginBottom: '0.6rem',
        gap: '0.4rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', minWidth: 0 }}>
          <Calendar size={14} style={{ color: '#1d4ed8', flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: isMobile ? '0.82rem' : '0.92rem', color: '#1e293b', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
            {formatFecha(fecha, isMobile)}
          </span>
          <span style={{ fontSize: '0.68rem', color: '#64748b', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.1rem 0.4rem', whiteSpace: 'nowrap' }}>
            {slots.length} turnos
          </span>
        </div>
        <button onClick={() => onDeleteDay(fecha)}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.2rem', 
            fontSize: '0.7rem', 
            color: '#ef4444', 
            background: 'none', 
            border: '1px solid #fecaca', 
            borderRadius: '6px', 
            padding: '0.2rem 0.5rem', 
            cursor: 'pointer',
            alignSelf: isMobile ? 'flex-end' : 'center'
          }}>
          <Trash2 size={11} /> Eliminar día
        </button>
      </div>

      {/* Grid de cards */}
      <div className="grid-no-stack" style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '0.5rem' }}>
        {slots.map(slot => (
          <SlotCard key={slot.id} slot={slot} fecha={fecha} isMobile={isMobile} onDeleteSlot={onDeleteSlot} onRestore={onRestore} onMove={onMove} />
        ))}
      </div>
    </div>
  );
}

function SlotCard({ slot, fecha, isMobile, onDeleteSlot, onRestore, onMove }: {
  slot: SlotWithAppt;
  fecha: string;
  isMobile: boolean;
  onDeleteSlot: (id: number) => void;
  onRestore: (apptId: number) => void;
  onMove: (appt: Appointment, slotId: number, fecha: string) => void;
}) {
  const appt = slot.appointment;
  const apptStatus = appt?.status ?? null;
  const isConfirmed = apptStatus === 'confirmada';
  const isRestorable = apptStatus && ['ausente', 'cancelada', 'reprogramada'].includes(apptStatus);
  const isCancelledSlot = slot.estado === 'cancelado';

  return (
    <div style={{
      borderRadius: '8px', border: '1px solid',
      borderColor: isCancelledSlot ? '#fecaca' : appt ? '#bfdbfe' : '#e2e8f0',
      background: isCancelledSlot ? '#fff5f5' : appt ? '#f0f7ff' : 'white',
      padding: isMobile ? '0.5rem' : '0.65rem 0.75rem',
      display: 'flex', flexDirection: 'column', gap: '0.35rem',
      minWidth: 0, overflow: 'hidden'
    }}>
      {/* Hora */}
      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>
        {slot.start_time} – {slot.end_time}
      </div>

      {/* Empleado */}
      {appt && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: '#374151', minWidth: 0 }}>
          <span style={{ opacity: 0.6, fontSize: '0.65rem', flexShrink: 0 }}>👤</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={appt.employee_nombre}>
            {appt.employee_nombre}
          </span>
        </div>
      )}

      {/* Badge de cita */}
      {apptStatus && (
        <div>
          <span style={{
            fontSize: '0.68rem', fontWeight: 700, borderRadius: '4px', padding: '0.1rem 0.45rem',
            ...(APPT_STATUS_STYLE[apptStatus] ?? {}),
          }}>
            {APPT_STATUS_LABEL[apptStatus] ?? apptStatus}
          </span>
        </div>
      )}

      {/* Botones de acción */}
      {(isConfirmed || isRestorable) && (
        <div style={{ display: 'flex', gap: '0.3rem', flexDirection: isMobile ? 'column' : 'row', flexWrap: 'wrap', marginTop: '0.1rem' }}>
          {isConfirmed && (
            <button type="button" onClick={() => onMove(appt!, slot.id, fecha)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', fontSize: '0.68rem', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid #93c5fd', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer', fontWeight: 600, width: isMobile ? '100%' : 'auto' }}>
              <Move size={10} /> Mover
            </button>
          )}
          {(isConfirmed || isRestorable) && (
            <button type="button" onClick={() => onRestore(appt!.id)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', fontSize: '0.68rem', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid #fde68a', background: '#fefce8', color: '#a16207', cursor: 'pointer', fontWeight: 600, width: isMobile ? '100%' : 'auto' }}>
              <RotateCcw size={10} /> Restaurar
            </button>
          )}
        </div>
      )}

      {/* Fila inferior: estado slot + eliminar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.25rem' }}>
        <span style={{
          fontSize: '0.68rem', fontWeight: 600, borderRadius: '4px', padding: '0.1rem 0.4rem',
          background: isCancelledSlot ? '#fee2e2' : '#dcfce7',
          color: isCancelledSlot ? '#b91c1c' : '#166534',
          border: `1px solid ${isCancelledSlot ? '#fecaca' : '#bbf7d0'}`,
        }}>
          {isCancelledSlot ? 'Cancelado' : 'Activo'}
        </span>
        <button type="button" onClick={() => onDeleteSlot(slot.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0', display: 'flex', alignItems: 'center' }}
          title="Eliminar turno">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
