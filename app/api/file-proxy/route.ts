import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const EXT_TO_MIME: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export async function GET(request: NextRequest) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = request.nextUrl.searchParams.get('url');
    if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 });

    try {
        // Extract resource_type and public_id from Cloudinary URL
        // Handles: /raw/upload/v123/folder/file.pdf
        // and signed: /raw/upload/s--sig--/v123/folder/file.pdf
        const match = url.match(/\/(raw|image|video)\/upload\/(?:s--[^/]+--\/)?(?:v\d+\/)?(.+?)(?:\?.*)?$/);
        if (!match) return NextResponse.redirect(url);

        const resourceType = match[1] as 'raw' | 'image' | 'video';
        const publicId = match[2]; // e.g. logistica/calendario/cal-123.pdf
        const filename = publicId.split('/').pop() || 'file';
        const ext = filename.split('.').pop()?.toLowerCase() ?? '';
        const contentType = EXT_TO_MIME[ext] ?? 'application/octet-stream';

        // Generate authenticated API download URL (bypasses CDN restrictions)
        const downloadUrl = cloudinary.utils.private_download_url(
            publicId,
            '',
            {
                resource_type: resourceType,
                type: 'upload',
                expires_at: Math.floor(Date.now() / 1000) + 300,
            }
        );

        // Fetch the file server-side and stream it back with correct headers
        const upstream = await fetch(downloadUrl);
        if (!upstream.ok) throw new Error(`Cloudinary returned ${upstream.status}`);

        const buffer = await upstream.arrayBuffer();

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `inline; filename="${filename}"`,
                'Cache-Control': 'private, max-age=300',
            },
        });
    } catch (err) {
        console.error('file-proxy error:', err);
        return NextResponse.json({ error: 'Error al obtener el archivo' }, { status: 500 });
    }
}
