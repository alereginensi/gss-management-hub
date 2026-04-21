import { NextResponse, NextRequest } from 'next/server';
import { getSession } from '@/lib/auth-server';
import db from '@/lib/db';
import { parseDbJsonArray } from '@/lib/parse-db-json';

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
                items: parseDbJsonArray(r.items),
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
        const { fecha, tipo, titulo, descripcion, items, file_url, firma_url, firma_aclaracion } = body;

        if (!fecha || !tipo) {
            return NextResponse.json({ error: 'fecha y tipo son obligatorios' }, { status: 400 });
        }
        if (!['entrega', 'despacho'].includes(tipo)) {
            return NextResponse.json({ error: 'tipo inválido' }, { status: 400 });
        }

        await db.run(
            `INSERT INTO logistica_calendario (fecha, tipo, titulo, descripcion, items, file_url, firma_url, firma_aclaracion, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [fecha, tipo, titulo || null, descripcion || null,
             items ? JSON.stringify(items) : null, file_url || null, firma_url || null, firma_aclaracion || null, session.user.name]
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
        const sets: string[] = [];
        const params: any[] = [];

        if ('titulo' in body) { sets.push('titulo = ?'); params.push(body.titulo || null); }
        if ('descripcion' in body) { sets.push('descripcion = ?'); params.push(body.descripcion || null); }
        if ('items' in body) {
            sets.push('items = ?');
            params.push(body.items ? JSON.stringify(body.items) : null);
        }
        if ('file_url' in body) { sets.push('file_url = ?'); params.push(body.file_url || null); }
        if ('firma_url' in body) { sets.push('firma_url = ?'); params.push(body.firma_url || null); }
        if ('firma_aclaracion' in body) { sets.push('firma_aclaracion = ?'); params.push(body.firma_aclaracion || null); }

        if (sets.length === 0) {
            return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 });
        }

        params.push(id);
        await db.run(
            `UPDATE logistica_calendario SET ${sets.join(', ')} WHERE id = ?`,
            params
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
