import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { parseCatalogPreviewFromBuffer, importCatalogFromItems } from '@/lib/agenda-import';
import db from '@/lib/db';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'rrhh'];

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const preview = parseCatalogPreviewFromBuffer(buffer);
    if (preview.total === 0) {
      return NextResponse.json({ error: 'No se encontraron artículos en el archivo' }, { status: 400 });
    }

    const result = await importCatalogFromItems(preview.items, session.user.id, { replaceEmpresas: true });
    result.errors = [...preview.invalid, ...result.errors];
    result.failed = result.errors.length;

    // Registrar en agenda_import_jobs
    const isPg = (db as any).type === 'pg';
    if (isPg) {
      await db.query(
        `INSERT INTO agenda_import_jobs (type, file_name, processed_rows, successful_rows, failed_rows, error_log, processed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        ['catalog', file.name, result.processed, result.successful, result.failed, JSON.stringify(result.errors), session.user.id]
      );
    } else {
      await db.run(
        `INSERT INTO agenda_import_jobs (type, file_name, processed_rows, successful_rows, failed_rows, error_log, processed_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['catalog', file.name, result.processed, result.successful, result.failed, JSON.stringify(result.errors), session.user.id]
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error importando catálogo:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
