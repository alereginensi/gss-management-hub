# Sistema de Backups Automáticos - GSS Management Hub

Este sistema crea copias de seguridad diarias de la base de datos y permite restaurar cualquier versión anterior.

## Archivos del Sistema

- **`backup_db.sh`**: Crea backups diarios
- **`restore_db.sh`**: Restaura desde un backup anterior
- **`cleanup_old_backups.sh`**: Limpia backups antiguos

## Uso

### Crear un Backup Manual

```bash
cd /ruta/a/gss-management-hub
./scripts/backup_db.sh
```

Esto creará un archivo en `backups/tickets_YYYYMMDD_HHMMSS.db`

### Restaurar desde un Backup

```bash
./scripts/restore_db.sh
```

El script te mostrará una lista de backups disponibles:
```
Available backups:

[0] 2026-02-17 14:30:00 (Size: 2.3M)
[1] 2026-02-16 02:00:00 (Size: 2.1M)
[2] 2026-02-15 02:00:00 (Size: 2.0M)

Enter backup number to restore (or 'q' to quit):
```

Seleccioná el número del backup que querés restaurar y confirmá.

**IMPORTANTE**: Después de restaurar, reiniciá la aplicación:
```bash
docker-compose restart
# o si estás en desarrollo local:
# Ctrl+C y luego npm run dev
```

### Limpiar Backups Antiguos

```bash
./scripts/cleanup_old_backups.sh
```

Esto mantiene:
- Últimos 30 backups diarios
- 1 backup por mes para backups más antiguos

## Configuración Automática (Producción)

### En Linux/VPS

1. Hacé los scripts ejecutables:
```bash
chmod +x scripts/*.sh
```

2. Configurá el cron para backups automáticos:
```bash
crontab -e
```

3. Agregá estas líneas:
```bash
# Backup diario a las 2 AM
0 2 * * * cd /ruta/a/gss-management-hub && ./scripts/backup_db.sh

# Limpieza semanal (domingos a las 3 AM)
0 3 * * 0 cd /ruta/a/gss-management-hub && ./scripts/cleanup_old_backups.sh
```

### En Windows (Desarrollo Local)

Usá el Programador de Tareas de Windows o ejecutá manualmente cuando necesites.

Para ejecutar en Windows, usá Git Bash o WSL:
```bash
bash scripts/backup_db.sh
```

## Logs

Todos los backups y restauraciones se registran en:
```
backups/backup.log
```

Podés ver el historial con:
```bash
cat backups/backup.log
```

## Seguridad

- Los backups **NO se suben a GitHub** (están en `.gitignore`)
- Cada restauración crea un backup de seguridad automático
- Los logs registran todas las operaciones

## Espacio en Disco

Cada backup ocupa aproximadamente el mismo tamaño que `tickets.db` (típicamente 1-5 MB).

Con la política de retención:
- 30 días × ~2 MB = ~60 MB
- 12 meses × ~2 MB = ~24 MB
- **Total estimado: ~100 MB**

## Preguntas Frecuentes

**¿Puedo restaurar un backup de hace 2 meses?**
Sí, siempre que no hayas ejecutado el script de limpieza o que ese mes tenga un backup mensual guardado.

**¿Qué pasa si restauro un backup viejo?**
Perdés todos los datos creados después de esa fecha. Por eso el script crea un backup de seguridad antes de restaurar.

**¿Los backups afectan el rendimiento?**
No, el backup es una simple copia de archivo que toma menos de 1 segundo.

**¿Puedo descargar los backups a mi PC?**
Sí, usá SFTP (FileZilla, WinSCP) para descargar la carpeta `backups/` completa.
