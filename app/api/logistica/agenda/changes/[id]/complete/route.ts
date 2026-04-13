import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { logAudit } from '@/lib/agenda-helpers';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'supervisor'];

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  const change = await db.get('SELECT * FROM agenda_change_events WHERE id = ?', [id]);
  if (!change) return NextResponse.json({ error: 'Cambio no encontrado' }, { status: 404 });
  if (change.status === 'completado') return NextResponse.json({ error: 'El cambio ya está completado' }, { status: 409 });

  // Verify signatures
  if (!change.employee_signature_url) {
    return NextResponse.json({ error: 'Falta la firma del empleado' }, { status: 400 });
  }
  if (!change.responsible_signature_url) {
    return NextResponse.json({ error: 'Falta la firma del responsable' }, { status: 400 });
  }
  if (!change.disclaimer_accepted) {
    return NextResponse.json({ error: 'El descargo legal no fue aceptado' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { delivered_items, returned_items, remito_delivery_number, remito_return_number, delivery_notes } = body;

    const isPg = (db as any).type === 'pg';
    const nowSql = isPg ? 'NOW()' : "datetime('now')";

    // Update all fields and set as completed
    await db.run(
      `UPDATE agenda_change_events SET
        status = 'completado',
        completed_at = ${nowSql},
        completed_by = ?,
        delivered_items = COALESCE(?, delivered_items),
        returned_items = COALESCE(?, returned_items),
        remito_delivery_number = COALESCE(?, remito_delivery_number),
        remito_return_number = COALESCE(?, remito_return_number),
        delivery_notes = COALESCE(?, delivery_notes)
       WHERE id = ?`,
      [
        session.user.id,
        delivered_items !== undefined ? JSON.stringify(delivered_items) : null,
        returned_items !== undefined ? JSON.stringify(returned_items) : null,
        remito_delivery_number ?? null,
        remito_return_number ?? null,
        delivery_notes ?? null,
        id,
      ]
    );

    // Mark returned article as 'devuelto'
    if (change.returned_article_id) {
      await db.run(`UPDATE agenda_articles SET current_status = 'devuelto' WHERE id = ?`, [change.returned_article_id]);
    }

    // Mark new article as 'activo'
    if (change.new_article_id) {
      await db.run(`UPDATE agenda_articles SET current_status = 'activo' WHERE id = ?`, [change.new_article_id]);
    }

    await logAudit('complete_delivery', 'change_event', id, session.user.id, {
      returned_article_id: change.returned_article_id,
      new_article_id: change.new_article_id,
    });

    const updated = await db.get(
      `SELECT c.*,
              e.nombre as employee_nombre, e.documento as employee_documento, e.empresa as employee_empresa,
              na.article_type as new_article_type, na.size as new_article_size,
              ra.article_type as returned_article_type, ra.size as returned_article_size
       FROM agenda_change_events c
       JOIN agenda_employees e ON e.id = c.employee_id
       LEFT JOIN agenda_articles na ON na.id = c.new_article_id
       LEFT JOIN agenda_articles ra ON ra.id = c.returned_article_id
       WHERE c.id = ?`,
      [id]
    );

    return NextResponse.json(updated);
  } catch (err) {
    console.error('Error completando cambio:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
