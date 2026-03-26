import { NextResponse, NextRequest } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

async function checkAuth(request: NextRequest) {
    const session = await getSession(request);
    if (!session || !['admin', 'logistica'].includes(session.user.role)) return null;
    return session;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await checkAuth(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const body = await request.json();
        const allowed = ['tracking_number', 'recipient', 'destination', 'date_sent', 'estimated_delivery', 'status', 'weight', 'declared_value', 'description', 'notes', 'invoice_image_url'];
        const sets: string[] = [];
        const values: any[] = [];

        for (const key of allowed) {
            if (key in body) { sets.push(`${key} = ?`); values.push(body[key]); }
        }

        if (sets.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

        sets.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);

        await db.run(`UPDATE logistics_shipments SET ${sets.join(', ')} WHERE id = ?`, values);
        const updated = await db.get('SELECT * FROM logistics_shipments WHERE id = ?', [id]);
        return NextResponse.json(updated);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await checkAuth(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        await db.run('DELETE FROM logistics_shipments WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
