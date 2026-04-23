'use client';

import { useRef, useState } from 'react';
import type { PersonaJornal } from '../hooks/useJornalesApi';
import type { ResultadoJornal } from '@/lib/jornales-helpers';
import { leerExcel, findCol } from '../utils/parsearExcel';

interface Props {
  personal: PersonaJornal[];
  resultados: ResultadoJornal[];
  onDarDeBaja: (ids: string[]) => Promise<number>;
}

type Modo = 'buscar' | 'texto' | 'excel';
type Mensaje = { tipo: 'ok' | 'error' | 'warn'; texto: string };

interface Pendiente {
  id: string;
  nombre: string;
  jornales: number;
  encontrado?: boolean;
}

export default function TabBajas({ personal, resultados, onDarDeBaja }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [textoPadrones, setTextoPadrones] = useState('');
  const [pendientes, setPendientes] = useState<Pendiente[] | null>(null);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);
  const [cargando, setCargando] = useState(false);
  const [modoActivo, setModoActivo] = useState<Modo>('buscar');
  const inputRef = useRef<HTMLInputElement>(null);

  const jornalosById = Object.fromEntries(resultados.map((r) => [r.id, r.jornales]));

  const filtrados = personal.filter((p) => {
    const q = busqueda.toLowerCase();
    return !!q && (p.nombre.toLowerCase().includes(q) || p.padron.toLowerCase().includes(q));
  });

  const toggleSeleccion = (id: string) => {
    setSeleccionados((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  };

  const prepararBajasBusqueda = () => {
    if (!seleccionados.size) {
      setMensaje({ tipo: 'error', texto: 'Seleccioná al menos una persona' });
      return;
    }
    const arr = Array.from(seleccionados).map<Pendiente>((id) => {
      const p = personal.find((x) => x.padron === id);
      return { id, nombre: p?.nombre || id, jornales: jornalosById[id] || 0, encontrado: true };
    });
    setPendientes(arr);
    setMensaje(null);
  };

  const procesarTextoPadrones = () => {
    const ids = textoPadrones.split(/[\n,\s]+/).map((s) => s.trim()).filter(Boolean);
    if (!ids.length) {
      setMensaje({ tipo: 'error', texto: 'Ingresá los padrones primero' });
      return;
    }
    const arr = ids.map<Pendiente>((id) => {
      const p = personal.find((x) => x.padron === id);
      return { id, nombre: p?.nombre || 'No encontrado', jornales: jornalosById[id] || 0, encontrado: !!p };
    });
    setPendientes(arr);
    setMensaje(null);
  };

  const handleExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCargando(true);
    try {
      const rows = await leerExcel(file);
      const ids = rows.map((r) => {
        let id = findCol(r, ['Padron', 'Padrón', 'ID', 'Numero de empleado', 'Número de empleado']);
        if (!id) id = String(Object.values(r)[0] || '').trim();
        return id;
      }).filter(Boolean);
      const arr = ids.map<Pendiente>((id) => {
        const p = personal.find((x) => x.padron === id);
        return { id, nombre: p?.nombre || 'No encontrado', jornales: jornalosById[id] || 0, encontrado: !!p };
      });
      setPendientes(arr);
      setMensaje(null);
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err?.message || 'Error leyendo Excel' });
    } finally {
      setCargando(false);
      e.target.value = '';
    }
  };

  const confirmarBajas = async () => {
    if (!pendientes) return;
    const ids = pendientes.filter((p) => p.encontrado !== false).map((p) => p.id);
    try {
      const ok = await onDarDeBaja(ids);
      setMensaje({ tipo: 'ok', texto: `${ok} personas dadas de baja` });
      setPendientes(null);
      setSeleccionados(new Set());
      setTextoPadrones('');
      setBusqueda('');
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err?.message || 'Error al dar de baja' });
    }
  };

  return (
    <div className="tab-bajas">
      <div className="modo-tabs">
        <button className={`modo-tab ${modoActivo === 'buscar' ? 'active' : ''}`} onClick={() => { setModoActivo('buscar'); setPendientes(null); }}>
          Buscar por nombre
        </button>
        <button className={`modo-tab ${modoActivo === 'texto' ? 'active' : ''}`} onClick={() => { setModoActivo('texto'); setPendientes(null); }}>
          Pegar padrones
        </button>
        <button className={`modo-tab ${modoActivo === 'excel' ? 'active' : ''}`} onClick={() => { setModoActivo('excel'); setPendientes(null); }}>
          Subir Excel
        </button>
      </div>

      {modoActivo === 'buscar' && (
        <div className="card">
          <div className="card-title">Buscar y seleccionar personas a dar de baja</div>
          <div className="filtros-bar">
            <input
              type="text"
              placeholder="Escribí el nombre o padrón..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="input-busqueda"
            />
          </div>

          {busqueda && (
            <div className="tabla-wrapper">
              <table className="tabla-jornales">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Padrón</th>
                    <th>Nombre</th>
                    <th style={{ textAlign: 'center' }}>Jornales</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.length === 0 ? (
                    <tr><td colSpan={4} className="tabla-empty">Sin resultados para &quot;{busqueda}&quot;</td></tr>
                  ) : (
                    filtrados.map((p) => (
                      <tr
                        key={p.padron}
                        className={seleccionados.has(p.padron) ? 'row-seleccionado' : ''}
                        onClick={() => toggleSeleccion(p.padron)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={seleccionados.has(p.padron)}
                            onChange={() => toggleSeleccion(p.padron)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="col-mono">{p.padron}</td>
                        <td>{p.nombre}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge badge-gray">{jornalosById[p.padron] || 0}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {seleccionados.size > 0 && (
            <div className="acciones-row" style={{ marginTop: 12 }}>
              <span className="conteo">{seleccionados.size} persona(s) seleccionada(s)</span>
              <button className="btn-danger" onClick={prepararBajasBusqueda}>Preparar bajas</button>
              <button className="btn-secondary" onClick={() => setSeleccionados(new Set())}>Limpiar selección</button>
            </div>
          )}
        </div>
      )}

      {modoActivo === 'texto' && (
        <div className="card">
          <div className="card-title">Pegar padrones a dar de baja</div>
          <p className="card-desc">Un padrón por línea, o separados por comas o espacios</p>
          <textarea
            className="textarea-input"
            placeholder={'6039\n6115\n6200'}
            value={textoPadrones}
            onChange={(e) => setTextoPadrones(e.target.value)}
            rows={5}
          />
          <div className="acciones-row">
            <button className="btn-danger" onClick={procesarTextoPadrones}>Buscar personas</button>
          </div>
        </div>
      )}

      {modoActivo === 'excel' && (
        <div className="card">
          <div className="card-title">Subir Excel de bajas</div>
          <p className="card-desc">Excel con columna Padrón (o Número de empleado)</p>
          <div className="dropzone dropzone-sm" onClick={() => inputRef.current?.click()}>
            <p>{cargando ? 'Leyendo...' : 'Excel con columna Padrón'}</p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleExcel}
            />
          </div>
        </div>
      )}

      {mensaje && <div className={`mensaje mensaje-${mensaje.tipo}`}>{mensaje.texto}</div>}

      {pendientes && (
        <div className="card">
          <div className="card-title">Confirmar bajas — {pendientes.filter((p) => p.encontrado !== false).length} personas</div>
          <div className="tabla-wrapper">
            <table className="tabla-jornales">
              <thead>
                <tr>
                  <th>Padrón</th>
                  <th>Nombre</th>
                  <th style={{ textAlign: 'center' }}>Jornales</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {pendientes.map((p) => (
                  <tr key={p.id}>
                    <td className="col-mono">{p.id}</td>
                    <td>{p.nombre}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-gray">{p.jornales}</span>
                    </td>
                    <td>
                      {p.encontrado === false
                        ? <span className="badge badge-gray">No encontrado</span>
                        : <span className="badge badge-red">Dar de baja</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="acciones-row" style={{ marginTop: 12 }}>
            <button className="btn-danger" onClick={confirmarBajas}>Confirmar bajas</button>
            <button className="btn-secondary" onClick={() => setPendientes(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
