import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { logAudit } from '@/lib/agenda-helpers';

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

// Las firmas se guardan como data URL (base64 inline) en la columna TEXT.
// Esto evita depender del filesystem efímero de Railway o de config externa
// como Cloudinary; una firma canvas pesa ~5-25 KB, perfectamente manejable.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function storeSignature(input: File | string, _baseName: string): Promise<string | null> {
  if (typeof input === 'string') {
    if (input.startsWith('data:image/')) return input;
    return null;
  }
  const buffer = Buffer.from(await input.arrayBuffer());
  const mime = input.type === 'image/png' ? 'image/png'
    : input.type === 'image/jpeg' || input.type === 'image/jpg' ? 'image/jpeg'
    : 'image/png';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}
