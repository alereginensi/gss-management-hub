import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { logAudit } from '@/lib/agenda-helpers';

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !['admin', 'logistica', 'jefe', 'supervisor'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const config = await db.get('SELECT * FROM agenda_config WHERE id = 1');
  return NextResponse.json(config || {});
}

export async function PUT(request: NextRequest) {
  const session = await getSession(request);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Solo admin puede modificar la configuración' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      min_advance_hours, hold_duration_seconds, public_contact_whatsapp,
      allow_reorder_global, slot_duration_minutes, slots_per_day,
      auto_generate_day,
    } = body;

    const isPg = (db as any).type === 'pg';
    const nowSql = isPg ? 'NOW()' : "datetime('now')";

    await db.run(
      `UPDATE agenda_config SET
        min_advance_hours = COALESCE(?, min_advance_hours),
        hold_duration_seconds = COALESCE(?, hold_duration_seconds),
        public_contact_whatsapp = COALESCE(?, public_contact_whatsapp),
        allow_reorder_global = COALESCE(?, allow_reorder_global),
        slot_duration_minutes = COALESCE(?, slot_duration_minutes),
        slots_per_day = COALESCE(?, slots_per_day),
        auto_generate_day = COALESCE(?, auto_generate_day),
        updated_at = ${nowSql}
       WHERE id = 1`,
      [
        min_advance_hours ?? null, hold_duration_seconds ?? null,
        public_contact_whatsapp ?? null, allow_reorder_global ?? null,
        slot_duration_minutes ?? null, slots_per_day ?? null,
        auto_generate_day ?? null,
      ]
    );

    await logAudit('config_change', 'config', 1, session.user.id, body);
    const updated = await db.get('SELECT * FROM agenda_config WHERE id = 1');
    return NextResponse.json(updated);
  } catch (err) {
    console.error('Error actualizando config agenda:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
