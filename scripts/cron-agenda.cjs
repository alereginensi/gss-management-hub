/**
 * cron-agenda.cjs
 *
 * Worker ligero: dispara los jobs de agenda-web vía HTTP al servicio principal.
 * No duplica lógica SQL — sólo schedule + fetch. Esto evita tener que compilar
 * TypeScript del servicio principal dentro de la imagen del worker.
 *
 * Uso:
 *   node scripts/cron-agenda.cjs                       # modo cron (worker persistente)
 *   node scripts/cron-agenda.cjs --manual 2026-05      # genera mes específico y sale
 *   node scripts/cron-agenda.cjs --sync-renewals       # sync de renovaciones y sale
 *
 * Env vars requeridas:
 *   INTERNAL_APP_URL   URL del servicio principal (ej: http://gss-management-hub.railway.internal:3000)
 *   CRON_SECRET        Shared secret para autorizar las llamadas (el endpoint valida el header).
 *
 * En producción (Railway) se corre como worker service separado. Expone
 * /api/health para el health check del propio worker.
 */

'use strict';

const cron = require('node-cron');
const http = require('http');

const args = process.argv.slice(2);
const manualIdx = args.indexOf('--manual');
const manualTarget = manualIdx !== -1 ? args[manualIdx + 1] : null;

function getConfig() {
  const base = (process.env.INTERNAL_APP_URL || '').replace(/\/$/, '');
  const secret = process.env.CRON_SECRET || '';
  if (!base) {
    throw new Error('INTERNAL_APP_URL no está definido — apunta al servicio principal (p.ej. ${{gss-management-hub.RAILWAY_PRIVATE_DOMAIN}}:3000 con http://).');
  }
  if (!secret) {
    throw new Error('CRON_SECRET no está definido — debe coincidir con la variable del servicio principal.');
  }
  return { base, secret };
}

async function callInternal(path, body) {
  const { base, secret } = getConfig();
  const url = `${base}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Cron-Secret': secret,
    },
    body: JSON.stringify(body || {}),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`POST ${path} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function syncRenewals() {
  const now = new Date().toISOString();
  try {
    const data = await callInternal('/api/internal/agenda-cron/sync-renewals', {});
    console.log(`[cron-agenda] ${now} — sync renovaciones: ${data.habilitados ?? 0} empleado(s) habilitado(s).`);
  } catch (err) {
    console.error(`[cron-agenda] ${now} — ERROR sync renovaciones:`, err.message || err);
  }
}

async function generateSlots(yearMonth) {
  const now = new Date().toISOString();
  let year, month;
  if (yearMonth) {
    const parts = yearMonth.split('-');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
  } else {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    year = next.getFullYear();
    month = next.getMonth() + 1;
  }
  console.log(`[cron-agenda] ${now} — Generando slots para ${year}-${String(month).padStart(2, '0')}...`);
  try {
    const data = await callInternal('/api/internal/agenda-cron/generate-slots', { year, month });
    console.log(`[cron-agenda] Mes ${year}-${String(month).padStart(2, '0')}: creados=${data.created ?? 0}, omitidos=${data.skipped ?? 0}`);
  } catch (err) {
    console.error(`[cron-agenda] ERROR al generar slots:`, err.message || err);
  }
}

// ── Modos one-shot ───────────────────────────────────────────────────────────

if (manualTarget) {
  (async () => {
    await syncRenewals();
    await generateSlots(manualTarget);
    process.exit(0);
  })();
} else if (args.includes('--sync-renewals')) {
  syncRenewals().then(() => process.exit(0));
} else {
  // ── Modo cron ─────────────────────────────────────────────────────────────
  // - Generación de slots: día 28 de cada mes a las 09:00 (America/Montevideo)
  // - Sync de renovaciones: todos los días a las 02:00 (America/Montevideo)
  const SLOTS_SCHEDULE = '0 9 28 * *';
  const RENEWAL_SCHEDULE = '0 2 * * *';

  console.log(`[cron-agenda] Iniciado.`);
  console.log(`[cron-agenda]   INTERNAL_APP_URL: ${process.env.INTERNAL_APP_URL || '(no set)'}`);
  console.log(`[cron-agenda]   slots:       ${SLOTS_SCHEDULE} (día 28, 09:00 America/Montevideo)`);
  console.log(`[cron-agenda]   renovaciones: ${RENEWAL_SCHEDULE} (diario, 02:00 America/Montevideo)`);

  cron.schedule(SLOTS_SCHEDULE, () => generateSlots(null), { timezone: 'America/Montevideo' });
  cron.schedule(RENEWAL_SCHEDULE, () => syncRenewals(), { timezone: 'America/Montevideo' });

  // Mini HTTP server para health check de Railway.
  const PORT = process.env.PORT || 3000;
  http.createServer((req, res) => {
    if (req.url === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'agenda-cron', ts: new Date().toISOString() }));
    } else {
      res.writeHead(404);
      res.end();
    }
  }).listen(PORT, () => {
    console.log(`[cron-agenda] Health check server escuchando en puerto ${PORT}`);
  });

  process.on('SIGINT', () => {
    console.log('[cron-agenda] SIGINT recibido — cerrando.');
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    console.log('[cron-agenda] SIGTERM recibido — cerrando.');
    process.exit(0);
  });
}
