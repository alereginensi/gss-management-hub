import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import db from '@/lib/db';
import path from 'path';

function hasMitrabajoAccess(user: { role: string; modules?: string }) {
    return user.role === 'admin' || user.role === 'mitrabajo' || user.modules?.split(',').includes('mitrabajo');
}

export async function GET(request: NextRequest) {
    const session = await getSession(request);
    if (!session || !hasMitrabajoAccess(session.user)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const filename = request.nextUrl.searchParams.get('file');
    if (!filename) {
        return NextResponse.json({ error: 'Falta parámetro file' }, { status: 400 });
    }

    const safeName = path.basename(filename);
    if (!safeName.startsWith('mitrabajo_') || (!safeName.endsWith('.xlsx') && !safeName.endsWith('.xls'))) {
        return NextResponse.json({ error: 'Archivo no permitido' }, { status: 403 });
    }

    try {
        const row = await db.get('SELECT data FROM mitrabajo_files WHERE filename = ?', [safeName]);
        if (!row) {
            return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
        }

        const buffer = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${safeName}"`,
            },
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
