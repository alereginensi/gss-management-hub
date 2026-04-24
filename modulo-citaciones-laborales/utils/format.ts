/**
 * utils/format.ts
 * Helpers de formato reutilizables.
 */

/** Convierte YYYY-MM-DD a DD/MM/YYYY */
export function formatFecha(fecha: string): string {
  if (!fecha) return '—';
  const [y, m, d] = fecha.split('-');
  return `${d}/${m}/${y}`;
}

/** Formatea número como moneda UYU */
export function formatMonto(v: number | '' | null | undefined): string {
  if (v === '' || v === null || v === undefined || v === 0) return '—';
  return '$' + Number(v).toLocaleString('es-UY');
}

/** Suma los montos de las facturas de una citación */
export function sumFacturas(facturas: { monto: number }[]): number {
  return (facturas || []).reduce((s, f) => s + (Number(f.monto) || 0), 0);
}

/** Trunca texto a n caracteres con ellipsis */
export function truncate(text: string, n = 45): string {
  if (!text) return '';
  return text.length > n ? text.slice(0, n) + '…' : text;
}
