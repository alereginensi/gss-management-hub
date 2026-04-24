# Distribución de Código — GSS Centro de Gestión

Guía de referencia rápida para entender qué hace cada archivo y carpeta del proyecto.

---

## Convenciones de Next.js App Router

| Archivo | Rol |
|---------|-----|
| `page.tsx` | Página UI de una ruta. Se muestra en el navegador. |
| `route.ts` | Endpoint de API (GET, POST, PUT, DELETE). No tiene UI. |
| `layout.tsx` | Envuelve todas las páginas dentro de su carpeta. Se mantiene entre navegaciones. |
| `loading.tsx` | Skeleton / spinner que se muestra mientras carga la página. |
| `error.tsx` | Pantalla de error para una sección específica. |
| `not-found.tsx` | Página 404 personalizada. |
| [`middleware.ts`](../middleware.ts) | Intercepta todas las requests antes de llegar a la página o API (auth, redirects). |

---

## Estructura raíz del proyecto

```
gss-management-hub/
├── app/ # Todo el código Next.js (páginas + APIs)
├── lib/ # Lógica compartida (no es Next.js, es TypeScript puro)
├── modulo-citaciones-laborales/ # Paquete externo integrado en RRHH (React + TypeScript)
├── scripts/ # Utilidades de mantenimiento, migraciones, crons
├── docs/ # Documentación
├── public/ # Archivos estáticos (imágenes, SW, manifest)
├── middleware.ts # Auth guard global (verifica JWT en cada request)
├── next.config.ts # Configuración de Next.js
├── railway.toml # Configuración de deploy en Railway
├── nixpacks.toml # Configuración de build en Railway (nixpacks)
├── docker-compose.yml # Compose para producción con Docker
├── docker-compose.dev.yml # Compose para desarrollo local
├── Dockerfile # Imagen Docker del servidor
├── startup.sh # Script de arranque del contenedor (migraciones, servidor)
├── package.json # Dependencias y scripts npm
├── tsconfig.json # Configuración de TypeScript
└── eslint.config.mjs # Reglas de linting
```

---

## `/app` — Módulos del sistema

Cada subcarpeta de `app/` corresponde a una sección del sistema.

### Páginas principales

