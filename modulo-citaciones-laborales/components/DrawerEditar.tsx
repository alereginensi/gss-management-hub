import React, { useRef } from 'react';
import { CitacionFormData } from '../types/citacion';
import { FacturasEditor } from './FacturasEditor';

interface Props {
  abierto: boolean;
  editandoId: string | null;
  formData: CitacionFormData;
  formError: string | null;
  onCerrar: () => void;
  onCampo: (campo: keyof CitacionFormData, valor: unknown) => void;
  onGuardar: () => void;
  // PDF adjunto / autofill
  pdfFile: File | null;
  pdfParsing: boolean;
  pdfError: string | null;
  pdfExistingFilename: string | null;
  pdfDetectedFields: string[];
  pdfWarningFields: string[];
  pdfDownloadUrl: string | null;
  onElegirPdf: (file: File | null) => void;
  onQuitarPdf: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  empresa: 'Empresa',
  org: 'Organismo',
  fecha: 'Fecha',
  hora: 'Hora',
  sede: 'Sede',
  trabajador: 'Trabajador',
  abogado: 'Abogado',
  rubros: 'Rubros',
  total: 'Total reclamado',
  motivo: 'Motivo',
};

export function DrawerEditar({
  abierto,
  editandoId,
  formData,
  formError,
  onCerrar,
  onCampo,
  onGuardar,
  pdfFile,
  pdfParsing,
  pdfError,
  pdfExistingFilename,
  pdfDetectedFields,
  pdfWarningFields,
  pdfDownloadUrl,
  onElegirPdf,
  onQuitarPdf,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handlePickFile = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    onElegirPdf(f);
    if (e.target) e.target.value = '';
  };
  // Auto-resize de textareas: crece con el contenido hasta un máximo, para
  // que no haya que scrollear dentro de un recuadro chico.
  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 400) + 'px';
  };
  const growProps = {
    className: 'cit-textarea-grow',
    onFocus: (e: React.FocusEvent<HTMLTextAreaElement>) => autoResize(e.currentTarget),
    onInput: (e: React.FormEvent<HTMLTextAreaElement>) => autoResize(e.currentTarget),
  };
  const motivoCorrupto = pdfWarningFields.includes('motivo');
  const rubrosCorrupto = pdfWarningFields.includes('rubros');
  const detectedLabels = pdfDetectedFields
    .map((k) => FIELD_LABELS[k] || k)
    .join(', ');
  const warningLabels = pdfWarningFields
    .map((k) => FIELD_LABELS[k] || k)
    .join(', ');

  return (
    <>
      {abierto && (
        <div className="cit-drawer-overlay" onClick={onCerrar} aria-hidden="true" />
      )}
      <aside className={`cit-drawer${abierto ? ' cit-drawer--open' : ''}`} role="dialog" aria-modal="true">
        <div className="cit-drawer-header">
          <h3>{editandoId ? 'Editar citación' : 'Nueva citación'}</h3>
          <button type="button" className="cit-btn cit-btn--ghost cit-btn--icon" onClick={onCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="cit-drawer-body">
          {formError && <div className="cit-form-error">{formError}</div>}

          <div className="cit-form-section">Adjuntar PDF de citación</div>

          <div className="cit-pdf-box">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            {!pdfFile && !pdfExistingFilename && (
              <>
                <p className="cit-pdf-hint">
                  Opcional: subí el PDF de la citación y los campos se van a autocompletar.
                </p>
                <button
                  type="button"
                  className="cit-btn cit-btn--sm"
                  onClick={handlePickFile}
                  disabled={pdfParsing}
                >
                  {pdfParsing ? 'Leyendo PDF…' : 'Elegir PDF'}
                </button>
              </>
            )}

            {pdfFile && (
              <div className="cit-pdf-row">
                <span className="cit-pdf-filename" title={pdfFile.name}>
                  {pdfParsing ? 'Leyendo: ' : 'Listo para adjuntar: '}
                  <strong>{pdfFile.name}</strong>
                </span>
                <div className="cit-pdf-actions">
                  <button
                    type="button"
                    className="cit-btn cit-btn--sm"
                    onClick={handlePickFile}
                    disabled={pdfParsing}
                  >
                    Cambiar
                  </button>
                  <button
                    type="button"
                    className="cit-btn cit-btn--sm cit-btn--ghost"
                    onClick={() => onElegirPdf(null)}
                    disabled={pdfParsing}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            )}

            {!pdfFile && pdfExistingFilename && (
              <div className="cit-pdf-row">
                <span className="cit-pdf-filename" title={pdfExistingFilename}>
                  PDF adjunto: <strong>{pdfExistingFilename}</strong>
                </span>
                <div className="cit-pdf-actions">
                  {pdfDownloadUrl && (
                    <a
                      className="cit-btn cit-btn--sm"
                      href={pdfDownloadUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver
                    </a>
                  )}
                  <button
                    type="button"
                    className="cit-btn cit-btn--sm"
                    onClick={handlePickFile}
                  >
                    Reemplazar
                  </button>
                  <button
                    type="button"
                    className="cit-btn cit-btn--sm cit-btn--ghost"
                    onClick={onQuitarPdf}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            )}

            {pdfError && <div className="cit-form-error cit-pdf-err">{pdfError}</div>}

            {!pdfError && pdfDetectedFields.length > 0 && (
              <div className="cit-pdf-detected">
                Campos autocompletados: {detectedLabels}.
              </div>
            )}

            {pdfWarningFields.length > 0 && (
              <div className="cit-pdf-warning">
                Revisá estos campos — el PDF tiene errores de codificación: {warningLabels}.
              </div>
            )}
          </div>

          <div className="cit-form-section">Datos de la citación</div>

          <div className="cit-field-row cit-field-row--two">
            <div className="cit-field">
              <label>Empresa *</label>
              <input
                value={formData.empresa}
                title={formData.empresa}
                onChange={(e) => onCampo('empresa', e.target.value)}
              />
            </div>
            <div className="cit-field">
              <label>Organismo</label>
              <select value={formData.org} onChange={(e) => onCampo('org', e.target.value)}>
                <option value="MTSS">MTSS</option>
                <option value="Juzgado">Juzgado</option>
              </select>
            </div>
          </div>

          <div className="cit-field-row cit-field-row--two">
            <div className="cit-field">
              <label>Fecha audiencia *</label>
              <input type="date" value={formData.fecha} onChange={(e) => onCampo('fecha', e.target.value)} />
            </div>
            <div className="cit-field">
              <label>Hora</label>
              <input type="time" value={formData.hora} onChange={(e) => onCampo('hora', e.target.value)} />
            </div>
          </div>

          <div className="cit-field">
            <label>Dirección / sede</label>
            <input value={formData.sede} onChange={(e) => onCampo('sede', e.target.value)} />
          </div>

          <div className="cit-field">
            <label>Trabajador/a</label>
            <input
              value={formData.trabajador}
              title={formData.trabajador}
              onChange={(e) => onCampo('trabajador', e.target.value)}
            />
          </div>

          <div className="cit-field">
            <label>Abogado/a de parte</label>
            <input
              value={formData.abogado}
              title={formData.abogado}
              onChange={(e) => onCampo('abogado', e.target.value)}
            />
          </div>

          <div className="cit-field">
            <label>Rubros reclamados</label>
            <textarea
              {...growProps}
              value={formData.rubros}
              onChange={(e) => onCampo('rubros', e.target.value)}
            />
            {rubrosCorrupto && (
              <div className="cit-field-warning">
                ⚠ El texto del PDF tiene errores de codificación — revisá antes de guardar.
              </div>
            )}
          </div>

          <div className="cit-field-row cit-field-row--two">
            <div className="cit-field">
              <label>Total reclamado (UYU)</label>
              <input
                type="number"
                value={formData.total}
                onChange={(e) => onCampo('total', e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div className="cit-field">
              <label>Estado</label>
              <select value={formData.estado} onChange={(e) => onCampo('estado', e.target.value)}>
                <option value="pendiente">Pendiente</option>
                <option value="en curso">En curso</option>
                <option value="cerrado">Cerrado</option>
              </select>
            </div>
          </div>

          <div className="cit-field">
            <label>Motivo del reclamo</label>
            <textarea
              {...growProps}
              value={formData.motivo}
              onChange={(e) => onCampo('motivo', e.target.value)}
            />
            {motivoCorrupto && (
              <div className="cit-field-warning">
                ⚠ El texto del PDF tiene errores de codificación — revisá antes de guardar.
              </div>
            )}
          </div>

          <div className="cit-form-section">Acuerdo transaccional</div>

          <div className="cit-field">
            <label>Detalle del acuerdo</label>
            <textarea
              {...growProps}
              value={formData.acuerdo}
              onChange={(e) => onCampo('acuerdo', e.target.value)}
            />
          </div>

          <div className="cit-field">
            <label>Monto pagado en acuerdo (UYU)</label>
            <input
              type="number"
              value={formData.macuerdo}
              onChange={(e) => onCampo('macuerdo', e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>

          <div className="cit-form-section">Facturas del abogado</div>

          <FacturasEditor
            facturas={formData.facturas}
            onChange={(f) => onCampo('facturas', f)}
          />

          <div className="cit-form-section">Observaciones</div>

          <div className="cit-field">
            <textarea
              {...growProps}
              value={formData.obs}
              onChange={(e) => onCampo('obs', e.target.value)}
            />
          </div>
        </div>

        <div className="cit-drawer-footer">
          <button type="button" className="cit-btn" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="cit-btn cit-btn--primary" onClick={onGuardar}>
            Guardar cambios
          </button>
        </div>
      </aside>
    </>
  );
}
