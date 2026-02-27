import { NextResponse } from 'next/server';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    const secret = process.env.JWT_SECRET || 'fallback-secret-at-least-32-chars-long';
    const hash = createHash('sha256').update(secret).digest('hex');

    return NextResponse.json({
        runtime: 'nodejs',
        secret_hash: hash,
        secret_length: secret.length,
        env_defined: !!process.env.JWT_SECRET,
        NODE_ENV: process.env.NODE_ENV
    });
}
