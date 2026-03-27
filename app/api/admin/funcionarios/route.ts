import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const session = await getSession(request);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const rows = await db.prepare(
            'SELECT id, name FROM funcionarios_list WHERE active = 1 ORDER BY name ASC'
        ).all();
        return NextResponse.json(rows);
    } catch (error) {
        return NextResponse.json({ error: 'Error fetching funcionarios' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const session = await getSession(request);
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const { name } = await request.json();
        if (!name?.trim()) {
            return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
        }
        // Prevent duplicates
        const existing = await db.prepare(
            'SELECT id, name FROM funcionarios_list WHERE LOWER(name) = LOWER(?) AND active = 1'
        ).get(name.trim());
        if (existing) {
            return NextResponse.json(existing);
        }
        await db.prepare('INSERT INTO funcionarios_list (name) VALUES (?)').run(name.trim());
        const created = await db.prepare(
            'SELECT id, name FROM funcionarios_list WHERE name = ? AND active = 1 ORDER BY id DESC LIMIT 1'
        ).get(name.trim());
        return NextResponse.json(created);
    } catch (error) {
        return NextResponse.json({ error: 'Error al crear funcionario' }, { status: 500 });
    }
}
