import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { parseOrderItems, logAudit } from '@/lib/agenda-helpers';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'supervisor'];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  try {
    const row = await db.get(
      `SELECT a.*,
              e.nombre as employee_nombre, e.documento as employee_documento,
              e.empresa as employee_empresa, e.sector as employee_sector,
              e.puesto as employee_puesto, e.talle_superior, e.talle_inferior, e.calzado,
              s.fecha as slot_fecha, s.start_time as slot_start, s.end_time as slot_end
       FROM agenda_appointments a
       JOIN agenda_employees e ON e.id = a.employee_id
       JOIN agenda_time_slots s ON s.id = a.time_slot_id
       WHERE a.id = ?`,
      [id]
    );
    if (!row) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });

    return NextResponse.json({
      ...row,
      order_items: parseOrderItems(row.order_items),
      delivered_order_items: parseOrderItems(row.delivered_order_items),
    });
  } catch (err) {
    console.error('Error obteniendo cita:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  const appt = await db.get('SELECT * FROM agenda_appointments WHERE id = ?', [id]);
  if (!appt) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });

  try {
    const body = await request.json();
    const { status, delivery_notes, remito_number } = body;

    const isPg = (db as any).type === 'pg';
    const nowSql = isPg ? 'NOW()' : "datetime('now')";

    await db.run(
      `UPDATE agenda_appointments SET
        status = COALESCE(?, status),
        delivery_notes = COALESCE(?, delivery_notes),
        remito_number = COALESCE(?, remito_number),
        updated_at = ${nowSql}
       WHERE id = ?`,
      [status || null, delivery_notes ?? null, remito_number ?? null, id]
    );

    const updated = await db.get('SELECT * FROM agenda_appointments WHERE id = ?', [id]);
    await logAudit('update', 'appointment', id, session.user.id, { changes: body });
    return NextResponse.json({
      ...updated,
      order_items: parseOrderItems(updated.order_items),
      delivered_order_items: parseOrderItems(updated.delivered_order_items),
    });
  } catch (err) {
    console.error('Error actualizando cita:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
