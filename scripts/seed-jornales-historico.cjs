/**
 * scripts/seed-jornales-historico.cjs
 *
 * Carga inicial ("histórico") para el módulo Jornales (RRHH).
 * Registra personal + marcas sintéticas suficientes para reproducir los conteos
 * exactos de jornales y el último servicio conocido de cada persona.
 *
 * Los datos sensibles (nombres, padrones, lugares) viven en un archivo JSON
 * separado que NO se commitea: `scripts/seed-jornales-data.local.json`.
 * Formato (ver `scripts/seed-jornales-data.example.json`):
 *   [[padron, nombre, jornales, estado, ultimo_servicio], ...]
 * Override de ubicación via env var `SEED_JORNALES_DATA_FILE`.
 *
 * Uso:
 *   node scripts/seed-jornales-historico.cjs            # ejecuta contra PG si hay DATABASE_URL, sino SQLite local
 *   DRY_RUN=1 node scripts/seed-jornales-historico.cjs  # no escribe, solo informa
 *
 * Idempotencia: existe un "archivo fantasma" con file_key = '__seed_historico_v1__'.
 * Si el script se corre de nuevo, primero borra todas las marcas de ese archivo
 * y el archivo mismo, y luego re-inserta todo desde cero. Respeta marcas reales
 * cargadas desde la UI (distinto file_id). NO toca personal ya agregado desde la UI.
 *
 * Fechas sintéticas: empiezan en 2020-01-01 e incrementan un día por jornal
 * por persona. Se eligió un rango histórico para evitar colisiones con marcas
 * reales futuras (la UNIQUE es padron+fecha+lugar, y estas fechas lejanas no
 * deberían aparecer en Excels de asistencia reales).
 */

'use strict';

const path = require('path');
const fs = require('fs');

const root = path.resolve(process.cwd());
require('dotenv').config({ path: path.join(root, '.env.local') });
require('dotenv').config({ path: path.join(root, '.env') });

const DRY_RUN = process.env.DRY_RUN === '1';
const SEED_FILE_KEY = '__seed_historico_v1__';
const SEED_FILE_NAME = 'Histórico inicial (carga manual)';
const BASE_DATE_ISO = '2020-01-01'; // día 0 de las fechas sintéticas

// ─── Carga de datos sensibles (archivo gitignored) ──────────────────────────
const DATA_FILE = process.env.SEED_JORNALES_DATA_FILE
  || path.join(root, 'scripts', 'seed-jornales-data.local.json');

function loadHistorico() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`No se encontró el archivo de datos: ${DATA_FILE}`);
    console.error(`Creá ese archivo (gitignored) con el mismo formato que seed-jornales-data.example.json.`);
    process.exit(1);
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    console.error(`El archivo ${DATA_FILE} debe contener un array JSON.`);
    process.exit(1);
  }
  for (const row of parsed) {
    if (!Array.isArray(row) || row.length < 5) {
      console.error(`Fila inválida en ${DATA_FILE}: se esperan 5 columnas [padron, nombre, jornales, estado, ultimo_servicio].`);
      console.error('Fila:', JSON.stringify(row));
      process.exit(1);
    }
  }
  return parsed;
}

const HISTORICO = loadHistorico();

// ─── Helpers de fecha ────────────────────────────────────────────────────────
function addDays(baseIso, days) {
  const d = new Date(baseIso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// ─── Adaptador PG / SQLite ───────────────────────────────────────────────────
async function openDb() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: url,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
    return {
      type: 'pg',
      query: async (text, params = []) => {
        const res = await pool.query(text, params);
        return res.rows;
      },
      run: async (text, params = []) => {
        const res = await pool.query(text, params);
        return { changes: res.rowCount || 0 };
      },
      close: () => pool.end(),
    };
  }

  const Database = require('better-sqlite3');
  const DB_PATH = path.resolve(process.cwd(), 'tickets.db');
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`No encontré la DB local en ${DB_PATH}. Arrancá el server al menos una vez para crearla.`);
  }
  const sqdb = new Database(DB_PATH);
  return {
    type: 'sqlite',
    query: async (text, params = []) => {
      // Convertir $N placeholders a ?
      const q = text.replace(/\$\d+/g, '?');
      return sqdb.prepare(q).all(...params);
    },
    run: async (text, params = []) => {
      const q = text.replace(/\$\d+/g, '?');
      const info = sqdb.prepare(q).run(...params);
      return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
    },
    close: () => sqdb.close(),
  };
}

