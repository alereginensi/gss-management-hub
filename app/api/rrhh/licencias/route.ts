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

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !isLicenciasRole(session.user?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const sector = searchParams.get('sector');
    const tipo = searchParams.get('tipo');
    const remitente = searchParams.get('remitente');
    const search = searchParams.get('search');
    const desdeGte = searchParams.get('desde_gte');
    const desdeLte = searchParams.get('desde_lte');

    const where: string[] = [];
    const params: unknown[] = [];

    if (sector) { where.push('sector = ?'); params.push(sector); }
    if (tipo) { where.push('tipo_licencia = ?'); params.push(tipo); }
    if (remitente) { where.push('remitente = ?'); params.push(remitente); }
    if (search) {
      where.push('(LOWER(funcionario) LIKE ? OR LOWER(padron) LIKE ?)');
      const q = `%${search.toLowerCase()}%`;
      params.push(q, q);
    }
    if (desdeGte) { where.push('desde >= ?'); params.push(desdeGte); }
    if (desdeLte) { where.push('desde <= ?'); params.push(desdeLte); }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = (await db.query(
      `SELECT ${SELECT_COLS} FROM rrhh_licencias ${whereSql} ORDER BY desde DESC NULLS LAST, id DESC`,
      params,
    )) as LicenciaRow[];

    return NextResponse.json({ licencias: rows.map(rowToLicencia) });
  } catch (err) {
    // Fallback: SQLite no soporta NULLS LAST; reintentamos con sort simple.
    try {
      const { searchParams } = new URL(request.url);
      const rows = (await db.query(
        `SELECT ${SELECT_COLS} FROM rrhh_licencias ORDER BY desde DESC, id DESC`,
        [],
      )) as LicenciaRow[];
      return NextResponse.json({ licencias: rows.map(rowToLicencia) });
    } catch (err2) {
      console.error('Error listando licencias:', err, err2);
      return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !isLicenciasRole(session.user?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const remitente = String(body?.remitente || '').trim();
    const funcionario = String(body?.funcionario || '').trim();
    const tipoLicencia = String(body?.tipoLicencia || body?.tipo_licencia || '').trim();

    if (!remitente || !funcionario || !tipoLicencia) {
      return NextResponse.json(
        { error: 'Remitente, funcionario y tipo de licencia son obligatorios' },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const isPg = (db as { type?: string }).type === 'pg';

    const params = [
      remitente,
      body?.padron ? String(body.padron) : null,
      funcionario,
      body?.nombreServicio ? String(body.nombreServicio) : null,
      body?.sector ? String(body.sector) : null,
      tipoLicencia,
      body?.desde || null,
      body?.hasta || null,
      body?.suplente ? String(body.suplente) : null,
      body?.recepNotificacion ? 1 : 0,
      body?.supervision ? 1 : 0,
      body?.recepCertificado ? 1 : 0,
      body?.planificacion ? 1 : 0,
      body?.observaciones ? String(body.observaciones) : null,
      now,
      now,
    ];

    const insertSql = `INSERT INTO rrhh_licencias (
      remitente, padron, funcionario, nombre_servicio, sector, tipo_licencia,
      desde, hasta, suplente, recep_notificacion, supervision,
      recep_certificado, planificacion, observaciones, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    let newId: number | null = null;
    if (isPg) {
      const rows = (await db.query(
        insertSql + ' RETURNING id',
        params,
      )) as Array<{ id: number }>;
      newId = rows[0]?.id ?? null;
    } else {
      const result = await db.run(insertSql, params);
      newId = Number(result.lastInsertRowid) || null;
    }

    if (!newId) {
      return NextResponse.json({ error: 'No se pudo crear la licencia' }, { status: 500 });
    }

    const rows = (await db.query(
      `SELECT ${SELECT_COLS} FROM rrhh_licencias WHERE id = ?`,
      [newId],
    )) as LicenciaRow[];

    return NextResponse.json({ licencia: rowToLicencia(rows[0]) });
  } catch (err) {
    console.error('Error creando licencia:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
