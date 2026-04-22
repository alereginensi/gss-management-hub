#!/usr/bin/env node
/**
 * scripts/test-vencer-articulos-empleado.cjs
 *
 * Script de TESTING: cambia las fechas de vencimiento de los artículos activos
 * de un empleado a fecha pasada para probar el flujo de renovación automática.
 *
 * Uso:
 *   node scripts/test-vencer-articulos-empleado.cjs --nombre=prueba
 *   node scripts/test-vencer-articulos-empleado.cjs --documento=12345678
 *   node scripts/test-vencer-articulos-empleado.cjs --nombre=prueba --apply
 *   node scripts/test-vencer-articulos-empleado.cjs --documento=12345678 --apply --dias=30
 *
 * Flags:
 *   --nombre=<texto>    : busca empleados cuyo nombre contenga el texto (case insensitive)
 *   --documento=<CI>    : busca por CI exacto
 *   --dias=<n>          : cuánto hace que vencieron (default: 1 = ayer)
 *   --apply             : aplica los cambios (sin esto es dry-run)
 */

'use strict';

const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

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

const APPLY = process.argv.includes('--apply');
const nombreArg = process.argv.find(a => a.startsWith('--nombre='));
const documentoArg = process.argv.find(a => a.startsWith('--documento='));
const diasArg = process.argv.find(a => a.startsWith('--dias='));
const nombreFiltro = nombreArg ? nombreArg.split('=')[1] : null;
const docFiltro = documentoArg ? documentoArg.split('=')[1] : null;
const diasAtras = diasArg ? parseInt(diasArg.split('=')[1], 10) : 1;

if (!nombreFiltro && !docFiltro) {
  console.error('ERROR: pasá --nombre=<texto> o --documento=<CI>');
  process.exit(1);
}

const DB_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('ERROR: setea DATABASE_PUBLIC_URL o DATABASE_URL en env.');
  process.exit(1);
}

function fechaHace(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

  const nuevaExpiration = fechaHace(diasAtras);
  console.log(`\n[test-vencer] modo: ${APPLY ? '🔥 APPLY' : '📋 DRY-RUN'}`);
  console.log(`[test-vencer] nueva expiration_date: ${nuevaExpiration} (hace ${diasAtras} dia${diasAtras !== 1 ? 's' : ''})`);
  console.log(`[test-vencer] filtro: ${nombreFiltro ? `nombre~${nombreFiltro}` : `documento=${docFiltro}`}\n`);

  try {
    const empQuery = docFiltro
      ? `SELECT id, documento, nombre, empresa, enabled, allow_reorder, estado FROM agenda_employees WHERE documento = $1`
      : `SELECT id, documento, nombre, empresa, enabled, allow_reorder, estado FROM agenda_employees WHERE LOWER(nombre) LIKE $1 ORDER BY nombre LIMIT 10`;
    const empParams = docFiltro ? [docFiltro] : [`%${nombreFiltro.toLowerCase()}%`];
    const { rows: empleados } = await pool.query(empQuery, empParams);

    if (empleados.length === 0) {
      console.log('[test-vencer] no se encontraron empleados.');
      return;
    }

    if (empleados.length > 1) {
      console.log(`[test-vencer] ${empleados.length} empleados coinciden, mostrando todos:`);
      for (const e of empleados) {
        console.log(`  - ${e.nombre} (CI ${e.documento}) · ${e.empresa || '—'} · enabled=${e.enabled} allow_reorder=${e.allow_reorder}`);
      }
      console.log('\n[test-vencer] pasá un --documento=<CI> específico para evitar ambigüedad.');
      return;
    }

    const emp = empleados[0];
    console.log(`[test-vencer] empleado: ${emp.nombre} (CI ${emp.documento})`);
    console.log(`   estado actual: enabled=${emp.enabled} allow_reorder=${emp.allow_reorder} estado=${emp.estado}\n`);

    const { rows: articles } = await pool.query(
      `SELECT id, article_type, size, delivery_date, expiration_date, current_status
       FROM agenda_articles
       WHERE employee_id = $1 AND current_status = 'activo'
       ORDER BY id`,
      [emp.id]
    );

    if (articles.length === 0) {
      console.log('[test-vencer] el empleado no tiene artículos activos. Completá una entrega primero.');
      return;
    }

    console.log(`[test-vencer] artículos activos (${articles.length}):`);
    for (const a of articles) {
      const expiraCur = a.expiration_date || '—';
      console.log(`  id=${a.id} · ${a.article_type}${a.size ? ` (${a.size})` : ''} · vence ${expiraCur} → ${nuevaExpiration}`);
    }

    if (!APPLY) {
      console.log(`\n💡 para aplicar:`);
      console.log(`   node scripts/test-vencer-articulos-empleado.cjs --documento=${emp.documento} --apply${diasArg ? ` --dias=${diasAtras}` : ''}`);
      return;
    }

    // Resetear allow_reorder a 0 para ver si el sistema lo habilita automáticamente al consultar
    await pool.query(
      `UPDATE agenda_employees SET allow_reorder = 0 WHERE id = $1`,
      [emp.id]
    );

    // Bajar expiration_date de todos los artículos activos
    const ids = articles.map(a => a.id);
    const res = await pool.query(
      `UPDATE agenda_articles SET expiration_date = $1, renewal_enabled_at = $1 WHERE id = ANY($2::int[])`,
      [nuevaExpiration, ids]
    );

    console.log(`\n✔ actualizados ${res.rowCount} artículos.`);
    console.log(`✔ allow_reorder del empleado reseteado a 0 (para testear que se auto-habilite al consultar).`);
    console.log(`\nProbá ahora:`);
    console.log(`   1. Entrá a /logistica/agenda con CI ${emp.documento}`);
    console.log(`   2. El empleado debe quedar habilitado automáticamente (allow_reorder=1)`);
    console.log(`   3. En el paso "Prendas" debe salir el banner naranja "Tenés que renovar..."`);
    console.log(`   4. El catálogo debe mostrar SOLO las prendas vencidas.\n`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('[test-vencer] ERROR:', err.message);
  console.error(err);
  process.exit(1);
});
