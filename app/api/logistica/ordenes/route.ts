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
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const search = searchParams.get('search') || '';

    const conditions: string[] = [];
    const params: any[] = [];
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (dateFrom) { conditions.push('issue_date >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('issue_date <= ?'); params.push(dateTo); }
    if (search) { conditions.push('(order_number LIKE ? OR rut_emisor LIKE ? OR rut_comprador LIKE ? OR buyer_name LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }

    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';

    try {
        const orders = await db.query(`SELECT * FROM purchase_orders${where} ORDER BY created_at DESC`, params);
        return NextResponse.json(orders);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const session = await checkAuth(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { order_number, adenda_id, rut_emisor, rut_comprador, buyer_name, issue_date, due_date,
            total_amount, neto_basica, neto_minima, iva_basica, iva_minima, discounts, exempt,
            notes, file_url, items } = body;

        const fields = ['created_by'];
        const values: any[] = [session.user.name];

        const add = (f: string, v: any) => { if (v != null && v !== '') { fields.push(f); values.push(v); } };
        add('order_number', order_number); add('adenda_id', adenda_id);
        add('rut_emisor', rut_emisor); add('rut_comprador', rut_comprador); add('buyer_name', buyer_name);
        add('issue_date', issue_date); add('due_date', due_date);
        add('total_amount', total_amount); add('neto_basica', neto_basica); add('neto_minima', neto_minima);
        add('iva_basica', iva_basica); add('iva_minima', iva_minima);
        add('discounts', discounts); add('exempt', exempt);
        add('notes', notes); add('file_url', file_url);

        const placeholders = fields.map(() => '?').join(', ');
        const sql = `INSERT INTO purchase_orders (${fields.join(', ')}) VALUES (${placeholders})`;

        let orderId: number;
        if (db.type === 'pg') {
            const rows = await db.query(sql + ' RETURNING id', values);
            orderId = rows[0].id;
        } else {
            const result = await db.run(sql, values);
            orderId = result.lastInsertRowid as number;
        }

        // Insert items
        if (items?.length) {
            for (const item of items) {
                await db.run(
                    'INSERT INTO purchase_order_items (order_id, quantity, article, unit_price, discount, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
                    [orderId, item.quantity, item.article, item.unit_price, item.discount ?? 0, item.subtotal]
                );
            }
        }

        const created = await db.get('SELECT * FROM purchase_orders WHERE id = ?', [orderId]);
        const createdItems = await db.query('SELECT * FROM purchase_order_items WHERE order_id = ? ORDER BY id', [orderId]);
        return NextResponse.json({ ...created, items: createdItems }, { status: 201 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