| Carpeta | URL | Qué es |
|---------|-----|--------|
| [`app/`](../app/) (raíz) | `/` | Login / página de inicio |
| [`app/dashboard/`](../app/dashboard/) | `/dashboard` | Panel principal con métricas |
| [`app/tickets/`](../app/tickets/) | `/tickets` | Mesa de ayuda — listado y detalle de tickets |
| [`app/bitacora/`](../app/bitacora/) | `/bitacora` | Bitácora de novedades operativas |
| [`app/asistencia/`](../app/asistencia/) | `/asistencia` | Registro de tareas y asistencia del día |
| [`app/operaciones/`](../app/operaciones/) | `/operaciones` | Operaciones limpieza: informes, personal, tareas |
| [`app/logistica/`](../app/logistica/) | `/logistica` | Logística de uniformes: agenda, envíos, órdenes |
| [`app/logistica/agenda/admin/citas/`](../app/logistica/agenda/admin/citas/) | `/logistica/agenda/admin/citas` | Lista de citas con acciones Finalizar/No asistió/Cancelar |
| [`app/logistica/agenda/admin/citas/[id]/`](../app/logistica/agenda/admin/citas/[id]/) | `/logistica/agenda/admin/citas/:id` | Detalle de cita: remito, firmas, walk-in, devolución |
| [`app/logistica/agenda/admin/historial/`](../app/logistica/agenda/admin/historial/) | `/logistica/agenda/admin/historial` | Búsqueda por cédula: citas, ausencias, intentos fallidos, entregas |
| [`app/logistica/agenda/admin/entregas/`](../app/logistica/agenda/admin/entregas/) | `/logistica/agenda/admin/entregas` | Solo entregas completadas (exportable a Excel) |
| [`app/logistica/agenda/admin/devoluciones-egreso/`](../app/logistica/agenda/admin/devoluciones-egreso/) | `/logistica/agenda/admin/devoluciones-egreso` | Devoluciones al finalizar relación laboral (listado + alta de nuevo egreso) |
| [`app/seguridad-electronica/`](../app/seguridad-electronica/) | `/seguridad-electronica` | Monitoreo y mantenimientos técnicos |
| [`app/cotizacion/`](../app/cotizacion/) | `/cotizacion` | Cotización comercial y liquidación de horas |
| [`app/rrhh/`](../app/rrhh/) | `/rrhh` | RRHH — hub con Agenda web, Jornales y Citaciones Laborales |
| [`app/rrhh/jornales/`](../app/rrhh/jornales/) | `/rrhh/jornales` | Control de días trabajados (personal, marcas, altas/bajas, resultados) |
| [`app/rrhh/citaciones/`](../app/rrhh/citaciones/) | `/rrhh/citaciones` | Gestión de audiencias MTSS y Juzgado, acuerdos, facturas del abogado |
| [`app/limpieza/`](../app/limpieza/) | `/limpieza` | Pantalla pública de registro de limpieza (sin login) |
| [`app/turno/`](../app/turno/) | `/turno` | Pantalla pública de consulta de turnos de uniforme |
| [`app/mitrabajo/`](../app/mitrabajo/) | `/mitrabajo` | Descarga de reportes desde mitrabajo.uy |
| [`app/admin/`](../app/admin/) | `/admin` | Administración de usuarios, configuración del sistema |
| [`app/configuracion/`](../app/configuracion/) | `/configuracion` | Configuración personal (tema, notificaciones) |
| [`app/register/`](../app/register/) | `/register` | Registro de nuevos usuarios |
| [`app/actividad/`](../app/actividad/) | `/actividad` | Log de actividad reciente del sistema |

### APIs (`/api/...`)

Dentro de cada módulo hay una carpeta `api/` con los endpoints:

| Carpeta | Qué expone |
|---------|-----------|
| [`app/api/auth/`](../app/api/auth/) | Login, logout, registro, verificación de sesión |
| [`app/api/tickets/`](../app/api/tickets/) | CRUD tickets, comentarios, archivos adjuntos, colaboradores |
| [`app/api/bitacora/`](../app/api/bitacora/) | CRUD entradas de bitácora, exportación Excel |
| [`app/api/asistencia/`](../app/api/asistencia/) | Registro de tareas, cálculo de asistencia |
| [`app/api/operaciones/`](../app/api/operaciones/) | Informes de presencia, personal limpieza, tareas, uniformes |
| [`app/api/logistica/`](../app/api/logistica/) | Agenda web, envíos, órdenes de compra, catálogo |
| [`app/api/seguridad-electronica/`](../app/api/seguridad-electronica/) | Eventos, mantenimientos preventivos y correctivos |
| [`app/api/cotizacion/`](../app/api/cotizacion/) | Categorías, tarifas, períodos, reportes |
| [`app/api/rrhh/`](../app/api/rrhh/) | Entregas de uniformes desde RRHH |
| [`app/api/rrhh/jornales/`](../app/api/rrhh/jornales/) | Personal, marcas, archivos y resultados del módulo de Jornales |
| [`app/api/rrhh/citaciones/`](../app/api/rrhh/citaciones/) | CRUD de citaciones laborales (GET/POST, [id]/PUT/DELETE, parse-pdf para autofill, [id]/pdf para adjuntar/ver/quitar PDF) |
| [`scripts/seed-jornales-historico.cjs`](../scripts/seed-jornales-historico.cjs) | Seed idempotente de personal + marcas sintéticas iniciales del módulo Jornales |
| [`app/api/limpieza/`](../app/api/limpieza/) | Confirmación de tareas (pantalla pública) |
| [`app/api/turno/`](../app/api/turno/) | Consulta de turno por cédula |
| [`app/api/mitrabajo/`](../app/api/mitrabajo/) | Trigger de descarga, listado de archivos |
| [`app/api/admin/`](../app/api/admin/) | Gestión de usuarios, roles, funcionarios, configuración |
| [`app/api/notifications/`](../app/api/notifications/) | Web Push: suscripciones, envío de notificaciones |
| [`app/api/health/`](../app/api/health/) | Health check para Railway (responde 200/503) |

