# Contexto de la aplicación — GSS Management Hub

Documento orientado a desarrolladores y asistentes de IA: visión general del código, módulos y convenciones recientes. Complementa el [README](./README.md) y las guías `GUIA_*.md`.

---

## Qué es

Portal web interno para **GSS Facility Services**: tickets, bitácora, operaciones de limpieza, logística, cotización, seguridad electrónica, administración y notificaciones. Stack principal: **Next.js 16 (App Router)**, **React 19**, API Routes, **SQLite** en local y **PostgreSQL** en producción (p. ej. Railway).

---

## Estructura del repositorio

| Ruta | Rol |
|------|-----|
| `app/` | Rutas y UI (App Router): `page.tsx`, `layout.tsx`, `api/` |
| `app/api/` | Endpoints REST (auth, tickets, logbook, logística, limpieza, etc.) |
| `app/context/` | `TicketContext.tsx` — sesión, tickets, notificaciones (cliente) |
| `app/components/` | Componentes reutilizables (`Header`, `Sidebar`, `logistica/ArticuloSearchAdd`, …) |
| `lib/` | Lógica compartida: DB, auth, helpers |
| `scripts/` | Scripts de mantenimiento y migración (Node) |
| `public/` | Estáticos, PWA, service worker |
| `public/logo.png` | Logo principal. En **headers** (barra azul) y **sidebar** se usa con **`filter: brightness(0) invert(1)`** para verlo **blanco** sobre fondo oscuro. **`public/favicon.ico`** es copia del PNG para `/favicon.ico`. |

---

## Base de datos

- **`lib/db.ts`**: capa `DbWrapper` que abstrae **SQLite** (`better-sqlite3`) y **PostgreSQL** (`pg` vía `DATABASE_URL`). Crea tablas y migraciones según el entorno. Durante **`next build`** (`NEXT_PHASE=phase-production-build`) o con **`SKIP_DB_INIT=1`**, el **CREATE TABLE** inicial se **aplaza** al primer `query` en runtime para no reventar el build si la DB no es alcanzable.
- **Local**: suele usarse un archivo SQLite (p. ej. `tickets.db`).
- **Producción**: PostgreSQL en Railway; usar URL **pública** de Postgres, no hostnames `*.railway.internal` desde la máquina de desarrollo.
- **Campos JSON**: en SQLite suelen guardarse como `TEXT`; en Postgres a menudo son `json`/`jsonb` y el driver devuelve **objeto/array ya parseado**. Para leer arrays en APIs se usa **`lib/parse-db-json.ts`** (`parseDbJsonArray`) en rutas de logística y similares, evitando `JSON.parse` directo sobre valores ya parseados (causa típica de 500 en producción).

---

## Autenticación y API

- Sesión basada en **JWT** almacenado en cliente (`localStorage`); rutas API validan con helpers en `lib/auth*.ts`.
- Respuestas **401** en `/api/auth/me`, `/api/tickets`, etc. son normales si no hay sesión o expiró; el contexto puede registrar advertencias sin tratarlo como error grave.

---

## Módulo de logística

Rutas de UI bajo `app/logistica/`:

- **`/`** — Hub de logística.
- **`/logistica/calendario`** — Calendario de eventos: **entrega**, **ingreso mercadería** (antes “despacho” en código: tipo `despacho`), **solicitud**. Modal “Nuevo evento”, export Excel, firma en entregas, etc.
- **`/logistica/solicitud-materiales`** — Solicitudes de materiales (lista, filtros, modal “Nueva solicitud”).
- **`/logistica/envios`**, **`/logistica/ordenes-compra`** — Envíos y órdenes de compra.

### Clientes en listas (entrega, ingreso, solicitud)

- Origen principal: **`/api/config/locations`**.
- **`lib/logistica-clients.ts`**: constante `LOGISTICA_EXTRA_CLIENTS` (p. ej. SCOUT, ORBIS, REIMA, ERGON) y función **`mergeLogisticaClientNames`** para unir y ordenar con las ubicaciones configuradas.

### Catálogo de artículos (solicitudes)

