import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { logAudit } from '@/lib/agenda-helpers';
import { AGENDA_EMERGENCY_ROLES, AGENDA_SUPERVISOR_ROLES, sourceForRole } from '@/lib/agenda-roles';

const READ_ROLES: readonly string[] = AGENDA_EMERGENCY_ROLES;
const WRITE_ROLES: readonly string[] = AGENDA_EMERGENCY_ROLES;
const FULL_TRUST_ROLES: readonly string[] = AGENDA_SUPERVISOR_ROLES;

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !READ_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const empresa = searchParams.get('empresa') || '';
    const search = searchParams.get('search')?.trim() || '';
    const sourceFilter = searchParams.get('source') || '';
    const emergencyFilter = searchParams.get('emergency') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];

    // Supervisores de limpieza/seguridad solo ven solicitudes que ellos originan.
    if (!FULL_TRUST_ROLES.includes(session.user.role)) {
      conditions.push('r.source = ?');
      params.push(sourceForRole(session.user.role));
    } else if (sourceFilter) {
      conditions.push('r.source = ?');
      params.push(sourceFilter);
    }

    if (status) { conditions.push('r.status = ?'); params.push(status); }
    if (empresa) { conditions.push('e.empresa = ?'); params.push(empresa); }
    if (emergencyFilter === '1') { conditions.push('r.is_emergency = 1'); }
    else if (emergencyFilter === '0') { conditions.push('(r.is_emergency IS NULL OR r.is_emergency = 0)'); }
    if (search) {
      conditions.push('(LOWER(e.nombre) LIKE ? OR LOWER(e.documento) LIKE ?)');
      const t = `%${search.toLowerCase()}%`;
      params.push(t, t);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows, total] = await Promise.all([
      db.query(
        `SELECT r.*, e.nombre as employee_nombre, e.documento as employee_documento, e.empresa as employee_empresa
         FROM agenda_requests r JOIN agenda_employees e ON e.id = r.employee_id
         ${where} ORDER BY r.requested_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ),
      db.get(
        `SELECT COUNT(*) as count FROM agenda_requests r JOIN agenda_employees e ON e.id = r.employee_id ${where}`,
        params
      ),
    ]);
    return NextResponse.json({ requests: rows, total: total?.count || 0, page, limit });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !WRITE_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { employee_id, article_type, size, reason, notes } = body;
    if (!employee_id) return NextResponse.json({ error: 'employee_id requerido' }, { status: 400 });
    if (!reason?.trim()) return NextResponse.json({ error: 'reason requerido' }, { status: 400 });

    // Aceptamos dos formatos:
    //  - Múltiple: body.items = [{ article_type, size? }, ...]
    //  - Single (legacy): body.article_type + body.size
    // Normalizamos todo a un array de items.
    let items: Array<{ article_type: string; size?: string }>;
    if (Array.isArray(body.items) && body.items.length > 0) {
      items = body.items
        .map((it: any) => ({
          article_type: String(it?.article_type || '').trim(),
          size: it?.size ? String(it.size).trim() : undefined,
        }))
        .filter((it: { article_type: string }) => it.article_type.length > 0);
      if (items.length === 0) {
        return NextResponse.json({ error: 'Debe incluir al menos un artículo' }, { status: 400 });
      }
    } else {
      if (!article_type?.trim()) {
        return NextResponse.json({ error: 'article_type requerido' }, { status: 400 });
      }
      items = [{ article_type: String(article_type).trim(), size: size ? String(size).trim() : undefined }];
    }

    // Determinar source + is_emergency según rol:
    //  - limpieza / tecnico / rrhh → forzamos origen y flag emergente
    //  - admin / logistica / jefe / supervisor → tomamos del body (default logistica, is_emergency=0)
    let source: string;
    let isEmergency: number;
    if (FULL_TRUST_ROLES.includes(session.user.role)) {
      source = typeof body.source === 'string' && body.source ? body.source : 'logistica';
      isEmergency = body.is_emergency === 1 || body.is_emergency === true ? 1 : 0;
    } else {
      source = sourceForRole(session.user.role);
      isEmergency = 1;
    }

    const isPg = (db as any).type === 'pg';
    const createdIds: number[] = [];
    for (const it of items) {
      if (isPg) {
        const res = await db.query(
          `INSERT INTO agenda_requests (employee_id, article_type, size, reason, notes, requested_by, is_emergency, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [employee_id, it.article_type, it.size || null, reason, notes || null, session.user.id, isEmergency, source]
        );
        createdIds.push(res[0]?.id);
      } else {
        const r = await db.run(
          `INSERT INTO agenda_requests (employee_id, article_type, size, reason, notes, requested_by, is_emergency, source)
           VALUES (?,?,?,?,?,?,?,?)`,
          [employee_id, it.article_type, it.size || null, reason, notes || null, session.user.id, isEmergency, source]
        );
        createdIds.push(r.lastInsertRowid as number);
      }
    }
    await logAudit('create', 'request', createdIds[0], session.user.id, {
      employee_id,
      items: items.length,
      article_types: items.map(i => i.article_type),
      source,
      is_emergency: isEmergency,
    });
    const placeholders = createdIds.map(() => '?').join(',');
    const created = await db.query(`SELECT * FROM agenda_requests WHERE id IN (${placeholders}) ORDER BY id ASC`, createdIds);
    return NextResponse.json({ created }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
