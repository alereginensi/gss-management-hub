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

    const filename = request.nextUrl.searchParams.get('file');
    if (!filename) {
        return NextResponse.json({ error: 'Falta parámetro file' }, { status: 400 });
    }

    // Seguridad: solo archivos dentro del directorio permitido, sin path traversal
    const safeName = path.basename(filename);
    if (!safeName.startsWith('mitrabajo_') || (!safeName.endsWith('.xlsx') && !safeName.endsWith('.xls'))) {
        return NextResponse.json({ error: 'Archivo no permitido' }, { status: 403 });
    }

    const filePath = path.join(DOWNLOAD_DIR, safeName);
    if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    return new NextResponse(fileBuffer, {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${safeName}"`,
        },
    });
}
