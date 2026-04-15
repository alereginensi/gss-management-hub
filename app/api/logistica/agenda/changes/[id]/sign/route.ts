import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { logAudit } from '@/lib/agenda-helpers';
import { saveAgendaFile } from '@/lib/agenda-storage';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'supervisor'];

// POST /api/logistica/agenda/changes/[id]/sign
// FormData: file (image/png|jpeg), type ('employee'|'responsible'), disclaimer_accepted? ('1')
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  const change = await db.get('SELECT id FROM agenda_change_events WHERE id = ?', [id]);
  if (!change) return NextResponse.json({ error: 'Cambio no encontrado' }, { status: 404 });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = (formData.get('type') as string) || 'employee';
    const disclaimerAccepted = formData.get('disclaimer_accepted') === '1';

    if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    if (!['employee', 'responsible'].includes(type)) {
      return NextResponse.json({ error: 'type debe ser employee o responsible' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type === 'image/png' ? 'png' : 'jpg';
    const filename = `firma-${type}-cambio${id}-${Date.now()}.${ext}`;
    const fileUrl = await saveAgendaFile(buffer, filename, 'firmas');

    const column = type === 'employee' ? 'employee_signature_url' : 'responsible_signature_url';
    const isPg = (db as any).type === 'pg';
    const nowSql = isPg ? 'NOW()' : "datetime('now')";

    if (disclaimerAccepted) {
      await db.run(
        `UPDATE agenda_change_events SET ${column} = ?, disclaimer_accepted = 1 WHERE id = ?`,
        [fileUrl, id]
      );
    } else {
      await db.run(
        `UPDATE agenda_change_events SET ${column} = ? WHERE id = ?`,
        [fileUrl, id]
      );
    }

    await logAudit('upload_signature', 'change_event', id, session.user.id, { type, fileUrl });
    return NextResponse.json({ fileUrl });
  } catch (err) {
    console.error('Error subiendo firma de cambio:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
