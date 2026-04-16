import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'rrhh', 'supervisor'];

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search) {
      conditions.push('(documento LIKE ? OR LOWER(motivo) LIKE ?)');
      params.push(`%${search}%`, `%${search.toLowerCase()}%`);
    }

    if (dateFrom) {
      conditions.push('created_at >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push('created_at <= ?');
      params.push(dateTo + ' 23:59:59');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const [rows, total] = await Promise.all([
      db.query(`SELECT * FROM agenda_failed_attempts ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]),
      db.get(`SELECT COUNT(*) as count FROM agenda_failed_attempts ${where}`, params)
    ]);

    return NextResponse.json({
      attempts: rows,
      total: total?.count || 0,
      page,
      limit
    });
  } catch (err) {
    console.error('Error fetching failed attempts:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