- **`lib/logistica-articulos.ts`**: exporta **`ARTICULOS_MATERIALES`** (lista de strings, ~356 ítems únicos) y helpers **`normalizeArticuloSearch`**, **`filterArticulosPorBusqueda`** para filtrar sin saturar el DOM.
- **`app/components/logistica/ArticuloSearchAdd.tsx`**: buscador con lista desplegable; la lista se renderiza con **portal a `document.body`** y posición `fixed` para no quedar recortada por modales con `overflow`. Prop **`compact`** para estilos más bajos en **móvil** (`width < 768` en las páginas que lo usan).

### APIs relacionadas (ejemplos)

- `app/api/logistica/calendario/`, `app/api/logistica/solicitudes/`, exportaciones en `export/route.ts`, etc. — usar **`parseDbJsonArray`** donde haya columnas JSON de ítems.

---

## Operaciones limpieza y migraciones

- **`scripts/migrate_data.ts`**: script **destructivo** (recrea tablas desde SQLite local). **No usar contra producción con datos reales.** Incluye advertencia en cabecera.
- **`scripts/migrate_limpieza_personal_only.cjs`**: migración **segura** solo de personal (`limpieza_usuarios`) desde SQLite local hacia Postgres (UPSERT por cédula, comprobaciones, ajuste de secuencia). Ejecutar con variables de entorno de Postgres público.
- **`npm run migrate:limpieza-personal`** — atajo definido en `package.json`.

---

## Variables de entorno (referencia)

- **`DATABASE_URL`** / **`POSTGRES_URL`** / **`DATABASE_PUBLIC_URL`**: conexión PostgreSQL (según qué lea cada script).
- Desarrollo local: **`env.local.example`** y `.env.local` (no commitear secretos).
- Otros: VAPID para push, Cloudinary, correo, etc., según despliegue.

### Mitrabajo (Playwright en Railway)

- **Railway prioriza `Dockerfile` sobre Nixpacks** si hay `Dockerfile` en la raíz: **`nixpacks.toml` no se usa** en ese caso. El `Dockerfile` debe instalar Chromium (`npx playwright install …`) y **copiar** `/app/.playwright-browsers` al stage final; imágenes **Alpine** no sirven para los binarios glibc de Playwright — usar **`node:20-bookworm-slim`** y librerías de sistema en el runner.
- **`nixpacks.toml`** (solo si el build es Nixpacks): `PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers` y en build `playwright install --with-deps chromium` en la misma línea que el comando.
- **`lib/mitrabajo-download.js`**: **`channel: 'chromium'`** (headless “nuevo” con Chromium completo) para no depender del binario aparte **chrome-headless-shell**. Antes del `launch` se fuerza **`HOME` + `XDG_*` en un directorio bajo `os.tmpdir()`** y flags tipo **`--no-zygote`** para evitar **`chrome_crashpad_handler: --database is required`** en contenedores sin home escribible. Navegación con **`waitUntil: 'load'`** (no `networkidle`), timeouts **~120s**; **`/api/mitrabajo/trigger`** exporta **`maxDuration = 300`**. URL base **`MITRABAJO_BASE_URL`** (default **`https://www2.mitrabajo.uy`**), búsqueda de fechas por **selectores Yii + `getByLabel` + escaneo DOM** de inputs en `#panel` / `form` / `body`, y **diag** en el error si falla.
- Variable **`PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers`** en el servicio si hace falta alinear con la imagen.

---

## UI móvil — modales de logística

En **`calendario`** y **`solicitud-materiales`**, el modal de nuevo evento / nueva solicitud aplica estilos **más compactos** cuando `isMobile` / ancho reducido: menos padding, campos fecha/select más bajos, pestañas más densas, fila de **buscar artículo + manual/agregar fila** en **columna** para no comprimir el placeholder.

### Hub de módulos (`.hub-menu-grid` / `.hub-menu-card`)

En viewports **≤480px**, las tarjetas del menú de secciones (p. ej. Limpieza, Logística, Cotización, Seguridad) usan **fila**: icono en una **columna de ancho fijo** a la izquierda y texto a la derecha (`justify-content: flex-start`), para que los iconos **no se desplacen** según el largo del nombre. Los enlaces del grid usan **ancho completo** (`hub-menu-grid > a`).