### Componentes globales (`app/components/`)

| Archivo | Qué hace |
|---------|---------|
| [`Header.tsx`](../app/components/Header.tsx) | Barra superior: logo, usuario, botón de logout |
| [`Sidebar.tsx`](../app/components/Sidebar.tsx) | Menú lateral con navegación entre módulos |
| [`ThemeWrapper.tsx`](../app/components/ThemeWrapper.tsx) | Aplica el tema claro/oscuro desde localStorage |
| [`InactivityGuard.tsx`](../app/components/InactivityGuard.tsx) | Auto-logout tras 30 min de inactividad. Avisos a los 25 min (amarillo, "5 min") y 29 min (rojo, "1 min"). Redirect robusto con `router.push + window.location.href`. |
| [`PushManager.tsx`](../app/components/PushManager.tsx) | Solicita permiso y registra suscripción Web Push |
| [`SWRegistration.tsx`](../app/components/SWRegistration.tsx) | Registra el Service Worker |
| [`SignaturePad.tsx`](../app/components/SignaturePad.tsx) | Lienzo para capturar firma digital |
| [`AgendaSignatureCanvas.tsx`](../app/components/AgendaSignatureCanvas.tsx) | Variante de firma para el módulo de agenda |
| [`SignatureReplaceButton.tsx`](../app/components/SignatureReplaceButton.tsx) | Botón para reemplazar una firma existente |
| [`LogoutExpandButton.tsx`](../app/components/LogoutExpandButton.tsx) | Botón expandible de logout en la barra |
| [`agenda/SolicitudEmergenteForm.tsx`](../app/components/agenda/SolicitudEmergenteForm.tsx) | Formulario emergente para solicitudes en agenda |
| [`limpieza/FuncionarioSearchSelect.tsx`](../app/components/limpieza/FuncionarioSearchSelect.tsx) | Selector con búsqueda de funcionarios en limpieza |
| [`logistica/ArticuloSearchAdd.tsx`](../app/components/logistica/ArticuloSearchAdd.tsx) | Buscador + alta de artículos en logística |

### Configuración del sistema (`app/config/`)

| Archivo | Qué contiene |
|---------|-------------|
| [`clients.ts`](../app/config/clients.ts) | Mapa de clientes → sectores (generado en build time desde env var `CLIENTS_DATA`) |
| [`clients.example.ts`](../app/config/clients.example.ts) | Versión de ejemplo con datos ficticios (para el repo público) |
| [`lugares.ts`](../app/config/lugares.ts) | Lista de ubicaciones/clientes para selects en formularios |
| [`rubros.ts`](../app/config/rubros.ts) | Categorías y rubros usados en cotización |

---

## `/lib` — Lógica compartida

Código TypeScript puro, sin dependencias de Next.js. Se importa desde páginas y APIs.

### Autenticación

| Archivo | Qué hace |
|---------|---------|
| [`auth.ts`](../lib/auth.ts) | Funciones principales: generar y verificar JWT, obtener usuario desde request |
| [`auth-server.ts`](../lib/auth-server.ts) | Versión para Server Components: lee cookies en el servidor |
| [`auth-edge.ts`](../lib/auth-edge.ts) | JWT sign/verify con WebCrypto (usado desde route handlers Node). `middleware.ts` NO lo usa — decodifica el payload sin verificar firma para evitar error `BufferSource` en el Edge runtime de Railway. |
| [`auth_sync.ts`](../lib/auth_sync.ts) | Sincronización de sesión entre pestañas del navegador |
| [`schemas/auth.ts`](../lib/schemas/auth.ts) | Esquemas Zod para validar datos de login y registro |

