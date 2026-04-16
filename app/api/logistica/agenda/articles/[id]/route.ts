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
    `SELECT a.*, e.nombre as employee_nombre, e.documento as employee_documento, e.empresa as employee_empresa
     FROM agenda_articles a JOIN agenda_employees e ON e.id = a.employee_id WHERE a.id = ?`,
    [id]
  );
  if (!row) return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  const art = await db.get('SELECT * FROM agenda_articles WHERE id = ?', [id]);
  if (!art) return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 });

  try {
    const body = await request.json();
    const { current_status, condition_status, size, notes, expiration_date } = body;
    await db.run(
      `UPDATE agenda_articles SET
        current_status = COALESCE(?, current_status),
        condition_status = COALESCE(?, condition_status),
        size = COALESCE(?, size),
        notes = COALESCE(?, notes),
        expiration_date = COALESCE(?, expiration_date)
       WHERE id = ?`,
      [current_status || null, condition_status || null, size ?? null, notes ?? null, expiration_date ?? null, id]
    );
    await logAudit('update', 'article', id, session.user.id, body);
    const updated = await db.get('SELECT * FROM agenda_articles WHERE id = ?', [id]);
    return NextResponse.json(updated);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !['admin'].includes(session.user.role)) return NextResponse.json({ error: 'Solo admin puede eliminar artículos' }, { status: 403 });
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  await db.run('DELETE FROM agenda_articles WHERE id = ?', [id]);
  await logAudit('delete', 'article', id, session.user.id, {});
  return NextResponse.json({ ok: true });
}