### Landing y sub-hubs (`.landing-modules-grid` / `.landing-card-btn`)

En **≤767px** (`globals.css`) el grid de módulos es **una sola columna** (stack vertical), mismas tarjetas borde azul que en escritorio. El **landing** (`app/page.tsx`) ya no usa lista distinta en móvil: todo usa la misma marca. Los hubs de submódulos (p. ej. `seguridad-electronica/page.tsx`, `logistica/page.tsx`, …) comparten el mismo grid.

---

## Módulo Mitrabajo

Integración con el portal externo **mitrabajo.uy** (sistema de asistencia del MTSS Uruguay) para descarga automática diaria del reporte Excel del panel supervisor.

### Tecnologías usadas

- **Playwright** (`playwright`) — automatización de browser headless (Chromium) para login con sesión Yii/JWT+CSRF, navegación y descarga del archivo
- **SheetJS** (`xlsx`) — lectura del `.xls` descargado, eliminación de fila 2 vacía (bug del sitio) y conversión a `.xlsx`
- **node-cron** — scheduling diario a las **08:00 AM (America/Montevideo)**; corre como proceso background junto a `next start` via el script `start` de `package.json`

### Archivos clave

| Archivo | Rol |
|---------|-----|
| `lib/mitrabajo-download.js` | Lógica principal: login, filtro de fecha, descarga, conversión `.xls→.xlsx`. Importado directamente por el API route (no `execFile`) |
| `scripts/download-mitrabajo.cjs` | CLI wrapper — llama a `lib/mitrabajo-download.js`. Uso: `npm run mitrabajo:download` o con `--debug` para ver el browser |
| `scripts/cron-mitrabajo.cjs` | Proceso cron persistente con `node-cron`. En Railway corre como `node scripts/cron-mitrabajo.cjs & next start` |
| `app/mitrabajo/page.tsx` | UI: lista archivos descargados, descarga individual, elimina, trigger manual con fecha opcional |
| `app/api/mitrabajo/files/` | Lista archivos `.xlsx` en `downloads/mitrabajo/` |
| `app/api/mitrabajo/download/` | Sirve un archivo con auth (sin URL pública directa) |
| `app/api/mitrabajo/delete/` | Elimina un archivo |
| `app/api/mitrabajo/trigger/` | Dispara descarga on-demand importando `lib/mitrabajo-download.js` |

### Acceso y roles

- Rol dedicado **`mitrabajo`** (solo acceso a esta sección)
- O módulo **`mitrabajo`** activable desde edición de usuario (para jefes u otros roles que necesiten acceso adicional)
- Visible en sidebar bajo **Operaciones**, debajo de Bitácora

### Variables de entorno requeridas

```
MITRABAJO_USER=        # usuario del portal mitrabajo.uy
MITRABAJO_PASS=        # contraseña
MITRABAJO_DOWNLOAD_DIR= # opcional, default: downloads/mitrabajo
```

### Deploy en Railway

- `nixpacks.toml` con `PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers` — el browser se instala en build con `npx playwright install --with-deps chromium` y el código fuerza el mismo path en runtime
- El cron arranca junto a Next.js: `"start": "node scripts/cron-mitrabajo.cjs & next start"`
- Los archivos descargados viven en el filesystem del servicio (no en DB)

### Flujo de descarga

1. Login con usuario/contraseña en `http://www2.mitrabajo.uy`
2. Navega al panel supervisor (`?r=monitor/monitor/panelsupervisor`)
3. Setea `#monitor-fechadesde` y `#monitor-fechahasta` con la fecha de ayer (DD/MM/YYYY) disparando eventos jQuery `change`
4. Clickea el botón submit del form `#panel`
5. Detecta el link de exportación (`a[href*="export"]`) y descarga
6. Convierte `.xls` → `.xlsx` + elimina fila 2 vacía vía SheetJS
7. Guarda como `mitrabajo_YYYY-MM-DD.xlsx`

---

## Scripts npm útiles

