import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { logAudit } from '@/lib/agenda-helpers';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'supervisor'];

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const empresa = searchParams.get('empresa') || '';
    const search = searchParams.get('search')?.trim() || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status) { conditions.push('r.status = ?'); params.push(status); }
    if (empresa) { conditions.push('e.empresa = ?'); params.push(empresa); }
    if (search) {
      conditions.push('(LOWER(e.nombre) LIKE ? OR LOWER(e.documento) LIKE ?)');
      const t = `%${search.toLowerCase()}%`;
      params.push(t, t);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows, total] = await Promise.all([
      db.query(
        `SELECT r.*, e.nombre as employee_nombre, e.documento as employee_documento, e.empresa as employee_empresa
         FROM agenda_requests r JOIN agenda_employees e ON e.id = r.employee_id
         ${where} ORDER BY r.requested_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ),
      db.get(
        `SELECT COUNT(*) as count FROM agenda_requests r JOIN agenda_employees e ON e.id = r.employee_id ${where}`,
        params
      ),
    ]);
    return NextResponse.json({ requests: rows, total: total?.count || 0, page, limit });
  } catch (err) {
    console.error(err);
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
    const { employee_id, article_type, size, reason, notes } = body;
    if (!employee_id) return NextResponse.json({ error: 'employee_id requerido' }, { status: 400 });
    if (!article_type?.trim()) return NextResponse.json({ error: 'article_type requerido' }, { status: 400 });
    if (!reason?.trim()) return NextResponse.json({ error: 'reason requerido' }, { status: 400 });

    const isPg = (db as any).type === 'pg';
    let id: number;
    if (isPg) {
      const res = await db.query(
        `INSERT INTO agenda_requests (employee_id, article_type, size, reason, notes, requested_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [employee_id, article_type, size || null, reason, notes || null, session.user.id]
      );
      id = res[0]?.id;
    } else {
      const r = await db.run(
        `INSERT INTO agenda_requests (employee_id, article_type, size, reason, notes, requested_by) VALUES (?,?,?,?,?,?)`,
        [employee_id, article_type, size || null, reason, notes || null, session.user.id]
      );
      id = r.lastInsertRowid as number;
    }
    const created = await db.get('SELECT * FROM agenda_requests WHERE id = ?', [id]);
    await logAudit('create', 'request', id, session.user.id, { employee_id, article_type });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
