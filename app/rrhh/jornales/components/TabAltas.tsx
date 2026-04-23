'use client';

import { useRef, useState } from 'react';
import type { PersonaJornal } from '../hooks/useJornalesApi';
import { leerExcel, parsearPersonal, type PersonaLite } from '../utils/parsearExcel';

interface Props {
  personal: PersonaJornal[];
  onAgregarPersonas: (personas: PersonaLite[]) => Promise<number>;
}

type Mensaje = { tipo: 'ok' | 'error' | 'warn'; texto: string };

export default function TabAltas({ personal, onAgregarPersonas }: Props) {
  const [textoPegado, setTextoPegado] = useState('');
  const [pendientes, setPendientes] = useState<PersonaLite[] | null>(null);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);
  const [cargando, setCargando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const idsActuales = new Set(personal.map((p) => p.padron));

  const parsearTexto = (txt: string): PersonaLite[] => {
    const lineas = txt.trim().split('\n').filter(Boolean);
    const personas: PersonaLite[] = [];
    for (const linea of lineas) {
      const partes = linea.split('\t').map((s) => s.trim()).filter(Boolean);
      if (partes.length >= 2) {
        const id = partes[0];
        const resto = partes.slice(1);
        let doc = '';
        let nombrePartes = resto;
        if (/^\d{6,8}$/.test(resto[resto.length - 1])) {
          doc = resto[resto.length - 1];
          nombrePartes = resto.slice(0, -1);
        }
        personas.push({ id, nombre: nombrePartes.join(' '), doc });
      }
    }
    return personas;
  };

  const procesarTexto = () => {
    if (!textoPegado.trim()) {
      setMensaje({ tipo: 'error', texto: 'Pegá el listado primero' });
      return;
    }
    const parsed = parsearTexto(textoPegado);
    if (!parsed.length) {
      setMensaje({ tipo: 'error', texto: 'No se pudo leer el formato. Asegurate de separar con tabs.' });
      return;
    }
    setPendientes(parsed);
    setMensaje(null);
  };

  const handleExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCargando(true);
    try {
      const rows = await leerExcel(file);
      const personas = parsearPersonal(rows);
      if (!personas.length) throw new Error('No se encontraron columnas Padrón/Nombre');
      setPendientes(personas);
      setMensaje(null);
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err?.message || 'Error leyendo Excel' });
    } finally {
      setCargando(false);
      e.target.value = '';
    }
  };

  const confirmar = async () => {
    if (!pendientes) return;
    try {
      const agregados = await onAgregarPersonas(pendientes);
      setMensaje({ tipo: 'ok', texto: `${agregados} personas agregadas al personal` });
      setPendientes(null);
      setTextoPegado('');
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err?.message || 'Error al agregar' });
    }
  };

  return (
    <div className="tab-altas">
      <div className="grid-2">
        <div className="card">
          <div className="card-title">Pegar texto de altas</div>
          <p className="card-desc">Formato: padrón tab nombre tab apellido tab cédula (una persona por línea)</p>
          <textarea
            className="textarea-input"
            placeholder={'6200\tJuan\tPerez\t12345678\n6201\tMaria\tLopez\t87654321'}
            value={textoPegado}
            onChange={(e) => setTextoPegado(e.target.value)}
            rows={5}
          />
          <div className="acciones-row">
            <button className="btn-primary" onClick={procesarTexto}>Procesar altas</button>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Subir Excel de altas</div>
          <p className="card-desc">Columnas: Padrón, Nombre, Apellido (opcional), Cédula (opcional)</p>
          <div className="dropzone dropzone-sm" onClick={() => inputRef.current?.click()}>
            <p>{cargando ? 'Leyendo...' : 'Excel con columnas Padrón y Nombre'}</p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleExcel}
            />
          </div>
        </div>
      </div>

      {mensaje && <div className={`mensaje mensaje-${mensaje.tipo}`}>{mensaje.texto}</div>}

      {pendientes && (
        <div className="card">
          <div className="card-title">Vista previa — {pendientes.length} personas</div>
          <div className="tabla-wrapper">
            <table className="tabla-jornales">
              <thead>
                <tr>
                  <th>Padrón</th>
                  <th>Nombre</th>
                  <th>Cédula</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {pendientes.map((p) => (
                  <tr key={p.id}>
                    <td className="col-mono">{p.id}</td>
                    <td>{p.nombre}</td>
                    <td className="col-mono">{p.doc}</td>
                    <td>
                      {idsActuales.has(p.id)
                        ? <span className="badge badge-amber">Ya existe</span>
                        : <span className="badge badge-green">Nueva alta</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="acciones-row" style={{ marginTop: 12 }}>
            <button className="btn-success" onClick={confirmar}>Confirmar altas</button>
            <button className="btn-secondary" onClick={() => setPendientes(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
