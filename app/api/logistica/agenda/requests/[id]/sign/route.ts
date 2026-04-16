import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { logAudit } from '@/lib/agenda-helpers';
import { saveAgendaFile } from '@/lib/agenda-storage';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'rrhh', 'supervisor'];

// POST /api/logistica/agenda/requests/[id]/sign
// FormData:
//  - approver_signature (File|dataUrl) — opcional si la solicitud ya tiene firma
//    aprobante; obligatorio si está pendiente.
//  - receiver_signature (File|dataUrl) — opcional.
//  - Backward-compat: `file` equivale a approver_signature.
// Efectos:
//  - Upsert de las firmas que se provean.
//  - Si se guarda firma aprobante por primera vez, status pasa a 'aprobada' y
//    se setea approved_by / approved_at.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  const existing = await db.get(
    'SELECT id, approval_signature_url, receiver_signature_url, status FROM agenda_requests WHERE id = ?',
    [id]
  );
  if (!existing) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });

  try {
    const formData = await request.formData();
    const approverSigInput = (formData.get('approver_signature') || formData.get('file')) as File | string | null;
    const receiverSigInput = formData.get('receiver_signature') as File | string | null;

    if (!approverSigInput && !receiverSigInput) {
      return NextResponse.json({ error: 'No se envió ninguna firma' }, { status: 400 });
    }

    // Regla: si la solicitud NO tiene firma aprobante todavía, requerimos una.
    if (!existing.approval_signature_url && !approverSigInput) {
      return NextResponse.json({ error: 'Firma del autorizante requerida' }, { status: 400 });
    }

    let approverUrl: string | null = null;
    if (approverSigInput) {
      approverUrl = await storeSignature(approverSigInput, `firma-aprob-req${id}`);
      if (!approverUrl) {
        return NextResponse.json({ error: 'Firma del autorizante vacía o inválida' }, { status: 400 });
      }
    }

    let receiverUrl: string | null = null;
    if (receiverSigInput) {
      receiverUrl = await storeSignature(receiverSigInput, `firma-recep-req${id}`);
      if (!receiverUrl) {
        return NextResponse.json({ error: 'Firma del funcionario inválida' }, { status: 400 });
      }
    }

    const isPg = (db as any).type === 'pg';
    const nowSql = isPg ? 'NOW()' : "datetime('now')";

    // Construimos UPDATE dinámico según qué se envió.
    const updates: string[] = [];
    const values: any[] = [];

    if (approverUrl) {
      updates.push('approval_signature_url = ?');
      values.push(approverUrl);
      // Si la solicitud estaba pendiente, recién aprobamos ahora.
      if (!existing.approval_signature_url || existing.status === 'pendiente') {
        updates.push(`status = 'aprobada'`);
        updates.push('approved_by = ?');
        values.push(session.user.id);
        updates.push(`approved_at = ${nowSql}`);
      }
    }
    if (receiverUrl) {
      updates.push('receiver_signature_url = ?');
      values.push(receiverUrl);
    }

    values.push(id);
    await db.run(`UPDATE agenda_requests SET ${updates.join(', ')} WHERE id = ?`, values);

    await logAudit('upload_signature', 'request', id, session.user.id, {
      approver: approverUrl,
      receiver: receiverUrl,
    });

    return NextResponse.json({
      approverUrl: approverUrl ?? existing.approval_signature_url,
      receiverUrl: receiverUrl ?? existing.receiver_signature_url,
      fileUrl: approverUrl ?? existing.approval_signature_url,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

async function storeSignature(input: File | string, baseName: string): Promise<string | null> {
  if (typeof input === 'string') {
    const match = input.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
    if (!match) return null;
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buffer = Buffer.from(match[2], 'base64');
    const filename = `${baseName}-${Date.now()}.${ext}`;
    return saveAgendaFile(buffer, filename, 'firmas');
  }
  const buffer = Buffer.from(await input.arrayBuffer());
  const ext = input.type === 'image/png' ? 'png' : 'jpg';
  const filename = `${baseName}-${Date.now()}.${ext}`;
  return saveAgendaFile(buffer, filename, 'firmas');
}
