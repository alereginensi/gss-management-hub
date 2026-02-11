import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
    try {
        const entries = db.prepare('SELECT * FROM logbook ORDER BY createdAt DESC').all();
        const columns = db.prepare('SELECT * FROM logbook_columns').all();

        return NextResponse.json({
            entries: entries.map((e: any) => ({
                ...e,
                extra_data: e.extra_data ? JSON.parse(e.extra_data) : {}
            })),
            columns: columns.map((c: any) => ({
                ...c,
                options: c.options ? JSON.parse(c.options) : []
            }))
        });
    } catch (error) {
        console.error('Logbook GET Error:', error);
        return NextResponse.json({ error: 'Failed to fetch logbook data' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Handle both single object and array of objects
        const items = Array.isArray(body) ? body : [body];

        const insert = db.prepare(`
            INSERT INTO logbook (date, sector, supervisor, location, report, staff_member, uniform, extra_data, supervised_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        // Use a transaction for multiple inserts
        const transaction = db.transaction((entries) => {
            for (const entry of entries) {
                insert.run(
                    entry.date,
                    entry.sector,
                    entry.supervisor,
                    entry.location,
                    entry.report || '',
                    entry.staff_member || '',
                    entry.uniform || '',
                    JSON.stringify(entry.extra_data || {}),
                    entry.supervised_by
                );
            }
        });

        transaction(items);

        return NextResponse.json({ success: true, count: items.length });
    } catch (error) {
        console.error('Logbook POST Error:', error);
        return NextResponse.json({ error: 'Failed to create logbook entry' }, { status: 500 });
    }
}
