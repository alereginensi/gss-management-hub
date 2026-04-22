'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, LogOut, Building2, Upload, FileText, Plus, Trash2,
  AlertCircle, CheckCircle, Loader2, Save, PenSquare,
} from 'lucide-react';
import { useTicketContext, canAccessAgenda } from '@/app/context/TicketContext';
import SignatureReplaceButton from '@/app/components/SignatureReplaceButton';

interface ReturnedItem {
  article_type: string;
  size?: string;
  qty: number;
}

interface EgressData {
  id: number;
  employee_id: number;
  employee_nombre: string;
  employee_documento: string;
  employee_empresa?: string | null;
  employee_sector?: string | null;
  returned_items: ReturnedItem[];
  remito_number?: string | null;
  remito_pdf_url?: string | null;
  employee_signature_url?: string | null;
  responsible_signature_url?: string | null;
  notes?: string | null;
  updated_at: string;
}

export default function EditarDevolucionEgresoPage() {
  const { currentUser, isAuthenticated, loading, logout, isMobile } = useTicketContext();
  const router = useRouter();
  const params = useParams();
  const id = parseInt((params?.id as string) || '0', 10);

  const [data, setData] = useState<EgressData | null>(null);
  const [items, setItems] = useState<ReturnedItem[]>([]);
  const [remitoNumber, setRemitoNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [pdfText, setPdfText] = useState('');
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (currentUser && !canAccessAgenda(currentUser)) { router.push('/'); return; }
  }, [loading, isAuthenticated, currentUser, router]);

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch(`/api/logistica/agenda/egress-returns/${id}`);
      if (!res.ok) {
        setMsg({ ok: false, text: 'No se pudo cargar el egreso.' });
        return;
      }
      const d: EgressData = await res.json();
      setData(d);
      setItems(d.returned_items || []);
      setRemitoNumber(d.remito_number || '');
      setNotes(d.notes || '');
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setFetching(false);
    }
  }, [id]);

  useEffect(() => {
    if (!isAuthenticated || loading || !id) return;
    load();
  }, [load, isAuthenticated, loading, id]);

  const addItem = () => setItems(prev => [...prev, { article_type: '', size: '', qty: 1 }]);
  const updateItem = (idx: number, patch: Partial<ReturnedItem>) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

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
        console.error('[edit egreso] parse-pdf error', data);
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
          setMsg({ ok: true, text: 'PDF cargado. No se detectaron items — ajustá manualmente.' });
        }
      }
    } catch (e: any) {
      console.error('[edit egreso] parse-pdf fetch fallo', e);
      setMsg({ ok: false, text: `Fallo de red al leer PDF: ${e.message}` });
    } finally {
      setPdfParsing(false);
    }
  }, [remitoNumber]);

  const handleSave = async () => {
    if (!data) return;
    const clean = items.filter(it => it.article_type.trim());
    if (clean.length === 0) {
      setMsg({ ok: false, text: 'Dejá al menos un item.' });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/logistica/agenda/egress-returns/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returned_items: clean.map(it => ({
            article_type: it.article_type.trim(),
            size: it.size?.trim() || undefined,
            qty: Math.max(1, Number(it.qty) || 1),
          })),
          remito_number: remitoNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: json.error || 'Error al guardar.' });
        setSaving(false);
        return;
      }
      if (pdfFile) {
        try {
          const fd = new FormData();
          fd.append('file', pdfFile);
          if (remitoNumber.trim()) fd.append('remito_number', remitoNumber.trim());
          await fetch(`/api/logistica/agenda/egress-returns/${id}/remito`, { method: 'POST', body: fd });
        } catch (e) {
          console.warn('[edit egreso] upload PDF fallo:', e);
        }
      }
      setMsg({ ok: true, text: 'Cambios guardados.' });
      setTimeout(() => router.push('/logistica/agenda/admin/devoluciones-egreso'), 800);
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
      setSaving(false);
    }
  };

  if (loading || !currentUser) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)' }}>
        <Link href="/logistica/agenda/admin/devoluciones-egreso" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}>
          <ArrowLeft size={15} /> Devoluciones
        </Link>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="GSS" style={{ height: '36px' }} />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{currentUser.name}</span>
      </header>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem 2rem 4rem' }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
          Editar devolución por egreso
        </h1>

        {fetching ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <Loader2 size={24} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--primary-color)' }} />
          </div>
        ) : !data ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Egreso no encontrado.</p>
        ) : (
          <>
            {/* Empleado (readonly) */}
            <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.2rem', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <div style={{ fontWeight: 600, color: '#166534' }}>{data.employee_nombre}</div>
              <div style={{ fontSize: '0.8rem', color: '#166534', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                <span>CI: {data.employee_documento}</span>
                {data.employee_empresa && <span><Building2 size={11} style={{ verticalAlign: 'middle' }} /> {data.employee_empresa}</span>}
                {data.employee_sector && <span>· {data.employee_sector}</span>}
              </div>
            </div>

            {/* Remito */}
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1.2rem', borderLeft: '4px solid #dc2626' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.3rem', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <FileText size={16} /> Remito
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <input
                  type="text"
                  value={remitoNumber}
                  onChange={e => setRemitoNumber(e.target.value)}
                  placeholder="Ej: REM-DEV-0001"
                  style={{ padding: '0.55rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: '0.88rem' }}
                />
                {data.remito_pdf_url && (
                  <a
                    href={`/api/logistica/agenda/egress-returns/${data.id}/remito-pdf?t=${data.updated_at}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.78rem', color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none', alignSelf: 'flex-start' }}
                  >
                    <FileText size={12} /> Ver remito actual
                  </a>
                )}
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 0.95rem', background: 'transparent', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, alignSelf: 'flex-start' }}>
                  <Upload size={14} />
                  {pdfParsing ? 'Leyendo PDF...' : pdfFile ? `Cambiar (${pdfFile.name})` : 'Reemplazar PDF'}
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
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

            {/* Items */}
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1.2rem', borderLeft: '4px solid #dc2626' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#991b1b', margin: 0 }}>Ítems devueltos</h2>
                <button onClick={addItem} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.75rem', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                  <Plus size={12} /> Agregar
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {items.map((it, idx) => (
                  <div
                    key={idx}
                    style={isMobile
                      ? { display: 'grid', gridTemplateColumns: '1fr 80px 60px auto', gap: '0.35rem', alignItems: 'center' }
                      : { display: 'grid', gridTemplateColumns: '1fr 90px 70px auto', gap: '0.5rem', alignItems: 'center' }
                    }
                  >
                    <input
                      type="text"
                      value={it.article_type}
                      onChange={e => updateItem(idx, { article_type: e.target.value })}
                      placeholder={isMobile ? 'Artículo' : 'Artículo (ej. remera)'}
                      style={{ padding: '0.4rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: isMobile ? '0.78rem' : '0.82rem', minWidth: 0 }}
                    />
                    <input
                      type="text"
                      value={it.size || ''}
                      onChange={e => updateItem(idx, { size: e.target.value })}
                      placeholder="Talle"
                      style={{ padding: '0.4rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: isMobile ? '0.78rem' : '0.82rem', minWidth: 0, width: '100%' }}
                    />
                    <input
                      type="number"
                      min={1}
                      value={it.qty}
                      onChange={e => updateItem(idx, { qty: parseInt(e.target.value, 10) || 1 })}
                      style={{ padding: '0.4rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: isMobile ? '0.78rem' : '0.82rem', minWidth: 0, width: '100%' }}
                    />
                    <button onClick={() => removeItem(idx)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.25rem', flexShrink: 0 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Firmas — reemplazables */}
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1.2rem' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <PenSquare size={16} /> Firmas
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>Responsable</div>
                  {data.responsible_signature_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={data.responsible_signature_url} alt="Firma responsable" style={{ maxWidth: '100%', maxHeight: '120px', border: '1px solid var(--border-color)', borderRadius: '6px', background: '#fff' }} />
                  ) : (
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Sin firma</p>
                  )}
                  <div style={{ marginTop: '0.35rem' }}>
                    <SignatureReplaceButton
                      endpoint={`/api/logistica/agenda/egress-returns/${id}/sign`}
                      fieldName="responsible_signature"
                      title="Reemplazar firma responsable"
                      label="Firma del responsable"
                      onSaved={() => load()}
                    />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>Funcionario</div>
                  {data.employee_signature_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={data.employee_signature_url} alt="Firma funcionario" style={{ maxWidth: '100%', maxHeight: '120px', border: '1px solid var(--border-color)', borderRadius: '6px', background: '#fff' }} />
                  ) : (
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Sin firma</p>
                  )}
                  <div style={{ marginTop: '0.35rem' }}>
                    <SignatureReplaceButton
                      endpoint={`/api/logistica/agenda/egress-returns/${id}/sign`}
                      fieldName="employee_signature"
                      title="Reemplazar firma funcionario"
                      label="Firma del funcionario"
                      onSaved={() => load()}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Notas */}
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1.2rem' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.4rem' }}>Notas</h2>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: '0.88rem', resize: 'vertical' }}
              />
            </div>

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
                onClick={handleSave}
                disabled={saving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.65rem 1.4rem', background: saving ? '#9ca3af' : '#29416b', color: '#fff', border: 'none', borderRadius: 'var(--radius)', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.88rem', fontWeight: 600 }}
              >
                {saving ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Guardando...</> : <><Save size={14} /> Guardar cambios</>}
              </button>
            </div>
          </>
        )}
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
