import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { logAudit } from '@/lib/agenda-helpers';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'rrhh', 'supervisor'];

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';
    const estado = searchParams.get('estado') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (from) { conditions.push('fecha >= ?'); params.push(from); }
    if (to) { conditions.push('fecha <= ?'); params.push(to); }
    if (estado) { conditions.push('estado = ?'); params.push(estado); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows, countRow] = await Promise.all([
      db.query(`SELECT * FROM agenda_time_slots ${where} ORDER BY fecha ASC, start_time ASC LIMIT ? OFFSET ?`, [...params, limit, offset]),
      db.get(`SELECT COUNT(*) as count FROM agenda_time_slots ${where}`, params),
    ]);

    // Enriquecer con la cita más relevante por slot
    let appointmentMap: Record<number, unknown> = {};
    if ((rows as unknown[]).length > 0) {
      const slotIds = (rows as { id: number }[]).map(s => s.id);
      const ph = slotIds.map(() => '?').join(',');
      const appts = await db.query(
        `SELECT a.id, a.time_slot_id, a.status, a.employee_id, e.nombre as employee_nombre
         FROM agenda_appointments a
         LEFT JOIN agenda_employees e ON e.id = a.employee_id
         WHERE a.time_slot_id IN (${ph}) AND a.status != 'cancelada'
         ORDER BY CASE a.status WHEN 'confirmada' THEN 0 WHEN 'en_proceso' THEN 1 ELSE 2 END`,
        slotIds
      );
      for (const a of (appts as { time_slot_id: number }[])) {
        if (!appointmentMap[a.time_slot_id]) appointmentMap[a.time_slot_id] = a;
      }
    }

    const slots = (rows as { id: number }[]).map(s => ({
      ...s,
      appointment: appointmentMap[s.id] ?? null,
    }));

    return NextResponse.json({ slots, total: countRow?.count || 0, page, limit });
  } catch (err) {
    console.error('Error listando slots:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const fecha = new URL(request.url).searchParams.get('fecha');
  if (!fecha) return NextResponse.json({ error: 'fecha requerida' }, { status: 400 });

  try {
    const slotsOfDay = await db.query(
      'SELECT id FROM agenda_time_slots WHERE fecha = ?', [fecha]
    ) as { id: number }[];

    let deleted = 0;
    let skipped = 0;
    const skippedIds: number[] = [];

    for (const s of slotsOfDay) {
      const bookings = await db.get(
        `SELECT COUNT(*) as count FROM agenda_appointments WHERE time_slot_id = ? AND status NOT IN ('cancelada')`,
        [s.id]
      ) as { count: number };

      if (bookings.count > 0) {
        skipped++;
        skippedIds.push(s.id);
      } else {
        await db.run('DELETE FROM agenda_time_slots WHERE id = ?', [s.id]);
        deleted++;
      }
    }

    await logAudit('delete', 'slot', null, session.user.id, { fecha, deleted, skipped });
    return NextResponse.json({ ok: true, deleted, skipped, skippedIds });
  } catch (err) {
    console.error('Error eliminando día:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { fecha, start_time, end_time, capacity } = body;

    if (!fecha) return NextResponse.json({ error: 'Fecha requerida' }, { status: 400 });
    if (!start_time) return NextResponse.json({ error: 'Hora inicio requerida' }, { status: 400 });
    if (!end_time) return NextResponse.json({ error: 'Hora fin requerida' }, { status: 400 });

    const isPg = (db as any).type === 'pg';
    let id: number;

    if (isPg) {
      const res = await db.query(
        `INSERT INTO agenda_time_slots (fecha, start_time, end_time, capacity) VALUES ($1,$2,$3,$4) RETURNING id`,
        [fecha, start_time, end_time, capacity ?? 1]
      );
      id = res[0]?.id;
    } else {
      const result = await db.run(
        `INSERT INTO agenda_time_slots (fecha, start_time, end_time, capacity) VALUES (?,?,?,?)`,
        [fecha, start_time, end_time, capacity ?? 1]
      );
      id = result.lastInsertRowid as number;
    }

    const created = await db.get('SELECT * FROM agenda_time_slots WHERE id = ?', [id]);
    await logAudit('create', 'slot', id, session.user.id, { fecha, start_time, end_time });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('Error creando slot:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
