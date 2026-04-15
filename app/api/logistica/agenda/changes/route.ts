import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { logAudit, calculateExpirationDate } from '@/lib/agenda-helpers';
import { saveAgendaFile } from '@/lib/agenda-storage';
import { parseRemitoText } from '@/lib/agenda-remito-parser';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'supervisor'];

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employee_id') || '';
    const status = searchParams.get('status') || '';
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';
    const empresa = searchParams.get('empresa') || '';
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (employeeId) { conditions.push('c.employee_id = ?'); params.push(parseInt(employeeId, 10)); }
    if (status) { conditions.push('c.status = ?'); params.push(status); }
    if (from) { conditions.push("date(c.changed_at) >= ?"); params.push(from); }
    if (to) { conditions.push("date(c.changed_at) <= ?"); params.push(to); }
    if (empresa) { conditions.push('e.empresa = ?'); params.push(empresa); }
    if (search) {
      conditions.push('(LOWER(e.nombre) LIKE ? OR LOWER(e.documento) LIKE ?)');
      params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const isPg = (db as any).type === 'pg';
    const limitPlaceholder = isPg ? `$${params.length + 1}` : '?';
    const offsetPlaceholder = isPg ? `$${params.length + 2}` : '?';

    // Fix placeholders for PG
    let whereClause = where;
    if (isPg) {
      let idx = 1;
      whereClause = where.replace(/\?/g, () => `$${idx++}`);
    }

    const countParams = [...params];
    const countWhere = isPg
      ? (() => { let i = 1; return where.replace(/\?/g, () => `$${i++}`); })()
      : where;

    const countRow = await db.get(
      `SELECT COUNT(*) as cnt FROM agenda_change_events c JOIN agenda_employees e ON e.id = c.employee_id ${countWhere}`,
      countParams
    );
    const total = parseInt(String(countRow?.cnt ?? 0), 10);

    const rows = await db.query(
      `SELECT c.*,
              e.nombre as employee_nombre, e.documento as employee_documento, e.empresa as employee_empresa,
              na.article_type as new_article_type, na.size as new_article_size,
              ra.article_type as returned_article_type, ra.size as returned_article_size, ra.delivery_date as returned_delivery_date
       FROM agenda_change_events c
       JOIN agenda_employees e ON e.id = c.employee_id
       LEFT JOIN agenda_articles na ON na.id = c.new_article_id
       LEFT JOIN agenda_articles ra ON ra.id = c.returned_article_id
       ${whereClause} ORDER BY c.changed_at DESC LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
      [...params, limit, offset]
    );
    return NextResponse.json({ changes: rows, total, page, limit });
  } catch (err) {
    console.error('Error listando cambios:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const employee_id = parseInt(formData.get('employee_id') as string);
    const new_article_id = formData.get('new_article_id') ? parseInt(formData.get('new_article_id') as string) : null;
    const returned_article_id = formData.get('returned_article_id') ? parseInt(formData.get('returned_article_id') as string) : null;
    const notes = (formData.get('notes') as string) || null;
    const article_type_new = (formData.get('article_type_new') as string) || null;
    const article_size_new = (formData.get('article_size_new') as string) || null;
    const useful_life_new = parseInt(formData.get('useful_life_new') as string || '12', 10);

    const deliveryFile = formData.get('delivery_receipt') as File | null;
    const returnFile = formData.get('return_receipt') as File | null;
    const deliveryRawText = (formData.get('delivery_raw_text') as string) || null;
    const returnRawText = (formData.get('return_raw_text') as string) || null;

    if (!employee_id) return NextResponse.json({ error: 'employee_id requerido' }, { status: 400 });

    let deliveryReceiptUrl: string | null = null;
    let returnReceiptUrl: string | null = null;

    if (deliveryFile) {
      const buf = Buffer.from(await deliveryFile.arrayBuffer());
      const ext = deliveryFile.name.split('.').pop() || 'pdf';
      deliveryReceiptUrl = await saveAgendaFile(buf, `entrega-emp${employee_id}-${Date.now()}.${ext}`, 'cambios');
    }
    if (returnFile) {
      const buf = Buffer.from(await returnFile.arrayBuffer());
      const ext = returnFile.name.split('.').pop() || 'pdf';
      returnReceiptUrl = await saveAgendaFile(buf, `devolucion-emp${employee_id}-${Date.now()}.${ext}`, 'cambios');
    }

    const isPg = (db as any).type === 'pg';
    let id: number;

    if (isPg) {
      const res = await db.query(
        `INSERT INTO agenda_change_events (employee_id, new_article_id, returned_article_id, delivery_receipt_url, return_receipt_url, notes, processed_by, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'pendiente') RETURNING id`,
        [employee_id, new_article_id, returned_article_id, deliveryReceiptUrl, returnReceiptUrl, notes, session.user.id]
      );
      id = res[0]?.id;
    } else {
      const r = await db.run(
        `INSERT INTO agenda_change_events (employee_id, new_article_id, returned_article_id, delivery_receipt_url, return_receipt_url, notes, processed_by, status)
         VALUES (?,?,?,?,?,?,?,'pendiente')`,
        [employee_id, new_article_id, returned_article_id, deliveryReceiptUrl, returnReceiptUrl, notes, session.user.id]
      );
      id = r.lastInsertRowid as number;
    }

    // Si returned_article_id: marcar como 'en_cambio' temporalmente (no devuelto aún — se completa al firmar)
    // Por ahora solo registramos, el status final se setea en /complete

    // Crear nuevo artículo si se especificó tipo (desde catálogo)
    if (article_type_new) {
      const deliveryDate = new Date().toISOString().split('T')[0];
      const expirationDate = calculateExpirationDate(deliveryDate, useful_life_new);
      const renewalEnabledAt = calculateExpirationDate(deliveryDate, Math.round(useful_life_new * 0.8));

      if (isPg) {
        const artRes = await db.query(
          `INSERT INTO agenda_articles (employee_id, article_type, size, delivery_date, useful_life_months, expiration_date, renewal_enabled_at, condition_status, origin_type, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'nuevo','cambio',$8) RETURNING id`,
          [employee_id, article_type_new, article_size_new || null, deliveryDate, useful_life_new, expirationDate, renewalEnabledAt, session.user.id]
        );
        await db.run(`UPDATE agenda_change_events SET new_article_id = $1 WHERE id = $2`, [artRes[0].id, id]);
      } else {
        const artR = await db.run(
          `INSERT INTO agenda_articles (employee_id, article_type, size, delivery_date, useful_life_months, expiration_date, renewal_enabled_at, condition_status, origin_type, created_by)
           VALUES (?,?,?,?,?,?,?,'nuevo','cambio',?)`,
          [employee_id, article_type_new, article_size_new || null, deliveryDate, useful_life_new, expirationDate, renewalEnabledAt, session.user.id]
        );
        await db.run(`UPDATE agenda_change_events SET new_article_id = ? WHERE id = ?`, [artR.lastInsertRowid, id]);
      }
    }

    await logAudit('create', 'change_event', id, session.user.id, { employee_id, new_article_id, returned_article_id });

    // Parse remito texts if provided — returned so frontend can pre-fill on detail page
    const deliveryParsed = deliveryRawText ? parseRemitoText(deliveryRawText) : null;
    const returnParsed = returnRawText ? parseRemitoText(returnRawText) : null;

    return NextResponse.json({ id, deliveryReceiptUrl, returnReceiptUrl, deliveryParsed, returnParsed });
  } catch (err: any) {
    console.error('Error procesando cambio:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
