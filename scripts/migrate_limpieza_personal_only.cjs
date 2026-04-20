/**
 * Migra SOLO la tabla limpieza_usuarios desde SQLite local (tickets.db) hacia PostgreSQL (Railway).
 *
 * NO elimina ni modifica logbook, logbook_columns, users, tickets, ni ninguna otra tabla.
 *
 * Uso (desde la raíz del proyecto, con DATABASE_URL de producción en .env.local):
 * node scripts/migrate_limpieza_personal_only.cjs
 *
 * Simulación sin escribir:
 * DRY_RUN=1 node scripts/migrate_limpieza_personal_only.cjs
 *
 * Windows PowerShell simulación:
 * $env:DRY_RUN="1"; node scripts/migrate_limpieza_personal_only.cjs
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { Pool } = require('pg');

const root = path.resolve(process.cwd());
const envLocal = path.join(root, '.env.local');
const envFile = path.join(root, '.env');
require('dotenv').config({ path: envLocal });
require('dotenv').config({ path: envFile });

/** Lectura manual por si dotenv no asigna la variable (BOM UTF-8, formato raro en Windows). */
function parseEnvFile(filePath) {
 if (!fs.existsSync(filePath)) return {};
 let raw = fs.readFileSync(filePath, 'utf8');
 if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
 const out = {};
 for (const line of raw.split(/\r?\n/)) {
 const t = line.trim();
 if (!t || t.startsWith('#')) continue;
 const eq = t.indexOf('=');
 if (eq <= 0) continue;
 const key = t.slice(0, eq).trim();
 let val = t.slice(eq + 1).trim();
 if (
 (val.startsWith('"') && val.endsWith('"')) ||
 (val.startsWith("'") && val.endsWith("'"))
 ) {
 val = val.slice(1, -1);
 }
 out[key] = val;
 }
 return out;
}

const parsedLocal = parseEnvFile(envLocal);

function pickDatabaseUrl() {
 const keys = ['DATABASE_URL', 'POSTGRES_URL', 'DATABASE_PUBLIC_URL'];
 for (const k of keys) {
 const v = String(process.env[k] || parsedLocal[k] || '').trim();
 if (v) return v;
 }
 return '';
}

const SQLITE_DB_PATH = path.resolve(process.cwd(), 'tickets.db');
const DATABASE_URL = pickDatabaseUrl();
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

function normCedula(c) {
 return String(c ?? '').trim();
}

