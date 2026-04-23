'use client';

import { useState } from 'react';
import { useJornalesApi } from './hooks/useJornalesApi';
import TabResultados from './components/TabResultados';
import TabPersonal from './components/TabPersonal';
import TabMarcas from './components/TabMarcas';
import TabAltas from './components/TabAltas';
import TabBajas from './components/TabBajas';

const TABS = [
  { id: 'resultados', label: 'Resultados' },
  { id: 'personal',   label: 'Personal' },
  { id: 'marcas',     label: 'Agregar marcas' },
  { id: 'altas',      label: 'Altas' },
  { id: 'bajas',      label: 'Bajas' },
] as const;

type TabId = (typeof TABS)[number]['id'];

interface Props {
  umbralEfectividad?: number;
}

export default function JornalesModule({ umbralEfectividad = 100 }: Props) {
  const [tabActiva, setTabActiva] = useState<TabId>('resultados');
  const jornales = useJornalesApi({ umbralEfectividad });

  return (
    <div className="jornales-module">
      <nav className="jornales-nav">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`jornales-tab ${tabActiva === tab.id ? 'active' : ''}`}
            onClick={() => setTabActiva(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="jornales-content">
        {jornales.loading && <div className="mensaje mensaje-warn">Cargando datos...</div>}
        {jornales.error && <div className="mensaje mensaje-error">{jornales.error}</div>}

        {tabActiva === 'resultados' && (
          <TabResultados
            resultados={jornales.resultados}
            estadisticas={jornales.estadisticas}
            umbralEfectividad={umbralEfectividad}
          />
        )}
        {tabActiva === 'personal' && (
          <TabPersonal
            personal={jornales.personal}
            resultados={jornales.resultados}
            onCargarExcel={jornales.cargarPersonalDesdeExcel}
            onEliminar={jornales.eliminarPersona}
            onToggleEfectividad={jornales.autorizarEfectividad}
          />
        )}
        {tabActiva === 'marcas' && (
          <TabMarcas
            archivosMeta={jornales.archivosMeta}
            estadisticas={jornales.estadisticasMarcas}
            onCargarArchivo={jornales.cargarArchivoMarcas}
            onQuitarArchivo={jornales.quitarArchivoMarcas}
            onLimpiar={jornales.limpiarMarcas}
          />
        )}
        {tabActiva === 'altas' && (
          <TabAltas
            personal={jornales.personal}
            onAgregarPersonas={jornales.agregarPersonas}
          />
        )}
        {tabActiva === 'bajas' && (
          <TabBajas
            personal={jornales.personal}
            resultados={jornales.resultados}
            onDarDeBaja={jornales.darDeBaja}
          />
        )}
      </div>
    </div>
  );
}
