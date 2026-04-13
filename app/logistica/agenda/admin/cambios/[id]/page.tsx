'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Printer, CheckCircle, FileText, Upload, X, Plus, AlertTriangle, Clock, PackageCheck } from 'lucide-react';
import { useTicketContext, hasModuleAccess } from '@/app/context/TicketContext';
import LogoutExpandButton from '@/app/components/LogoutExpandButton';
import AgendaSignatureCanvas, { AgendaSignatureCanvasRef } from '@/app/components/AgendaSignatureCanvas';
import { parseOrderItems, renderOrderItemLabel } from '@/lib/agenda-ui';
import { parseRemitoText } from '@/lib/agenda-remito-parser';
import type { OrderItem } from '@/lib/agenda-types';

const LEGAL_DISCLAIMER = `En el día de la fecha se hace entrega al/la Sr./Sra. firmante, del uniforme y/o equipamiento correspondiente para el cumplimiento de sus funciones, el cual se detalla a continuación.
Se deja expresa constancia de que, una vez realizada la entrega, el funcionario asume la responsabilidad sobre el uso adecuado, cuidado y conservación de los elementos proporcionados, comprometiéndose a devolverlos en condiciones proporcionales al tiempo de uso al momento de su desvinculación, traslado o cuando la empresa así lo requiera.
En caso de que las prendas entregadas sean devueltas en condiciones reutilizables, el funcionario acepta que el costo del lavado será descontado de su salario. Asimismo, si las prendas no son devueltas o presentan un deterioro que exceda el desgaste razonable por el tiempo de uso, la empresa se reserva el derecho de descontar de su liquidación final el valor de reposición correspondiente.
El funcionario firma la presente constancia de cambio de uniforme en conformidad, dejando expresa constancia de la recepción del artículo entregado y la devolución del artículo reemplazado.`;

function getStatusBadge(status: string) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    pendiente:  { label: 'Pendiente',  bg: '#fef3c7', color: '#92400e' },
    completado: { label: 'Completado', bg: '#d1fae5', color: '#065f46' },
    cancelado:  { label: 'Cancelado',  bg: '#fee2e2', color: '#7f1d1d' },
  };
  return map[status] || { label: status, bg: '#f3f4f6', color: '#374151' };
}

