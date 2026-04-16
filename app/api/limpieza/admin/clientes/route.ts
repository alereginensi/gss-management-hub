import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

async function requireAdmin(request: NextRequest) {
    const session = await getSession(request);
    if (!session || session.user.role !== 'admin') return null;
    return session;
}

export async function GET(request: NextRequest) {
    if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        const rows = await db.query('SELECT id, name, active FROM limpieza_clientes ORDER BY name ASC');
        return NextResponse.json(rows);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        const { name } = await request.json();
        if (!name || !name.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
        const res = await db.run('INSERT INTO limpieza_clientes (name) VALUES (?)', [name.trim()]);
        return NextResponse.json({ id: res.lastInsertRowid, name: name.trim(), active: 1 });
    } catch (e: any) {
        if (String(e.message || e.code).includes('UNIQUE') || e.code === '23505') {
            return NextResponse.json({ error: 'Ya existe un cliente con ese nombre' }, { status: 409 });
        }
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
