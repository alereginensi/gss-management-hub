# Guía de Usuarios y Roles

En GSS Management Hub, el acceso está controlado por roles específicos que determinan qué acciones y vistas están disponibles para cada colaborador.

---

## 1. Tipos de Usuarios

### 👤 Administrador
- **Control Total**: Gestión de todos los usuarios (aprobación/bloqueo).
- **Vigilancia Global**: Acceso al Dashboard completo con todos los tickets del sistema.
- **Configuración**: Capacidad para ajustar parámetros críticos del sistema.

### 👥 Supervisor
- **Gestión Operativa**: Puede crear, transferir y colaborar en tickets.
- **Bitácora**: Responsable de la carga y validación de novedades en la bitácora.
- **Acceso Directo**: Solo ve sus propios tickets y registros de bitácora asignados.

### 👷 Funcionario
- **Registro de Campo**: Realiza los reportes de tareas diarias y asistencia.
- **Tickets**: Puede reportar incidentes pero con vistas limitadas a su propia actividad.

### 📩 Solicitante (Invitado)
- **Acceso Simplificado**: No necesita registro previo ni contraseña.
- **Función única**: Solo puede crear nuevos tickets de incidencia de manera rápida.
- **Uso**: Ideal para personal externo o clientes que necesitan reportar un problema puntual sin gestionar una cuenta completa.

---

## 2. Proceso de Registro

1.  **Formulario**: El usuario completa sus datos, elige su **Rol** y su **Rubro** (especialidad).
2.  **Estado Pendiente**: Toda cuenta nueva nace bloqueada por seguridad.
3.  **Aprobación**: Un Administrador debe revisar la solicitud y aprobar el acceso manualmente.
4.  **Filtros Inteligentes**: El sistema utiliza lógica "accent-insensitive" para asegurar que los rubros (ej. "Seguridad Física") funcionen correctamente sin importar las tildes.

---

## 3. Seguridad y Acceso
- **Autenticación**: Basada en correo electrónico y contraseña encriptada.
- **Middleware**: El sistema protege las rutas de API y páginas según el rol detectado en la sesión.
