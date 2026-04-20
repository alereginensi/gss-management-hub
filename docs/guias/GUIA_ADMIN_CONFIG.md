# Guía de Configuración del Sistema

La Configuración del Sistema es una sección exclusiva para administradores. Desde acá se gestionan los clientes (ubicaciones), sus sectores, y se accede a herramientas avanzadas de mantenimiento del sistema.

---

## 1. Cómo acceder

En el menú lateral, hacé clic en **"Sistema"** → **"Configuración"**.

> Esta sección solo es visible para usuarios con tipo **Administrador**.

---

## 2. Gestión de Ubicaciones (Clientes)

Las "ubicaciones" son los clientes o edificios donde se prestan los servicios. Están configuradas acá para que aparezcan disponibles en todos los módulos del sistema (Bitácora, Operaciones, Registro de Limpieza, etc.).

### Agregar una nueva ubicación

1. En la sección de Ubicaciones, hacé clic en **"Nueva ubicación"** o **"+ Agregar"**.
2. Escribí el nombre del cliente o edificio (ej: "Hospital Pasteur", "Edificio Torre Norte").
3. Guardá.

La nueva ubicación va a aparecer disponible en todos los módulos donde se elige cliente.

### Editar una ubicación

1. Buscá la ubicación en la lista.
2. Hacé clic en el ícono de editar (lápiz).
3. Modificá el nombre u otros datos.
4. Guardá.

### Eliminar una ubicación

> Antes de eliminar, asegurate de que no haya registros activos asociados a esa ubicación.

1. Buscá la ubicación.
2. Hacé clic en el ícono de eliminar (tacho).
3. Confirmá la acción.

---

## 3. Gestión de Sectores

Cada ubicación (cliente) puede tener varios sectores: pisos, áreas, oficinas, etc. Los sectores aparecen en los módulos cuando se elige un cliente.

### Agregar sectores a una ubicación

1. Hacé clic en la ubicación a la que querés agregarle sectores.
2. Dentro del detalle de la ubicación, buscá la sección **"Sectores"**.
3. Hacé clic en **"Agregar sector"** o **"+ Nuevo"**.
4. Escribí el nombre del sector (ej: "Piso 1", "Cocina", "Baños Planta Baja").
5. Guardá.

### Eliminar un sector

1. Dentro del detalle de la ubicación, buscá el sector.
2. Hacé clic en el ícono de eliminar.
3. Confirmá.

> Si un sector ya fue usado en registros, eliminarlo puede afectar la visualización de esos registros históricos. Considerá desactivarlo en lugar de eliminarlo.

---

## 4. Herramientas del sistema

Además de la gestión de ubicaciones, la pantalla de Configuración tiene acceso a herramientas avanzadas del sistema:

### Configuración de correo electrónico

Permite configurar las direcciones de correo a las que se envían las notificaciones de tickets por departamento. Por ejemplo, podés indicar que los tickets del departamento "Seguridad" le lleguen a una dirección específica.

### Configuración de integración (Power Automate / notificaciones externas)

Si la empresa usa Power Automate u otro servicio de automatización para enviar correos o notificaciones, acá se configura la URL del servicio.

### Exportación y respaldo de datos

Herramienta para descargar una copia de los datos del sistema en formato de respaldo. Útil para tener un archivo de seguridad de la información.

### Herramientas de mantenimiento

Opciones para limpiar notificaciones antiguas, verificar la integridad de la base de datos y otras tareas de mantenimiento técnico.

---

## 5. Preguntas frecuentes

**¿Qué pasa si elimino una ubicación que ya tiene registros en la Bitácora?**
Los registros históricos se mantienen, pero la ubicación ya no aparecerá disponible para nuevos registros. Es recomendable no eliminar ubicaciones con historial; en cambio, podés renombrarlas o marcarlas como inactivas si la funcionalidad lo permite.

**¿Puedo importar una lista de clientes desde Excel?**
Esta funcionalidad depende de la versión del sistema. Consultá con el área de IT si necesitás cargar muchos clientes de una vez.
