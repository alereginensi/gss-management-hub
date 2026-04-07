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
        const minDate = await db.prepare('SELECT MIN(date) as min_date FROM logbook').get() as { min_date: string };
        const maxDate = await db.prepare('SELECT MAX(date) as max_date FROM logbook').get() as { max_date: string };
        const byDate = await db.prepare('SELECT date, COUNT(*) as count FROM logbook GROUP BY date ORDER BY date ASC').all();

        return NextResponse.json({
            total: total?.count ?? 0,
            min_date: minDate?.min_date,
            max_date: maxDate?.max_date,
            by_date: byDate
        });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message }, { status: 500 });
    }
}
