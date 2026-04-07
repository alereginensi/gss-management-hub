import { NextResponse, NextRequest } from 'next/server';
import { getSession } from '@/lib/auth-server';
import db from '@/lib/db';

const AUTH_ROLES = ['admin', 'logistica', 'jefe'];

export async function GET(request: NextRequest) {
    const session = await getSession(request);
    if (!session || !AUTH_ROLES.includes(session.user.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');

    try {
        const conditions: string[] = [];
        const params: any[] = [];

        if (desde) { conditions.push('fecha >= ?'); params.push(desde); }
        if (hasta) { conditions.push('fecha <= ?'); params.push(hasta); }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const rows = await db.query(
            `SELECT * FROM logistica_calendario ${where} ORDER BY fecha ASC, created_at DESC`,
            params
        );

        return NextResponse.json(
            rows.map((r: any) => ({
                ...r,
                items: r.items ? JSON.parse(r.items) : [],
            }))
        );
    } catch (err: any) {
        console.error('Calendario GET error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const session = await getSession(request);
    if (!session || !AUTH_ROLES.includes(session.user.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { fecha, tipo, titulo, descripcion, items, file_url, firma_url } = body;

        if (!fecha || !tipo) {
            return NextResponse.json({ error: 'fecha y tipo son obligatorios' }, { status: 400 });
        }
        if (!['entrega', 'despacho'].includes(tipo)) {
            return NextResponse.json({ error: 'tipo inválido' }, { status: 400 });
        }

        await db.run(
            `INSERT INTO logistica_calendario (fecha, tipo, titulo, descripcion, items, file_url, firma_url, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [fecha, tipo, titulo || null, descripcion || null,
             items ? JSON.stringify(items) : null, file_url || null, firma_url || null, session.user.name]
        );

        return NextResponse.json({ success: true }, { status: 201 });
    } catch (err: any) {
        console.error('Calendario POST error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const session = await getSession(request);
    if (!session || !AUTH_ROLES.includes(session.user.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    try {
        const body = await request.json();
        const { firma_url } = body;

        await db.run(
            `UPDATE logistica_calendario SET firma_url = ? WHERE id = ?`,
            [firma_url || null, id]
        );

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('Calendario PUT error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const session = await getSession(request);
    if (!session || !AUTH_ROLES.includes(session.user.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    try {
        await db.run('DELETE FROM logistica_calendario WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
