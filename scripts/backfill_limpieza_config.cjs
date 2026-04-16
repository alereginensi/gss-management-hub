#!/usr/bin/env node
/**
 * Backfill one-shot SEGURO de limpieza_clientes / limpieza_sectores / limpieza_puestos
 * a partir de los registros históricos en limpieza_asistencia.
 *
 * NO borra nada. Solo INSERT con guardas WHERE NOT EXISTS / ON CONFLICT DO NOTHING.
 * Idempotente: correrlo dos veces no duplica.
 *
 * Uso:
 *   DATABASE_URL="postgres://..." node scripts/backfill_limpieza_config.cjs
 */

const { Client } = require('pg');

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_PUBLIC_URL;
if (!url) {
  console.error('ERROR: Falta DATABASE_URL (o POSTGRES_URL / DATABASE_PUBLIC_URL)');
  process.exit(1);
}

(async () => {
  const client = new Client({ connectionString: url, ssl: url.includes('railway') || url.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined });
  await client.connect();
  console.log('✅ Conectado a Postgres');

  try {
    const { rows: combos } = await client.query(`
      SELECT DISTINCT cliente, sector, seccion AS turno, puesto
      FROM limpieza_asistencia
      WHERE cliente IS NOT NULL AND cliente <> ''
    `);
    console.log(`Encontradas ${combos.length} combinaciones únicas en limpieza_asistencia`);

    let nCli = 0, nSec = 0, nPue = 0;

    const clientes = [...new Set(combos.map(r => r.cliente))];
    for (const name of clientes) {
      const r = await client.query(
        `INSERT INTO limpieza_clientes (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id`,
        [name]
      );
      if (r.rowCount > 0) nCli++;
    }

    const clienteMap = new Map();
    const { rows: cliRows } = await client.query('SELECT id, name FROM limpieza_clientes');
    for (const c of cliRows) clienteMap.set(c.name, c.id);

    const sectorPairs = new Set();
    for (const r of combos) {
      if (r.sector) sectorPairs.add(`${r.cliente}||${r.sector}`);
    }
    for (const key of sectorPairs) {
      const [cliName, secName] = key.split('||');
      const cliId = clienteMap.get(cliName);
      if (!cliId) continue;
      const r = await client.query(
        `INSERT INTO limpieza_sectores (cliente_id, name) VALUES ($1, $2) ON CONFLICT (cliente_id, name) DO NOTHING RETURNING id`,
        [cliId, secName]
      );
      if (r.rowCount > 0) nSec++;
    }

    const sectorMap = new Map();
    const { rows: secRows } = await client.query('SELECT id, cliente_id, name FROM limpieza_sectores');
    for (const s of secRows) sectorMap.set(`${s.cliente_id}||${s.name}`, s.id);

    const puestoSeen = new Set();
    for (const r of combos) {
      if (!r.sector || !r.turno || !r.puesto) continue;
      const cliId = clienteMap.get(r.cliente);
      const secId = cliId ? sectorMap.get(`${cliId}||${r.sector}`) : null;
      if (!secId) continue;
      const key = `${secId}||${r.turno}||${r.puesto}`;
      if (puestoSeen.has(key)) continue;
      puestoSeen.add(key);

      const existing = await client.query(
        `SELECT id FROM limpieza_puestos WHERE sector_id = $1 AND turno = $2 AND nombre = $3 LIMIT 1`,
        [secId, r.turno, r.puesto]
      );
      if (existing.rowCount > 0) continue;

      const { rows: ordRows } = await client.query(
        `SELECT COALESCE(MAX(orden), -1) + 1 AS next FROM limpieza_puestos WHERE sector_id = $1 AND turno = $2`,
        [secId, r.turno]
      );
      const nextOrden = ordRows[0].next;

      await client.query(
        `INSERT INTO limpieza_puestos (sector_id, turno, nombre, cantidad, orden) VALUES ($1, $2, $3, 1, $4)`,
        [secId, r.turno, r.puesto, nextOrden]
      );
      nPue++;
    }

    console.log(`\n✅ Backfill OK — clientes nuevos: ${nCli}, sectores nuevos: ${nSec}, puestos nuevos: ${nPue}`);
  } catch (e) {
    console.error('❌ Error en backfill:', e);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
