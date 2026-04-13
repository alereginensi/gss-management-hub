import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');

    const today = new Date().toISOString().split('T')[0];
    const dateFrom = desde || today;
    const dateTo = hasta || (() => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return d.toISOString().split('T')[0];
    })();

    const isPg = (db as any).type === 'pg';

    // Liberar holds expirados antes de listar
    if (isPg) {
      await db.run(`UPDATE agenda_time_slots SET held_until = NULL, hold_token = NULL WHERE held_until < NOW()`, []);
    } else {
      await db.run(`UPDATE agenda_time_slots SET held_until = NULL, hold_token = NULL WHERE held_until < datetime('now')`, []);
    }

    const slots = await db.query(
      `SELECT id, fecha, start_time, end_time, capacity, current_bookings,
              CASE WHEN held_until IS NOT NULL THEN 1 ELSE 0 END AS is_held
       FROM agenda_time_slots
       WHERE fecha >= ? AND fecha <= ?
         AND estado = 'activo'
         AND current_bookings < capacity
       ORDER BY fecha, start_time`,
      [dateFrom, dateTo]
    );

    // Calcular disponibilidad neta (descontando hold activo)
    const available = slots.map((s: any) => ({
      ...s,
      available: s.capacity - s.current_bookings - (s.is_held ? 1 : 0),
    })).filter((s: any) => s.available > 0);

    return NextResponse.json(available);
  } catch (err) {
    console.error('Error listando slots:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
