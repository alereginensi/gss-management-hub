import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const { name, email, password, role } = await request.json();

        if (!email || !name) {
            return NextResponse.json({ error: 'El email y nombre son obligatorios' }, { status: 400 });
        }

        const department = 'Sin Asignar';
        const userRole = role || 'user';

        if (userRole !== 'user' && !password) {
            return NextResponse.json({ error: 'La contraseña es obligatoria para este rol' }, { status: 400 });
        }

        console.log('Registering user:', name, email, userRole);

        const approved = 0;
        const hashedPassword = password ? await hashPassword(password) : '';

        const stmt = db.prepare('INSERT INTO users (name, email, password, department, role, approved) VALUES (?, ?, ?, ?, ?, ?)');
        const result = stmt.run(name, email, hashedPassword, department, userRole, approved);

        return NextResponse.json({
            message: 'Usuario registrado exitosamente',
            userId: result.lastInsertRowid,
            user: { name, email, department, role: userRole, approved }
        });
    } catch (error: any) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return NextResponse.json({ error: 'El email ya está registrado' }, { status: 400 });
        }
        console.error('Registration error:', error);
        return NextResponse.json({ error: 'Error al registrar usuario' }, { status: 500 });
    }
}
