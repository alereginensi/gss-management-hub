/**
 * utils/export.ts
 * Exportación a Excel usando la librería xlsx.
 * Requiere: npm install xlsx
 */

import * as XLSX from 'xlsx';
import { Citacion } from '../types/citacion';
import { formatFecha } from './format';

export function exportarExcel(citaciones: Citacion[]): void {
  if (!citaciones.length) {
    alert('No hay datos para exportar.');
    return;
  }

  const rows: Record<string, string | number>[] = [];

  citaciones.forEach((d) => {
    const facs = d.facturas?.length ? d.facturas : [{ id: '', nro: '', tipo: 'Otros' as const, monto: 0 }];

    facs.forEach((f, fi) => {
      rows.push({
        'Empresa':                      fi === 0 ? d.empresa || '' : '',
        'Trabajador/a':                 fi === 0 ? d.trabajador || '' : '',
        'Organismo':                    fi === 0 ? d.org || '' : '',
        'Fecha audiencia':              fi === 0 ? formatFecha(d.fecha) : '',
        'Hora':                         fi === 0 ? d.hora || '' : '',
        'Sede':                         fi === 0 ? d.sede || '' : '',
        'Abogado/a reclamante':         fi === 0 ? d.abogado || '' : '',
        'Motivo':                       fi === 0 ? d.motivo || '' : '',
        'Rubros reclamados':            fi === 0 ? d.rubros || '' : '',
        'Total reclamado (UYU)':        fi === 0 && d.total ? Number(d.total) : '',
        'Estado':                       fi === 0 ? d.estado || '' : '',
        'Acuerdo transaccional':        fi === 0 ? d.acuerdo || '' : '',
        'Monto pagado en acuerdo (UYU)':fi === 0 && d.macuerdo ? Number(d.macuerdo) : '',
        'Nro. factura':                 f.nro || '',
        'Concepto factura':             f.tipo || '',
        'Monto factura (UYU)':          f.monto ? Number(f.monto) : '',
        'Observaciones':                fi === 0 ? d.obs || '' : '',
      });
    });
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 22 }, { wch: 26 }, { wch: 10 }, { wch: 14 }, { wch: 7 },
    { wch: 24 }, { wch: 28 }, { wch: 40 }, { wch: 42 }, { wch: 14 },
    { wch: 10 }, { wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 22 },
    { wch: 14 }, { wch: 18 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Citaciones');

  const fecha = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `citaciones_${fecha}.xlsx`);
}
