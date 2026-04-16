import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { logAudit } from '@/lib/agenda-helpers';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'rrhh', 'supervisor'];

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  const slot = await db.get('SELECT * FROM agenda_time_slots WHERE id = ?', [id]);
  if (!slot) return NextResponse.json({ error: 'Slot no encontrado' }, { status: 404 });

  try {
    const body = await request.json();
    const { fecha, start_time, end_time, capacity, estado } = body;

    await db.run(
      `UPDATE agenda_time_slots SET
        fecha = COALESCE(?, fecha),
        start_time = COALESCE(?, start_time),
        end_time = COALESCE(?, end_time),
        capacity = COALESCE(?, capacity),
        estado = COALESCE(?, estado)
       WHERE id = ?`,
      [fecha || null, start_time || null, end_time || null, capacity ?? null, estado || null, id]
    );

    const updated = await db.get('SELECT * FROM agenda_time_slots WHERE id = ?', [id]);
    await logAudit('update', 'slot', id, session.user.id, { changes: body });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('Error actualizando slot:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  const slot = await db.get('SELECT * FROM agenda_time_slots WHERE id = ?', [id]);
  if (!slot) return NextResponse.json({ error: 'Slot no encontrado' }, { status: 404 });

  // No eliminar si tiene reservas confirmadas
  const bookings = await db.get(
    `SELECT COUNT(*) as count FROM agenda_appointments WHERE time_slot_id = ? AND status NOT IN ('cancelada')`,
    [id]
  );
  if (bookings?.count > 0) {
    return NextResponse.json({ error: 'El slot tiene citas activas; cancélalas primero' }, { status: 409 });
  }

  try {
    await db.run('DELETE FROM agenda_time_slots WHERE id = ?', [id]);
    await logAudit('delete', 'slot', id, session.user.id, { fecha: slot.fecha, start_time: slot.start_time });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error eliminando slot:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
