import type { ResultadoJornal } from '@/lib/jornales-helpers';

export function exportarExcel(resultados: ResultadoJornal[], nombreArchivo = 'Jornales') {
  import('xlsx').then((XLSX) => {
    const wb = XLSX.utils.book_new();
    const data: Array<Array<string | number>> = [
      ['#', 'Padrón', 'Nombre', 'Jornales', 'Estado', 'Último Servicio'],
      ...resultados.map((r) => {
        const estadoLabel = ({
          efectivo_autorizado: 'Efectividad autorizada',
          efectivo: 'Efectivo',
          curso: 'En curso',
          sinmarcas: 'Sin marcas',
        } as const)[r.estado] || r.estado;
        return [r.n, r.id, r.nombre, r.jornales, estadoLabel, r.servicio];
      }),
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    (ws as any)['!cols'] = [{ wch: 5 }, { wch: 10 }, { wch: 38 }, { wch: 10 }, { wch: 22 }, { wch: 55 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Jornales');
    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${nombreArchivo}_${fecha}.xlsx`);
  });
}
