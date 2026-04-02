import { NextRequest, NextResponse } from 'next/server';
import { uploadToCloudinary } from '@/lib/cloudinary';

// Public endpoint — no auth required (worker page has no session)
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = `limpieza_${Date.now()}`;
        const url = await uploadToCloudinary(buffer, 'limpieza/tareas', filename);

        return NextResponse.json({ url });
    } catch (error: any) {
        console.error('Error uploading to Cloudinary:', error);
        return NextResponse.json({ error: 'Error al subir imagen' }, { status: 500 });
    }
}
