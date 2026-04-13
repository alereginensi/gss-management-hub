'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Search, Upload, Truck, X, Scan, FileText, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { useTicketContext, hasModuleAccess } from '@/app/context/TicketContext';
import LogoutExpandButton from '@/app/components/LogoutExpandButton';
import AgendaSignatureCanvas, { AgendaSignatureCanvasRef } from '@/app/components/AgendaSignatureCanvas';
import { getShipmentStatusBadge } from '@/lib/agenda-ui';
import type { ShipmentStatus } from '@/lib/agenda-types';

const SHIPMENT_STATUSES: ShipmentStatus[] = ['preparado', 'despachado', 'en_transito', 'entregado', 'recibido', 'incidente'];

export default function EnviosInteriorPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <EnviosInteriorContent />
    </Suspense>
  );
}

function EnviosInteriorContent() {
  const { currentUser, isAuthenticated, loading, logout, isMobile } = useTicketContext();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [shipments, setShipments] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  
  // Nuevo estado para el formulario extendido
  const [newForm, setNewForm] = useState({ 
    employee_id: '', 
    tracking_number: '', 
    carrier: '', 
    destination: '',
    weight: '',
    declared_value: '',
    description: '',
    notes: '',
    invoice_image_url: ''
  });
  
  const [newError, setNewError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ocring, setOcring] = useState(false);
  
  const signRef = useRef<HTMLInputElement>(null);
  const invoiceRef = useRef<HTMLInputElement>(null);
  const supCanvasRef = useRef<AgendaSignatureCanvasRef>(null);
  const [signError, setSignError] = useState<string | null>(null);
  const [supSignature, setSupSignature] = useState<string | null>(null);

  // Carga inicial basada en params (Deep Link desde Citas)
  useEffect(() => {
    const aid = searchParams.get('appointment_id');
    const eid = searchParams.get('employee_id');
    if (aid && eid && !loading && isAuthenticated && employees.length === 0) {
      handleOpenWithParams(aid, eid);
    }
  }, [searchParams, loading, isAuthenticated]);

  const handleOpenWithParams = async (aid: string, eid: string) => {
    await loadEmployees();
    setNewForm(f => ({ ...f, employee_id: eid, appointment_id: aid } as any));
    
    // Opcional: Cargar descripción desde la cita
    try {
      const res = await fetch(`/api/logistica/agenda/appointments/${aid}`);
      if (res.ok) {
        const data = await res.json();
        const items = data.delivered_order_items || data.order_items || [];
        const desc = items.map((i: any) => `${i.article_type || i.item} ${i.size || ''}`).join(', ');
        setNewForm(f => ({ ...f, description: desc }));
      }
    } catch (e) {}
    
    setShowNewModal(true);
  };

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (currentUser && !hasModuleAccess(currentUser, 'logistica')) { router.push('/'); return; }
  }, [loading, isAuthenticated, currentUser, router]);

  const fetchShipments = useCallback(async () => {
    setFetching(true);
    try {
      const p = new URLSearchParams({ limit: '100' });
      if (search) p.set('search', search);
      if (filterStatus) p.set('status', filterStatus);
      const res = await fetch(`/api/logistica/agenda/shipments?${p}`);
      if (!res.ok) {
        console.error('Error fetching shipments:', res.statusText);
        return;
      }
      const data = await res.json();
      setShipments(data.shipments || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally { setFetching(false); }
  }, [search, filterStatus]);

  useEffect(() => {
    if (!isAuthenticated || loading) return;
    const t = setTimeout(fetchShipments, 300);
    return () => clearTimeout(t);
  }, [fetchShipments, isAuthenticated, loading]);

  const openDetail = async (s: any) => {
    const res = await fetch(`/api/logistica/agenda/shipments/${s.id}`);
    const data = await res.json();
    setSelected(data);
    setSignError(null);
    setShowModal(true);
  };

  const handleUpdateStatus = async (id: number, status: ShipmentStatus) => {
    await fetch(`/api/logistica/agenda/shipments/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shipment_status: status }),
    });
    fetchShipments();
    setSelected((s: any) => s ? { ...s, shipment_status: status } : s);
  };

  const handleUploadSign = async (file: File) => {
    if (!selected) return;
    setSaving(true); setSignError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/logistica/agenda/shipments/${selected.id}/sign`, { method: 'POST', body: fd });
      if (!res.ok) { const d = await res.json(); setSignError(d.error || 'Error'); return; }
      const d = await res.json();
      setSelected((s: any) => ({ ...s, receiver_signature_url: d.fileUrl, shipment_status: 'recibido' }));
      fetchShipments();
    } finally { setSaving(false); }
  };

  const loadEmployees = async () => {
    const res = await fetch('/api/logistica/agenda/employees?limit=500');
    const data = await res.json();
    setEmployees(data.employees || []);
  };

  const openNew = async () => {
    await loadEmployees();
    setNewForm({ 
      employee_id: '', 
      tracking_number: '', 
      carrier: '', 
      destination: '',
      weight: '',
      declared_value: '',
      description: '',
      notes: '',
      invoice_image_url: ''
    });
    setNewError(null);
    setSupSignature(null);
    setShowNewModal(true);
  };

  // --- Lógica de OCR ---
  const handleScanInvoice = async (file: File) => {
    setOcring(true);
    setNewError(null);
    try {
      // 1. Subir la imagen primero para tener la URL
      const fdUpload = new FormData();
      fdUpload.append('file', file);
      const resUpload = await fetch('/api/logistica/shipments/upload', { method: 'POST', body: fdUpload });
      if (!resUpload.ok) throw new Error('Error al subir imagen');
      const { url } = await resUpload.json();
      setNewForm(f => ({ ...f, invoice_image_url: url }));

      // 2. Ejecutar OCR
      const fdOcr = new FormData();
      fdOcr.append('file', file);
      const resOcr = await fetch('/api/logistica/agenda/shipments/ocr', { method: 'POST', body: fdOcr });
      if (!resOcr.ok) throw new Error('Error en el servicio de OCR');
      const { text } = await resOcr.json();

      // 3. Parsear texto (Heurística simple para tracking y transportista)
      let tracking = '';
      let carrier = '';
      
      // Patrón común DAC: DAC seguidos de números o letras
      const dacMatch = text.match(/DAC[-\s]?([A-Z0-9]+)/i);
      if (dacMatch) {
         tracking = dacMatch[0].toUpperCase();
         carrier = 'DAC';
      }

      // Correo Uruguayo / Otros
      if (!tracking) {
        const genMatch = text.match(/(?:tracking|nro|nº|guia)[:\s]*([A-Z0-9]{5,})/i);
        if (genMatch) tracking = genMatch[1];
      }

      setNewForm(f => ({ 
        ...f, 
        tracking_number: tracking || f.tracking_number,
        carrier: carrier || f.carrier,
        notes: (f.notes ? f.notes + '\n' : '') + 'Escaneado automáticamente'
      }));

    } catch (err: any) {
      setNewError('Error durante el escaneo: ' + err.message);
    } finally {
      setOcring(false);
    }
  };

  const handleCreateShipment = async () => {
    if (!newForm.employee_id) { setNewError('Seleccionar empleado'); return; }
    if (!supSignature) { setNewError('Firma del supervisor requerida'); return; }
    setSaving(true); setNewError(null);
    try {
      const res = await fetch('/api/logistica/agenda/shipments', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          employee_id: parseInt(newForm.employee_id), 
          tracking_number: newForm.tracking_number || undefined, 
          carrier: newForm.carrier || undefined, 
          destination: newForm.destination || undefined,
          weight: newForm.weight ? parseFloat(newForm.weight) : undefined,
          declared_value: newForm.declared_value ? parseFloat(newForm.declared_value) : undefined,
          description: newForm.description || undefined,
          invoice_image_url: newForm.invoice_image_url || undefined,
          notes: newForm.notes || undefined,
          supervisor_signature_data: supSignature
        }),
      });
      const data = await res.json();
      if (!res.ok) { setNewError(data.error || 'Error'); return; }
      setShowNewModal(false);
      fetchShipments();
    } finally { setSaving(false); }
  };

  if (loading || !currentUser) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      {/* Estilos adicionales */}
      <style jsx global>{`
        .premium-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          transition: all 0.2s ease;
        }
        .btn-ocr {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
          font-size: 0.8rem;
          transition: opacity 0.2s;
        }
        .btn-ocr:hover { opacity: 0.9; }
        .btn-ocr:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>

      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '56px',
        backgroundColor: '#29416b', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '0 1rem' : '0 1.5rem', zIndex: 100, borderBottom: '3px solid #e04951', boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/logistica/agenda/admin" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.78rem' }}>
            <ArrowLeft size={13} />{!isMobile && ' Logística'}
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="GSS" style={{ maxHeight: '28px', filter: 'brightness(0) invert(1)' }} />
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>Envíos al Interior</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {!isMobile && <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem' }}>{currentUser.name}</span>}
          <LogoutExpandButton onClick={() => { logout(); router.push('/login'); }} />
        </div>
      </header>

      <main style={{ marginTop: '56px', padding: isMobile ? '1.5rem 1rem' : '2.5rem 2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Truck size={32} className="text-blue-600" /> Envíos al Interior
              </h1>
              <p style={{ color: '#64748b', margin: '0.5rem 0 0', fontSize: '0.95rem' }}>Gestión centralizada de remisiones y entregas nacionales.</p>
            </div>
            <button onClick={openNew} className="btn-ocr" style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem' }}>
              <Plus size={18} /> Crear Nuevo Envío
            </button>
          </div>

          {/* Filtros */}
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 300px' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por empleado, documento o número de tracking..."
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.7rem 1rem 0.7rem 2.5rem', fontSize: '0.9rem', outline: 'none' }} />
              </div>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} 
                style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.7rem 1rem', fontSize: '0.9rem', minWidth: '180px', outline: 'none' }}>
                <option value="">Todos los Estados</option>
                {SHIPMENT_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</option>)}
              </select>
            </div>
          </div>

          {/* Tabla de Envíos */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    {['Destinatario', 'Tracking / Transportista', 'Destino', 'Estado', 'Fecha Envió', 'Firma', ''].map(h => (
                      <th key={h} style={{ padding: '1rem 1.5rem', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ backgroundColor: 'white' }}>
                  {fetching ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
                      <div className="animate-pulse">Cargando envíos...</div>
                    </td></tr>
                  ) : shipments.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>No se encontraron registros de envío.</td></tr>
                  ) : shipments.map((s: any) => {
                    const badge = getShipmentStatusBadge(s.shipment_status);
                    return (
                      <tr key={s.id} className="premium-hover" style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }} onClick={() => openDetail(s)}>
                        <td style={{ padding: '1.25rem 1.5rem' }}>
                          <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>{s.employee_nombre}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>CI: {s.employee_documento} • {s.employee_empresa}</div>
                        </td>
                        <td style={{ padding: '1.25rem 1.5rem' }}>
                          <div style={{ fontFamily: 'Monaco, monospace', fontSize: '0.85rem', color: '#334155', fontWeight: 600 }}>{s.tracking_number || '(Sin Tracking)'}</div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>{s.carrier || 'Transportista no espec.'}</div>
                        </td>
                        <td style={{ padding: '1.25rem 1.5rem', color: '#475569', fontSize: '0.85rem' }}>
                          {s.destination || '—'}
                        </td>
                        <td style={{ padding: '1.25rem 1.5rem' }}>
                          <span style={{ background: badge.bg, color: badge.color, borderRadius: '20px', padding: '0.25rem 0.75rem', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>
                            {badge.label}
                          </span>
                        </td>
                        <td style={{ padding: '1.25rem 1.5rem', color: '#64748b', fontSize: '0.85rem' }}>
                          {s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                          {s.receiver_signature_url ? <span style={{ color: '#10b981' }}>●</span> : <span style={{ color: '#e2e8f0' }}>○</span>}
                        </td>
                        <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                          <FileText size={18} style={{ color: '#94a3b8' }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Modal Detalle */}
      {showModal && selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1.5rem' }}>
          <div className="card" style={{ width: '700px', maxWidth: '100%', maxHeight: '95vh', overflowY: 'auto', padding: 0, border: 'none', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.25rem', color: '#1e293b' }}>Detalles del Envío #{selected.id}</h3>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{new Date(selected.created_at).toLocaleString()}</span>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
            </div>

            <div style={{ padding: '2rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '2rem', marginBottom: '2.5rem' }}>
                <div>
                  <h4 style={{ margin: '0 0 1rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>Información del Destinatario</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div><label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>Nombre Completo</label><strong style={{ color: '#0f172a' }}>{selected.employee_nombre}</strong></div>
                    <div><label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>Documento</label><span style={{ fontFamily: 'monospace' }}>{selected.employee_documento}</span></div>
                    <div><label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>Empresa / Sector</label><span>{selected.employee_empresa} - {selected.employee_sector}</span></div>
                    <div><label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>Dirección de Destino</label><strong>{selected.destination || 'Retiro en agencia / No especificado'}</strong></div>
                  </div>
                </div>
                <div>
                  <h4 style={{ margin: '0 0 1rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>Datos Logísticos</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div><label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>Nro. Tracking</label><strong style={{ color: '#2563eb', fontFamily: 'monospace' }}>{selected.tracking_number || 'PENDIENTE'}</strong></div>
                    <div><label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>Transportista</label><span>{selected.carrier || '—'}</span></div>
                    <div style={{ display: 'flex', gap: '1.5rem' }}>
                      <div><label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>Peso</label><span>{selected.weight ? `${selected.weight} kg` : '—'}</span></div>
                      <div><label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>Valor Decl.</label><span>{selected.declared_value ? `$ ${selected.declared_value}` : '—'}</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {selected.description && (
                <div style={{ marginBottom: '2rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>Descripción del Contenido</label>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', whiteSpace: 'pre-wrap' }}>{selected.description}</p>
                </div>
              )}

              {selected.supervisor_signature_url && (
                <div style={{ marginBottom: '2rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Firma Autorizante (Supervisor)</label>
                  <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '1rem', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                    <img src={selected.supervisor_signature_url} alt="Firma Supervisor" style={{ maxHeight: '100px', margin: '0 auto' }} />
                  </div>
                </div>
              )}

              {/* Imagen de Factura/Remito */}
              {selected.invoice_image_url && (
                <div style={{ marginBottom: '2rem' }}>
                   <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Comprobante / Factura</label>
                   <div style={{ border: '2px dashed #e2e8f0', borderRadius: '12px', padding: '0.5rem', textAlign: 'center' }}>
                      <img src={selected.invoice_image_url} alt="Factura" style={{ maxWidth: '100%', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                      <div style={{ marginTop: '0.75rem' }}>
                        <a href={selected.invoice_image_url} target="_blank" className="btn btn-secondary" style={{ fontSize: '0.75rem' }}>Ver tamaño completo</a>
                      </div>
                   </div>
                </div>
              )}

              {/* Control de Estado */}
              <div style={{ marginBottom: '2.5rem' }}>
                <h4 style={{ margin: '0 0 1rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>Actualizar Estado del Envío</h4>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {SHIPMENT_STATUSES.map(s => {
                    const badge = getShipmentStatusBadge(s);
                    const isActive = selected.shipment_status === s;
                    return (
                      <button key={s} onClick={() => handleUpdateStatus(selected.id, s)}
                        style={{ padding: '0.6rem 1rem', borderRadius: '30px', border: '2px solid', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700, transition: 'all 0.2s',
                          background: isActive ? badge.bg : 'transparent', color: isActive ? badge.color : '#64748b',
                          borderColor: isActive ? badge.color : '#e2e8f0' }}>
                        {badge.label.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Firma */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>Confirmación de Entrega</h4>
                  {selected.receiver_signature_url && <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 600 }}>ENTREGADO CON FIRMA</span>}
                </div>
                
                {selected.receiver_signature_url ? (
                  <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                    <img src={selected.receiver_signature_url} alt="Firma" style={{ maxHeight: '120px', margin: '0 auto' }} />
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem', border: '2px dashed #f1f5f9', borderRadius: '8px' }}>
                    <ImageIcon size={32} style={{ color: '#cbd5e1', marginBottom: '0.5rem' }} />
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Aún no se ha registrado firma de recepción.</p>
                  </div>
                )}
                
                {signError && <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '1rem' }}>{signError}</div>}
                
                <input type="file" ref={signRef} style={{ display: 'none' }} accept="image/*"
                  onChange={e => { if (e.target.files?.[0]) handleUploadSign(e.target.files[0]); }} />
                <button onClick={() => signRef.current?.click()} disabled={saving} className="btn btn-secondary" style={{ marginTop: '1rem', width: '100%', justifyContent: 'center' }}>
                  {saving ? 'Procesando...' : <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Upload size={16} /> Subir Comprobante de Entrega</span>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo Envío con OCR */}
      {showNewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1.5rem' }}>
          <div className="card" style={{ width: '850px', maxWidth: '100%', maxHeight: '95vh', display: 'flex', flexDirection: 'column', padding: 0, border: 'none', borderRadius: '16px' }}>
            
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.25rem', color: '#1e293b' }}>Registrar Envío al Interior</h3>
              <button onClick={() => setShowNewModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '350px 1fr', overflowY: 'auto' }}>
              
              {/* Panel Izquierdo: OCR y Foto */}
              <div style={{ padding: '2rem', borderRight: isMobile ? 'none' : '1px solid #e2e8f0', background: '#f8fafc' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '1rem', textTransform: 'uppercase' }}>Escaneo Inteligente (OCR)</label>
                  
                  <div style={{ 
                    border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', 
                    background: newForm.invoice_image_url ? 'white' : 'transparent',
                    cursor: 'pointer' 
                  }} onClick={() => invoiceRef.current?.click()}>
                    
                    {newForm.invoice_image_url ? (
                      <div style={{ position: 'relative' }}>
                        <img src={newForm.invoice_image_url} alt="Invoice" style={{ width: '100%', borderRadius: '8px' }} />
                        <div style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#ef4444', color: 'white', borderRadius: '50%', padding: '4px' }}
                          onClick={(e) => { e.stopPropagation(); setNewForm(f => ({ ...f, invoice_image_url: '' })); }}>
                          <X size={14} />
                        </div>
                      </div>
                    ) : (
                      <>
                        <Scan size={40} style={{ color: '#94a3b8', margin: '0 auto 1rem' }} />
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>Sube una foto de la factura para autocompletar</p>
                      </>
                    )}
                  </div>
                  
                  <input type="file" ref={invoiceRef} style={{ display: 'none' }} accept="image/*"
                    onChange={e => { if (e.target.files?.[0]) handleScanInvoice(e.target.files[0]); }} />
                  
                  <button className="btn-ocr" style={{ width: '100%', marginTop: '1rem', height: '45px', justifyContent: 'center' }} 
                    disabled={ocring} onClick={() => invoiceRef.current?.click()}>
                    {ocring ? 'Extrayendo datos...' : <><Scan size={18} /> Escanear Comprobante</>}
                  </button>
                  
                  {newError && <div style={{ marginTop: '1rem', color: '#ef4444', fontSize: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                    <AlertCircle size={14} /> {newError}
                  </div>}
                </div>
                
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
                   * El sistema intentará identificar el transportista, el número de guía y vincular los datos automáticamente.
                </div>
              </div>

              {/* Panel Derecho: Formulario */}
              <div style={{ padding: '2rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>Empleado / Destinatario *</label>
                    <select value={newForm.employee_id} onChange={e => setNewForm(f => ({ ...f, employee_id: e.target.value }))}
                      style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem', fontSize: '0.9rem', background: 'white' }}>
                      <option value="">Seleccionar empleado...</option>
                      {employees.map((e: any) => <option key={e.id} value={e.id}>{e.nombre} ({e.documento})</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>Transportista</label>
                      <input value={newForm.carrier} onChange={e => setNewForm(f => ({ ...f, carrier: e.target.value }))} placeholder="Ej: DAC, Correo, etc."
                        style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem', fontSize: '0.9rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>Nro. de Tracking</label>
                      <input value={newForm.tracking_number} onChange={e => setNewForm(f => ({ ...f, tracking_number: e.target.value }))} placeholder="Número de guía"
                        style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem', fontSize: '0.9rem', fontFamily: 'monospace' }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>Dirección de Destino / Agencia</label>
                    <input value={newForm.destination} onChange={e => setNewForm(f => ({ ...f, destination: e.target.value }))} placeholder="Ej: Agencia DAC Florida / Domicilio Calle X..."
                      style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem', fontSize: '0.9rem' }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>Peso (kg)</label>
                      <input type="number" step="0.1" value={newForm.weight} onChange={e => setNewForm(f => ({ ...f, weight: e.target.value }))} placeholder="0.0"
                        style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem', fontSize: '0.9rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>Valor Declarado ($)</label>
                      <input type="number" value={newForm.declared_value} onChange={e => setNewForm(f => ({ ...f, declared_value: e.target.value }))} placeholder="0.00"
                        style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem', fontSize: '0.9rem' }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>Descripción del Contenido</label>
                    <textarea value={newForm.description} onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Ej: 2 Pantalones, 1 Campera talle L..."
                      style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem', fontSize: '0.9rem', resize: 'vertical' }} />
                  </div>

                  <div style={{ marginTop: '0.5rem' }}>
                    <AgendaSignatureCanvas 
                      ref={supCanvasRef}
                      label="Firma del Supervisor (Requerida) *"
                      onChange={setSupSignature}
                    />
                  </div>

                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2.5rem' }}>
                  <button onClick={() => setShowNewModal(false)} className="btn btn-secondary" style={{ padding: '0.75rem 1.5rem' }}>Cancelar</button>
                  <button onClick={handleCreateShipment} disabled={saving || ocring} className="btn btn-primary" style={{ padding: '0.75rem 2rem', fontWeight: 800 }}>
                    {saving ? 'Procesando...' : 'Confirmar Envío'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
