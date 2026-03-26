import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';

const MIME_TO_EXT: Record<string, string> = {
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'application/pdf': '.pdf',
    'text/plain': '.txt',
    'text/csv': '.csv',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
};

export async function GET(request: NextRequest) {
    const session = await getSession(request);
    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const url = request.nextUrl.searchParams.get('url');
    const filename = request.nextUrl.searchParams.get('filename') || 'download';

    if (!url || !url.startsWith('https://res.cloudinary.com/')) {
        return new NextResponse('Invalid URL', { status: 400 });
    }

    try {
        const cloudRes = await fetch(url);
        if (!cloudRes.ok) {
            return new NextResponse('Failed to fetch file', { status: 502 });
        }

        const rawContentType = cloudRes.headers.get('content-type') || 'application/octet-stream';
        const contentType = rawContentType.split(';')[0].trim();
        const ext = MIME_TO_EXT[contentType] ?? '';
        const downloadName = ext && !filename.toLowerCase().endsWith(ext)
            ? filename + ext
            : filename;

        const buffer = await cloudRes.arrayBuffer();

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
            },
        });
    } catch (error: any) {
        return new NextResponse('Download failed', { status: 500 });
    }
}