### Base de datos

| Archivo | Qué hace |
|---------|---------|
| [`db.ts`](../lib/db.ts) | Conexión única a la base de datos (SQLite en dev, PostgreSQL en prod). Exporta `db` y `query()` |
| [`parse-db-json.ts`](../lib/parse-db-json.ts) | Parsea campos JSON almacenados como texto en SQLite |

### Notificaciones y comunicación

| Archivo | Qué hace |
|---------|---------|
| [`notify.ts`](../lib/notify.ts) | Envía notificaciones Web Push y mails según configuración del sistema |
| [`mail.ts`](../lib/mail.ts) | Cliente SMTP: arma y envía emails con nodemailer |

### Módulo Logística / Agenda Web

| Archivo | Qué hace |
|---------|---------|
| [`agenda-types.ts`](../lib/agenda-types.ts) | Tipos TypeScript del módulo de agenda (empleados, turnos, entregas) |
| [`agenda-helpers.ts`](../lib/agenda-helpers.ts) | Funciones utilitarias de fechas, validaciones y cálculos de agenda |
| [`agenda-catalog.ts`](../lib/agenda-catalog.ts) | Acceso al catálogo de artículos de uniformes |
| [`agenda-article-aliases.ts`](../lib/agenda-article-aliases.ts) | Alias de artículos (nombres alternativos para búsqueda) |
| [`agenda-import.ts`](../lib/agenda-import.ts) | Importación masiva de empleados desde Excel/CSV |
| [`agenda-remito-parser.ts`](../lib/agenda-remito-parser.ts) | Parser de remitos de uniformes desde texto |
| [`agenda-remito-pdf-parser.ts`](../lib/agenda-remito-pdf-parser.ts) | Parser de remitos desde PDF (Cloudinary) |
| [`agenda-roles.ts`](../lib/agenda-roles.ts) | Control de acceso y roles dentro del módulo agenda |
| [`agenda-storage.ts`](../lib/agenda-storage.ts) | Persistencia de agenda: turnos, entregas, historial |
| [`agenda-ui.ts`](../lib/agenda-ui.ts) | Utilidades de presentación para la UI de agenda |
| [`agenda-uniforms.ts`](../lib/agenda-uniforms.ts) | Lógica de asignación y control de uniformes |
| [`logistica-articulos.ts`](../lib/logistica-articulos.ts) | CRUD de artículos en el módulo de logística |
| [`logistica-clients.ts`](../lib/logistica-clients.ts) | Clientes y configuración del módulo de logística |

### Módulo Limpieza / Operaciones

| Archivo | Qué hace |
|---------|---------|
| [`limpieza-hours.ts`](../lib/limpieza-hours.ts) | Cálculo de horas trabajadas del personal de limpieza |
| [`limpieza-planilla-seed.ts`](../lib/limpieza-planilla-seed.ts) | Inicialización de la planilla configurable de operaciones |
| [`client-sectors.ts`](../lib/client-sectors.ts) | Mapa de clientes y sus sectores (sincronizado con `app/config/clients.ts`) |

### Otros

| Archivo | Qué hace |
|---------|---------|
| [`cloudinary.ts`](../lib/cloudinary.ts) | Cliente Cloudinary: subir y borrar archivos en la nube |
| [`mitrabajo-download.js`](../lib/mitrabajo-download.js) | Descarga de reportes desde mitrabajo.uy con Playwright (versión lib) |
| [`mitrabajo-mailer.cjs`](../lib/mitrabajo-mailer.cjs) | Envío del Excel como adjunto vía SMTP tras guardar en DB (lee destinatarios de `mitrabajo_config`) |
| [`rate-limit.ts`](../lib/rate-limit.ts) | Rate limiting en memoria por IP y clave. Incluye `getClientIp` (compatible con Railway) |
| [`jornales-helpers.ts`](../lib/jornales-helpers.ts) | Roles permitidos (admin, rrhh), cálculo de estado y parseo de fechas para Jornales |
| [`citaciones-helpers.ts`](../lib/citaciones-helpers.ts) | Roles permitidos (admin, rrhh) para el módulo de Citaciones Laborales |
| [`citaciones-pdf-parser.ts`](../lib/citaciones-pdf-parser.ts) | Parser heurístico de PDFs de citaciones MTSS/Juzgado: extrae texto con pdf-parse y matchea regex sobre labels (empresa, trabajador, fecha, hora, abogado, rubros, monto) |

