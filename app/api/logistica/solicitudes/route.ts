import { NextResponse, NextRequest } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { parseDbJsonArray } from '@/lib/parse-db-json';

async function checkAuth(request: NextRequest) {
    const session = await getSession(request);
    if (!session || !['admin', 'logistica', 'jefe'].includes(session.user.role)) return null;
    return session;
}

export async function GET(request: NextRequest) {
    const session = await checkAuth(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const month = searchParams.get('month') || '';
    const year = searchParams.get('year') || '';

    const conditions: string[] = [];
    const params: any[] = [];

    if (status) { conditions.push('status = ?'); params.push(status); }
    if (dateFrom) { conditions.push('needed_date >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('needed_date <= ?'); params.push(dateTo); }
    if (month && year) {
        conditions.push('needed_date LIKE ?');
        params.push(`${year}-${month.padStart(2, '0')}-%`);
    }

    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';

    try {
        const rows = await db.query(`SELECT * FROM material_requests${where} ORDER BY needed_date ASC, created_at DESC`, params);
        // Parse items JSON for frontend
        const parsedRows = rows.map((r: any) => {
            const items = parseDbJsonArray(r.items);
            return {
                ...r,
                items: items.length > 0 ? items : [{ article: r.article, quantity: r.quantity }],
            };
        });
        return NextResponse.json(parsedRows);
    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const session = await checkAuth(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { client, needed_date, items, file_url } = body;

        if (!needed_date || !items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'Faltan campos obligatorios o ítems' }, { status: 400 });
        }

        const itemsJson = JSON.stringify(items);
        const fallbackArticle = items.length === 1 ? items[0].article : 'Varios (Ver Detalle)';
        const fallbackQuantity = items.length === 1 ? items[0].quantity : items.length;
        const clientVal = client?.trim() || '';

        const sql = `INSERT INTO material_requests (client, article, quantity, items, needed_date, requested_by, file_url) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const values = [clientVal, fallbackArticle, fallbackQuantity, itemsJson, needed_date, session.user.name, file_url || null];

        if (db.type === 'pg') {
            const pgSql = `INSERT INTO material_requests (client, article, quantity, items, needed_date, requested_by, file_url) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`;
            const rows = await db.query(pgSql, values);
            const r = rows[0] as any;
            const parsed = parseDbJsonArray(r.items);
            r.items = parsed.length > 0 ? parsed : [{ article: r.article, quantity: r.quantity }];
            return NextResponse.json(r, { status: 201 });
        } else {
            const result = await db.run(sql, values);
            const created = await db.get('SELECT * FROM material_requests WHERE id = ?', [result.lastInsertRowid]);
            created.items = JSON.parse(created.items);
            return NextResponse.json(created, { status: 201 });
        }
    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
