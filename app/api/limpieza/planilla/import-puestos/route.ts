import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

const ALLOWED_ROLES = ['admin', 'jefe', 'supervisor'];

interface ItemToImport {
  sector: string;
  puesto: string;
  turno: string;
  nombre?: string;
  cedula?: string;
  categoria?: string;
  fecha?: string; // si viene del panel, cada fila trae su propia fecha (override)
}

// POST /api/limpieza/planilla/import-puestos
// Body JSON: { fecha, cliente, filename?, items: ItemToImport[] }
// Inserta filas en limpieza_asistencia con planificado=1, asistio=null.
// Usado desde el preview del modal "Subir planilla" cuando el Excel trae
// distribución por Lugar/Lugar en planilla/Turno (con o sin funcionario).
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const fecha = String(body.fecha || '').trim();
    const cliente = String(body.cliente || '').trim();
    const filename = String(body.filename || 'planilla.xlsx');
    const items = Array.isArray(body.items) ? body.items as ItemToImport[] : [];

    if (!fecha || !cliente) {
      return NextResponse.json({ error: 'Faltan fecha o cliente' }, { status: 400 });
    }
    if (!items.length) {
      return NextResponse.json({ error: 'No hay items para importar' }, { status: 400 });
    }

    // Agrupar por turno para el campo "seccion" (el batch admite varios turnos si hace falta,
    // pero la tabla limpieza_planilla_imports pide una seccion por batch → usamos el turno
    // más frecuente o "MULTIPLES" como etiqueta).
    const turnoCounts = new Map<string, number>();
    for (const it of items) {
      const t = (it.turno || '').trim();
      if (t) turnoCounts.set(t, (turnoCounts.get(t) || 0) + 1);
    }
    let seccionBatch = 'MULTIPLES';
    if (turnoCounts.size === 1) seccionBatch = [...turnoCounts.keys()][0];

    const batchRes = await db.run(
      `INSERT INTO limpieza_planilla_imports (fecha, seccion, cliente, sector, filename, uploaded_by, rows_created)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [fecha, seccionBatch, cliente, null, filename, session.user.id || null]
    );
    const batchId = batchRes.lastInsertRowid ? Number(batchRes.lastInsertRowid) : null;

    let created = 0;
    const skipped: { puesto: string; sector: string; turno: string; cedula?: string }[] = [];
    for (const it of items) {
      const sector = String(it.sector || '').trim();
      const puesto = String(it.puesto || '').trim();
      const turno = String(it.turno || '').trim();
      if (!sector || !puesto || !turno) continue;

      // Si la fila trae su propia fecha (del panel), usarla; sino usar la fecha del form
      const fechaRow = it.fecha && /^\d{4}-\d{2}-\d{2}$/.test(it.fecha) ? it.fecha : fecha;
      const nombre = it.nombre ? String(it.nombre).trim() : null;
      const cedula = it.cedula ? String(it.cedula).trim() : null;
      const categoria = it.categoria ? String(it.categoria).trim() : null;

      // Anti-duplicado: misma fecha + seccion(turno) + sector + puesto + (cedula si hay)
      const dup = cedula
        ? await db.get(
            `SELECT id FROM limpieza_asistencia
             WHERE fecha = ? AND seccion = ? AND cliente = ? AND sector = ? AND puesto = ? AND cedula = ?`,
            [fechaRow, turno, cliente, sector, puesto, cedula]
          )
        : await db.get(
            `SELECT id FROM limpieza_asistencia
             WHERE fecha = ? AND seccion = ? AND cliente = ? AND sector = ? AND puesto = ?
               AND (cedula IS NULL OR cedula = '')`,
            [fechaRow, turno, cliente, sector, puesto]
          );
      if (dup) { skipped.push({ puesto, sector, turno, cedula: cedula || undefined }); continue; }

      // Vincular con limpieza_usuarios si hay cedula
      const lu = cedula ? await db.get('SELECT id FROM limpieza_usuarios WHERE cedula = ?', [cedula]) : null;

      await db.run(
        `INSERT INTO limpieza_asistencia
         (fecha, seccion, funcionario_id, nombre, cedula, cliente, sector, puesto, categoria, planificado, import_batch_id, asistio)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NULL)`,
        [fechaRow, turno, lu?.id || null, nombre, cedula, cliente, sector, puesto, categoria, batchId]
      );
      created++;
    }

    if (batchId) {
      await db.run('UPDATE limpieza_planilla_imports SET rows_created = ? WHERE id = ?', [created, batchId]);
    }

    return NextResponse.json({ success: true, batchId, created, skipped });
  } catch (err: any) {
    console.error('Error import-puestos:', err);
    return NextResponse.json({ error: err.message || 'Error al importar' }, { status: 500 });
  }
}
