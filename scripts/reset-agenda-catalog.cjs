/**
 * Reinicia el catálogo de uniformes desde un Excel (default: ./indumentaria.xlsx).
 *
 * Borra TODO el contenido de agenda_uniform_catalog y lo reemplaza con las filas del Excel.
 *
 * Uso:
 * node scripts/reset-agenda-catalog.cjs # usa ./indumentaria.xlsx
 * node scripts/reset-agenda-catalog.cjs path/al.xlsx
 * DRY_RUN=1 node scripts/reset-agenda-catalog.cjs # no escribe, solo muestra
 *
 * Variables de entorno:
 * DATABASE_URL / POSTGRES_URL / DATABASE_PUBLIC_URL → PostgreSQL (producción Railway).
 * Si ninguna está seteada, usa SQLite local (./tickets.db).
 */

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const root = path.resolve(process.cwd());
require('dotenv').config({ path: path.join(root, '.env.local') });
require('dotenv').config({ path: path.join(root, '.env') });

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const XLSX_PATH = path.resolve(process.argv[2] || path.join(root, 'indumentaria.xlsx'));

function parseCantidad(raw) {
 const n = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
 return n > 0 ? n : 1;
}

function parseVidaUtil(raw) {
 const n = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
 return n > 0 ? n : 12;
}

function parseCatalog(buffer) {
 const wb = XLSX.read(buffer, { type: 'buffer' });
 const ws = wb.Sheets[wb.SheetNames[0]];
 const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

 const items = [];
 let currentEmpresa = null;
 let colIdx = null;
 const empresaRe = /^([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9 .\-]{1,40})\s*\(\s*\d+\s*art[ií]culos?\s*\)\s*$/;

 for (let i = 0; i < matrix.length; i++) {
 const row = matrix[i] || [];
 const first = String(row[0] || '').trim();
 if (!first && row.every(c => String(c || '').trim() === '')) continue;

 const m = first.match(empresaRe);
 if (m) { currentEmpresa = m[1].trim(); colIdx = null; continue; }

 const lower = first.toLowerCase();
 if (lower === 'artículo' || lower === 'articulo') {
 colIdx = { articulo: -1, sector: -1, cantidad: -1, vida: -1 };
 for (let c = 0; c < row.length; c++) {
 const h = String(row[c] || '').toLowerCase().trim();
 if (h === 'artículo' || h === 'articulo') colIdx.articulo = c;
 else if (h.startsWith('sector')) colIdx.sector = c;
 else if (h.startsWith('cantidad')) colIdx.cantidad = c;
 else if (h.startsWith('vida')) colIdx.vida = c;
 }
 continue;
 }

 if (currentEmpresa && colIdx && colIdx.articulo >= 0) {
 const articulo = String(row[colIdx.articulo] || '').trim();
 if (!articulo) continue;
 const sectorPuesto = colIdx.sector >= 0 ? String(row[colIdx.sector] || '').trim() : '';
 const cantidadRaw = colIdx.cantidad >= 0 ? String(row[colIdx.cantidad] ?? '') : '1';
 const vidaRaw = colIdx.vida >= 0 ? String(row[colIdx.vida] ?? '') : '12';
 items.push({
 empresa: currentEmpresa,
 puesto: sectorPuesto || null,
 article_type: articulo,
 quantity: parseCantidad(cantidadRaw),
 useful_life_months: parseVidaUtil(vidaRaw),
 });
 }
 }
 return items;
}

function dedup(items) {
 const seen = new Map();
 for (const it of items) {
 const key = [it.empresa || '', it.puesto || '', it.article_type.toLowerCase().trim()].join('||');
 if (!seen.has(key)) seen.set(key, it);
 }
 return Array.from(seen.values());
}

function pickDatabaseUrl() {
 for (const k of ['DATABASE_URL', 'POSTGRES_URL', 'DATABASE_PUBLIC_URL']) {
 const v = String(process.env[k] || '').trim();
 if (v) return v;
 }
 return '';
}

