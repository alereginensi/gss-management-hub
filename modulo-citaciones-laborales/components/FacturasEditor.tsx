import React from 'react';
import { TipoFactura, TIPOS_FACTURA } from '../types/citacion';

interface FacturaRow {
  nro: string;
  tipo: TipoFactura;
  monto: number | '';
}

interface Props {
  facturas: FacturaRow[];
  onChange: (facturas: FacturaRow[]) => void;
}

export function FacturasEditor({ facturas, onChange }: Props) {
  const agregar = () => {
    onChange([...facturas, { nro: '', tipo: 'Asistencia MTSS', monto: '' }]);
  };

  const actualizar = (idx: number, campo: keyof FacturaRow, valor: string | number) => {
    const updated = facturas.map((f, i) =>
      i === idx ? { ...f, [campo]: valor } : f
    );
    onChange(updated);
  };

  const eliminar = (idx: number) => {
    onChange(facturas.filter((_, i) => i !== idx));
  };

  return (
    <div className="cit-facturas-editor">
      {facturas.length > 0 && (
        <div className="cit-facturas-table">
          <div className="cit-facturas-hdr">
            <span>Nro. factura</span>
            <span>Concepto</span>
            <span>Monto (UYU)</span>
            <span />
          </div>
          {facturas.map((f, idx) => (
            <div key={idx} className="cit-facturas-row">
              <input
                placeholder="0001-000123"
                value={f.nro}
                onChange={(e) => actualizar(idx, 'nro', e.target.value)}
              />
              <select
                value={f.tipo}
                onChange={(e) => actualizar(idx, 'tipo', e.target.value as TipoFactura)}
              >
                {TIPOS_FACTURA.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="0"
                value={f.monto}
                onChange={(e) => actualizar(idx, 'monto', e.target.value === '' ? '' : Number(e.target.value))}
              />
              <button
                type="button"
                className="cit-fac-del"
                onClick={() => eliminar(idx)}
                aria-label="Eliminar factura"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="cit-btn cit-btn--sm" onClick={agregar}>
        + Agregar factura
      </button>
    </div>
  );
}
