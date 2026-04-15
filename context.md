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

**`admin/cambios/`** — rediseño completo:
- Toolbar con contador y botón "Nuevo cambio".
- Filtros: buscar, desde, hasta, empresa, estado.
- Tabla historial: Fecha | Empleado | CI | Empresa | Prenda devuelta | Prenda entregada | Estado (badge) | Acciones.
- Badge de estado: `pendiente`=amarillo, `completado`=verde, `cancelado`=rojo.
- Modal "Nuevo cambio": busca empleado con badge de elegibilidad (`allow_reorder=1` → "Habilitado" azul; `renewal_enabled_at <= hoy` → "Renovación disponible" verde; sin ninguno → aviso naranja). Dropdown artículo a devolver (artículos activos del empleado). Dropdown artículo a entregar (del catálogo). Al crear → POST → redirige a `/cambios/[id]`.

**`admin/cambios/[id]/`** — vista de completar cambio (equivalente a `citas/[id]/` pero con devolución):
- Info del cambio: empleado, artículo devuelto, artículo a entregar, badge de estado.
- **Remito ENTREGA** (borde verde): number input, textarea raw, botón "Analizar remito" (llama `parseRemitoText` client-side), file upload, lista editable de ítems.
- **Remito DEVOLUCIÓN** (borde rojo): misma estructura; pre-rellena con el artículo devuelto del cambio.
- **Descargo legal + firmas**: texto legal, checkbox "Acepto…", dos `AgendaSignatureCanvas` (empleado + responsable).
- **Botón "Completar cambio"**: requiere disclaimer ✓ + ambas firmas ✓ + al menos un ítem entregado. Flujo: `POST sign (employee)` → `POST sign (responsible)` → `PUT [id]` (ítems/remitos) → `PUT [id]/complete`.
- **Sección de impresión** (`@media print`): encabezado con datos del empleado, tabla de ítems entregados (verde), tabla de ítems devueltos (rojo), números de remito, texto legal, espacios de firma.
- Botón "Imprimir constancia" → `window.print()`.

### Libs de soporte
- `lib/agenda-types.ts` — interfaces TypeScript completas; incluye `ChangeEventStatus = 'pendiente' | 'completado' | 'cancelado'`; `AgendaChangeEvent` actualizado con `status`, `employee_signature_url`, `responsible_signature_url`, `disclaimer_accepted`, `delivered_items`, `returned_items`, `remito_delivery_number`, `remito_return_number`, `completed_at`, `completed_by`, `delivery_notes`; `AgendaUniformCatalogItem` acepta `null` en campos opcionales.
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

### DB — `agenda_change_events` (columnas agregadas vía ALTER TABLE)
Columnas nuevas añadidas con migración aditiva (PostgreSQL: `information_schema.columns`; SQLite: `PRAGMA table_info`) para no romper producción existente:
`status TEXT DEFAULT 'pendiente'`, `employee_signature_url TEXT`, `responsible_signature_url TEXT`, `disclaimer_accepted INTEGER DEFAULT 0`, `delivery_notes TEXT`, `delivered_items TEXT`, `returned_items TEXT`, `remito_delivery_number TEXT`, `remito_return_number TEXT`, `completed_at TIMESTAMP`, `completed_by INTEGER`.

### DB (14 tablas en `lib/db.ts`)
`agenda_employees`, `agenda_time_slots`, `agenda_appointments`, `agenda_appointment_item_changes`, `agenda_config`, `agenda_failed_attempts`, `agenda_uniform_catalog`, `agenda_articles`, `agenda_requests`, `agenda_shipments`, `agenda_shipment_articles`, `agenda_change_events`, `agenda_import_jobs`, `agenda_audit_log`.

### Print CSS
`app/globals.css` — clases `.no-print`, `.print-only`, `.print-comprobante` para impresión de comprobantes de entrega, solicitudes emergentes, envíos y **constancias de cambio de prenda**.

### Rutas públicas en middleware
`/logistica/agenda`, `/logistica/agenda/pedido`, `/logistica/agenda/turno`, `/logistica/agenda/confirmacion` — sin auth requerida.

### Archivos subidos
Se guardan en `public/uploads/agenda/{firmas|remitos}/` por defecto. Si `CLOUDINARY_URL` → Cloudinary. Abstracción en `lib/agenda-storage.ts`.

---

*Última actualización de este archivo: rama `agenda-web` — cambios de prenda con devolución, historial entregas, toggle allow\_reorder, vista logística en citas, AgendaSignatureCanvas.*
