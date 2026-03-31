import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import db from '@/lib/db';

// Public — no auth required, just to check if there is an existing record for today
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email')?.toLowerCase().trim();
    if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 });

    const fecha = new Date().toISOString().split('T')[0];

    try {
        const registro = await db.get(
            'SELECT * FROM limpieza_registros WHERE LOWER(email) = ? AND fecha = ? ORDER BY id DESC LIMIT 1',
            [email, fecha]
        );

        if (!registro) return NextResponse.json({ found: false });
        
        return NextResponse.json({ found: true, registro });
    } catch (error) {
        console.error('Error lookup registro limpieza:', error);
        return NextResponse.json({ error: 'Error al buscar registro' }, { status: 500 });
    }
}
