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

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !isCitacionesRole(session.user?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = (await db.query(
      `SELECT id, empresa, org, fecha, hora, sede, trabajador, abogado, rubros,
              total, estado, motivo, acuerdo, macuerdo, facturas, obs,
              pdf_url, pdf_filename, created_at, updated_at
       FROM rrhh_citaciones
       ORDER BY created_at DESC`,
    )) as CitacionRow[];
    return NextResponse.json({ citaciones: rows.map(rowToCitacion) });
  } catch (err) {
    console.error('Error listando citaciones:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !isCitacionesRole(session.user?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const empresa = String(body?.empresa || '').trim();
    const fecha = body?.fecha ? String(body.fecha).trim() : '';
    if (!empresa) {
      return NextResponse.json({ error: 'Empresa requerida' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const facturasArr = Array.isArray(body?.facturas) ? body.facturas : [];
    const facturas = JSON.stringify(
      facturasArr.map((f: any) => ({
        id: typeof f?.id === 'string' && f.id ? f.id : crypto.randomUUID(),
        nro: String(f?.nro ?? ''),
        tipo: String(f?.tipo ?? 'Otros'),
        monto: Number(f?.monto) || 0,
      })),
    );

    await db.run(
      `INSERT INTO rrhh_citaciones (
        id, empresa, org, fecha, hora, sede, trabajador, abogado, rubros,
        total, estado, motivo, acuerdo, macuerdo, facturas, obs, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        empresa,
        String(body?.org || 'MTSS'),
        fecha || null,
        body?.hora ? String(body.hora) : null,
        body?.sede ? String(body.sede) : null,
        body?.trabajador ? String(body.trabajador) : null,
        body?.abogado ? String(body.abogado) : null,
        body?.rubros ? String(body.rubros) : null,
        Number(body?.total) || 0,
        String(body?.estado || 'pendiente'),
        body?.motivo ? String(body.motivo) : null,
        body?.acuerdo ? String(body.acuerdo) : null,
        Number(body?.macuerdo) || 0,
        facturas,
        body?.obs ? String(body.obs) : null,
        now,
        now,
      ],
    );

    const rows = (await db.query(
      `SELECT id, empresa, org, fecha, hora, sede, trabajador, abogado, rubros,
              total, estado, motivo, acuerdo, macuerdo, facturas, obs,
              pdf_url, pdf_filename, created_at, updated_at
       FROM rrhh_citaciones WHERE id = ?`,
      [id],
    )) as CitacionRow[];
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No se pudo leer la citación creada' }, { status: 500 });
    }
    return NextResponse.json({ citacion: rowToCitacion(rows[0]) });
  } catch (err) {
    console.error('Error creando citación:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
