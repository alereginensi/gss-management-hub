import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { parseOrderItems } from '@/lib/agenda-helpers';
import * as XLSX from 'xlsx';

const AUTH_ROLES = ['admin', 'logistica', 'jefe'];

// GET /api/logistica/agenda/export?type=citas|empleados|entregas&from=&to=&empresa=
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'citas';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const empresa = searchParams.get('empresa') || '';
  const status = searchParams.get('status') || '';
  const search = searchParams.get('search') || '';

  try {
    let rows: any[] = [];
    let sheetName = 'Datos';
    let filename = 'exportacion.xlsx';

    if (type === 'citas') {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (from) { conditions.push('s.fecha >= ?'); params.push(from); }
      if (to) { conditions.push('s.fecha <= ?'); params.push(to); }
      if (empresa) { conditions.push('e.empresa = ?'); params.push(empresa); }
      if (status) { conditions.push('a.status = ?'); params.push(status); }
      if (search) {
        conditions.push('(LOWER(e.nombre) LIKE ? OR LOWER(e.documento) LIKE ?)');
        params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const data = await db.query(
        `SELECT a.id, a.status, a.remito_number, a.delivered_at,
                e.nombre, e.documento, e.empresa, e.sector, e.puesto,
                s.fecha, s.start_time, s.end_time,
                a.order_items, a.delivered_order_items, a.delivery_notes
         FROM agenda_appointments a
         JOIN agenda_employees e ON e.id = a.employee_id
         JOIN agenda_time_slots s ON s.id = a.time_slot_id
         ${where} ORDER BY s.fecha DESC`,
        params
      );
      rows = data.map((r: any) => ({
        ID: r.id,
        Fecha: r.fecha,
        Hora: `${r.start_time}–${r.end_time}`,
        Nombre: r.nombre,
        Documento: r.documento,
        Empresa: r.empresa || '',
        Sector: r.sector || '',
        Puesto: r.puesto || '',
        Estado: r.status,
        'Nro Remito': r.remito_number || '',
        'Ítems pedido': parseOrderItems(r.order_items).map((i: any) => `${i.qty}x ${i.article_type}`).join(', '),
        'Ítems entregados': parseOrderItems(r.delivered_order_items).map((i: any) => `${i.qty}x ${i.article_type}`).join(', '),
        'Fecha entrega': r.delivered_at || '',
        Notas: r.delivery_notes || '',
      }));
      sheetName = 'Citas';
      filename = `agenda_citas_${new Date().toISOString().split('T')[0]}.xlsx`;

    } else if (type === 'empleados') {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (empresa) { conditions.push('empresa = ?'); params.push(empresa); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const data = await db.query(`SELECT * FROM agenda_employees ${where} ORDER BY nombre ASC`, params);
      rows = data.map((r: any) => ({
        ID: r.id,
        Documento: r.documento,
        Nombre: r.nombre,
        Empresa: r.empresa || '',
        Sector: r.sector || '',
        Puesto: r.puesto || '',
        Categoría: r.workplace_category || '',
        'Fecha ingreso': r.fecha_ingreso || '',
        'Talle sup.': r.talle_superior || '',
        'Talle inf.': r.talle_inferior || '',
        Calzado: r.calzado || '',
        Habilitado: r.enabled ? 'Sí' : 'No',
        Estado: r.estado,
        Observaciones: r.observaciones || '',
        'Creado': r.created_at,
      }));
      sheetName = 'Empleados';
      filename = `agenda_empleados_${new Date().toISOString().split('T')[0]}.xlsx`;

    } else if (type === 'entregas') {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (from) { conditions.push('a.delivery_date >= ?'); params.push(from); }
      if (to) { conditions.push('a.delivery_date <= ?'); params.push(to); }
      if (empresa) { conditions.push('e.empresa = ?'); params.push(empresa); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const data = await db.query(
        `SELECT a.*, e.nombre, e.documento, e.empresa
         FROM agenda_articles a JOIN agenda_employees e ON e.id = a.employee_id
         ${where} ORDER BY a.delivery_date DESC`,
        params
      );
      rows = data.map((r: any) => ({
        ID: r.id,
        Empleado: r.nombre,
        Documento: r.documento,
        Empresa: r.empresa || '',
        Artículo: r.article_type,
        Talle: r.size || '',
        'Fecha entrega': r.delivery_date,
        'Vida útil (meses)': r.useful_life_months,
        'Vencimiento': r.expiration_date || '',
        'Estado artículo': r.current_status,
        Condición: r.condition_status,
        Origen: r.origin_type,
        Notas: r.notes || '',
        Migrado: r.migrated_flag ? 'Sí' : 'No',
      }));
      sheetName = 'Entregas';
      filename = `agenda_entregas_${new Date().toISOString().split('T')[0]}.xlsx`;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('Error exportando:', err);
    return NextResponse.json({ error: 'Error interno al exportar' }, { status: 500 });
  }
}
