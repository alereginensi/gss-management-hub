# GSS Management Hub

**GSS Management Hub** es una plataforma centralizada diseñada para la gestión operativa de **GSS Facility Services**. Permite el seguimiento de incidentes, control de bitácoras, registro de tareas y comunicación en tiempo real entre administradores, supervisores y personal operativo.

🔗 **Acceso a Producción**: [https://gss-management-hub-production.up.railway.app/](https://gss-management-hub-production.up.railway.app/)

---

## 🚀 Funciones Principales

### 1. Sistema de Tickets (Mesa de Ayuda)
Gestión completa del ciclo de vida de los incidentes y solicitudes.
- **Creación y Seguimiento**: Registro de tickets con adjuntos multimedia y niveles de prioridad.
- **Colaboración**: Posibilidad de asignar múltiples colaboradores y transferir tickets entre supervisores.
- **Alertas en Tiempo Real**: Notificaciones push integradas para actualizaciones críticas.

### 2. Bitácora de Novedades (Logbook)
Módulo robusto para el reporte diario de novedades en los servicios.
- **Carga Rápida e Histórico**: Interfaz optimizada para registros individuales o por lotes.
- **Sectores Dinámicos**: Soporte para múltiples sectores por cliente con sistema de fallback ("Sector Único").
- **Exportación Automática**: Generación de reportes detallados en formato Excel con codificación de colores.

### 3. Registro de Tareas y Asistencia
Seguimiento preciso del desempeño del personal en campo.
- **Registro por Cliente/Sector**: Los trabajadores registran sus tareas específicas durante la jornada.
- **Cálculo Automático**: El sistema calcula la duración de la jornada basándose en el primer y último registro, eliminando la necesidad de ingresos/salidas rígidos.

### 4. Panel de Control (Admin Dashboard)
Vistas estratégicas para la toma de decisiones.
- **KPIs Dinámicos**: Desglose de prioridades, tickets pendientes y estadísticas de rendimiento.
- **Gestión de Usuarios**: Control de acceso granular y aprobación de nuevos registros.

---

## 📱 Optimización Mobile-First
La plataforma ha sido optimizada para un uso fluido en dispositivos móviles y tablets:
- **Bottom-Sheets**: Los formularios y detalles en móviles utilizan un patrón de "hoja inferior" para mejor ergonomía táctil.
- **Vistas en Tarjetas**: Las tablas complejas se transforman automáticamente en tarjetas legibles en pantallas pequeñas.
- **Layout Adaptativo**: Corrección de márgenes y paddings para aprovechar al máximo el espacio en tablets (iPad/Android).

---

## 🛠️ Tecnologías

- **Frontend**: Next.js (App Router), React, Lucide React (Icons).
- **Backend**: API Routes (Next.js), Node.js.
- **Base de Datos**: SQLite (Desarrollo/Local) / PostgreSQL (Producción).
- **Notificaciones**: Web-Push (Service Workers VAPID).
- **Estilos**: Global CSS con variables de marca personalizadas.

---

## ⚙️ Instalación y Desarrollo

### Requisitos
- Node.js 18+
- Docker & Docker Compose (Opcional)

### Pasos
1. **Instalar dependencias**:
   ```bash
   npm install
   ```
2. **Configurar variables de entorno**:
   Copia `.env.example` a `.env.local` y configura tus claves (VAPID, DB_URL, etc.).
3. **Ejecutar en desarrollo**:
   ```bash
   npm run dev
   ```
4. **Build para producción**:
   ```bash
   npm run build
   ```

---

## 🐳 Despliegue con Docker
```bash
docker compose up -d --build
```

---

## 📄 Documentación Adicional
- [GUIA_SISTEMA.md](./GUIA_SISTEMA.md): Guía para supervisores y registro de usuarios.
- [BACKUPS.md](./BACKUPS.md): Procedimientos de respaldo de base de datos.
- [DEPLOYMENT_QUICKSTART.md](./DEPLOYMENT_QUICKSTART.md): Pasos rápidos para despliegue en la nube.