---

## `/scripts` — Utilitarios y mantenimiento

Scripts que se corren manualmente o como procesos separados. **No se ejecutan como parte de la app.**

### Procesos continuos (crons / workers)

| Archivo | Qué hace |
|---------|---------|
| [`cron-mitrabajo.cjs`](../scripts/cron-mitrabajo.cjs) | Worker Railway `mitrabajo-worker`: descarga diaria de mitrabajo.uy a las 08:00 (America/Montevideo) + servidor HTTP de health check |
| [`cron-agenda.cjs`](../scripts/cron-agenda.cjs) | Worker Railway `agenda-worker`: genera slots del mes siguiente el día 28 a las 09:00 + sync de renovaciones diario a las 02:00 (ambos America/Montevideo) + servidor HTTP de health check. Ver [docs/RAILWAY_WORKERS.md](./RAILWAY_WORKERS.md) |

### Descarga de datos externos

| Archivo | Qué hace |
|---------|---------|
| [`download-mitrabajo.cjs`](../scripts/download-mitrabajo.cjs) | Lógica real de descarga con Playwright y guardado en DB (ejecutado por el cron y el trigger) |

### Build / generación

| Archivo | Qué hace |
|---------|---------|
| [`generate-clients.js`](../scripts/generate-clients.js) | Lee `CLIENTS_DATA` env var y genera `app/config/clients.ts` (corre antes del build) |
| [`generate-vapid-keys.js`](../scripts/generate-vapid-keys.js) | Genera par de claves VAPID para Web Push |

### Datos de prueba

| Archivo | Qué hace |
|---------|---------|
| [`seed-dev.js`](../scripts/seed-dev.js) | Crea usuarios de todos los roles, tickets, bitácora y asistencia para desarrollo local (`npm run seed`) |
| [`generate_data.js`](../scripts/generate_data.js) | Genera registros de asistencia para usuarios de prueba |
| [`generate_test_attendance.js`](../scripts/generate_test_attendance.js) | Genera registros de asistencia con ubicación y sector |
| [`create_sample_tickets.js`](../scripts/create_sample_tickets.js) | Crea tickets de ejemplo |
| [`import_data.js`](../scripts/import_data.js) | Importa datos desde archivos externos |
| [`cleanup-test-data.js`](../scripts/cleanup-test-data.js) | Elimina todos los datos de prueba |
| [`cleanup-orphaned-collaborators.js`](../scripts/cleanup-orphaned-collaborators.js) | Limpia colaboradores huérfanos en tickets |

### Inicialización y migraciones de base de datos

