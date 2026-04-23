import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { isJornalesRole } from '@/lib/jornales-helpers';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession(request);
  if (!session || !isJornalesRole(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idRaw } = await params;
  const id = parseInt(idRaw, 10);
  if (!id || isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  try {
    await db.run(`DELETE FROM jornales_marcas WHERE file_id = ?`, [id]);
    const res = await db.run(`DELETE FROM jornales_archivos WHERE id = ?`, [id]);
    if (res.changes === 0) return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error('Error eliminando archivo jornales:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
