import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { parseLicenciasFromExcel } from '@/lib/licencias-import';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo admin puede importar el histórico' }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get('file');
    const yearParam = form.get('year');
    const strategy = String(form.get('strategy') || 'merge');

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
    const insertSql = `INSERT INTO rrhh_licencias (
      remitente, padron, funcionario, nombre_servicio, sector, tipo_licencia,
      desde, hasta, suplente, recep_notificacion, supervision,
      recep_certificado, planificacion, observaciones, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    for (const v of validas) {
      try {
        await db.run(insertSql, [
          v.remitente, v.padron, v.funcionario, v.nombre_servicio, v.sector, v.tipo_licencia,
          v.desde, v.hasta, v.suplente, v.recep_notificacion, v.supervision,
          v.recep_certificado, v.planificacion, v.observaciones, now, now,
        ]);
        insertados++;
      } catch (e) {
        errores.push(`Error en "${v.funcionario}" (${v.desde || '?'}): ${(e as Error).message}`);
      }
    }

    return NextResponse.json({
      insertados,
      total_filas: totalFilas,
      descartadas,
      errores: errores.slice(0, 20),
    });
  } catch (err) {
    console.error('Error importando licencias:', err);
    return NextResponse.json({ error: (err as Error).message || 'Error interno' }, { status: 500 });
  }
}
