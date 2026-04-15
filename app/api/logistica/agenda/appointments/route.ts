import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { parseOrderItems } from '@/lib/agenda-helpers';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'supervisor'];

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';
    const status = searchParams.get('status') || '';
    const empresa = searchParams.get('empresa') || '';
    const search = searchParams.get('search')?.trim() || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (from) { conditions.push('s.fecha >= ?'); params.push(from); }
    if (to) { conditions.push('s.fecha <= ?'); params.push(to); }
    if (status) { conditions.push('a.status = ?'); params.push(status); }
    if (empresa) { conditions.push('e.empresa = ?'); params.push(empresa); }
    if (search) {
      conditions.push('(LOWER(e.nombre) LIKE ? OR LOWER(e.documento) LIKE ?)');
      const t = `%${search.toLowerCase()}%`;
      params.push(t, t);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows, total] = await Promise.all([
      db.query(
        `SELECT a.*,
                e.nombre as employee_nombre, e.documento as employee_documento,
                e.empresa as employee_empresa, e.sector as employee_sector,
                s.fecha as slot_fecha, s.start_time as slot_start, s.end_time as slot_end
         FROM agenda_appointments a
         JOIN agenda_employees e ON e.id = a.employee_id
         JOIN agenda_time_slots s ON s.id = a.time_slot_id
         ${where}
         ORDER BY s.fecha DESC, s.start_time DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ),
      db.get(
        `SELECT COUNT(*) as count FROM agenda_appointments a
         JOIN agenda_employees e ON e.id = a.employee_id
         JOIN agenda_time_slots s ON s.id = a.time_slot_id
         ${where}`,
        params
      ),
    ]);

    const appointments = rows.map((r: any) => ({
      ...r,
      order_items: parseOrderItems(r.order_items),
      delivered_order_items: parseOrderItems(r.delivered_order_items),
    }));

    return NextResponse.json({ appointments, total: total?.count || 0, page, limit });
  } catch (err) {
    console.error('Error listando citas:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
