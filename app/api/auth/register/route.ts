import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json({ error: 'El email es obligatorio' }, { status: 400 });
        }

        const name = 'Solicitante Pendiente';
        const department = 'Sin Asignar';
        const role = 'user';
        const approved = 0;
        const hashedPassword = '';

        const stmt = db.prepare('INSERT INTO users (name, email, password, department, role, approved) VALUES (?, ?, ?, ?, ?, ?)');
        const result = stmt.run(name, email, hashedPassword, department, role, approved);

        return NextResponse.json({
            success: true,
            userId: result.lastInsertRowid,
            user: { name, email, department, role, approved }
        });
    } catch (error: any) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return NextResponse.json({ error: 'El email ya está registrado' }, { status: 400 });
        }
        console.error('Registration error:', error);
        return NextResponse.json({ error: 'Error al registrar usuario' }, { status: 500 });
    }
}
