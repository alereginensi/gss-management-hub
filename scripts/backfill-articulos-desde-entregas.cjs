#!/usr/bin/env node
/**
 * scripts/backfill-articulos-desde-entregas.cjs
 *
 * Backfill de agenda_articles a partir de citas completadas (agenda_appointments.status='completada').
 * Útil para empleados que recibieron uniformes pero no quedaron registrados en el
 * historial de artículos (entregas cargadas sin create_articles=true).
 *
 * Dedup por (appointment_id, article_type, size) — si ya existe un article para esa
 * combinación, se saltea.
 *
 * Usa la misma lógica de cálculo que el endpoint de delivery:
 *   - useful_life_months: del item.useful_life_months si existe, sino 12
 *   - expiration_date: delivery_date + useful_life_months
 *   - renewal_enabled_at: delivery_date + round(useful_life_months * 0.8)
 *   - delivery_date: delivered_at si existe, sino slot.fecha de la cita
 *
 * Uso:
 *   node scripts/backfill-articulos-desde-entregas.cjs              # dry-run (default)
 *   node scripts/backfill-articulos-desde-entregas.cjs --apply      # escribe a DB
 *   node scripts/backfill-articulos-desde-entregas.cjs --employee=12345678  # solo un empleado por CI
 *
 * Variables de entorno requeridas:
 *   DATABASE_URL o DATABASE_PUBLIC_URL → Postgres de producción (usar URL pública desde tu PC)
 */

'use strict';

const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// ── Cargar .env.local si existe (para DATABASE_PUBLIC_URL local) ─────────────
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv();

// ── Parseo de flags ──────────────────────────────────────────────────────────
const APPLY = process.argv.includes('--apply');
const employeeArg = process.argv.find(a => a.startsWith('--employee='));
const employeeFilter = employeeArg ? employeeArg.split('=')[1] : null;

const DB_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('ERROR: setea DATABASE_PUBLIC_URL o DATABASE_URL en env.');
  process.exit(1);
}

// ── Helpers de fecha (replican lib/agenda-helpers.ts) ────────────────────────
function calculateExpirationDate(deliveryDate, usefulLifeMonths) {
  const date = new Date(deliveryDate);
  date.setMonth(date.getMonth() + usefulLifeMonths);
  return date.toISOString().split('T')[0];
}

function fmtDate(d) {
  if (!d) return '—';
  if (typeof d === 'string') return d.slice(0, 10);
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d);
}

// ── Parseo de items (delivered_order_items puede venir ya parseado en PG o string) ──
function parseItems(raw) {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return Array.isArray(raw) ? raw : [];
}

