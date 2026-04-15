import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { logAudit } from '@/lib/agenda-helpers';

const AUTH_ROLES = ['admin', 'logistica', 'jefe'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const apptId = parseInt(idStr, 10);

  try {
    const { new_slot_id } = await request.json();
    if (!new_slot_id) return NextResponse.json({ error: 'new_slot_id requerido' }, { status: 400 });

    const appt = await db.get(
      'SELECT * FROM agenda_appointments WHERE id = ?', [apptId]
    ) as { id: number; time_slot_id: number; status: string; employee_id: number } | undefined;

    if (!appt) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });

    const oldSlotId = appt.time_slot_id;

    if (oldSlotId === new_slot_id) {
      return NextResponse.json({ error: 'El slot destino es el mismo que el actual' }, { status: 400 });
    }

    const newSlot = await db.get(
      'SELECT * FROM agenda_time_slots WHERE id = ?', [new_slot_id]
    ) as { id: number; capacity: number; current_bookings: number; estado: string } | undefined;

    if (!newSlot) return NextResponse.json({ error: 'Slot destino no encontrado' }, { status: 404 });
    if (newSlot.estado === 'cancelado') {
      return NextResponse.json({ error: 'El slot destino está cancelado' }, { status: 409 });
    }
    if (newSlot.current_bookings >= newSlot.capacity) {
      return NextResponse.json({ error: 'El slot destino está completo' }, { status: 409 });
    }

    // Mover la cita
    await db.run(
      'UPDATE agenda_appointments SET time_slot_id = ? WHERE id = ?',
      [new_slot_id, apptId]
    );

    // Actualizar contadores
    await db.run(
      'UPDATE agenda_time_slots SET current_bookings = MAX(0, current_bookings - 1) WHERE id = ?',
      [oldSlotId]
    );
    await db.run(
      'UPDATE agenda_time_slots SET current_bookings = current_bookings + 1 WHERE id = ?',
      [new_slot_id]
    );

    await logAudit('update', 'appointment', apptId, session.user.id, {
      action: 'move',
      old_slot_id: oldSlotId,
      new_slot_id,
    });

    const updatedAppt = await db.get('SELECT * FROM agenda_appointments WHERE id = ?', [apptId]);
    return NextResponse.json({ ok: true, appointment: updatedAppt });
  } catch (err) {
    console.error('Error moviendo cita:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
