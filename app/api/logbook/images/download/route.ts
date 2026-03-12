import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { getSession } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const filename = searchParams.get('filename');

        if (!filename) {
            return new NextResponse('Filename missing', { status: 400 });
        }

        // Prevent path traversal
        const safeFilename = path.basename(filename);
        const IS_PROD = process.env.NODE_ENV === 'production';
        const uploadDir = IS_PROD ? '/app/data/uploads/logbook' : path.join(process.cwd(), 'data', 'uploads', 'logbook');
        const filePath = path.join(uploadDir, safeFilename);

        const fileBuffer = await readFile(filePath);

        // Determine content type (basic check)
        let contentType = 'application/octet-stream';
        const ext = path.extname(safeFilename).toLowerCase();
        if (ext === '.png') contentType = 'image/png';
        else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
        else if (ext === '.gif') contentType = 'image/gif';
        else if (ext === '.webp') contentType = 'image/webp';
        else if (ext === '.svg') contentType = 'image/svg+xml';

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                // Do not use attachment to allow inline preview in <img> tags
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error) {
        console.error('Image Download Error:', error);
        return new NextResponse('Archivo no encontrado', { status: 404 });
    }
}
