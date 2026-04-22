import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { logAudit } from '@/lib/agenda-helpers';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'rrhh', 'supervisor'];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const employee = await db.get('SELECT * FROM agenda_employees WHERE id = ?', [id]);
  if (!employee) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });

  // Citas del empleado
  const appointments = await db.query(
    `SELECT a.id, a.status, a.order_items, a.delivered_order_items, a.remito_number, a.delivered_at, a.created_at,
            s.fecha, s.start_time, s.end_time
     FROM agenda_appointments a JOIN agenda_time_slots s ON s.id = a.time_slot_id
     WHERE a.employee_id = ? ORDER BY a.created_at DESC LIMIT 20`,
    [id]
  );

  // Artículos del empleado
  const articles = await db.query(
    'SELECT * FROM agenda_articles WHERE employee_id = ? ORDER BY delivery_date DESC',
    [id]
  );

  return NextResponse.json({ employee, appointments, articles });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  try {
    const body = await request.json();
    const { nombre, empresa, sector, puesto, workplace_category, fecha_ingreso, talle_superior, talle_inferior, calzado, enabled, allow_reorder, estado, observaciones } = body;

    if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });

    await db.run(
      `UPDATE agenda_employees SET nombre=?, empresa=?, sector=?, puesto=?, workplace_category=?, fecha_ingreso=?, talle_superior=?, talle_inferior=?, calzado=?, enabled=?, allow_reorder=?, estado=?, observaciones=? WHERE id=?`,
      [nombre.trim(), empresa || null, sector || null, puesto || null, workplace_category || null, fecha_ingreso || null, talle_superior || null, talle_inferior || null, calzado || null, enabled ?? 1, allow_reorder ?? 0, estado || 'activo', observaciones || null, id]
    );

    const updated = await db.get('SELECT * FROM agenda_employees WHERE id = ?', [id]);
    await logAudit('update', 'employee', id, session.user.id, { nombre, enabled, estado });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('Error actualizando empleado:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// DELETE /api/logistica/agenda/employees/[id]
// Solo admin. Elimina al empleado Y todas sus referencias en cascada:
//   - agenda_shipment_articles (via agenda_articles)
//   - agenda_articles
//   - agenda_appointment_item_changes (via agenda_appointments)
//   - agenda_egress_returns
//   - agenda_change_events (legacy)
//   - agenda_requests
//   - agenda_shipments
//   - agenda_appointments (+ decrementa current_bookings de los slots)
//   - agenda_failed_attempts (match por documento)
//   - agenda_employees
// No borra slots; solo decrementa su contador de bookings.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores pueden eliminar empleados' }, { status: 403 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  try {
    // Snapshot del empleado (necesitamos documento para borrar failed_attempts)
    const emp = await db.get('SELECT id, documento, nombre FROM agenda_employees WHERE id = ?', [id]);
    if (!emp) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });

    // Listar appointments del empleado para decrementar bookings después
    const appts = await db.query(
      'SELECT id, time_slot_id FROM agenda_appointments WHERE employee_id = ?',
      [id]
    );
    const slotIds = Array.from(new Set(
      (appts as { time_slot_id: number }[]).map(a => a.time_slot_id).filter(Boolean)
    ));

    // Orden de borrado de dependencias "hijas" → "padres":
    // 1. shipment_articles que referencian articles del empleado
    await db.run(
      `DELETE FROM agenda_shipment_articles
       WHERE article_id IN (SELECT id FROM agenda_articles WHERE employee_id = ?)`,
      [id]
    );
    // 2. articles del empleado (sus ids se usan en agenda_change_events.new_article_id/returned_article_id, que están NULL-able → OK)
    await db.run('DELETE FROM agenda_articles WHERE employee_id = ?', [id]);
    // 3. appointment_item_changes vinculados a appointments del empleado
    await db.run(
      `DELETE FROM agenda_appointment_item_changes
       WHERE appointment_id IN (SELECT id FROM agenda_appointments WHERE employee_id = ?)`,
      [id]
    );
    // 4. egresos del empleado
    await db.run('DELETE FROM agenda_egress_returns WHERE employee_id = ?', [id]);
    // 5. change_events (legacy)
    try { await db.run('DELETE FROM agenda_change_events WHERE employee_id = ?', [id]); } catch { /* legacy, ignorar si no aplica */ }
    // 6. requests del empleado
    await db.run('DELETE FROM agenda_requests WHERE employee_id = ?', [id]);
    // 7. shipments del empleado
    await db.run('DELETE FROM agenda_shipments WHERE employee_id = ?', [id]);
    // 8. appointments del empleado
    await db.run('DELETE FROM agenda_appointments WHERE employee_id = ?', [id]);
    // 9. Decrementar current_bookings de los slots afectados
    for (const slotId of slotIds) {
      await db.run(
        `UPDATE agenda_time_slots
         SET current_bookings = CASE WHEN current_bookings > 0 THEN current_bookings - 1 ELSE 0 END
         WHERE id = ?`,
        [slotId]
      );
    }
    // 10. failed_attempts (por documento, no por employee_id)
    if (emp.documento) {
      await db.run('DELETE FROM agenda_failed_attempts WHERE documento = ?', [emp.documento]);
    }
    // 11. Finalmente, el empleado
    await db.run('DELETE FROM agenda_employees WHERE id = ?', [id]);

    await logAudit('delete', 'employee', id, session.user.id, {
      action: 'delete_cascade',
      documento: emp.documento,
      nombre: emp.nombre,
      appointments_removed: appts.length,
      slots_updated: slotIds.length,
    });
    return NextResponse.json({
      success: true,
      removed: {
        appointments: appts.length,
        slots_decremented: slotIds.length,
      },
    });
  } catch (err) {
    console.error('Error eliminando empleado en cascada:', err);
    return NextResponse.json({ error: (err as Error).message || 'Error interno' }, { status: 500 });
  }
}
