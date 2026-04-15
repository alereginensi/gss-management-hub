import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { logAudit } from '@/lib/agenda-helpers';
import { uploadToCloudinary } from '@/lib/cloudinary';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'supervisor'];

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const search = searchParams.get('search')?.trim() || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (status) { conditions.push('s.shipment_status = ?'); params.push(status); }
    if (search) {
      conditions.push('(LOWER(e.nombre) LIKE ? OR LOWER(e.documento) LIKE ? OR LOWER(s.tracking_number) LIKE ?)');
      const t = `%${search.toLowerCase()}%`;
      params.push(t, t, t);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows, total] = await Promise.all([
      db.query(
        `SELECT s.*, e.nombre as employee_nombre, e.documento as employee_documento, e.empresa as employee_empresa
         FROM agenda_shipments s JOIN agenda_employees e ON e.id = s.employee_id
         ${where} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ),
      db.get(
        `SELECT COUNT(*) as count FROM agenda_shipments s JOIN agenda_employees e ON e.id = s.employee_id ${where}`,
        params
      ),
    ]);
    return NextResponse.json({ shipments: rows, total: total?.count || 0, page, limit });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { 
      employee_id, appointment_id, tracking_number, carrier, destination, 
      weight, declared_value, description, invoice_image_url, notes, 
      article_ids, supervisor_signature_data 
    } = body;
    
    if (!employee_id) return NextResponse.json({ error: 'employee_id requerido' }, { status: 400 });
    if (!supervisor_signature_data) return NextResponse.json({ error: 'Firma de supervisor requerida' }, { status: 400 });

    // Subir firma a Cloudinary
    let supervisor_signature_url = null;
    try {
      const buffer = Buffer.from(supervisor_signature_data.split(',')[1], 'base64');
      supervisor_signature_url = await uploadToCloudinary(
        buffer, 
        'agenda/shipments', 
        `firma-sup-${employee_id}-${Date.now()}`, 
        'image'
      );
    } catch (err) {
      console.error('Error uploading supervisor signature:', err);
      return NextResponse.json({ error: 'Error al subir firma del supervisor' }, { status: 500 });
    }

    const isPg = (db as any).type === 'pg';
    let id: number;
    if (isPg) {
      const res = await db.query(
        `INSERT INTO agenda_shipments (
          employee_id, appointment_id, tracking_number, carrier, destination, 
          weight, declared_value, description, invoice_image_url, supervisor_signature_url, notes, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [
          employee_id, appointment_id || null, tracking_number || null, carrier || null, destination || null,
          weight || null, declared_value || null, description || null, invoice_image_url || null, supervisor_signature_url, notes || null, 
          session.user.id
        ]
      );
      id = res[0]?.id;
    } else {
      const r = await db.run(
        `INSERT INTO agenda_shipments (
          employee_id, appointment_id, tracking_number, carrier, destination, 
          weight, declared_value, description, invoice_image_url, supervisor_signature_url, notes, created_by
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          employee_id, appointment_id || null, tracking_number || null, carrier || null, destination || null,
          weight || null, declared_value || null, description || null, invoice_image_url || null, supervisor_signature_url, notes || null, 
          session.user.id
        ]
      );
      id = r.lastInsertRowid as number;
    }

    // Vincular artículos si se indicaron
    if (Array.isArray(article_ids) && article_ids.length > 0) {
      for (const artId of article_ids) {
        await db.run(
          `INSERT ${isPg ? '' : 'OR IGNORE'} INTO agenda_shipment_articles (shipment_id, article_id) VALUES (?,?)${isPg ? ' ON CONFLICT DO NOTHING' : ''}`,
          [id, artId]
        );
      }
    }

    const created = await db.get('SELECT * FROM agenda_shipments WHERE id = ?', [id]);
    await logAudit('create', 'shipment', id, session.user.id, { employee_id, tracking_number });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
