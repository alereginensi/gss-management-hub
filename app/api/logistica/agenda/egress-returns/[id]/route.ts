import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { parseOrderItems } from '@/lib/agenda-helpers';
import { AGENDA_ADMIN_ROLES } from '@/lib/agenda-roles';

const AUTH_ROLES: readonly string[] = AGENDA_ADMIN_ROLES;

const LIGHT_COLS = [
  'id', 'employee_id', 'returned_items',
  'remito_number', 'remito_pdf_url', 'remito_filename',
  'parsed_remito_text', 'parsed_remito_data',
  'employee_signature_url', 'responsible_signature_url',
  'notes', 'status', 'created_by', 'created_at', 'updated_at',
];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  try {
    const row = await db.get(
      `SELECT ${LIGHT_COLS.map(c => `r.${c}`).join(', ')},
              e.nombre AS employee_nombre, e.documento AS employee_documento,
              e.empresa AS employee_empresa, e.sector AS employee_sector, e.puesto AS employee_puesto
       FROM agenda_egress_returns r
       JOIN agenda_employees e ON e.id = r.employee_id
       WHERE r.id = ?`,
      [id]
    );
    if (!row) return NextResponse.json({ error: 'Egreso no encontrado' }, { status: 404 });
    return NextResponse.json({
      ...row,
      returned_items: parseOrderItems(row.returned_items),
    });
  } catch (err) {
    console.error('Error obteniendo egreso:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
