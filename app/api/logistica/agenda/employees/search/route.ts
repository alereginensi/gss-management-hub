import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { AGENDA_EMERGENCY_ROLES } from '@/lib/agenda-roles';

const AUTH_ROLES: readonly string[] = AGENDA_EMERGENCY_ROLES;

// GET /api/logistica/agenda/employees/search?q=<doc|nombre>
// Buscador liviano para usar desde los hubs de Limpieza y Seguridad Electrónica
// al cargar solicitudes emergentes. Devuelve solo id/documento/nombre/empresa.
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || '';
    if (q.length < 2) {
      return NextResponse.json({ employees: [] });
    }

    const t = `%${q.toLowerCase()}%`;
    const rows = await db.query(
      `SELECT id, documento, nombre, empresa
       FROM agenda_employees
       WHERE estado = 'activo'
         AND (LOWER(nombre) LIKE ? OR LOWER(documento) LIKE ?)
       ORDER BY nombre ASC
       LIMIT 20`,
      [t, t]
    );

    return NextResponse.json({ employees: rows });
  } catch (err) {
    console.error('Error en búsqueda de empleados:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
