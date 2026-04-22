import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { logAudit } from '@/lib/agenda-helpers';
import { saveAgendaFile } from '@/lib/agenda-storage';
import { AGENDA_ADMIN_ROLES } from '@/lib/agenda-roles';

const AUTH_ROLES: readonly string[] = AGENDA_ADMIN_ROLES;

// POST /api/logistica/agenda/egress-returns/[id]/sign
// Acepta FormData o JSON con employee_signature / responsible_signature (File o dataUrl).
// Reemplaza una o ambas firmas (flexible).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  const egress = await db.get('SELECT id FROM agenda_egress_returns WHERE id = ?', [id]);
  if (!egress) return NextResponse.json({ error: 'Egreso no encontrado' }, { status: 404 });

  try {
    const contentType = request.headers.get('content-type') || '';
    let employeeRaw: File | string | null = null;
    let responsibleRaw: File | string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      employeeRaw = (form.get('employee_signature') as File | string) || null;
      responsibleRaw = (form.get('responsible_signature') as File | string) || null;
    } else {
      const body = await request.json().catch(() => ({}));
      employeeRaw = body.employee_signature || null;
      responsibleRaw = body.responsible_signature || null;
    }

    async function store(raw: File | string | null): Promise<string | null> {
      if (!raw) return null;
      if (raw instanceof File) {
        const buf = Buffer.from(await raw.arrayBuffer());
        const filename = raw.name || `firma-egreso-${Date.now()}.png`;
        return await saveAgendaFile(buf, filename, 'firmas');
      }
      if (typeof raw === 'string' && raw.startsWith('data:image/')) {
        const comma = raw.indexOf(',');
        if (comma < 0) return null;
        const buf = Buffer.from(raw.slice(comma + 1), 'base64');
        return await saveAgendaFile(buf, `firma-egreso-${Date.now()}.png`, 'firmas');
      }
      return null;
    }

    const empSigUrl = await store(employeeRaw);
    const respSigUrl = await store(responsibleRaw);

    if (!empSigUrl && !respSigUrl) {
      return NextResponse.json({ error: 'Envia al menos una firma' }, { status: 400 });
    }

    const isPg = (db as any).type === 'pg';
    const nowSql = isPg ? 'NOW()' : "datetime('now')";

    await db.run(
      `UPDATE agenda_egress_returns SET
         employee_signature_url = COALESCE(?, employee_signature_url),
         responsible_signature_url = COALESCE(?, responsible_signature_url),
         updated_at = ${nowSql}
       WHERE id = ?`,
      [empSigUrl, respSigUrl, id]
    );

    await logAudit('sign_egress_return', 'egress_return', id, session.user.id, {
      employee: !!empSigUrl, responsible: !!respSigUrl,
    });

    return NextResponse.json({ ok: true, employee_signature_url: empSigUrl, responsible_signature_url: respSigUrl });
  } catch (err) {
    console.error('Error firmando egreso:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
