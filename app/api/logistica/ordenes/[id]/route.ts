import { NextResponse, NextRequest } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

async function checkAuth(request: NextRequest) {
    const session = await getSession(request);
    if (!session || !['admin', 'logistica'].includes(session.user.role)) return null;
    return session;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await checkAuth(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    try {
        const order = await db.get('SELECT * FROM purchase_orders WHERE id = ?', [id]);
        if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const items = await db.query('SELECT * FROM purchase_order_items WHERE order_id = ? ORDER BY id', [id]);
        return NextResponse.json({ ...order, items });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await checkAuth(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    try {
        const body = await request.json();
        const allowed = ['order_number', 'adenda_id', 'rut_emisor', 'rut_comprador', 'buyer_name',
            'issue_date', 'due_date', 'total_amount', 'neto_basica', 'neto_minima',
            'iva_basica', 'iva_minima', 'discounts', 'exempt', 'status', 'notes', 'file_url', 'received_items'];
        const sets: string[] = [];
        const values: any[] = [];
        for (const key of allowed) {
            if (key in body) { sets.push(`${key} = ?`); values.push(body[key]); }
        }
        if (sets.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        sets.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        await db.run(`UPDATE purchase_orders SET ${sets.join(', ')} WHERE id = ?`, values);
        const updated = await db.get('SELECT * FROM purchase_orders WHERE id = ?', [id]);
        const items = await db.query('SELECT * FROM purchase_order_items WHERE order_id = ? ORDER BY id', [id]);
        return NextResponse.json({ ...updated, items });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await checkAuth(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    try {
        await db.run('DELETE FROM purchase_orders WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
