# Workers de cron en Railway

El servicio web principal (`gss-management-hub`) **no ejecuta crons**. Los procesos de tareas programadas corren como **servicios separados** dentro del mismo proyecto de Railway, cada uno con su propio contenedor y deploy. Eso evita que un cron con picos de CPU/RAM (p. ej. Playwright+Chromium en Mitrabajo) afecte el servicio web, y permite reiniciar cada worker de forma independiente.

Cada worker se despliega desde el **mismo repo**, pero arranca con un `start command` distinto que apunta al script del cron.

---

## Workers activos

| Servicio | Script | Schedule (America/Montevideo) | Motivo |
|---|---|---|---|
| `mitrabajo-worker` | [scripts/cron-mitrabajo.cjs](../scripts/cron-mitrabajo.cjs) | `0 8 * * *` — diario 08:00 | Descarga Excel supervisor de mitrabajo.uy con Playwright |
| `agenda-worker` | [scripts/cron-agenda.cjs](../scripts/cron-agenda.cjs) | `0 9 28 * *` (slots) + `0 2 * * *` (renovaciones) | Genera slots del mes siguiente y re-habilita empleados con uniformes vencidos |

Ambos exponen `GET /api/health` en `PORT` para satisfacer el health check de Railway.

---

## Crear un worker desde cero

Pasos en el **dashboard de Railway** para agregar un nuevo worker al proyecto (usar estos para `agenda-worker`):

1. **Project → + New → GitHub Repo**. Elegir `GSS-IT/gss-management-hub` (el mismo repo del servicio web).
2. Renombrar el servicio a `agenda-worker` (Settings → General → Service Name).
3. **Settings → Deploy → Start Command**: setear a
   ```
   npm run agenda:cron
   ```
   (o `node scripts/cron-agenda.cjs` directo). El build por defecto de Nixpacks/Dockerfile sigue funcionando — solo cambiamos el comando final.
4. **Settings → Networking → Generate Domain** (opcional): solo necesario si querés acceder al health check desde fuera. Por default Railway corre el health check internamente.
5. **Settings → Deploy → Healthcheck Path**: `/api/health`. Timeout 30s (igual que el principal).
6. **Variables**: copiar las que el worker necesite desde el servicio principal:
   - `DATABASE_URL` (o referenciar con `${{Postgres.DATABASE_URL}}` si usan variable shared en Railway).
   - `JWT_SECRET`, `NODE_ENV=production`.
   - Variables específicas del cron: para `agenda-worker` ninguna extra; para `mitrabajo-worker` van `MITRABAJO_USER`, `MITRABAJO_PASS`, SMTP, etc.
7. **Settings → Deploy → Restart Policy**: `ON_FAILURE`, max 5.
8. **Deploy**. Revisar logs — debería ver `[cron-agenda] Iniciado.` + `Health check server escuchando en puerto 3000`.

---

## Verificar que el cron está vivo

Desde Railway dashboard, tab **Logs** del worker:

- Al arrancar: `[cron-agenda] Iniciado.` y las líneas con los schedules impresos.
- Diario 02:00 (America/Montevideo): `[cron-agenda] ... sync renovaciones: N empleados habilitados por vencimiento.`
- Día 28, 09:00: `[cron-agenda] Mes 2026-MM: creados=N, omitidos=N`.

Si no aparece el mensaje de "Iniciado" → el contenedor no arrancó bien (revisar variables de entorno, especialmente `DATABASE_URL`).

---

## Ejecución manual (sin esperar al cron)

Desde la máquina local con `DATABASE_URL` apuntando a producción:

```bash
# Generar slots de un mes puntual (ej: mayo 2026)
npm run agenda:slots -- --manual 2026-05

# Correr solo el sync de renovaciones (re-habilita empleados con uniformes vencidos)
node scripts/cron-agenda.cjs --sync-renewals
```

Ambos comandos corren una vez y terminan (no quedan escuchando). Útiles si hay que regenerar un mes específico o ejecutar urgentemente por primera vez después de crear el worker.
