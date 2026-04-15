'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Printer, Save, Upload, FileText, CheckCircle, X, Truck } from 'lucide-react';
import { useTicketContext, hasModuleAccess } from '@/app/context/TicketContext';
import LogoutExpandButton from '@/app/components/LogoutExpandButton';
import AgendaSignatureCanvas, { AgendaSignatureCanvasRef } from '@/app/components/AgendaSignatureCanvas';
import { getAppointmentStatusBadge, renderOrderItemLabel } from '@/lib/agenda-ui';
import type { AppointmentStatus, OrderItem } from '@/lib/agenda-types';

const LEGAL_DISCLAIMER = `En el día de la fecha se hace entrega al/la Sr./Sra. firmante, del uniforme y/o equipamiento correspondiente para el cumplimiento de sus funciones, el cual se detalla a continuación.
Se deja expresa constancia de que, una vez realizada la entrega, el funcionario asume la responsabilidad sobre el uso adecuado, cuidado y conservación de los elementos proporcionados, comprometiéndose a devolverlos en condiciones proporcionales al tiempo de uso al momento de su desvinculación, traslado o cuando la empresa así lo requiera.
En caso de que las prendas entregadas sean devueltas en condiciones reutilizables, el funcionario acepta que el costo del lavado será descontado de su salario. Asimismo, si las prendas no son devueltas o presentan un deterioro que exceda el desgaste razonable por el tiempo de uso, la empresa se reserva el derecho de descontar de su liquidación final el valor de reposición correspondiente.
El funcionario firma la presente en conformidad con lo aquí expuesto, dejando constancia de la recepción del uniforme y/o equipamiento en las condiciones detalladas.`;

const STATUSES: { value: AppointmentStatus; label: string }[] = [
  { value: 'confirmada', label: 'Confirmada' },
  { value: 'en_proceso', label: 'En Proceso' },
  { value: 'completada', label: 'Completada' },
  { value: 'cancelada', label: 'Cancelada' },
  { value: 'ausente', label: 'Ausente' },
  { value: 'reprogramada', label: 'Reprogramada' },
];