```bash
npm run dev          # desarrollo (webpack explícito en package.json)
npm run build        # build producción
npm run lint         # eslint
npm run migrate:limpieza-personal  # migración segura limpieza → Postgres
```

---

## Documentación adicional en el repo

- [README](./README.md) — instalación y visión general.
- [DEPLOYMENT_QUICKSTART](./DEPLOYMENT_QUICKSTART.md) — Railway.
- [GUIA_BITACORA](./GUIA_BITACORA.md), [GUIA_TICKETS](./GUIA_TICKETS.md), [GUIA_ASISTENCIA](./GUIA_ASISTENCIA.md), [GUIA_USUARIOS](./GUIA_USUARIOS.md), [GUIA_ADMINISTRADORES](./GUIA_ADMINISTRADORES.md), [GUIA_CONFIGURACION](./GUIA_CONFIGURACION.md), [BACKUPS](./BACKUPS.md).

---

---

## Módulo Agenda Web de Uniformes (`app/logistica/agenda/`)

Sistema integral de gestión de turnos y uniformes bajo Logística.

### Frentes

**Flujo público (sin auth):**
- `app/logistica/agenda/` — Lookup por documento (paso 1)
- `app/logistica/agenda/pedido/` — Selección del pedido (paso 2)
- `app/logistica/agenda/turno/` — Selección de turno con hold temporal (paso 3)
- `app/logistica/agenda/confirmacion/` — Confirmación (paso 4)

**Panel admin (requiere `logistica` o `admin`):**
- `app/logistica/agenda/admin/` — Dashboard con stats
- Sub-páginas: `citas/`, `citas/[id]/`, `horarios/`, `empleados/`, `catalogo/`, `solicitudes/`, `envios-interior/`, `articulos/`, `importaciones/`, `migracion/`, `configuracion/`, `auditoria/`

### APIs públicas (`/api/logistica/agenda/public/`)
- `lookup/` — POST por documento, registra intentos fallidos
- `slots/` — GET slots disponibles
- `slots/[id]/hold/` — POST/DELETE hold atómico (UPDATE condicional SQLite/PG)
- `appointments/` — POST confirmar cita

### APIs admin (`/api/logistica/agenda/`)
- `stats/`, `employees/`, `employees/[id]/`, `catalog/`, `catalog/[id]/`
- `slots/`, `slots/[id]/`, `slots/generate/`
- `appointments/`, `appointments/[id]/`, `appointments/[id]/delivery/`, `/sign/`, `/remito/`
- `remito/parse/` — parseo texto remito → items estructurados
- `requests/`, `requests/[id]/`, `requests/[id]/sign/`
- `shipments/`, `shipments/[id]/`, `shipments/[id]/sign/`
- `articles/`, `articles/[id]/`, `articles/renewal/`
- `changes/`, `changes/[id]/`, `changes/[id]/sign/`, `changes/[id]/complete/`
- `import/`, `import/template/` — importación masiva Excel/CSV (xlsx)
- `export/` — exportación Excel (citas, empleados, entregas); soporta filtros `status` y `search`
- `config/` — GET/PUT configuración global (solo admin PUT)
- `failed-attempts/` — solo admin
- `audit/` — solo admin

### Panel admin — páginas nuevas o rediseñadas (rama `agenda-web`)

**`admin/empleados/`** — lista paginada (50/página). Columna extra con toggle **Habilitado para cambio** (icono `PackagePlus`): activa `allow_reorder = 1` en el empleado vía PUT. Badge azul si habilitado, gris si no.

**`admin/entregas/`** — historial de entregas completadas. Filtros: búsqueda (nombre/CI), desde, hasta, empresa. Tabla con columnas: Fecha, Empleado, CI, Empresa, Ítems, Remito, Firma emp., Firma resp., Fecha entrega, Ver. Botón exportar Excel.

**`admin/citas/`** — para el rol `logistica`, al cargar la página se aplican filtros iniciales `desde=hoy`, `hasta=hoy`, `estado=confirmada`. Botones rápidos: "Hoy", "Solo confirmadas", "Restablecer".

