/**
 * Migra los remitos PDF almacenados como bytea en la DB vieja (gss-agenda-web)
 * hacia Cloudinary, y actualiza los URLs en la DB nueva (gss-management-hub).
 *
 * Flujo:
 * 1. Conecta a la DB vieja (OLD_DATABASE_URL) y la DB nueva (DATABASE_URL).
 * 2. Para cada agenda_appointments con remito_pdf_url LIKE 'db://%':
 *    - Parsea el ID viejo del URL.
 *    - Lee delivery_note_data de la tabla `appointments` vieja.
 *    - Sube el PDF a Cloudinary (resource_type: raw, format: pdf).
 *    - UPDATE la fila nueva con la nueva URL.
 * 3. Ídem para remito_return_pdf_url / return_note_data (si existe).
 *
 * Uso:
 *   DRY_RUN=1 node scripts/migrate-old-remitos.cjs
 *   node scripts/migrate-old-remitos.cjs
 *
 * Requiere en env:
 *   DATABASE_URL (o POSTGRES_URL / DATABASE_PUBLIC_URL) — DB nueva.
 *   OLD_DATABASE_URL — DB vieja.
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 *   (o CLOUDINARY_URL).
 */

const path = require('path');

const root = path.resolve(process.cwd());
require('dotenv').config({ path: path.join(root, '.env.local') });
require('dotenv').config({ path: path.join(root, '.env') });

const { Pool } = require('pg');
const { v2: cloudinary } = require('cloudinary');

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

function pickNewDbUrl() {
  for (const k of ['DATABASE_URL', 'POSTGRES_URL', 'DATABASE_PUBLIC_URL']) {
    const v = String(process.env[k] || '').trim();
    if (v) return v;
  }
  return '';
}

function assertCloudinary() {
  if (process.env.CLOUDINARY_URL) return; // auto-config
  const a = process.env.CLOUDINARY_CLOUD_NAME;
  const b = process.env.CLOUDINARY_API_KEY;
  const c = process.env.CLOUDINARY_API_SECRET;
  if (!a || !b || !c) {
    throw new Error('Faltan credenciales Cloudinary (CLOUDINARY_URL o CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET).');
  }
  cloudinary.config({
    cloud_name: a,
    api_key: b,
    api_secret: c,
    secure: true,
  });
}

function uploadPdfBuffer(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'gss-agenda-web/remitos',
        public_id: publicId,
        resource_type: 'raw',
        type: 'upload',
        access_mode: 'public',
        overwrite: true,
        format: 'pdf',
      },
      (err, result) => {
        if (err || !result) return reject(err || new Error('Upload fallido'));
        let url = result.secure_url;
        if (!url.toLowerCase().endsWith('.pdf')) url = `${url}.pdf`;
        resolve(url);
      }
    );
    stream.end(buffer);
  });
}

function parseOldId(dbUrlValue) {
  // 'db://64' → 64
  const m = /^db:\/\/(\d+)$/.exec(String(dbUrlValue || '').trim());
  return m ? parseInt(m[1], 10) : null;
}

