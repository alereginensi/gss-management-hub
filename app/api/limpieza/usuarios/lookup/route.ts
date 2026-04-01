import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import db from '@/lib/db';

// Public — no auth required
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const cedula = searchParams.get('cedula')?.trim();
    if (!cedula) return NextResponse.json({ error: 'Cédula requerida' }, { status: 400 });

    const user = await db.get(
        'SELECT id, nombre, cedula, sector, cliente FROM limpieza_usuarios WHERE cedula = ? AND activo = 1',
        [cedula]
    );

    if (!user) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json(user);
}
