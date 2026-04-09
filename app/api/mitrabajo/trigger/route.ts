import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';

function hasMitrabajoAccess(user: { role: string; modules?: string }) {
    return user.role === 'admin' || user.role === 'mitrabajo' || user.modules?.split(',').includes('mitrabajo');
}

export async function POST(request: NextRequest) {
    const session = await getSession(request);
    if (!session || !hasMitrabajoAccess(session.user)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const targetDate: string | undefined = body.date;

    try {
        // Importar directamente — sin execFile ni rutas externas
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { downloadMitrabajo } = require('@/lib/mitrabajo-download');
        const destPath = await downloadMitrabajo(targetDate ?? null);
        return NextResponse.json({ ok: true, file: destPath });
    } catch (error: any) {
        console.error('[mitrabajo trigger]', error.message);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
