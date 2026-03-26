import { NextResponse, NextRequest } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

async function checkAuth(request: NextRequest) {
    const session = await getSession(request);
    if (!session || !['admin', 'logistica'].includes(session.user.role)) return null;
    return session;
}

export async function GET(request: NextRequest) {
    const session = await checkAuth(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const search = searchParams.get('search') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';

    const conditions: string[] = [];
    const params: any[] = [];
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (dateFrom) { conditions.push('date_sent >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('date_sent <= ?'); params.push(dateTo); }
    if (search) { conditions.push('(recipient LIKE ? OR destination LIKE ? OR tracking_number LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';

    try {
        const rows = await db.query(`SELECT * FROM logistics_shipments${where} ORDER BY date_sent DESC, created_at DESC`, params);
        return NextResponse.json(rows);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const session = await checkAuth(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { tracking_number, recipient, destination, date_sent, weight, declared_value, description, notes } = await request.json();

        if (!recipient?.trim() || !destination?.trim() || !date_sent) {
            return NextResponse.json({ error: 'Destinatario, destino y fecha son obligatorios' }, { status: 400 });
        }

        const fields = ['recipient', 'destination', 'date_sent', 'created_by'];
        const values: any[] = [recipient.trim(), destination.trim(), date_sent, session.user.name];

        if (tracking_number?.trim()) { fields.push('tracking_number'); values.push(tracking_number.trim()); }
        if (weight != null && weight !== '') { fields.push('weight'); values.push(weight); }
        if (declared_value != null && declared_value !== '') { fields.push('declared_value'); values.push(declared_value); }
        if (description?.trim()) { fields.push('description'); values.push(description.trim()); }
        if (notes?.trim()) { fields.push('notes'); values.push(notes.trim()); }

        const placeholders = fields.map(() => '?').join(', ');
        const sql = `INSERT INTO logistics_shipments (${fields.join(', ')}) VALUES (${placeholders})`;

        if (db.type === 'pg') {
            const rows = await db.query(sql + ' RETURNING *', values);
            return NextResponse.json(rows[0], { status: 201 });
        } else {
            const result = await db.run(sql, values);
            const created = await db.get('SELECT * FROM logistics_shipments WHERE id = ?', [result.lastInsertRowid]);
            return NextResponse.json(created, { status: 201 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
