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
    const search = searchParams.get('search')?.trim() || '';
    const empresa = searchParams.get('empresa') || '';
    const estado = searchParams.get('estado') || '';
    const enabled = searchParams.get('enabled') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search) {
      conditions.push('(LOWER(nombre) LIKE ? OR LOWER(documento) LIKE ? OR LOWER(sector) LIKE ? OR LOWER(puesto) LIKE ?)');
      const t = `%${search.toLowerCase()}%`;
      params.push(t, t, t, t);
    }
    if (empresa) { conditions.push('empresa = ?'); params.push(empresa); }
    if (estado) { conditions.push('estado = ?'); params.push(estado); }
    if (enabled !== '') { conditions.push('enabled = ?'); params.push(parseInt(enabled, 10)); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows, total] = await Promise.all([
      db.query(`SELECT * FROM agenda_employees ${where} ORDER BY nombre ASC LIMIT ? OFFSET ?`, [...params, limit, offset]),
      db.get(`SELECT COUNT(*) as count FROM agenda_employees ${where}`, params),
    ]);

    return NextResponse.json({ employees: rows, total: total?.count || 0, page, limit });
  } catch (err) {
    console.error('Error listando empleados:', err);
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
    const { documento, nombre, empresa, sector, puesto, workplace_category, fecha_ingreso, talle_superior, talle_inferior, calzado, enabled, allow_reorder, estado, observaciones, send_to_ingresos } = body;

    if (!documento?.trim()) return NextResponse.json({ error: 'Documento requerido' }, { status: 400 });
    if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
    if (send_to_ingresos && !fecha_ingreso) {
      return NextResponse.json({ error: 'Fecha de ingreso requerida para "Enviar a nuevos ingresos"' }, { status: 400 });
    }

    const existing = await db.get('SELECT id FROM agenda_employees WHERE documento = ?', [documento.trim()]);
    if (existing) return NextResponse.json({ error: 'Ya existe un empleado con ese documento' }, { status: 409 });

    const isPg = (db as any).type === 'pg';
    let id: number;

    if (isPg) {
      const res = await db.query(
        `INSERT INTO agenda_employees (documento, nombre, empresa, sector, puesto, workplace_category, fecha_ingreso, talle_superior, talle_inferior, calzado, enabled, allow_reorder, estado, observaciones, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
        [documento.trim(), nombre.trim(), empresa || null, sector || null, puesto || null, workplace_category || null, fecha_ingreso || null, talle_superior || null, talle_inferior || null, calzado || null, enabled ?? 1, allow_reorder ?? 0, estado || 'activo', observaciones || null, session.user.id]
      );
      id = res[0]?.id;
    } else {
      const result = await db.run(
        `INSERT INTO agenda_employees (documento, nombre, empresa, sector, puesto, workplace_category, fecha_ingreso, talle_superior, talle_inferior, calzado, enabled, allow_reorder, estado, observaciones, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [documento.trim(), nombre.trim(), empresa || null, sector || null, puesto || null, workplace_category || null, fecha_ingreso || null, talle_superior || null, talle_inferior || null, calzado || null, enabled ?? 1, allow_reorder ?? 0, estado || 'activo', observaciones || null, session.user.id]
      );
      id = result.lastInsertRowid as number;
    }

    const created = await db.get('SELECT * FROM agenda_employees WHERE id = ?', [id]);
    await logAudit('create', 'employee', id, session.user.id, { documento, nombre });

    // Si RRHH marcó "enviar a nuevos ingresos", creamos un turno pendiente para
    // que logistica lo complete (items + firmas + remito) desde /admin/ingresos.
    let pendingAppointmentId: number | null = null;
    let ingresoError: string | null = null;
    if (send_to_ingresos && fecha_ingreso) {
      try {
        const nowSql = isPg ? 'NOW()' : "datetime('now')";
        const pad = (n: number) => String(n).padStart(2, '0');

        // Si ya existe un ingreso pendiente para este empleado, no crear otro.
        const existingIngreso = await db.get(
          `SELECT id FROM agenda_appointments WHERE employee_id = ? AND is_ingreso = 1 AND status = 'confirmada' ORDER BY id DESC LIMIT 1`,
          [id]
        );
        if (existingIngreso?.id) {
          pendingAppointmentId = existingIngreso.id;
        } else {
          // Buscar o crear un slot libre (09:00, 09:30, 10:00, ...) para la fecha.
          let slotId: number | undefined;
          for (let baseMin = 9 * 60; baseMin < 18 * 60 && !slotId; baseMin += 30) {
            const sh = Math.floor(baseMin / 60);
            const sm = baseMin % 60;
            const eh = Math.floor((baseMin + 30) / 60);
            const em = (baseMin + 30) % 60;
            const start = `${pad(sh)}:${pad(sm)}`;
            const end = `${pad(eh)}:${pad(em)}`;
            const existingSlot = await db.get(
              `SELECT id, capacity, current_bookings FROM agenda_time_slots WHERE fecha = ? AND start_time = ? AND end_time = ? AND estado = 'activo'`,
              [fecha_ingreso, start, end]
            );
            if (existingSlot) {
              if ((existingSlot.current_bookings || 0) < (existingSlot.capacity || 1)) {
                slotId = existingSlot.id;
              }
              continue;
            }
            try {
              const slotRes = await db.run(
                `INSERT INTO agenda_time_slots (fecha, start_time, end_time, capacity, current_bookings, estado) VALUES (?, ?, ?, 1, 0, 'activo')`,
                [fecha_ingreso, start, end]
              );
              if (isPg) {
                const r = await db.get(
                  `SELECT id FROM agenda_time_slots WHERE fecha = ? AND start_time = ? AND end_time = ? ORDER BY id DESC LIMIT 1`,
                  [fecha_ingreso, start, end]
                );
                slotId = r?.id;
              } else {
                slotId = slotRes.lastInsertRowid as number;
              }
            } catch {
              // Carrera con otro INSERT simultáneo: probamos el siguiente horario
            }
          }
          if (!slotId) {
            ingresoError = 'No se encontró horario libre entre 09:00 y 18:00 para la fecha';
          } else {
            await db.run(
              `INSERT INTO agenda_appointments (employee_id, time_slot_id, status, is_ingreso, created_at, updated_at)
               VALUES (?, ?, 'confirmada', 1, ${nowSql}, ${nowSql})`,
              [id, slotId]
            );
            if (isPg) {
              const r = await db.get(
                `SELECT id FROM agenda_appointments WHERE employee_id = ? AND time_slot_id = ? ORDER BY id DESC LIMIT 1`,
                [id, slotId]
              );
              pendingAppointmentId = r?.id || null;
            } else {
              // En SQLite no recuperamos id aquí, lo buscamos rápido
              const r = await db.get(
                `SELECT id FROM agenda_appointments WHERE employee_id = ? AND time_slot_id = ? ORDER BY id DESC LIMIT 1`,
                [id, slotId]
              );
              pendingAppointmentId = r?.id || null;
            }
            await db.run(
              `UPDATE agenda_time_slots SET current_bookings = current_bookings + 1 WHERE id = ?`,
              [slotId]
            );
          }
        }
      } catch (e) {
        ingresoError = (e as Error).message || 'Error desconocido creando el ingreso';
        console.warn('[employees] no se pudo crear appointment pendiente:', ingresoError);
      }
    }

    return NextResponse.json({ ...created, pending_appointment_id: pendingAppointmentId, ingreso_error: ingresoError }, { status: 201 });
  } catch (err) {
    console.error('Error creando empleado:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
