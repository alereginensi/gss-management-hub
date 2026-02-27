import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    const secret = process.env.JWT_SECRET || 'fallback-secret-at-least-32-chars-long';

    const encoder = new TextEncoder();
    const data = encoder.encode(secret);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return NextResponse.json({
        runtime: 'edge',
        secret_hash: hashHex,
        secret_length: secret.length,
        env_defined: !!process.env.JWT_SECRET,
        NODE_ENV: process.env.NODE_ENV
    });
}
