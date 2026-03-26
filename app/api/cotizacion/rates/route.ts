import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

async function checkAuth(request: NextRequest) {
    const session = await getSession(request);
    if (!session || !['admin', 'contador'].includes(session.user.role)) return null;
    return session;
}

export async function GET(request: NextRequest) {
    const session = await checkAuth(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const activeOnly = searchParams.get('activeOnly') === 'true';

    try {
        let sql = 'SELECT br.*, bc.name as category_name FROM billing_rates br LEFT JOIN billing_categories bc ON br.category_id = bc.id WHERE 1=1';
        const params: any[] = [];
        if (categoryId) { sql += ' AND br.category_id = ?'; params.push(categoryId); }
        if (activeOnly) { sql += ' AND br.valid_to IS NULL'; }
        sql += ' ORDER BY br.category_id, br.valid_from DESC';

        const rates = await db.prepare(sql).all(...params);
        return NextResponse.json(rates);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const session = await checkAuth(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { category_id, rate, overtime_multiplier, social_security_pct, bonus_provisions_pct, valid_from, notes } = await request.json();
        if (!category_id || !rate || !valid_from) {
            return NextResponse.json({ error: 'category_id, rate and valid_from are required' }, { status: 400 });
        }

        // Close the currently active rate for this category (set valid_to = valid_from - 1 day)
        const prevDay = new Date(valid_from);
        prevDay.setDate(prevDay.getDate() - 1);
        const prevDayStr = prevDay.toISOString().split('T')[0];
        await db.run(
            'UPDATE billing_rates SET valid_to = ? WHERE category_id = ? AND valid_to IS NULL',
            [prevDayStr, category_id]
        );

        if (db.type === 'pg') {
            const result = await db.query(
                `INSERT INTO billing_rates (category_id, rate, overtime_multiplier, social_security_pct, bonus_provisions_pct, valid_from, notes, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
                [category_id, rate, overtime_multiplier ?? 1.5, social_security_pct ?? 0, bonus_provisions_pct ?? 0, valid_from, notes ?? null, session.user.name]
            );
            return NextResponse.json(result[0], { status: 201 });
        } else {
            await db.run(
                `INSERT INTO billing_rates (category_id, rate, overtime_multiplier, social_security_pct, bonus_provisions_pct, valid_from, notes, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [category_id, rate, overtime_multiplier ?? 1.5, social_security_pct ?? 0, bonus_provisions_pct ?? 0, valid_from, notes ?? null, session.user.name]
            );
            const created = await db.get('SELECT * FROM billing_rates WHERE category_id = ? AND valid_from = ? AND valid_to IS NULL', [category_id, valid_from]);
            return NextResponse.json(created, { status: 201 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
