import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { isJornalesRole } from '@/lib/jornales-helpers';

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !isJornalesRole(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await db.query(
      `SELECT id, name, size, registros_totales, registros_nuevos, uploaded_by, created_at
       FROM jornales_archivos
       ORDER BY created_at DESC`,
    );
    return NextResponse.json({ archivos: rows });
  } catch (err) {
    console.error('Error listando archivos jornales:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
