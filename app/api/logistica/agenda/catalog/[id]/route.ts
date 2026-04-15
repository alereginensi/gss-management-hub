import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { logAudit } from '@/lib/agenda-helpers';

const AUTH_ROLES = ['admin', 'logistica', 'jefe'];

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  try {
    const body = await request.json();
    const { empresa, sector, puesto, workplace_category, article_type, article_name_normalized, quantity, useful_life_months, initial_enabled, renewable, reusable_allowed, special_authorization_required } = body;

    if (!article_type?.trim()) return NextResponse.json({ error: 'Tipo de artículo requerido' }, { status: 400 });

    await db.run(
      `UPDATE agenda_uniform_catalog SET empresa=?, sector=?, puesto=?, workplace_category=?, article_type=?, article_name_normalized=?, quantity=?, useful_life_months=?, initial_enabled=?, renewable=?, reusable_allowed=?, special_authorization_required=? WHERE id=?`,
      [empresa || null, sector || null, puesto || null, workplace_category || null, article_type.trim(), article_name_normalized || null, quantity ?? 1, useful_life_months ?? 12, initial_enabled ?? 1, renewable ?? 1, reusable_allowed ?? 0, special_authorization_required ?? 0, id]
    );

    const updated = await db.get('SELECT * FROM agenda_uniform_catalog WHERE id = ?', [id]);
    await logAudit('update', 'catalog', id, session.user.id, { article_type });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('Error actualizando catálogo:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  await db.run('DELETE FROM agenda_uniform_catalog WHERE id = ?', [id]);
  await logAudit('delete', 'catalog', id, session.user.id, {});
  return NextResponse.json({ success: true });
}
