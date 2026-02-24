import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { getSession } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
    const session = await getSession(request);
    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const filename = searchParams.get('filename');

        if (!filename) {
            return new NextResponse('Filename missing', { status: 400 });
        }

        // Prevent path traversal
        const safeFilename = path.basename(filename);
        const IS_PROD = process.env.NODE_ENV === 'production';
        const uploadDir = IS_PROD ? '/app/data/uploads' : path.join(process.cwd(), 'data', 'uploads');
        const filePath = path.join(uploadDir, safeFilename);

        const fileBuffer = await readFile(filePath);

        // Determine content type (basic check)
        let contentType = 'application/octet-stream';
        const ext = path.extname(safeFilename).toLowerCase();
        if (ext === '.png') contentType = 'image/png';
        else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
        else if (ext === '.pdf') contentType = 'application/pdf';
        else if (ext === '.xlsx') contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        else if (ext === '.csv') contentType = 'text/csv';

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${safeFilename}"`,
            },
        });
    } catch (error) {
        console.error('Download Error:', error);
        return new NextResponse('Archivo no encontrado o error al leerlo', { status: 404 });
    }
}
