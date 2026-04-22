'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, LogOut, Search, User, Building2, FileText,
  X, Plus, Trash2, AlertCircle, CheckCircle, Loader2, PenSquare, Calendar, Clock,
} from 'lucide-react';
import { useTicketContext, canAccessAgenda } from '@/app/context/TicketContext';
import AgendaSignatureCanvas, { type AgendaSignatureCanvasRef } from '@/app/components/AgendaSignatureCanvas';

interface EmployeeLite {
  id: number;
  documento: string;
  nombre: string;
  empresa?: string | null;
  sector?: string | null;
  puesto?: string | null;
}

interface DeliveryItem {
  article_type: string;
  size?: string;
  qty: number;
}

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function NuevoIngresoPage() {
  const { currentUser, isAuthenticated, loading, logout, isMobile } = useTicketContext();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<EmployeeLite[]>([]);
  const [searching, setSearching] = useState(false);
  const [employee, setEmployee] = useState<EmployeeLite | null>(null);

  const [fecha, setFecha] = useState(todayYmd());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('09:30');

  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [remitoNumber, setRemitoNumber] = useState('');
  const [notes, setNotes] = useState('');

  const [empSignature, setEmpSignature] = useState<string | null>(null);
  const [respSignature, setRespSignature] = useState<string | null>(null);
  const empSigRef = useRef<AgendaSignatureCanvasRef>(null);
  const respSigRef = useRef<AgendaSignatureCanvasRef>(null);

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (currentUser && !canAccessAgenda(currentUser)) { router.push('/'); return; }
  }, [loading, isAuthenticated, currentUser, router]);

  useEffect(() => {
    if (employee) return;
    if (search.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/logistica/agenda/employees/search?q=${encodeURIComponent(search.trim())}`);
        const data = await res.json();
        setResults(data.employees || []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [search, employee]);

  const selectEmployee = (e: EmployeeLite) => { setEmployee(e); setSearch(''); setResults([]); };
  const clearEmployee = () => { setEmployee(null); setItems([]); };

  const addItem = () => setItems(prev => [...prev, { article_type: '', size: '', qty: 1 }]);
  const updateItem = (idx: number, patch: Partial<DeliveryItem>) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const canSubmit = !!employee && items.some(it => it.article_type.trim()) && !!respSignature && fecha && startTime && endTime && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !employee) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const clean = items.filter(it => it.article_type.trim()).map(it => ({
        article_type: it.article_type.trim(),
        size: it.size?.trim() || undefined,
        qty: Math.max(1, Number(it.qty) || 1),
      }));
      const res = await fetch('/api/logistica/agenda/ingresos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employee.id,
          fecha, start_time: startTime, end_time: endTime,
          delivered_order_items: clean,
          employee_signature: empSignature || undefined,
          responsible_signature: respSignature || undefined,
          remito_number: remitoNumber.trim() || undefined,
          delivery_notes: notes.trim() || undefined,
          create_articles: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || 'Error al registrar.' });
        setSubmitting(false);
        return;
      }
      setMsg({ ok: true, text: 'Ingreso registrado. Redirigiendo...' });
      setTimeout(() => router.push('/logistica/agenda/admin/ingresos'), 800);
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
      setSubmitting(false);
    }
  }, [canSubmit, employee, items, fecha, startTime, endTime, empSignature, respSignature, remitoNumber, notes, router]);

  if (loading || !currentUser) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)' }}>
        <Link href="/logistica/agenda/admin/ingresos" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}>
          <ArrowLeft size={15} /> Ingresos
        </Link>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="GSS" style={{ height: '36px' }} />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{currentUser.name}</span>
      </header>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem 2rem 4rem' }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
          Nuevo ingreso
        </h1>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Empleado recién ingresado: crea el turno personalizado y registra la entrega inicial de uniformes en un solo acto.
        </p>

        {/* Selector empleado */}
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.2rem' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <User size={16} /> Empleado
          </h2>
          {employee ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', padding: '0.85rem 1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius)', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{ fontWeight: 600, color: '#166534' }}>{employee.nombre}</div>
                <div style={{ fontSize: '0.8rem', color: '#166534', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                  <span>CI: {employee.documento}</span>
                  {employee.empresa && <span><Building2 size={11} style={{ verticalAlign: 'middle' }} /> {employee.empresa}</span>}
                  {employee.sector && <span>· {employee.sector}</span>}
                </div>
              </div>
              <button onClick={clearEmployee} style={{ background: 'transparent', border: 'none', color: '#166534', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}>
                <X size={14} /> Cambiar
              </button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.5rem 0.75rem', background: 'var(--bg-color)' }}>
                <Search size={15} color="var(--text-secondary)" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por nombre o cédula (mín. 2)"
                  style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.9rem' }} />
                {searching && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--text-secondary)' }} />}
              </div>
              {results.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '0.25rem', background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', maxHeight: '260px', overflowY: 'auto', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                  {results.map(r => (
                    <button key={r.id} onClick={() => selectEmployee(r)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.55rem 0.85rem', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', color: 'var(--text-primary)' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{r.nombre}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>CI {r.documento}{r.empresa ? ` · ${r.empresa}` : ''}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {employee && (
          <>
            {/* Fecha y hora del turno */}
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1.2rem', borderLeft: '4px solid #059669' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.8rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Calendar size={16} /> Turno personalizado
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Fecha</label>
                  <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.65rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: '0.85rem' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Hora inicio</label>
                  <input type="time" value={startTime} onChange={e => { setStartTime(e.target.value); }}
                    style={{ width: '100%', padding: '0.5rem 0.65rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: '0.85rem' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Hora fin</label>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.65rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: '0.85rem' }} />
                </div>
              </div>
            </div>

            {/* Items a entregar */}
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1.2rem', borderLeft: '4px solid #059669' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#166534', margin: 0 }}>Ítems entregados</h2>
                <button onClick={addItem} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.75rem', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                  <Plus size={12} /> Agregar ítem
                </button>
              </div>
              {items.length === 0 ? (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>Sin ítems. Agregá al menos uno.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {items.map((it, idx) => (
                    <div key={idx} style={isMobile
                      ? { display: 'grid', gridTemplateColumns: '1fr 80px 60px auto', gap: '0.35rem', alignItems: 'center' }
                      : { display: 'grid', gridTemplateColumns: '1fr 90px 70px auto', gap: '0.5rem', alignItems: 'center' }}>
                      <input type="text" value={it.article_type}
                        onChange={e => updateItem(idx, { article_type: e.target.value })}
                        placeholder={isMobile ? 'Artículo' : 'Artículo (ej. remera)'}
                        style={{ padding: '0.4rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: isMobile ? '0.78rem' : '0.82rem', minWidth: 0 }} />
                      <input type="text" value={it.size || ''}
                        onChange={e => updateItem(idx, { size: e.target.value })}
                        placeholder="Talle"
                        style={{ padding: '0.4rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: isMobile ? '0.78rem' : '0.82rem', minWidth: 0, width: '100%' }} />
                      <input type="number" min={1} value={it.qty}
                        onChange={e => updateItem(idx, { qty: parseInt(e.target.value, 10) || 1 })}
                        style={{ padding: '0.4rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: isMobile ? '0.78rem' : '0.82rem', minWidth: 0, width: '100%' }} />
                      <button onClick={() => removeItem(idx)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.25rem', flexShrink: 0 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Remito (opcional) */}
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1.2rem' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <FileText size={16} /> Remito (opcional)
              </h2>
              <input type="text" value={remitoNumber} onChange={e => setRemitoNumber(e.target.value)}
                placeholder="Ej: REM-0001" style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: '0.88rem' }} />
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.4rem', margin: 0 }}>
                Podés subir el PDF después desde el detalle de la cita.
              </p>
            </div>

            {/* Firmas */}
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1.2rem' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <PenSquare size={16} /> Firmas
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
                La firma del responsable es obligatoria. La del funcionario es opcional.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>Responsable <span style={{ color: '#dc2626' }}>*</span></div>
                  <AgendaSignatureCanvas ref={respSigRef} onChange={setRespSignature} label="Firma responsable" />
                  <button onClick={() => respSigRef.current?.clear()} style={{ marginTop: '0.35rem', fontSize: '0.75rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline' }}>Limpiar</button>
                </div>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>Funcionario <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(opcional)</span></div>
                  <AgendaSignatureCanvas ref={empSigRef} onChange={setEmpSignature} label="Firma funcionario" />
                  <button onClick={() => empSigRef.current?.clear()} style={{ marginTop: '0.35rem', fontSize: '0.75rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline' }}>Limpiar</button>
                </div>
              </div>
            </div>

            {/* Notas */}
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1.2rem' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.4rem' }}>Notas (opcional)</h2>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Observaciones del ingreso..." rows={3}
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: '0.88rem', resize: 'vertical' }} />
            </div>
          </>
        )}

        {msg && (
          <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1rem', borderRadius: 'var(--radius)', background: msg.ok ? '#dcfce7' : '#fee2e2', color: msg.ok ? '#166534' : '#991b1b', fontSize: '0.85rem' }}>
            {msg.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            {msg.text}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
          <Link href="/logistica/agenda/admin/ingresos" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.65rem 1.2rem', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}>
            Cancelar
          </Link>
          <button onClick={handleSubmit} disabled={!canSubmit}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.65rem 1.4rem', background: canSubmit ? '#059669' : '#9ca3af', color: '#fff', border: 'none', borderRadius: 'var(--radius)', cursor: canSubmit ? 'pointer' : 'not-allowed', fontSize: '0.88rem', fontWeight: 600 }}>
            {submitting ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Registrando...</> : <>Registrar ingreso</>}
          </button>
        </div>
      </main>

      <button onClick={() => { logout(); router.push('/login'); }}
        style={{ position: 'fixed', bottom: '1.5rem', left: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.5rem 0.9rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
        <LogOut size={14} /> Cerrar sesión
      </button>
    </div>
  );
}
