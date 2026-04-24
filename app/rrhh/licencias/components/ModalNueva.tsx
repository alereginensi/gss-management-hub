'use client';

import { useState } from 'react';
import { SECTORES, TIPOS_LICENCIA } from '@/lib/licencias-helpers';
import type { LicenciaEditable } from '../hooks/useLicenciasApi';

interface Props {
  remitentes: string[];
  onCerrar: () => void;
  onCrear: (data: Partial<LicenciaEditable>) => Promise<void>;
}

export default function ModalNueva({ remitentes, onCerrar, onCrear }: Props) {
  const [remitente, setRemitente] = useState('');
  const [funcionario, setFuncionario] = useState('');
  const [padron, setPadron] = useState('');
  const [sector, setSector] = useState('');
  const [tipoLicencia, setTipoLicencia] = useState<string>(TIPOS_LICENCIA[0]);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const puedeGuardar = remitente.trim() && funcionario.trim() && tipoLicencia;

  async function handleGuardar() {
    setError(null);
    if (!puedeGuardar) {
      setError('Remitente, funcionario y tipo son obligatorios.');
      return;
    }
    setSaving(true);
    try {
      await onCrear({
        remitente: remitente.trim(),
        funcionario: funcionario.trim(),
        padron: padron.trim(),
        sector,
        tipoLicencia,
        desde,
        hasta,
      });
      onCerrar();
    } catch (e) {
      setError((e as Error).message || 'Error al crear');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="lic-modal-overlay" onClick={onCerrar}>
      <div className="lic-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lic-modal-header">
          <h3>Nueva licencia</h3>
          <button type="button" className="lic-modal-close" onClick={onCerrar}>✕</button>
        </div>
        <div className="lic-modal-body">
          {error && <div className="lic-modal-error">{error}</div>}

          <div className="lic-field">
            <label>Remitente *</label>
            <input
              type="text"
              list="lic-remitentes"
              value={remitente}
              onChange={(e) => setRemitente(e.target.value)}
              placeholder="Quien reporta la licencia"
            />
            <datalist id="lic-remitentes">
              {remitentes.map((r) => <option key={r} value={r} />)}
            </datalist>
          </div>

          <div className="lic-field-row">
            <div className="lic-field">
              <label>Funcionario *</label>
              <input value={funcionario} onChange={(e) => setFuncionario(e.target.value)} />
            </div>
            <div className="lic-field" style={{ width: 120 }}>
              <label>Padrón</label>
              <input value={padron} onChange={(e) => setPadron(e.target.value)} />
            </div>
          </div>

          <div className="lic-field-row">
            <div className="lic-field">
              <label>Sector</label>
              <select value={sector} onChange={(e) => setSector(e.target.value)}>
                <option value="">—</option>
                {SECTORES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="lic-field">
              <label>Tipo *</label>
              <select value={tipoLicencia} onChange={(e) => setTipoLicencia(e.target.value)}>
                {TIPOS_LICENCIA.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="lic-field-row">
            <div className="lic-field">
              <label>Desde</label>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div className="lic-field">
              <label>Hasta</label>
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
          </div>

          <p className="lic-hint">Una vez creada, el resto de los campos (suplente, observaciones, checks) se editan directo en la tabla.</p>
        </div>
        <div className="lic-modal-footer">
          <button type="button" className="lic-btn" onClick={onCerrar} disabled={saving}>Cancelar</button>
          <button type="button" className="lic-btn lic-btn--primary" onClick={handleGuardar} disabled={!puedeGuardar || saving}>
            {saving ? 'Guardando…' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  );
}
