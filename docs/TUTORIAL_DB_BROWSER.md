# Tutorial: Cómo Usar DB Browser para Ver y Analizar Backups

## Ubicaciones Importantes

### Base de Datos Principal (Activa)
```
C:\Users\User\.gemini\antigravity\scratch\Proyectos\gss-management-hub\tickets.db
```
**Esta es la base de datos que usa la aplicación en tiempo real**

### Carpeta de Backups
```
C:\Users\User\.gemini\antigravity\scratch\Proyectos\gss-management-hub\backups\
```
**Aquí se guardan todas las copias de seguridad**

---

## Instalación de DB Browser

Si aún no lo tenés instalado:

1. Descargá desde: https://sqlitebrowser.org/
2. Instalá la versión para Windows
3. Ejecutá **DB Browser for SQLite**

---

## Método 1: Ver un Backup (Solo Lectura)

### Paso a Paso

1. **Abrí DB Browser for SQLite**

2. **File → Open Database** (o presiona `Ctrl+O`)

3. **Navegá a la carpeta de backups:**
 ```
 C:\Users\User\.gemini\antigravity\scratch\Proyectos\gss-management-hub\backups\
 ```

4. **Seleccioná el archivo de backup** que querés ver:
 - Ejemplo: `tickets_20260217_140000.db`
 - Los nombres incluyen fecha y hora: `tickets_YYYYMMDD_HHMMSS.db`

5. **Cuando te pregunte "Open in read-only mode?"**
 - Hacé clic en **Yes** (Sí)
 - Esto previene modificaciones accidentales

### Qué Podés Hacer

#### Ver Datos de las Tablas
1. Hacé clic en la pestaña **"Browse Data"**
2. En el dropdown "Table:", seleccioná la tabla que querés ver:
 - `users` - Usuarios del sistema
 - `tickets` - Tickets creados
 - `tasks` - Registros de asistencia y tareas
 - `logbook_entries` - Bitácora de supervisores
 - `locations` - Lugares/Clientes
 - `roles` - Rubros y tareas

#### Ver Estructura de la Base de Datos
1. Hacé clic en la pestaña **"Database Structure"**
2. Podés ver:
 - Todas las tablas
 - Columnas de cada tabla
 - Tipos de datos
 - Índices

#### Ejecutar Consultas SQL
1. Hacé clic en la pestaña **"Execute SQL"**
2. Escribí tu consulta y presioná el botón ▶(Execute)

**Consultas Útiles:**

```sql
-- Ver total de usuarios
SELECT COUNT(*) as total_usuarios FROM users;

-- Ver usuarios por rol
SELECT role, COUNT(*) as cantidad 
FROM users 
GROUP BY role;

-- Ver tickets por estado
SELECT status, COUNT(*) as cantidad 
FROM tickets 
GROUP BY status;

-- Ver últimos 10 tickets
SELECT * FROM tickets 
ORDER BY created_at DESC 
LIMIT 10;

-- Ver asistencias de una fecha específica
SELECT u.name, t.type, t.created_at, t.location, t.sector
FROM tasks t 
JOIN users u ON t.user_id = u.id 
WHERE DATE(t.created_at) = '2026-02-17'
ORDER BY t.created_at;

-- Ver total de horas trabajadas por usuario
SELECT u.name, COUNT(*) as dias_trabajados
FROM tasks t
JOIN users u ON t.user_id = u.id
WHERE t.type = 'check_in'
GROUP BY u.name
ORDER BY dias_trabajados DESC;
```

---

## Método 2: Comparar Backup vs Base Actual

### Paso a Paso

1. **Abrí la base de datos actual:**
 - File → Open Database
 - Seleccioná: `tickets.db` (en la raíz del proyecto)

2. **Adjuntá el backup para comparar:**
 - File → **Attach Database**
 - Navegá a `backups/`
 - Seleccioná el backup que querés comparar
 - En "Database name:", escribí: `backup_anterior`
 - Hacé clic en **OK**

3. **Ejecutá consultas comparativas:**

```sql
-- Ver usuarios nuevos desde el backup
SELECT * FROM users 
WHERE id NOT IN (SELECT id FROM backup_anterior.users);

-- Ver tickets creados desde el backup
SELECT * FROM tickets 
WHERE id NOT IN (SELECT id FROM backup_anterior.tickets);

-- Ver cuántos registros nuevos hay en cada tabla
SELECT 
 (SELECT COUNT(*) FROM users) - (SELECT COUNT(*) FROM backup_anterior.users) as nuevos_usuarios,
 (SELECT COUNT(*) FROM tickets) - (SELECT COUNT(*) FROM backup_anterior.tickets) as nuevos_tickets,
 (SELECT COUNT(*) FROM tasks) - (SELECT COUNT(*) FROM backup_anterior.tasks) as nuevas_tareas;

-- Ver usuarios eliminados
SELECT * FROM backup_anterior.users 
WHERE id NOT IN (SELECT id FROM users);
```

