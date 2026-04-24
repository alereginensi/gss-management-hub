# Prompt para Claude Code — Integración del módulo de Citaciones Laborales

Copiá este prompt y pegalo en Claude Code (terminal) para que integre el módulo automáticamente.

---

## PROMPT A USAR EN CLAUDE CODE:

```
Tengo un módulo de Gestión de Citaciones Laborales listo para integrar.
Está en la carpeta `modulo-citaciones-laborales/`.

El módulo está escrito en React + TypeScript.
El componente raíz es `CitacionesModule` importable desde `modulo-citaciones-laborales/index.ts`.

Necesito que hagas lo siguiente:

1. **Instalar dependencia**: corré `npm install xlsx` si no está instalada.

2. **Adaptar la capa de persistencia** (`modulo-citaciones-laborales/utils/storage.ts`):
   - Actualmente usa localStorage. Reemplazá las 4 funciones (getAll, create, update, remove)
   para que usen [INDICAR TU ORM/API: ej. "Prisma con endpoint Next.js API", "Axios con REST API en /api/rrhh", "Supabase client", etc.]
   - El contrato de cada función está documentado en el archivo.

3. **Integrar el componente** en el módulo de RRHH de la aplicación:
   - Encontrá la ruta o sección de RRHH en el router/layout existente.
   - Agregá una nueva pestaña o ruta llamada "Citaciones Laborales".
   - Importá `CitacionesModule` desde `modulo-citaciones-laborales/index.ts` y renderizalo ahí.

4. **Ajustar estilos** (`modulo-citaciones-laborales/citaciones.css`):
   - Las variables CSS usan el prefijo `--cit-` para no colisionar.
   - Si la app tiene un design system propio, sobrescribí las variables `--cit-*` en el CSS
   global para que los colores y tipografía sean consistentes.
   - Asegurate de importar `citaciones.css` en el componente o en el CSS global.

5. **Verificar** que el módulo funciona correctamente:
   - Que se puede crear una citación nueva.
   - Que el drawer lateral se abre y cierra.
   - Que el botón "Exportar Excel" descarga el archivo.
   - Que los filtros y tabs funcionan.
```

---

## NOTAS PARA ADAPTAR EL PROMPT

Antes de pegarlo en Claude Code, reemplazá:

- `[INDICAR TU ORM/API]` con el stack real, por ejemplo:
  - `"fetch a /api/rrhh/citaciones (REST API propia)"`
  - `"Prisma ORM con PostgreSQL"`
  - `"Supabase JS client"`
  - `"Axios con baseURL configurado en lib/api.ts"`

- Si la app no es Next.js/React puro, agregá al prompt:
  `"La aplicación usa [Vue/Nuxt/Angular/etc.], adaptá los componentes al framework correspondiente."`

---

## ESTRUCTURA DEL MÓDULO (referencia rápida)

```
modulo-citaciones-laborales/
├── index.ts                      ← Punto de entrada (importar desde aquí)
├── README.md                     ← Documentación completa
├── package.json                  ← Dependencias
├── citaciones.css                ← Estilos (variables --cit-*)
├── types/citacion.ts             ← Tipos TypeScript
├── utils/
│   ├── storage.ts                ← 👈 ADAPTAR al backend propio
│   ├── format.ts                 ← Helpers fecha/monto
│   └── export.ts                 ← Exportación Excel
├── hooks/useCitaciones.ts        ← Toda la lógica de estado
├── api/citaciones.api.ts         ← Capa API (re-exporta storage.ts)
└── components/
    ├── CitacionesModule.tsx      ← 👈 COMPONENTE RAÍZ
    ├── PlanillaView.tsx          ← Tabla con filtros
    ├── DrawerEditar.tsx          ← Panel lateral edición
    ├── StatsGrid.tsx             ← Tarjetas de resumen
    └── FacturasEditor.tsx        ← Editor de facturas
```

## ÚNICO ARCHIVO OBLIGATORIO A ADAPTAR

`utils/storage.ts` — Solo estas 4 funciones:

| Función | Descripción | Adaptar a |
|---|---|---|
| `getAll()` | Traer todas las citaciones | GET /api/rrhh/citaciones |
| `create(data)` | Crear una nueva | POST /api/rrhh/citaciones |
| `update(id, data)` | Actualizar existente | PUT /api/rrhh/citaciones/:id |
| `remove(id)` | Eliminar | DELETE /api/rrhh/citaciones/:id |
