import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { parseOrderItems, logAudit } from '@/lib/agenda-helpers';
import { AGENDA_ADMIN_ROLES } from '@/lib/agenda-roles';

const AUTH_ROLES: readonly string[] = AGENDA_ADMIN_ROLES;
// DELETE solo para admin y rrhh (no logistica/jefe)
const DELETE_ROLES = ['admin', 'rrhh'];

const LIGHT_COLS = [
  'id', 'employee_id', 'returned_items',
  'remito_number', 'remito_pdf_url', 'remito_filename',
  'parsed_remito_text', 'parsed_remito_data',
  'employee_signature_url', 'responsible_signature_url',
  'notes', 'status', 'created_by', 'created_at', 'updated_at',
];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  try {
    const row = await db.get(
      `SELECT ${LIGHT_COLS.map(c => `r.${c}`).join(', ')},
              e.nombre AS employee_nombre, e.documento AS employee_documento,
              e.empresa AS employee_empresa, e.sector AS employee_sector, e.puesto AS employee_puesto
       FROM agenda_egress_returns r
       JOIN agenda_employees e ON e.id = r.employee_id
       WHERE r.id = ?`,
      [id]
    );
    if (!row) return NextResponse.json({ error: 'Egreso no encontrado' }, { status: 404 });
    return NextResponse.json({
      ...row,
      returned_items: parseOrderItems(row.returned_items),
    });
  } catch (err) {
    console.error('Error obteniendo egreso:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PUT /api/logistica/agenda/egress-returns/[id]
// Edita campos básicos del egreso: items, notas, numero de remito.
// No toca estado del empleado ni de los articulos (para eso usar DELETE → recrear).
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  try {
    const existing = await db.get('SELECT id FROM agenda_egress_returns WHERE id = ?', [id]);
    if (!existing) return NextResponse.json({ error: 'Egreso no encontrado' }, { status: 404 });

    const body = await request.json();
    const items = Array.isArray(body.returned_items)
      ? body.returned_items.filter((it: any) => it && typeof it.article_type === 'string' && it.article_type.trim())
      : null;
    const remitoNumber = typeof body.remito_number === 'string' ? body.remito_number.trim() || null : undefined;
    const notes = typeof body.notes === 'string' ? body.notes.trim() || null : undefined;

    const isPg = (db as any).type === 'pg';
    const nowSql = isPg ? 'NOW()' : "datetime('now')";

    await db.run(
      `UPDATE agenda_egress_returns SET
         returned_items = COALESCE(?, returned_items),
         remito_number = COALESCE(?, remito_number),
         notes = COALESCE(?, notes),
         updated_at = ${nowSql}
       WHERE id = ?`,
      [items ? JSON.stringify(items) : null, remitoNumber ?? null, notes ?? null, id]
    );

    await logAudit('update', 'egress_return', id, session.user.id, {
      items_count: items?.length,
      remito_changed: remitoNumber !== undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error editando egreso:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// DELETE /api/logistica/agenda/egress-returns/[id]
// Solo admin y rrhh. Borra el registro y revierte los efectos:
//   - reactiva al empleado (enabled=1, estado='activo')
//   - vuelve los artículos marcados 'devuelto' por este egreso a 'activo'
// Limitación: revierte TODOS los artículos devueltos del empleado, sin distinguir
// cuáles corresponden a este egreso específico (la tabla no guarda ese link). Si
// el empleado tiene múltiples egresos, esto puede reactivar artículos de egresos
// previos — hay que revisar manualmente en esos casos.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !DELETE_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado para eliminar' }, { status: 401 });
  }
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  try {
    const egreso = await db.get('SELECT id, employee_id FROM agenda_egress_returns WHERE id = ?', [id]);
    if (!egreso) return NextResponse.json({ error: 'Egreso no encontrado' }, { status: 404 });

    const employeeId = egreso.employee_id;

    // Chequear si el empleado tiene OTROS egresos antes de revertir su estado.
    const otros = await db.get(
      'SELECT COUNT(*) AS count FROM agenda_egress_returns WHERE employee_id = ? AND id <> ?',
      [employeeId, id]
    );
    const tieneOtrosEgresos = (otros?.count || 0) > 0;

    await db.run('DELETE FROM agenda_egress_returns WHERE id = ?', [id]);

    // Solo si no tiene otros egresos, reactivar al empleado y sus artículos.
    if (!tieneOtrosEgresos) {
      await db.run(
        `UPDATE agenda_employees SET enabled = 1, estado = 'activo' WHERE id = ?`,
        [employeeId]
      );
      await db.run(
        `UPDATE agenda_articles SET current_status = 'activo' WHERE employee_id = ? AND current_status = 'devuelto'`,
        [employeeId]
      );
    }

    await logAudit('delete', 'egress_return', id, session.user.id, { employee_id: employeeId, reverted: !tieneOtrosEgresos });

    return NextResponse.json({
      ok: true,
      employee_reactivated: !tieneOtrosEgresos,
      message: tieneOtrosEgresos
        ? 'Egreso eliminado. El empleado mantuvo su estado inactivo porque tiene otros egresos.'
        : 'Egreso eliminado. Empleado reactivado y artículos devueltos vueltos a activos.',
    });
  } catch (err) {
    console.error('Error eliminando egreso:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
