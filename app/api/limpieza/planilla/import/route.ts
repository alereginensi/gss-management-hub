import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import ExcelJS from 'exceljs';

const ALLOWED_ROLES = ['admin', 'jefe', 'supervisor'];

// Normaliza keys de cabecera: quita tildes, espacios y pasa a minúsculas
function normKey(s: any): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

// POST /api/limpieza/planilla/import
// multipart/form-data: file=<xlsx>, fecha, seccion, cliente, sector?
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    const fecha = String(form.get('fecha') || '').trim();
    const seccion = String(form.get('seccion') || '').trim();
    const cliente = String(form.get('cliente') || '').trim();
    const sector = String(form.get('sector') || '').trim();
    const categoriaDefault = String(form.get('categoria') || '').trim();

    if (!file || !fecha || !seccion || !cliente) {
      return NextResponse.json({ error: 'Faltan parámetros: file, fecha, seccion, cliente' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];
    if (!ws) return NextResponse.json({ error: 'El archivo no tiene hojas' }, { status: 400 });

    // Detectar fila de cabecera (la primera con "nombre" y "documento"/"cedula")
    let headerRow = 0;
    const colMap: Record<string, number> = {};
    for (let r = 1; r <= Math.min(ws.rowCount, 20); r++) {
      const row = ws.getRow(r);
      const keys: Record<string, number> = {};
      for (let c = 1; c <= Math.min(ws.columnCount, 30); c++) {
        const k = normKey(row.getCell(c).value);
        if (k) keys[k] = c;
      }
      const nombreCol = keys['nombre'] || keys['nombrecompleto'] || keys['funcionario'] || keys['apellidoynombre'];
      const docCol = keys['documento'] || keys['cedula'] || keys['ci'] || keys['ciudadania'];
      if (nombreCol && docCol) {
        headerRow = r;
        Object.assign(colMap, keys);
        break;
      }
    }
    if (!headerRow) {
      return NextResponse.json({ error: 'No se encontró cabecera con columnas Nombre y Documento/Cédula.' }, { status: 400 });
    }

    const colNombre = colMap['nombre'] || colMap['nombrecompleto'] || colMap['funcionario'] || colMap['apellidoynombre'];
    const colDoc = colMap['documento'] || colMap['cedula'] || colMap['ci'] || colMap['ciudadania'];
    const colSector = colMap['sector'] || colMap['area'] || 0;
    const colPuesto = colMap['puesto'] || colMap['cargo'] || 0;
    const colCategoria = colMap['categoria'] || colMap['tipo'] || 0;

    // Crear batch
    const batchRes = await db.run(
      `INSERT INTO limpieza_planilla_imports (fecha, seccion, cliente, sector, filename, uploaded_by, rows_created)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [fecha, seccion, cliente, sector || null, (file as any).name || 'planilla.xlsx', session.user.id || null]
    );
    const batchId = batchRes.lastInsertRowid ? Number(batchRes.lastInsertRowid) : null;

    let created = 0;
    const skipped: string[] = [];
    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const getText = (col: number) => {
        if (!col) return '';
        let v = row.getCell(col).value as any;
        if (v && typeof v === 'object') {
          if (v.richText) v = v.richText.map((p: any) => p.text).join('');
          else if (v.text !== undefined) v = v.text;
          else if (v.result !== undefined) v = v.result;
        }
        return String(v ?? '').trim();
      };
      const nombre = getText(colNombre);
      const documento = getText(colDoc);
      if (!nombre || !documento) continue;

      const rowSector = getText(colSector) || sector || '';
      const rowPuesto = getText(colPuesto);
      const rowCategoria = getText(colCategoria) || categoriaDefault;

      // Anti-duplicado dentro del mismo turno/fecha
      const dup = await db.get(
        'SELECT id FROM limpieza_asistencia WHERE fecha = ? AND seccion = ? AND cedula = ?',
        [fecha, seccion, documento]
      );
      if (dup) { skipped.push(documento); continue; }

      // Vincular con limpieza_usuarios si existe
      const lu = await db.get('SELECT id FROM limpieza_usuarios WHERE cedula = ?', [documento]);

      await db.run(
        `INSERT INTO limpieza_asistencia
         (fecha, seccion, funcionario_id, nombre, cedula, cliente, sector, puesto, categoria, planificado, import_batch_id, asistio)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NULL)`,
        [fecha, seccion, lu?.id || null, nombre, documento, cliente, rowSector || null, rowPuesto || null, rowCategoria || null, batchId]
      );
      created++;
    }

    if (batchId) {
      await db.run('UPDATE limpieza_planilla_imports SET rows_created = ? WHERE id = ?', [created, batchId]);
    }

    return NextResponse.json({ success: true, batchId, created, skipped });
  } catch (err: any) {
    console.error('Error import planilla:', err);
    return NextResponse.json({ error: err.message || 'Error al importar planilla' }, { status: 500 });
  }
}

// DELETE /api/limpieza/planilla/import?batch_id=... — rollback del lote (solo admin)
export async function DELETE(request: NextRequest) {
  const session = await getSession(request);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get('batch_id');
  if (!batchId) return NextResponse.json({ error: 'batch_id requerido' }, { status: 400 });
  try {
    await db.run('DELETE FROM limpieza_asistencia WHERE import_batch_id = ?', [batchId]);
    await db.run('DELETE FROM limpieza_planilla_imports WHERE id = ?', [batchId]);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
