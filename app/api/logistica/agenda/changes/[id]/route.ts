import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { logAudit } from '@/lib/agenda-helpers';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'supervisor'];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);

  const row = await db.get(
    `SELECT c.*,
            e.nombre as employee_nombre, e.documento as employee_documento,
            e.empresa as employee_empresa, e.sector as employee_sector, e.puesto as employee_puesto,
            na.article_type as new_article_type, na.size as new_article_size, na.delivery_date as new_delivery_date,
            na.useful_life_months as new_useful_life,
            ra.article_type as returned_article_type, ra.size as returned_article_size,
            ra.delivery_date as returned_delivery_date, ra.condition_status as returned_condition
     FROM agenda_change_events c
     JOIN agenda_employees e ON e.id = c.employee_id
     LEFT JOIN agenda_articles na ON na.id = c.new_article_id
     LEFT JOIN agenda_articles ra ON ra.id = c.returned_article_id
     WHERE c.id = ?`,
    [id]
  );

  if (!row) return NextResponse.json({ error: 'Cambio no encontrado' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);

  const change = await db.get('SELECT * FROM agenda_change_events WHERE id = ?', [id]);
  if (!change) return NextResponse.json({ error: 'Cambio no encontrado' }, { status: 404 });
  if (change.status === 'completado') return NextResponse.json({ error: 'El cambio ya está completado' }, { status: 409 });

  try {
    const body = await request.json();
    const { delivered_items, returned_items, remito_delivery_number, remito_return_number, delivery_notes, notes } = body;

    await db.run(
      `UPDATE agenda_change_events SET
        delivered_items = COALESCE(?, delivered_items),
        returned_items = COALESCE(?, returned_items),
        remito_delivery_number = COALESCE(?, remito_delivery_number),
        remito_return_number = COALESCE(?, remito_return_number),
        delivery_notes = COALESCE(?, delivery_notes),
        notes = COALESCE(?, notes)
       WHERE id = ?`,
      [
        delivered_items !== undefined ? JSON.stringify(delivered_items) : null,
        returned_items !== undefined ? JSON.stringify(returned_items) : null,
        remito_delivery_number ?? null,
        remito_return_number ?? null,
        delivery_notes ?? null,
        notes ?? null,
        id,
      ]
    );

    await logAudit('update', 'change_event', id, session.user.id, body);
    const updated = await db.get('SELECT * FROM agenda_change_events WHERE id = ?', [id]);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('Error actualizando cambio:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
