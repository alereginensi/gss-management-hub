import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

async function requireAdmin(request: NextRequest) {
    const session = await getSession(request);
    if (!session || session.user.role !== 'admin') return null;
    return session;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        const { id } = await params;
        const { name, active } = await request.json();
        const updates: string[] = [];
        const values: any[] = [];
        if (name !== undefined) { updates.push('name = ?'); values.push(String(name).trim()); }
        if (active !== undefined) { updates.push('active = ?'); values.push(active ? 1 : 0); }
        if (updates.length === 0) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
        values.push(id);
        await db.run(`UPDATE limpieza_clientes SET ${updates.join(', ')} WHERE id = ?`, values);
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        const { id } = await params;
        await db.run('UPDATE limpieza_clientes SET active = 0 WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
