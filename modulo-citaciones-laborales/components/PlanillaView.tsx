import React from 'react';
import { Citacion, EstadoCitacion } from '../types/citacion';
import { formatFecha, formatMonto, sumFacturas, truncate } from '../utils/format';

interface Props {
  citaciones: Citacion[];
  loading: boolean;
  tabActiva: EstadoCitacion | 'todas';
  busqueda: string;
  filtroOrg: 'MTSS' | 'Juzgado' | '';
  onTabChange: (tab: EstadoCitacion | 'todas') => void;
  onBusquedaChange: (v: string) => void;
  onFiltroOrgChange: (v: 'MTSS' | 'Juzgado' | '') => void;
  onNuevo: () => void;
  onEditar: (c: Citacion) => void;
  onCerrar: (id: string) => void;
  onExportar: () => void;
}

const TABS: { label: string; value: EstadoCitacion | 'todas' }[] = [
  { label: 'Todas', value: 'todas' },
  { label: 'Pendientes', value: 'pendiente' },
  { label: 'En curso', value: 'en curso' },
  { label: 'Cerradas', value: 'cerrado' },
];

function Badge({ text, variant }: { text: string; variant: string }) {
  return <span className={`cit-badge cit-badge--${variant}`}>{text}</span>;
}

function orgVariant(org: string) { return org === 'MTSS' ? 'mtss' : 'juz'; }
function estadoVariant(e: string) { return e === 'cerrado' ? 'cer' : e === 'en curso' ? 'cur' : 'pen'; }

export function PlanillaView({
  citaciones, loading,
  tabActiva, busqueda, filtroOrg,
  onTabChange, onBusquedaChange, onFiltroOrgChange,
  onNuevo, onEditar, onCerrar, onExportar,
}: Props) {
  return (
    <div className="cit-planilla">
      {/* Toolbar */}
      <div className="cit-toolbar">
        <div className="cit-tabs">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              className={`cit-tab${tabActiva === t.value ? ' cit-tab--active' : ''}`}
              onClick={() => onTabChange(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="cit-toolbar-right">
          <button type="button" className="cit-btn cit-btn--success" onClick={onExportar}>
            ↓ Excel
          </button>
          <button type="button" className="cit-btn cit-btn--primary" onClick={onNuevo}>
            + Nueva citación
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="cit-filter-bar">
        <div className="cit-search-wrap">
          <input
            type="text"
            placeholder="Buscar empresa o trabajador..."
            value={busqueda}
            onChange={(e) => onBusquedaChange(e.target.value)}
          />
        </div>
        <select
          value={filtroOrg}
          onChange={(e) => onFiltroOrgChange(e.target.value as 'MTSS' | 'Juzgado' | '')}
          className="cit-select-org"
        >
          <option value="">Todos los organismos</option>
          <option value="MTSS">MTSS</option>
          <option value="Juzgado">Juzgado</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="cit-table-wrap">
        {loading ? (
          <div className="cit-empty">Cargando...</div>
        ) : citaciones.length === 0 ? (
          <div className="cit-empty">No hay citaciones que coincidan con los filtros.</div>
        ) : (
          <table className="cit-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Trabajador/a</th>
                <th>Org.</th>
                <th>Audiencia</th>
                <th>Estado</th>
                <th>Reclamado</th>
                <th>Acuerdo</th>
                <th>Honorarios</th>
                <th>Motivo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {citaciones.map((c) => {
                const hTot = sumFacturas(c.facturas);
                const nFac = c.facturas?.length ?? 0;
                return (
                  <tr key={c.id}>
                    <td className="cit-td--bold">{c.empresa || '—'}</td>
                    <td>{c.trabajador || '—'}</td>
                    <td>
                      <Badge text={c.org} variant={orgVariant(c.org)} />
                    </td>
                    <td className="cit-td--mono">
                      {formatFecha(c.fecha)}
                      {c.hora && <span className="cit-hora"> {c.hora}</span>}
                    </td>
                    <td>
                      <Badge text={c.estado} variant={estadoVariant(c.estado)} />
                    </td>
                    <td className="cit-td--mono">
                      {c.total && Number(c.total) > 0 ? formatMonto(c.total) : <span className="cit-dash">—</span>}
                    </td>
                    <td className="cit-td--mono cit-td--acuerdo">
                      {c.macuerdo && Number(c.macuerdo) > 0
                        ? formatMonto(c.macuerdo)
                        : <span className="cit-dash">—</span>}
                    </td>
                    <td className="cit-td--mono">
                      {hTot > 0
                        ? <>{formatMonto(hTot)}{nFac > 0 && <span className="cit-fac-count"> ({nFac}f)</span>}</>
                        : <span className="cit-dash">—</span>}
                    </td>
                    <td>
                      <span className="cit-motivo-cell" title={c.motivo}>
                        {truncate(c.motivo, 40) || '—'}
                      </span>
                    </td>
                    <td>
                      <div className="cit-row-actions">
                        <button
                          type="button"
                          className="cit-act-btn"
                          onClick={() => onEditar(c)}
                        >
                          Ver/Editar
                        </button>
                        {c.estado !== 'cerrado' && (
                          <button
                            type="button"
                            className="cit-act-btn cit-act-btn--red"
                            onClick={() => onCerrar(c.id)}
                          >
                            Cerrar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