async function resetPostgres(items, dbUrl) {
 const { Pool } = require('pg');
 const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
 const client = await pool.connect();
 try {
 await client.query('BEGIN');
 const before = await client.query('SELECT COUNT(*)::int AS n FROM agenda_uniform_catalog');
 console.log(`→ Filas actuales en agenda_uniform_catalog: ${before.rows[0].n}`);

 if (DRY_RUN) {
 console.log('(DRY_RUN) No se borra ni inserta. Abortando transacción.');
 await client.query('ROLLBACK');
 return;
 }

 await client.query('DELETE FROM agenda_uniform_catalog');
 console.log(`→ Borradas ${before.rows[0].n} filas.`);

 let inserted = 0;
 for (const it of items) {
 await client.query(
 `INSERT INTO agenda_uniform_catalog
 (empresa, sector, puesto, workplace_category, article_type, article_name_normalized,
 quantity, useful_life_months, initial_enabled, renewable, reusable_allowed, special_authorization_required)
 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
 [it.empresa, null, it.puesto, null, it.article_type, null, it.quantity, it.useful_life_months, 1, 1, 0, 0]
 );
 inserted++;
 }
 await client.query('COMMIT');
 console.log(`→ Insertadas ${inserted} filas nuevas.`);
 } catch (err) {
 await client.query('ROLLBACK');
 throw err;
 } finally {
 client.release();
 await pool.end();
 }
}

function resetSqlite(items) {
 const Database = require('better-sqlite3');
 const dbPath = path.join(root, 'tickets.db');
 if (!fs.existsSync(dbPath)) {
 throw new Error(`No existe SQLite local en ${dbPath}`);
 }
 const db = new Database(dbPath);
 const before = db.prepare('SELECT COUNT(*) AS n FROM agenda_uniform_catalog').get().n;
 console.log(`→ Filas actuales en agenda_uniform_catalog: ${before}`);

 if (DRY_RUN) {
 console.log('(DRY_RUN) No se borra ni inserta.');
 db.close();
 return;
 }

 const tx = db.transaction(() => {
 db.prepare('DELETE FROM agenda_uniform_catalog').run();
 const stmt = db.prepare(
 `INSERT INTO agenda_uniform_catalog
 (empresa, sector, puesto, workplace_category, article_type, article_name_normalized,
 quantity, useful_life_months, initial_enabled, renewable, reusable_allowed, special_authorization_required)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
 );
 for (const it of items) {
 stmt.run(it.empresa, null, it.puesto, null, it.article_type, null, it.quantity, it.useful_life_months, 1, 1, 0, 0);
 }
 });
 tx();
 console.log(`→ Borradas ${before} filas, insertadas ${items.length} nuevas.`);
 db.close();
}

async function main() {
 if (!fs.existsSync(XLSX_PATH)) {
 console.error(`No existe el archivo: ${XLSX_PATH}`);
 process.exit(1);
 }
 console.log(`Leyendo ${XLSX_PATH}`);
 const buf = fs.readFileSync(XLSX_PATH);
 const parsed = parseCatalog(buf);
 const items = dedup(parsed);
 console.log(`→ Items parseados: ${parsed.length}, únicos: ${items.length}`);

 if (items.length === 0) {
 console.error('El Excel no tiene items válidos.');
 process.exit(1);
 }

 const byEmpresa = {};
 for (const it of items) {
 byEmpresa[it.empresa] = (byEmpresa[it.empresa] || 0) + 1;
 }
 console.log('→ Distribución por empresa:');
 for (const [emp, n] of Object.entries(byEmpresa)) {
 console.log(` - ${emp}: ${n}`);
 }

 const dbUrl = pickDatabaseUrl();
 if (dbUrl) {
 console.log(` Conectando a PostgreSQL (${dbUrl.replace(/:[^:@]+@/, ':***@')})`);
 await resetPostgres(items, dbUrl);
 } else {
 console.log(' Sin DATABASE_URL → usando SQLite local (tickets.db)');
 resetSqlite(items);
 }
 console.log('Listo.');
}

main().catch(err => {
 console.error('Error:', err.message);
 process.exit(1);
});
