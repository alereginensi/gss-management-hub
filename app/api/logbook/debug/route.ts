import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { NextRequest } from 'next/server';

function toISOSafe(ts: string | undefined | null): string | null {
    if (!ts) return null;
    // SQLite CURRENT_TIMESTAMP returns 'YYYY-MM-DD HH:MM:SS' without timezone — treat as UTC
    if (ts.includes('T')) return ts; // already ISO
    return ts.replace(' ', 'T') + 'Z';
}

export async function GET(request: NextRequest) {
    const session = await getSession(request);
    if (session?.user?.role !== 'admin') {
        return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    try {
        const total = await db.prepare('SELECT COUNT(*) as count FROM logbook').get() as { count: number };
        const first = await db.prepare('SELECT date, time FROM logbook ORDER BY date ASC, time ASC LIMIT 1').get() as { date: string; time: string } | undefined;
        const last = await db.prepare('SELECT date, time FROM logbook ORDER BY date DESC, time DESC LIMIT 1').get() as { date: string; time: string } | undefined;

        const currentTotal = total?.count ?? 0;
        const currentFirst = first ?? null;
        const currentLast = last ?? null;

        const lastSnap = await db.prepare(
            'SELECT * FROM logbook_stats_snapshots ORDER BY recorded_at DESC LIMIT 1'
        ).get() as { total: number; first_date: string; last_date: string; recorded_at: string } | undefined;

        const statsChanged =
            !lastSnap ||
            lastSnap.total !== currentTotal ||
            lastSnap.first_date !== (currentFirst?.date ?? null) ||
            lastSnap.last_date !== (currentLast?.date ?? null);

        const nowISO = new Date().toISOString();

        if (statsChanged) {
            await db.run(
                'INSERT INTO logbook_stats_snapshots (total, first_date, first_time, last_date, last_time, recorded_at) VALUES (?, ?, ?, ?, ?, ?)',
                [currentTotal, currentFirst?.date ?? null, currentFirst?.time ?? null, currentLast?.date ?? null, currentLast?.time ?? null, nowISO]
            );
        }

        const lastChanged = statsChanged
            ? nowISO
            : toISOSafe(lastSnap?.recorded_at);

        return NextResponse.json({
            total: currentTotal,
            first: currentFirst,
            last: currentLast,
            last_changed_at: lastChanged ?? null,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message }, { status: 500 });
    }
}
