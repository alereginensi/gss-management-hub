'use client';

import { useRef, useState } from 'react';
import type { PersonaJornal } from '../hooks/useJornalesApi';
import type { ResultadoJornal } from '@/lib/jornales-helpers';

interface Props {
  personal: PersonaJornal[];
  resultados: ResultadoJornal[];
  onCargarExcel: (file: File) => Promise<number>;
  onEliminar: (padron: string) => Promise<number>;
  onToggleEfectividad: (padron: string, autorizada: boolean) => Promise<void>;
}

export default function TabPersonal({ personal, resultados, onCargarExcel, onEliminar, onToggleEfectividad }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error' | 'warn'; texto: string } | null>(null);
  const [cargando, setCargando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const jornalosById = Object.fromEntries(
    resultados.map((r) => [r.id, { jornales: r.jornales, estado: r.estado }]),
  );

  const filtrados = personal.filter((p) => {
    const q = busqueda.toLowerCase();
    return !q || p.nombre.toLowerCase().includes(q) || p.padron.toLowerCase().includes(q);
  });

  const handleCargarExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCargando(true);
    setMensaje(null);
    try {
      const cantidad = await onCargarExcel(file);
      setMensaje({ tipo: 'ok', texto: `${cantidad} funcionarios cargados` });
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err?.message || 'Error' });
    } finally {
      setCargando(false);
      e.target.value = '';
    }
  };

  return (
    <div className="tab-personal">
      <div className="card">
        <div className="card-title">Cargar listado desde Excel</div>
        <p className="card-desc">
          Columnas requeridas: <strong>Padron</strong>, <strong>Nombre</strong>. Opcionales: Apellido, Cedula.
          <br />
          <strong>Atención:</strong> esta acción reemplaza completamente el personal existente.
        </p>
        <div className="dropzone" onClick={() => inputRef.current?.click()}>
          <p>{cargando ? 'Cargando...' : 'Arrastrá el Excel de personal, o hacé clic'}</p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={handleCargarExcel}
          />
        </div>
        {mensaje && <div className={`mensaje mensaje-${mensaje.tipo}`}>{mensaje.texto}</div>}
      </div>

      <div className="filtros-bar">
        <input
          type="text"
          placeholder="Buscar por nombre o padrón..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="input-busqueda"
        />
        <span className="conteo">{filtrados.length} de {personal.length} funcionarios</span>
      </div>

      <div className="tabla-wrapper">
        <table className="tabla-jornales">
          <thead>
            <tr>
              <th>Padrón</th>
              <th>Nombre</th>
              <th>Cédula</th>
              <th style={{ textAlign: 'center' }}>Jornales</th>
              <th style={{ textAlign: 'center' }}>Ef. autorizada</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={6} className="tabla-empty">
                  {personal.length === 0 ? 'Sin personal cargado' : 'Sin resultados'}
                </td>
              </tr>
            ) : (
              filtrados.map((p) => {
                const info = jornalosById[p.padron] || { jornales: 0 };
                const efAuth = Number(p.efectividad_autorizada) === 1;
                return (
                  <tr key={p.padron} className={efAuth ? 'row-ef-autorizado' : ''}>
                    <td className="col-mono">{p.padron}</td>
                    <td>{p.nombre}</td>
                    <td className="col-mono">{p.doc || ''}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-gray">{info.jornales}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={efAuth}
                        onChange={(e) => {
                          const autorizar = e.target.checked;
                          onToggleEfectividad(p.padron, autorizar).catch((err) =>
                            alert(err?.message || 'Error'),
                          );
                        }}
                      />
                    </td>
                    <td>
                      <button
                        className="btn-danger-sm"
                        onClick={() => {
                          if (window.confirm(`¿Dar de baja a ${p.nombre}?`)) {
                            onEliminar(p.padron).catch((err) => alert(err?.message || 'Error'));
                          }
                        }}
                      >
                        Dar de baja
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
