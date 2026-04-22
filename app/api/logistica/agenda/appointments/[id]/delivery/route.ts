import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { parseOrderItems, logAudit, calculateExpirationDate, APPOINTMENT_COLUMNS_LIGHT } from '@/lib/agenda-helpers';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'rrhh', 'supervisor'];

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  const appt = await db.get('SELECT * FROM agenda_appointments WHERE id = ?', [id]);
  if (!appt) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });

  try {
    const body = await request.json();
    const {
      delivered_order_items,
      delivery_notes,
      remito_number,
      create_articles,
      has_return,
      returned_order_items,
      remito_return_number,
    } = body;

    if (!delivered_order_items || !Array.isArray(delivered_order_items)) {
      return NextResponse.json({ error: 'delivered_order_items requerido (array)' }, { status: 400 });
    }

    const hasReturnFlag = has_return ? 1 : 0;
    if (hasReturnFlag) {
      if (!Array.isArray(returned_order_items) || returned_order_items.length === 0) {
        return NextResponse.json({ error: 'returned_order_items requerido cuando has_return=1' }, { status: 400 });
      }
      if (!remito_return_number || !String(remito_return_number).trim()) {
        return NextResponse.json({ error: 'remito_return_number requerido cuando has_return=1' }, { status: 400 });
      }
    }

    const isPg = (db as any).type === 'pg';
    const nowSql = isPg ? 'NOW()' : "datetime('now')";
    const nowVal = new Date().toISOString();

    // Snapshot de cambio si ya había ítems entregados previos
    const prevItems = parseOrderItems(appt.delivered_order_items);
    if (prevItems.length > 0) {
      await db.run(
        `INSERT INTO agenda_appointment_item_changes (appointment_id, before_items, after_items, reason, changed_by) VALUES (?,?,?,?,?)`,
        [id, JSON.stringify(prevItems), JSON.stringify(delivered_order_items), 'delivery_update', session.user.id]
      );
    }

    await db.run(
      `UPDATE agenda_appointments SET
        delivered_order_items = ?,
        delivery_notes = COALESCE(?, delivery_notes),
        remito_number = COALESCE(?, remito_number),
        has_return = ?,
        returned_order_items = ?,
        remito_return_number = COALESCE(?, remito_return_number),
        status = 'completada',
        delivered_at = ${nowSql},
        delivered_by = ?,
        updated_at = ${nowSql}
       WHERE id = ?`,
      [
        JSON.stringify(delivered_order_items),
        delivery_notes ?? null,
        remito_number ?? null,
        hasReturnFlag,
        hasReturnFlag ? JSON.stringify(returned_order_items) : null,
        hasReturnFlag ? String(remito_return_number).trim() : null,
        session.user.id,
        id,
      ]
    );

    // Crear artículos en agenda_articles si se solicitó
    if (create_articles) {
      const deliveryDate = nowVal.split('T')[0];
      for (const item of delivered_order_items as { article_type: string; size?: string; qty: number; useful_life_months?: number }[]) {
        const usefulLife = item.useful_life_months ?? 12;
        const expirationDate = calculateExpirationDate(deliveryDate, usefulLife);
        const renewalEnabledAt = calculateExpirationDate(deliveryDate, Math.round(usefulLife * 0.8));

        if (isPg) {
          await db.query(
            `INSERT INTO agenda_articles (employee_id, appointment_id, article_type, size, delivery_date, useful_life_months, expiration_date, renewal_enabled_at, origin_type, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'entrega_inicial',$9)`,
            [appt.employee_id, id, item.article_type, item.size || null, deliveryDate, usefulLife, expirationDate, renewalEnabledAt, session.user.id]
          );
        } else {
          await db.run(
            `INSERT INTO agenda_articles (employee_id, appointment_id, article_type, size, delivery_date, useful_life_months, expiration_date, renewal_enabled_at, origin_type, created_by)
             VALUES (?,?,?,?,?,?,?,?,'entrega_inicial',?)`,
            [appt.employee_id, id, item.article_type, item.size || null, deliveryDate, usefulLife, expirationDate, renewalEnabledAt, session.user.id]
          );
        }
      }
    }

    const updated = await db.get(
      `SELECT ${APPOINTMENT_COLUMNS_LIGHT.join(', ')} FROM agenda_appointments WHERE id = ?`,
      [id]
    );
    await logAudit('complete_delivery', 'appointment', id, session.user.id, {
      items_count: delivered_order_items.length,
      create_articles: !!create_articles,
    });

    return NextResponse.json({
      ...updated,
      order_items: parseOrderItems(updated.order_items),
      delivered_order_items: parseOrderItems(updated.delivered_order_items),
      returned_order_items: parseOrderItems(updated.returned_order_items),
    });
  } catch (err) {
    console.error('Error actualizando entrega:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
