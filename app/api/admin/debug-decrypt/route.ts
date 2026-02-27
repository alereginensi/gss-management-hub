import { NextResponse, NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    const { verifyJWT } = await import('@/lib/auth-edge');
    const secret = process.env.JWT_SECRET || 'fallback-secret-at-least-32-chars-long';
    const { searchParams } = new URL(_req.url);
    const token = searchParams.get('token');

    if (!token) {
        return NextResponse.json({ error: 'Missing token param' }, { status: 400 });
    }

    try {
        const result = await verifyJWT(token, secret);
        if (!result) {
            return NextResponse.json({ valid: false, error: 'verifyJWT returned null' });
        }
        return NextResponse.json({ valid: true, payload: result.payload });
    } catch (e: any) {
        return NextResponse.json({ valid: false, error: e.message });
    }
}
