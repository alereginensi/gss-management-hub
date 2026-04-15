// Utilidades para calcular horas trabajadas a partir de un registro de asistencia.

export interface AsistenciaRowHours {
  entrada1?: string | null;
  salida1?: string | null;
  entrada2?: string | null;
  salida2?: string | null;
}

function toMinutes(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm).trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (isNaN(h) || isNaN(mi)) return null;
  return h * 60 + mi;
}

// Calcula horas decimales (ej. 8.5). Soporta turnos nocturnos cruzando medianoche.
export function calcHorasTrabajadas(row: AsistenciaRowHours): number {
  let total = 0;
  const segs: Array<[string | null | undefined, string | null | undefined]> = [
    [row.entrada1, row.salida1],
    [row.entrada2, row.salida2],
  ];
  for (const [ent, sal] of segs) {
    const a = toMinutes(ent);
    const b = toMinutes(sal);
    if (a == null || b == null) continue;
    let diff = b - a;
    if (diff < 0) diff += 24 * 60; // pasa medianoche
    total += diff;
  }
  return Math.round((total / 60) * 100) / 100;
}

export type Categoria = 'LIMPIADOR' | 'AUXILIAR' | 'VIDRIERO' | 'ENCARGADO' | 'OTRA';

export function normalizarCategoria(raw: string | null | undefined): Categoria {
  const s = String(raw || '').trim().toUpperCase();
  if (!s) return 'OTRA';
  if (/LIMPIADOR|LIMPIAD/.test(s)) return 'LIMPIADOR';
  if (/AUXILIAR/.test(s)) return 'AUXILIAR';
  if (/VIDRIER|VIDRIO|LIMPIAVIDRIO/.test(s)) return 'VIDRIERO';
  if (/ENCARG/.test(s)) return 'ENCARGADO';
  return 'OTRA';
}
