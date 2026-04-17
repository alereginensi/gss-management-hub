import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { NextRequest } from 'next/server';

// Temporary diagnostic endpoint — admin only
export async function GET(request: NextRequest) {
    const session = await getSession(request);
    if (session?.user?.role !== 'admin') {
        return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    try {
        const total = await db.prepare('SELECT COUNT(*) as count FROM logbook').get() as { count: number };
        const first = await db.prepare('SELECT date, time, created_at FROM logbook ORDER BY created_at ASC LIMIT 1').get() as { date: string; time: string; created_at: string } | undefined;
        const last = await db.prepare('SELECT date, time, created_at FROM logbook ORDER BY created_at DESC LIMIT 1').get() as { date: string; time: string; created_at: string } | undefined;

        return NextResponse.json({
            total: total?.count ?? 0,
            first: first ?? null,
            last: last ?? null,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message }, { status: 500 });
    }
}
