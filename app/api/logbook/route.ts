import { NextResponse } from 'next/server';
import db from '@/lib/db';

import { getSession } from '@/lib/auth-server';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const session = await getSession(request);
    const { searchParams } = new URL(request.url);
    const limitParam = parseInt(searchParams.get('limit') || '0');
    const offset = parseInt(searchParams.get('offset') || '0');
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const serviceType = searchParams.get('serviceType') || '';

    try {
        const conditions: string[] = [];
        const params: any[] = [];

        if (session?.user?.role === 'supervisor') {
            conditions.push('supervisor = ?');
            params.push(session.user.name);
        }
        if (dateFrom) { conditions.push('date >= ?'); params.push(dateFrom); }
        if (dateTo) { conditions.push('date <= ?'); params.push(dateTo); }
        if (serviceType) { conditions.push('supervised_by = ?'); params.push(serviceType); }

        const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
        let entriesSql = 'SELECT * FROM logbook' + whereClause;
        const countSql = 'SELECT count(*) as count FROM logbook' + whereClause;

        let entries;
        if (limitParam > 0) {
            entriesSql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
            entries = await db.prepare(entriesSql).all(...params, limitParam, offset);
        } else {
            entriesSql += ' ORDER BY id DESC';
            entries = await db.prepare(entriesSql).all(...params);
        }
        const columns = await db.prepare('SELECT * FROM logbook_columns').all();
        const totalCount = await db.prepare(countSql).get(...params) as { count: number };

        return NextResponse.json({
            entries: entries.map((e: any) => ({
                ...e,
                createdAt: e.created_at,
                extra_data: e.extra_data ? JSON.parse(e.extra_data) : {},
                images: e.images ? JSON.parse(e.images) : []
            })),
            columns: columns.map((c: any) => ({
                ...c,
                options: c.options ? JSON.parse(c.options) : []
            })),
            totalCount: totalCount?.count || 0
        });
    } catch (error: any) {
        console.error('Logbook GET Error:', error?.stack || error);
        return NextResponse.json({ error: error?.message || 'Failed to fetch logbook data' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await getSession(req);
    try {
        const body = await req.json();

        // Handle both single object and array of objects
        const items = Array.isArray(body) ? body : [body];

        const insertSql = `
            INSERT INTO logbook (date, sector, supervisor, location, incident, report, staff_member, uniform, extra_data, supervised_by, time, images)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        // Use a transaction for multiple inserts
        await db.transaction(async (tx) => {
            for (const entry of items) {
                await tx.run(insertSql, [
                    entry.date || null,
                    entry.sector || null,
                    entry.supervisor || null,
                    entry.location || null,
                    entry.incident || '',
                    entry.report || '',
                    entry.staff_member || '',
                    entry.uniform || '',
                    JSON.stringify(entry.extra_data || {}),
                    entry.supervised_by || null,
                    entry.time || null,
                    JSON.stringify(entry.images || [])
                ]);
            }
        });

        return NextResponse.json({ success: true, count: items.length });
    } catch (error: any) {
        console.error('Logbook POST Error:', error?.stack || error);
        return NextResponse.json({ error: error?.message || 'Failed to create logbook entry' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const { id, date, sector, supervisor, location, incident, report, staff_member, uniform, extra_data, supervised_by, time, images } = body;

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        const update = db.prepare(`
            UPDATE logbook
            SET date = ?, sector = ?, supervisor = ?, location = ?, incident = ?, report = ?, staff_member = ?, uniform = ?, extra_data = ?, supervised_by = ?, time = ?, images = ?
            WHERE id = ?
        `);

        await update.run(
            date || null,
            sector || null,
            supervisor || null,
            location || null,
            incident || '',
            report || '',
            staff_member || '',
            uniform || '',
            JSON.stringify(extra_data || {}),
            supervised_by || null,
            time || null,
            JSON.stringify(images || []),
            id
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Logbook PUT Error:', error);
        return NextResponse.json({ error: 'Failed to update logbook entry' }, { status: 500 });
    }
}
