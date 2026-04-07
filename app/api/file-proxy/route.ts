import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function GET(request: NextRequest) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = request.nextUrl.searchParams.get('url');
    if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 });

    try {
        // Extract resource_type and public_id from Cloudinary URL
        // e.g. https://res.cloudinary.com/cloud/raw/upload/v123/folder/file.pdf
        // Also handle signed URLs: /raw/upload/s--sig--/v123/...
        const match = url.match(/\/(raw|image|video)\/upload\/(?:s--[^/]+--\/)?(?:v\d+\/)?(.+?)(?:\?.*)?$/);
        if (!match) {
            return NextResponse.redirect(url);
        }

        const resourceType = match[1] as 'raw' | 'image' | 'video';
        const publicId = match[2]; // e.g. logistica/calendario/cal-123.pdf

        // Use Cloudinary's private_download_url which goes through the API endpoint
        // (api.cloudinary.com) and authenticates with API key — bypasses CDN access restrictions
        const downloadUrl = cloudinary.utils.private_download_url(
            publicId,
            '', // format — empty string keeps the extension in the public_id
            {
                resource_type: resourceType,
                type: 'upload',
                expires_at: Math.floor(Date.now() / 1000) + 300, // 5 minutes
                attachment: false,
            }
        );

        return NextResponse.redirect(downloadUrl);
    } catch (err) {
        console.error('file-proxy error:', err);
        return NextResponse.redirect(url);
    }
}