**Devolución opcional dentro de cita** (reemplaza al módulo `admin/cambios` viejo):

En `admin/citas/[id]` hay un toggle "Habilitar devolución" (icono `PackagePlus`, mismo estilo que `allow_reorder` en empleados). Al activarlo aparecen dos tarjetas con borde rojo:
- **Ítems devueltos**: lista editable (prenda / talla / cantidad).
- **Remito de devolución**: número de remito, texto raw, subida de PDF (`/api/logistica/agenda/appointments/[id]/remito` con `kind=return`).

Al "Completar entrega" con el toggle activo, el PUT a `/api/.../delivery` envía también `has_return=1`, `returned_order_items`, `remito_return_number`. La constancia impresa agrega una tabla roja "Prendas devueltas" + el número de remito de devolución.

`admin/entregas` muestra un badge naranja "Con cambio" en las filas con `has_return=1` (tooltip con el nro de remito devolución).

Columnas nuevas en `agenda_appointments` (ALTER TABLE aditivo): `has_return`, `returned_order_items`, `remito_return_number`, `remito_return_pdf_url`, `parsed_remito_return_text`, `parsed_remito_return_data`.

El módulo legacy `admin/cambios` y sus endpoints `/api/logistica/agenda/changes/*` fueron eliminados. La tabla `agenda_change_events` queda intacta con todos sus registros históricos.

### Libs de soporte
- `lib/agenda-types.ts` — interfaces TypeScript. `AgendaUniformCatalogItem` acepta `null` en campos opcionales. (Los tipos `ChangeEventStatus` / `AgendaChangeEvent` fueron removidos junto con el módulo Cambios.)
- `lib/agenda-helpers.ts` — hold/release slot, logAudit, badges, generateSlotsForMonth
- `lib/agenda-catalog.ts` — catálogo por empresa + normalización de pedidos; re-exporta `ARTICLE_NAME_ALIASES` desde `agenda-article-aliases.ts`
- `lib/agenda-article-aliases.ts` — **nuevo**: mapa de aliases de artículos sin imports de servidor; importable en componentes cliente
- `lib/agenda-remito-parser.ts` — parseo texto libre de remito → items + reconciliación; importa aliases desde `agenda-article-aliases.ts` (client-safe)
- `lib/agenda-import.ts` — parser Excel/CSV para empleados y migración histórica
- `lib/agenda-storage.ts` — abstracción de almacenamiento (filesystem local por defecto; si `CLOUDINARY_URL` → Cloudinary)
- `app/components/AgendaSignatureCanvas.tsx` — canvas de firma con `signature_pad`; `forwardRef` con ref `{ clear(), isEmpty() }`; props `onChange(dataUrl)`, `disabled?`, `label?`

### Cron y scripts
- `scripts/cron-agenda.cjs` — auto-generación mensual de slots con `node-cron` (día 5 de cada mes, 09:00 Montevideo)
- `npm run agenda:slots -- --manual 2025-08` — genera slots de un mes específico

### DB — `agenda_appointments` (columnas nuevas para devolución dentro de cita)
ALTER TABLE aditivo (PG: `information_schema.columns`, SQLite: `PRAGMA table_info`):
`has_return INTEGER DEFAULT 0`, `returned_order_items TEXT`, `remito_return_number TEXT`, `remito_return_pdf_url TEXT`, `parsed_remito_return_text TEXT`, `parsed_remito_return_data TEXT`.

### DB (14 tablas en `lib/db.ts`)
`agenda_employees`, `agenda_time_slots`, `agenda_appointments`, `agenda_appointment_item_changes`, `agenda_config`, `agenda_failed_attempts`, `agenda_uniform_catalog`, `agenda_articles`, `agenda_requests`, `agenda_shipments`, `agenda_shipment_articles`, `agenda_change_events` (legacy — solo lectura, módulo removido), `agenda_import_jobs`, `agenda_audit_log`.

### Print CSS
`app/globals.css` — clases `.no-print`, `.print-only`, `.print-comprobante` para impresión de comprobantes de entrega, solicitudes emergentes, envíos y **constancias de cambio de prenda**.

