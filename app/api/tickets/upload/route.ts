import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getSession } from '@/lib/auth-server';

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

        // Define upload directory - sync with db.ts logic
        const IS_PROD = process.env.NODE_ENV === 'production';
        const uploadDir = IS_PROD ? '/app/data/uploads' : path.join(process.cwd(), 'data', 'uploads');

        // Ensure directory exists
        try {
            await mkdir(uploadDir, { recursive: true });
        } catch (e) {
            // Directory might already exist
        }

        // Generate unique filename
        const filename = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
        const filePath = path.join(uploadDir, filename);

        await writeFile(filePath, buffer);
        console.log(`📁 File uploaded to persistent storage: ${filePath}`);

        // Return the download API URL instead of direct public URL
        const fileUrl = `/api/tickets/download?filename=${filename}`;
        return NextResponse.json({ success: true, url: fileUrl });
    } catch (error: any) {
        console.error('Upload Error:', error);
        return NextResponse.json({ error: 'Upload failed', details: error.message }, { status: 500 });
    }
}
