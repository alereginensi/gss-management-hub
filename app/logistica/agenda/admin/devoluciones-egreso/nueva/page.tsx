'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, LogOut, Search, User, Building2, Upload, FileText,
  X, Plus, Trash2, AlertCircle, CheckCircle, Loader2, PenSquare,
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
  talle_superior?: string | null;
  talle_inferior?: string | null;
  calzado?: string | null;
}

interface ReturnedItem {
  article_type: string;
  size?: string;
  qty: number;
}

export default function NuevaDevolucionEgresoPage() {
  const { currentUser, isAuthenticated, loading, logout } = useTicketContext();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<EmployeeLite[]>([]);
  const [searching, setSearching] = useState(false);
  const [employee, setEmployee] = useState<EmployeeLite | null>(null);

  const [items, setItems] = useState<ReturnedItem[]>([]);
  const [remitoNumber, setRemitoNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [pdfText, setPdfText] = useState('');

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

  // Debounced search de empleados
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

  const selectEmployee = (emp: EmployeeLite) => {
    setEmployee(emp);
    setSearch('');
    setResults([]);
  };

  const clearEmployee = () => {
    setEmployee(null);
    setItems([]);
  };

  const addItem = () => {
    setItems(prev => [...prev, { article_type: '', size: '', qty: 1 }]);
  };

  const updateItem = (idx: number, patch: Partial<ReturnedItem>) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handlePdfChange = useCallback(async (file: File | null) => {
    if (!file) { setPdfFile(null); return; }
    setPdfFile(file);
    setPdfParsing(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/logistica/agenda/remito/parse-pdf', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || 'No se pudo leer el PDF.' });
      } else {
        setPdfText(data.parsed_text || '');
        if (data.remito_number && !remitoNumber) setRemitoNumber(data.remito_number);
        if (Array.isArray(data.parsed_items) && data.parsed_items.length) {
          setItems(data.parsed_items.map((p: any) => ({
            article_type: p.article_type || '',
            size: p.size || '',
            qty: typeof p.qty === 'number' ? p.qty : 1,
          })));
          setMsg({ ok: true, text: `Se detectaron ${data.parsed_items.length} items del remito.` });
        } else {
          setMsg({ ok: true, text: 'PDF cargado. No se detectaron items — agregá manualmente.' });
        }
      }
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setPdfParsing(false);
    }
  }, [remitoNumber]);

  const canSubmit = !!employee && items.some(it => it.article_type.trim()) && !!respSignature && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !employee) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const cleanItems = items.filter(it => it.article_type.trim()).map(it => ({
        article_type: it.article_type.trim(),
        size: it.size?.trim() || undefined,
        qty: Math.max(1, Number(it.qty) || 1),
      }));
      const createRes = await fetch('/api/logistica/agenda/egress-returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employee.id,
          returned_items: cleanItems,
          remito_number: remitoNumber.trim() || undefined,
          notes: notes.trim() || undefined,
          employee_signature: empSignature || undefined,
          responsible_signature: respSignature || undefined,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        setMsg({ ok: false, text: createData.error || 'Error al registrar.' });
        setSubmitting(false);
        return;
      }
      const newId = createData.id as number;

      // Subir PDF si hay
      if (pdfFile && newId) {
        try {
          const fd = new FormData();
          fd.append('file', pdfFile);
          if (remitoNumber.trim()) fd.append('remito_number', remitoNumber.trim());
          await fetch(`/api/logistica/agenda/egress-returns/${newId}/remito`, { method: 'POST', body: fd });
        } catch (e) {
          console.warn('Upload PDF fallo:', e);
        }
      }

      setMsg({ ok: true, text: 'Egreso registrado. Redirigiendo...' });
      setTimeout(() => router.push('/logistica/agenda/admin/devoluciones-egreso'), 800);
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
      setSubmitting(false);
    }
  };

  if (loading || !currentUser) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)' }}>
        <Link href="/logistica/agenda/admin" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}>
          <ArrowLeft size={15} /> Admin Agenda
        </Link>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="GSS" style={{ height: '36px' }} />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{currentUser.name}</span>
      </header>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem 2rem 4rem' }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
          Nueva devolución por egreso
        </h1>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Registra la devolución de uniformes cuando un empleado egresa de la empresa. Se marcarán todos sus artículos activos como devueltos y el empleado quedará deshabilitado.
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
                  {employee.puesto && <span>· {employee.puesto}</span>}
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
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por nombre o cédula (mín. 2 caracteres)"
                  style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                />
                {searching && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--text-secondary)' }} />}
              </div>
              {results.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '0.25rem', background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', maxHeight: '260px', overflowY: 'auto', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                  {results.map(r => (
                    <button key={r.id} onClick={() => selectEmployee(r)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.55rem 0.85rem', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', color: 'var(--text-primary)' }}>
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
            {/* Upload PDF */}
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1.2rem', borderLeft: '4px solid #dc2626' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.3rem', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <FileText size={16} /> Remito de devolución
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
                Al subir el PDF, los artículos devueltos se detectan automáticamente y se cargan en la lista de abajo.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <input
                  type="text"
                  value={remitoNumber}
                  onChange={e => setRemitoNumber(e.target.value)}
                  placeholder="Ej: REM-DEV-0001"
                  className="input"
                  style={{ padding: '0.55rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: '0.88rem' }}
                />
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 0.95rem', background: 'transparent', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, alignSelf: 'flex-start' }}>
                  <Upload size={14} />
                  {pdfParsing ? 'Leyendo PDF...' : pdfFile ? `Cambiar PDF (${pdfFile.name})` : 'Subir PDF de remito'}
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={e => handlePdfChange(e.target.files?.[0] || null)}
                    style={{ display: 'none' }}
                    disabled={pdfParsing}
                  />
                </label>
                {pdfText && (
                  <details style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <summary style={{ cursor: 'pointer' }}>Ver texto extraído</summary>
                    <pre style={{ marginTop: '0.4rem', padding: '0.5rem', background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '4px', maxHeight: '140px', overflow: 'auto', whiteSpace: 'pre-wrap' }}>{pdfText}</pre>
                  </details>
                )}
              </div>
            </div>

            {/* Items devueltos */}
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1.2rem', borderLeft: '4px solid #dc2626' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#991b1b', margin: 0 }}>Ítems devueltos por el empleado</h2>
                <button onClick={addItem} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.75rem', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                  <Plus size={12} /> Agregar ítem
                </button>
              </div>
              {items.length === 0 ? (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>Sin ítems devueltos. Agregá al menos uno o subí el PDF.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {items.map((it, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 70px auto', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={it.article_type}
                        onChange={e => updateItem(idx, { article_type: e.target.value })}
                        placeholder="Artículo (ej. remera)"
                        className="input"
                        style={{ padding: '0.4rem 0.55rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: '0.82rem' }}
                      />
                      <input
                        type="text"
                        value={it.size || ''}
                        onChange={e => updateItem(idx, { size: e.target.value })}
                        placeholder="Talle"
                        style={{ padding: '0.4rem 0.55rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: '0.82rem' }}
                      />
                      <input
                        type="number"
                        min={1}
                        value={it.qty}
                        onChange={e => updateItem(idx, { qty: parseInt(e.target.value, 10) || 1 })}
                        style={{ padding: '0.4rem 0.55rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: '0.82rem' }}
                      />
                      <button onClick={() => removeItem(idx)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.3rem' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Motivo de egreso, observaciones..."
                rows={3}
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: '0.88rem', resize: 'vertical' }}
              />
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
          <Link href="/logistica/agenda/admin/devoluciones-egreso" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.65rem 1.2rem', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}>
            Cancelar
          </Link>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.65rem 1.4rem', background: canSubmit ? '#dc2626' : '#9ca3af', color: '#fff', border: 'none', borderRadius: 'var(--radius)', cursor: canSubmit ? 'pointer' : 'not-allowed', fontSize: '0.88rem', fontWeight: 600 }}
          >
            {submitting ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Registrando...</> : <>Registrar egreso</>}
          </button>
        </div>
      </main>

      <button
        onClick={() => { logout(); router.push('/login'); }}
        style={{ position: 'fixed', bottom: '1.5rem', left: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.5rem 0.9rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}
      >
        <LogOut size={14} /> Cerrar sesión
      </button>
    </div>
  );
}
