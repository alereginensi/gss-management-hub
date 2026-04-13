import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { confirmSlotBooking } from '@/lib/agenda-helpers';
import { normalizeOrderItems, getCatalogForEmployee } from '@/lib/agenda-catalog';

export async function POST(request: NextRequest) {
  try {
    const { employee_id, time_slot_id, order_items, hold_token } = await request.json();

    // Validaciones básicas
    if (!employee_id || !time_slot_id || !hold_token) {
      return NextResponse.json({ error: 'Faltan datos requeridos: employee_id, time_slot_id, hold_token' }, { status: 400 });
    }
    if (!order_items || !Array.isArray(order_items) || order_items.length === 0) {
      return NextResponse.json({ error: 'Debes incluir al menos un artículo en el pedido' }, { status: 400 });
    }

    // Verificar empleado
    const employee = await db.get(
      'SELECT * FROM agenda_employees WHERE id = ? AND enabled = 1 AND estado = ?',
      [employee_id, 'activo']
    );
    if (!employee) {
      return NextResponse.json({ error: 'Empleado no encontrado o no habilitado' }, { status: 404 });
    }

    // Verificar slot
    const slot = await db.get(
      'SELECT * FROM agenda_time_slots WHERE id = ? AND estado = ?',
      [time_slot_id, 'activo']
    );
    if (!slot) {
      return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
    }
    if (slot.current_bookings >= slot.capacity) {
      return NextResponse.json({ error: 'El turno ya no tiene cupo disponible', conflict: true }, { status: 409 });
    }

    // Validar que el hold_token corresponde a este slot
    if (slot.hold_token !== hold_token) {
      return NextResponse.json(
        { error: 'El turno no está retenido con este token. Puede haber expirado el hold.', conflict: true },
        { status: 409 }
      );
    }

    // Normalizar y validar ítems del pedido
    const catalog = await getCatalogForEmployee(
      employee.empresa,
      employee.sector,
      employee.puesto,
      employee.workplace_category
    );
    const { valid, errors } = await normalizeOrderItems(order_items, catalog);
    if (valid.length === 0) {
      return NextResponse.json({
        error: 'Ningún artículo del pedido es válido según el catálogo de tu empresa',
        validation_errors: errors,
      }, { status: 400 });
    }

    // Verificar que el empleado no tenga ya una cita confirmada para este slot
    const existing = await db.get(
      `SELECT id FROM agenda_appointments WHERE employee_id = ? AND time_slot_id = ? AND status NOT IN ('cancelada', 'ausente')`,
      [employee_id, time_slot_id]
    );
    if (existing) {
      return NextResponse.json({ error: 'Ya tenés una cita registrada para este turno' }, { status: 409 });
    }

    // Confirmar el hold y decrementar disponibilidad atómicamente
    const confirmed = await confirmSlotBooking(time_slot_id, hold_token);
    if (!confirmed) {
      return NextResponse.json(
        { error: 'No se pudo confirmar el turno. El hold puede haber expirado.', conflict: true },
        { status: 409 }
      );
    }

    // Crear la cita
    const isPg = (db as any).type === 'pg';
    let appointmentId: number;

    if (isPg) {
      const res = await db.query(
        `INSERT INTO agenda_appointments (employee_id, time_slot_id, status, order_items)
         VALUES ($1, $2, 'confirmada', $3) RETURNING id`,
        [employee_id, time_slot_id, JSON.stringify(valid)]
      );
      appointmentId = res[0]?.id;
    } else {
      const result = await db.run(
        `INSERT INTO agenda_appointments (employee_id, time_slot_id, status, order_items)
         VALUES (?, ?, 'confirmada', ?)`,
        [employee_id, time_slot_id, JSON.stringify(valid)]
      );
      appointmentId = result.lastInsertRowid as number;
    }

    // Obtener la cita creada con datos del turno
    const appointment = await db.get(
      `SELECT a.*, s.fecha, s.start_time, s.end_time
       FROM agenda_appointments a
       JOIN agenda_time_slots s ON s.id = a.time_slot_id
       WHERE a.id = ?`,
      [appointmentId]
    );

    return NextResponse.json({
      success: true,
      appointment: {
        ...appointment,
        order_items: valid,
        employee_nombre: employee.nombre,
        employee_empresa: employee.empresa,
      },
      validation_warnings: errors.length > 0 ? errors : undefined,
    }, { status: 201 });

  } catch (err) {
    console.error('Error creando cita:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
