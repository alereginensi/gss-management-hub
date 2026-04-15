import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { logAudit } from '@/lib/agenda-helpers';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'supervisor'];

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';
    const empresa = searchParams.get('empresa') || '';
    const estado = searchParams.get('estado') || '';
    const enabled = searchParams.get('enabled') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search) {
      conditions.push('(LOWER(nombre) LIKE ? OR LOWER(documento) LIKE ? OR LOWER(sector) LIKE ? OR LOWER(puesto) LIKE ?)');
      const t = `%${search.toLowerCase()}%`;
      params.push(t, t, t, t);
    }
    if (empresa) { conditions.push('empresa = ?'); params.push(empresa); }
    if (estado) { conditions.push('estado = ?'); params.push(estado); }
    if (enabled !== '') { conditions.push('enabled = ?'); params.push(parseInt(enabled, 10)); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows, total] = await Promise.all([
      db.query(`SELECT * FROM agenda_employees ${where} ORDER BY nombre ASC LIMIT ? OFFSET ?`, [...params, limit, offset]),
      db.get(`SELECT COUNT(*) as count FROM agenda_employees ${where}`, params),
    ]);

    return NextResponse.json({ employees: rows, total: total?.count || 0, page, limit });
  } catch (err) {
    console.error('Error listando empleados:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { documento, nombre, empresa, sector, puesto, workplace_category, fecha_ingreso, talle_superior, talle_inferior, calzado, enabled, allow_reorder, estado, observaciones } = body;

    if (!documento?.trim()) return NextResponse.json({ error: 'Documento requerido' }, { status: 400 });
    if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });

    const existing = await db.get('SELECT id FROM agenda_employees WHERE documento = ?', [documento.trim()]);
    if (existing) return NextResponse.json({ error: 'Ya existe un empleado con ese documento' }, { status: 409 });

    const isPg = (db as any).type === 'pg';
    let id: number;

    if (isPg) {
      const res = await db.query(
        `INSERT INTO agenda_employees (documento, nombre, empresa, sector, puesto, workplace_category, fecha_ingreso, talle_superior, talle_inferior, calzado, enabled, allow_reorder, estado, observaciones, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
        [documento.trim(), nombre.trim(), empresa || null, sector || null, puesto || null, workplace_category || null, fecha_ingreso || null, talle_superior || null, talle_inferior || null, calzado || null, enabled ?? 1, allow_reorder ?? 0, estado || 'activo', observaciones || null, session.user.id]
      );
      id = res[0]?.id;
    } else {
      const result = await db.run(
        `INSERT INTO agenda_employees (documento, nombre, empresa, sector, puesto, workplace_category, fecha_ingreso, talle_superior, talle_inferior, calzado, enabled, allow_reorder, estado, observaciones, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [documento.trim(), nombre.trim(), empresa || null, sector || null, puesto || null, workplace_category || null, fecha_ingreso || null, talle_superior || null, talle_inferior || null, calzado || null, enabled ?? 1, allow_reorder ?? 0, estado || 'activo', observaciones || null, session.user.id]
      );
      id = result.lastInsertRowid as number;
    }

    const created = await db.get('SELECT * FROM agenda_employees WHERE id = ?', [id]);
    await logAudit('create', 'employee', id, session.user.id, { documento, nombre });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('Error creando empleado:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
