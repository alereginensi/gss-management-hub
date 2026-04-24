import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { isCitacionesRole } from '@/lib/citaciones-helpers';

interface CitacionRow {
  id: string;
  empresa: string;
  org: string;
  fecha: string | null;
  hora: string | null;
  sede: string | null;
  trabajador: string | null;
  abogado: string | null;
  rubros: string | null;
  total: number | string | null;
  estado: string;
  motivo: string | null;
  acuerdo: string | null;
  macuerdo: number | string | null;
  facturas: string | null;
  obs: string | null;
  pdf_url: string | null;
  pdf_filename: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (!v) return '';
  return String(v);
}

function parseFacturas(raw: unknown): Array<{ id: string; nro: string; tipo: string; monto: number }> {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as any[];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function rowToCitacion(r: CitacionRow) {
  return {
    id: r.id,
    empresa: r.empresa ?? '',
    org: (r.org ?? 'MTSS') as 'MTSS' | 'Juzgado',
    fecha: r.fecha ?? '',
    hora: r.hora ?? '',
    sede: r.sede ?? '',
    trabajador: r.trabajador ?? '',
    abogado: r.abogado ?? '',
    rubros: r.rubros ?? '',
    total: Number(r.total) || 0,
    estado: (r.estado ?? 'pendiente') as 'pendiente' | 'en curso' | 'cerrado',
    motivo: r.motivo ?? '',
    acuerdo: r.acuerdo ?? '',
    macuerdo: Number(r.macuerdo) || 0,
    facturas: parseFacturas(r.facturas),
    obs: r.obs ?? '',
    pdfUrl: r.pdf_url ?? null,
    pdfFilename: r.pdf_filename ?? null,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

const UPDATABLE_FIELDS: Record<string, { column: string; cast?: 'number' | 'string' | 'json' }> = {
  empresa: { column: 'empresa', cast: 'string' },
  org: { column: 'org', cast: 'string' },
  fecha: { column: 'fecha', cast: 'string' },
  hora: { column: 'hora', cast: 'string' },
  sede: { column: 'sede', cast: 'string' },
  trabajador: { column: 'trabajador', cast: 'string' },
  abogado: { column: 'abogado', cast: 'string' },
  rubros: { column: 'rubros', cast: 'string' },
  total: { column: 'total', cast: 'number' },
  estado: { column: 'estado', cast: 'string' },
  motivo: { column: 'motivo', cast: 'string' },
  acuerdo: { column: 'acuerdo', cast: 'string' },
  macuerdo: { column: 'macuerdo', cast: 'number' },
  facturas: { column: 'facturas', cast: 'json' },
  obs: { column: 'obs', cast: 'string' },
};

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession(request);
  if (!session || !isCitacionesRole(session.user?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const body = await request.json();
    const setParts: string[] = [];
    const values: unknown[] = [];

    for (const [key, meta] of Object.entries(UPDATABLE_FIELDS)) {
      if (!(key in body)) continue;
      const raw = (body as Record<string, unknown>)[key];
      let v: unknown;
      if (meta.cast === 'number') {
        v = Number(raw) || 0;
      } else if (meta.cast === 'json') {
        const arr = Array.isArray(raw) ? raw : [];
        v = JSON.stringify(
          arr.map((f: any) => ({
            id: typeof f?.id === 'string' && f.id ? f.id : crypto.randomUUID(),
            nro: String(f?.nro ?? ''),
            tipo: String(f?.tipo ?? 'Otros'),
            monto: Number(f?.monto) || 0,
          })),
        );
      } else {
        v = raw === null || raw === undefined ? null : String(raw);
      }
      setParts.push(`${meta.column} = ?`);
      values.push(v);
    }

    setParts.push('updated_at = ?');
    values.push(new Date().toISOString());

    if (setParts.length === 1) {
      // Solo updated_at → no hay cambios reales; devolver la fila actual.
      const rows = (await db.query(
        `SELECT id, empresa, org, fecha, hora, sede, trabajador, abogado, rubros,
                total, estado, motivo, acuerdo, macuerdo, facturas, obs,
                pdf_url, pdf_filename, created_at, updated_at
         FROM rrhh_citaciones WHERE id = ?`,
        [id],
      )) as CitacionRow[];
      if (rows.length === 0) {
        return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
      }
      return NextResponse.json({ citacion: rowToCitacion(rows[0]) });
    }

    values.push(id);
    const result = await db.run(
      `UPDATE rrhh_citaciones SET ${setParts.join(', ')} WHERE id = ?`,
      values,
    );
    if (!result.changes) {
      return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
    }

    const rows = (await db.query(
      `SELECT id, empresa, org, fecha, hora, sede, trabajador, abogado, rubros,
              total, estado, motivo, acuerdo, macuerdo, facturas, obs,
              pdf_url, pdf_filename, created_at, updated_at
       FROM rrhh_citaciones WHERE id = ?`,
      [id],
    )) as CitacionRow[];
    return NextResponse.json({ citacion: rowToCitacion(rows[0]) });
  } catch (err) {
    console.error('Error actualizando citación:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession(request);
  if (!session || !isCitacionesRole(session.user?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const result = await db.run(`DELETE FROM rrhh_citaciones WHERE id = ?`, [id]);
    if (!result.changes) {
      return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error eliminando citación:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
