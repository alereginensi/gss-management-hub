'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Printer, Save, Upload, FileText, CheckCircle, X, Truck, PackagePlus, RotateCcw, Trash2, CalendarClock, Calendar, Clock, Plus, Loader2, XCircle } from 'lucide-react';
import { useTicketContext, canAccessAgenda } from '@/app/context/TicketContext';
import LogoutExpandButton from '@/app/components/LogoutExpandButton';
import AgendaSignatureCanvas, { AgendaSignatureCanvasRef } from '@/app/components/AgendaSignatureCanvas';
import SignatureReplaceButton from '@/app/components/SignatureReplaceButton';
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
  const searchParams = useSearchParams();
  const autoPrint = searchParams?.get('print') === '1';
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

  // Devolución opcional (con cambio)
  const [hasReturn, setHasReturn] = useState(false);
  const [remitoReturnNumber, setRemitoReturnNumber] = useState('');
  const [returnedItems, setReturnedItems] = useState<OrderItem[]>([]);
  const [uploadingReturnRemito, setUploadingReturnRemito] = useState(false);
  const returnFileRef = useRef<HTMLInputElement>(null);

  // Firma (Canvas)
  const [empSignData, setEmpSignData] = useState<string | null>(null);
  const [respSignData, setRespSignData] = useState<string | null>(null);
  const empCanvasRef = useRef<AgendaSignatureCanvasRef>(null);
  const respCanvasRef = useRef<AgendaSignatureCanvasRef>(null);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  // Remito PDF
  const [uploadingRemito, setUploadingRemito] = useState(false);
  const remitoFileRef = useRef<HTMLInputElement>(null);

  // Walk-in (vino fuera de su turno) — reasignar a otro slot del día
  const [walkinOpen, setWalkinOpen] = useState(false);
  const [walkinDate, setWalkinDate] = useState('');
  const [walkinSlots, setWalkinSlots] = useState<any[]>([]);
  const [walkinSlotId, setWalkinSlotId] = useState<number | null>(null);
  const [walkinLoadingSlots, setWalkinLoadingSlots] = useState(false);
  const [walkinShowCreate, setWalkinShowCreate] = useState(false);
  const [walkinNewStart, setWalkinNewStart] = useState('09:00');
  const [walkinNewEnd, setWalkinNewEnd] = useState('09:30');
  const [walkinCreatingSlot, setWalkinCreatingSlot] = useState(false);
  const [walkinMoving, setWalkinMoving] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (currentUser && !canAccessAgenda(currentUser)) { router.push('/'); return; }
  }, [loading, isAuthenticated, currentUser, router]);

  useEffect(() => {
    if (!isAuthenticated || loading || !id) return;
    fetchAppt();
  }, [isAuthenticated, loading, id]);

  // Auto-abrir diálogo de impresión si viene con ?print=1 (cita ya completada)
  useEffect(() => {
    if (!autoPrint || fetching || !appt || appt.status !== 'completada') return;
    const t = setTimeout(() => { try { window.print(); } catch {} }, 600);
    return () => clearTimeout(t);
  }, [autoPrint, fetching, appt]);

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

      setHasReturn(!!data.has_return);
      setRemitoReturnNumber(data.remito_return_number || '');
      const retItems: OrderItem[] = Array.isArray(data.returned_order_items) ? data.returned_order_items : [];
      setReturnedItems(retItems.map(i => ({ ...i })));
    } finally {
      setFetching(false);
    }
  };

  const showMessage = (msg: string, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(null), 4000); }
    else { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); }
  };

  // ── Walkin handlers ───────────────────────────────────────────────────────
  async function fetchWalkinSlots(date: string) {
    setWalkinSlots([]);
    setWalkinSlotId(null);
    setWalkinShowCreate(false);
    if (!date) return;
    setWalkinLoadingSlots(true);
    try {
      const res = await fetch(`/api/logistica/agenda/slots?from=${date}&to=${date}&limit=100`);
      const data = await res.json();
      const slots = (data?.slots || []).filter((s: any) => (s.estado ?? 'activo') === 'activo');
      setWalkinSlots(slots);
    } finally {
      setWalkinLoadingSlots(false);
    }
  }

  function resetWalkin() {
    setWalkinOpen(false);
    setWalkinDate('');
    setWalkinSlots([]);
    setWalkinSlotId(null);
    setWalkinShowCreate(false);
    setWalkinNewStart('09:00');
    setWalkinNewEnd('09:30');
  }

  async function handleWalkinCreateSlot() {
    if (!walkinDate || !walkinNewStart || !walkinNewEnd) return;
    setWalkinCreatingSlot(true);
    try {
      const res = await fetch('/api/logistica/agenda/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha: walkinDate, start_time: walkinNewStart, end_time: walkinNewEnd, capacity: 1 }),
      });
      const data = await res.json();
      if (!res.ok) { showMessage(data.error || 'Error al crear turno', true); return; }
      setWalkinShowCreate(false);
      await fetchWalkinSlots(walkinDate);
      if (data.id) setWalkinSlotId(data.id);
      showMessage('Turno creado');
    } finally {
      setWalkinCreatingSlot(false);
    }
  }

  async function handleWalkinMove() {
    if (!walkinSlotId) return;
    if (!confirm('¿Reasignar esta cita al turno seleccionado?')) return;
    setWalkinMoving(true);
    try {
      const res = await fetch(`/api/logistica/agenda/appointments/${id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_slot_id: walkinSlotId }),
      });
      const data = await res.json();
      if (!res.ok) { showMessage(data.error || 'Error al reasignar', true); return; }
      showMessage('Cita reasignada al nuevo turno');
      resetWalkin();
      fetchAppt();
    } finally {
      setWalkinMoving(false);
    }
  }

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

    if (hasReturn) {
      if (!remitoReturnNumber.trim()) { showMessage('El número de remito de devolución es obligatorio', true); return; }
      if (returnedItems.length === 0) { showMessage('Debe agregar al menos un ítem devuelto', true); return; }
    }

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
        body: JSON.stringify({
          delivered_order_items: deliveredItems,
          delivery_notes: deliveryNotes,
          remito_number: remitoNumber,
          create_articles: true,
          has_return: hasReturn ? 1 : 0,
          returned_order_items: hasReturn ? returnedItems : [],
          remito_return_number: hasReturn ? remitoReturnNumber : null,
        }),
      });
      if (!res.ok) { const d = await res.json(); showMessage(d.error || 'Error al completar', true); return; }
      showMessage('Entrega completada — artículos creados en inventario');
      await fetchAppt();
      // Auto-abrir diálogo de impresión para la constancia
      setTimeout(() => { try { window.print(); } catch {} }, 500);
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
      fd.append('kind', 'delivery');
      if (remitoNumber) fd.append('remito_number', remitoNumber);
      const res = await fetch(`/api/logistica/agenda/appointments/${id}/remito`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { showMessage(data.error || 'Error al subir remito', true); return; }

      const items = (data.items || []) as OrderItem[];
      if (items.length > 0) {
        setDeliveredItems(items.map(it => ({ ...it, qty: it.qty || 1 })));
        showMessage(`Remito subido — ${items.length} artículo(s) detectado(s)`);
      } else {
        showMessage('Remito subido, pero no se pudieron detectar artículos. Cargalos a mano.', true);
      }
      if (data.remitoNumber) setRemitoNumber(data.remitoNumber);
      if (data.parsedText && !deliveryNotes.trim()) {
        const firstLines = String(data.parsedText).split('\n').map((l: string) => l.trim()).filter(Boolean).slice(0, 3).join(' · ');
        if (firstLines) setDeliveryNotes(firstLines);
      }
      fetchAppt();
    } finally {
      setUploadingRemito(false);
    }
  };

  const handleUploadReturnRemito = async (file: File) => {
    setUploadingReturnRemito(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', 'return');
      if (remitoReturnNumber) fd.append('remito_number', remitoReturnNumber);
      const res = await fetch(`/api/logistica/agenda/appointments/${id}/remito`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { showMessage(data.error || 'Error al subir remito de devolución', true); return; }

      const items = (data.items || []) as OrderItem[];
      if (items.length > 0) {
        setReturnedItems(items.map(it => ({ ...it, qty: it.qty || 1 })));
        showMessage(`Remito de devolución subido — ${items.length} artículo(s) detectado(s)`);
      } else {
        showMessage('Remito de devolución subido, pero no se detectaron artículos. Cargalos a mano.', true);
      }
      if (data.remitoNumber && !remitoReturnNumber) setRemitoReturnNumber(data.remitoNumber);
      fetchAppt();
    } finally {
      setUploadingReturnRemito(false);
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

  const addReturnedItem = () => {
    setReturnedItems(items => [...items, { article_type: '', qty: 1 }]);
  };

  const removeReturnedItem = (idx: number) => {
    setReturnedItems(items => items.filter((_, i) => i !== idx));
  };

  const updateReturnedItem = (idx: number, field: keyof OrderItem, value: string | number) => {
    setReturnedItems(items => items.map((item, i) => i === idx ? { ...item, [field]: value } : item));
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
              {/* ── Constancia de Entrega (solo se renderiza si ya está completada) ── */}
              {appt.status === 'completada' && (
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

                {(appt.has_return || hasReturn) && returnedItems.length > 0 && (
                  <>
                    <h2 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#991b1b', marginTop: '1rem', marginBottom: '0.5rem' }}>Prendas devueltas</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '1rem' }}>
                      <thead>
                        <tr>
                          <th style={{ backgroundColor: '#fef2f2', padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, border: '1px solid #fecaca', color: '#991b1b' }}>Prenda</th>
                          <th style={{ backgroundColor: '#fef2f2', padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, border: '1px solid #fecaca', width: '200px', color: '#991b1b' }}>Talla / Color</th>
                        </tr>
                      </thead>
                      <tbody>
                        {returnedItems.map((item, i) => (
                          <tr key={i}>
                            <td style={{ padding: '0.5rem 0.75rem', border: '1px solid #fecaca' }}>{item.article_type || 'Artículo'}</td>
                            <td style={{ padding: '0.5rem 0.75rem', border: '1px solid #fecaca' }}>{[item.size, (item as any).color].filter(Boolean).join(' · ') || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(appt.remito_return_number || remitoReturnNumber) && (
                      <p style={{ fontSize: '0.8rem', color: '#555', marginBottom: '1.5rem' }}>Remito devolución N° {appt.remito_return_number || remitoReturnNumber}</p>
                    )}
                  </>
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
              )}

              {/* ── Panel de edición (no print) ── */}
              <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* Vino fuera de su turno — reasignar a otro slot */}
                {appt.status !== 'completada' && appt.status !== 'cancelada' && (
                  <div style={{
                    border: `1px solid ${walkinOpen ? '#fcd34d' : '#e2e8f0'}`,
                    background: walkinOpen ? '#fffbeb' : 'white',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    transition: 'all 0.15s',
                  }}>
                    <button
                      type="button"
                      onClick={() => { setWalkinOpen(v => !v); if (walkinOpen) resetWalkin(); }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.85rem 1rem', background: 'none', border: 'none', cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', fontWeight: 700, color: '#92400e' }}>
                        <CalendarClock size={16} style={{ color: '#d97706' }} />
                        Vino fuera de su turno
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {walkinOpen ? 'Cancelar' : 'Cambiar fecha y turno'}
                      </span>
                    </button>

                    {walkinOpen && (
                      <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid #fde68a', paddingTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#a16207' }}>
                          Seleccioná la fecha real de la entrega y el turno correspondiente. Si no hay turnos, podés crear uno.
                        </p>

                        <div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.3rem' }}>
                            <Calendar size={12} /> Fecha de la entrega
                          </label>
                          <input
                            type="date"
                            value={walkinDate}
                            onChange={e => { setWalkinDate(e.target.value); void fetchWalkinSlots(e.target.value); }}
                            style={{ width: '100%', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.5rem 0.7rem', fontSize: '0.85rem', boxSizing: 'border-box', background: 'white' }}
                          />
                        </div>

                        {walkinDate && (
                          <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.4rem' }}>
                              <Clock size={12} /> Turnos disponibles
                            </label>
                            {walkinLoadingSlots ? (
                              <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <Loader2 size={12} className="animate-spin" /> Cargando...
                              </p>
                            ) : walkinSlots.length === 0 ? (
                              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>No hay turnos para ese día.</p>
                            ) : (
                              <div className="walkin-slot-grid">
                                {walkinSlots.map((slot: any) => {
                                  const full = (slot.current_bookings ?? 0) >= (slot.capacity ?? 1);
                                  const selected = walkinSlotId === slot.id;
                                  return (
                                    <button
                                      key={slot.id}
                                      type="button"
                                      onClick={() => { if (!full || selected) setWalkinSlotId(slot.id); }}
                                      disabled={full && !selected}
                                      style={{
                                        padding: '0.5rem 0.3rem',
                                        borderRadius: '8px',
                                        fontSize: '0.78rem',
                                        fontWeight: 600,
                                        cursor: full && !selected ? 'not-allowed' : 'pointer',
                                        border: '1px solid',
                                        background: selected ? '#d97706' : full ? '#f1f5f9' : 'white',
                                        borderColor: selected ? '#d97706' : full ? '#e2e8f0' : '#e2e8f0',
                                        color: selected ? 'white' : full ? '#94a3b8' : '#334155',
                                        textAlign: 'center',
                                        lineHeight: 1.2,
                                      }}
                                    >
                                      {slot.start_time}
                                      {full && !selected && <div style={{ fontSize: '0.65rem', marginTop: '0.15rem', color: '#94a3b8' }}>Completo</div>}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {!walkinShowCreate ? (
                              <button
                                type="button"
                                onClick={() => setWalkinShowCreate(true)}
                                style={{ marginTop: '0.6rem', background: 'none', border: 'none', color: '#b45309', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: 0 }}
                              >
                                <Plus size={13} /> Crear turno en esta fecha
                              </button>
                            ) : (
                              <div style={{ marginTop: '0.75rem', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.75rem', background: 'white' }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>Nuevo turno</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                  <div>
                                    <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Inicio</label>
                                    <input type="time" value={walkinNewStart} onChange={e => setWalkinNewStart(e.target.value)}
                                      style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.5rem', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Fin</label>
                                    <input type="time" value={walkinNewEnd} onChange={e => setWalkinNewEnd(e.target.value)}
                                      style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.5rem', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
                                  <button type="button" onClick={() => setWalkinShowCreate(false)}
                                    style={{ flex: 1, padding: '0.4rem', fontSize: '0.78rem', background: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }}>
                                    Cancelar
                                  </button>
                                  <button type="button" onClick={() => void handleWalkinCreateSlot()} disabled={walkinCreatingSlot}
                                    style={{ flex: 2, padding: '0.4rem', fontSize: '0.78rem', background: '#d97706', color: 'white', border: 'none', borderRadius: '6px', cursor: walkinCreatingSlot ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontWeight: 600 }}>
                                    {walkinCreatingSlot ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                    Crear y seleccionar
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {walkinSlotId && (
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', paddingTop: '0.5rem', borderTop: '1px solid #fde68a' }}>
                            <span style={{ fontSize: '0.75rem', color: '#15803d', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', flex: 1 }}>
                              <CheckCircle size={13} /> Turno seleccionado
                            </span>
                            <button
                              type="button"
                              onClick={() => void handleWalkinMove()}
                              disabled={walkinMoving}
                              style={{ padding: '0.5rem 0.9rem', background: '#d97706', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700, cursor: walkinMoving ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            >
                              {walkinMoving ? <Loader2 size={13} className="animate-spin" /> : <CalendarClock size={13} />}
                              Reasignar cita
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

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
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                    <button onClick={addDeliveredItem} className="btn btn-secondary" style={{ fontSize: '0.78rem' }}>+ Agregar ítem</button>
                  </div>
                </div>

                {/* Remito PDF */}
                <div className="card" style={{ padding: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>Remito PDF</h3>
                  {appt.remito_pdf_url && (
                    <div style={{ marginBottom: '0.75rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <a href={`/api/logistica/agenda/appointments/${appt.id}/remito-pdf`} target="_blank" rel="noopener noreferrer" style={{ color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <FileText size={14} /> Ver remito actual
                      </a>
                      {appt.remito_filename && (
                        <span style={{ color: '#64748b', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: isMobile ? '160px' : '280px', whiteSpace: 'nowrap' }} title={appt.remito_filename}>
                          {appt.remito_filename}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm('¿Eliminar el remito de entrega? El PDF se quita de esta cita, número y texto parseado se vacían.')) return;
                          const res = await fetch(`/api/logistica/agenda/appointments/${appt.id}/remito?kind=delivery`, { method: 'DELETE' });
                          if (res.ok) { showMessage('Remito eliminado'); fetchAppt(); }
                          else { const d = await res.json().catch(() => ({})); showMessage(d.error || 'Error al eliminar', true); }
                        }}
                        style={{ background: 'none', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.3rem 0.6rem', fontSize: '0.72rem', color: '#b91c1c', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        <Trash2 size={12} /> Eliminar remito
                      </button>
                    </div>
                  )}
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: '#64748b' }}>
                    Al subir el PDF, los artículos y el número de remito se detectan automáticamente del archivo y se cargan en la lista de arriba.
                  </p>
                  <input type="file" ref={remitoFileRef} style={{ display: 'none' }} accept=".pdf,image/*"
                    onChange={e => { if (e.target.files?.[0]) handleUploadRemito(e.target.files[0]); }} />
                  <button onClick={() => remitoFileRef.current?.click()} disabled={uploadingRemito} className="btn btn-secondary"
                    style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Upload size={13} /> {uploadingRemito ? 'Subiendo...' : 'Subir PDF de remito'}
                  </button>
                </div>

                {/* Toggle devolución */}
                <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <RotateCcw size={15} /> Entrega con cambio
                    </div>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                      Activalo si, además de entregar, el empleado devuelve prendas. Se agrega un segundo remito y se imprime en la constancia.
                    </p>
                  </div>
                  <button
                    onClick={() => setHasReturn(v => !v)}
                    disabled={appt.status === 'completada' || saving}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.35rem',
                      padding: '0.4rem 0.75rem',
                      border: `1px solid ${hasReturn ? '#93c5fd' : '#e2e8f0'}`,
                      borderRadius: '6px',
                      background: hasReturn ? '#eff6ff' : '#fff',
                      color: hasReturn ? '#2563eb' : '#64748b',
                      fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    <PackagePlus size={14} /> {hasReturn ? 'Devolución habilitada' : 'Habilitar devolución'}
                  </button>
                </div>

                {hasReturn && (
                  <>
                    {/* Ítems devueltos */}
                    <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #dc2626' }}>
                      <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#991b1b' }}>Ítems devueltos por el empleado</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
                        {returnedItems.map((item, i) => (
                          <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <div style={{ flex: 3, fontSize: '0.8rem', color: '#1e293b', fontWeight: 600 }}>
                              {renderOrderItemLabel(item)}
                            </div>
                            <button onClick={() => removeReturnedItem(i)} aria-label="Eliminar ítem" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.25rem' }}>
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        {returnedItems.length === 0 && (
                          <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>Sin ítems devueltos. Agregá al menos uno.</p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                        <button onClick={addReturnedItem} className="btn btn-secondary" style={{ fontSize: '0.78rem' }}>+ Agregar ítem devuelto</button>
                      </div>
                    </div>

                    {/* Remito devolución */}
                    <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #dc2626' }}>
                      <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#991b1b' }}>Remito de devolución</h3>
                      <div style={{ marginBottom: '0.75rem' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Nro. Remito (devolución)</label>
                        <input value={remitoReturnNumber} onChange={e => setRemitoReturnNumber(e.target.value)}
                          placeholder="Ej: REM-DEV-0001"
                          style={{ width: '100%', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.45rem 0.7rem', fontSize: '0.82rem', boxSizing: 'border-box' }} />
                      </div>
                      {appt.remito_return_pdf_url && (
                        <div style={{ marginBottom: '0.75rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <a href={`/api/logistica/agenda/appointments/${appt.id}/remito-pdf?kind=return`} target="_blank" rel="noopener noreferrer" style={{ color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <FileText size={14} /> Ver remito devolución
                          </a>
                          {appt.remito_return_filename && (
                            <span style={{ color: '#64748b', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: isMobile ? '160px' : '280px', whiteSpace: 'nowrap' }} title={appt.remito_return_filename}>
                              {appt.remito_return_filename}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm('¿Eliminar el remito de devolución?')) return;
                              const res = await fetch(`/api/logistica/agenda/appointments/${appt.id}/remito?kind=return`, { method: 'DELETE' });
                              if (res.ok) { showMessage('Remito de devolución eliminado'); fetchAppt(); }
                              else { const d = await res.json().catch(() => ({})); showMessage(d.error || 'Error al eliminar', true); }
                            }}
                            style={{ background: 'none', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.3rem 0.6rem', fontSize: '0.72rem', color: '#b91c1c', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            <Trash2 size={12} /> Eliminar
                          </button>
                        </div>
                      )}
                      <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: '#991b1b' }}>
                        Al subir el PDF, los artículos devueltos se detectan automáticamente y se cargan en la lista de arriba.
                      </p>
                      <input type="file" ref={returnFileRef} style={{ display: 'none' }} accept=".pdf,image/*"
                        onChange={e => { if (e.target.files?.[0]) handleUploadReturnRemito(e.target.files[0]); }} />
                      <button onClick={() => returnFileRef.current?.click()} disabled={uploadingReturnRemito}
                        style={{ padding: '0.5rem 0.8rem', border: '1px solid #fecaca', background: '#fff', color: '#991b1b', borderRadius: '6px', fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                        <Upload size={13} /> {uploadingReturnRemito ? 'Subiendo...' : 'Subir PDF de remito devolución'}
                      </button>
                    </div>
                  </>
                )}

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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Firma Empleado</span>
                          <SignatureReplaceButton
                            endpoint={`/api/logistica/agenda/appointments/${appt.id}/sign`}
                            fieldName="file"
                            extraFields={{ type: 'employee' }}
                            title="Reemplazar firma del empleado"
                            label="Dibuje la nueva firma"
                            onSaved={(r) => setAppt((prev: any) => prev ? { ...prev, employee_signature_url: r.fileUrl } : prev)}
                          />
                        </div>
                        {appt.employee_signature_url ? <img src={appt.employee_signature_url} alt="Emp" style={{ maxHeight: '70px' }} /> : <span style={{ color: '#cbd5e1', fontSize: '0.78rem' }}>—</span>}
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Firma Responsable</span>
                          <SignatureReplaceButton
                            endpoint={`/api/logistica/agenda/appointments/${appt.id}/sign`}
                            fieldName="file"
                            extraFields={{ type: 'responsible' }}
                            title="Reemplazar firma del responsable"
                            label="Dibuje la nueva firma"
                            onSaved={(r) => setAppt((prev: any) => prev ? { ...prev, responsible_signature_url: r.fileUrl } : prev)}
                          />
                        </div>
                        {appt.responsible_signature_url ? <img src={appt.responsible_signature_url} alt="Resp" style={{ maxHeight: '70px' }} /> : <span style={{ color: '#cbd5e1', fontSize: '0.78rem' }}>—</span>}
                      </div>
                    </div>
                  )}
                </div>

                {/* Botón final — Completar entrega */}
                {appt.status !== 'completada' && (
                  <div className="card" style={{ padding: '1.25rem', borderTop: '4px solid #059669' }}>
                    <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', fontWeight: 800, color: '#065f46' }}>Finalizar entrega</h3>
                    <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', color: '#64748b' }}>
                      Al completar, se crean los artículos en inventario, se imprime la constancia y la cita pasa a estado <strong>Completada</strong>.
                    </p>
                    <button
                      onClick={handleCompleteDelivery}
                      disabled={saving}
                      className="btn btn-primary"
                      style={{ width: '100%', fontSize: '0.9rem', padding: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: 800 }}
                    >
                      <CheckCircle size={16} /> {saving ? 'Procesando...' : 'Completar entrega e imprimir constancia'}
                    </button>
                  </div>
                )}

                {appt.status === 'completada' && (
                  <div className="card" style={{ padding: '1.25rem', borderTop: '4px solid #2563eb', textAlign: 'center' }}>
                    <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', fontWeight: 800, color: '#1e40af' }}>Constancia lista</h3>
                    <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#64748b' }}>La cita ya fue completada. Podés imprimir la constancia cuando lo necesites.</p>
                    <button onClick={() => window.print()} className="btn btn-primary" style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Printer size={14} /> Imprimir constancia
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
