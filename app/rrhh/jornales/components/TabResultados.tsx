'use client';

import { useState } from 'react';
import type { ResultadoJornal } from '@/lib/jornales-helpers';
import { exportarExcel } from '../utils/exportarExcel';
import type { EstadisticasResultados, EstadisticasMarcas } from '../hooks/useJornalesApi';

const ESTADO_LABELS: Record<ResultadoJornal['estado'], string> = {
  efectivo_autorizado: 'Ef. autorizada',
  efectivo: 'Efectivo',
  curso: 'En curso',
  sinmarcas: 'Sin marcas',
};

const ESTADO_COLORS: Record<ResultadoJornal['estado'], string> = {
  efectivo_autorizado: 'badge-teal',
  efectivo: 'badge-purple',
  curso: 'badge-blue',
  sinmarcas: 'badge-red',
};

function JornalBadge({ efAuth, jornales }: { efAuth: boolean; jornales: number }) {
  if (efAuth) return <span className="badge badge-teal">{jornales}</span>;
  if (jornales === 0) return <span className="badge badge-red">0</span>;
  if (jornales >= 80) return <span className="badge badge-green">{jornales}</span>;
  if (jornales >= 50) return <span className="badge badge-blue">{jornales}</span>;
  return <span className="badge badge-amber">{jornales}</span>;
}

interface Props {
  resultados: ResultadoJornal[];
  estadisticas: EstadisticasResultados;
  estadisticasMarcas?: EstadisticasMarcas;
  umbralEfectividad?: number;
}

export default function TabResultados({ resultados, estadisticas, estadisticasMarcas, umbralEfectividad = 100 }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'' | ResultadoJornal['estado']>('');

  const filtrados = resultados.filter((r) => {
    const q = busqueda.toLowerCase();
    const matchQ = !q ||
      r.nombre.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      r.servicio.toLowerCase().includes(q);
    const matchEstado = !filtroEstado || r.estado === filtroEstado;
    return matchQ && matchEstado;
  });

  const periodo = estadisticasMarcas && (estadisticasMarcas.fechaMin || estadisticasMarcas.fechaMax);

  return (
    <div className="tab-resultados">
      {periodo && (
        <div className="stat-card stat-card--periodo" style={{ marginBottom: 12 }}>
          <div className="stat-label">Período de marcas cargadas</div>
          <div className="stat-number">
            {formatFechaDMY(estadisticasMarcas!.fechaMin)}
            <span className="stat-sep"> — </span>
            {formatFechaDMY(estadisticasMarcas!.fechaMax)}
          </div>
          <div className="stat-sublabel">
            Rango que cubre la planilla actual — desde la marca más antigua hasta la más reciente.
          </div>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">{estadisticas.total}</div>
          <div className="stat-label">Personal activo</div>
        </div>
        <div className="stat-card stat-teal">
          <div className="stat-number">{estadisticas.efectivoAutorizado}</div>
          <div className="stat-label">Ef. autorizada</div>
        </div>
        <div className="stat-card stat-purple">
          <div className="stat-number">{estadisticas.efectivo}</div>
          <div className="stat-label">Efectivo (&ge;{umbralEfectividad} j)</div>
        </div>
        <div className="stat-card stat-blue">
          <div className="stat-number">{estadisticas.curso}</div>
          <div className="stat-label">En curso</div>
        </div>
        <div className="stat-card stat-red">
          <div className="stat-number">{estadisticas.sinMarcas}</div>
          <div className="stat-label">Sin marcas</div>
        </div>
      </div>

      <div className="filtros-bar">
        <input
          type="text"
          placeholder="Buscar por nombre, padrón o servicio..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="input-busqueda"
        />
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)}
          className="select-filtro"
        >
          <option value="">Todos los estados</option>
          <option value="efectivo_autorizado">Efectividad autorizada</option>
          <option value="efectivo">Efectivo</option>
          <option value="curso">En curso</option>
          <option value="sinmarcas">Sin marcas</option>
        </select>
        <button className="btn-secondary" onClick={() => exportarExcel(resultados)}>
          Exportar Excel
        </button>
      </div>

      <div className="tabla-wrapper">
        <table className="tabla-jornales">
          <thead>
            <tr>
              <th>#</th>
              <th>Padrón</th>
              <th>Nombre</th>
              <th style={{ textAlign: 'center' }}>Jornales</th>
              <th>Estado</th>
              <th>Último servicio</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr><td colSpan={6} className="tabla-empty">Sin resultados</td></tr>
            ) : (
              filtrados.map((r) => (
                <tr
                  key={r.id}
                  className={r.estado === 'efectivo_autorizado' ? 'row-ef-autorizado' : ''}
                >
                  <td className="col-num">{r.n}</td>
                  <td className="col-mono">{r.id}</td>
                  <td className="col-nombre">{r.nombre}</td>
                  <td style={{ textAlign: 'center' }}>
                    <JornalBadge efAuth={r.efectividad_autorizada} jornales={r.jornales} />
                  </td>
                  <td>
                    <span className={`badge ${ESTADO_COLORS[r.estado]}`}>
                      {ESTADO_LABELS[r.estado]}
                    </span>
                  </td>
                  <td className="col-servicio" title={r.servicio}>{r.servicio}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filtrados.length > 0 && (
        <div className="tabla-footer">
          {filtrados.length} de {resultados.length} funcionarios
        </div>
      )}
    </div>
  );
}

function formatFechaDMY(iso: string | null): string {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