| Archivo | Qué hace |
|---------|---------|
| [`init_db.js`](../scripts/init_db.js) | Crea todas las tablas desde cero |
| [`migrate-passwords.js`](../scripts/migrate-passwords.js) | Migra contraseñas a bcrypt |
| [`migrate-subscriptions.js`](../scripts/migrate-subscriptions.js) | Migra tabla de suscripciones push |
| [`migrate-logbook.js`](../scripts/migrate-logbook.js) | Migra estructura de la bitácora |
| [`migrate-catalog-puesto-to-category.cjs`](../scripts/migrate-catalog-puesto-to-category.cjs) | Renombra campo en catálogo de uniformes |
| [`migrate-employees-agendaweb.cjs`](../scripts/migrate-employees-agendaweb.cjs) | Migra empleados al nuevo esquema de agenda web |
| [`migrate-history-agendaweb.cjs`](../scripts/migrate-history-agendaweb.cjs) | Migra historial de entregas al nuevo esquema |
| [`migrate-old-remitos.cjs`](../scripts/migrate-old-remitos.cjs) | Migra remitos al esquema actual |
| [`migrate_limpieza_personal_only.cjs`](../scripts/migrate_limpieza_personal_only.cjs) | Migra solo el personal de limpieza |
| [`migrate_data.ts`](../scripts/migrate_data.ts) | Migración general de datos entre versiones |
| [`add_notifications_table.js`](../scripts/add_notifications_table.js) | Agrega tabla de notificaciones |
| [`add_ticket_collaborators.js`](../scripts/add_ticket_collaborators.js) | Agrega tabla de colaboradores en tickets |
| [`add-tercerizados-role.js`](../scripts/add-tercerizados-role.js) | Agrega rol de tercerizados al sistema |
| [`seed-catalog-agendaweb.cjs`](../scripts/seed-catalog-agendaweb.cjs) | Carga catálogo inicial de artículos |
| [`reset-agenda-catalog.cjs`](../scripts/reset-agenda-catalog.cjs) | Resetea el catálogo de agenda |
| [`merge_limpieza_clientes.cjs`](../scripts/merge_limpieza_clientes.cjs) | Consolida datos de clientes de limpieza |
| [`secure-cloudinary-remitos.cjs`](../scripts/secure-cloudinary-remitos.cjs) | Migra remitos públicos a carpeta privada en Cloudinary |

### Backups

| Archivo | Qué hace |
|---------|---------|
| [`backup_db.sh`](../scripts/backup_db.sh) | Backup completo de la base de datos a archivo .json |
| [`restore_db.sh`](../scripts/restore_db.sh) | Restaura base de datos desde backup |
| [`backup-before-migration.js`](../scripts/backup-before-migration.js) | Genera backup automático antes de correr migraciones |
| [`cleanup_old_backups.sh`](../scripts/cleanup_old_backups.sh) | Elimina backups con más de N días |
| [`restore-logbook-2026-04-16.cjs`](../scripts/restore-logbook-2026-04-16.cjs) | Restauración puntual de bitácora desde backup específico |

### Inspección y debugging

| Archivo | Qué hace |
|---------|---------|
| [`check-schema.js`](../scripts/check-schema.js) | Imprime el schema actual de la DB |
| [`check-tables-schema.js`](../scripts/check-tables-schema.js) | Lista columnas de cada tabla |
| [`check-db-direct.js`](../scripts/check-db-direct.js) | Conexión directa a DB para inspección |
| [`check-foreign-keys.js`](../scripts/check-foreign-keys.js) | Verifica integridad de claves foráneas |
| [`check-job-roles.js`](../scripts/check-job-roles.js) | Lista roles y permisos actuales |
| [`check_db.js`](../scripts/check_db.js) | Consultas de diagnóstico generales |
| [`inspect-schema.js`](../scripts/inspect-schema.js) | Inspección detallada del schema |
| [`inspect-tickets.js`](../scripts/inspect-tickets.js) | Consultas de diagnóstico del módulo tickets |
| [`debug-db.ts`](../scripts/debug-db.ts) | Debug avanzado de la base de datos |
| [`debug_tasks.js`](../scripts/debug_tasks.js) | Debug del módulo de tareas |
| [`audit-env-vars.js`](../scripts/audit-env-vars.js) | Verifica que todas las env vars requeridas estén definidas |
| [`audit-test-data.js`](../scripts/audit-test-data.js) | Detecta datos de prueba en la base de datos |

### Seguridad y hashes

