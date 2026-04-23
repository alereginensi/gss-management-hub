/**
 * Helpers del módulo RRHH → Jornales.
 * Solo acceso admin y rrhh.
 */

export const JORNALES_ALLOWED_ROLES = ['admin', 'rrhh'] as const;

export type JornalesRole = (typeof JORNALES_ALLOWED_ROLES)[number];

export function isJornalesRole(role: string | undefined): boolean {
  return !!role && (JORNALES_ALLOWED_ROLES as readonly string[]).includes(role);
}

export type JornalEstado = 'efectivo_autorizado' | 'efectivo' | 'curso' | 'sinmarcas';

export function getEstado(
  efectividadAutorizada: boolean,
  jornales: number,
  umbral: number,
): JornalEstado {
  if (efectividadAutorizada) return 'efectivo_autorizado';
  if (jornales === 0) return 'sinmarcas';
  if (jornales >= umbral) return 'efectivo';
  return 'curso';
}

export interface ResultadoJornal {
  n: number;
  id: string;
  nombre: string;
  doc: string;
  jornales: number;
  servicio: string;
  estado: JornalEstado;
  efectividad_autorizada: boolean;
}

export interface ResultadoInput {
  padron: string;
  nombre: string;
  doc: string | null;
  efectividad_autorizada: number;
  jornales: number | string | null;
  ultimo_servicio: string | null;
}

export function buildResultados(rows: ResultadoInput[], umbral: number): ResultadoJornal[] {
  const out: ResultadoJornal[] = rows.map((r) => {
    const efAuth = Number(r.efectividad_autorizada) === 1;
    const j = Number(r.jornales) || 0;
    return {
      n: 0,
      id: r.padron,
      nombre: r.nombre,
      doc: r.doc || '',
      jornales: j,
      servicio: r.ultimo_servicio || '',
      estado: getEstado(efAuth, j, umbral),
      efectividad_autorizada: efAuth,
    };
  });

  out.sort((a, b) => {
    const aEf = a.estado === 'efectivo_autorizado' || a.estado === 'efectivo';
    const bEf = b.estado === 'efectivo_autorizado' || b.estado === 'efectivo';
    if (aEf && !bEf) return -1;
    if (!aEf && bEf) return 1;
    return b.jornales - a.jornales;
  });

  out.forEach((r, i) => { r.n = i + 1; });
  return out;
}

/**
 * Parsea una fecha desde string en formato DD/MM/YYYY, D/M/YYYY o ISO a YYYY-MM-DD.
 * Devuelve null si no se puede parsear o la fecha es inválida.
 */
export function parseFechaToIso(raw: unknown): string | null {
  if (!raw) return null;
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    return toIso(raw);
  }
  const s = String(raw).trim();
  if (!s) return null;
  // DD/MM/YYYY o D/M/YYYY
  const parts = s.split('/');
  if (parts.length === 3) {
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    if (!d || !m || !y) return null;
    const dt = new Date(y, m - 1, d);
    if (isNaN(dt.getTime())) return null;
    return toIso(dt);
  }
  // ISO u otros
  const dt2 = new Date(s);
  if (isNaN(dt2.getTime())) return null;
  return toIso(dt2);
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
