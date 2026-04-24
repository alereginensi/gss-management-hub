/**
 * Helpers del módulo RRHH → Citaciones Laborales.
 * Solo acceso admin y rrhh.
 */

export const CITACIONES_ALLOWED_ROLES = ['admin', 'rrhh'] as const;

export type CitacionesRole = (typeof CITACIONES_ALLOWED_ROLES)[number];

export function isCitacionesRole(role: string | undefined): boolean {
  return !!role && (CITACIONES_ALLOWED_ROLES as readonly string[]).includes(role);
}
