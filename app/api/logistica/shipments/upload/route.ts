import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { uploadToCloudinary } from '@/lib/cloudinary';

export async function POST(request: NextRequest) {
    const session = await getSession(request);
    if (!session || !['admin', 'logistica'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

        if (!file.type.startsWith('image/')) {
            return NextResponse.json({ error: 'Solo se aceptan imágenes.' }, { status: 400 });
        }
        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: 'La imagen no puede superar los 10MB.' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const url = await uploadToCloudinary(buffer, 'logistica', filename);

        return NextResponse.json({ url });
    } catch (error: any) {
        return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 });
    }
}
