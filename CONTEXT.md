---
name: GSS Management Hub — Contexto General del Proyecto
description: Descripción completa de la aplicación, módulos, tecnologías, servicios externos, base de datos y arquitectura
type: project
---

# GSS Management Hub

Plataforma interna de gestión para la empresa GSS (empresa de servicios: limpieza, seguridad física, seguridad electrónica). Centraliza tickets de soporte, logística, bitácoras operativas, liquidaciones y control de personal.

**Por qué existe:** antes cada área usaba herramientas separadas. Esta app unifica todo en un solo portal web accesible desde el navegador, desplegado en Railway (producción) y corriendo localmente con SQLite para desarrollo.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) |
| Lenguaje | TypeScript 5.9 |
| UI | React 19, Lucide React (iconos), CSS variables inline |
| Base de datos | PostgreSQL (producción via Railway) / SQLite better-sqlite3 (local) |
| Auth | JWT (jose) — cookie `session` + header `Authorization`, 8h de expiración |
| Archivos | Cloudinary (imágenes/documentos adjuntos) |
| Email | Nodemailer + SMTP configurable |
| Notificaciones push | Web Push API (VAPID) |
| Integración externa | Microsoft Power Automate (webhook para alertas Teams/email) |
| Validación email | Abstract API (emailreputation.abstractapi.com) |
| Export | ExcelJS (archivos .xlsx) |
| PDF | pdf-parse (parseo), window.print() con CSS @media print (generación) |
| Deploy | Railway (producción), `npm run dev --webpack` (local) |

---

## Base de datos (`lib/db.ts`)

**`DbWrapper`** — clase singleton que abstrae SQLite y PostgreSQL con la misma interfaz:
- `db.query(sql, params[])` → `Promise<any[]>`
- `db.get(sql, params[])` → `Promise<any>` (primera fila)
- `db.run(sql, params[])` → `Promise<{lastInsertRowid, changes}>`
- Placeholders: siempre `?` — el wrapper los convierte a `$1, $2...` para PG
- **IMPORTANTE:** nunca usar `db.prepare().all()` — es API directa de SQLite y rompe en PostgreSQL

**Variables de entorno requeridas:**
- `DATABASE_URL` o `POSTGRES_URL` → activa modo PostgreSQL; si no existe, usa SQLite local (`tickets.db`)
- `JWT_SECRET` → clave de firma JWT (mínimo 32 chars)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- `POWER_AUTOMATE_URL` (también configurable desde UI en `/admin/config`)
- `ABSTRACT_API_KEY` (opcional, para validación de emails)
- `NEXT_PUBLIC_BASE_URL`

**Migraciones:** el schema completo corre en `initialize()` al arrancar con `CREATE TABLE IF NOT EXISTS`. Las columnas nuevas se agregan mediante bloques `ALTER TABLE` dentro de ese mismo método, separados por `if (this.type === 'pg')` vs SQLite.

---

## Autenticación y roles

**Sesión:** JWT en cookie `session` (httpOnly) + soporte de header `Authorization: Bearer <token>` para compatibilidad con Railway proxy. El middleware solo verifica existencia del token; la validación real ocurre dentro de cada route handler con `getSession(request)`.

**Roles de usuario:**
| Rol | Acceso |
|---|---|
| `admin` | Todo |
| `supervisor` | Tickets + Dashboard + admin funcional |
| `jefe` | Similar a supervisor |
| `user` | Tickets propios |
| `funcionario` | Tickets propios (rubro operativo) |
| `tecnico` | Módulo Seguridad Electrónica |
| `logistica` | Módulo Logística |
| `contador` | Módulo Cotización |

**Módulos adicionales (`modules` column en users):** string separado por comas: `"logistica,cotizacion,limpieza"`. Función `hasModuleAccess(user, mod)` en `TicketContext.tsx`. Los módulos disponibles son: `logistica`, `tecnico`, `cotizacion`, `limpieza`.

---

## Módulos de la aplicación

### 1. Sistema de Tickets (`/tickets`, `/new-ticket`, `/administracion`)
Núcleo de la app. Gestión de tickets de soporte interno.
- **Mis Tickets** (`/tickets`): vista del usuario con sus tickets. Muestra 5 por defecto, botón "Ver todos".
- **Nuevo Ticket** (`/new-ticket`): formulario de creación con adjuntos (Cloudinary).
- **Dashboard** (`/administracion`): vista admin/supervisor. KPIs: resueltos hoy, tickets pendientes con breakdown Alta/Media/Baja, búsqueda por texto.
- **Detalle** (`/tickets/[id]`): actividades, colaboradores, tareas de equipo, cambio de estado, firma de "visto".
- **Carpetas** (`/tickets/folders`): organización de tickets en carpetas.
- Notificaciones: push (Web Push) + Power Automate webhook al crear/actualizar tickets.

### 2. Bitácora Operativa (`/logbook`)
Registro diario de presencia de personal en ubicaciones/clientes. Configurable: columnas dinámicas, lista de ubicaciones desde `/api/config/locations`, lista de funcionarios desde `funcionarios_list`. Filtros por fecha, ubicación, supervisor. Exportación Excel. Subida de imágenes (Cloudinary).

