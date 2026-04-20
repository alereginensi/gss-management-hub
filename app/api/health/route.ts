import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    const start = Date.now();
    try {
        await db.query('SELECT 1');
        return NextResponse.json({
            status: 'ok',
            db: 'ok',
            latency_ms: Date.now() - start,
            ts: new Date().toISOString(),
        });
    } catch (err) {
        console.error('[health] DB check failed:', err);
        return NextResponse.json(
            { status: 'error', db: 'unreachable', ts: new Date().toISOString() },
            { status: 503 }
        );
    }
}
