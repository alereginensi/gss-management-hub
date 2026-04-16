export const AGENDA_ADMIN_ROLES = ['admin', 'logistica', 'jefe', 'rrhh'] as const;

export const AGENDA_SUPERVISOR_ROLES = [...AGENDA_ADMIN_ROLES, 'supervisor'] as const;

export const AGENDA_EMERGENCY_ROLES = [...AGENDA_SUPERVISOR_ROLES, 'limpieza', 'tecnico'] as const;

export type AgendaRole = (typeof AGENDA_EMERGENCY_ROLES)[number];

export function isAgendaAdminRole(role: string | undefined): boolean {
  return !!role && (AGENDA_ADMIN_ROLES as readonly string[]).includes(role);
}

export function isAgendaSupervisorRole(role: string | undefined): boolean {
  return !!role && (AGENDA_SUPERVISOR_ROLES as readonly string[]).includes(role);
}

export function isAgendaEmergencyRole(role: string | undefined): boolean {
  return !!role && (AGENDA_EMERGENCY_ROLES as readonly string[]).includes(role);
}

export function sourceForRole(role: string | undefined): 'logistica' | 'limpieza' | 'seguridad' | 'rrhh' {
  if (role === 'limpieza') return 'limpieza';
  if (role === 'tecnico') return 'seguridad';
  if (role === 'rrhh') return 'rrhh';
  return 'logistica';
}
