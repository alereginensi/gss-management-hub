import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Solo admin puede ver el log de auditoría' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || '';
    const entityType = searchParams.get('entity_type') || '';
    const userId = searchParams.get('user_id') || '';
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (action) { conditions.push('a.action = ?'); params.push(action); }
    if (entityType) { conditions.push('a.entity_type = ?'); params.push(entityType); }
    if (userId) { conditions.push('a.user_id = ?'); params.push(parseInt(userId, 10)); }
    if (from) { conditions.push('a.created_at >= ?'); params.push(from); }
    if (to) { conditions.push('a.created_at <= ?'); params.push(to + 'T23:59:59'); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows, total] = await Promise.all([
      db.query(
        `SELECT a.*, u.name as user_name
         FROM agenda_audit_log a
         LEFT JOIN users u ON u.id = a.user_id
         ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ),
      db.get(
        `SELECT COUNT(*) as count FROM agenda_audit_log a ${where}`,
        params
      ),
    ]);

    return NextResponse.json({ logs: rows, total: total?.count || 0, page, limit });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
