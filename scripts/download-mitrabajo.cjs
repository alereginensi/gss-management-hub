'use strict';
/**
 * scripts/download-mitrabajo.cjs
 * CLI wrapper — usa la lógica de lib/mitrabajo-download.js
 *
 * Uso:
 *   node scripts/download-mitrabajo.cjs              → descarga ayer
 *   node scripts/download-mitrabajo.cjs 2026-04-08   → fecha específica
 *   node scripts/download-mitrabajo.cjs --debug       → browser visible
 */
const path = require('path');
const { downloadMitrabajo } = require(path.join(__dirname, '..', 'lib', 'mitrabajo-download'));

const targetDate = process.argv.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) || null;
const debug      = process.argv.includes('--debug');

downloadMitrabajo(targetDate, { debug }).catch(err => {
  console.error('[mitrabajo] ERROR:', err.message);
  process.exit(1);
});
