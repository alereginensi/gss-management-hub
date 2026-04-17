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
        const first = await db.prepare('SELECT date, time FROM logbook ORDER BY date ASC, time ASC LIMIT 1').get() as { date: string; time: string } | undefined;
        const last = await db.prepare('SELECT date, time FROM logbook ORDER BY date DESC, time DESC LIMIT 1').get() as { date: string; time: string } | undefined;

        return NextResponse.json({
            total: total?.count ?? 0,
            first: first ?? null,
            last: last ?? null,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message }, { status: 500 });
    }
}
