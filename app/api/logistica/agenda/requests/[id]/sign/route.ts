import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { logAudit } from '@/lib/agenda-helpers';
import { saveAgendaFile } from '@/lib/agenda-storage';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'rrhh', 'supervisor'];

// Acepta:
//  - FormData con `approver_signature` (File|dataUrl, OBLIGATORIO) y
//    `receiver_signature` (File|dataUrl, opcional).
//  - Backward-compat: `file` (FormData) → equivalente a approver_signature.
// Al aprobar con firma, pasa status → 'aprobada'.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  const req = await db.get('SELECT id FROM agenda_requests WHERE id = ?', [id]);
  if (!req) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });

  try {
    const formData = await request.formData();

    const approverSig = (formData.get('approver_signature') || formData.get('file')) as File | string | null;
    const receiverSig = formData.get('receiver_signature') as File | string | null;

    if (!approverSig) {
      return NextResponse.json({ error: 'Firma del autorizante requerida' }, { status: 400 });
    }

    const approverUrl = await storeSignature(approverSig, `firma-aprob-req${id}`);
    if (!approverUrl) {
      return NextResponse.json({ error: 'Firma del autorizante vacía o inválida' }, { status: 400 });
    }
    const receiverUrl = receiverSig ? await storeSignature(receiverSig, `firma-recep-req${id}`) : null;

    const isPg = (db as any).type === 'pg';
    const nowSql = isPg ? 'NOW()' : "datetime('now')";

    if (receiverUrl) {
      await db.run(
        `UPDATE agenda_requests
           SET approval_signature_url = ?,
               receiver_signature_url = ?,
               approved_by = ?,
               approved_at = ${nowSql},
               status = 'aprobada'
         WHERE id = ?`,
        [approverUrl, receiverUrl, session.user.id, id]
      );
    } else {
      await db.run(
        `UPDATE agenda_requests
           SET approval_signature_url = ?,
               approved_by = ?,
               approved_at = ${nowSql},
               status = 'aprobada'
         WHERE id = ?`,
        [approverUrl, session.user.id, id]
      );
    }

    await logAudit('upload_signature', 'request', id, session.user.id, {
      approver: approverUrl,
      receiver: receiverUrl,
    });
    return NextResponse.json({ approverUrl, receiverUrl, fileUrl: approverUrl });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

async function storeSignature(input: File | string, baseName: string): Promise<string | null> {
  if (typeof input === 'string') {
    // Se asume data URL tipo `data:image/png;base64,...`
    const match = input.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
    if (!match) return null;
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buffer = Buffer.from(match[2], 'base64');
    const filename = `${baseName}-${Date.now()}.${ext}`;
    return saveAgendaFile(buffer, filename, 'firmas');
  }
  // File
  const buffer = Buffer.from(await input.arrayBuffer());
  const ext = input.type === 'image/png' ? 'png' : 'jpg';
  const filename = `${baseName}-${Date.now()}.${ext}`;
  return saveAgendaFile(buffer, filename, 'firmas');
}
