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
  const row = await db.get(
    `SELECT r.*, e.nombre as employee_nombre, e.documento as employee_documento, e.empresa as employee_empresa
     FROM agenda_requests r JOIN agenda_employees e ON e.id = r.employee_id WHERE r.id = ?`,
    [id]
  );
  if (!row) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  const req = await db.get('SELECT * FROM agenda_requests WHERE id = ?', [id]);
  if (!req) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });

  try {
    const body = await request.json();
    const { status, notes, approved_by, approved_at, article_type, size, reason } = body;
    const isPg = (db as any).type === 'pg';

    // Si se aprueba, guardar quién aprueba y cuándo
    const approvedByVal = status === 'aprobada' ? (approved_by ?? session.user.id) : (approved_by ?? null);
    const approvedAtVal = status === 'aprobada' ? (approved_at || new Date().toISOString()) : (approved_at ?? null);

    await db.run(
      `UPDATE agenda_requests SET
        status = COALESCE(?, status),
        notes = COALESCE(?, notes),
        approved_by = COALESCE(?, approved_by),
        approved_at = COALESCE(?, approved_at),
        article_type = COALESCE(?, article_type),
        size = COALESCE(?, size),
        reason = COALESCE(?, reason)
       WHERE id = ?`,
      [status || null, notes ?? null, approvedByVal, approvedAtVal, article_type || null, size ?? null, reason || null, id]
    );

    const action = status === 'aprobada' ? 'approve' : status === 'rechazada' ? 'reject' : 'update';
    await logAudit(action, 'request', id, session.user.id, { status, article_type, size });
    const updated = await db.get('SELECT * FROM agenda_requests WHERE id = ?', [id]);
    return NextResponse.json(updated);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  
  try {
    await db.run('DELETE FROM agenda_requests WHERE id = ?', [id]);
    await logAudit('delete', 'request', id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
