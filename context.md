# Contexto de la aplicación — GSS Management Hub

Documento orientado a desarrolladores y asistentes de IA: visión general del código, módulos y convenciones recientes. Complementa el [README](./README.md) y las guías `GUIA_*.md`.

---

## Mantenimiento de documentación

Después de cualquier **cambio meritorio** (módulo nuevo, cambio de arquitectura, convención nueva, variables de entorno nuevas, cambio en rutas/roles), actualizar **en el mismo commit**:

- `README.md` — visión usuario/stakeholder
- `context.md` — este archivo (contexto técnico para devs/IA)
- `docs/ESTRUCTURA.md` — árbol del repo con descripción por ruta
- `docs/guias/GUIA_*.md` — si el cambio afecta el flujo del módulo

**Qué cuenta como meritorio**: módulo/página/endpoint agregado o eliminado, cambio de arquitectura (storage, auth, middleware, DB schema), convención nueva, cambios en rutas públicas o roles, variables de entorno nuevas.

**Qué NO documentar**: bug fixes menores sin cambio de contrato, refactors internos sin efecto en API/UI, typos, estilo.
- **El repositorio es público.** Cada push a `main` en GSS-IT se mirror automáticamente a `alereginensi/gss-management-hub` vía GitHub Actions (`.github/workflows/mirror.yml`). Cualquier dato sensible commiteado queda expuesto de inmediato.
- **Antes de cada push a main, revisar siempre:**
  - No haya credenciales, hashes de contraseñas ni tokens hardcodeados en el código.
  - Los JWT secrets y contraseñas admin usen variables de entorno (`JWT_SECRET`, `ADMIN_PASS_HASH`, `ADMIN_EMAIL`).
  - No existan endpoints de debug o diagnóstico abiertos sin autenticación (todos los `/api/admin/debug*` deben retornar 404).
  - Los emails corporativos reales no estén hardcodeados — usar env vars o `example.com`.
  - Los `.env*` estén en `.gitignore` y nunca commiteados.
  - `app/config/clients.ts` está en `.gitignore` — se genera en build desde `CLIENTS_DATA` env var. No commitear datos reales de clientes.
  - Corridas con `npx tsc --noEmit` sin errores antes de pushear.

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
- **Middleware** (`middleware.ts`): **NO** usa `crypto.subtle.verify()` — solo decodifica el payload del JWT sin verificar firma (`decodeJwtPayloadUnsafe`). Motivo: el Edge runtime de Next.js sobre Railway rechaza todo tipo de `BufferSource` en `SubtleCrypto.verify()` con `ERR_INVALID_ARG_TYPE`. La firma real se verifica en cada route handler via `getSession() → decrypt() → verifyJWT()` en runtime Node. El middleware solo lee el payload para enforcement de `panel_access` (UX), no auth real.
- **Auto-logout por inactividad** (`app/components/InactivityGuard.tsx`): timers de 25 min (primer aviso amarillo "5 min"), 29 min (aviso final rojo "1 min"), 30 min (logout). El logout usa `router.push('/login')` + `window.location.href` como fallback para garantizar redirect aunque el router quede en estado raro (pestañas inactivas).

---

## Módulo de logística

Rutas de UI bajo `app/logistica/`:

- **`/`** — Hub de logística.
- **`/logistica/calendario`** — Calendario de eventos: **entrega**, **ingreso mercadería** (antes “despacho” en código: tipo `despacho`), **solicitud**. Modal “Nuevo evento”, export Excel, firma en entregas, etc.
  - **Editar entregas / ingresos** (tras creación): botón lápiz en la vista del día, en la tarjeta mobile y en la tabla desktop; reutiliza el modal de creación en modo edición (oculta tabs y canvas de firma). `PUT /api/logistica/calendario?id={id}` acepta body parcial con `titulo`, `descripcion`, `items`, `file_url`, `firma_url`, `firma_aclaracion`.
  - **Aclaración de firma** (`firma_aclaracion TEXT` en `logistica_calendario`, ALTER aditivo PG+SQLite): input dentro del modal de firma ("nombre y/o cédula del receptor") que se muestra debajo de la imagen en la vista del día. Se puede guardar con o sin cambiar la firma.
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

## Infraestructura y deploy

### Arquitectura en Railway

- **Servicio principal** (`gss-management-hub`): Next.js 16 standalone, Dockerfile multi-stage (`node:20-bookworm-slim`), puerto 3000. Health check en `/api/health` (verifica DB). Restart automático `ON_FAILURE` (max 5 reintentos) vía `railway.toml`.
- **Worker service** (`mitrabajo-worker`): proceso separado que corre `node scripts/cron-mitrabajo.cjs`. Aislado del servicio principal para evitar OOM cuando Playwright/Chromium consume ~500MB. Expone un mini HTTP server en `PORT` para satisfacer el health check de Railway.
- **Worker service** (`agenda-worker`): segundo proceso separado que corre `node scripts/cron-agenda.cjs` (start command `npm run agenda:cron`). Dos schedules tz `America/Montevideo`: `0 9 28 * *` (genera slots del mes siguiente, default martes/jueves) y `0 2 * * *` (sync de renovaciones — re-habilita empleados con artículos vencidos). Expone `/api/health` igual que mitrabajo-worker. Ver [docs/RAILWAY_WORKERS.md](docs/RAILWAY_WORKERS.md) para los pasos exactos de alta del servicio en el dashboard de Railway.
- **PostgreSQL**: Railway managed, single instance. Pool: `max: 10`, `idleTimeout: 30s`, `connectionTimeout: 5s`.
- **Archivos Mitrabajo**: guardados en tabla `mitrabajo_files` (BYTEA en PG), máx 5 más recientes. La descarga la hace `scripts/download-mitrabajo.cjs` (no `lib/mitrabajo-download.js`) — ambos archivos deben tener `saveToDb` sincronizados.
- **Cloudinary**: almacenamiento de firmas y remitos PDF. Si no está configurado en producción, `saveAgendaFile` lanza error (no cae al filesystem efímero).
- **Mirror GitHub Actions**: `.github/workflows/mirror.yml` — push a `main` → copia automática a `alereginensi/gss-management-hub` (público). Usa **HTTPS + PAT** (secret `MIRROR_PAT`). El checkout usa `persist-credentials: false` para que el `GITHUB_TOKEN` del bot no interfiera con el push al mirror. El PAT necesita scopes **Contents: write** y **Workflows: write** (para pushear cambios en `.github/workflows/`).