export default function CitaDetallePage() {
  const { currentUser, isAuthenticated, loading, logout, isMobile } = useTicketContext();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [appt, setAppt] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Estado edición
  const [status, setStatus] = useState<AppointmentStatus>('confirmada');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [remitoNumber, setRemitoNumber] = useState('');
  const [deliveredItems, setDeliveredItems] = useState<OrderItem[]>([]);
  const [rawRemitoText, setRawRemitoText] = useState('');

  // Firma (Canvas)
  const [empSignData, setEmpSignData] = useState<string | null>(null);
  const [respSignData, setRespSignData] = useState<string | null>(null);
  const empCanvasRef = useRef<AgendaSignatureCanvasRef>(null);
  const respCanvasRef = useRef<AgendaSignatureCanvasRef>(null);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  // Remito PDF
  const [uploadingRemito, setUploadingRemito] = useState(false);
  const remitoFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (currentUser && !hasModuleAccess(currentUser, 'logistica')) { router.push('/'); return; }
  }, [loading, isAuthenticated, currentUser, router]);

  useEffect(() => {
    if (!isAuthenticated || loading || !id) return;
    fetchAppt();
  }, [isAuthenticated, loading, id]);

  const fetchAppt = async () => {
    setFetching(true);
    try {
      const res = await fetch(`/api/logistica/agenda/appointments/${id}`);
      if (!res.ok) { setError('Cita no encontrada'); return; }
      const data = await res.json();
      setAppt(data);
      setStatus(data.status);
      setDeliveryNotes(data.delivery_notes || '');
      setRemitoNumber(data.remito_number || '');
      const items: OrderItem[] = Array.isArray(data.delivered_order_items) && data.delivered_order_items.length > 0
        ? data.delivered_order_items
        : (Array.isArray(data.order_items) ? data.order_items : []);
      setDeliveredItems(items.map(i => ({ ...i })));
    } finally {
      setFetching(false);
    }
  };

  const showMessage = (msg: string, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(null), 4000); }
    else { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); }
  };

  const handleSaveStatus = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/logistica/agenda/appointments/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, delivery_notes: deliveryNotes, remito_number: remitoNumber }),
      });
      if (!res.ok) { const d = await res.json(); showMessage(d.error || 'Error al guardar', true); return; }
      showMessage('Estado actualizado');
      fetchAppt();
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteDelivery = async () => {
    if (!remitoNumber.trim()) { showMessage('El número de remito es obligatorio', true); return; }
    if (!empSignData) { showMessage('La firma del empleado es obligatoria', true); return; }
    if (!respSignData) { showMessage('La firma del responsable es obligatoria', true); return; }
    if (!disclaimerAccepted) { showMessage('Debe aceptar el descargo legal', true); return; }

    if (!confirm('¿Marcar entrega como completada y crear artículos en el inventario?')) return;
    setSaving(true);
    try {
      // 1. Subir firmas primero
      const dataUrlToFile = (dataUrl: string, filename: string) => {
        const arr = dataUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) u8arr[n] = bstr.charCodeAt(n);
        return new File([u8arr], filename, { type: mime });
      };

      await Promise.all([
        handleUploadSign('employee', dataUrlToFile(empSignData, `firma-emp-${id}.png`)),
        handleUploadSign('responsible', dataUrlToFile(respSignData, `firma-resp-${id}.png`)),
      ]);

      // 2. Completar entrega
      const res = await fetch(`/api/logistica/agenda/appointments/${id}/delivery`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivered_order_items: deliveredItems, delivery_notes: deliveryNotes, remito_number: remitoNumber, create_articles: true }),
      });
      if (!res.ok) { const d = await res.json(); showMessage(d.error || 'Error al completar', true); return; }
      showMessage('Entrega completada — artículos creados en inventario');
      fetchAppt();
    } catch (err) {
      console.error(err);
      showMessage('Error al procesar la entrega', true);
    } finally {
      setSaving(false);
    }
  };

  const [uploadingSign, setUploadingSign] = useState<'employee' | 'responsible' | null>(null);
  const handleUploadSign = async (type: 'employee' | 'responsible', file: File) => {
    setUploadingSign(type);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', type);
      const res = await fetch(`/api/logistica/agenda/appointments/${id}/sign`, { method: 'POST', body: fd });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error al subir firma'); }
    } finally {
      setUploadingSign(null);
    }
  };

  const handleUploadRemito = async (file: File) => {
    setUploadingRemito(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (remitoNumber) fd.append('remito_number', remitoNumber);
      if (rawRemitoText.trim()) fd.append('raw_text', rawRemitoText);
      const res = await fetch(`/api/logistica/agenda/appointments/${id}/remito`, { method: 'POST', body: fd });
      if (!res.ok) { const d = await res.json(); showMessage(d.error || 'Error al subir remito', true); return; }
      showMessage('Remito subido');
      fetchAppt();
    } finally {
      setUploadingRemito(false);
    }
  };

  const updateDeliveredItem = (idx: number, field: keyof OrderItem, value: string | number) => {
    setDeliveredItems(items => items.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const removeDeliveredItem = (idx: number) => {
    setDeliveredItems(items => items.filter((_, i) => i !== idx));
  };

  const addDeliveredItem = () => {
    setDeliveredItems(items => [...items, { article_type: '', qty: 1 }]);
  };

  if (loading || !currentUser) return null;

  const badge = appt ? getAppointmentStatusBadge(appt.status) : null;
  const orderItems: OrderItem[] = appt ? (Array.isArray(appt.order_items) ? appt.order_items : []) : [];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <header className="no-print" style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '56px',
        backgroundColor: '#29416b', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '0 1rem' : '0 1.5rem', zIndex: 100, borderBottom: '3px solid #e04951', boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            onClick={() => router.back()} 
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.3rem', 
              color: 'rgba(255,255,255,0.7)', background: 'none', border: 'none', 
              cursor: 'pointer', padding: 0.2, fontSize: '0.78rem' 
            }}
          >
            <ArrowLeft size={13} /> Volver
          </button>
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>Cita #{id}</span>
          {badge && <span style={{ background: badge.bg, color: badge.color, borderRadius: '4px', padding: '0.15rem 0.5rem', fontSize: '0.72rem', fontWeight: 700 }}>{badge.label}</span>}
          {appt && appt.status === 'completada' && (
            <Link 
              href={`/logistica/agenda/admin/envios-interior?appointment_id=${id}&employee_id=${appt.employee_id}`}
              style={{ 
                background: '#10b981', color: 'white', borderRadius: '4px', padding: '0.15rem 0.5rem', 
                fontSize: '0.72rem', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem'
              }}
            >
              <Truck size={12} /> Preparar Envío
            </Link>
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
          {error && <div className="no-print" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#7f1d1d' }}>{error}</div>}
          {success && <div className="no-print" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#166534' }}>{success}</div>}

          {fetching ? (
            <div className="card" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Cargando cita...</div>
          ) : !appt ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Cita no encontrada.</div>
          ) : (
            <>
              {/* ── Constancia de Entrega (Imprimible) ── */}
              <div className="print-comprobante card" style={{ padding: '2rem', marginBottom: '1.25rem' }}>
                <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#000', marginBottom: '4px' }}>Constancia de Entrega de Uniformes</h1>
                <p style={{ fontSize: '0.8rem', color: '#555', marginBottom: '1.5rem' }}>
                  Fecha: {appt.delivered_at ? new Date(appt.delivered_at).toLocaleDateString('es-UY') : appt.slot_fecha}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 2rem', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Empleado</span>
                    <strong>{appt.employee_nombre}</strong>
                  </div>
                  <div>
                    <span style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Documento</span>
                    <span style={{ fontFamily: 'monospace' }}>{appt.employee_documento}</span>
                  </div>
                  <div>
                    <span style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Empresa</span>
                    {appt.employee_empresa || '—'}
                  </div>
                  <div>
                    <span style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Cargo</span>
                    {appt.employee_puesto || '—'}
                  </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  <thead>
                    <tr>
                      <th style={{ backgroundColor: '#f8fafc', padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, border: '1px solid #e2e8f0' }}>Prenda</th>
                      <th style={{ backgroundColor: '#f8fafc', padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, border: '1px solid #e2e8f0', width: '200px' }}>Talla / Color</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveredItems.length > 0 ? deliveredItems.map((item, i) => (
                      <tr key={i}>
                        <td style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0' }}>{item.article_type || (item as any).article_name_normalized || (item as any).item || 'Artículo'}</td>
                        <td style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0' }}>
                          {[item.size, (item as any).color].filter(Boolean).join(' · ') || '—'}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={2} style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', border: '1px solid #e2e8f0' }}>No hay ítems registrados</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {appt.remito_number && (
                  <p style={{ fontSize: '0.8rem', color: '#555', marginBottom: '1.5rem' }}>Remito N° {appt.remito_number}</p>
                )}

                <div style={{ border: '1px solid #e2e8f0', borderLeft: '4px solid #29416b', borderRadius: '4px', padding: '1rem', background: '#f8fafc', marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#29416b', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>Descargo Legal</div>
                  <div style={{ fontSize: '0.72rem', color: '#334155', whiteSpace: 'pre-wrap', fontStyle: 'italic', lineHeight: 1.5 }}>
                    {LEGAL_DISCLAIMER}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '3rem', marginTop: '2rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.5rem' }}>Firma Logística</div>
                    {appt.responsible_signature_url ? (
                      <img src={appt.responsible_signature_url} alt="Logística" style={{ maxHeight: '70px', borderBottom: '1px solid #e2e8f0' }} />
                    ) : <div style={{ height: '70px', width: '150px', borderBottom: '1px dashed #cbd5e1' }} />}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.5rem' }}>Firma Empleado</div>
                    {appt.employee_signature_url ? (
                      <img src={appt.employee_signature_url} alt="Empleado" style={{ maxHeight: '70px', borderBottom: '1px solid #e2e8f0' }} />
                    ) : <div style={{ height: '70px', width: '150px', borderBottom: '1px dashed #cbd5e1' }} />}
                  </div>
                </div>
              </div>

              {/* ── Panel de edición (no print) ── */}
              <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* Estado y notas */}
                <div className="card" style={{ padding: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>Estado de la cita</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Estado</label>
                      <select value={status} onChange={e => setStatus(e.target.value as AppointmentStatus)}
                        style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem' }}>
                        {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Nro. Remito</label>
                      <input value={remitoNumber} onChange={e => setRemitoNumber(e.target.value)}
                        placeholder="Ej: REM-0001"
                        style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Notas de entrega</label>
                      <textarea value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)} rows={2}
                        style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem', resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
                    <button onClick={handleSaveStatus} disabled={saving} className="btn btn-secondary" style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Save size={13} /> Guardar estado
                    </button>
                  </div>
                </div>

                {/* Ítems entregados */}
                <div className="card" style={{ padding: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>Ítems entregados</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
                    {deliveredItems.map((item, i) => (
                      <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <div style={{ flex: 3, fontSize: '0.8rem', color: '#1e293b', fontWeight: 600 }}>
                          {renderOrderItemLabel(item)}
                        </div>
                        <button onClick={() => removeDeliveredItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <button onClick={addDeliveredItem} className="btn btn-secondary" style={{ fontSize: '0.78rem' }}>+ Agregar ítem</button>
                    <button onClick={handleCompleteDelivery} disabled={saving} className="btn btn-primary" style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <CheckCircle size={13} /> Completar entrega
                    </button>
                  </div>
                </div>

                {/* Remito PDF */}
                <div className="card" style={{ padding: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>Remito PDF</h3>
                  {appt.remito_pdf_url && (
                    <div style={{ marginBottom: '0.75rem', fontSize: '0.82rem' }}>
                      <a href={appt.remito_pdf_url} target="_blank" rel="noopener noreferrer" style={{ color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <FileText size={14} /> Ver remito actual
                      </a>
                    </div>
                  )}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Texto del remito (para parse automático)</label>
                    <textarea value={rawRemitoText} onChange={e => setRawRemitoText(e.target.value)} rows={4}
                      placeholder="Pegar el texto del remito aquí para parse automático..."
                      style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.78rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'monospace' }} />
                  </div>
                  <input type="file" ref={remitoFileRef} style={{ display: 'none' }} accept=".pdf,image/*"
                    onChange={e => { if (e.target.files?.[0]) handleUploadRemito(e.target.files[0]); }} />
                  <button onClick={() => remitoFileRef.current?.click()} disabled={uploadingRemito} className="btn btn-secondary"
                    style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Upload size={13} /> {uploadingRemito ? 'Subiendo...' : 'Subir PDF de remito'}
                  </button>
                </div>

                {/* Firmas */}
                <div className="card" style={{ padding: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>Registro de Entrega</h3>
                  
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', whiteSpace: 'pre-wrap', fontStyle: 'italic', lineHeight: 1.4 }}>
                      {LEGAL_DISCLAIMER}
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#1e293b' }}>
                      <input type="checkbox" checked={disclaimerAccepted} onChange={e => setDisclaimerAccepted(e.target.checked)} />
                      Acepto el descargo legal y confirmo la recepción
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                    <AgendaSignatureCanvas 
                      ref={empCanvasRef}
                      label="Firma del empleado"
                      onChange={setEmpSignData}
                      disabled={appt.status === 'completada' || saving}
                    />
                    <AgendaSignatureCanvas 
                      ref={respCanvasRef}
                      label="Firma del responsable"
                      onChange={setRespSignData}
                      disabled={appt.status === 'completada' || saving}
                    />
                  </div>

                  {appt.status === 'completada' && (
                    <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                      <div>
                        <span style={{ fontSize: '0.7rem', display: 'block', color: '#64748b', marginBottom: '0.25rem' }}>Firma Empleado (Archivo)</span>
                        {appt.employee_signature_url ? <img src={appt.employee_signature_url} alt="Emp" style={{ maxHeight: '60px' }} /> : '—'}
                      </div>
                      <div>
                        <span style={{ fontSize: '0.7rem', display: 'block', color: '#64748b', marginBottom: '0.25rem' }}>Firma Responsable (Archivo)</span>
                        {appt.responsible_signature_url ? <img src={appt.responsible_signature_url} alt="Resp" style={{ maxHeight: '60px' }} /> : '—'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
