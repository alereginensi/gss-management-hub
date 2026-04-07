import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rows = await db.query('SELECT id, nombre, cedula, sector, cliente, activo, created_at FROM limpieza_usuarios ORDER BY nombre ASC');
    return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { nombre, cedula, sector, cliente } = await request.json();
    if (!nombre || !cedula) return NextResponse.json({ error: 'Nombre y Cédula son obligatorios' }, { status: 400 });

    try {
        const result = await db.run(
            'INSERT INTO limpieza_usuarios (nombre, cedula, sector, cliente) VALUES (?, ?, ?, ?)',
            [nombre, cedula.trim(), sector || null, cliente || null]
        );
        return NextResponse.json({ success: true, id: result.lastInsertRowid }, { status: 201 });
    } catch (e: any) {
        if (e.code === 'SQLITE_CONSTRAINT_UNIQUE' || e.code === '23505') {
            return NextResponse.json({ error: 'La Cédula ya está registrada' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, nombre, cedula, sector, cliente, activo } = await request.json();
    if (!id || !cedula) return NextResponse.json({ error: 'ID y Cédula requeridos' }, { status: 400 });

    try {
        await db.run(
            'UPDATE limpieza_usuarios SET nombre=?, cedula=?, sector=?, cliente=?, activo=? WHERE id=?',
            [nombre, cedula.trim(), sector || null, cliente || null, activo ?? 1, id]
        );
        return NextResponse.json({ success: true });
    } catch (e: any) {
        if (e.code === 'SQLITE_CONSTRAINT_UNIQUE' || e.code === '23505') {
            return NextResponse.json({ error: 'La Cédula ya está registrada' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    await db.run('DELETE FROM limpieza_usuarios WHERE id=?', [id]);
    return NextResponse.json({ success: true });
}
