/**
 * Migra los valores guardados en agenda_uniform_catalog.puesto hacia
 * agenda_uniform_catalog.workplace_category (cuando la categoría está vacía).
 *
 * Motivo: la columna del UI pasó a llamarse "Categoría" y el filtro del flujo
 * público del empleado se hace por workplace_category.
 *
 * Uso:
 *   node scripts/migrate-catalog-puesto-to-category.cjs
 *   DRY_RUN=1 node scripts/migrate-catalog-puesto-to-category.cjs
 *
 * Requiere DATABASE_URL (o POSTGRES_URL / DATABASE_PUBLIC_URL) en .env.local.
 * Si no hay DATABASE_URL, usa SQLite local ./tickets.db.
 */

const path = require('path');
const fs = require('fs');

const root = path.resolve(process.cwd());
require('dotenv').config({ path: path.join(root, '.env.local') });
require('dotenv').config({ path: path.join(root, '.env') });

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

function pickDatabaseUrl() {
  for (const k of ['DATABASE_URL', 'POSTGRES_URL', 'DATABASE_PUBLIC_URL']) {
    const v = String(process.env[k] || '').trim();
    if (v) return v;
  }
  return '';
}

async function migratePostgres(dbUrl) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    const candidates = await client.query(
      `SELECT id, empresa, article_type, puesto, workplace_category
       FROM agenda_uniform_catalog
       WHERE puesto IS NOT NULL AND puesto <> ''
         AND (workplace_category IS NULL OR workplace_category = '')`
    );
    console.log(`→ Filas a migrar: ${candidates.rowCount}`);
    if (candidates.rowCount === 0) {
      console.log('Nada que migrar.');
      return;
    }
    candidates.rows.slice(0, 10).forEach(r => {
      console.log(`   #${r.id} ${r.empresa} · ${r.article_type} · puesto="${r.puesto}"`);
    });
    if (candidates.rowCount > 10) console.log(`   ... (+${candidates.rowCount - 10})`);

    if (DRY_RUN) {
      console.log('(DRY_RUN) No se escribe nada.');
      return;
    }

    await client.query('BEGIN');
    const upd = await client.query(
      `UPDATE agenda_uniform_catalog
         SET workplace_category = puesto
       WHERE puesto IS NOT NULL AND puesto <> ''
         AND (workplace_category IS NULL OR workplace_category = '')`
    );
    const clr = await client.query(
      `UPDATE agenda_uniform_catalog
         SET puesto = NULL
       WHERE puesto IS NOT NULL AND puesto <> ''
         AND workplace_category = puesto`
    );
    await client.query('COMMIT');
    console.log(`→ workplace_category actualizado en ${upd.rowCount} filas.`);
    console.log(`→ puesto limpiado en ${clr.rowCount} filas.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

function migrateSqlite() {
  const Database = require('better-sqlite3');
  const dbPath = path.join(root, 'tickets.db');
  if (!fs.existsSync(dbPath)) throw new Error(`No existe SQLite local en ${dbPath}`);
  const db = new Database(dbPath);
  const rows = db.prepare(
    `SELECT id, empresa, article_type, puesto, workplace_category
     FROM agenda_uniform_catalog
     WHERE puesto IS NOT NULL AND puesto <> ''
       AND (workplace_category IS NULL OR workplace_category = '')`
  ).all();
  console.log(`→ Filas a migrar: ${rows.length}`);
  if (rows.length === 0) { db.close(); return; }

  if (DRY_RUN) {
    rows.slice(0, 10).forEach(r => console.log(`   #${r.id} ${r.empresa} · ${r.article_type} · puesto="${r.puesto}"`));
    console.log('(DRY_RUN) No se escribe nada.');
    db.close();
    return;
  }

  const tx = db.transaction(() => {
    const upd = db.prepare(
      `UPDATE agenda_uniform_catalog
         SET workplace_category = puesto
       WHERE puesto IS NOT NULL AND puesto <> ''
         AND (workplace_category IS NULL OR workplace_category = '')`
    ).run();
    const clr = db.prepare(
      `UPDATE agenda_uniform_catalog
         SET puesto = NULL
       WHERE puesto IS NOT NULL AND puesto <> ''
         AND workplace_category = puesto`
    ).run();
    console.log(`→ workplace_category actualizado en ${upd.changes} filas.`);
    console.log(`→ puesto limpiado en ${clr.changes} filas.`);
  });
  tx();
  db.close();
}

async function main() {
  const dbUrl = pickDatabaseUrl();
  if (dbUrl) {
    console.log(`🗄  Conectando a PostgreSQL (${dbUrl.replace(/:[^:@]+@/, ':***@')})`);
    await migratePostgres(dbUrl);
  } else {
    console.log('🗄  Sin DATABASE_URL → usando SQLite local (tickets.db)');
    migrateSqlite();
  }
  console.log('✅ Listo.');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
