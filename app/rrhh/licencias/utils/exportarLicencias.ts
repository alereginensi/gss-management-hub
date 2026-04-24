import type { Licencia } from '../hooks/useLicenciasApi';

/** Exporta las licencias al Excel manteniendo las columnas originales del archivo fuente. */
export async function exportarLicencias(licencias: Licencia[]): Promise<void> {
  const XLSX = await import('xlsx');

  const header = [
    'Remitente', 'Padron', 'Funcionario', 'Nombre del Servicio', 'SECTOR',
    'Tipo de licencia', 'Desde', 'Hasta', 'Suplente',
    'RRHH (Recepción Notificación)', 'Supervisión',
    'RRHH (Recepción Certificado)', 'Planificación', 'Observaciones',
  ];
  const rows = licencias.map((l) => [
    l.remitente,
    l.padron,
    l.funcionario,
    l.nombreServicio,
    l.sector,
    l.tipoLicencia,
    fechaDMY(l.desde),
    fechaDMY(l.hasta),
    l.suplente,
    l.recepNotificacion ? 'TRUE' : 'FALSE',
    l.supervision ? 'TRUE' : 'FALSE',
    l.recepCertificado ? 'TRUE' : 'FALSE',
    l.planificacion ? 'TRUE' : 'FALSE',
    l.observaciones,
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  (ws as unknown as { '!cols'?: Array<{ wch: number }> })['!cols'] = [
    { wch: 18 }, { wch: 8 }, { wch: 28 }, { wch: 18 }, { wch: 12 },
    { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 22 },
    { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Registro');

  const fecha = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Registro_de_licencias_${fecha}.xlsx`);
}

function fechaDMY(iso: string): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
