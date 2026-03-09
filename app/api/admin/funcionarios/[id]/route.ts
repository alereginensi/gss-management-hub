import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { NextRequest } from 'next/server';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession(request);
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const { id } = await params;
        const { name } = await request.json();
        if (!name?.trim()) {
            return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
        }
        await db.prepare('UPDATE funcionarios_list SET name = ? WHERE id = ?').run(name.trim(), id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Error al actualizar funcionario' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession(request);
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const { id } = await params;
        await db.prepare('UPDATE funcionarios_list SET active = 0 WHERE id = ?').run(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Error al eliminar funcionario' }, { status: 500 });
    }
}
