import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { isJornalesRole } from '@/lib/jornales-helpers';

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

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { raw: false });

    const personas: Array<{ padron: string; nombre: string; doc: string }> = [];
    for (const r of rows) {
      const padron = findCol(r, ['Padron', 'Padrón', 'ID', 'Numero de empleado', 'Número de empleado', 'padron']);
      const nombre = findCol(r, ['Nombre', 'nombre']);
      const apellido = findCol(r, ['Apellido', 'apellido']);
      const doc = findCol(r, ['Cedula', 'Cédula', 'CI', 'Documento', 'documento']);
      if (!padron || !nombre) continue;
      personas.push({
        padron,
        nombre: nombre + (apellido ? ' ' + apellido : ''),
        doc: doc || '',
      });
    }

    if (!personas.length) {
      return NextResponse.json({ error: 'No se encontraron columnas Padrón y Nombre' }, { status: 400 });
    }

    // Reemplaza todo el personal (mismo comportamiento que el zip original: cargar lista = setPersonal)
    await db.run(`DELETE FROM jornales_personal`, []);

    const isPg = (db as any).type === 'pg';
    let insertados = 0;
    for (const p of personas) {
      try {
        if (isPg) {
          const res = await db.query(
            `INSERT INTO jornales_personal (padron, nombre, doc)
             VALUES ($1, $2, $3)
             ON CONFLICT (padron) DO NOTHING
             RETURNING id`,
            [p.padron, p.nombre, p.doc || null],
          );
          if (res.length > 0) insertados++;
        } else {
          const res = await db.run(
            `INSERT OR IGNORE INTO jornales_personal (padron, nombre, doc) VALUES (?, ?, ?)`,
            [p.padron, p.nombre, p.doc || null],
          );
          if (res.changes > 0) insertados++;
        }
      } catch (e) {
        console.warn('Fila inválida:', p, e);
      }
    }

    return NextResponse.json({ insertados, total_filas: rows.length });
  } catch (err: any) {
    console.error('Error importando personal jornales:', err);
    return NextResponse.json({ error: err?.message || 'Error procesando archivo' }, { status: 500 });
  }
}
