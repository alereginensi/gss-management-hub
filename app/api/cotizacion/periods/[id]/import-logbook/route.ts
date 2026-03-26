import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession(request);
    if (!session || !['admin', 'contador'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await params;
        const { date_from, date_to, service_type, default_hours = 8, category_id } = await request.json();
        if (!date_from || !date_to) return NextResponse.json({ error: 'date_from and date_to are required' }, { status: 400 });

        const period = await db.get('SELECT * FROM billing_periods WHERE id = ?', [id]) as any;
        if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 });
        if (period.status === 'closed') return NextResponse.json({ error: 'Period is closed' }, { status: 400 });

        // Fetch logbook entries in date range
        let sql = `SELECT id, date, staff_member, location, sector, supervised_by FROM logbook
                   WHERE date >= ? AND date <= ? AND staff_member IS NOT NULL AND staff_member != ''`;
        const logParams: any[] = [date_from, date_to];
        if (service_type) { sql += ' AND supervised_by = ?'; logParams.push(service_type); }

        const logEntries = await db.prepare(sql).all(...logParams) as any[];

        // Get already imported logbook entry IDs for this period
        const alreadyImported = await db.prepare(
            'SELECT logbook_entry_id FROM billing_entries WHERE period_id = ? AND logbook_entry_id IS NOT NULL'
        ).all(id) as any[];
        const importedIds = new Set(alreadyImported.map((r: any) => r.logbook_entry_id));

        let imported = 0;
        let skipped = 0;

        for (const entry of logEntries) {
            if (importedIds.has(entry.id)) { skipped++; continue; }

            await db.run(
                `INSERT INTO billing_entries (period_id, funcionario, category_id, date, regular_hours, overtime_hours, location, sector, service_type, logbook_entry_id, source, created_by)
                 VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'logbook', ?)`,
                [id, entry.staff_member, category_id ?? null, entry.date, default_hours, entry.location ?? null, entry.sector ?? null, entry.supervised_by ?? null, entry.id, session.user.name]
            );
            imported++;
        }

        return NextResponse.json({ imported, skipped, total: logEntries.length });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
