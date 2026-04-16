import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { logAudit } from '@/lib/agenda-helpers';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'rrhh'];

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const empresa = searchParams.get('empresa') || '';

  const conditions: string[] = [];
  const params: string[] = [];
  if (empresa) { conditions.push('empresa = ?'); params.push(empresa); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await db.query(
    `SELECT * FROM agenda_uniform_catalog ${where} ORDER BY empresa, article_type`,
    params
  );

  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { empresa, sector, puesto, workplace_category, article_type, article_name_normalized, quantity, useful_life_months, initial_enabled, renewable, reusable_allowed, special_authorization_required } = body;

    if (!article_type?.trim()) return NextResponse.json({ error: 'Tipo de artículo requerido' }, { status: 400 });

    const isPg = (db as any).type === 'pg';
    let id: number;

    if (isPg) {
      const res = await db.query(
        `INSERT INTO agenda_uniform_catalog (empresa, sector, puesto, workplace_category, article_type, article_name_normalized, quantity, useful_life_months, initial_enabled, renewable, reusable_allowed, special_authorization_required)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [empresa || null, sector || null, puesto || null, workplace_category || null, article_type.trim(), article_name_normalized || null, quantity ?? 1, useful_life_months ?? 12, initial_enabled ?? 1, renewable ?? 1, reusable_allowed ?? 0, special_authorization_required ?? 0]
      );
      id = res[0]?.id;
    } else {
      const result = await db.run(
        `INSERT INTO agenda_uniform_catalog (empresa, sector, puesto, workplace_category, article_type, article_name_normalized, quantity, useful_life_months, initial_enabled, renewable, reusable_allowed, special_authorization_required) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [empresa || null, sector || null, puesto || null, workplace_category || null, article_type.trim(), article_name_normalized || null, quantity ?? 1, useful_life_months ?? 12, initial_enabled ?? 1, renewable ?? 1, reusable_allowed ?? 0, special_authorization_required ?? 0]
      );
      id = result.lastInsertRowid as number;
    }

    const created = await db.get('SELECT * FROM agenda_uniform_catalog WHERE id = ?', [id]);
    await logAudit('create', 'catalog', id, session.user.id, { article_type, empresa });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('Error creando catálogo:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