| Archivo | Qué hace |
|---------|---------|
| [`gen-hash.js`](../scripts/gen-hash.js) | Genera hash bcrypt para una contraseña |
| [`gen-verify-hash.js`](../scripts/gen-verify-hash.js) | Genera y verifica hash en un paso |
| [`verify-login.js`](../scripts/verify-login.js) | Verifica credenciales de un usuario manualmente |
| [`verify-password-security.js`](../scripts/verify-password-security.js) | Audita contraseñas débiles en la DB |
| [`verify_hash.js`](../scripts/verify_hash.js) | Compara hash bcrypt con contraseña en texto plano |
| [`test-hash-comp.js`](../scripts/test-hash-comp.js) | Test de comparación de hashes |

### Tests de conexión

| Archivo | Qué hace |
|---------|---------|
| [`test-db.js`](../scripts/test-db.js) | Test de conexión a la base de datos |
| [`fix-admin-db.js`](../scripts/fix-admin-db.js) | Corrección puntual de datos en tabla de admins |

---

## `/public` — Archivos estáticos

| Archivo / Carpeta | Qué es |
|-------------------|--------|
| [`logo.png`](../public/logo.png) | Logo de GSS Facility Services |
| `app/icon.png` | Favicon de la app |
| [`sw.js`](../public/sw.js) | Service Worker para notificaciones push offline |
| [`manifest.json`](../public/manifest.json) | Web App Manifest (nombre, ícono, colores para PWA) |
| `uploads/` | Archivos subidos por usuarios (adjuntos de tickets, fotos) |

---

## Archivos de configuración en la raíz

| Archivo | Qué hace |
|---------|---------|
| [`middleware.ts`](../middleware.ts) | Intercepta cada request: verifica JWT, redirige a login si no hay sesión |
| [`next.config.ts`](../next.config.ts) | Compresión, dominios de imágenes, headers de seguridad (CSP, HSTS) |
| [`railway.toml`](../railway.toml) | Healthcheck path, política de restart, timeout de deploy en Railway |
| [`nixpacks.toml`](../nixpacks.toml) | Define cómo Railway construye la imagen (Node.js version, comandos) |
| [`Dockerfile`](../Dockerfile) | Imagen Docker multi-stage para producción |
| [`docker-compose.yml`](../docker-compose.yml) | Orquestación Docker para producción local |
| [`docker-compose.dev.yml`](../docker-compose.dev.yml) | Orquestación Docker para desarrollo |
| [`startup.sh`](../startup.sh) | Corre al iniciar el contenedor: aplica migraciones pendientes y arranca el servidor |
| [`package.json`](../package.json) | Scripts npm: `dev`, `build`, `start`, `seed`, `lint` |
| [`tsconfig.json`](../tsconfig.json) | Paths, strict mode, target ES2017 |
| [`eslint.config.mjs`](../eslint.config.mjs) | Reglas ESLint para Next.js + TypeScript |
| [`.gitignore`](../.gitignore) | Excluye node_modules, .env*, *.db, datos sensibles |
| [`.dockerignore`](../.dockerignore) | Excluye de la imagen Docker lo que no necesita producción |
| [`.gitattributes`](../.gitattributes) | Normalización de line endings (LF en todos los archivos) |
| [`env.local.example`](../env.local.example) | Plantilla de variables de entorno requeridas |

---

## Flujo de una request típica

```
Navegador
 → middleware.ts (verifica JWT)
 → app/[modulo]/page.tsx (renderiza UI)
 → fetch("/api/...")
 → app/api/.../route.ts (lógica de negocio)
 → lib/db.ts (consulta DB)
 → lib/notify.ts (opcional: envía notificación)
 → lib/cloudinary.ts (opcional: sube archivo)
```

---

## Bases de datos

El sistema usa el mismo código para dos motores:

| Entorno | Motor | Archivo |
|---------|-------|---------|
| Desarrollo | SQLite | `tickets.db` en la raíz |
| Producción | PostgreSQL | URL en `DATABASE_URL` env var |

[`lib/db.ts`](../lib/db.ts) detecta automáticamente cuál usar según `DATABASE_URL`.
