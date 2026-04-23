import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { isJornalesRole } from '@/lib/jornales-helpers';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ padron: string }> },
) {
  const session = await getSession(request);
  if (!session || !isJornalesRole(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { padron: padronRaw } = await params;
  const padron = String(padronRaw || '').trim();
  if (!padron) return NextResponse.json({ error: 'Padrón requerido' }, { status: 400 });

  try {
    const res = await db.run(`DELETE FROM jornales_personal WHERE padron = ?`, [padron]);
    return NextResponse.json({ deleted: res.changes });
  } catch (err) {
    console.error('Error eliminando persona jornales:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ padron: string }> },
) {
  const session = await getSession(request);
  if (!session || !isJornalesRole(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { padron: padronRaw } = await params;
  const padron = String(padronRaw || '').trim();
  if (!padron) return NextResponse.json({ error: 'Padrón requerido' }, { status: 400 });

  try {
    const body = await request.json();
    const val = Number(body?.efectividad_autorizada);
    if (val !== 0 && val !== 1) {
      return NextResponse.json({ error: 'Valor inválido (0 o 1)' }, { status: 400 });
    }

    const res = await db.run(
      `UPDATE jornales_personal SET efectividad_autorizada = ? WHERE padron = ?`,
      [val, padron],
    );
    if (res.changes === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    // Nota: las marcas acumuladas NO se borran al autorizar. Solo los archivos
    // nuevos ignoran padrones con efectividad_autorizada=1 (ver POST /marcas).
    // Esto preserva el conteo histórico visible para las personas ya efectivizadas.

    return NextResponse.json({ updated: res.changes });
  } catch (err) {
    console.error('Error actualizando efectividad:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
