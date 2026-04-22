import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import db from '@/lib/db';

function hasMitrabajoAccess(user: { role: string; modules?: string }) {
  return user.role === 'admin' || user.role === 'mitrabajo' || user.modules?.split(',').includes('mitrabajo');
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !hasMitrabajoAccess(session.user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const row = await db.get(
      'SELECT email_recipients, email_enabled FROM mitrabajo_config WHERE id = 1'
    );
    return NextResponse.json({
      email_recipients: row?.email_recipients ?? '',
      email_enabled: row ? !!row.email_enabled : true,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !hasMitrabajoAccess(session.user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const raw = typeof body.email_recipients === 'string' ? body.email_recipients : '';
    const recipients = raw
      .split(/[,;]/)
      .map((s: string) => s.trim())
      .filter(Boolean);
    const invalid = recipients.filter((e: string) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (invalid.length) {
      return NextResponse.json({ error: `Emails invalidos: ${invalid.join(', ')}` }, { status: 400 });
    }
    const enabled = body.email_enabled ? 1 : 0;
    const isPg = (db as any).type === 'pg';
    const nowSql = isPg ? 'NOW()' : "datetime('now')";
    await db.run(
      `INSERT INTO mitrabajo_config (id, email_recipients, email_enabled, updated_at)
       VALUES (1, ?, ?, ${nowSql})
       ON CONFLICT (id) DO UPDATE SET
         email_recipients = EXCLUDED.email_recipients,
         email_enabled = EXCLUDED.email_enabled,
         updated_at = ${nowSql}`,
      [recipients.join(', '), enabled]
    );
    return NextResponse.json({ ok: true, email_recipients: recipients.join(', '), email_enabled: !!enabled });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