### Rutas públicas en middleware
`/logistica/agenda`, `/logistica/agenda/pedido`, `/logistica/agenda/turno`, `/logistica/agenda/confirmacion` — sin auth requerida.

### Archivos subidos
Se guardan en `public/uploads/agenda/{firmas|remitos}/` por defecto. Si `CLOUDINARY_URL` → Cloudinary. Abstracción en `lib/agenda-storage.ts`.

---

*Última actualización de este archivo: devolución opcional integrada en citas (reemplaza módulo Cambios legacy), badge "Con cambio" en entregas, importación de catálogo con preview multi-sección.*

---

## Módulo Operaciones Limpieza — Planilla por turno (rama `operaciones-limpieza`)

Rediseño del flujo de planilla/informes de limpieza: soporte de **planificado vs asistió**, importación masiva desde Excel del turno y exportaciones a formato **Excel GSS** y **Versus** (sistema de nómina).

### Rol nuevo: `encargado_limpieza`

Rol dedicado para supervisores que solo gestionan la planilla de **un cliente (y opcionalmente un sector)**.

- Campos nuevos en `users`: **`cliente_asignado TEXT`**, **`sector_asignado TEXT`** (migración aditiva en SQLite y Postgres).
- Si `sector_asignado` es null → el encargado ve todos los sectores del cliente.
- `panel_access = 0` por defecto: el login lo lleva directo a `/operaciones-limpieza/informes`.
- Helper `hasModuleAccess(user, 'limpieza')` reconoce el rol (ver `app/context/TicketContext.tsx`).
- Union `User.role` extendida con `'encargado_limpieza'`.
- Campo adicional en `users`: **`cedula TEXT`** (obligatorio para el rol). El informe autocompleta la fila del puesto cuyo nombre matchea `/ENCARG/i` con `currentUser.name` + `cedula` marcándola como `isManual: true`.
- `/api/auth/login` y `/api/auth/me` devuelven `cliente_asignado`, `sector_asignado`, `cedula` en el payload de sesión; el JWT también los embebe.
- **`/api/limpieza/asistencia`**: si el caller tiene rol `encargado_limpieza`, el endpoint **sobrescribe** los query params `cliente` y `sector` con los del usuario (no se pueden consultar otros clientes aunque se manipule la URL).
- UI admin (`app/admin/users/page.tsx`): al elegir rol `encargado_limpieza`, se muestra bloque con dropdown de clientes (poblado desde `/api/limpieza/planilla-config/full`) + selector de sectores (cascading desde el mismo endpoint) + input obligatorio de cédula. Acción POST nueva `create_encargado_limpieza` en `/api/admin/users`.

### DB — cambios en `limpieza_asistencia`

Columnas agregadas (ALTER TABLE aditivo en ambos motores):

- **`planificado INTEGER DEFAULT 0`** — fila generada por importación del turno (vs. creada manualmente por el supervisor en el día).
- **`asistio INTEGER`** — `null` = sin marcar, `0` = no asistió, `1` = asistió. Si `asistio = 1` el POST valida **firma obligatoria** + `entrada1` (solo hora de entrada). Salida puede completarse después (permite guardar progreso durante el turno y continuar).
- **`import_batch_id INTEGER`** — FK a `limpieza_planilla_imports.id`.
- **`observaciones TEXT`**, **`categoria TEXT`** — observación por fila y categoría del funcionario en esta planilla.

### Tabla nueva: `limpieza_planilla_imports`

Registro de cada importación de planilla por turno:

```
id | fecha | seccion | cliente | sector | filename | uploaded_by | rows_created | created_at
```

### Helpers: `lib/limpieza-hours.ts`

- **`calcHorasTrabajadas({ entrada1, salida1, entrada2, salida2 })`** → horas decimales (p. ej. `8.5`). Soporta **turnos nocturnos** cruzando medianoche (`diff += 24*60` si negativo).
- **`normalizarCategoria(raw)`** → `'LIMPIADOR' | 'AUXILIAR' | 'VIDRIERO' | 'ENCARGADO' | 'OTRA'` (regex sobre string normalizado en mayúsculas).

### API de importación: `/api/limpieza/planilla/import`