### Variables de entorno (referencia)

- **`DATABASE_URL`** / **`POSTGRES_URL`** / **`DATABASE_PUBLIC_URL`**: conexión PostgreSQL (según qué lea cada script).
- **`CLIENTS_DATA`**: JSON con `CLIENT_SECTOR_MAP` completo — se genera `app/config/clients.ts` en build. Sin esta var usa datos de ejemplo.
- **`ADMIN_EMAIL`** / **`ADMIN_PASS_HASH`**: credenciales del admin inicial (bcrypt hash). Sin `ADMIN_PASS_HASH` se genera una contraseña aleatoria logueada una sola vez.
- **`ALLOWED_EMAIL_DOMAINS`**: dominios permitidos sin validación externa (ej: `gss.com.uy,gssadmin.com`).
- Desarrollo local: **`env.local.example`** y `.env.local` (no commitear secretos).
- Otros: VAPID para push, Cloudinary, SMTP, Mitrabajo credentials, según despliegue.

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
| `lib/mitrabajo-mailer.cjs` | Envío del Excel como adjunto vía SMTP (nodemailer). Llamado desde ambos `saveToDb`; lee destinatarios de `mitrabajo_config`; falla silenciosamente si falla SMTP |
| `scripts/download-mitrabajo.cjs` | CLI wrapper — llama a `lib/mitrabajo-download.js`. Uso: `npm run mitrabajo:download` o con `--debug` para ver el browser |
| `scripts/cron-mitrabajo.cjs` | Proceso cron persistente con `node-cron`. En Railway corre como `node scripts/cron-mitrabajo.cjs & next start` |
| `app/mitrabajo/page.tsx` | UI: lista archivos descargados, descarga individual, elimina, trigger manual con fecha opcional, config de destinatarios del mail automático |
| `app/api/mitrabajo/files/` | Lista archivos `.xlsx` en `downloads/mitrabajo/` |
| `app/api/mitrabajo/download/` | Sirve un archivo con auth (sin URL pública directa) |
| `app/api/mitrabajo/delete/` | Elimina un archivo |
| `app/api/mitrabajo/trigger/` | Dispara descarga on-demand importando `lib/mitrabajo-download.js` |
| `app/api/mitrabajo/config/` | GET/PUT config de destinatarios y toggle `email_enabled` (tabla `mitrabajo_config`) |

### Envío automático por email

Tras cada `saveToDb` (cron diario o trigger manual), el helper `lib/mitrabajo-mailer.cjs` lee la tabla `mitrabajo_config` (singleton id=1 con `email_recipients TEXT`, `email_enabled INTEGER`) y si hay destinatarios y el toggle está activo envía el xlsx como adjunto usando las vars SMTP estándar. Es **fail-open**: si SMTP no está configurado, no hay recipients, o falla el envío, loguea y sigue (no rompe el cron). La tabla se crea/seedea en `lib/db.ts` y también defensivamente desde el mailer (`ensureTable`) para que el cron funcione aunque arranque antes que Next.

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

