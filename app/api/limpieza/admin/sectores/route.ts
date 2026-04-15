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
        const { searchParams } = new URL(request.url);
        const clienteId = searchParams.get('cliente_id');
        const where = clienteId ? 'WHERE cliente_id = ?' : '';
        const rows = await db.query(`SELECT id, cliente_id, name, active FROM limpieza_sectores ${where} ORDER BY name ASC`, clienteId ? [clienteId] : []);
        return NextResponse.json(rows);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        const { cliente_id, name } = await request.json();
        if (!cliente_id || !name || !name.trim()) return NextResponse.json({ error: 'cliente_id y nombre requeridos' }, { status: 400 });
        const res = await db.run('INSERT INTO limpieza_sectores (cliente_id, name) VALUES (?, ?)', [cliente_id, name.trim()]);
        return NextResponse.json({ id: res.lastInsertRowid, cliente_id, name: name.trim(), active: 1 });
    } catch (e: any) {
        if (String(e.message || e.code).includes('UNIQUE') || e.code === '23505') {
            return NextResponse.json({ error: 'Ya existe ese sector en el cliente' }, { status: 409 });
        }
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
