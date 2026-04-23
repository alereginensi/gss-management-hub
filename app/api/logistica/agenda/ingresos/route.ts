import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { parseOrderItems, logAudit, calculateExpirationDate, APPOINTMENT_COLUMNS_LIGHT } from '@/lib/agenda-helpers';
import { saveAgendaFile } from '@/lib/agenda-storage';
import { AGENDA_ADMIN_ROLES } from '@/lib/agenda-roles';

const AUTH_ROLES: readonly string[] = AGENDA_ADMIN_ROLES;

// GET /api/logistica/agenda/ingresos?search=&from=&to=
// Lista citas con flag is_ingreso = 1 (altas de empleados recién ingresados)
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';
    const search = searchParams.get('search')?.trim() || '';
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const status = searchParams.get('status')?.trim() || '';

    const conditions: string[] = ['a.is_ingreso = 1'];
    const params: unknown[] = [];
    if (from) { conditions.push('s.fecha >= ?'); params.push(from); }
    if (to) { conditions.push('s.fecha <= ?'); params.push(to); }
    if (search) {
      conditions.push('(LOWER(e.nombre) LIKE ? OR LOWER(e.documento) LIKE ?)');
      const t = `%${search.toLowerCase()}%`;
      params.push(t, t);
    }
    if (status === 'pendiente') {
      conditions.push(`a.status = 'confirmada'`);
    } else if (status === 'completada') {
      conditions.push(`a.status = 'completada'`);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;

    const [rows, total] = await Promise.all([
      db.query(
        `SELECT ${APPOINTMENT_COLUMNS_LIGHT.map(c => `a.${c}`).join(', ')},
                e.nombre AS employee_nombre, e.documento AS employee_documento,
                e.empresa AS employee_empresa, e.sector AS employee_sector, e.puesto AS employee_puesto,
                s.fecha AS slot_fecha, s.start_time AS slot_start, s.end_time AS slot_end
         FROM agenda_appointments a
         JOIN agenda_employees e ON e.id = a.employee_id
         JOIN agenda_time_slots s ON s.id = a.time_slot_id
         ${where}
         ORDER BY (CASE WHEN a.status = 'confirmada' THEN 0 ELSE 1 END) ASC,
                  s.fecha DESC, s.start_time DESC
         LIMIT ?`,
        [...params, limit]
      ),
      db.get(
        `SELECT COUNT(*) as count FROM agenda_appointments a
         JOIN agenda_employees e ON e.id = a.employee_id
         JOIN agenda_time_slots s ON s.id = a.time_slot_id
         ${where}`,
        params
      ),
    ]);

    const items = rows.map((r: any) => ({
      ...r,
      order_items: parseOrderItems(r.order_items),
      delivered_order_items: parseOrderItems(r.delivered_order_items),
    }));

    return NextResponse.json({ items, total: total?.count || 0 });
  } catch (err) {
    console.error('Error listando ingresos:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST /api/logistica/agenda/ingresos
// Body JSON: {
//   employee_id, fecha (YYYY-MM-DD), start_time (HH:MM), end_time (HH:MM),
//   delivered_order_items: [{article_type, size?, qty, useful_life_months?}],
//   employee_signature?, responsible_signature? (dataUrls),
//   remito_number?, delivery_notes?, create_articles?
// }
// Crea slot custom + appointment con is_ingreso=1 status='completada' en el mismo acto.
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const employeeId = parseInt(body.employee_id, 10);
    const fecha = typeof body.fecha === 'string' ? body.fecha.trim() : '';
    const startTime = typeof body.start_time === 'string' ? body.start_time.trim() : '';
    const endTime = typeof body.end_time === 'string' ? body.end_time.trim() : '';

    if (!employeeId) return NextResponse.json({ error: 'employee_id requerido' }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return NextResponse.json({ error: 'fecha invalida (YYYY-MM-DD)' }, { status: 400 });
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
      return NextResponse.json({ error: 'horas invalidas (HH:MM)' }, { status: 400 });
    }

    const employee = await db.get('SELECT id, nombre, empresa FROM agenda_employees WHERE id = ?', [employeeId]);
    if (!employee) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });

    const items = Array.isArray(body.delivered_order_items)
      ? body.delivered_order_items.filter((it: any) => it && typeof it.article_type === 'string' && it.article_type.trim())
      : [];
    if (!items.length) return NextResponse.json({ error: 'Agregá al menos un item' }, { status: 400 });

    // Firmas (dataUrls → Cloudinary/storage)
    async function storeSignature(raw: unknown): Promise<string | null> {
      if (typeof raw !== 'string' || !raw.startsWith('data:image/')) return null;
      const comma = raw.indexOf(',');
      if (comma < 0) return null;
      const buffer = Buffer.from(raw.slice(comma + 1), 'base64');
      try {
        return await saveAgendaFile(buffer, `firma-ingreso-${Date.now()}.png`, 'firmas');
      } catch (e) {
        console.warn('[ingresos] firma falló:', (e as Error).message);
        return null;
      }
    }
    const employeeSigUrl = await storeSignature(body.employee_signature);
    const responsibleSigUrl = await storeSignature(body.responsible_signature);

    const isPg = (db as any).type === 'pg';
    const nowSql = isPg ? 'NOW()' : "datetime('now')";

    // Buscar slot existente o crear uno nuevo con capacity=1
    let slotId: number | undefined;
    const existingSlot = await db.get(
      `SELECT id, capacity, current_bookings FROM agenda_time_slots
       WHERE fecha = ? AND start_time = ? AND end_time = ? AND estado = 'activo'`,
      [fecha, startTime, endTime]
    );
    if (existingSlot) {
      if ((existingSlot.current_bookings || 0) >= (existingSlot.capacity || 1)) {
        return NextResponse.json({ error: 'El turno ya está completo' }, { status: 409 });
      }
      slotId = existingSlot.id;
    } else {
      const slotRes = await db.run(
        `INSERT INTO agenda_time_slots (fecha, start_time, end_time, capacity, current_bookings, estado)
         VALUES (?, ?, ?, 1, 0, 'activo')`,
        [fecha, startTime, endTime]
      );
      if (isPg) {
        const r = await db.get(
          `SELECT id FROM agenda_time_slots WHERE fecha = ? AND start_time = ? AND end_time = ? ORDER BY id DESC LIMIT 1`,
          [fecha, startTime, endTime]
        );
        slotId = r?.id;
      } else {
        slotId = slotRes.lastInsertRowid as number;
      }
    }
    if (!slotId) return NextResponse.json({ error: 'No se pudo crear el slot' }, { status: 500 });

    const remitoNumber = typeof body.remito_number === 'string' ? body.remito_number.trim() || null : null;
    const deliveryNotes = typeof body.delivery_notes === 'string' ? body.delivery_notes.trim() || null : null;
    const orderItemsJson = JSON.stringify(items);

    // Crear appointment marcado como ingreso + completada
    const apRes = await db.run(
      `INSERT INTO agenda_appointments
        (employee_id, time_slot_id, status, order_items, delivered_order_items,
         remito_number, delivery_notes,
         employee_signature_url, responsible_signature_url,
         is_ingreso, delivered_at, delivered_by, created_at, updated_at)
       VALUES (?, ?, 'completada', ?, ?, ?, ?, ?, ?, 1, ${nowSql}, ?, ${nowSql}, ${nowSql})`,
      [employeeId, slotId, orderItemsJson, orderItemsJson, remitoNumber, deliveryNotes,
       employeeSigUrl, responsibleSigUrl, session.user.id]
    );
    let appointmentId: number | undefined;
    if (isPg) {
      const r = await db.get(
        `SELECT id FROM agenda_appointments WHERE employee_id = ? AND time_slot_id = ? ORDER BY id DESC LIMIT 1`,
        [employeeId, slotId]
      );
      appointmentId = r?.id;
    } else {
      appointmentId = apRes.lastInsertRowid as number;
    }
    if (!appointmentId) return NextResponse.json({ error: 'No se pudo crear la cita' }, { status: 500 });

    // Actualizar contador del slot
    await db.run(
      `UPDATE agenda_time_slots SET current_bookings = current_bookings + 1 WHERE id = ?`,
      [slotId]
    );

    // Alta de ingreso = entrega inicial ya completada. Bloquear al empleado
    // hasta que sus artículos venzan (syncEmployeeRenewalStatus los re-habilita).
    // Estado pasa a 'activo' por si venía como 'inactivo' (ej. egreso anterior).
    await db.run(
      `UPDATE agenda_employees SET fecha_ingreso = COALESCE(fecha_ingreso, ?), enabled = 0, allow_reorder = 0, estado = 'activo' WHERE id = ?`,
      [fecha, employeeId]
    );

    // Crear artículos (entrega inicial) si se solicita (default true)
    const createArticles = body.create_articles !== false;
    if (createArticles) {
      for (const item of items as { article_type: string; size?: string; qty: number; useful_life_months?: number }[]) {
        const usefulLife = item.useful_life_months ?? 12;
        const expirationDate = calculateExpirationDate(fecha, usefulLife);
        const renewalEnabledAt = calculateExpirationDate(fecha, Math.round(usefulLife * 0.8));
        await db.run(
          `INSERT INTO agenda_articles
            (employee_id, appointment_id, article_type, size, delivery_date,
             useful_life_months, expiration_date, renewal_enabled_at, origin_type, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'entrega_inicial', ?)`,
          [employeeId, appointmentId, item.article_type, item.size || null, fecha,
           usefulLife, expirationDate, renewalEnabledAt, session.user.id]
        );
      }
    }

    await logAudit('create', 'appointment', appointmentId, session.user.id, {
      kind: 'ingreso', employee_id: employeeId, slot_id: slotId, items_count: items.length,
    });

    return NextResponse.json({ ok: true, id: appointmentId }, { status: 201 });
  } catch (err) {
    console.error('Error creando ingreso:', err);
    return NextResponse.json({ error: (err as Error).message || 'Error interno' }, { status: 500 });
  }
}
