import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

import { mkdir } from 'fs/promises';

const IS_PROD = process.env.NODE_ENV === 'production';
const UPLOAD_DIR = IS_PROD ? '/app/data/uploads/logbook' : path.join(process.cwd(), 'data', 'uploads', 'logbook');

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
        if (!allowedTypes.includes(file.type) && !file.type.startsWith('image/')) {
            return NextResponse.json({ error: 'Tipo de archivo no permitido. Solo se aceptan imágenes.' }, { status: 400 });
        }

        // Max 10MB
        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: 'La imagen no puede superar los 10MB.' }, { status: 400 });
        }

        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const filePath = path.join(UPLOAD_DIR, filename);

        // Ensure directory exists
        try {
            await mkdir(UPLOAD_DIR, { recursive: true });
        } catch (e) {
            // Directory might already exist
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(filePath, buffer);

        const url = `/api/logbook/images/download?filename=${filename}`;
        return NextResponse.json({ url });
    } catch (error: any) {
        console.error('Image upload error:', error);
        return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const url = searchParams.get('url');

        if (!url) {
            return NextResponse.json({ error: 'URL requerida' }, { status: 400 });
        }

        // Extract filename from URL (it could be /api/logbook/images/download?filename=abc.jpg or a direct path)
        let filenameStr = '';
        try {
            // Attempt to parse it as a URL if it includes the host, or manually parse query
            if (url.includes('filename=')) {
                filenameStr = url.split('filename=')[1].split('&')[0];
            } else {
                filenameStr = path.basename(url);
            }
        } catch (e) {
            filenameStr = path.basename(url);
        }

        const safeFilename = decodeURIComponent(filenameStr);
        if (!safeFilename) {
            return NextResponse.json({ error: 'Nombre de archivo inválido' }, { status: 400 });
        }

        const filePath = path.join(UPLOAD_DIR, safeFilename);

        // Security check
        if (!filePath.startsWith(UPLOAD_DIR)) {
            return NextResponse.json({ error: 'Ruta no permitida' }, { status: 403 });
        }

        if (existsSync(filePath)) {
            await unlink(filePath);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Image delete error:', error);
        return NextResponse.json({ error: 'Error al eliminar la imagen' }, { status: 500 });
    }
}