### 3. Logística (`/logistica`)
Tres sub-secciones:
- **Envíos** (`/logistica/envios`): seguimiento de envíos con tracking, comentarios, estados, imágenes.
- **Órdenes de Compra** (`/logistica/ordenes-compra`): OCR de PDF de órdenes (pdf-parse), gestión de ítems, exportación Excel.
- **Solicitud de Materiales** (`/logistica/solicitud-materiales`): calendario de solicitudes con adjuntos.

### 4. Seguridad Electrónica (`/seguridad-electronica`)
- **Monitoreo** (`/seguridad-electronica/monitoreo`): registros de eventos de seguridad.
- **Mantenimiento** (`/seguridad-electronica/mantenimiento`): agenda de mantenimientos.
- **Historial** (`/seguridad-electronica/historial`): historial de registros.

### 5. Cotización (`/cotizacion`)
Módulo de liquidación de horas para facturación.
- **Panel** (`/cotizacion/panel`): KPIs del período activo.
- **Liquidación** (`/cotizacion/liquidacion`): períodos de facturación, entradas de horas por funcionario.
- **Empleados y Tarifas** (`/cotizacion/empleados-tarifas`): categorías (`billing_categories`) y tarifas con vigencia (`billing_rates`).
- **Reportes** (`/cotizacion/reportes`): exportación Excel con resumen y detalle.
- Importación desde bitácora: toma entradas de `logbook` en un rango de fechas y las convierte en `billing_entries`.
- Tablas: `billing_categories`, `billing_rates`, `billing_periods`, `billing_entries`.

### 6. Operaciones Limpieza (`/operaciones-limpieza`) — branch: `operaciones-limpieza`
- **Registro público** (`/registro-limpieza`): sin login. Funcionario ingresa su email, el sistema auto-completa datos y muestra checkboxes de 5 tareas predefinidas.
- **Recuento de Tareas** (`/operaciones-limpieza/tareas`): historial de registros con filtros fecha/texto y exportación Excel.
- **Informes Operativos** (`/operaciones-limpieza/informes`): planilla de asistencia por turno (6-14, 14-22, Adicionales) con selectores de hora en intervalos de 15 min, firma digital (canvas), auto-guardado, exportación PDF con nombre dinámico `Reporte_Operacional_FECHA_CLIENTE.pdf`.
- **Historial de Informes** (`/operaciones-limpieza/historial`): vista por meses, colapsable, con buscador.
- **Personal** (`/operaciones-limpieza/personal`): CRUD de funcionarios de limpieza. Dropdowns de cliente/sector conectados a `/api/config/locations` (misma fuente que la bitácora).
- Tablas: `limpieza_usuarios`, `limpieza_registros`, `limpieza_asistencia`.

### 7. Administración (`/admin`)
- **Usuarios** (`/admin/users`): gestión de usuarios, aprobación, asignación de roles y módulos.
- **Configuración** (`/admin/config`): URL de Power Automate, ubicaciones/sectores para la bitácora.

---

## Configuración compartida (`/api/config/locations`)

Retorna: `[{ id, name, active, sectors: [{id, name, location_id}] }]`

Usada por: Bitácora, Personal de Limpieza, Informes Operativos. Es la fuente única de verdad para clientes/ubicaciones y sus sectores.

---

## Estructura de archivos clave

```
lib/
  db.ts          — DbWrapper (SQLite/PG), schema completo, migraciones
  auth-server.ts — createSession, getSession, encrypt/decrypt JWT
  auth-edge.ts   — signJWT/verifyJWT (Edge-compatible)
  mail.ts        — sendMail via Nodemailer
  cloudinary.ts  — upload helper

app/
  context/TicketContext.tsx — estado global, hasModuleAccess, tipos
  layout.tsx                — layout raíz, provider del contexto
  middleware.ts             — solo verifica existencia de token para pages
  globals.css               — variables CSS (--primary-color, --bg-color, etc.)
```

---

## Convenciones de código

- Todos los estilos son **inline** con `React.CSSProperties` o CSS variables globales. No hay CSS Modules ni Tailwind.
- `styled-jsx` (`<style jsx global>`) usado puntualmente para `@media print`.
- Los API routes usan siempre `db.query()`, `db.get()`, `db.run()` — nunca `db.prepare()`.
- Las rutas protegidas validan sesión dentro del handler con `getSession(request)`.
- Para PG, los INSERTs con retorno usan `RETURNING *` en la query y se hace con `db.query()` (que devuelve `rows`).
- El contexto expone `getAuthHeaders()` → `{ Authorization: 'Bearer <token>' }` para fetch desde el cliente.

---

## Deploy en Railway

- Variable `DATABASE_URL` o `POSTGRES_URL` activa PostgreSQL automáticamente.
- Las tablas se crean/migran al arrancar (no hay migraciones manuales).
- Archivos estáticos servidos desde `/public` (logo.png, etc.).
- No hay volumen persistente para SQLite en producción — Railway usa PostgreSQL obligatoriamente.

---

## Branches

- `main` — producción estable
- `operaciones-limpieza` — módulo de limpieza completo, pendiente de merge a main
