/**
 * Cambia el access_mode de los PDFs de remitos en Cloudinary a 'authenticated'.
 *
 * Motivo: los PDFs subidos con type=upload NO pueden bypassear la restricción
 * global "Restricted media types: PDF" de la cuenta. Para que funcionen con
 * URLs firmadas desde el proxy del backend, necesitan ser type=authenticated.
 *
 * Uso:
 * DRY_RUN=1 node scripts/secure-cloudinary-remitos.cjs
 * node scripts/secure-cloudinary-remitos.cjs
 *
 * Requiere en env: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 * (o CLOUDINARY_URL) y DATABASE_URL.
 */

const path = require('path');
const root = path.resolve(process.cwd());
require('dotenv').config({ path: path.join(root, '.env.local') });
require('dotenv').config({ path: path.join(root, '.env') });

const { Pool } = require('pg');
const { v2: cloudinary } = require('cloudinary');

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

function pickDbUrl() {
 for (const k of ['DATABASE_URL', 'POSTGRES_URL', 'DATABASE_PUBLIC_URL']) {
 const v = String(process.env[k] || '').trim();
 if (v) return v;
 }
 return '';
}

function configCloudinary() {
 if (process.env.CLOUDINARY_URL) return;
 cloudinary.config({
 cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
 api_key: process.env.CLOUDINARY_API_KEY,
 api_secret: process.env.CLOUDINARY_API_SECRET,
 secure: true,
 });
}

function extractPublicId(url) {
 // Para resource_type=raw, el public_id INCLUYE la extensión en Cloudinary.
 // Capturamos todo desde el path después de /upload/ o /authenticated/.
 const m = /res\.cloudinary\.com\/[^/]+\/raw\/(?:upload|authenticated)\/(?:v\d+\/)?(.+)$/i.exec(url || '');
 return m ? m[1] : null;
}

async function main() {
 configCloudinary();

 const dbUrl = pickDbUrl();
 if (!dbUrl) throw new Error('DATABASE_URL no seteada');

 const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
 const client = await pool.connect();
 try {
 const rows = await client.query(`
 SELECT id, remito_pdf_url, remito_return_pdf_url
 FROM agenda_appointments
 WHERE remito_pdf_url LIKE 'https://res.cloudinary.com%/raw/upload/%.pdf'
 OR remito_return_pdf_url LIKE 'https://res.cloudinary.com%/raw/upload/%.pdf'
 `);
 console.log(`Filas con PDFs raw/upload: ${rows.rowCount}`);

 const tasks = [];
 for (const row of rows.rows) {
 if (row.remito_pdf_url && /\/raw\/upload\//.test(row.remito_pdf_url)) {
 const publicId = extractPublicId(row.remito_pdf_url);
 if (publicId) tasks.push({ apptId: row.id, col: 'remito_pdf_url', publicId, url: row.remito_pdf_url });
 }
 if (row.remito_return_pdf_url && /\/raw\/upload\//.test(row.remito_return_pdf_url)) {
 const publicId = extractPublicId(row.remito_return_pdf_url);
 if (publicId) tasks.push({ apptId: row.id, col: 'remito_return_pdf_url', publicId, url: row.remito_return_pdf_url });
 }
 }
 console.log(`Total assets a asegurar: ${tasks.length}`);

 if (DRY_RUN) {
 console.log('\nDRY_RUN — primeros 10:');
 tasks.slice(0, 10).forEach(t => console.log(` ${t.apptId} · ${t.col} · ${t.publicId}`));
 console.log('\n(DRY_RUN) No se ejecuta update.');
 return;
 }

 const stats = { ok: 0, failed: 0 };
 for (const t of tasks) {
 try {
 // uploader.explicit con access_mode cambia el asset existente.
 const result = await cloudinary.uploader.explicit(t.publicId, {
 type: 'upload',
 resource_type: 'raw',
 access_mode: 'authenticated',
 });
 // Al cambiar access_mode, el type en el URL pasa a 'authenticated'.
 // result.secure_url ya refleja el cambio.
 const newUrl = result.secure_url;
 if (!newUrl) throw new Error('Respuesta sin secure_url: ' + JSON.stringify(result));
 await client.query(`UPDATE agenda_appointments SET ${t.col} = $1 WHERE id = $2`, [newUrl, t.apptId]);
 stats.ok++;
 console.log(` appt=${t.apptId} ${t.col} → ${newUrl}`);
 } catch (e) {
 stats.failed++;
 const msg = e?.error?.message || e?.message || e?.http_code || JSON.stringify(e);
 console.error(` appt=${t.apptId} ${t.col} · ${t.publicId}: ${msg}`);
 }
 }
 console.log('\nListo:', stats);
 } finally {
 client.release();
 await pool.end();
 }
}

main().catch(e => { console.error('', e.message); process.exit(1); });
