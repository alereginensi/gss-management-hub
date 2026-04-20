// Example clients file — real data is generated at build time from CLIENTS_DATA env var.
// See scripts/generate-clients.js
export const CLIENT_SECTOR_MAP: Record<string, string[]> = {
    'Cliente Ejemplo A': ['Sede Central', 'Sucursal Norte'],
    'Cliente Ejemplo B': ['Planta', 'Oficina'],
    'Cliente Ejemplo C': [],
};

export const getAvailableClients = () => Object.keys(CLIENT_SECTOR_MAP).sort();
export const getSectorsForClient = (client: string): string[] => {
    if (!client) return [];
    const sectors = CLIENT_SECTOR_MAP[client];
    if (!sectors || sectors.length === 0) return ['Sector Único'];
    return sectors;
};