async function main() {
  const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

  console.log(`\n[backfill] modo: ${APPLY ? '🔥 APPLY (escribe a DB)' : '📋 DRY-RUN (no escribe)'}`);
  if (employeeFilter) console.log(`[backfill] filtro empleado CI: ${employeeFilter}`);

  try {
    // Query: citas completadas con sus items + datos empleado + fecha slot
    const whereEmployee = employeeFilter ? 'AND e.documento = $1' : '';
    const params = employeeFilter ? [employeeFilter] : [];
    const query = `
      SELECT a.id AS appointment_id,
             a.employee_id,
             a.delivered_order_items,
             a.delivered_at,
             e.nombre AS employee_nombre,
             e.documento AS employee_documento,
             e.empresa AS employee_empresa,
             s.fecha AS slot_fecha
      FROM agenda_appointments a
      JOIN agenda_employees e ON e.id = a.employee_id
      JOIN agenda_time_slots s ON s.id = a.time_slot_id
      WHERE a.status = 'completada'
        ${whereEmployee}
      ORDER BY a.delivered_at DESC NULLS LAST, a.id DESC
    `;
    const { rows: appointments } = await pool.query(query, params);
    console.log(`[backfill] citas completadas encontradas: ${appointments.length}`);

    let totalItems = 0;
    let toCreate = 0;
    let skipped = 0;
    let created = 0;
    const perEmployee = new Map();

    let citasSinItems = 0;
    for (const appt of appointments) {
      const items = parseItems(appt.delivered_order_items);
      const deliveryDate = appt.delivered_at
        ? fmtDate(appt.delivered_at)
        : fmtDate(appt.slot_fecha);

      if (!items.length) {
        citasSinItems++;
        console.log(`\n⊘ cita #${appt.appointment_id} · ${appt.employee_nombre} (CI ${appt.employee_documento}) · ${appt.employee_empresa || '—'} · entrega=${deliveryDate} — SIN ITEMS (raw=${appt.delivered_order_items === null ? 'null' : 'empty array'})`);
        continue;
      }

      console.log(`\n— cita #${appt.appointment_id} · ${appt.employee_nombre} (CI ${appt.employee_documento}) · ${appt.employee_empresa || '—'} · entrega=${deliveryDate}`);

      for (const item of items) {
        totalItems++;
        // Buscar article_type en varios campos posibles (estructuras legacy).
        // En agenda vieja el campo se llama "item" literalmente.
        const articleType = (
          item.article_type ||
          item.articleType ||
          item.item ||
          item.tipo ||
          item.prenda ||
          item.articulo ||
          item.type ||
          item.name ||
          ''
        ).toString().trim();
        if (!articleType) {
          console.log(`  ⚠ item sin article_type — JSON crudo: ${JSON.stringify(item)}`);
          continue;
        }
        const color = (item.color || '').toString().trim() || null;
        const size = (item.size || item.talle || item.talla || '').toString().trim() || null;
        const usefulLife = Number.isFinite(item.useful_life_months) ? item.useful_life_months : 12;
        const expirationDate = calculateExpirationDate(deliveryDate, usefulLife);
        const renewalEnabledAt = calculateExpirationDate(deliveryDate, Math.round(usefulLife * 0.8));

        // Dedup: ya existe article con mismo appointment_id + article_type + size?
        const { rows: existing } = await pool.query(
          `SELECT id FROM agenda_articles
           WHERE appointment_id = $1
             AND LOWER(TRIM(article_type)) = LOWER(TRIM($2))
             AND COALESCE(size, '') = COALESCE($3, '')
           LIMIT 1`,
          [appt.appointment_id, articleType, size || '']
        );

        if (existing.length > 0) {
          console.log(`  ✓ ${articleType}${size ? ` (${size})` : ''} — YA EXISTE (id=${existing[0].id}), skip`);
          skipped++;
          continue;
        }

        toCreate++;
        const key = `${appt.employee_nombre} (CI ${appt.employee_documento})`;
        perEmployee.set(key, (perEmployee.get(key) || 0) + 1);

        const notes = color
          ? `Backfill automatico desde citas completadas. Color: ${color}`
          : 'Backfill automatico desde citas completadas';

        if (APPLY) {
          await pool.query(
            `INSERT INTO agenda_articles
              (employee_id, appointment_id, article_type, size, delivery_date,
               useful_life_months, expiration_date, renewal_enabled_at,
               condition_status, origin_type, notes, migrated_flag, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'nuevo', 'entrega_inicial',
                     $9, 0, NULL)`,
            [appt.employee_id, appt.appointment_id, articleType, size,
             deliveryDate, usefulLife, expirationDate, renewalEnabledAt, notes]
          );
          created++;
          console.log(`  ✔ ${articleType}${size ? ` (${size})` : ''}${color ? ` · ${color}` : ''} — CREADO (vence ${expirationDate})`);
        } else {
          console.log(`  + ${articleType}${size ? ` (${size})` : ''}${color ? ` · ${color}` : ''} — CREARIA (vence ${expirationDate})`);
        }
      }
    }

    console.log('\n══════════════════════════════════════════');
    console.log(`[backfill] resumen`);
    console.log(`  citas procesadas: ${appointments.length}`);
    console.log(`  sin items:        ${citasSinItems}`);
    console.log(`  items totales:    ${totalItems}`);
    console.log(`  ya existen:       ${skipped}`);
    console.log(`  ${APPLY ? 'creados' : 'a crear'}:          ${APPLY ? created : toCreate}`);
    if (perEmployee.size > 0) {
      console.log(`\n[backfill] ${APPLY ? 'creados' : 'a crear'} por empleado:`);
      const sorted = [...perEmployee.entries()].sort((a, b) => b[1] - a[1]);
      for (const [name, count] of sorted) {
        console.log(`    ${count.toString().padStart(3)} — ${name}`);
      }
    }
    if (!APPLY && toCreate > 0) {
      console.log(`\n💡 para aplicar los cambios corré:`);
      console.log(`   node scripts/backfill-articulos-desde-entregas.cjs --apply${employeeFilter ? ` --employee=${employeeFilter}` : ''}`);
    }
    console.log('══════════════════════════════════════════\n');
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('[backfill] ERROR:', err.message);
  console.error(err);
  process.exit(1);
});