4. **Cuando termines:**
 - File → **Detach Database**
 - Seleccioná `backup_anterior`
 - Hacé clic en **OK**

---

## Método 3: Exportar Datos a Excel/CSV

### Desde un Backup

1. **Abrí el backup** que querés exportar

2. **Seleccioná la tabla:**
 - Pestaña "Browse Data"
 - Elegí la tabla en el dropdown

3. **Exportá:**
 - File → Export → **Table(s) as CSV file...**
 - Seleccioná las tablas que querés exportar
 - Elegí dónde guardar el archivo
 - Hacé clic en **Save**

4. **Abrí en Excel:**
 - Abrí Excel
 - File → Open
 - Seleccioná el archivo CSV
 - Excel te preguntará cómo importarlo (generalmente "Delimitado" con comas)

---

## Identificar Backups por Fecha

Los nombres de archivo siguen este formato:
```
tickets_YYYYMMDD_HHMMSS.db
```

**Ejemplos:**
- `tickets_20260217_140530.db` = 17 de Febrero 2026, 14:05:30
- `tickets_20260216_020000.db` = 16 de Febrero 2026, 02:00:00 (backup automático)
- `tickets_test_manual_20260217.db` = Backup manual de prueba

**Backups mensuales:**
- `monthly_202602.db` = Backup del mes de Febrero 2026

---

## Consejos Importantes

### Buenas Prácticas

1. **Siempre abrí backups en modo solo lectura**
 - Evita modificaciones accidentales
 - DB Browser te preguntará automáticamente

2. **No modifiques la base de datos activa (`tickets.db`) mientras la app está corriendo**
 - Primero detené el servidor
 - Hacé los cambios
 - Reiniciá el servidor

3. **Hacé un backup manual antes de cambios importantes**
 ```bash
 copy tickets.db backups\tickets_antes_de_cambio_importante.db
 ```

4. **Usá backups para análisis y reportes**
 - No afecta el rendimiento de la app
 - Podés hacer consultas complejas sin preocuparte

### Qué NO Hacer

1. No borres backups manualmente sin revisar la fecha
2. No modifiques un backup y lo uses para restaurar (creá uno nuevo)
3. No abras la base de datos activa mientras la app está corriendo (solo lectura está OK)

---

## Solución de Problemas

### "Database is locked"
**Problema:** La base de datos está siendo usada por la aplicación.

**Solución:**
1. Detené el servidor de desarrollo (`Ctrl+C`)
2. Abrí la base de datos en DB Browser
3. Hacé tus cambios
4. Cerrá DB Browser
5. Reiniciá el servidor (`npm run dev`)

### "File is not a database"
**Problema:** El archivo está corrupto o no es una base de datos SQLite.

**Solución:**
1. Verificá que el archivo tenga extensión `.db`
2. Intentá con otro backup
3. Si todos fallan, puede haber un problema con el sistema de backups

### No veo datos en las tablas
**Problema:** Puede que la tabla esté vacía o estés viendo el backup equivocado.

**Solución:**
1. Verificá que seleccionaste la tabla correcta
2. Ejecutá: `SELECT COUNT(*) FROM nombre_tabla;` para ver si hay datos
3. Verificá que abriste el backup correcto (mirá la fecha en el nombre)

---

## Recursos Adicionales

### Documentación Oficial
- DB Browser: https://sqlitebrowser.org/
- SQLite SQL: https://www.sqlite.org/lang.html

### Archivos del Proyecto
- `BACKUPS.md` - Guía completa del sistema de backups
- `scripts/backup_db.sh` - Script para crear backups
- `scripts/restore_db.sh` - Script para restaurar backups

---

## Casos de Uso Comunes

### 1. Verificar Asistencias de un Empleado
```sql
SELECT 
 DATE(created_at) as fecha,
 type as tipo,
 TIME(created_at) as hora,
 location as lugar
FROM tasks 
WHERE user_id = (SELECT id FROM users WHERE email = 'empleado@example.com')
ORDER BY created_at DESC;
```

### 2. Ver Tickets Pendientes
```sql
SELECT 
 t.id,
 t.title,
 t.priority,
 u.name as creado_por,
 t.created_at
FROM tickets t
JOIN users u ON t.user_id = u.id
WHERE t.status = 'open'
ORDER BY t.priority DESC, t.created_at ASC;
```

### 3. Estadísticas Generales
```sql
SELECT 
 (SELECT COUNT(*) FROM users) as total_usuarios,
 (SELECT COUNT(*) FROM tickets) as total_tickets,
 (SELECT COUNT(*) FROM tasks WHERE type = 'check_in') as total_ingresos,
 (SELECT COUNT(*) FROM logbook_entries) as total_reportes_bitacora;
```

---

**Última actualización:** 17 de Febrero 2026 
**Versión:** 1.0
