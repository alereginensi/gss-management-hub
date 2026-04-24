# Workers de cron en Railway

El servicio web principal (`gss-management-hub`) **no ejecuta crons**. Los procesos de tareas programadas corren como **servicios separados** dentro del mismo proyecto de Railway, cada uno con su propio contenedor y deploy. Eso evita que un cron con picos de CPU/RAM afecte el servicio web y permite reiniciarlos por separado.

Cada worker se despliega desde el **mismo repo** (mismo Dockerfile), pero arranca con un **Start Command** distinto que apunta al script del cron.

---

## Workers activos

| Servicio | Script | Schedule (America/Montevideo) | Rol |
|---|---|---|---|
| `mitrabajo-worker` | [scripts/cron-mitrabajo.cjs](../scripts/cron-mitrabajo.cjs) | `0 8 * * *` — diario 08:00 | Descarga Excel supervisor de mitrabajo.uy con Playwright |
| `agenda-worker` | [scripts/cron-agenda.cjs](../scripts/cron-agenda.cjs) | `0 9 28 * *` (slots) + `0 2 * * *` (renovaciones) | Llama endpoints `/api/internal/agenda-cron/*` del servicio principal |

Ambos exponen `GET /api/health` en `PORT` para el health check de Railway.

### Arquitectura de `agenda-worker`

El worker de agenda **no accede a la base de datos directamente** — es un proceso ligero que solo hace `node-cron` + `fetch()` a endpoints protegidos del servicio principal:

- `POST /api/internal/agenda-cron/generate-slots` — genera slots del mes siguiente.
- `POST /api/internal/agenda-cron/sync-renewals` — re-habilita empleados con uniformes vencidos.

Ambos protegidos con header `X-Cron-Secret: ${CRON_SECRET}`. Esto evita duplicar la lógica SQL del servicio principal en el worker y mantiene un solo lugar donde evolucionar la query.

---

## Crear `agenda-worker` desde cero en Railway

### 1. Generar `CRON_SECRET` (una vez)

En una terminal:
```
openssl rand -base64 32
```
Copiá el valor — lo vas a usar en 2 servicios (principal y worker).

### 2. Agregar la variable al servicio principal (`gss-management-hub`)

En el dashboard de Railway → servicio principal → **Variables** → añadir:
- `CRON_SECRET` = `<el valor generado>`

Hacé redeploy del servicio principal para que tome la variable. Los endpoints `/api/internal/agenda-cron/*` devuelven 401 sin este header correcto.

### 3. Crear el servicio worker

1. **Project → + New → GitHub Repo** → elegir `GSS-IT/gss-management-hub` (mismo repo del servicio web).
2. Rename service → `agenda-worker` (Settings → General → Service Name).
3. **Settings → Deploy → Start Command**:
   ```
   npm run agenda:cron
   ```
4. **Settings → Deploy → Healthcheck Path**: `/api/health` (timeout 30s, como el principal).
5. **Settings → Deploy → Restart Policy**: `ON_FAILURE`, max 5.
6. **Settings → Networking**: no hace falta exponer dominio público — el worker solo llama al principal por red privada.
7. **Variables**:
   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `CRON_SECRET` | mismo valor que en el servicio principal |
   | `INTERNAL_APP_URL` | `http://${{gss-management-hub.RAILWAY_PRIVATE_DOMAIN}}:3000` |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` *(opcional — el worker no la usa directamente pero el contenedor la levanta igual por el Dockerfile)* |

   > `RAILWAY_PRIVATE_DOMAIN` es la URL interna del servicio principal (ej. `gss-management-hub.railway.internal`). Railway resuelve la referencia automáticamente.
8. **Deploy**. Revisar logs — debería aparecer:
   ```
   [cron-agenda] Iniciado.
   [cron-agenda]   INTERNAL_APP_URL: http://gss-management-hub.railway.internal:3000
   [cron-agenda]   slots:       0 9 28 * * (día 28, 09:00 America/Montevideo)
   [cron-agenda]   renovaciones: 0 2 * * * (diario, 02:00 America/Montevideo)
   [cron-agenda] Health check server escuchando en puerto 3000
   ```

---

## Verificar que el cron está vivo

Desde Railway dashboard, tab **Logs** del worker:

- Al arrancar: `[cron-agenda] Iniciado.` y los 2 schedules impresos.
- Diario 02:00 (UY): `[cron-agenda] ... sync renovaciones: N empleado(s) habilitado(s).`
- Día 28, 09:00 (UY): `[cron-agenda] Mes 2026-MM: creados=N, omitidos=N`.

Si ves `ERROR: INTERNAL_APP_URL no está definido` o `CRON_SECRET no está definido` → revisá las variables del worker.

Si ves `HTTP 401` → el `CRON_SECRET` del worker y del servicio principal no coinciden.

---

## Ejecución manual (sin esperar al cron)

Podés disparar los jobs a mano con un POST directo, con el mismo header:

```bash
curl -X POST \
  -H "X-Cron-Secret: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"year":2026,"month":5}' \
  https://<dominio-publico>/api/internal/agenda-cron/generate-slots

curl -X POST \
  -H "X-Cron-Secret: $CRON_SECRET" \
  https://<dominio-publico>/api/internal/agenda-cron/sync-renewals
```

O desde el propio worker si ya está deployado, vía Railway CLI:
```
railway run --service agenda-worker node scripts/cron-agenda.cjs --manual 2026-05
```
