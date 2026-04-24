'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Licencia, LicenciaField } from '../hooks/useLicenciasApi';
import { SECTORES, TIPOS_LICENCIA } from '@/lib/licencias-helpers';

interface Props {
  licencias: Licencia[];
  guardandoIds: Set<number>;
  onActualizar: <K extends LicenciaField>(id: number, field: K, value: Licencia[K]) => void;
  onEliminar: (id: number) => void;
}

export default function TablaLicencias({ licencias, guardandoIds, onActualizar, onEliminar }: Props) {
  if (licencias.length === 0) {
    return <div className="lic-empty">No hay licencias cargadas con los filtros actuales.</div>;
  }

  return (
    <div className="lic-tabla-wrap">
      <table className="lic-tabla">
        <thead>
          <tr>
            <th style={{ minWidth: 130 }}>Remitente</th>
            <th style={{ width: 60 }}>Padrón</th>
            <th style={{ minWidth: 160 }}>Funcionario</th>
            <th style={{ minWidth: 130 }}>Servicio</th>
            <th style={{ minWidth: 100 }}>Sector</th>
            <th style={{ minWidth: 140 }}>Tipo</th>
            <th style={{ width: 118 }}>Desde</th>
            <th style={{ width: 118 }}>Hasta</th>
            <th style={{ minWidth: 140 }}>Suplente</th>
            <th className="lic-check-th" title="Recepción Notificación">Notif</th>
            <th className="lic-check-th" title="Supervisión">Sup</th>
            <th className="lic-check-th" title="Recepción Certificado">Cert</th>
            <th className="lic-check-th" title="Planificación">Plan</th>
            <th style={{ minWidth: 180 }}>Observaciones</th>
            <th style={{ width: 36 }} />
          </tr>
        </thead>
        <tbody>
          {licencias.map((l) => (
            <Fila key={l.id} licencia={l} guardando={guardandoIds.has(l.id)} onActualizar={onActualizar} onEliminar={onEliminar} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Fila({ licencia: l, guardando, onActualizar, onEliminar }: { licencia: Licencia; guardando: boolean } & Pick<Props, 'onActualizar' | 'onEliminar'>) {
  const completa = l.recepNotificacion && l.supervision && l.recepCertificado && l.planificacion;
  const rowClass = `lic-row ${completa ? 'lic-row--ok' : 'lic-row--pending'}${guardando ? ' lic-row--saving' : ''}`;

  return (
    <tr className={rowClass}>
      <td><InputCelda value={l.remitente} onChange={(v) => onActualizar(l.id, 'remitente', v)} /></td>
      <td><InputCelda value={l.padron} onChange={(v) => onActualizar(l.id, 'padron', v)} /></td>
      <td><InputCelda value={l.funcionario} onChange={(v) => onActualizar(l.id, 'funcionario', v)} /></td>
      <td><InputCelda value={l.nombreServicio} onChange={(v) => onActualizar(l.id, 'nombreServicio', v)} /></td>
      <td>
        <select className="lic-select" value={l.sector} onChange={(e) => onActualizar(l.id, 'sector', e.target.value)}>
          <option value=""></option>
          {SECTORES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
      <td>
        <select className="lic-select" value={l.tipoLicencia} onChange={(e) => onActualizar(l.id, 'tipoLicencia', e.target.value)}>
          {TIPOS_LICENCIA.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>
      <td><input type="date" className="lic-input lic-date" value={l.desde} onChange={(e) => onActualizar(l.id, 'desde', e.target.value)} /></td>
      <td><input type="date" className="lic-input lic-date" value={l.hasta} onChange={(e) => onActualizar(l.id, 'hasta', e.target.value)} /></td>
      <td><InputCelda value={l.suplente} onChange={(v) => onActualizar(l.id, 'suplente', v)} /></td>
      <td className="lic-check-td">
        <Toggle value={l.recepNotificacion} onChange={(v) => onActualizar(l.id, 'recepNotificacion', v)} />
      </td>
      <td className="lic-check-td">
        <Toggle value={l.supervision} onChange={(v) => onActualizar(l.id, 'supervision', v)} />
      </td>
      <td className="lic-check-td">
        <Toggle value={l.recepCertificado} onChange={(v) => onActualizar(l.id, 'recepCertificado', v)} />
      </td>
      <td className="lic-check-td">
        <Toggle value={l.planificacion} onChange={(v) => onActualizar(l.id, 'planificacion', v)} />
      </td>
      <td><CeldaObservaciones value={l.observaciones} onChange={(v) => onActualizar(l.id, 'observaciones', v)} funcionario={l.funcionario} /></td>
      <td>
        <button
          type="button"
          className="lic-btn-delete"
          title="Eliminar licencia"
          onClick={() => {
            if (window.confirm(`Eliminar licencia de "${l.funcionario}"?`)) onEliminar(l.id);
          }}
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}

function InputCelda({ value, onChange, multiline }: { value: string; onChange: (v: string) => void; multiline?: boolean }) {
  const [local, setLocal] = useState(value);
  // sync si el valor externo cambia
  if (value !== local && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
    // no sobrescribir mientras el usuario está tipeando en este campo
  }
  if (multiline) {
    return (
      <textarea
        className="lic-input lic-textarea"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { if (local !== value) onChange(local); }}
        rows={1}
      />
    );
  }
  return (
    <input
      className="lic-input"
      type="text"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { if (local !== value) onChange(local); }}
    />
  );
}

function CeldaObservaciones({ value, onChange, funcionario }: { value: string; onChange: (v: string) => void; funcionario: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (editing) setDraft(value);
  }, [editing, value]);

  function guardar() {
    if (draft !== value) onChange(draft);
    setEditing(false);
  }

  return (
    <>
      <button
        type="button"
        className="lic-obs-cell"
        onClick={() => setEditing(true)}
        title={value || 'Click para agregar observación'}
      >
        {value ? value : <span className="lic-obs-placeholder">—</span>}
      </button>
      {editing && (
        <div className="lic-modal-overlay" onClick={() => setEditing(false)}>
          <div className="lic-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lic-modal-header">
              <h3>Observación · {funcionario}</h3>
              <button type="button" className="lic-modal-close" onClick={() => setEditing(false)}>✕</button>
            </div>
            <div className="lic-modal-body">
              <textarea
                autoFocus
                className="lic-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={8}
                style={{ width: '100%', fontSize: 13, lineHeight: 1.5, padding: 10, resize: 'vertical', minHeight: 140 }}
                onKeyDown={(e) => {
                  // Ctrl/Cmd + Enter guarda rápido
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); guardar(); }
                  if (e.key === 'Escape') { setEditing(false); }
                }}
              />
              <p className="lic-hint" style={{ marginTop: 6 }}>
                Ctrl+Enter para guardar · Esc para cancelar.
              </p>
            </div>
            <div className="lic-modal-footer">
              <button type="button" className="lic-btn" onClick={() => setEditing(false)}>Cancelar</button>
              <button type="button" className="lic-btn lic-btn--primary" onClick={guardar}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className={`lic-toggle ${value ? 'lic-toggle--on' : 'lic-toggle--off'}`}
      onClick={() => onChange(!value)}
      aria-pressed={value}
    >
      {value ? '✓' : '·'}
    </button>
  );
}
