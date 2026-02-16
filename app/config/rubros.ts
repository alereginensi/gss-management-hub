export const JOB_ROLES = {
    'Limpieza': [
        'Limpieza de Pisos',
        'Limpieza de Baños',
        'Recolección de Residuos',
        'Limpieza de Vidrios',
        'Desinfección de Superficies',
        'Limpieza de Comedor',
        'Reposo de Insumos'
    ],
    'Mantenimiento': [
        'Reparación Eléctrica',
        'Reparación Sanitaria',
        'Pintura',
        'Carpintería',
        'Jardinería',
        'Revisión de Luminarias',
        'Mantenimiento Preventivo AA'
    ],
    'Seguridad': [
        'Ronda Perimetral',
        'Control de Acceso',
        'Revisión de Cámaras',
        'Reporte de Incidentes',
        'Apertura de Portones',
        'Cierre de Instalaciones'
    ],
    'Logística': [
        'Recepción de Mercadería',
        'Control de Stock',
        'Preparación de Pedidos',
        'Carga de Camiones',
        'Inventario'
    ]
} as const;

export type JobRole = keyof typeof JOB_ROLES;
export const ROLE_OPTIONS = Object.keys(JOB_ROLES) as JobRole[];
