import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { parseOrderItems, logAudit } from '@/lib/agenda-helpers';
import { saveAgendaFile } from '@/lib/agenda-storage';
import { AGENDA_ADMIN_ROLES } from '@/lib/agenda-roles';

const AUTH_ROLES: readonly string[] = AGENDA_ADMIN_ROLES;

const LIGHT_COLS = [
  'id', 'employee_id', 'returned_items',
  'remito_number', 'remito_pdf_url', 'remito_filename',
  'parsed_remito_text', 'parsed_remito_data',
  'employee_signature_url', 'responsible_signature_url',
  'notes', 'status', 'created_by', 'created_at', 'updated_at',
];

// GET /api/logistica/agenda/egress-returns?search=&from=&to=&employee_id=
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';
    const search = searchParams.get('search')?.trim() || '';
    const employeeId = searchParams.get('employee_id');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];

    const isPg = (db as any).type === 'pg';
    if (from) {
      conditions.push(isPg ? 'r.created_at::date >= ?' : 'date(r.created_at) >= ?');
      params.push(from);
    }
    if (to) {
      conditions.push(isPg ? 'r.created_at::date <= ?' : 'date(r.created_at) <= ?');
      params.push(to);
    }
    if (employeeId) {
      conditions.push('r.employee_id = ?');
      params.push(parseInt(employeeId, 10));
    }
    if (search) {
      conditions.push('(LOWER(e.nombre) LIKE ? OR LOWER(e.documento) LIKE ?)');
      const t = `%${search.toLowerCase()}%`;
      params.push(t, t);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows, total] = await Promise.all([
      db.query(
        `SELECT ${LIGHT_COLS.map(c => `r.${c}`).join(', ')},
                e.nombre AS employee_nombre, e.documento AS employee_documento,
                e.empresa AS employee_empresa, e.sector AS employee_sector, e.puesto AS employee_puesto
         FROM agenda_egress_returns r
         JOIN agenda_employees e ON e.id = r.employee_id
         ${where}
         ORDER BY r.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ),
      db.get(
        `SELECT COUNT(*) as count FROM agenda_egress_returns r
         JOIN agenda_employees e ON e.id = r.employee_id
         ${where}`,
        params
      ),
    ]);

    const items = rows.map((r: any) => ({
      ...r,
      returned_items: parseOrderItems(r.returned_items),
    }));

    return NextResponse.json({ items, total: total?.count || 0, page, limit });
  } catch (err) {
    console.error('Error listando egresos:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST /api/logistica/agenda/egress-returns
// Body JSON: { employee_id, returned_items, remito_number?, notes?,
//              employee_signature?, responsible_signature? (dataUrls) }
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const employeeId = parseInt(body.employee_id, 10);
    if (!employeeId) {
      return NextResponse.json({ error: 'employee_id requerido' }, { status: 400 });
    }
    const employee = await db.get('SELECT id, nombre FROM agenda_employees WHERE id = ?', [employeeId]);
    if (!employee) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    const items = Array.isArray(body.returned_items)
      ? body.returned_items.filter((it: any) => it && typeof it.article_type === 'string' && it.article_type.trim())
      : [];
    if (!items.length) {
      return NextResponse.json({ error: 'Agregá al menos un ítem devuelto' }, { status: 400 });
    }

    const remitoNumber = typeof body.remito_number === 'string' ? body.remito_number.trim() || null : null;
    const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null;

    // Guardar firmas en Cloudinary si vienen como dataUrl
    async function storeSignature(raw: unknown): Promise<string | null> {
      if (typeof raw !== 'string' || !raw.startsWith('data:image/')) return null;
      const comma = raw.indexOf(',');
      if (comma < 0) return null;
      const buffer = Buffer.from(raw.slice(comma + 1), 'base64');
      const filename = `firma-egreso-${Date.now()}.png`;
      try {
        return await saveAgendaFile(buffer, filename, 'firmas');
      } catch (e) {
        console.warn('[egress] saveAgendaFile firma fallo:', (e as Error).message);
        return null;
      }
    }

    const employeeSigUrl = await storeSignature(body.employee_signature);
    const responsibleSigUrl = await storeSignature(body.responsible_signature);

    const isPg = (db as any).type === 'pg';
    const nowSql = isPg ? 'NOW()' : "datetime('now')";

    const result = await db.run(
      `INSERT INTO agenda_egress_returns
        (employee_id, returned_items, remito_number, notes,
         employee_signature_url, responsible_signature_url,
         status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'registrada', ?, ${nowSql}, ${nowSql})`,
      [
        employeeId,
        JSON.stringify(items),
        remitoNumber,
        notes,
        employeeSigUrl,
        responsibleSigUrl,
        session.user.id,
      ]
    );

    let newId: number | undefined;
    if (isPg) {
      const r = await db.get(
        `SELECT id FROM agenda_egress_returns WHERE employee_id = ? ORDER BY id DESC LIMIT 1`,
        [employeeId]
      );
      newId = r?.id;
    } else {
      newId = result.lastInsertRowid as number;
    }

    // Desactivar empleado + marcar artículos activos como devueltos
    await db.run(
      `UPDATE agenda_employees SET enabled = 0, estado = 'inactivo' WHERE id = ?`,
      [employeeId]
    );
    await db.run(
      `UPDATE agenda_articles SET current_status = 'devuelto', updated_at = ${nowSql}
       WHERE employee_id = ? AND current_status = 'activo'`,
      [employeeId]
    );

    await logAudit('create_egress_return', 'egress_return', newId ?? 0, session.user.id, {
      employee_id: employeeId,
      items_count: items.length,
    });

    return NextResponse.json({ ok: true, id: newId }, { status: 201 });
  } catch (err) {
    console.error('Error creando egreso:', err);
    return NextResponse.json({ error: (err as Error).message || 'Error interno' }, { status: 500 });
  }
}
