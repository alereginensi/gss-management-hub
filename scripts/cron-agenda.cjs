/**
 * cron-agenda.cjs
 *
 * Auto-generación mensual de slots para el módulo Agenda Web de Uniformes.
 * Se ejecuta el día 28 de cada mes a las 09:00 (genera el mes siguiente).
 *
 * Uso:
 *   node scripts/cron-agenda.cjs
 *   node scripts/cron-agenda.cjs --manual 2025-08    # genera mes específico sin esperar cron
 *
 * En producción: agregar al script "start" junto a next start y cron-mitrabajo.
 */

'use strict';

const cron = require('node-cron');
const path = require('path');

// Detectar modo manual: node cron-agenda.cjs --manual 2025-08
const args = process.argv.slice(2);
const manualIdx = args.indexOf('--manual');
const manualTarget = manualIdx !== -1 ? args[manualIdx + 1] : null;

async function syncRenewals() {
  const now = new Date().toISOString();
  try {
    const { syncEmployeeRenewalStatus } = await import('../lib/agenda-helpers.js');
    const count = await syncEmployeeRenewalStatus();
    console.log(`[cron-agenda] ${now} — sync renovaciones: ${count} empleado${count !== 1 ? 's' : ''} habilitado${count !== 1 ? 's' : ''} por vencimiento.`);
  } catch (err) {
    console.error('[cron-agenda] ERROR al sync renovaciones:', err.message || err);
  }
}

async function generateSlots(yearMonth) {
  const now = new Date().toISOString();
  console.log(`[cron-agenda] ${now} — Generando slots para ${yearMonth || 'próximo mes'}...`);

  try {
    // Importar dinámicamente para compatibilidad con CJS
    const { default: db } = await import('../lib/db.js');
    const { generateSlotsForMonth } = await import('../lib/agenda-helpers.js');

    // Leer config
    const config = await db.get('SELECT * FROM agenda_config WHERE id = 1');
    const numSlots    = config?.slots_per_day ?? 20;
    const startHour   = config?.start_hour    ?? '09:00';
    const endHour     = config?.end_hour      ?? '17:00';
    const hasBreak    = !!(config?.break_start && config?.break_end);
    const breakStart  = config?.break_start   ?? '12:00';
    const breakEnd    = config?.break_end     ?? '13:00';

    // Mes objetivo: el siguiente mes, o el especificado en --manual
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

    const result = await generateSlotsForMonth({
      year,
      month,
      days_of_week: [2, 4], // Martes y Jueves por defecto
      start_hour: startHour,
      end_hour: endHour,
      num_slots: numSlots,
      has_break: hasBreak,
      break_start: breakStart,
      break_end: breakEnd,
      capacity: 1,
    });

    console.log(`[cron-agenda] Mes ${year}-${String(month).padStart(2, '0')}: creados=${result.created}, omitidos=${result.skipped}`);
  } catch (err) {
    console.error('[cron-agenda] ERROR al generar slots:', err.message || err);
    process.exit(1);
  }
}

// ── Modo manual ──────────────────────────────────────────────────────────────

if (manualTarget) {
  (async () => {
    await syncRenewals();
    await generateSlots(manualTarget);
    process.exit(0);
  })();
} else if (args.includes('--sync-renewals')) {
  syncRenewals().then(() => process.exit(0));
} else {
  // ── Modo cron ───────────────────────────────────────────────────────────────
  // - Generación de slots: día 28 de cada mes a las 09:00
  // - Sync de renovaciones: todos los días a las 02:00 (marca allow_reorder=1
  //   en empleados con artículos vencidos)
  const SLOTS_SCHEDULE = '0 9 28 * *';
  const RENEWAL_SCHEDULE = '0 2 * * *';

  console.log(`[cron-agenda] Iniciado.`);
  console.log(`[cron-agenda]   slots:       ${SLOTS_SCHEDULE} (día 28, 09:00)`);
  console.log(`[cron-agenda]   renovaciones: ${RENEWAL_SCHEDULE} (diario, 02:00)`);

  cron.schedule(SLOTS_SCHEDULE, () => generateSlots(null), { timezone: 'America/Montevideo' });
  cron.schedule(RENEWAL_SCHEDULE, () => syncRenewals(), { timezone: 'America/Montevideo' });

  // Mantener proceso vivo
  process.on('SIGTERM', () => {
    console.log('[cron-agenda] SIGTERM recibido — cerrando.');
    process.exit(0);
  });
}