export default function CambioDetallePage() {
  const { currentUser, isAuthenticated, loading, logout, isMobile } = useTicketContext();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [change, setChange] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Remito entrega
  const [deliveredItems, setDeliveredItems] = useState<OrderItem[]>([]);
  const [remitoDeliveryNumber, setRemitoDeliveryNumber] = useState('');
  const [rawDeliveryText, setRawDeliveryText] = useState('');
  const [parsingDelivery, setParsingDelivery] = useState(false);

  // Remito devolución
  const [returnedItems, setReturnedItems] = useState<OrderItem[]>([]);
  const [remitoReturnNumber, setRemitoReturnNumber] = useState('');
  const [rawReturnText, setRawReturnText] = useState('');
  const [parsingReturn, setParsingReturn] = useState(false);

  // Firmas
  const [empSignData, setEmpSignData] = useState<string | null>(null);
  const [respSignData, setRespSignData] = useState<string | null>(null);
  const empCanvasRef = useRef<AgendaSignatureCanvasRef>(null);
  const respCanvasRef = useRef<AgendaSignatureCanvasRef>(null);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  // Archivos remito
  const deliveryFileRef = useRef<HTMLInputElement>(null);
  const returnFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (currentUser && !hasModuleAccess(currentUser, 'logistica')) { router.push('/'); return; }
  }, [loading, isAuthenticated, currentUser, router]);

  useEffect(() => {
    if (!isAuthenticated || loading || !id) return;
    fetchChange();
  }, [isAuthenticated, loading, id]);

  const fetchChange = async () => {
    setFetching(true);
    try {
      const res = await fetch(`/api/logistica/agenda/changes/${id}`);
      if (!res.ok) { setError('Cambio no encontrado'); return; }
      const data = await res.json();
      setChange(data);
      // Pre-fill from saved data
      if (data.delivered_items) {
        setDeliveredItems(parseOrderItems(data.delivered_items));
      } else if (data.new_article_type) {
        setDeliveredItems([{ article_type: data.new_article_type, size: data.new_article_size || undefined, qty: 1 }]);
      }
      if (data.returned_items) {
        setReturnedItems(parseOrderItems(data.returned_items));
      } else if (data.returned_article_type) {
        setReturnedItems([{ article_type: data.returned_article_type, size: data.returned_article_size || undefined, qty: 1 }]);
      }
      setRemitoDeliveryNumber(data.remito_delivery_number || '');
      setRemitoReturnNumber(data.remito_return_number || '');
    } finally {
      setFetching(false);
    }
  };

  const showMessage = (msg: string, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(null), 5000); }
    else { setSuccess(msg); setTimeout(() => setSuccess(null), 3500); }
  };

  // ─── Parsear remito de entrega ──────────────────────────────────────────────
  const handleParseDelivery = () => {
    if (!rawDeliveryText.trim()) return;
    setParsingDelivery(true);
    try {
      const result = parseRemitoText(rawDeliveryText);
      if (result.matched.length > 0) {
        const items: OrderItem[] = result.matched.map(r => ({
          article_type: r.article_type || r.raw,
          qty: r.qty,
        }));
        setDeliveredItems(items);
        showMessage(`${items.length} ítem(s) encontrados en el remito de entrega`);
      } else {
        showMessage('No se reconocieron artículos en el remito. Verificar el texto.', true);
      }
      // Try to extract remito number
      const numMatch = rawDeliveryText.match(/remito[:\s#nN°]*\s*([A-Z0-9\-]+)/i);
      if (numMatch && !remitoDeliveryNumber) setRemitoDeliveryNumber(numMatch[1]);
    } finally {
      setParsingDelivery(false);
    }
  };

  // ─── Parsear remito de devolución ───────────────────────────────────────────
  const handleParseReturn = () => {
    if (!rawReturnText.trim()) return;
    setParsingReturn(true);
    try {
      const result = parseRemitoText(rawReturnText);
      if (result.matched.length > 0) {
        const items: OrderItem[] = result.matched.map(r => ({
          article_type: r.article_type || r.raw,
          qty: r.qty,
        }));
        setReturnedItems(items);
        showMessage(`${items.length} ítem(s) encontrados en el remito de devolución`);
      } else {
        showMessage('No se reconocieron artículos en el remito de devolución.', true);
      }
      const numMatch = rawReturnText.match(/remito[:\s#nN°]*\s*([A-Z0-9\-]+)/i);
      if (numMatch && !remitoReturnNumber) setRemitoReturnNumber(numMatch[1]);
    } finally {
      setParsingReturn(false);
    }
  };

  // ─── Subir archivo de remito (guarda en el change event) ───────────────────
  const handleUploadRemitoFile = async (file: File, type: 'delivery' | 'return') => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('receipt_type', type);
    // Parse text from filename hint (just upload for now)
    const field = type === 'delivery' ? 'delivery_receipt' : 'return_receipt';
    const updateFd = new FormData();
    updateFd.append(field, file);
    // We'll just show a local preview — actual upload would need a dedicated endpoint
    // For now, use the raw text area to handle the remito content
    showMessage(`Archivo "${file.name}" seleccionado. Pega el texto del remito para auto-completar.`);
  };

  // ─── Completar cambio ───────────────────────────────────────────────────────
  const handleComplete = async () => {
    if (!empSignData) { showMessage('La firma del empleado es obligatoria', true); return; }
    if (!respSignData) { showMessage('La firma del responsable es obligatoria', true); return; }
    if (!disclaimerAccepted) { showMessage('Debe aceptar el descargo legal', true); return; }
    if (!confirm('¿Confirmar el cambio de prenda? Esto actualizará el inventario de artículos.')) return;

    setSaving(true);
    try {
      const dataUrlToFile = (dataUrl: string, filename: string) => {
        const arr = dataUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) u8arr[n] = bstr.charCodeAt(n);
        return new File([u8arr], filename, { type: mime });
      };

      // 1. Subir firmas
      const uploadSign = async (type: 'employee' | 'responsible', file: File) => {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('type', type);
        if (type === 'employee') fd.append('disclaimer_accepted', '1');
        const res = await fetch(`/api/logistica/agenda/changes/${id}/sign`, { method: 'POST', body: fd });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || `Error subiendo firma ${type}`); }
      };

      await uploadSign('employee', dataUrlToFile(empSignData, `firma-emp-cambio${id}.png`));
      await uploadSign('responsible', dataUrlToFile(respSignData, `firma-resp-cambio${id}.png`));

      // 2. Guardar disclaimer y actualizar datos
      await fetch(`/api/logistica/agenda/changes/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivered_items: deliveredItems,
          returned_items: returnedItems,
          remito_delivery_number: remitoDeliveryNumber,
          remito_return_number: remitoReturnNumber,
        }),
      });

      // 3. Completar
      const res = await fetch(`/api/logistica/agenda/changes/${id}/complete`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivered_items: deliveredItems,
          returned_items: returnedItems,
          remito_delivery_number: remitoDeliveryNumber,
          remito_return_number: remitoReturnNumber,
        }),
      });
      if (!res.ok) { const d = await res.json(); showMessage(d.error || 'Error al completar', true); return; }
      showMessage('Cambio completado — inventario actualizado');
      fetchChange();
    } catch (err: any) {
      showMessage(err.message || 'Error al procesar', true);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !currentUser) return null;

  const completed = change?.status === 'completado';
  const statusBadge = change ? getStatusBadge(change.status || 'pendiente') : null;
  const todayStr = new Date().toLocaleDateString('es-UY');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <header className="no-print" style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '56px',
        backgroundColor: '#29416b', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '0 1rem' : '0 1.5rem', zIndex: 100, borderBottom: '3px solid #e04951', boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'rgba(255,255,255,0.7)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem' }}>
            <ArrowLeft size={13} /> Volver
          </button>
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>Cambio #{id}</span>
          {statusBadge && (
            <span style={{ background: statusBadge.bg, color: statusBadge.color, borderRadius: '4px', padding: '0.15rem 0.5rem', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {completed ? <PackageCheck size={10} /> : <Clock size={10} />}{statusBadge.label}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={() => window.print()} className="btn btn-secondary no-print" style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Printer size={13} /> Imprimir
          </button>
          {!isMobile && <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem' }}>{currentUser.name}</span>}
          <LogoutExpandButton onClick={() => { logout(); router.push('/login'); }} />
        </div>
      </header>

      <main style={{ marginTop: '56px', padding: isMobile ? '1.25rem 1rem' : '1.5rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          {error && <div className="no-print" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#7f1d1d', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><AlertTriangle size={14} />{error}</div>}
          {success && <div className="no-print" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><CheckCircle size={14} />{success}</div>}

          {fetching ? (
            <div className="card" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Cargando cambio...</div>
          ) : !change ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Cambio no encontrado.</div>
          ) : (
            <>
              {/* ══ CONSTANCIA IMPRIMIBLE ══ */}
              <div className="print-comprobante card" style={{ padding: '2rem', marginBottom: '1.25rem' }}>
                <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#000', marginBottom: '4px' }}>Constancia de Cambio de Uniforme</h1>
                <p style={{ fontSize: '0.8rem', color: '#555', marginBottom: '1.5rem' }}>Fecha: {change.completed_at ? new Date(change.completed_at).toLocaleDateString('es-UY') : todayStr}</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 2rem', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                  {[
                    ['Empleado', change.employee_nombre],
                    ['Documento', change.employee_documento],
                    ['Empresa', change.employee_empresa || '—'],
                    ['Sector/Puesto', [change.employee_sector, change.employee_puesto].filter(Boolean).join(' / ') || '—'],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <span style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>{label}</span>
                      <strong style={{ fontFamily: label === 'Documento' ? 'monospace' : undefined }}>{val}</strong>
                    </div>
                  ))}
                </div>

                {/* Tabla entregado */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065f46', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.04em' }}>Artículo ENTREGADO</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th style={{ backgroundColor: '#f0fdf4', padding: '0.4rem 0.75rem', textAlign: 'left', fontWeight: 700, border: '1px solid #bbf7d0' }}>Prenda</th>
                        <th style={{ backgroundColor: '#f0fdf4', padding: '0.4rem 0.75rem', textAlign: 'left', fontWeight: 700, border: '1px solid #bbf7d0', width: '150px' }}>Talla</th>
                        <th style={{ backgroundColor: '#f0fdf4', padding: '0.4rem 0.75rem', textAlign: 'left', fontWeight: 700, border: '1px solid #bbf7d0', width: '80px' }}>Cant.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveredItems.length > 0 ? deliveredItems.map((item, i) => (
                        <tr key={i}>
                          <td style={{ padding: '0.4rem 0.75rem', border: '1px solid #e2e8f0' }}>{item.article_type}</td>
                          <td style={{ padding: '0.4rem 0.75rem', border: '1px solid #e2e8f0' }}>{item.size || '—'}</td>
                          <td style={{ padding: '0.4rem 0.75rem', border: '1px solid #e2e8f0' }}>{item.qty}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={3} style={{ padding: '0.75rem', textAlign: 'center', color: '#94a3b8', border: '1px solid #e2e8f0' }}>Sin ítems</td></tr>
                      )}
                    </tbody>
                  </table>
                  {remitoDeliveryNumber && <p style={{ fontSize: '0.78rem', color: '#555', margin: '0.4rem 0 0' }}>Remito Entrega N° {remitoDeliveryNumber}</p>}
                </div>

                {/* Tabla devuelto */}
                {(returnedItems.length > 0 || change.returned_article_type) && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7f1d1d', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.04em' }}>Artículo DEVUELTO</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th style={{ backgroundColor: '#fef2f2', padding: '0.4rem 0.75rem', textAlign: 'left', fontWeight: 700, border: '1px solid #fecaca' }}>Prenda</th>
                          <th style={{ backgroundColor: '#fef2f2', padding: '0.4rem 0.75rem', textAlign: 'left', fontWeight: 700, border: '1px solid #fecaca', width: '150px' }}>Talla</th>
                          <th style={{ backgroundColor: '#fef2f2', padding: '0.4rem 0.75rem', textAlign: 'left', fontWeight: 700, border: '1px solid #fecaca', width: '80px' }}>Cant.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {returnedItems.length > 0 ? returnedItems.map((item, i) => (
                          <tr key={i}>
                            <td style={{ padding: '0.4rem 0.75rem', border: '1px solid #e2e8f0' }}>{item.article_type}</td>
                            <td style={{ padding: '0.4rem 0.75rem', border: '1px solid #e2e8f0' }}>{item.size || '—'}</td>
                            <td style={{ padding: '0.4rem 0.75rem', border: '1px solid #e2e8f0' }}>{item.qty}</td>
                          </tr>
                        )) : (
                          <tr>
                            <td style={{ padding: '0.4rem 0.75rem', border: '1px solid #e2e8f0' }}>{change.returned_article_type}</td>
                            <td style={{ padding: '0.4rem 0.75rem', border: '1px solid #e2e8f0' }}>{change.returned_article_size || '—'}</td>
                            <td style={{ padding: '0.4rem 0.75rem', border: '1px solid #e2e8f0' }}>1</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    {remitoReturnNumber && <p style={{ fontSize: '0.78rem', color: '#555', margin: '0.4rem 0 0' }}>Remito Devolución N° {remitoReturnNumber}</p>}
                  </div>
                )}

                {/* Descargo */}
                <div style={{ border: '1px solid #e2e8f0', borderLeft: '4px solid #29416b', borderRadius: '4px', padding: '1rem', background: '#f8fafc', marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#29416b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Descargo Legal</div>
                  <div style={{ fontSize: '0.72rem', color: '#334155', whiteSpace: 'pre-wrap', fontStyle: 'italic', lineHeight: 1.5 }}>{LEGAL_DISCLAIMER}</div>
                </div>

                {/* Firmas */}
                <div style={{ display: 'flex', gap: '3rem', marginTop: '2rem' }}>
                  {[
                    { label: 'Firma Responsable', url: change.responsible_signature_url },
                    { label: 'Firma Empleado', url: change.employee_signature_url },
                  ].map(({ label, url }) => (
                    <div key={label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.5rem' }}>{label}</div>
                      {url ? (
                        <img src={url} alt={label} style={{ maxHeight: '70px', borderBottom: '1px solid #e2e8f0' }} />
                      ) : <div style={{ height: '70px', width: '150px', borderBottom: '1px dashed #cbd5e1' }} />}
                    </div>
                  ))}
                </div>
              </div>

              {/* ══ PANEL DE COMPLETAR (no imprimible) ══ */}
              {!completed && (
                <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                  {/* Info del cambio */}
                  <div className="card" style={{ padding: '1.25rem' }}>
                    <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>Detalle del cambio</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.5rem', fontSize: '0.82rem' }}>
                      <div><span style={{ color: '#64748b', fontSize: '0.72rem' }}>EMPLEADO</span><div style={{ fontWeight: 700 }}>{change.employee_nombre} <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontWeight: 400 }}>({change.employee_documento})</span></div></div>
                      {change.returned_article_type && (
                        <div><span style={{ color: '#dc2626', fontSize: '0.72rem', fontWeight: 700 }}>A DEVOLVER</span><div>{change.returned_article_type}{change.returned_article_size ? ` (${change.returned_article_size})` : ''} — entregado {change.returned_delivery_date}</div></div>
                      )}
                      {change.new_article_type && (
                        <div><span style={{ color: '#059669', fontSize: '0.72rem', fontWeight: 700 }}>A ENTREGAR</span><div>{change.new_article_type}{change.new_article_size ? ` (${change.new_article_size})` : ''}</div></div>
                      )}
                    </div>
                    {change.delivery_receipt_url && (
                      <a href={change.delivery_receipt_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.5rem' }}>
                        <FileText size={12} /> Ver remito de entrega original
                      </a>
                    )}
                    {change.return_receipt_url && (
                      <a href={change.return_receipt_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.25rem' }}>
                        <FileText size={12} /> Ver remito de devolución original
                      </a>
                    )}
                  </div>

                  {/* Remito ENTREGA */}
                  <div className="card" style={{ padding: '1.25rem', borderLeft: '3px solid #10b981' }}>
                    <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#065f46', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <FileText size={15} color="#10b981" />Remito de ENTREGA
                    </h3>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Número de remito</label>
                      <input value={remitoDeliveryNumber} onChange={e => setRemitoDeliveryNumber(e.target.value)} placeholder="Ej: REM-0001"
                        style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Texto del remito (para auto-completar)</label>
                      <textarea value={rawDeliveryText} onChange={e => setRawDeliveryText(e.target.value)} rows={3}
                        placeholder="Pegar texto del remito de entrega para detectar ítems automáticamente..."
                        style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.78rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'monospace' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                      <button onClick={handleParseDelivery} disabled={!rawDeliveryText.trim() || parsingDelivery}
                        style={{ background: '#059669', color: 'white', border: 'none', borderRadius: '6px', padding: '0.4rem 0.85rem', fontSize: '0.78rem', fontWeight: 600, cursor: !rawDeliveryText.trim() ? 'not-allowed' : 'pointer', opacity: !rawDeliveryText.trim() ? 0.5 : 1 }}>
                        {parsingDelivery ? 'Analizando...' : 'Analizar remito'}
                      </button>
                      <input type="file" ref={deliveryFileRef} style={{ display: 'none' }} accept=".pdf,image/*"
                        onChange={e => { if (e.target.files?.[0]) handleUploadRemitoFile(e.target.files[0], 'delivery'); }} />
                      <button onClick={() => deliveryFileRef.current?.click()}
                        style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.85rem', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#374151' }}>
                        <Upload size={13} /> Subir archivo
                      </button>
                    </div>
                    {/* Ítems entregados editables */}
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>Ítems entregados</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.5rem' }}>
                      {deliveredItems.map((item, i) => (
                        <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', background: '#f0fdf4', borderRadius: '6px', padding: '0.35rem 0.5rem' }}>
                          <span style={{ flex: 1, fontSize: '0.8rem', fontWeight: 600, color: '#1e293b' }}>{renderOrderItemLabel(item)}</span>
                          <button onClick={() => setDeliveredItems(prev => prev.filter((_, idx) => idx !== i))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={13} /></button>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setDeliveredItems(prev => [...prev, { article_type: '', qty: 1 }])}
                      style={{ background: 'none', border: '1px dashed #d1fae5', borderRadius: '6px', padding: '0.35rem 0.75rem', fontSize: '0.78rem', cursor: 'pointer', color: '#059669', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Plus size={12} /> Agregar ítem
                    </button>
                  </div>

                  {/* Remito DEVOLUCIÓN */}
                  <div className="card" style={{ padding: '1.25rem', borderLeft: '3px solid #ef4444' }}>
                    <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#7f1d1d', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <FileText size={15} color="#ef4444" />Remito de DEVOLUCIÓN
                    </h3>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Número de remito</label>
                      <input value={remitoReturnNumber} onChange={e => setRemitoReturnNumber(e.target.value)} placeholder="Ej: DEV-0001"
                        style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Texto del remito (para auto-completar)</label>
                      <textarea value={rawReturnText} onChange={e => setRawReturnText(e.target.value)} rows={3}
                        placeholder="Pegar texto del remito de devolución para detectar ítems automáticamente..."
                        style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.78rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'monospace' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                      <button onClick={handleParseReturn} disabled={!rawReturnText.trim() || parsingReturn}
                        style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', padding: '0.4rem 0.85rem', fontSize: '0.78rem', fontWeight: 600, cursor: !rawReturnText.trim() ? 'not-allowed' : 'pointer', opacity: !rawReturnText.trim() ? 0.5 : 1 }}>
                        {parsingReturn ? 'Analizando...' : 'Analizar remito'}
                      </button>
                      <input type="file" ref={returnFileRef} style={{ display: 'none' }} accept=".pdf,image/*"
                        onChange={e => { if (e.target.files?.[0]) handleUploadRemitoFile(e.target.files[0], 'return'); }} />
                      <button onClick={() => returnFileRef.current?.click()}
                        style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.85rem', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#374151' }}>
                        <Upload size={13} /> Subir archivo
                      </button>
                    </div>
                    {/* Ítems devueltos editables */}
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>Ítems devueltos</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.5rem' }}>
                      {returnedItems.map((item, i) => (
                        <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', background: '#fef2f2', borderRadius: '6px', padding: '0.35rem 0.5rem' }}>
                          <span style={{ flex: 1, fontSize: '0.8rem', fontWeight: 600, color: '#1e293b' }}>{renderOrderItemLabel(item)}</span>
                          <button onClick={() => setReturnedItems(prev => prev.filter((_, idx) => idx !== i))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={13} /></button>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setReturnedItems(prev => [...prev, { article_type: '', qty: 1 }])}
                      style={{ background: 'none', border: '1px dashed #fecaca', borderRadius: '6px', padding: '0.35rem 0.75rem', fontSize: '0.78rem', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Plus size={12} /> Agregar ítem
                    </button>
                  </div>

                  {/* Descargo + Firmas */}
                  <div className="card" style={{ padding: '1.25rem' }}>
                    <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>Descargo legal y Firmas</h3>

                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.72rem', color: '#334155', whiteSpace: 'pre-wrap', fontStyle: 'italic', lineHeight: 1.4 }}>
                        {LEGAL_DISCLAIMER}
                      </div>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginTop: '0.85rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>
                        <input type="checkbox" checked={disclaimerAccepted} onChange={e => setDisclaimerAccepted(e.target.checked)} style={{ marginTop: '2px', flexShrink: 0 }} />
                        Acepto el descargo legal y confirmo la recepción y devolución de prendas
                      </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                      <AgendaSignatureCanvas
                        ref={empCanvasRef}
                        label="Firma del empleado"
                        onChange={setEmpSignData}
                        disabled={saving}
                      />
                      <AgendaSignatureCanvas
                        ref={respCanvasRef}
                        label="Firma del responsable"
                        onChange={setRespSignData}
                        disabled={saving}
                      />
                    </div>
                  </div>

                  {/* Botón completar */}
                  <div className="card" style={{ padding: '1.25rem', background: 'white' }}>
                    {(!disclaimerAccepted || !empSignData || !respSignData) && (
                      <div style={{ fontSize: '0.78rem', color: '#92400e', background: '#fef3c7', borderRadius: '6px', padding: '0.6rem 0.75rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <AlertTriangle size={13} />
                        Pendiente: {[!disclaimerAccepted && 'aceptar descargo', !empSignData && 'firma del empleado', !respSignData && 'firma del responsable'].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    <button
                      onClick={handleComplete}
                      disabled={saving || !disclaimerAccepted || !empSignData || !respSignData}
                      style={{
                        width: '100%', background: (!disclaimerAccepted || !empSignData || !respSignData) ? '#94a3b8' : '#29416b',
                        color: 'white', border: 'none', borderRadius: '8px', padding: '0.85rem',
                        fontSize: '1rem', fontWeight: 700, cursor: (!disclaimerAccepted || !empSignData || !respSignData || saving) ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                        boxShadow: (!disclaimerAccepted || !empSignData || !respSignData) ? 'none' : '0 4px 12px rgba(41,65,107,0.3)',
                      }}>
                      <CheckCircle size={18} />
                      {saving ? 'Procesando...' : 'Completar cambio de prenda'}
                    </button>
                  </div>
                </div>
              )}

              {/* Vista de solo lectura cuando está completado */}
              {completed && (
                <div className="no-print card" style={{ padding: '1.25rem', borderLeft: '3px solid #10b981' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <PackageCheck size={18} color="#059669" />
                    <span style={{ fontWeight: 700, color: '#065f46', fontSize: '0.95rem' }}>Cambio completado</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#374151', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.4rem' }}>
                    <div><span style={{ color: '#64748b', fontSize: '0.72rem' }}>COMPLETADO</span><div>{change.completed_at ? new Date(change.completed_at).toLocaleString('es-UY') : '—'}</div></div>
                    {change.remito_delivery_number && <div><span style={{ color: '#64748b', fontSize: '0.72rem' }}>REMITO ENTREGA</span><div style={{ fontFamily: 'monospace' }}>{change.remito_delivery_number}</div></div>}
                    {change.remito_return_number && <div><span style={{ color: '#64748b', fontSize: '0.72rem' }}>REMITO DEVOLUCIÓN</span><div style={{ fontFamily: 'monospace' }}>{change.remito_return_number}</div></div>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                    {change.delivery_receipt_url && (
                      <a href={change.delivery_receipt_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <FileText size={12} /> Ver remito entrega
                      </a>
                    )}
                    {change.return_receipt_url && (
                      <a href={change.return_receipt_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <FileText size={12} /> Ver remito devolución
                      </a>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
