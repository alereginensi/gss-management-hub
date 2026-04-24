# Módulo: Gestión de Citaciones Laborales
## Módulo de RRHH — Integración para Claude Code

---

## Descripción

Módulo completo para gestionar citaciones laborales del MTSS y Juzgado.
Permite registrar, seguir y cerrar expedientes laborales, incluyendo facturas
del abogado y acuerdos transaccionales.

**La carga de PDFs fue removida.** En su lugar, los registros se crean manualmente
o vía API desde el backend de la aplicación principal.

---

## Stack asumido

El código está escrito en **React + TypeScript**. Si tu aplicación usa otro stack,
indicárselo a Claude Code al momento de integrar.

Dependencias que necesitás tener instaladas:
```
xlsx          (para exportar a Excel)
```

Si usás npm:
```bash
npm install xlsx
```

---

## Estructura de archivos

```
modulo-citaciones-laborales/
├── README.md                     ← Este archivo
├── types/
│   └── citacion.ts               ← Tipos TypeScript
├── utils/
│   ├── storage.ts                ← Persistencia (localStorage o adaptar a DB)
│   ├── format.ts                 ← Helpers de formato (fechas, montos)
│   └── export.ts                 ← Exportación a Excel
├── hooks/
│   └── useCitaciones.ts          ← Hook principal con toda la lógica
├── components/
│   ├── PlanillaView.tsx           ← Vista tabla principal
│   ├── DrawerEditar.tsx           ← Panel lateral para editar/ver
│   ├── StatsGrid.tsx              ← Tarjetas de resumen
│   ├── FacturasEditor.tsx         ← Editor de facturas del abogado
│   └── CitacionesModule.tsx       ← Componente raíz del módulo
├── api/
│   └── citaciones.api.ts         ← Capa API (adaptar al backend propio)
└── citaciones.css                ← Estilos del módulo
```

---

## Cómo integrar

### Instrucciones para Claude Code

1. Copiá esta carpeta al proyecto.
2. Decile a Claude Code:

> "Tengo este módulo de citaciones laborales en `modulo-citaciones-laborales/`.
> Integralo al módulo de RRHH de la aplicación. El componente raíz es
> `CitacionesModule.tsx`. Adaptá la capa de persistencia en `storage.ts`
> para que use [tu base de datos / ORM / API REST] en lugar de localStorage."

### Puntos de adaptación obligatorios

| Archivo | Qué adaptar |
|---|---|
| `utils/storage.ts` | Cambiar localStorage por llamadas a la API/DB del proyecto |
| `api/citaciones.api.ts` | Conectar los endpoints reales del backend |
| `citaciones.css` | Ajustar variables CSS al design system de la app |
| `CitacionesModule.tsx` | Importar en la ruta correspondiente del módulo de RRHH |

---

## Modelo de datos

```typescript
interface Citacion {
  id: string;
  empresa: string;
  org: 'MTSS' | 'Juzgado';
  fecha: string;          // YYYY-MM-DD
  hora: string;           // HH:MM
  sede: string;
  trabajador: string;
  abogado: string;
  rubros: string;
  total: number;          // Total reclamado UYU
  estado: 'pendiente' | 'en curso' | 'cerrado';
  motivo: string;
  acuerdo: string;
  macuerdo: number;       // Monto pagado en acuerdo UYU
  facturas: Factura[];
  obs: string;
  createdAt: string;
  updatedAt: string;
}

interface Factura {
  id: string;
  nro: string;
  tipo: 'Asistencia MTSS' | 'Contestación demanda' | 'Acuerdo transaccional' | 'Asistencia juzgado' | 'Otros';
  monto: number;
}
```

---

## Funcionalidades incluidas

- ✅ Tabla paginada con filtros por organismo y búsqueda
- ✅ Tabs por estado (todas / pendientes / en curso / cerradas)
- ✅ Drawer lateral para ver y editar cada expediente
- ✅ Múltiples facturas por caso con concepto y monto
- ✅ Acuerdo transaccional con monto pagado
- ✅ Cierre de expediente con un clic
- ✅ Stats: total casos, pendientes, en curso, cerrados, reclamado, acuerdos pagados, honorarios
- ✅ Exportación a Excel (.xlsx) con todas las columnas
- ✅ Carga manual de nuevas citaciones

## Lo que NO incluye (por diseño)

- ❌ Lectura automática de PDFs (requiere IA — se gestiona externamente vía Claude chat)
- ❌ Autenticación (la maneja la app principal)
- ❌ Notificaciones de audiencias próximas (agregar si se necesita)
