/**
 * CitacionesModule.tsx
 *
 * Componente raíz del módulo de Citaciones Laborales.
 * Importar este componente en la ruta de RRHH de la aplicación.
 *
 * Ejemplo de uso:
 *   import { CitacionesModule } from './modulo-citaciones-laborales/components/CitacionesModule';
 *   // En tu router o layout de RRHH:
 *   <CitacionesModule />
 */

import React from 'react';
import { useCitaciones } from '../hooks/useCitaciones';
import { StatsGrid } from './StatsGrid';
import { PlanillaView } from './PlanillaView';
import { DrawerEditar } from './DrawerEditar';
import { exportarExcel } from '../utils/export';
import '../citaciones.css';

export function CitacionesModule() {
  const {
    citaciones, loading, error, stats,
    tabActiva, setTabActiva,
    busqueda, setBusqueda,
    filtroOrg, setFiltroOrg,
    drawerAbierto, editandoId,
    formData, formError,
    abrirNuevo, abrirEditar, cerrarDrawer,
    actualizarForm, guardar,
    cerrarExpediente,
    pdfFile, pdfParsing, pdfError, pdfExistingFilename, pdfDetectedFields, pdfWarningFields,
    elegirPdf, quitarPdfAdjunto, pdfDownloadUrl,
  } = useCitaciones();

  if (error) {
    return <div className="cit-error">{error}</div>;
  }

  return (
    <div className="cit-module">
      <div className="cit-module-header">
        <h2 className="cit-module-title">Citaciones Laborales</h2>
        <p className="cit-module-subtitle">Gestión de audiencias MTSS y Juzgado</p>
      </div>

      <StatsGrid stats={stats} />

      <PlanillaView
        citaciones={citaciones}
        loading={loading}
        tabActiva={tabActiva}
        busqueda={busqueda}
        filtroOrg={filtroOrg}
        onTabChange={setTabActiva}
        onBusquedaChange={setBusqueda}
        onFiltroOrgChange={setFiltroOrg}
        onNuevo={abrirNuevo}
        onEditar={abrirEditar}
        onCerrar={cerrarExpediente}
        onExportar={() => exportarExcel(citaciones)}
      />

      <DrawerEditar
        abierto={drawerAbierto}
        editandoId={editandoId}
        formData={formData}
        formError={formError}
        onCerrar={cerrarDrawer}
        onCampo={actualizarForm}
        onGuardar={guardar}
        pdfFile={pdfFile}
        pdfParsing={pdfParsing}
        pdfError={pdfError}
        pdfExistingFilename={pdfExistingFilename}
        pdfDetectedFields={pdfDetectedFields}
        pdfWarningFields={pdfWarningFields}
        pdfDownloadUrl={editandoId ? pdfDownloadUrl(editandoId) : null}
        onElegirPdf={elegirPdf}
        onQuitarPdf={quitarPdfAdjunto}
      />
    </div>
  );
}
