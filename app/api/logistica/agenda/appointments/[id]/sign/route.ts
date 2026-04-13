import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { logAudit } from '@/lib/agenda-helpers';
import { saveAgendaFile } from '@/lib/agenda-storage';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'supervisor'];

// POST /api/logistica/agenda/appointments/[id]/sign
// FormData: file (image/png|jpeg), type ('employee'|'responsible')
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  const appt = await db.get('SELECT id FROM agenda_appointments WHERE id = ?', [id]);
  if (!appt) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = (formData.get('type') as string) || 'employee';

    if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    if (!['employee', 'responsible'].includes(type)) {
      return NextResponse.json({ error: 'type debe ser employee o responsible' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type === 'image/png' ? 'png' : 'jpg';
    const filename = `firma-${type}-appt${id}-${Date.now()}.${ext}`;
    const fileUrl = await saveAgendaFile(buffer, filename, 'firmas');

    const column = type === 'employee' ? 'employee_signature_url' : 'responsible_signature_url';
    const isPg = (db as any).type === 'pg';
    const nowSql = isPg ? 'NOW()' : "datetime('now')";

    await db.run(
      `UPDATE agenda_appointments SET ${column} = ?, updated_at = ${nowSql} WHERE id = ?`,
      [fileUrl, id]
    );

    await logAudit('upload_signature', 'appointment', id, session.user.id, { type, fileUrl });
    return NextResponse.json({ fileUrl });
  } catch (err) {
    console.error('Error subiendo firma:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
