import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    try {
        const entries = await db.prepare('SELECT * FROM logbook ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
        const columns = await db.prepare('SELECT * FROM logbook_columns').all();
        const totalCount = await db.prepare('SELECT count(*) as count FROM logbook').get() as { count: number };

        return NextResponse.json({
            entries: entries.map((e: any) => ({
                ...e,
                createdAt: e.created_at,
                extra_data: e.extra_data ? JSON.parse(e.extra_data) : {}
            })),
            columns: columns.map((c: any) => ({
                ...c,
                options: c.options ? JSON.parse(c.options) : []
            })),
            totalCount: totalCount?.count || 0
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

        const insertSql = `
            INSERT INTO logbook (date, sector, supervisor, location, report, staff_member, uniform, extra_data, supervised_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        // Use a transaction for multiple inserts
        await db.transaction(async (tx) => {
            for (const entry of items) {
                await tx.run(insertSql, [
                    entry.date,
                    entry.sector,
                    entry.supervisor,
                    entry.location,
                    entry.report || '',
                    entry.staff_member || '',
                    entry.uniform || '',
                    JSON.stringify(entry.extra_data || {}),
                    entry.supervised_by
                ]);
            }
        });

        return NextResponse.json({ success: true, count: items.length });
    } catch (error) {
        console.error('Logbook POST Error:', error);
        return NextResponse.json({ error: 'Failed to create logbook entry' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const { id, date, sector, supervisor, location, report, staff_member, uniform, extra_data, supervised_by } = body;

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        const update = db.prepare(`
            UPDATE logbook 
            SET date = ?, sector = ?, supervisor = ?, location = ?, report = ?, staff_member = ?, uniform = ?, extra_data = ?, supervised_by = ?
            WHERE id = ?
        `);

        await update.run(
            date,
            sector,
            supervisor,
            location,
            report || '',
            staff_member || '',
            uniform || '',
            JSON.stringify(extra_data || {}),
            supervised_by,
            id
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Logbook PUT Error:', error);
        return NextResponse.json({ error: 'Failed to update logbook entry' }, { status: 500 });
    }
}
