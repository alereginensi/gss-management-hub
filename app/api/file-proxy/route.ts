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
        const match = url.match(/\/(raw|image|video)\/upload\/(?:v\d+\/)?(.+)$/);
        if (!match) {
            // Not a Cloudinary URL — redirect directly
            return NextResponse.redirect(url);
        }

        const resourceType = match[1] as 'raw' | 'image' | 'video';
        const publicId = match[2]; // e.g. logistica/calendario/cal-123.pdf

        const signedUrl = cloudinary.url(publicId, {
            resource_type: resourceType,
            sign_url: true,
            secure: true,
            type: 'upload',
        });

        return NextResponse.redirect(signedUrl);
    } catch {
        // Fallback: redirect to original URL
        return NextResponse.redirect(url);
    }
}