// ─── Core ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`DRY_RUN=${DRY_RUN ? '1' : '0'}`);
  const db = await openDb();
  console.log(`DB type: ${db.type}`);

  const totalPersonas = HISTORICO.length;
  const totalJornales = HISTORICO.reduce((a, r) => a + r[2], 0);
  const conJornales = HISTORICO.filter((r) => r[2] > 0).length;
  const efAut = HISTORICO.filter((r) => r[3] === 'efectivo_autorizado').length;
  console.log(`Dataset: ${totalPersonas} personas | ${conJornales} con jornales | ${efAut} con ef. autorizada | ${totalJornales} marcas sintéticas totales.`);

  if (DRY_RUN) {
    console.log('DRY_RUN activo — no se escribe nada. Saliendo.');
    await db.close();
    return;
  }

  // 0) Asegurar tablas (mismo schema que lib/db.ts). Útil si el deploy aún no
  // levantó las tablas en PG — CREATE TABLE IF NOT EXISTS es idempotente.
  console.log('Asegurando esquema jornales_*...');
  const ddlPg = [
    `CREATE TABLE IF NOT EXISTS jornales_personal (
       id SERIAL PRIMARY KEY,
       padron TEXT NOT NULL UNIQUE,
       nombre TEXT NOT NULL,
       doc TEXT,
       efectividad_autorizada INTEGER DEFAULT 0,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE TABLE IF NOT EXISTS jornales_archivos (
       id SERIAL PRIMARY KEY,
       file_key TEXT NOT NULL UNIQUE,
       name TEXT NOT NULL,
       size INTEGER,
       registros_totales INTEGER,
       registros_nuevos INTEGER,
       uploaded_by INTEGER,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE TABLE IF NOT EXISTS jornales_marcas (
       id SERIAL PRIMARY KEY,
       padron TEXT NOT NULL,
       fecha DATE NOT NULL,
       lugar TEXT,
       file_id INTEGER,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       UNIQUE (padron, fecha, lugar)
     )`,
    `CREATE INDEX IF NOT EXISTS idx_jornales_marcas_padron ON jornales_marcas(padron)`,
    `CREATE INDEX IF NOT EXISTS idx_jornales_marcas_fecha ON jornales_marcas(fecha)`,
  ];
  const ddlSqlite = ddlPg.map((s) =>
    s.replace(/SERIAL/g, 'INTEGER').replace(/TIMESTAMP/g, 'DATETIME'),
  );
  const ddls = db.type === 'pg' ? ddlPg : ddlSqlite;
  for (const sql of ddls) {
    await db.run(sql, []);
  }

  // 1) Limpiar seed anterior (si existe)
  const prev = await db.query(`SELECT id FROM jornales_archivos WHERE file_key = $1`, [SEED_FILE_KEY]);
  if (prev.length > 0) {
    const prevId = prev[0].id;
    console.log(`Limpiando seed anterior (archivo id=${prevId})...`);
    await db.run(`DELETE FROM jornales_marcas WHERE file_id = $1`, [prevId]);
    await db.run(`DELETE FROM jornales_archivos WHERE id = $1`, [prevId]);
  }

  // 2) Crear archivo fantasma
  let seedFileId;
  if (db.type === 'pg') {
    const rows = await db.query(
      `INSERT INTO jornales_archivos (file_key, name, size, registros_totales, registros_nuevos)
       VALUES ($1, $2, 0, $3, $3) RETURNING id`,
      [SEED_FILE_KEY, SEED_FILE_NAME, totalJornales],
    );
    seedFileId = rows[0].id;
  } else {
    const res = await db.run(
      `INSERT INTO jornales_archivos (file_key, name, size, registros_totales, registros_nuevos)
       VALUES ($1, $2, 0, $3, $3)`,
      [SEED_FILE_KEY, SEED_FILE_NAME, totalJornales],
    );
    seedFileId = res.lastInsertRowid;
  }
  console.log(`Archivo fantasma creado (id=${seedFileId}).`);

  // 3) Upsert de personal + inserción de marcas sintéticas
  let personasInsertadas = 0;
  let marcasInsertadas = 0;
  for (const [padron, nombre, jornales, estado, ultimoServicio] of HISTORICO) {
    const efAutFlag = estado === 'efectivo_autorizado' ? 1 : 0;

    // Upsert personal (no pisa si ya fue agregado desde la UI)
    if (db.type === 'pg') {
      const r = await db.query(
        `INSERT INTO jornales_personal (padron, nombre, doc, efectividad_autorizada)
         VALUES ($1, $2, NULL, $3)
         ON CONFLICT (padron) DO UPDATE SET
           nombre = EXCLUDED.nombre,
           efectividad_autorizada = EXCLUDED.efectividad_autorizada
         RETURNING (xmax = 0) AS inserted`,
        [padron, nombre, efAutFlag],
      );
      if (r[0]?.inserted) personasInsertadas++;
    } else {
      const res = await db.run(
        `INSERT INTO jornales_personal (padron, nombre, doc, efectividad_autorizada)
         VALUES ($1, $2, NULL, $3)
         ON CONFLICT (padron) DO UPDATE SET
           nombre = excluded.nombre,
           efectividad_autorizada = excluded.efectividad_autorizada`,
        [padron, nombre, efAutFlag],
      );
      if (res.changes > 0) personasInsertadas++;
    }

    // Marcas sintéticas — una fila por jornal, fechas consecutivas desde BASE_DATE
    if (jornales > 0 && ultimoServicio) {
      for (let i = 0; i < jornales; i++) {
        const fecha = addDays(BASE_DATE_ISO, i);
        try {
          await db.run(
            `INSERT INTO jornales_marcas (padron, fecha, lugar, file_id)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (padron, fecha, lugar) DO NOTHING`,
            [padron, fecha, ultimoServicio, seedFileId],
          );
          marcasInsertadas++;
        } catch (e) {
          console.warn(`Fallo insert marca ${padron} ${fecha}:`, e.message);
        }
      }
    }
  }

  console.log(`Personal upserteado: ${personasInsertadas} filas afectadas.`);
  console.log(`Marcas sintéticas insertadas: ${marcasInsertadas}.`);

  await db.close();
  console.log('Seed completo.');
}

main().catch((err) => {
  console.error('Error en seed:', err);
  process.exit(1);
});
