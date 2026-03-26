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

    try {
        const { id } = await params;
        const rows = await db.query(
            'SELECT * FROM logistics_shipment_comments WHERE shipment_id = ? ORDER BY created_at ASC',
            [id]
        );
        return NextResponse.json(rows);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await checkAuth(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const { comment } = await request.json();
        if (!comment?.trim()) return NextResponse.json({ error: 'El comentario no puede estar vacío' }, { status: 400 });

        const sql = 'INSERT INTO logistics_shipment_comments (shipment_id, user_name, comment) VALUES (?, ?, ?)';
        const values = [id, session.user.name, comment.trim()];

        if (db.type === 'pg') {
            const rows = await db.query(sql + ' RETURNING *', values);
            return NextResponse.json(rows[0], { status: 201 });
        } else {
            const result = await db.run(sql, values);
            const created = await db.get('SELECT * FROM logistics_shipment_comments WHERE id = ?', [result.lastInsertRowid]);
            return NextResponse.json(created, { status: 201 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
