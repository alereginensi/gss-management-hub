import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { isJornalesRole, parseFechaToIso } from '@/lib/jornales-helpers';

function findCol(row: Record<string, any>, keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && String(row[k]).trim() !== '') return String(row[k]).trim();
    for (const rk in row) {
      if (rk.trim().toLowerCase() === k.toLowerCase() && row[rk] !== undefined && String(row[rk]).trim() !== '') {
        return String(row[rk]).trim();
      }
    }
  }
  return '';
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !isJornalesRole(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });

    const fileKey = `${file.name}|${file.size}`;
    const existing = await db.get(`SELECT id FROM jornales_archivos WHERE file_key = ?`, [fileKey]);
    if (existing) {
      return NextResponse.json({ omitido: true, razon: `"${file.name}" ya estaba cargado` });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { raw: false });
    if (!rows.length) return NextResponse.json({ error: `Archivo vacío: ${file.name}` }, { status: 400 });

    // Construir set de padrones con efectividad autorizada (sus marcas se ignoran)
    const autorizadosRows = await db.query(
      `SELECT padron FROM jornales_personal WHERE efectividad_autorizada = 1`,
    );
    const autorizados = new Set(autorizadosRows.map((r: any) => r.padron));

    // Crear registro del archivo (placeholder; registros_nuevos se actualiza al final)
    const isPg = (db as any).type === 'pg';
    let fileId: number;
    if (isPg) {
      const res = await db.query(
        `INSERT INTO jornales_archivos (file_key, name, size, registros_totales, registros_nuevos, uploaded_by)
         VALUES ($1, $2, $3, $4, 0, $5) RETURNING id`,
        [fileKey, file.name, file.size, rows.length, session.user.id || null],
      );
      fileId = Number(res[0]?.id);
    } else {
      const res = await db.run(
        `INSERT INTO jornales_archivos (file_key, name, size, registros_totales, registros_nuevos, uploaded_by)
         VALUES (?, ?, ?, ?, 0, ?)`,
        [fileKey, file.name, file.size, rows.length, session.user.id || null],
      );
      fileId = Number(res.lastInsertRowid);
    }

    let nuevos = 0;
    let dups = 0;
    for (const r of rows) {
      const padron = findCol(r, ['Número de empleado', 'Numero de empleado', 'Padron', 'Padrón']);
      if (!padron) continue;
      if (autorizados.has(padron)) continue;

      const fechaRaw = r['Fecha'] ?? (r as any)['fecha'];
      const fechaIso = parseFechaToIso(fechaRaw);
      if (!fechaIso) continue;

      const lugar = String(r['Lugar'] ?? (r as any)['lugar'] ?? '').trim();

      try {
        if (isPg) {
          const res = await db.query(
            `INSERT INTO jornales_marcas (padron, fecha, lugar, file_id)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (padron, fecha, lugar) DO NOTHING
             RETURNING id`,
            [padron, fechaIso, lugar, fileId],
          );
          if (res.length > 0) nuevos++;
          else dups++;
        } else {
          const res = await db.run(
            `INSERT OR IGNORE INTO jornales_marcas (padron, fecha, lugar, file_id) VALUES (?, ?, ?, ?)`,
            [padron, fechaIso, lugar, fileId],
          );
          if (res.changes > 0) nuevos++;
          else dups++;
        }
      } catch (e) {
        console.warn('Fila de marca inválida ignorada:', e);
      }
    }

    await db.run(`UPDATE jornales_archivos SET registros_nuevos = ? WHERE id = ?`, [nuevos, fileId]);

    return NextResponse.json({ nuevos, dups, total: rows.length, file_id: fileId });
  } catch (err: any) {
    console.error('Error procesando marcas:', err);
    return NextResponse.json({ error: err?.message || 'Error procesando archivo' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !isJornalesRole(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await db.run(`DELETE FROM jornales_marcas`, []);
    await db.run(`DELETE FROM jornales_archivos`, []);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error limpiando marcas:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
