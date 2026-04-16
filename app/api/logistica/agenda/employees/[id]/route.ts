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

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores pueden eliminar empleados' }, { status: 403 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  await db.run(`DELETE FROM agenda_employees WHERE id = ?`, [id]);
  await logAudit('delete', 'employee', id, session.user.id, { action: 'delete_fisico' });
  return NextResponse.json({ success: true });
}
