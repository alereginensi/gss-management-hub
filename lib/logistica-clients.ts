/** Clientes extra para listas de logística (entrega, ingreso, solicitud), además de /api/config/locations */
export const LOGISTICA_EXTRA_CLIENTS = ['SCOUT', 'ORBIS', 'REIMA', 'ERGON'] as const;

export function mergeLogisticaClientNames(locations: string[]): string[] {
    const set = new Set<string>([...locations, ...LOGISTICA_EXTRA_CLIENTS]);
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}
