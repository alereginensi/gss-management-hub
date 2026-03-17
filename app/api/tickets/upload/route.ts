import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { uploadToCloudinary } from '@/lib/cloudinary';

export async function POST(request: NextRequest) {
    const session = await getSession(request);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const filename = `${Date.now()}-${sanitizedName}`;
        const url = await uploadToCloudinary(buffer, 'tickets', filename);

        return NextResponse.json({ success: true, url });
    } catch (error: any) {
        console.error('Upload Error:', error);
        return NextResponse.json({ error: 'Upload failed', details: error.message }, { status: 500 });
    }
}
