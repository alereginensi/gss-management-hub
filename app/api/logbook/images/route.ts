import { NextRequest, NextResponse } from 'next/server';
import { uploadToCloudinary, deleteFromCloudinary } from '@/lib/cloudinary';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
        if (!allowedTypes.includes(file.type) && !file.type.startsWith('image/')) {
            return NextResponse.json({ error: 'Tipo de archivo no permitido. Solo se aceptan imágenes.' }, { status: 400 });
        }

        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: 'La imagen no puede superar los 10MB.' }, { status: 400 });
        }

        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const buffer = Buffer.from(await file.arrayBuffer());
        const url = await uploadToCloudinary(buffer, 'logbook', filename);

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

        await deleteFromCloudinary(url);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Image delete error:', error);
        return NextResponse.json({ error: 'Error al eliminar la imagen' }, { status: 500 });
    }
}
