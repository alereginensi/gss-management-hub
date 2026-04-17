import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { NextRequest } from 'next/server';

function toISOSafe(ts: string | undefined | null): string | null {
    if (!ts) return null;
    if (ts.includes('T')) return ts;
    return ts.replace(' ', 'T') + 'Z';
}

export async function GET(request: NextRequest) {
    const session = await getSession(request);
    if (session?.user?.role !== 'admin') {
        return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    try {
        // Ensure the snapshots table exists regardless of migration state
        const isPg = (db as any).type === 'pg';
        await db.exec(
            isPg
                ? `CREATE TABLE IF NOT EXISTS logbook_stats_snapshots (id SERIAL PRIMARY KEY, total INTEGER NOT NULL, first_date TEXT, first_time TEXT, last_date TEXT, last_time TEXT, recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`
                : `CREATE TABLE IF NOT EXISTS logbook_stats_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, total INTEGER NOT NULL, first_date TEXT, first_time TEXT, last_date TEXT, last_time TEXT, recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`
        );

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

        const history = await db.prepare(
            'SELECT total, first_date, first_time, last_date, last_time, recorded_at FROM logbook_stats_snapshots ORDER BY recorded_at DESC LIMIT 10'
        ).all() as { total: number; first_date: string; first_time: string; last_date: string; last_time: string; recorded_at: string }[];

        const lastChanged = statsChanged ? nowISO : toISOSafe(lastSnap?.recorded_at);

        return NextResponse.json({
            total: currentTotal,
            first: currentFirst,
            last: currentLast,
            last_changed_at: lastChanged ?? null,
            history: history.map(r => ({ ...r, recorded_at: toISOSafe(r.recorded_at) })),
        });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message }, { status: 500 });
    }
}
