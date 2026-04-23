import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { parseImportBuffer, importEmployees, importArticlesMigration } from '@/lib/agenda-import';
import { logAudit } from '@/lib/agenda-helpers';
import type { ImportJobType } from '@/lib/agenda-types';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'rrhh'];

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = (formData.get('type') as ImportJobType) || 'employees';
    const sendToIngresosRaw = formData.get('send_to_ingresos');
    const sendToIngresos = sendToIngresosRaw === 'true' || sendToIngresosRaw === '1' || sendToIngresosRaw === 'on';

    if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    if (!['employees', 'articles_migration'].includes(type)) {
      return NextResponse.json({ error: 'Tipo inválido. Usar: employees | articles_migration' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows } = parseImportBuffer(buffer);

    if (rows.length === 0) return NextResponse.json({ error: 'El archivo está vacío o sin filas de datos' }, { status: 400 });

    const result = type === 'employees'
      ? await importEmployees(rows, session.user.id, { sendToIngresos })
      : await importArticlesMigration(rows, session.user.id);

    // Registrar job
    const isPg = (db as any).type === 'pg';
    let jobId: number;
    if (isPg) {
      const res = await db.query(
        `INSERT INTO agenda_import_jobs (type, file_name, processed_rows, successful_rows, failed_rows, error_log, processed_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [type, file.name, result.processed, result.successful, result.failed, JSON.stringify(result.errors), session.user.id]
      );
      jobId = res[0]?.id;
    } else {
      const r = await db.run(
        `INSERT INTO agenda_import_jobs (type, file_name, processed_rows, successful_rows, failed_rows, error_log, processed_by) VALUES (?,?,?,?,?,?,?)`,
        [type, file.name, result.processed, result.successful, result.failed, JSON.stringify(result.errors), session.user.id]
      );
      jobId = r.lastInsertRowid as number;
    }

    await logAudit('import', 'import', jobId, session.user.id, { type, file: file.name, ...result });
    return NextResponse.json({ jobId, ...result });
  } catch (err) {
    console.error('Error en importación:', err);
    return NextResponse.json({ error: 'Error interno durante la importación' }, { status: 500 });
  }
}
