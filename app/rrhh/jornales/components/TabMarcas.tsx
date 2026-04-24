'use client';

import { useRef, useState } from 'react';
import type { ArchivoMarcasMeta, EstadisticasMarcas } from '../hooks/useJornalesApi';

interface Props {
  archivosMeta: ArchivoMarcasMeta[];
  estadisticas: EstadisticasMarcas;
  onCargarArchivo: (file: File) => Promise<{ omitido?: boolean; razon?: string; nuevos?: number; dups?: number; total?: number }>;
  onQuitarArchivo: (index: number) => Promise<void>;
  onLimpiar: () => Promise<void>;
}

type Mensaje = { tipo: 'ok' | 'error' | 'warn'; texto: string };

export default function TabMarcas({ archivosMeta, estadisticas, onCargarArchivo, onQuitarArchivo, onLimpiar }: Props) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [cargando, setCargando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleArchivos = async (files: FileList | null) => {
    if (!files) return;
    setCargando(true);
    const nuevos: Mensaje[] = [];
    for (const file of Array.from(files)) {
      try {
        const resultado = await onCargarArchivo(file);
        if (resultado.omitido) {
          nuevos.push({ tipo: 'warn', texto: resultado.razon || `"${file.name}" ya estaba cargado` });
        } else {
          nuevos.push({
            tipo: 'ok',
            texto: `"${file.name}": ${resultado.nuevos ?? 0} días nuevos, ${resultado.dups ?? 0} duplicados ignorados`,
          });
        }
      } catch (err: any) {
        nuevos.push({ tipo: 'error', texto: `"${file.name}": ${err?.message || err}` });
      }
    }
    setMensajes(nuevos);
    setCargando(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleArchivos(e.dataTransfer.files);
  };

  return (
    <div className="tab-marcas">
      <div className="card">
        <div className="card-title">Agregar archivo de marcas</div>
        <p className="card-desc">
          Columnas requeridas: <strong>Número de empleado</strong>, <strong>Fecha</strong>, <strong>Lugar</strong>.
          Los días ya existentes por persona se ignoran automáticamente.
        </p>
        <div
          className="dropzone"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <p>{cargando ? 'Procesando...' : 'Arrastrá archivos .xlsx/.xls o hacé clic'}</p>
          <small>Se acumulan — no reemplaza lo ya cargado. Archivos repetidos son ignorados.</small>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={(e) => { handleArchivos(e.target.files); e.target.value = ''; }}
          />
        </div>

        {archivosMeta.length > 0 && (
          <div className="chips-container">
            {archivosMeta.map((f, i) => (
              <span key={f.id} className="chip">
                {f.name}
                <span className="chip-meta">{f.registros_nuevos} días</span>
                <button
                  className="chip-remove"
                  onClick={() => onQuitarArchivo(i).catch((err) => alert(err?.message || 'Error'))}
                >×</button>
              </span>
            ))}
          </div>
        )}

        {mensajes.map((m, i) => (
          <div key={i} className={`mensaje mensaje-${m.tipo}`}>{m.texto}</div>
        ))}

        {archivosMeta.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <button
              className="btn-danger-outline"
              onClick={() => {
                if (window.confirm('¿Limpiar todas las marcas cargadas?')) {
                  onLimpiar().then(() => setMensajes([])).catch((err) => alert(err?.message || 'Error'));
                }
              }}
            >
              Limpiar todas las marcas
            </button>
          </div>
        )}
      </div>

      {(estadisticas.fechaMin || estadisticas.fechaMax) && (
        <div className="stat-card stat-card--periodo" style={{ marginTop: 12 }}>
          <div className="stat-label">Período de marcas cargadas</div>
          <div className="stat-number">
            {formatFechaDMY(estadisticas.fechaMin)}
            <span className="stat-sep"> — </span>
            {formatFechaDMY(estadisticas.fechaMax)}
          </div>
          <div className="stat-sublabel">
            Desde la marca más antigua hasta la más reciente en la base de datos.
          </div>
        </div>
      )}

      <div className="stats-grid stats-grid-4">
        <div className="stat-card">
          <div className="stat-number">{estadisticas.totalRegistros.toLocaleString()}</div>
          <div className="stat-label">Registros cargados</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{estadisticas.totalArchivos}</div>
          <div className="stat-label">Archivos</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{estadisticas.personasEnMarcas}</div>
          <div className="stat-label">Personas en marcas</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{estadisticas.diasUnicos.toLocaleString()}</div>
          <div className="stat-label">Días únicos</div>
        </div>
      </div>
    </div>
  );
}

function formatFechaDMY(iso: string | null): string {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
