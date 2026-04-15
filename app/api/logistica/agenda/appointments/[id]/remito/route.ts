import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { logAudit } from '@/lib/agenda-helpers';
import { saveAgendaFile } from '@/lib/agenda-storage';
import { parseRemitoText } from '@/lib/agenda-remito-parser';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'supervisor'];

// POST /api/logistica/agenda/appointments/[id]/remito
// FormData: file (PDF o imagen), remito_number (opcional), raw_text (opcional; si no → se extrae del filename)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  const appt = await db.get('SELECT * FROM agenda_appointments WHERE id = ?', [id]);
  if (!appt) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const remitoNumber = (formData.get('remito_number') as string) || '';
    const rawText = (formData.get('raw_text') as string) || '';

    if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop() || 'pdf';
    const filename = `remito-appt${id}-${Date.now()}.${ext}`;
    const fileUrl = await saveAgendaFile(buffer, filename, 'remitos');

    // Parse automático si hay texto
    let parsedData = null;
    if (rawText.trim()) {
      parsedData = parseRemitoText(rawText);
    }

    const isPg = (db as any).type === 'pg';
    const nowSql = isPg ? 'NOW()' : "datetime('now')";

    await db.run(
      `UPDATE agenda_appointments SET
        remito_pdf_url = ?,
        remito_number = COALESCE(?, remito_number),
        parsed_remito_text = COALESCE(?, parsed_remito_text),
        parsed_remito_data = COALESCE(?, parsed_remito_data),
        updated_at = ${nowSql}
       WHERE id = ?`,
      [
        fileUrl,
        remitoNumber || null,
        rawText || null,
        parsedData ? JSON.stringify(parsedData) : null,
        id,
      ]
    );

    await logAudit('upload_remito', 'appointment', id, session.user.id, {
      fileUrl,
      remitoNumber,
      parsed: !!parsedData,
    });

    return NextResponse.json({ fileUrl, parsed: parsedData });
  } catch (err) {
    console.error('Error subiendo remito:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
