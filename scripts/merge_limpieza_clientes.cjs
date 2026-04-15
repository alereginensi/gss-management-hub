#!/usr/bin/env node
/**
 * Merge SEGURO de clientes duplicados en limpieza_clientes.
 * Caso: "CASMU" (seed) + "Casmu" (backfill histórico) → se consolidan en "Casmu".
 *
 * Acciones:
 *  - Mueve los sectores del cliente PERDEDOR al GANADOR (skip si ya existe con mismo nombre,
 *    en ese caso re-linkea sus puestos al sector existente).
 *  - Puestos: re-parentan al sector destino; si ya existe un puesto idéntico (mismo turno+nombre),
 *    se omite para no duplicar.
 *  - Desactiva (active=0) el cliente perdedor. NO lo borra.
 *  - NO toca limpieza_asistencia (datos históricos intactos).
 *
 * Configurable por constantes abajo (WINNER / LOSER).
 *
 * Uso:
 *   $env:DATABASE_URL="..."; node scripts/merge_limpieza_clientes.cjs
 */

const { Client } = require('pg');

const WINNER = 'Casmu';
const LOSER = 'CASMU';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_PUBLIC_URL;
if (!url) {
  console.error('ERROR: Falta DATABASE_URL');
  process.exit(1);
}

(async () => {
  const client = new Client({ connectionString: url, ssl: url.includes('railway') || url.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined });
  await client.connect();
  console.log(`✅ Conectado. Merge: "${LOSER}" → "${WINNER}"`);

  try {
    await client.query('BEGIN');

    const { rows: cliRows } = await client.query(
      'SELECT id, name, active FROM limpieza_clientes WHERE name IN ($1, $2)',
      [WINNER, LOSER]
    );
    const winner = cliRows.find(r => r.name === WINNER);
    const loser = cliRows.find(r => r.name === LOSER);
    if (!winner) throw new Error(`No existe cliente ganador "${WINNER}"`);
    if (!loser) {
      console.log(`ℹ️  No existe "${LOSER}". Nada que mergear.`);
      await client.query('ROLLBACK');
      return;
    }
    console.log(`   winner_id=${winner.id} loser_id=${loser.id}`);

    const { rows: loserSectors } = await client.query(
      'SELECT id, name FROM limpieza_sectores WHERE cliente_id = $1',
      [loser.id]
    );
    console.log(`   sectores en loser: ${loserSectors.length}`);

    let secMovidos = 0, secFusionados = 0, puestosMovidos = 0, puestosDup = 0;

    for (const ls of loserSectors) {
      const { rows: existingSec } = await client.query(
        'SELECT id FROM limpieza_sectores WHERE cliente_id = $1 AND name = $2',
        [winner.id, ls.name]
      );

      let targetSectorId;
      if (existingSec.length > 0) {
        targetSectorId = existingSec[0].id;
        secFusionados++;
      } else {
        await client.query(
          'UPDATE limpieza_sectores SET cliente_id = $1 WHERE id = $2',
          [winner.id, ls.id]
        );
        targetSectorId = ls.id;
        secMovidos++;
        continue; // sector recién reparentado → sus puestos ya apuntan a él, no hace falta mover puestos
      }

      const { rows: loserPuestos } = await client.query(
        'SELECT id, turno, nombre FROM limpieza_puestos WHERE sector_id = $1',
        [ls.id]
      );
      for (const lp of loserPuestos) {
        const { rows: dup } = await client.query(
          'SELECT id FROM limpieza_puestos WHERE sector_id = $1 AND turno = $2 AND nombre = $3',
          [targetSectorId, lp.turno, lp.nombre]
        );
        if (dup.length > 0) {
          puestosDup++;
          continue;
        }
        const { rows: ord } = await client.query(
          `SELECT COALESCE(MAX(orden), -1) + 1 AS n FROM limpieza_puestos WHERE sector_id = $1 AND turno = $2`,
          [targetSectorId, lp.turno]
        );
        await client.query(
          'UPDATE limpieza_puestos SET sector_id = $1, orden = $2 WHERE id = $3',
          [targetSectorId, ord[0].n, lp.id]
        );
        puestosMovidos++;
      }

      await client.query('UPDATE limpieza_sectores SET active = 0 WHERE id = $1', [ls.id]);
    }

    await client.query('UPDATE limpieza_clientes SET active = 0 WHERE id = $1', [loser.id]);

    await client.query('COMMIT');
    console.log(`\n✅ Merge OK`);
    console.log(`   sectores movidos: ${secMovidos}`);
    console.log(`   sectores ya existentes (fusionados): ${secFusionados}`);
    console.log(`   puestos movidos: ${puestosMovidos}`);
    console.log(`   puestos duplicados omitidos: ${puestosDup}`);
    console.log(`   "${LOSER}" desactivado (active=0), no borrado.`);
    console.log(`   limpieza_asistencia intacta.`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Error, rollback aplicado:', e);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
