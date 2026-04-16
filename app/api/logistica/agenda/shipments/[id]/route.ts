import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { logAudit } from '@/lib/agenda-helpers';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'rrhh', 'supervisor'];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  const shipment = await db.get(
    `SELECT s.*, e.nombre as employee_nombre, e.documento as employee_documento, e.empresa as employee_empresa
     FROM agenda_shipments s JOIN agenda_employees e ON e.id = s.employee_id WHERE s.id = ?`,
    [id]
  );
  if (!shipment) return NextResponse.json({ error: 'Envío no encontrado' }, { status: 404 });

  const articles = await db.query(
    `SELECT a.* FROM agenda_articles a JOIN agenda_shipment_articles sa ON sa.article_id = a.id WHERE sa.shipment_id = ?`,
    [id]
  );
  return NextResponse.json({ ...shipment, articles });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  const shipment = await db.get('SELECT * FROM agenda_shipments WHERE id = ?', [id]);
  if (!shipment) return NextResponse.json({ error: 'Envío no encontrado' }, { status: 404 });

  try {
    const body = await request.json();
    const { shipment_status, tracking_number, carrier, notes, dispatched_at, delivered_at } = body;

    await db.run(
      `UPDATE agenda_shipments SET
        shipment_status = COALESCE(?, shipment_status),
        tracking_number = COALESCE(?, tracking_number),
        carrier = COALESCE(?, carrier),
        notes = COALESCE(?, notes),
        dispatched_at = COALESCE(?, dispatched_at),
        delivered_at = COALESCE(?, delivered_at)
       WHERE id = ?`,
      [shipment_status || null, tracking_number ?? null, carrier ?? null, notes ?? null, dispatched_at ?? null, delivered_at ?? null, id]
    );

    await logAudit('update', 'shipment', id, session.user.id, { shipment_status });
    const updated = await db.get('SELECT * FROM agenda_shipments WHERE id = ?', [id]);
    return NextResponse.json(updated);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
