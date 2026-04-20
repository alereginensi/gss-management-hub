<p align="center">
  <img src="public/logo.png" alt="GSS Facility Services" width="180" />
</p>

# GSS Centro de Gestión

**GSS Centro de Gestión** es el portal web interno de **GSS Facility Services**. Centraliza en un solo lugar todo lo que necesita el equipo para operar: tickets de soporte, bitácora de novedades, control de asistencia, logística de uniformes, operaciones de limpieza y seguridad, recursos humanos, cotización comercial y mucho más.

Funciona desde cualquier navegador, en celular o computadora, sin necesidad de instalar nada.

---

## Módulos del sistema

### Tickets (Mesa de Ayuda)
Canal para reportar y gestionar incidencias y solicitudes. Cada ticket tiene seguimiento completo: comentarios internos, archivos adjuntos, colaboradores, historial de cambios y notificaciones automáticas por correo y celular.

### Bitácora
Registro diario de novedades operativas. Los supervisores documentan inspecciones, incidentes y el estado del personal en cada cliente. Exportable a Excel con colores por sector.

### Mi Trabajo / Registro de Tareas
Los trabajadores registran sus tareas del día indicando cliente y sector. El sistema calcula la asistencia automáticamente a partir del primer y último registro, sin necesidad de fichar.

### Panel de Administración
Tablero con métricas generales: tickets pendientes, resueltos, tiempo promedio de resolución y distribución por prioridad. Vista exclusiva para administradores y jefes.

### Operaciones Limpieza
Gestión del personal de limpieza y seguridad: informes de presencia con firma digital, asignación de tareas, historial, gestión de personal y solicitudes de uniformes. Incluye un editor de planillas configurable por el administrador.

### Logística
Administración integral de uniformes: agenda web de entregas por empleado, seguimiento de envíos al interior del país, órdenes de compra con lectura automática de PDF, y calendario de eventos logísticos.

### Registro de Limpieza
Pantalla pública (sin contraseña) donde el personal de limpieza confirma sus tareas del día con foto como evidencia, usando solo su número de cédula.

### Turno — Agenda Web de Uniformes (pública)
Pantalla pública donde cualquier empleado puede consultar si tiene un turno de entrega de uniforme asignado, ingresando su número de cédula.

### Seguridad Electrónica
Módulo para técnicos: registro de eventos de monitoreo y gestión de mantenimientos preventivos y correctivos en instalaciones de los clientes.

### Cotización
Gestión comercial y liquidación de horas: categorías de empleados, tarifas por hora, períodos de facturación y exportación de reportes Excel para clientes.

### Recursos Humanos (RRHH)
Acceso al sistema de gestión de uniformes desde el área de RRHH. Permite consultar y registrar entregas al personal.

### Mi Trabajo (Mitrabajo)
Descarga automática diaria del reporte de asistencia desde el portal externo mitrabajo.uy. Los archivos quedan disponibles para descarga directa desde el sistema.

### Administración de Usuarios
Gestión completa de cuentas: aprobar registros nuevos, crear usuarios manualmente, asignar roles y módulos, bloquear accesos y administrar el personal de campo (funcionarios).

### Configuración del Sistema
Gestión de clientes (ubicaciones) y sus sectores, configuración de notificaciones por departamento e integración con servicios externos.

---

## Tecnologías

| Área | Tecnología |
|------|------------|
| Frontend | Next.js (App Router), React |
| Backend | API Routes (Next.js), Node.js |
| Base de datos | SQLite (desarrollo local) / PostgreSQL (producción) |
| Autenticación | JWT (sesión por token) |
| Notificaciones | Web Push (VAPID), correo SMTP, Power Automate |
| Almacenamiento de archivos | Sistema de archivos local / Cloudinary |
| Automatización | Playwright (descarga mitrabajo), node-cron |
| Exportaciones | ExcelJS / SheetJS |

---

## Roles de usuario

| Rol | Acceso principal |
|-----|-----------------|
| Administrador | Todo el sistema |
| Jefe | Su departamento completo |
| Supervisor | Tickets, Bitácora, operaciones |
| Funcionario | Registro de tareas propias |
| Técnico | Seguridad electrónica |
| Logística | Módulo de logística completo |
| Contador | Cotización y liquidación |
| RRHH | Agenda web de uniformes |
| Encargado de limpieza | Operaciones limpieza (cliente asignado) |
| Limpieza | Registro de limpieza (pantalla pública) |

---

## Instalación y desarrollo

### Requisitos
- Node.js 18+

### Pasos

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Configurar variables de entorno — copiar `.env.local.example` a `.env.local` y completar los valores (base de datos, VAPID, correo, etc.).

3. Ejecutar en desarrollo:
   ```bash
   npm run dev
   ```

4. Build para producción:
   ```bash
   npm run build
   npm start
   ```

---

## Despliegue

El sistema está preparado para desplegarse en **Railway** con PostgreSQL como base de datos de producción. Ver [DEPLOYMENT_QUICKSTART.md](./DEPLOYMENT_QUICKSTART.md) para los pasos detallados.

```bash
# Docker (opcional)
docker compose up -d --build
```

---

## Documentación por módulo

Todas las guías están escritas para usuarios sin conocimientos técnicos.

| Guía | Módulo |
|------|--------|
| [Usuarios y Roles](./GUIA_USUARIOS.md) | Registro, login, tipos de usuario |
| [Administradores](./GUIA_ADMINISTRADORES.md) | Gestión de usuarios y sistema |
| [Tickets](./GUIA_TICKETS.md) | Mesa de ayuda, estados, colaboradores |
| [Mi Trabajo / Asistencia](./GUIA_ASISTENCIA.md) | Registro de tareas y asistencia |
| [Bitácora](./GUIA_BITACORA.md) | Novedades, exportación, estadísticas |
| [Configuración Personal](./GUIA_CONFIGURACION.md) | Tema, notificaciones push |
| [Panel de Administración](./GUIA_ADMINISTRACION_DASHBOARD.md) | Métricas y gestión de tickets |
| [Operaciones Limpieza](./GUIA_OPERACIONES_LIMPIEZA.md) | Informes, tareas, personal, uniformes |
| [Logística](./GUIA_LOGISTICA.md) | Agenda web, envíos, órdenes de compra |
| [Seguridad Electrónica](./GUIA_SEGURIDAD_ELECTRONICA.md) | Monitoreo y mantenimiento |
| [Cotización](./GUIA_COTIZACION.md) | Tarifas, liquidación, reportes |
| [RRHH](./GUIA_RRHH.md) | Agenda web de uniformes |
| [Gestión de Usuarios (Admin)](./GUIA_ADMIN_USUARIOS.md) | Alta, edición, permisos, funcionarios |
| [Configuración del Sistema (Admin)](./GUIA_ADMIN_CONFIG.md) | Ubicaciones, sectores, herramientas |
| [Registro de Limpieza](./GUIA_REGISTRO_LIMPIEZA.md) | Pantalla pública con cédula |
| [Turno / Agenda Uniformes](./GUIA_TURNO.md) | Consulta pública de turno |
| [Respaldos](./BACKUPS.md) | Procedimientos de backup |
| [Despliegue](./DEPLOYMENT_QUICKSTART.md) | Guía rápida Railway |
