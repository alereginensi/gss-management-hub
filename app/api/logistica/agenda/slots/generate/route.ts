import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { generateSlotsForMonth, logAudit } from '@/lib/agenda-helpers';

const AUTH_ROLES = ['admin', 'logistica', 'jefe'];

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      year,
      month,
      days_of_week,
      start_hour,
      end_hour,
      num_slots,
      has_break,
      break_start,
      break_end,
      capacity,
    } = body;

    if (!year || !month) return NextResponse.json({ error: 'year y month son requeridos' }, { status: 400 });
    if (!days_of_week || !Array.isArray(days_of_week) || days_of_week.length === 0) {
      return NextResponse.json({ error: 'days_of_week requerido (array de números 0-6)' }, { status: 400 });
    }
    if (!start_hour || !end_hour) return NextResponse.json({ error: 'start_hour y end_hour requeridos (HH:MM)' }, { status: 400 });
    if (!num_slots || num_slots < 1) return NextResponse.json({ error: 'num_slots debe ser >= 1' }, { status: 400 });

    const result = await generateSlotsForMonth({
      year: parseInt(year, 10),
      month: parseInt(month, 10),
      days_of_week,
      start_hour,
      end_hour,
      num_slots: parseInt(num_slots, 10),
      has_break: !!has_break,
      break_start: break_start ?? undefined,
      break_end: break_end ?? undefined,
      capacity: capacity ?? 1,
    });

    await logAudit('create', 'slot', null, session.user.id, {
      year,
      month,
      ...result,
      days_of_week,
      start_hour,
      end_hour,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('Error generando slots:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
