import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCatalogForEmployee } from '@/lib/agenda-catalog';

export async function POST(request: NextRequest) {
  try {
    const { documento } = await request.json();

    if (!documento?.trim()) {
      return NextResponse.json({ error: 'Documento requerido' }, { status: 400 });
    }

    const docNorm = documento.trim();

    // Buscar empleado
    const employee = await db.get(
      'SELECT * FROM agenda_employees WHERE documento = ?',
      [docNorm]
    );

    // Obtener config para el link de contacto
    const config = await db.get('SELECT public_contact_whatsapp FROM agenda_config WHERE id = 1');
    const whatsapp = config?.public_contact_whatsapp || null;

    const WHATSAPP_DEFAULT = 'https://api.whatsapp.com/send/?phone=59897655779&text=Hola%2C+consulta+sobre+mi+uniforme&type=phone_number&app_absent=0';
    const whatsappUrl = whatsapp || WHATSAPP_DEFAULT;

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    if (!employee) {
      // No registrado: NO se loguea como intento fallido (evita spam en admin)
      return NextResponse.json(
        { error: 'Tu documento no está registrado en el sistema.', reason: 'not_found' },
        { status: 404 }
      );
    }

    if (!employee.enabled || employee.estado !== 'activo') {
      // Registrado pero inhabilitado: sí se loguea
      await db.run(
        'INSERT INTO agenda_failed_attempts (documento, motivo, ip) VALUES (?, ?, ?)',
        [docNorm, 'not_enabled', ip]
      );
      return NextResponse.json(
        { error: 'Tu documento está registrado pero no habilitado para retirar uniformes.', reason: 'not_enabled', whatsapp: whatsappUrl },
        { status: 403 }
      );
    }

    // Obtener catálogo de la empresa del empleado
    const catalog = await getCatalogForEmployee(
      employee.empresa,
      employee.sector,
      employee.puesto,
      employee.workplace_category
    );

    // Obtener citas previas (historial breve)
    const prevAppointments = await db.query(
      `SELECT a.id, a.status, a.order_items, a.delivered_order_items, a.created_at,
              s.fecha, s.start_time
       FROM agenda_appointments a
       JOIN agenda_time_slots s ON s.id = a.time_slot_id
       WHERE a.employee_id = ?
       ORDER BY a.created_at DESC LIMIT 5`,
      [employee.id]
    );

    return NextResponse.json({
      employee: {
        id: employee.id,
        nombre: employee.nombre,
        empresa: employee.empresa,
        sector: employee.sector,
        puesto: employee.puesto,
        workplace_category: employee.workplace_category,
        talle_superior: employee.talle_superior,
        talle_inferior: employee.talle_inferior,
        calzado: employee.calzado,
        allow_reorder: employee.allow_reorder,
      },
      catalog,
      previous_appointments: prevAppointments,
    });
  } catch (err) {
    console.error('Error en lookup de empleado:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
