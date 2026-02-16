export const LOCATIONS = [
    'Edificio Central',
    'Planta Industrial',
    'Depósito Norte',
    'Depósito Sur',
    'Oficinas Administrativas',
    'Comedor',
    'Estacionamiento',
    'Puesto de Guardia 1',
    'Puesto de Guardia 2'
] as const;

export type Location = typeof LOCATIONS[number];
