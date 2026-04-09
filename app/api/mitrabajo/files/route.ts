import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import fs from 'fs';
import path from 'path';

const DOWNLOAD_DIR = process.env.MITRABAJO_DOWNLOAD_DIR
    ? path.resolve(process.env.MITRABAJO_DOWNLOAD_DIR)
    : path.join(process.cwd(), 'downloads', 'mitrabajo');

function hasMitrabajoAccess(user: { role: string; modules?: string }) {
    return user.role === 'admin' || user.role === 'mitrabajo' || user.modules?.split(',').includes('mitrabajo');
}

export async function GET(request: NextRequest) {
    const session = await getSession(request);
    if (!session || !hasMitrabajoAccess(session.user)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        if (!fs.existsSync(DOWNLOAD_DIR)) {
            return NextResponse.json({ files: [] });
        }

        const files = fs.readdirSync(DOWNLOAD_DIR)
            .filter(f => f.startsWith('mitrabajo_') && (f.endsWith('.xlsx') || f.endsWith('.xls')))
            .map(f => {
                const stat = fs.statSync(path.join(DOWNLOAD_DIR, f));
                // Extraer fecha del nombre: mitrabajo_YYYY-MM-DD.xlsx
                const match = f.match(/mitrabajo_(\d{4}-\d{2}-\d{2})/);
                return {
                    filename: f,
                    date: match ? match[1] : null,
                    size: stat.size,
                    createdAt: stat.birthtime.toISOString(),
                };
            })
            .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

        return NextResponse.json({ files });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
