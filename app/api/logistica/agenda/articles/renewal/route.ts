import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'rrhh', 'supervisor'];

// GET /api/logistica/agenda/articles/renewal
// Retorna artículos activos cuyo renewal_enabled_at ya pasó (habilitados para renovación)
// ?mode=enabled (default) | expired | upcoming (próximos 30 días)
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'enabled';
    const empresa = searchParams.get('empresa') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = (page - 1) * limit;

    const isPg = (db as any).type === 'pg';
    const nowFn = isPg ? 'NOW()' : "datetime('now')";
    const plus30 = isPg ? `NOW() + INTERVAL '30 days'` : "datetime('now', '+30 days')";

    let condition = '';
    if (mode === 'enabled') {
      condition = `AND a.current_status = 'activo' AND a.renewal_enabled_at IS NOT NULL AND a.renewal_enabled_at <= ${nowFn}`;
    } else if (mode === 'expired') {
      condition = `AND a.current_status = 'activo' AND a.expiration_date IS NOT NULL AND a.expiration_date < ${nowFn}`;
    } else if (mode === 'upcoming') {
      condition = `AND a.current_status = 'activo' AND a.expiration_date IS NOT NULL AND a.expiration_date BETWEEN ${nowFn} AND ${plus30}`;
    }

    const empresaCond = empresa ? `AND e.empresa = ?` : '';
    const params: unknown[] = empresa ? [empresa, limit, offset] : [limit, offset];

    const [rows, total] = await Promise.all([
      db.query(
        `SELECT a.*, e.nombre as employee_nombre, e.documento as employee_documento, e.empresa as employee_empresa
         FROM agenda_articles a JOIN agenda_employees e ON e.id = a.employee_id
         WHERE 1=1 ${condition} ${empresaCond}
         ORDER BY a.expiration_date ASC LIMIT ? OFFSET ?`,
        params
      ),
      db.get(
        `SELECT COUNT(*) as count FROM agenda_articles a JOIN agenda_employees e ON e.id = a.employee_id WHERE 1=1 ${condition} ${empresaCond}`,
        empresa ? [empresa] : []
      ),
    ]);

    return NextResponse.json({ articles: rows, total: total?.count || 0, mode, page, limit });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
