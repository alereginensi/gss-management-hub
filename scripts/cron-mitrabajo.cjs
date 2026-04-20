/**
 * cron-mitrabajo.cjs
 *
 * Proceso Node.js persistente que ejecuta la descarga de mitrabajo.uy
 * automáticamente cada día a las 06:00 AM (hora de Uruguay, UTC-3).
 *
 * Uso:
 *   node scripts/cron-mitrabajo.cjs
 *
 * En producción (Railway): agregar como proceso separado en railway.toml
 * o ejecutar con: node scripts/cron-mitrabajo.cjs &
 */

'use strict';

const cron = require('node-cron');
const { execFile } = require('child_process');
const http = require('http');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, 'download-mitrabajo.cjs');

// 08:00 AM hora Uruguay (America/Montevideo, UTC-3 / UTC-2 en verano)
// node-cron soporta timezone nativo, no hace falta convertir a UTC manualmente
const CRON_SCHEDULE = '0 8 * * *';

function runDownload() {
  const now = new Date().toISOString();
  console.log(`[cron-mitrabajo] ${now} — Iniciando descarga automática...`);

  execFile('node', [SCRIPT_PATH], { env: process.env }, (error, stdout, stderr) => {
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    if (error) {
      console.error(`[cron-mitrabajo] ERROR en descarga:`, error.message);
    } else {
      console.log(`[cron-mitrabajo] Descarga completada exitosamente.`);
    }
  });
}

// Servidor HTTP mínimo para Railway health check (comparte railway.toml con el servicio web)
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'mitrabajo-cron', ts: new Date().toISOString() }));
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(PORT, () => {
  console.log(`[cron-mitrabajo] Health check server escuchando en puerto ${PORT}`);
});

console.log(`[cron-mitrabajo] Servicio iniciado. Descarga diaria a las 08:00 AM (America/Montevideo).`);
console.log(`[cron-mitrabajo] Schedule: "${CRON_SCHEDULE}" timezone America/Montevideo`);

// Ejecutar según el schedule
cron.schedule(CRON_SCHEDULE, runDownload, {
  timezone: 'America/Montevideo',
  scheduled: true,
});

// Mantener el proceso vivo
process.on('SIGINT', () => {
  console.log('[cron-mitrabajo] Detenido por SIGINT.');
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.log('[cron-mitrabajo] Detenido por SIGTERM.');
  process.exit(0);
});