async function main() {
 if (!DATABASE_URL || DATABASE_URL === 'TU_URL_DE_RAILWAY_AQUI') {
 const hasLocal = fs.existsSync(envLocal);
 const hasEnv = fs.existsSync(envFile);
 console.error('Falta la URL de PostgreSQL.');
 console.error(' Crea o edita .env.local en la raíz del proyecto y añade una línea:');
 console.error(' DATABASE_URL=postgresql://usuario:contraseña@host:puerto/railway');
 console.error(' (También: POSTGRES_URL o DATABASE_PUBLIC_URL. Sin espacios alrededor del =.)');
 console.error(` Carpeta actual: ${root}`);
 console.error(` Archivos: .env.local ${hasLocal ? 'existe' : 'no existe'}, .env ${hasEnv ? 'existe' : 'no existe'}.`);
 process.exit(1);
 }

 if (DATABASE_URL.includes('railway.internal') || /\.internal(?=:|\/|$)/i.test(DATABASE_URL)) {
 console.error('DATABASE_URL usa un host interno (p. ej. postgres.railway.internal).');
 console.error(' Desde tu PC no funciona: necesitás la URL pública de Postgres.');
 console.error(' Railway → tu base PostgreSQL → pestaña Connect / Networking:');
 console.error(' copiá la URL que use un host tipo *.rlwy.net (TCP proxy / Public).');
 console.error(' No uses la URL "private" / internal para scripts locales.');
 process.exit(1);
 }

 console.log('SQLite:', SQLITE_DB_PATH);
 const sqlite = new Database(SQLITE_DB_PATH, { readonly: true });

 let hasTable;
 try {
 hasTable = sqlite
 .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='limpieza_usuarios'")
 .get();
 } catch (e) {
 console.error('No se pudo leer SQLite:', e.message);
 sqlite.close();
 process.exit(1);
 }
 if (!hasTable) {
 console.error('No existe la tabla limpieza_usuarios en tickets.db.');
 sqlite.close();
 process.exit(1);
 }

 const rawRows = sqlite.prepare('SELECT id, nombre, cedula, sector, cliente, activo, created_at FROM limpieza_usuarios').all();
 sqlite.close();

 const byCedula = new Map();
 for (const row of rawRows) {
 const c = normCedula(row.cedula);
 if (!c) {
 console.warn(' Fila omitida (cédula vacía), id sqlite:', row.id);
 continue;
 }
 byCedula.set(c, row);
 }
 const rows = Array.from(byCedula.values());
 console.log(`Registros en SQLite (únicos por cédula): ${rows.length}`);

 const pg = new Pool({
 connectionString: DATABASE_URL,
 ssl: { rejectUnauthorized: false },
 });

 const client = await pg.connect();
 let inTx = false;
 try {
 const hasLb = await client.query(
 "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'logbook') AS e"
 );
 const hasLbc = await client.query(
 "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'logbook_columns') AS e"
 );
 let lb = null;
 let lbc = null;
 if (hasLb.rows[0].e && hasLbc.rows[0].e) {
 const logBefore = await client.query(
 'SELECT (SELECT COUNT(*)::bigint FROM logbook) AS logbook, (SELECT COUNT(*)::bigint FROM logbook_columns) AS logbook_cols'
 );
 lb = logBefore.rows[0].logbook;
 lbc = logBefore.rows[0].logbook_cols;
 console.log(`Antes: logbook=${lb} filas, logbook_columns=${lbc} filas`);
 } else {
 console.warn(' No hay tablas logbook/logbook_columns en PG; se omite la verificación de conteos (solo aplica en bases con bitácora).');
 }

 const tbl = await client.query(
 "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'limpieza_usuarios')"
 );
 if (!tbl.rows[0].exists) {
 throw new Error('En PostgreSQL no existe limpieza_usuarios. Despliega la app al menos una vez o ejecuta el init de lib/db.');
 }

 // Sin depender de UNIQUE(cedula): en algunas bases PG no existe esa restricción y ON CONFLICT falla.
 const updateSql = `
 UPDATE limpieza_usuarios
 SET nombre = $1, sector = $2, cliente = $3, activo = $4
 WHERE cedula = $5
 `;
 const insertSql = `
 INSERT INTO limpieza_usuarios (nombre, cedula, sector, cliente, activo, created_at)
 VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, CURRENT_TIMESTAMP))
 `;

 if (DRY_RUN) {
 console.log('DRY_RUN: no se escribirá nada en PostgreSQL.');
 for (const r of rows.slice(0, 5)) {
 console.log(' ejemplo:', normCedula(r.cedula), r.nombre);
 }
 if (rows.length > 5) console.log(` ... y ${rows.length - 5} más`);
 return;
 }

 await client.query('BEGIN');
 inTx = true;

 const luCols = await client.query(
 `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'limpieza_usuarios'`
 );
 const luColNames = luCols.rows.map((r) => r.column_name);
 if (luColNames.includes('email')) {
 console.log(
 'limpieza_usuarios aún tiene columna email (esquema viejo). Eliminándola para alinear con la app actual...'
 );
 await client.query('ALTER TABLE limpieza_usuarios DROP COLUMN email');
 }

 let inserted = 0;
 let updated = 0;
 for (const r of rows) {
 const cedula = normCedula(r.cedula);
 const createdAt = r.created_at ? new Date(r.created_at) : null;
 const activo = r.activo !== undefined && r.activo !== null ? Number(r.activo) : 1;
 const upd = await client.query(updateSql, [
 r.nombre,
 r.sector ?? null,
 r.cliente ?? null,
 activo,
 cedula,
 ]);
 const changed = upd.rowCount ?? 0;
 if (changed > 0) {
 updated++;
 } else {
 await client.query(insertSql, [
 r.nombre,
 cedula,
 r.sector ?? null,
 r.cliente ?? null,
 activo,
 createdAt,
 ]);
 inserted++;
 }
 }

 if (lb !== null && lbc !== null) {
 const logAfter = await client.query(
 'SELECT (SELECT COUNT(*)::bigint FROM logbook) AS logbook, (SELECT COUNT(*)::bigint FROM logbook_columns) AS logbook_cols'
 );
 if (String(logAfter.rows[0].logbook) !== String(lb) || String(logAfter.rows[0].logbook_cols) !== String(lbc)) {
 await client.query('ROLLBACK');
 inTx = false;
 throw new Error('Los conteos de logbook cambiaron; se hizo ROLLBACK. No se aplicó la migración de personal.');
 }
 }

 await client.query('COMMIT');
 inTx = false;
 console.log(`Listo: ${inserted} altas nuevas, ${updated} filas ya existían (actualizadas por cédula).`);
 if (lb !== null) {
 console.log(`Bitácora (logbook / logbook_columns): sin cambios (${lb} / ${lbc} filas).`);
 }

 await client.query(
 `SELECT setval(pg_get_serial_sequence('limpieza_usuarios', 'id'), COALESCE((SELECT MAX(id) FROM limpieza_usuarios), 1))`
 );
 console.log(' Secuencia id de limpieza_usuarios ajustada.');
 } catch (e) {
 if (inTx) await client.query('ROLLBACK').catch(() => {});
 throw e;
 } finally {
 client.release();
 await pg.end();
 }
}

main().catch((e) => {
 console.error('', e.message || e);
 process.exit(1);
});