Para el envío automático por email usa las vars SMTP globales (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`). Los destinatarios no son env var — se configuran desde la UI en `/mitrabajo` y se guardan en `mitrabajo_config.email_recipients` (CSV).

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

## Bitácora — Estadísticas e integridad (`/api/logbook/debug`)

Endpoint `GET /api/logbook/debug` (solo admin): devuelve métricas de la tabla `logbook` y registra snapshots periódicos para auditar cambios en el volumen de datos.

- **Tabla `logbook_stats_snapshots`**: creada automáticamente por `lib/db.ts` (migraciones SQLite y PG) y también por el propio route como auto-healing (`CREATE TABLE IF NOT EXISTS` al inicio del handler).
- **Deduplicación**: solo registra snapshot si cambió `total`, `first_date` o `last_date`, **o** si pasaron ≥ 15 minutos desde el último snapshot (`SNAPSHOT_INTERVAL_MS = 15 * 60 * 1000`).
- **Quirks PG**: `COUNT(*)` devuelve string en PG → se envuelve en `Number()`. Columnas `TIMESTAMP` devuelven `Date` objects → `toISOSafe()` tiene guard `instanceof Date`.
- `toISOSafe(ts)` normaliza `string | Date | null` a ISO string o null, manejando los tres casos.

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
- [DEPLOYMENT_QUICKSTART](./docs/DEPLOYMENT_QUICKSTART.md) — Railway.
- [BACKUPS](./docs/BACKUPS.md) — procedimientos de backup de base de datos.

### Guías de usuario (GUIA_*.md)

Todas las guías están escritas para usuarios sin conocimientos técnicos.

| Archivo | Módulo |
|---------|--------|
| [GUIA_USUARIOS](./docs/guias/GUIA_USUARIOS.md) | Roles, registro, login |
| [GUIA_ADMINISTRADORES](./docs/guias/GUIA_ADMINISTRADORES.md) | Gestión global de usuarios y sistema |
| [GUIA_TICKETS](./docs/guias/GUIA_TICKETS.md) | Mesa de ayuda, estados, colaboradores |
| [GUIA_ASISTENCIA](./docs/guias/GUIA_ASISTENCIA.md) | Registro de tareas y asistencia automática |
| [GUIA_BITACORA](./docs/guias/GUIA_BITACORA.md) | Novedades, exportación, estadísticas |
| [GUIA_CONFIGURACION](./docs/guias/GUIA_CONFIGURACION.md) | Ajustes personales, tema, notificaciones push |
| [GUIA_ADMINISTRACION_DASHBOARD](./docs/guias/GUIA_ADMINISTRACION_DASHBOARD.md) | Panel de métricas y gestión de tickets |
| [GUIA_OPERACIONES_LIMPIEZA](./docs/guias/GUIA_OPERACIONES_LIMPIEZA.md) | Informes, tareas, personal, uniformes |
| [GUIA_LOGISTICA](./docs/guias/GUIA_LOGISTICA.md) | Agenda web, envíos, órdenes de compra, calendario |
| [GUIA_SEGURIDAD_ELECTRONICA](./docs/guias/GUIA_SEGURIDAD_ELECTRONICA.md) | Monitoreo y mantenimiento de equipos |
| [GUIA_COTIZACION](./docs/guias/GUIA_COTIZACION.md) | Tarifas, liquidación, reportes Excel |
| [GUIA_RRHH](./docs/guias/GUIA_RRHH.md) | Agenda web de uniformes desde RRHH |
| [GUIA_ADMIN_USUARIOS](./docs/guias/GUIA_ADMIN_USUARIOS.md) | Alta, edición, permisos, funcionarios |
| [GUIA_ADMIN_CONFIG](./docs/guias/GUIA_ADMIN_CONFIG.md) | Ubicaciones, sectores, herramientas de sistema |
| [GUIA_REGISTRO_LIMPIEZA](./docs/guias/GUIA_REGISTRO_LIMPIEZA.md) | Pantalla pública de registro por cédula |
| [GUIA_TURNO](./docs/guias/GUIA_TURNO.md) | Consulta pública de turno de uniformes |

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
- `egress-returns/` — devoluciones por egreso (empleado se va de la empresa y entrega uniformes sin recibir nuevos). GET lista + POST crear (JSON). `[id]/` detalle, `[id]/remito/` subir PDF con auto-parse, `[id]/remito-pdf/` proxy descarga, `[id]/sign/` reemplazar firmas. Al crear un egreso: desactiva el empleado (`enabled=0, estado='inactivo'`) y marca sus artículos activos como `current_status='devuelto'`.
- `remito/parse-pdf/` — parsea un PDF sin persistir (preview para autollenar formularios).

### Panel admin — páginas nuevas o rediseñadas (rama `agenda-web`)

**`admin/empleados/`** — lista paginada (50/página). Columna extra con toggle **Habilitado para cambio** (icono `PackagePlus`): activa `allow_reorder = 1` en el empleado vía PUT. Badge azul si habilitado, gris si no.

**`admin/entregas/`** — historial de entregas completadas. Filtros: búsqueda (nombre/CI), desde, hasta, empresa. Tabla con columnas: Fecha, Empleado, CI, Empresa, Ítems, Remito, Firma emp., Firma resp., Fecha entrega, Ver. Botón exportar Excel.

**`admin/citas/`** — rediseño con **layout de cards** (no más tabla desktop + mobile separadas). Cada card muestra: nombre, documento, empresa, fecha, hora, status badge. Acciones:
- **Finalizar entrega** → navega a `admin/citas/[id]` (flujo completo de finalización).
- **No asistió** → PUT status = `ausente`.
- **Cancelar** → PUT status = `cancelada`. Solo visible si `agenda_origin === 'rrhh'` o rol admin/rrhh/jefe.
- **Ver detalle** → expande card con lista de ítems, Remito/Firma/Editar/Imprimir si está completada.
- Filtros: fecha del turno, "Solo hoy" (default ON), "Solo confirmadas" (default ON), "Limpiar filtros", búsqueda, empresa, estado.

**`admin/citas/[id]`** — detail page. Tiene el bloque **"Vino fuera de su turno"** colapsable (banda amarilla) encima del estado. Permite:
- Picker de fecha → llama `GET /api/logistica/agenda/slots?from=X&to=X` y muestra los turnos activos en grid (3 cols mobile / 4 cols desktop, ver `.walkin-slot-grid` en `globals.css`).
- "Crear turno en esta fecha" → mini-form que `POST /api/logistica/agenda/slots` con capacidad 1.
- "Reasignar cita" → `POST /api/logistica/agenda/appointments/[id]/move` con `{ new_slot_id }`.

**`admin/historial/`** — **nuevo**: búsqueda por cédula. Fetch paralelo a employees, appointments, failed-attempts y egress-returns (con filtro exacto por documento). Muestra secciones:
- Datos del empleado (con badge habilitado/no habilitado).
- Intentos de registro no habilitados (traducidos a texto humano vía `MOTIVO_LABELS`).
- Citas a las que no asistió (`ausente`), canceladas, agendadas/en curso, completadas.
- **Devoluciones por egreso** — cards con items devueltos + nro remito + link al PDF.

**`admin/devoluciones-egreso/`** — listado de egresos (filtros: búsqueda por nombre/CI, desde, hasta). Cards rojas con estilo coherente al botón trigger.

**`admin/devoluciones-egreso/nueva`** — formulario para registrar un egreso nuevo. Flujo: buscador de empleado por cédula o nombre (debounced, usa `/api/logistica/agenda/employees/search`) → subir PDF que auto-parsea y autorrellena items → ajustar items manualmente → firma responsable (obligatoria) + funcionario (opcional) → click "Registrar egreso". Al confirmar dispara 2 llamadas: POST JSON a `/egress-returns` (crea + guarda firmas) y POST multipart a `/[id]/remito` (sube PDF si hay). Los endpoints usan `AGENDA_ADMIN_ROLES` (admin, logistica, jefe, rrhh).

Botón de acceso rápido en `admin/citas` (pill rojo "Devolución por egreso") y tarjeta "Egresos" en el dashboard admin.

**Filtro por origen**: si `sessionStorage.agenda_origin === 'logistica'`, el dashboard `admin/page.tsx` redirige automáticamente a `admin/citas` (no muestra el panel completo). Se setea en `app/logistica/page.tsx` al hacer click en "Agenda Web".

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
- `scripts/cron-agenda.cjs` — dos schedules:
  - **Slots**: auto-generación mensual el día 28 a las 09:00 Montevideo.
  - **Renovaciones**: diario a las 02:00 Montevideo — llama `syncEmployeeRenewalStatus()` para marcar `enabled=1, allow_reorder=1` en empleados con artículos vencidos.
- `npm run agenda:slots -- --manual 2025-08` — genera slots de un mes específico (también dispara sync de renovaciones).
- `node scripts/cron-agenda.cjs --sync-renewals` — corre solo el sync de renovaciones, útil para ejecución manual.
- `scripts/backfill-articulos-desde-entregas.cjs` — backfill de `agenda_articles` a partir de citas completadas (dedup por `(appointment_id, article_type, size)`). Soporta `--apply` (default: dry-run) y `--employee=<CI>`.

### Renovación automática y pedido restringido

Ciclo de vida del flag `enabled` del empleado:
- **Alta normal**: `enabled=1` (puede retirar uniformes).
- **Al completar una entrega** (`PUT /api/logistica/agenda/appointments/[id]/delivery` o `POST /api/logistica/agenda/ingresos`): `enabled=0, allow_reorder=0`. El empleado queda bloqueado para agendar hasta que sus artículos venzan.
- **Cuando algún artículo vence** (`expiration_date <= hoy`): `syncEmployeeRenewalStatus` re-habilita `enabled=1, allow_reorder=1`. Solo afecta empleados con `estado='activo'`.
- **Revertir entrega** (`POST /api/logistica/agenda/appointments/[id]/revert-delivery`): `enabled=1, allow_reorder=1`.
- **Egreso**: `enabled=0, estado='inactivo'`. El sync no toca empleados inactivos.

Feature A (auto-habilitar por vencimiento):
- `syncEmployeeRenewalStatus(employeeId?)` en [lib/agenda-helpers.ts](lib/agenda-helpers.ts): UPDATE que marca `enabled=1, allow_reorder=1` en empleados con artículos `expiration_date <= CURRENT_DATE`, `current_status='activo'`, `estado='activo'`.
- Se ejecuta en 3 lugares: (1) cron diario 02:00, (2) on-read en `/api/logistica/agenda/public/lookup` (solo el empleado que consulta, instantáneo), (3) manualmente via `--sync-renewals`.

Feature B (pedido restringido a vencidos):
- El endpoint `lookup` devuelve `renewable_articles[]` con los artículos vencidos del empleado.
- El front (`app/logistica/agenda/pedido/page.tsx`) filtra el catálogo para mostrar solo los artículos cuyo `article_type` coincide con alguno de los `renewable_articles`. Si el array está vacío (primera entrega o habilitado manualmente sin vencimientos), muestra el catálogo completo.
- Banner naranja encima de las cards: "Tenés que renovar N prendas vencidas: ...".

### DB — `agenda_appointments` (columnas nuevas aditivas)
ALTER TABLE aditivo (PG: `information_schema.columns`, SQLite: `PRAGMA table_info`):
- Devolución dentro de cita: `has_return INTEGER DEFAULT 0`, `returned_order_items TEXT`, `remito_return_number TEXT`, `remito_return_pdf_url TEXT`, `parsed_remito_return_text TEXT`, `parsed_remito_return_data TEXT`.
- Nombre original de archivo: `remito_filename TEXT`, `remito_return_filename TEXT`.
- **Bytes del PDF en DB** (evita restricción PDF de Cloudinary y filesystem efímero de Railway): `remito_pdf_data BYTEA/BLOB`, `remito_return_pdf_data BYTEA/BLOB`. URL se guarda con marker `db://<id>[-return]`. Límite: 8 MB por PDF.

### Storage de remitos — estrategia actual (BYTEA en DB)
Los PDFs de remito (entrega y devolución) se guardan como bytes directo en DB en `remito_pdf_data` / `remito_return_pdf_data`. El campo URL (`remito_pdf_url` / `remito_return_pdf_url`) usa el marker `db://<id>` para indicar que los bytes están en DB. El proxy `GET /api/logistica/agenda/appointments/[id]/remito-pdf` lee los bytes directo y los sirve con `Cache-Control: private, no-store`. Motivo: la restricción "Restricted media types: PDF" de la cuenta Cloudinary bloquea delivery de PDFs en `raw/upload` e `image/upload`, y el filesystem de Railway es efímero.

Links de "Ver remito" en UI incluyen `?t=${updated_at}` como cache-buster para que el browser no sirva una versión vieja después de resubir.

### DB (15 tablas en `lib/db.ts`)
`agenda_employees`, `agenda_time_slots`, `agenda_appointments`, `agenda_appointment_item_changes`, `agenda_config`, `agenda_failed_attempts`, `agenda_uniform_catalog`, `agenda_articles`, `agenda_requests`, `agenda_shipments`, `agenda_shipment_articles`, `agenda_change_events` (legacy — solo lectura, módulo removido), `agenda_import_jobs`, `agenda_audit_log`, `agenda_egress_returns` (devoluciones por egreso — tabla independiente, sin slot, BYTEA para PDF igual que appointments).

### Print CSS
`app/globals.css` — clases `.no-print`, `.print-only`, `.print-comprobante` para impresión de comprobantes de entrega, solicitudes emergentes, envíos y **constancias de cambio de prenda**.

### Rutas públicas en middleware
`/logistica/agenda`, `/logistica/agenda/pedido`, `/logistica/agenda/turno`, `/logistica/agenda/confirmacion` — sin auth requerida.

### Archivos subidos
Se guardan en `public/uploads/agenda/{firmas|remitos}/` por defecto. Si `CLOUDINARY_URL` → Cloudinary. Abstracción en `lib/agenda-storage.ts`.

---

## Acceso RRHH a Agenda Web + Solicitudes Emergentes multi-módulo

### Roles y acceso centralizado

- **`lib/agenda-roles.ts`**: constantes `AGENDA_ADMIN_ROLES` (admin, logistica, jefe, rrhh), `AGENDA_SUPERVISOR_ROLES` (+supervisor), `AGENDA_EMERGENCY_ROLES` (+limpieza, tecnico). Helper `sourceForRole()`.
- **`canAccessAgenda(user)`** en `TicketContext`: devuelve `true` si admin/logistica/jefe/rrhh (o modules logistica/rrhh). Usado en las 13 páginas admin de agenda.
- `'rrhh'` propagado a ~31 API routes. Dashboard back-link dinámico por `sessionStorage.agenda_origin` (rrhh → /rrhh, logistica → /logistica).
- Hub RRHH (`app/rrhh/page.tsx`): tarjeta "Agenda Web" → `/logistica/agenda/admin`.

### Solicitudes emergentes desde Limpieza y Seguridad Electrónica

- **DB**: `agenda_requests` + columnas `is_emergency INTEGER DEFAULT 0`, `source TEXT DEFAULT 'logistica'`, `receiver_signature_url TEXT` (ALTER TABLE aditivo PG+SQLite).
- **API POST** `/api/logistica/agenda/requests`: si caller ∈ {limpieza, tecnico}, fuerza `is_emergency=1` y `source` por rol. Acepta multi-item `body.items: [{article_type, size?}]` (y legacy single-item).
- **Endpoint búsqueda** `GET /api/logistica/agenda/employees/search?q=` (auth = AGENDA_EMERGENCY_ROLES, limit 20).
- **Componente** `app/components/agenda/SolicitudEmergenteForm.tsx`: buscador empleado + autocomplete desde catálogo + multi-item + motivo.
- **Páginas**: `/operaciones-limpieza/solicitudes-uniforme` y `/seguridad-electronica/solicitudes-uniforme` con listado filtrado por `source` + modal "Nueva solicitud".
- **API GET requests**: filtro `source` y `emergency` query params; supervisores limpieza/tecnico solo ven su propio source.

### Autorización con firma doble y descargo legal

- Modal "Autorizar" en admin/solicitudes: texto "Responsabilidad del supervisor" (`LEGAL_TEXT_V1`) sobre canvas firma supervisor (obligatorio) + texto "Declaración del funcionario" (`LEGAL_TEXT_EMERGENCY`) sobre canvas firma funcionario (opcional).
- **Endpoint** `POST /api/logistica/agenda/requests/[id]/sign`: acepta `approver_signature` y/o `receiver_signature` (File o dataUrl). Firmas van a Cloudinary via `saveAgendaFile`. Flexible: permite reemplazar una sola firma sin perder la otra.
- Detalle solicitud: muestra ambas firmas lado a lado con botón "Reemplazar firma" (`SignatureReplaceButton`).

### Dashboard admin — card "Solicitudes"

- Card "Alertas" → **"Solicitudes"**: value = emergentes pendientes (`is_emergency=1 AND status='pendiente'`). Clickeable → `/admin/solicitudes?emergency=1`.
- Banner amarillo: artículos vencidos + solicitudes emergentes separados.
- API stats: nueva query `solicitudes_emergentes`.

### Catálogo — columna "Categoría"

- Columna "Sector/Puesto" renombrada a **"Categoría"**: texto libre con `<datalist>` de sugerencias. Campo canónico: `workplace_category` en `agenda_uniform_catalog` y `agenda_employees`.
- **Filtro pedido público**: `getCatalogForEmployee()` filtra por `empresa` + `workplace_category` (si el empleado tiene categoría asignada; sino ve todo el catálogo de su empresa — compatibilidad gradual).
- **Parser import**: escribe a `workplace_category` (no `puesto`). Dedup por `(empresa, workplace_category, article_type)`. Import reemplaza empresas presentes en el Excel (`replaceEmpresas: true`).
- **Template descargable** actualizado con columna `categoria`.
- **Script** `scripts/migrate-catalog-puesto-to-category.cjs`: migró `puesto` → `workplace_category` en Railway.
- **Script** `scripts/reset-agenda-catalog.cjs`: reemplazo total del catálogo desde Excel.

### Entregas — vista grid + reversión + edición de firmas

- **Vista grid de cards** responsive (`repeat(auto-fill, minmax(320px, 1fr))`) reemplaza tabla desktop + vista mobile.
- **Botón "Entrega errónea"** con modal (motivo requerido). Endpoint `POST .../revert-delivery`: cancela cita, da de baja artículos (`current_status='devuelto'`), habilita empleado (`enabled=1, allow_reorder=1`).
- **Componente** `app/components/SignatureReplaceButton.tsx`: reutilizable en citas, solicitudes y envíos. Convierte dataURL → Blob, POST al endpoint correspondiente.
- **Endpoint DELETE remito** (`DELETE /api/.../remito?kind=delivery|return`): nulifica URL, número, texto y items parseados.
- **Proxy PDF** (`GET /api/.../remito-pdf?kind=delivery|return`): detecta URLs locales (410), Cloudinary raw (fetch directo), magic bytes (sirve Content-Type real).
- **Remitos migrados**: 20 PDFs extraídos de DB vieja (`delivery_note_data` bytea) → subidos a Cloudinary → URLs actualizadas. Script `scripts/migrate-old-remitos.cjs`.

### Storage Cloudinary

- `lib/agenda-storage.ts`: `isCloudinaryConfigured()` reconoce `CLOUDINARY_URL` O `CLOUDINARY_CLOUD_NAME`+`API_KEY`+`API_SECRET`.
- `lib/cloudinary.ts`: solo llama `cloudinary.config()` si las 3 vars separadas existen (no pisa autoconfig de `CLOUDINARY_URL` con undefined).
- En producción, si Cloudinary no está configurado, `saveAgendaFile` **lanza error** (no cae al filesystem efímero).

### panel_access

- `/api/auth/me` y `/api/admin/users`: SELECT incluye `panel_access`.
- Landing (`/`): si `panel_access=0` y no admin, muestra spinner "Redirigiendo…" y navega al módulo asignado. `encargado_limpieza` redirige a `/operaciones-limpieza/informes`.
- `/administracion`: misma guardia de `panel_access`.

### Seguridad Electrónica — sub-páginas

- `historial`, `monitoreo`, `mantenimiento`: usan `hasModuleAccess(currentUser, 'tecnico')` (respeta `user.modules`) + espera `authLoading === false` antes de chequear auth (fix redirect mobile por timing de restoreSession vs SW cache).

### Service Worker

- `public/sw.js` v8: NO intercepta requests cross-origin (Cloudinary CDN, etc.). Solo cachea same-origin.

### Detección de remito

- `lib/agenda-remito-pdf-parser.ts`: 3 patrones nuevos para número de remito (UY `0001-00000123`, `REMITO 3062`, fallback laxo).
- Endpoint upload remito devuelve `parsedText`; UI auto-llena "Notas de entrega" con primeras 3 líneas si está vacío.
- Validación magic bytes al subir: rechaza archivos no-PDF con extensión `.pdf`.

*Última actualización de este archivo: RRHH acceso, solicitudes emergentes, categorías, reversión de entrega, proxy PDF, edición de firmas, panel_access, fix mobile seguridad.*

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

---

## Módulo Jornales (RRHH) — `app/rrhh/jornales/`

Control de días trabajados ("jornales") del personal de RRHH. Lee archivos Excel de marcas de asistencia, deduplica por empleado+fecha+lugar y clasifica a cada funcionario según un umbral (default **100 jornales** → `Efectivo`).

### Estado y persistencia

Toda la información vive en **PostgreSQL** (SQLite en dev), no en client state. Sobrevive recargas y es compartida entre usuarios autorizados.

### Tablas (lib/db.ts — aditivas, prefijo `jornales_`)

- **`jornales_personal`** — funcionarios activos. `padron TEXT UNIQUE`, `nombre`, `doc`, `efectividad_autorizada INTEGER`, `created_at`.
- **`jornales_marcas`** — marcas diarias deduplicadas por `(padron, fecha, lugar)`. Columna `file_id` (FK blanda a `jornales_archivos`) permite eliminar marcas por archivo. Índices en `padron` y `fecha`.
- **`jornales_archivos`** — registro de cada Excel de marcas cargado. `file_key UNIQUE = name|size` (evita doble carga), `registros_totales`, `registros_nuevos`, `uploaded_by`.

### Endpoints (`/api/rrhh/jornales/`)

Todos protegidos con `getSession()` + `isJornalesRole()` (solo **`admin`** y **`rrhh`**; constante `JORNALES_ALLOWED_ROLES` en [lib/jornales-helpers.ts](lib/jornales-helpers.ts)).

- `personal/` — GET lista, POST agregar (array de altas, dedup por padrón).
- `personal/[padron]/` — DELETE baja, PATCH toggle `efectividad_autorizada` (no borra marcas; solo cambia el flag — las marcas ya acumuladas siguen contando para el display, pero nuevos uploads ignoran a los padrones con flag=1).
- `personal/import/` — POST multipart: reemplaza todo el personal con un Excel (columnas `Padron`, `Nombre`, opcional `Apellido`/`Cedula`).
- `marcas/` — POST multipart: parsea Excel, ignora padrones con efectividad autorizada, dedup por `(padron, fecha, lugar)`. DELETE limpia todas las marcas + archivos.
- `marcas/archivos/` — GET lista de archivos cargados.
- `marcas/archivos/[id]/` — DELETE borra marcas con ese `file_id` y la fila de `jornales_archivos`.
- `resultados/` — GET: JOIN `jornales_personal` + `jornales_marcas`, `COUNT(DISTINCT fecha)` por padrón, último servicio por fecha desc. Calcula estado (`efectivo_autorizado` / `efectivo` / `curso` / `sinmarcas`) via [lib/jornales-helpers.ts](lib/jornales-helpers.ts).

### UI (`app/rrhh/jornales/`)

- **`page.tsx`** — Client page con guard `hasModuleAccess(currentUser, 'rrhh')`. Importa `./jornales.css` (estilos scoped bajo `.jornales-module` para no colisionar con `.card`/`.badge`/`.btn-*`/`.stat-card` de `globals.css`).
- **`JornalesModule.tsx`** — Root con tabs: `Resultados`, `Personal`, `Agregar marcas`, `Altas`, `Bajas`.
- **`hooks/useJornalesApi.ts`** — Hidrata desde 3 endpoints en paralelo y re-fetcha tras cada mutación. Expone `cargarPersonalDesdeExcel`, `agregarPersonas`, `darDeBaja`, `autorizarEfectividad`, `cargarArchivoMarcas`, `limpiarMarcas`, `quitarArchivoMarcas`, `refetchAll`.
- **`utils/parsearExcel.ts`** — `leerExcel`, `findCol`, `parsearPersonal` usados del lado cliente para preview antes de persistir (tabs Altas/Bajas).
- **`utils/exportarExcel.ts`** — Export Excel con SheetJS (`xlsx`).
- **`components/Tab*.tsx`** — 5 componentes de tabs con lógica idéntica al módulo original `modulo-jornales` pero consumiendo los callbacks async del hook.

### Reglas de negocio

- **1 jornal = 1 día trabajado**, sin importar cuántas marcas/servicios tenga ese día.
- Duplicados (mismo padrón, misma fecha, mismo lugar) se ignoran al cargar.
- **Estados**: Sin marcas (0 j) → En curso (1..99 j) → Efectivo (≥100 j).
- **Efectividad autorizada**: flag manual por persona. Los Excels nuevos no suman marcas a padrones con flag=1, pero las marcas ya acumuladas se preservan (la columna "Jornales" sigue mostrando el total histórico).
- **Umbral**: hardcoded a 100 en `JornalesModule` (prop). Editar requiere cambio de código.

### Acceso y roles

- Solo `admin` o `rrhh`.
- Entrada: tarjeta "Jornales" en el hub `/rrhh` (`app/rrhh/page.tsx`).
- Ruta `/rrhh/jornales` — no está en `PANEL_GENERAL_PREFIXES` del middleware; la protección es client-side via `hasModuleAccess(currentUser, 'rrhh')`.

### Seed histórico inicial

[scripts/seed-jornales-historico.cjs](scripts/seed-jornales-historico.cjs) (`npm run seed:jornales-historico`) carga una lista fija de personas + marcas sintéticas para reproducir el estado previo al módulo. Los datos (nombres, padrones, lugares) viven en `scripts/seed-jornales-data.local.json` — gitignored porque contiene información personal; ver `scripts/seed-jornales-data.example.json` para el formato. Idempotente via sentinela `file_key='__seed_historico_v1__'` en `jornales_archivos`: re-ejecutar borra todas las marcas de ese archivo y re-inserta. No toca marcas provenientes de uploads reales (distinto `file_id`). Fechas sintéticas empiezan en 2020-01-01 para no colisionar con marcas reales futuras. `DRY_RUN=1` para simular sin escribir.

---

## Módulo Citaciones Laborales (RRHH) — `app/rrhh/citaciones/`

Expediente digital de audiencias laborales ante el **MTSS** y el **Juzgado**. Registra la citación, el acuerdo transaccional si lo hubo, las facturas del abogado asociadas y permite exportar todo a Excel. Reemplaza el tracking manual en planillas sueltas.

### Origen del código

El UI y la lógica viven en un paquete auto-contenido en la raíz del repo: **[`modulo-citaciones-laborales/`](modulo-citaciones-laborales/)** (React 18+/TypeScript). Entregado como bundle externo, integrado tal cual: `CitacionesModule` es el componente raíz (`modulo-citaciones-laborales/index.ts`). Los imports internos son relativos, por eso no se descompone dentro de `app/`.

Estructura interna:
- `components/CitacionesModule.tsx` — raíz. Importa `./citaciones.css` directamente.
- `components/{PlanillaView,DrawerEditar,StatsGrid,FacturasEditor}.tsx` — UI.
- `hooks/useCitaciones.ts` — todo el estado (filtros, tabs, drawer, CRUD).
- `api/citaciones.api.ts` — re-exporta desde `utils/storage.ts`.
- `utils/storage.ts` — **adaptado a REST** contra `/api/rrhh/citaciones` (el bundle original usaba `localStorage`).
- `utils/{format,export}.ts` — helpers de fecha/monto y export Excel con `xlsx` (dep ya existente, `package.json:40`).
- `types/citacion.ts` — interfaces `Citacion`, `Factura`, `CitacionFormData`, `CitacionesStats`, `EstadoCitacion` (`'pendiente'|'en curso'|'cerrado'`), `Organismo` (`'MTSS'|'Juzgado'`), `TipoFactura`.

### Ruta y acceso

- **`/rrhh/citaciones`** — page cliente en [app/rrhh/citaciones/page.tsx](app/rrhh/citaciones/page.tsx). Guard `hasModuleAccess(currentUser, 'rrhh')` (redirige a `/` si no). Header GSS estándar con breadcrumb "← RRHH".
- Tarjeta de entrada en el hub `/rrhh` ([app/rrhh/page.tsx](app/rrhh/page.tsx)) con icono `Scale` de `lucide-react`.
- No requiere entrada en `PANEL_GENERAL_PREFIXES` del middleware — protección solo client-side + chequeo de rol en cada endpoint.

### APIs (`/api/rrhh/citaciones/`)

- **`route.ts`** — GET (listar, ordenadas por `created_at DESC`) y POST (crear). El POST genera `id = crypto.randomUUID()` y `now = new Date().toISOString()`, valida `empresa` y devuelve el row hidratado.
- **`[id]/route.ts`** — PUT (update parcial con SET dinámico por campos presentes en el body; retorna 404 si el id no existe) y DELETE.
- Todos protegidos con `getSession()` + `isCitacionesRole()` (constante `CITACIONES_ALLOWED_ROLES = ['admin','rrhh']` en [lib/citaciones-helpers.ts](lib/citaciones-helpers.ts)).
- Paso PG vs SQLite: ambos endpoints usan `db.query(..., [params])` y `db.run(..., [params])` con placeholders `?` — el wrapper ([lib/db.ts:98-115](lib/db.ts)) convierte a `$1,$2,...` para PG automáticamente.

### Tabla `rrhh_citaciones` ([lib/db.ts](lib/db.ts) L860-885)

| Columna | Tipo | Nota |
|---------|------|------|
| `id` | TEXT PRIMARY KEY | UUID generado por el backend |
| `empresa`, `org`, `fecha`, `hora`, `sede`, `trabajador`, `abogado`, `rubros`, `estado`, `motivo`, `acuerdo`, `obs` | TEXT | `org` default `MTSS`, `estado` default `pendiente` |
| `total`, `macuerdo` | NUMERIC | Montos en UYU; PG devuelve string, handler envuelve en `Number()` |
| `facturas` | TEXT | JSON serializado del array `Factura[]`; parseado en read |
| `created_at`, `updated_at` | TIMESTAMP | ISO string |
| Índices | | `(estado)`, `(fecha)` |

### Adaptación de `utils/storage.ts`

Reemplaza las 4 funciones del bundle original:
- `getAll()` → `GET /api/rrhh/citaciones` (devuelve `{ citaciones: Citacion[] }`).
- `create(data)` → `POST` con el payload sin `id`/`createdAt`/`updatedAt`.
- `update(id, data)` → `PUT /api/rrhh/citaciones/:id` con body parcial.
- `remove(id)` → `DELETE /api/rrhh/citaciones/:id`.

Todas con `credentials: 'include'` para la cookie httpOnly `session`. El hook `useCitaciones` solo conoce estas funciones — no hay que tocar otros archivos del módulo.

### Estilos

El módulo usa prefijo `--cit-*` y clases `.cit-*`, sin colisión con `.card`/`.badge`/`.btn-*` de `globals.css`. Para alinear al design system GSS se sobrescriben, dentro de `.cit-module`, las variables `--cit-mtss` (→ `#29416b`), `--cit-juz`, `--cit-danger` (→ `#e04951`) y `--cit-radius(-lg)` (→ `0px` — estilo cuadrado del resto de la app). Ver bloque al final de [app/globals.css](app/globals.css).

### Adjunto PDF con autofill

Columnas adicionales en `rrhh_citaciones` (aditivas, migración PG + SQLite):
`pdf_url TEXT` (marker `db://<id>`), `pdf_data BYTEA/BLOB` (bytes del PDF, máx 10 MB), `pdf_filename TEXT`, `parsed_pdf_text TEXT`.

Mismo patrón que agenda remitos (BYTEA en DB por restricción PDF de Cloudinary y filesystem efímero Railway). Sin Cloudinary para PDFs.

**Endpoints:**
- `POST /api/rrhh/citaciones/parse-pdf` — recibe `FormData{ file }`, extrae texto con `pdf-parse` (dynamic import `pdf-parse/lib/pdf-parse.js`), aplica heurística regex con [lib/citaciones-pdf-parser.ts](lib/citaciones-pdf-parser.ts) y devuelve `{ parsed: Partial<CitacionFormData>, rawText, filename, size }`. No persiste nada — es preview para autofill antes de crear la cita.
- `POST /api/rrhh/citaciones/[id]/pdf` — adjunta PDF a una citación existente (UPDATE `pdf_data`, `pdf_filename`, `pdf_url=db://<id>`, `parsed_pdf_text`). Valida magic bytes `%PDF`, máx 10 MB. Responde `{ pdfUrl, pdfFilename }`.
- `GET /api/rrhh/citaciones/[id]/pdf` — proxy descarga: sirve los bytes con `Content-Type: application/pdf`, `Content-Disposition: inline`, `Cache-Control: private, no-store`.
- `DELETE /api/rrhh/citaciones/[id]/pdf` — nulifica `pdf_data`, `pdf_filename`, `pdf_url`, `parsed_pdf_text`.

**Heurística ([lib/citaciones-pdf-parser.ts](lib/citaciones-pdf-parser.ts)):** `extractCitacionFromPdfText(text)` busca con regex las labels frecuentes en formularios MTSS/Juzgado UY. Patrones MTSS específicos (probados contra PDFs reales): "Señor/a: RAZON SOCIAL" (tolerante a "Seftor/a" cuando pdf-parse decodifica mal la ñ), "Para atender reclamo de [TRABAJADOR]", "asistido por: [ABOGADO]", "sita en [SEDE]", "El día DD/MM/YYYY", "A la hora HH:MM". Patrones genéricos fallback: "Empresa:", "Trabajador:", "Letrado patrocinante:", "Sede/Dirección:", "Fecha de audiencia:" (acepta DD/MM/YYYY y "22 de mayo de 2026"), "Total reclamado / Se reclama la suma de" (parsea formato UY `1.234.567,89`), "RUBROS RECLAMADOS" y "RELACION DE HECHOS QUE MOTIVAN EL RECLAMO" (case-sensitive para evitar falsos positivos contra referencias en minúsculas del cuerpo). Detecta organismo por keywords (`MINISTERIO DE TRABAJO|MTSS|DINATRA|AUDIENCIA DE CONCILIACION` → MTSS, `JUZGADO LETRADO|PODER JUDICIAL|CEDULÓN JUDICIAL` → Juzgado).

**Dos helpers correctivos para PDFs con fuente custom mal decodificada:**
- `restoreCommonAccents(text)` — repone tildes perdidas con reglas morfológicas seguras: `[vocal]cin` → `[vocal]ción` ("aclaracin" → "aclaración"), `[consonante]sion` → `[consonante]sión` ("admision" → "admisión").
- `isLikelyCorrupt(text)` — detecta bloques severamente corrompidos (palabras ≥3 letras sin vocales tipo "trnbnjnr"/"pnrn"/"cltndn" o runs de palabras de 1-2 letras no-stopword tipo "I O 12"). Si el bloque de `rubros` o `motivo` supera el umbral, se **omite el autofill** en lugar de llenar con basura — el usuario lo completa a mano mirando el PDF. Stopwords ("de", "la", "el", "en", "se", "es", "sra", etc.) excluidas para evitar falsos positivos en texto español normal.

**Detección de PDFs escaneados:** `looksScanned(rawText)` → si hay menos de 80 caracteres útiles el endpoint `parse-pdf` responde `scanned: true` y la UI muestra "El PDF parece escaneado (imagen) — completá los campos a mano. El archivo igual queda adjunto al guardar". Caso típico: cedulones del Juzgado subidos como fotocopia escaneada.

**Flujo UI (DrawerEditar):** al elegir archivo → `parsePdf(file)` → el hook hace `setFormData` solo sobre campos actualmente vacíos (no pisa ediciones manuales) y muestra una lista de "Campos autocompletados". El `File` queda en estado local; al apretar "Guardar", primero se crea/actualiza la citación, y tras recibir el `id`, se hace `attachPdf(id, file)`. Si el attach falla, la citación queda guardada y se muestra aviso al usuario. En modo edición con un PDF ya adjunto se ofrece ver/reemplazar/quitar.

### Roles

- Solo `admin` o `rrhh` (mismo criterio que Jornales, vía `isCitacionesRole`).
