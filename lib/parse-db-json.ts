/**
 * Campos JSON: en SQLite suelen ser TEXT; en Postgres json/jsonb el driver ya devuelve objeto/array.
 * No usar JSON.parse directamente sobre valores ya parseados.
 */
export function parseDbJsonArray(raw: unknown): any[] {
    if (raw == null || raw === '') return [];
    if (typeof raw === 'string') {
        try {
            const v = JSON.parse(raw);
            return Array.isArray(v) ? v : [];
        } catch {
            return [];
        }
    }
    return Array.isArray(raw) ? raw : [];
}
