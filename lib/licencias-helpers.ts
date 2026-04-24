/**
 * Helpers del módulo RRHH → Registro de Licencias.
 * Solo acceso admin y rrhh.
 */

export const LICENCIAS_ALLOWED_ROLES = ['admin', 'rrhh'] as const;

export type LicenciasRole = (typeof LICENCIAS_ALLOWED_ROLES)[number];

export function isLicenciasRole(role: string | undefined): boolean {
  return !!role && (LICENCIAS_ALLOWED_ROLES as readonly string[]).includes(role);
}

// Valores válidos de la hoja "OK" del Excel original.
export const SECTORES = ['Staff', 'Tercerizado', 'Limpieza', 'Seguridad'] as const;
export type Sector = (typeof SECTORES)[number];

// Tipos de licencia que aparecen en el Excel histórico.
// Orden: más frecuentes primero (según análisis del Excel real de 573 filas).
export const TIPOS_LICENCIA = [
  'Certificación médica',
  'Licencia Anual',
  'Licencia por estudio',
  'PAP',
  'Lactancia',
  'Donación de sangre',
  'Duelo',
  'Licencia Maternal',
  'Mamografía',
  'Licencia por paternidad',
  'Licencia Matrimonio',
  'Otro',
] as const;
export type TipoLicencia = (typeof TIPOS_LICENCIA)[number];

/**
 * Normaliza el string del tipo de licencia del Excel (que viene con variaciones
 * de capitalización y tildes: "pap", "Pap", "PAP", "Donacion de sangre"/"Donación de sangre",
 * "Licencia por duelo"/"Duelo", "Paternidad"/"Licencia por paternidad") al valor
 * canónico definido en TIPOS_LICENCIA. Lo desconocido se mapea a "Otro".
 */
export function normalizeTipoLicencia(raw: string): TipoLicencia {
  const n = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!n) return 'Otro';
  if (n.startsWith('certificac')) return 'Certificación médica';
  if (n.includes('licencia anual') || n === 'anual') return 'Licencia Anual';
  if (n.includes('estudio')) return 'Licencia por estudio';
  if (n === 'pap') return 'PAP';
  if (n.includes('lactancia')) return 'Lactancia';
  if (n.includes('donacion de sangre') || n.includes('donar sangre')) return 'Donación de sangre';
  if (n.includes('duelo')) return 'Duelo';
  if (n.includes('maternal') || n.includes('maternidad')) return 'Licencia Maternal';
  if (n.includes('mamografia')) return 'Mamografía';
  if (n.includes('paternidad')) return 'Licencia por paternidad';
  if (n.includes('matrimonio')) return 'Licencia Matrimonio';
  return 'Otro';
}

// Campos booleanos de seguimiento — se guardan como INTEGER 0/1 en DB.
export const CHECK_FIELDS = [
  'recep_notificacion',
  'supervision',
  'recep_certificado',
  'planificacion',
] as const;
export type CheckField = (typeof CHECK_FIELDS)[number];