async function migrate() {
  assertCloudinary();

  const newUrl = pickNewDbUrl();
  if (!newUrl) throw new Error('DATABASE_URL (nueva) no está seteada.');
  const oldUrl = process.env.OLD_DATABASE_URL;
  if (!oldUrl) throw new Error('OLD_DATABASE_URL no está seteada.');

  const newPool = new Pool({ connectionString: newUrl, ssl: { rejectUnauthorized: false } });
  const oldPool = new Pool({ connectionString: oldUrl, ssl: { rejectUnauthorized: false } });

  const newClient = await newPool.connect();
  const oldClient = await oldPool.connect();

  try {
    // Detectar si la tabla nueva tiene remito_return_pdf_url
    const retColCheck = await newClient.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name='agenda_appointments' AND column_name='remito_return_pdf_url'
    `);
    const hasReturnCol = retColCheck.rowCount > 0;

    // Detectar si la tabla vieja tiene return_note_data
    const oldRetColCheck = await oldClient.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name='appointments' AND column_name='return_note_data'
    `);
    const hasOldReturn = oldRetColCheck.rowCount > 0;

    console.log(`🔎 Columnas disponibles: new.remito_return_pdf_url=${hasReturnCol}, old.return_note_data=${hasOldReturn}`);

    // 1. Candidatos: remito principal
    const principal = await newClient.query(`
      SELECT id, remito_pdf_url
      FROM agenda_appointments
      WHERE remito_pdf_url LIKE 'db://%'
      ORDER BY id
    `);
    console.log(`📄 Remitos principales a migrar: ${principal.rowCount}`);

    // 2. Candidatos: remito devolución
    const devoluciones = hasReturnCol
      ? await newClient.query(`
          SELECT id, remito_return_pdf_url
          FROM agenda_appointments
          WHERE remito_return_pdf_url LIKE 'db://%'
          ORDER BY id
        `)
      : { rows: [], rowCount: 0 };
    console.log(`📄 Remitos de devolución a migrar: ${devoluciones.rowCount}`);

    if (DRY_RUN) {
      console.log('\n🧪 DRY_RUN — primeros 10 principales:');
      for (const row of principal.rows.slice(0, 10)) {
        const oldId = parseOldId(row.remito_pdf_url);
        if (!oldId) { console.log(`  #${row.id} URL inválida "${row.remito_pdf_url}"`); continue; }
        const r = await oldClient.query(`SELECT octet_length(delivery_note_data) AS bytes FROM appointments WHERE id = $1`, [oldId]);
        const bytes = r.rows[0]?.bytes;
        console.log(`  #new=${row.id}  old=${oldId}  bytes=${bytes ?? '—'}`);
      }
      if (devoluciones.rowCount > 0) {
        console.log('\n🧪 DRY_RUN — primeros 5 devolución:');
        for (const row of devoluciones.rows.slice(0, 5)) {
          const oldId = parseOldId(row.remito_return_pdf_url);
          if (!oldId || !hasOldReturn) continue;
          const r = await oldClient.query(`SELECT octet_length(return_note_data) AS bytes FROM appointments WHERE id = $1`, [oldId]);
          const bytes = r.rows[0]?.bytes;
          console.log(`  #new=${row.id}  old=${oldId}  bytes=${bytes ?? '—'}`);
        }
      }
      console.log('\n(DRY_RUN) No se sube ni actualiza nada.');
      return;
    }

    // ── Ejecución real ────────────────────────────────────────────────────
    const stats = { ok: 0, skipped: 0, failed: 0, okRet: 0, skippedRet: 0, failedRet: 0 };

    for (const row of principal.rows) {
      const oldId = parseOldId(row.remito_pdf_url);
      if (!oldId) { stats.skipped++; continue; }
      try {
        const r = await oldClient.query(`SELECT delivery_note_data FROM appointments WHERE id = $1`, [oldId]);
        const buf = r.rows[0]?.delivery_note_data;
        if (!buf) { stats.skipped++; console.log(`  ⚠ skip new=${row.id} old=${oldId} sin blob`); continue; }
        const publicId = `appointment-${oldId}-migrated`;
        const newPdfUrl = await uploadPdfBuffer(buf, publicId);
        await newClient.query(`UPDATE agenda_appointments SET remito_pdf_url = $1 WHERE id = $2`, [newPdfUrl, row.id]);
        stats.ok++;
        console.log(`  ✔ new=${row.id}  → ${newPdfUrl}`);
      } catch (e) {
        stats.failed++;
        console.error(`  ✖ new=${row.id} old=${oldId} error: ${e.message}`);
      }
    }

    if (hasReturnCol && hasOldReturn) {
      for (const row of devoluciones.rows) {
        const oldId = parseOldId(row.remito_return_pdf_url);
        if (!oldId) { stats.skippedRet++; continue; }
        try {
          const r = await oldClient.query(`SELECT return_note_data FROM appointments WHERE id = $1`, [oldId]);
          const buf = r.rows[0]?.return_note_data;
          if (!buf) { stats.skippedRet++; continue; }
          const publicId = `appointment-${oldId}-return-migrated`;
          const newPdfUrl = await uploadPdfBuffer(buf, publicId);
          await newClient.query(`UPDATE agenda_appointments SET remito_return_pdf_url = $1 WHERE id = $2`, [newPdfUrl, row.id]);
          stats.okRet++;
          console.log(`  ✔ return new=${row.id}  → ${newPdfUrl}`);
        } catch (e) {
          stats.failedRet++;
          console.error(`  ✖ return new=${row.id} old=${oldId} error: ${e.message}`);
        }
      }
    }

    console.log('\n✅ Migración finalizada:', stats);
  } finally {
    newClient.release();
    oldClient.release();
    await newPool.end();
    await oldPool.end();
  }
}

migrate().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
