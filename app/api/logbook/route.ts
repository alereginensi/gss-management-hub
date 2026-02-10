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
        const { title, date, sector, supervisor, location, report, staff_member, extra_data } = body;

        const info = db.prepare(`
            INSERT INTO logbook (title, date, sector, supervisor, location, report, staff_member, extra_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(title, date, sector, supervisor, location, report, staff_member, JSON.stringify(extra_data || {}));

        return NextResponse.json({ success: true, id: info.lastInsertRowid });
    } catch (error) {
        console.error('Logbook POST Error:', error);
        return NextResponse.json({ error: 'Failed to create logbook entry' }, { status: 500 });
    }
}
