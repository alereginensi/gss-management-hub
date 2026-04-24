import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { parseLicenciasFromExcel, detectarMatchesContraDB, type ImportStrategy, type LicenciaParseada } from '@/lib/licencias-import';

export const maxDuration = 120;

const INSERT_SQL = `INSERT INTO rrhh_licencias (
  remitente, padron, funcionario, nombre_servicio, sector, tipo_licencia,
  desde, hasta, suplente, recep_notificacion, supervision,
  recep_certificado, planificacion, observaciones, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const UPDATE_SQL = `UPDATE rrhh_licencias SET
  remitente = ?, padron = ?, funcionario = ?, nombre_servicio = ?, sector = ?,
  tipo_licencia = ?, desde = ?, hasta = ?, suplente = ?,
  recep_notificacion = ?, supervision = ?, recep_certificado = ?,
  planificacion = ?, observaciones = ?, updated_at = ?
WHERE id = ?`;

function insertParams(v: LicenciaParseada, now: string): unknown[] {
  return [
    v.remitente, v.padron, v.funcionario, v.nombre_servicio, v.sector, v.tipo_licencia,
    v.desde, v.hasta, v.suplente, v.recep_notificacion, v.supervision,
    v.recep_certificado, v.planificacion, v.observaciones, now, now,
  ];
}

function updateParams(v: LicenciaParseada, id: number, now: string): unknown[] {
  return [
    v.remitente, v.padron, v.funcionario, v.nombre_servicio, v.sector,
    v.tipo_licencia, v.desde, v.hasta, v.suplente,
    v.recep_notificacion, v.supervision, v.recep_certificado,
    v.planificacion, v.observaciones, now, id,
  ];
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo admin puede importar el histórico' }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get('file');
    const yearParam = form.get('year');
    const strategy = (String(form.get('strategy') || 'merge') as ImportStrategy);

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    }
    const year = parseInt(String(yearParam || ''), 10) || new Date().getFullYear();

    const buffer = Buffer.from(await file.arrayBuffer());
    const { validas, errores, totalFilas, descartadas } = parseLicenciasFromExcel(buffer, year);

    if (strategy === 'replace') {
      await db.run(`DELETE FROM rrhh_licencias`, []);
    }

    const now = new Date().toISOString();
    let insertados = 0;
    let actualizados = 0;

    if (strategy === 'upsert') {
      const { nuevas, actualizaciones } = await detectarMatchesContraDB(validas, db as unknown as { get: (sql: string, p: unknown[]) => Promise<{ id?: number } | null> });
      for (const v of nuevas) {
        try {
          await db.run(INSERT_SQL, insertParams(v, now));
          insertados++;
        } catch (e) {
          errores.push(`Insert "${v.funcionario}" (${v.desde || '?'}): ${(e as Error).message}`);
        }
      }
      for (const { id, data } of actualizaciones) {
        try {
          await db.run(UPDATE_SQL, updateParams(data, id, now));
          actualizados++;
        } catch (e) {
          errores.push(`Update "${data.funcionario}" (${data.desde || '?'}): ${(e as Error).message}`);
        }
      }
    } else {
      // merge (o replace ya hizo DELETE arriba): insert lineal de todo.
      for (const v of validas) {
        try {
          await db.run(INSERT_SQL, insertParams(v, now));
          insertados++;
        } catch (e) {
          errores.push(`Error en "${v.funcionario}" (${v.desde || '?'}): ${(e as Error).message}`);
        }
      }
    }

    return NextResponse.json({
      insertados,
      actualizados,
      total_filas: totalFilas,
      descartadas,
      strategy,
      errores: errores.slice(0, 20),
    });
  } catch (err) {
    console.error('Error importando licencias:', err);
    return NextResponse.json({ error: (err as Error).message || 'Error interno' }, { status: 500 });
  }
}
