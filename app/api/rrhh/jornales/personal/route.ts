import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { isJornalesRole } from '@/lib/jornales-helpers';

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !isJornalesRole(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await db.query(
      `SELECT padron, nombre, doc, efectividad_autorizada, created_at
       FROM jornales_personal
       ORDER BY nombre ASC`,
    );
    return NextResponse.json({ personal: rows });
  } catch (err) {
    console.error('Error listando personal jornales:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

type AltaInput = { id?: string; padron?: string; nombre: string; doc?: string };

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !isJornalesRole(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const personasRaw: AltaInput[] = Array.isArray(body?.personas)
      ? body.personas
      : Array.isArray(body)
        ? body
        : [body];

    const isPg = (db as any).type === 'pg';
    let agregados = 0;

    for (const p of personasRaw) {
      const padron = String(p?.padron || p?.id || '').trim();
      const nombre = String(p?.nombre || '').trim();
      const doc = p?.doc ? String(p.doc).trim() : null;
      if (!padron || !nombre) continue;

      try {
        if (isPg) {
          const res = await db.query(
            `INSERT INTO jornales_personal (padron, nombre, doc)
             VALUES ($1, $2, $3)
             ON CONFLICT (padron) DO NOTHING
             RETURNING id`,
            [padron, nombre, doc],
          );
          if (res.length > 0) agregados++;
        } else {
          const res = await db.run(
            `INSERT OR IGNORE INTO jornales_personal (padron, nombre, doc) VALUES (?, ?, ?)`,
            [padron, nombre, doc],
          );
          if (res.changes > 0) agregados++;
        }
      } catch (e) {
        console.warn('Alta duplicada o inválida ignorada:', padron, e);
      }
    }

    return NextResponse.json({ agregados });
  } catch (err) {
    console.error('Error creando personal jornales:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
