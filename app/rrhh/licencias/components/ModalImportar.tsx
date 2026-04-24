'use client';

import { useRef, useState } from 'react';
import type { PreviewResult, ImportStrategy, ImportResult } from '../hooks/useLicenciasApi';

type Step = 'elegir' | 'preview' | 'resultado';

interface Props {
  onCerrar: () => void;
  onPreview: (file: File, year: number, strategy: ImportStrategy) => Promise<PreviewResult>;
  onImportar: (file: File, year: number, strategy: ImportStrategy) => Promise<ImportResult>;
}

export default function ModalImportar({ onCerrar, onPreview, onImportar }: Props) {
  const [step, setStep] = useState<Step>('elegir');
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [strategy, setStrategy] = useState<ImportStrategy>('upsert');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handlePreview() {
    if (!file) return;
    setWorking(true);
    setError(null);
    try {
      const res = await onPreview(file, year, strategy);
      setPreview(res);
      setStep('preview');
    } catch (e) {
      setError((e as Error).message || 'Error al leer el archivo');
    } finally {
      setWorking(false);
    }
  }

  async function handleImportar() {
    if (!file) return;
    setWorking(true);
    setError(null);
    try {
      const res = await onImportar(file, year, strategy);
      setResult(res);
      setStep('resultado');
    } catch (e) {
      setError((e as Error).message || 'Error al importar');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="lic-modal-overlay" onClick={onCerrar}>
      <div className="lic-modal lic-modal--xl" onClick={(e) => e.stopPropagation()}>
        <div className="lic-modal-header">
          <h3>
            {step === 'elegir' && 'Importar histórico — paso 1 de 2'}
            {step === 'preview' && 'Importar histórico — preview'}
            {step === 'resultado' && 'Importación completada'}
          </h3>
          <button type="button" className="lic-modal-close" onClick={onCerrar}>✕</button>
        </div>

        <div className="lic-modal-body">
          {/* ── Paso 1: elegir archivo + año ───────────────────────────── */}
          {step === 'elegir' && (
            <>
              <div
                className="lic-dropzone"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) setFile(f);
                }}
              >
                <p>{file ? <strong>{file.name}</strong> : 'Arrastrá el Excel o hacé click para elegir'}</p>
                <small>Se esperan las columnas: Remitente, Padron, Funcionario, Nombre del Servicio, SECTOR, Tipo de licencia, Desde, Hasta, Suplente, los 4 checks, Observaciones.</small>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <div className="lic-field-row" style={{ marginTop: 12 }}>
                <div className="lic-field" style={{ width: 160 }}>
                  <label>Año para fechas sin año</label>
                  <input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10) || new Date().getFullYear())} />
                </div>
                <div className="lic-field">
                  <label>Estrategia</label>
                  <select value={strategy} onChange={(e) => setStrategy(e.target.value as ImportStrategy)}>
                    <option value="upsert">Actualizar coincidencias + agregar nuevas (recomendado)</option>
                    <option value="merge">Agregar todo al final (puede duplicar)</option>
                    <option value="replace">Reemplazar TODO el histórico</option>
                  </select>
                </div>
              </div>

              <p className="lic-hint">
                <strong>Actualizar coincidencias</strong>: busca cada fila por <code>funcionario + fecha desde + tipo</code>; si existe la actualiza, si no la agrega. Ideal para re-subir un Excel corregido sin duplicar.<br />
                Las fechas del Excel vienen como <code>17-Jul</code> (sin año). El sistema usa el año que elijas acá para todas las filas.
              </p>

              {error && <div className="lic-modal-error">{error}</div>}
            </>
          )}

          {/* ── Paso 2: preview ─────────────────────────────────────────── */}
          {step === 'preview' && preview && (
            <PreviewBody preview={preview} strategy={strategy} year={year} />
          )}

          {/* ── Paso 3: resultado ──────────────────────────────────────── */}
          {step === 'resultado' && result && (
            <div className="lic-import-result">
              <h4>✓ Importación completada</h4>
              <ul>
                <li><strong>{result.insertados}</strong> licencias insertadas.</li>
                {result.actualizados > 0 && (
                  <li><strong>{result.actualizados}</strong> licencias actualizadas (existían ya y se sobrescribieron).</li>
                )}
                <li>{result.descartadas} filas descartadas por falta de datos obligatorios.</li>
                <li>Total leídas del Excel: {result.total_filas}.</li>
              </ul>
              {result.errores.length > 0 && (
                <details>
                  <summary>Errores ({result.errores.length})</summary>
                  <ul>{result.errores.map((e, i) => <li key={i}>{e}</li>)}</ul>
                </details>
              )}
            </div>
          )}
        </div>

        <div className="lic-modal-footer">
          {step === 'elegir' && (
            <>
              <button type="button" className="lic-btn" onClick={onCerrar} disabled={working}>Cancelar</button>
              <button type="button" className="lic-btn lic-btn--primary" onClick={handlePreview} disabled={!file || working}>
                {working ? 'Leyendo…' : 'Ver preview'}
              </button>
            </>
          )}
          {step === 'preview' && (
            <>
              <button type="button" className="lic-btn" onClick={() => setStep('elegir')} disabled={working}>← Volver</button>
              <button type="button" className="lic-btn lic-btn--primary" onClick={handleImportar} disabled={working}>
                {working
                  ? 'Importando…'
                  : strategy === 'upsert' && preview
                    ? `Confirmar (${preview.porInsertar ?? 0} nuevas · ${preview.porActualizar ?? 0} actualizar)`
                    : `Confirmar e importar ${preview?.validas ?? 0} filas`}
              </button>
            </>
          )}
          {step === 'resultado' && (
            <button type="button" className="lic-btn lic-btn--primary" onClick={onCerrar}>Cerrar</button>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewBody({ preview, strategy, year }: { preview: PreviewResult; strategy: ImportStrategy; year: number }) {
  return (
    <>
      <div className={`lic-preview-alert ${strategy === 'replace' ? 'lic-preview-alert--warn' : ''}`}>
        {strategy === 'replace' && (
          <>⚠ <strong>Modo &quot;Reemplazar TODO&quot;:</strong> al confirmar se van a borrar TODAS las licencias existentes antes de insertar las {preview.validas} nuevas. Usá las otras opciones si querés conservar las que ya había.</>
        )}
        {strategy === 'merge' && (
          <>Modo <strong>&quot;Agregar todo al final&quot;</strong>: se van a sumar {preview.validas} licencias nuevas sin tocar las existentes (puede generar duplicados si re-subís un Excel). Año aplicado a fechas sin año: <strong>{year}</strong>.</>
        )}
        {strategy === 'upsert' && (
          <>Modo <strong>&quot;Actualizar coincidencias + agregar nuevas&quot;</strong>: busca por <code>funcionario + fecha desde + tipo de licencia</code>. Las existentes se sobrescriben, las nuevas se agregan. Año: <strong>{year}</strong>.</>
        )}
      </div>

      {strategy === 'upsert' && preview.porInsertar !== null && preview.porActualizar !== null && (
        <div className="lic-preview-stats" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 10 }}>
          <div className="lic-preview-stat lic-preview-stat--ok">
            <div className="lic-preview-stat-n">{preview.porInsertar}</div>
            <div className="lic-preview-stat-l">Nuevas (INSERT)</div>
          </div>
          <div className="lic-preview-stat" style={{ background: '#eaf2ff', borderColor: '#b8d4ff' }}>
            <div className="lic-preview-stat-n" style={{ color: '#1e40af' }}>{preview.porActualizar}</div>
            <div className="lic-preview-stat-l">Existentes (UPDATE)</div>
          </div>
        </div>
      )}

      <div className="lic-preview-stats">
        <div className="lic-preview-stat">
          <div className="lic-preview-stat-n">{preview.totalFilas}</div>
          <div className="lic-preview-stat-l">Filas en Excel</div>
        </div>
        <div className="lic-preview-stat lic-preview-stat--ok">
          <div className="lic-preview-stat-n">{preview.validas}</div>
          <div className="lic-preview-stat-l">Válidas</div>
        </div>
        <div className="lic-preview-stat lic-preview-stat--warn">
          <div className="lic-preview-stat-n">{preview.descartadas}</div>
          <div className="lic-preview-stat-l">Descartadas</div>
        </div>
        <div className="lic-preview-stat">
          <div className="lic-preview-stat-n">{preview.sinFechas}</div>
          <div className="lic-preview-stat-l">Sin fecha Desde</div>
        </div>
        <div className="lic-preview-stat">
          <div className="lic-preview-stat-n">{preview.sinSector}</div>
          <div className="lic-preview-stat-l">Sin sector válido</div>
        </div>
      </div>

      <div className="lic-preview-dist-grid">
        <div>
          <h5>Distribución por tipo</h5>
          <ul className="lic-preview-dist">
            {Object.entries(preview.porTipo).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
              <li key={t}><span>{t}</span><strong>{n}</strong></li>
            ))}
          </ul>
        </div>
        <div>
          <h5>Distribución por sector</h5>
          <ul className="lic-preview-dist">
            {Object.entries(preview.porSector).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
              <li key={s}><span>{s}</span><strong>{n}</strong></li>
            ))}
          </ul>
        </div>
      </div>

      <h5 style={{ marginTop: 14 }}>Primeras {preview.primeras.length} filas</h5>
      <div className="lic-preview-tabla-wrap">
        <table className="lic-preview-tabla">
          <thead>
            <tr>
              <th>Remitente</th>
              <th>Padrón</th>
              <th>Funcionario</th>
              <th>Sector</th>
              <th>Tipo</th>
              <th>Desde</th>
              <th>Hasta</th>
              <th>N/S/C/P</th>
            </tr>
          </thead>
          <tbody>
            {preview.primeras.map((r, i) => (
              <tr key={i}>
                <td>{r.remitente}</td>
                <td>{r.padron || '—'}</td>
                <td>{r.funcionario}</td>
                <td>{r.sector || <em style={{ color: '#9ca3af' }}>(sin)</em>}</td>
                <td>{r.tipo_licencia}</td>
                <td>{fmtDate(r.desde)}</td>
                <td>{fmtDate(r.hasta)}</td>
                <td className="lic-preview-checks">
                  <span className={r.recep_notificacion ? 'ok' : ''}>N</span>
                  <span className={r.supervision ? 'ok' : ''}>S</span>
                  <span className={r.recep_certificado ? 'ok' : ''}>C</span>
                  <span className={r.planificacion ? 'ok' : ''}>P</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {preview.errores.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', color: '#92400e', fontWeight: 600 }}>
            {preview.errores.length} filas descartadas — ver detalles
          </summary>
          <ul style={{ fontSize: 11, margin: '6px 0', paddingLeft: 18, color: '#6b7280' }}>
            {preview.errores.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </details>
      )}
    </>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
