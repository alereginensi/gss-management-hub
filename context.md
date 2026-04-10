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

*Última actualización de este archivo: alineado con la base del código (logística, artículos, parse JSON Postgres, migraciones, UX móvil en modales y alineación de iconos en hubs móviles).*
