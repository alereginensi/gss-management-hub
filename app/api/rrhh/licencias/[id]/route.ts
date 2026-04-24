import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { isLicenciasRole } from '@/lib/licencias-helpers';

interface LicenciaRow {
  id: number;
  remitente: string;
  padron: string | null;
  funcionario: string;
  nombre_servicio: string | null;
  sector: string | null;
  tipo_licencia: string;
  desde: string | Date | null;
  hasta: string | Date | null;
  suplente: string | null;
  recep_notificacion: number | null;
  supervision: number | null;
  recep_certificado: number | null;
  planificacion: number | null;
  observaciones: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

function toIsoDate(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (!v) return '';
  return String(v);
}

function rowToLicencia(r: LicenciaRow) {
  return {
    id: r.id,
    remitente: r.remitente ?? '',
    padron: r.padron ?? '',
    funcionario: r.funcionario ?? '',
    nombreServicio: r.nombre_servicio ?? '',
    sector: r.sector ?? '',
    tipoLicencia: r.tipo_licencia ?? '',
    desde: toIsoDate(r.desde) ?? '',
    hasta: toIsoDate(r.hasta) ?? '',
    suplente: r.suplente ?? '',
    recepNotificacion: Number(r.recep_notificacion) === 1,
    supervision: Number(r.supervision) === 1,
    recepCertificado: Number(r.recep_certificado) === 1,
    planificacion: Number(r.planificacion) === 1,
    observaciones: r.observaciones ?? '',
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

const SELECT_COLS = `id, remitente, padron, funcionario, nombre_servicio, sector,
  tipo_licencia, desde, hasta, suplente, recep_notificacion, supervision,
  recep_certificado, planificacion, observaciones, created_at, updated_at`;

// Mapa body-camelCase → column snake_case + coerción de tipo.
type Coerce = 'string' | 'stringOrNull' | 'date' | 'bool';
const UPDATABLE: Record<string, { col: string; coerce: Coerce }> = {
  remitente: { col: 'remitente', coerce: 'string' },
  padron: { col: 'padron', coerce: 'stringOrNull' },
  funcionario: { col: 'funcionario', coerce: 'string' },
  nombreServicio: { col: 'nombre_servicio', coerce: 'stringOrNull' },
  sector: { col: 'sector', coerce: 'stringOrNull' },
  tipoLicencia: { col: 'tipo_licencia', coerce: 'string' },
  desde: { col: 'desde', coerce: 'date' },
  hasta: { col: 'hasta', coerce: 'date' },
  suplente: { col: 'suplente', coerce: 'stringOrNull' },
  recepNotificacion: { col: 'recep_notificacion', coerce: 'bool' },
  supervision: { col: 'supervision', coerce: 'bool' },
  recepCertificado: { col: 'recep_certificado', coerce: 'bool' },
  planificacion: { col: 'planificacion', coerce: 'bool' },
  observaciones: { col: 'observaciones', coerce: 'stringOrNull' },
};

function coerceValue(v: unknown, type: Coerce): unknown {
  if (type === 'bool') return v ? 1 : 0;
  if (type === 'string') return v == null ? '' : String(v);
  if (type === 'stringOrNull') return v == null || v === '' ? null : String(v);
  if (type === 'date') return v == null || v === '' ? null : String(v).slice(0, 10);
  return v;
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession(request);
  if (!session || !isLicenciasRole(session.user?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const idNum = parseInt(id, 10);
  if (!idNum) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  try {
    const body = await request.json();
    const setParts: string[] = [];
    const values: unknown[] = [];

    for (const [bodyKey, meta] of Object.entries(UPDATABLE)) {
      if (!(bodyKey in body)) continue;
      setParts.push(`${meta.col} = ?`);
      values.push(coerceValue((body as Record<string, unknown>)[bodyKey], meta.coerce));
    }

    setParts.push('updated_at = ?');
    values.push(new Date().toISOString());

    if (setParts.length === 1) {
      // Solo updated_at — nada que actualizar. Devolver fila actual.
      const rows = (await db.query(
        `SELECT ${SELECT_COLS} FROM rrhh_licencias WHERE id = ?`,
        [idNum],
      )) as LicenciaRow[];
      if (rows.length === 0) {
        return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
      }
      return NextResponse.json({ licencia: rowToLicencia(rows[0]) });
    }

    values.push(idNum);
    const result = await db.run(
      `UPDATE rrhh_licencias SET ${setParts.join(', ')} WHERE id = ?`,
      values,
    );
    if (!result.changes) {
      return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
    }

    const rows = (await db.query(
      `SELECT ${SELECT_COLS} FROM rrhh_licencias WHERE id = ?`,
      [idNum],
    )) as LicenciaRow[];
    return NextResponse.json({ licencia: rowToLicencia(rows[0]) });
  } catch (err) {
    console.error('Error actualizando licencia:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession(request);
  if (!session || !isLicenciasRole(session.user?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const idNum = parseInt(id, 10);
  if (!idNum) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  try {
    const result = await db.run(`DELETE FROM rrhh_licencias WHERE id = ?`, [idNum]);
    if (!result.changes) {
      return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error eliminando licencia:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
