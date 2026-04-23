import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { parseOrderItems, APPOINTMENT_COLUMNS_LIGHT } from '@/lib/agenda-helpers';

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
        `SELECT ${APPOINTMENT_COLUMNS_LIGHT.map(c => `a.${c}`).join(', ')},
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

    // Calcular tipo_cita: ingreso | cambio | agregado | normal
    const todayIso = new Date().toISOString().slice(0, 10);
    const employeeIds = Array.from(new Set(rows.map((r: any) => r.employee_id).filter(Boolean)));
    // Fetch todos los articles del empleado una sola vez para todos los appointments
    const articlesPorEmpleado = new Map<number, { id: number; renewal_enabled_at: string | null; current_status: string; appointment_id: number | null }[]>();
    const allowReorderPorEmpleado = new Map<number, number>();
    if (employeeIds.length > 0) {
      const placeholders = employeeIds.map(() => '?').join(',');
      const articlesRows = await db.query(
        `SELECT id, employee_id, renewal_enabled_at, current_status, appointment_id
         FROM agenda_articles WHERE employee_id IN (${placeholders})`,
        employeeIds
      );
      for (const a of articlesRows as any[]) {
        if (!articlesPorEmpleado.has(a.employee_id)) articlesPorEmpleado.set(a.employee_id, []);
        articlesPorEmpleado.get(a.employee_id)!.push(a);
      }
      const empleadosRows = await db.query(
        `SELECT id, allow_reorder FROM agenda_employees WHERE id IN (${placeholders})`,
        employeeIds
      );
      for (const e of empleadosRows as any[]) {
        allowReorderPorEmpleado.set(e.id, e.allow_reorder || 0);
      }
    }

    function tipoCita(r: any): 'ingreso' | 'cambio' | 'agregado' | 'normal' {
      if (r.is_ingreso === 1 || r.is_ingreso === true) return 'ingreso';
      const articles = articlesPorEmpleado.get(r.employee_id) || [];
      // Articles previos = excluyendo los generados por ESTA misma cita
      const previos = articles.filter(a => a.appointment_id !== r.id && (a.current_status === 'activo' || a.current_status === 'renovado'));
      if (previos.length === 0) return 'ingreso';
      const vencidos = previos.filter(a => a.current_status === 'activo' && a.renewal_enabled_at && a.renewal_enabled_at <= todayIso);
      if (vencidos.length > 0) return 'cambio';
      if ((allowReorderPorEmpleado.get(r.employee_id) || 0) === 1) return 'agregado';
      return 'normal';
    }

    const appointments = rows.map((r: any) => ({
      ...r,
      order_items: parseOrderItems(r.order_items),
      delivered_order_items: parseOrderItems(r.delivered_order_items),
      returned_order_items: parseOrderItems(r.returned_order_items),
      tipo_cita: tipoCita(r),
    }));

    return NextResponse.json({ appointments, total: total?.count || 0, page, limit });
  } catch (err) {
    console.error('Error listando citas:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
