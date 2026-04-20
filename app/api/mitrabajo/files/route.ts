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
        const rows = await db.query(
            'SELECT filename, file_date, size, created_at FROM mitrabajo_files ORDER BY file_date DESC',
            []
        );
        const files = rows.map((r: any) => ({
            filename: r.filename,
            date: r.file_date,
            size: r.size,
            createdAt: r.created_at,
        }));
        return NextResponse.json({ files });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
