'use client';

import { useRef, useState } from 'react';
import { Edit2, X, CheckCircle2 } from 'lucide-react';
import AgendaSignatureCanvas, { type AgendaSignatureCanvasRef } from './AgendaSignatureCanvas';

interface Props {
  endpoint: string;              // URL del POST (ej /api/logistica/agenda/appointments/123/sign)
  fieldName: string;             // Campo FormData que espera el endpoint (ej 'file', 'approver_signature')
  extraFields?: Record<string, string>; // Campos extra del FormData (ej { type: 'employee' })
  title: string;                 // Título del modal
  label?: string;                // Descripción encima del canvas
  onSaved: (responseJson: any) => void;
  buttonLabel?: string;          // Default: "Reemplazar firma"
  buttonStyle?: React.CSSProperties;
}

export default function SignatureReplaceButton({
  endpoint,
  fieldName,
  extraFields,
  title,
  label,
  onSaved,
  buttonLabel = 'Reemplazar firma',
  buttonStyle,
}: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<AgendaSignatureCanvasRef | null>(null);

  const close = () => {
    setOpen(false);
    setData(null);
    setError(null);
  };

  const handleSave = async () => {
    setError(null);
    if (!data) { setError('La firma está vacía'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      // Convertir dataURL a Blob para ser compatible con endpoints que solo aceptan File.
      const m = data.match(/^data:(image\/(?:png|jpeg|jpg));base64,(.+)$/);
      if (!m) {
        setError('Firma inválida');
        return;
      }
      const mime = m[1];
      const bin = atob(m[2]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      const ext = mime === 'image/png' ? 'png' : 'jpg';
      fd.append(fieldName, blob, `firma.${ext}`);
      if (extraFields) {
        for (const [k, v] of Object.entries(extraFields)) fd.append(k, v);
      }
      const res = await fetch(endpoint, { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Error al guardar firma'); return; }
      onSaved(json);
      close();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          fontSize: '0.72rem',
          color: '#2563eb',
          background: 'none',
          border: '1px solid #bfdbfe',
          borderRadius: '4px',
          padding: '0.2rem 0.55rem',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          ...buttonStyle,
        }}
      >
        <Edit2 size={11} /> {buttonLabel}
      </button>

      {open && (
        <div
          onClick={close}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="card"
            style={{ width: '520px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', padding: '1.25rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{title}</h3>
              <button onClick={close} disabled={saving} style={{ background: 'none', border: 'none', cursor: saving ? 'wait' : 'pointer', color: '#94a3b8' }}><X size={18} /></button>
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.5rem 0.7rem', marginBottom: '0.7rem', fontSize: '0.78rem', color: '#7f1d1d' }}>{error}</div>
            )}

            <AgendaSignatureCanvas ref={canvasRef} onChange={setData} label={label || 'Dibuje la nueva firma'} />

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button onClick={close} disabled={saving} className="btn btn-secondary" style={{ fontSize: '0.82rem' }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving || !data} className="btn btn-primary" style={{ fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <CheckCircle2 size={14} /> {saving ? 'Guardando...' : 'Guardar firma'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