- POST solo admin: recibe `multipart/form-data` con Excel del turno + metadata (`fecha`, `seccion`, `cliente`, `sector`, columna de categoría opcional).
- Crea filas en `limpieza_asistencia` con `planificado = 1`, `asistio = null`, y linkea todas vía `import_batch_id` a un nuevo registro en `limpieza_planilla_imports`.

### APIs de exportación

- **`/api/limpieza/planilla/export/excel`** — planilla formato **GSS** (estilo tabla operativa).
- **`/api/limpieza/planilla/export/versus`** — formato para cargar en **Versus** (sistema de nómina). Usa `calcHorasTrabajadas` para volcar horas decimales por funcionario/día.

Ambas soportan filtros `cliente`, `sector`, `turno`, `fecha`. Para `encargado_limpieza` aplica el mismo override de `cliente`/`sector` que en asistencia.

### UI: `app/operaciones-limpieza/informes/page.tsx`

Vista unificada de planilla del día + histórico:

- Selector **Cliente / Sector / Turno / Fecha** arriba, fila de acciones con **PDF (imprimir), Excel, Versus** y **Subir planilla** (solo admin).
- Para filas `planificado = 1` sin asistencia marcada: muestra toggle **Asistió / No asistió**. Al marcar "Asistió" exige firma + hora de entrada (salida opcional, se completa al cerrar el turno).
- Cualquier cambio (hora, firma, toggle, observación) autoguarda inmediatamente al backend → permite al supervisor cerrar la app y retomar más tarde sin perder nada; `fetchAsistencia` rehidrata todos los campos al reabrir.
- Manejo de errores del POST: si el backend rechaza (p.ej. falta firma), muestra el `error` devuelto y revierte el `asistio` optimista a `null`.
- Evitar `0` literal en JSX: todos los `&&` sobre valores numéricos de SQLite (`planificado`, `isManual`) se envuelven en `!!(...)` para no renderizar `0` como texto.
- Filas **no-planificadas** (agregadas a mano en el día) se agrupan por encargado en el render del Excel.
- Botones del toolbar usan colores del logo GSS: **verde `#2e9b3a`** (Excel), **azul `#1d3461`** (Versus), **rojo `#d32e2e`** (Subir planilla). Altura fija 38px + `whiteSpace: nowrap` para alinear con el input de fecha.
- Modal "Subir planilla del turno": drag-and-drop de xlsx, vista previa, dropdown para override de columna categoría, botón enviar al endpoint de import.

### Scripts y deploy

Sin cambios en cron ni deploy — solo migraciones aditivas en `lib/db.ts` que corren al primer `query` en runtime (compatibles con `SKIP_DB_INIT=1` durante `next build`).

---

## Editor de planillas (admin) — rama `operaciones-limpieza`

Configuración de clientes/sectores/turnos/puestos movida de constantes TypeScript a DB, editable por admin desde la UI. Reemplaza los ~230 líneas de `PLANILLA_CONFIG` hardcoded y el mapa `SECTORES_POR_CLIENTE` (archivo `lib/limpieza-sectores.ts` eliminado).

### Tablas nuevas (DB) — `lib/db.ts`

**Aisladas de datos históricos.** No se agrega FK ni se modifica ninguna tabla existente (`limpieza_asistencia`, `limpieza_planilla_imports`, etc). Los registros históricos siguen guardando `cliente` / `sector` / `puesto` como string snapshot, independientes del config.

- **`limpieza_clientes`** — `id | name UNIQUE | active | created_at`.
- **`limpieza_sectores`** — `id | cliente_id | name | active | created_at` (UNIQUE `cliente_id+name`).
- **`limpieza_puestos`** — `id | sector_id | turno | nombre | cantidad | orden | active | created_at`.

### Seed inicial

[lib/limpieza-planilla-seed.ts](lib/limpieza-planilla-seed.ts) contiene los datos extraídos del hardcode anterior (CASMU con 7 sectores y todos sus puestos). El seed es idempotente: solo inserta si `SELECT COUNT(*) FROM limpieza_clientes === 0`. Métodos privados `seedPlanillaConfigSqlite()` / `seedPlanillaConfigPg()` en `lib/db.ts`.

