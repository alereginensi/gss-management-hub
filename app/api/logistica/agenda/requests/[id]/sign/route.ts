import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { logAudit } from '@/lib/agenda-helpers';
import { saveAgendaFile } from '@/lib/agenda-storage';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'supervisor'];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  const req = await db.get('SELECT id FROM agenda_requests WHERE id = ?', [id]);
  if (!req) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type === 'image/png' ? 'png' : 'jpg';
    const filename = `firma-req${id}-${Date.now()}.${ext}`;
    const fileUrl = await saveAgendaFile(buffer, filename, 'firmas');

    const isPg = (db as any).type === 'pg';
    const nowSql = isPg ? 'NOW()' : "datetime('now')";

    await db.run(
      `UPDATE agenda_requests SET approval_signature_url = ?, approved_by = ?, approved_at = ${nowSql}, status = 'aprobada' WHERE id = ?`,
      [fileUrl, session.user.id, id]
    );

    await logAudit('upload_signature', 'request', id, session.user.id, { fileUrl });
    return NextResponse.json({ fileUrl });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
