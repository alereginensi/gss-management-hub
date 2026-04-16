import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { logAudit, calculateExpirationDate } from '@/lib/agenda-helpers';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'rrhh', 'supervisor'];

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employee_id') || '';
    const status = searchParams.get('status') || '';
    const empresa = searchParams.get('empresa') || '';
    const search = searchParams.get('search')?.trim() || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (employeeId) { conditions.push('a.employee_id = ?'); params.push(parseInt(employeeId, 10)); }
    if (status) { conditions.push('a.current_status = ?'); params.push(status); }
    if (empresa) { conditions.push('e.empresa = ?'); params.push(empresa); }
    if (search) {
      conditions.push('(LOWER(e.nombre) LIKE ? OR LOWER(e.documento) LIKE ? OR LOWER(a.article_type) LIKE ?)');
      const t = `%${search.toLowerCase()}%`;
      params.push(t, t, t);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows, total] = await Promise.all([
      db.query(
        `SELECT a.*, e.nombre as employee_nombre, e.documento as employee_documento, e.empresa as employee_empresa
         FROM agenda_articles a JOIN agenda_employees e ON e.id = a.employee_id
         ${where} ORDER BY a.delivery_date DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ),
      db.get(
        `SELECT COUNT(*) as count FROM agenda_articles a JOIN agenda_employees e ON e.id = a.employee_id ${where}`,
        params
      ),
    ]);
    return NextResponse.json({ articles: rows, total: total?.count || 0, page, limit });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { employee_id, article_type, size, delivery_date, useful_life_months, condition_status, origin_type, notes } = body;
    if (!employee_id) return NextResponse.json({ error: 'employee_id requerido' }, { status: 400 });
    if (!article_type?.trim()) return NextResponse.json({ error: 'article_type requerido' }, { status: 400 });
    if (!delivery_date) return NextResponse.json({ error: 'delivery_date requerido' }, { status: 400 });

    const usefulLife = useful_life_months ?? 12;
    const expirationDate = calculateExpirationDate(delivery_date, usefulLife);
    const renewalEnabledAt = calculateExpirationDate(delivery_date, Math.round(usefulLife * 0.8));

    const isPg = (db as any).type === 'pg';
    let id: number;
    if (isPg) {
      const res = await db.query(
        `INSERT INTO agenda_articles (employee_id, article_type, size, delivery_date, useful_life_months, expiration_date, renewal_enabled_at, condition_status, origin_type, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [employee_id, article_type, size || null, delivery_date, usefulLife, expirationDate, renewalEnabledAt, condition_status || 'nuevo', origin_type || 'entrega_inicial', notes || null, session.user.id]
      );
      id = res[0]?.id;
    } else {
      const r = await db.run(
        `INSERT INTO agenda_articles (employee_id, article_type, size, delivery_date, useful_life_months, expiration_date, renewal_enabled_at, condition_status, origin_type, notes, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [employee_id, article_type, size || null, delivery_date, usefulLife, expirationDate, renewalEnabledAt, condition_status || 'nuevo', origin_type || 'entrega_inicial', notes || null, session.user.id]
      );
      id = r.lastInsertRowid as number;
    }
    const created = await db.get('SELECT * FROM agenda_articles WHERE id = ?', [id]);
    await logAudit('create', 'article', id, session.user.id, { employee_id, article_type });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