Turnos vacíos (ej. `Roperia 6 A 14`) se preservan insertando un puesto placeholder con `active = 0`.

### APIs

**Admin (guard `role === 'admin'`):**

- `app/api/limpieza/admin/clientes/route.ts` + `[id]/route.ts` — CRUD. DELETE = soft (`active = 0`).
- `app/api/limpieza/admin/sectores/route.ts` + `[id]/route.ts` — CRUD. Soft delete.
- `app/api/limpieza/admin/puestos/route.ts` + `[id]/route.ts` — CRUD. Puestos usan **hard-delete** (no afectan históricos porque no hay FK hacia ellos).

**Lectura (sesión válida, cualquier rol):**

- `app/api/limpieza/planilla-config/full/route.ts` — endpoint consolidado:
  - Sin query: `{ clientes: [{id,name}] }`.
  - Con `?cliente=X`: `{ clientes, cliente, sectores: [{ id, name, turnos: [{ turno, puestos: [{nombre,cantidad}] }] }] }`.
  - Usado por informes (hidrata `PLANILLA_CONFIG` + `SECTORES_POR_CLIENTE` al montar) y por admin/users (dropdown cliente/sector para `encargado_limpieza`).

### UI editor: `app/operaciones-limpieza/planillas-config/page.tsx`

Guard admin: `role !== 'admin'` → "Acceso denegado". Layout 3 columnas responsive:

1. **Clientes** — lista con inline rename (botón Edit2), soft-delete (Trash2), creación inline.
2. **Sectores** del cliente activo — mismo patrón.
3. **Turnos y puestos** del sector activo:
   - Input con `<datalist>` de sugerencias (`6 A 14`, `14 A 22`, `22 A 06`, `12 A 20`, `15 A 23`, `HEMOTERAPIA`) para nuevo turno.
   - Cada turno agrupa sus puestos: inputs inline para `nombre` (onBlur autosave) y `cantidad` (number, min 1). Botón eliminar puesto (hard delete).
   - Botón "+ Puesto" por turno agrega uno con nombre "NUEVO" y cantidad 1.

Banner amarillo permanente: *"Los cambios solo afectan planillas futuras. Los informes ya guardados conservan su configuración original."*

### Integración con informes

[app/operaciones-limpieza/informes/page.tsx](app/operaciones-limpieza/informes/page.tsx):

- Dos mapas **module-level mutables** (`let PLANILLA_CONFIG`, `let SECTORES_POR_CLIENTE`) que los helpers `getPlanillaConfig` / `getTurnosForSector` / `getSectoresForCliente` siguen leyendo (misma API interna que antes).
- Hook `fetchPlanillaConfig(cliente)` hidrata ambos mapas al cambiar `clienteSeleccionado`. Se dispara vía `useEffect`.
- `fetchClientes` cambió: ahora lee de `/api/limpieza/planilla-config/full` (clientes del editor), no de `/api/config/locations` (clientes de logística). Son registros separados.

### Acceso en el hub

[app/operaciones-limpieza/page.tsx](app/operaciones-limpieza/page.tsx): el array `MENU_ITEMS` incluye `{ label: 'Editor de Planillas', adminOnly: true, icon: Settings, href: '/operaciones-limpieza/planillas-config' }`. Filtrado por `currentUser.role === 'admin'` antes del render.

### Garantías

- **Cero cambios** en tablas históricas (`limpieza_asistencia`, `limpieza_planilla_imports`, `limpieza_registros`, `limpieza_tareas_asignadas`, `limpieza_usuarios`).
- **Renombrar** un cliente/sector en el editor NO actualiza strings ya guardados en informes viejos — esos se siguen leyendo con el nombre original.
- **Eliminar** un cliente/sector solo lo quita del dropdown de informes nuevos; históricos intactos.
- Migración en `lib/db.ts` usa exclusivamente `CREATE TABLE IF NOT EXISTS` + INSERT condicional. Cero `ALTER`/`DROP`/`UPDATE` sobre tablas preexistentes.
