/**
 * index.ts — Barrel exports del módulo
 *
 * Importar desde aquí en la app principal:
 *   import { CitacionesModule } from './modulo-citaciones-laborales';
 */

// Componente raíz
export { CitacionesModule } from './components/CitacionesModule';

// Tipos (por si otros módulos los necesitan)
export type {
  Citacion,
  Factura,
  CitacionFormData,
  CitacionesStats,
  EstadoCitacion,
  Organismo,
  TipoFactura,
} from './types/citacion';

// Hook (por si se necesita acceso directo a la lógica)
export { useCitaciones } from './hooks/useCitaciones';

// Utilidades (por si se reusan en otros módulos)
export { exportarExcel } from './utils/export';
export { formatFecha, formatMonto, sumFacturas, truncate } from './utils/format';
