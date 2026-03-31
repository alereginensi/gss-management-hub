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
    const status = searchParams.get('status');

    try {
        let sql = `
            SELECT bp.*,
                COUNT(be.id) as entry_count,
                COALESCE(SUM(be.regular_hours + be.overtime_hours), 0) as total_hours
            FROM billing_periods bp
            LEFT JOIN billing_entries be ON be.period_id = bp.id
            WHERE 1=1
        `;
        const params: any[] = [];
        if (status) { sql += ' AND bp.status = ?'; params.push(status); }
        sql += ' GROUP BY bp.id ORDER BY bp.created_at DESC';

        const periods = await db.query(sql, params);
        return NextResponse.json(periods);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const session = await checkAuth(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { label, period_type, date_from, date_to, notes } = await request.json();
        if (!label || !date_from || !date_to) {
            return NextResponse.json({ error: 'label, date_from and date_to are required' }, { status: 400 });
        }

        if (db.type === 'pg') {
            const result = await db.query(
                `INSERT INTO billing_periods (label, period_type, date_from, date_to, notes, created_by) VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
                [label, period_type ?? 'monthly', date_from, date_to, notes ?? null, session.user.name]
            );
            return NextResponse.json(result[0], { status: 201 });
        } else {
            await db.run(
                `INSERT INTO billing_periods (label, period_type, date_from, date_to, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
                [label, period_type ?? 'monthly', date_from, date_to, notes ?? null, session.user.name]
            );
            const created = await db.get('SELECT * FROM billing_periods ORDER BY id DESC LIMIT 1');
            return NextResponse.json(created, { status: 201 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
