import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { RegisterSchema } from '@/lib/schemas/auth';

export async function POST(request: Request) {
    try {
        const ip = getClientIp(request);
        const limit = rateLimit(ip, 'register', { windowMs: 15 * 60 * 1000, max: 3 });
        if (!limit.success) {
            return NextResponse.json(
                { error: 'Demasiados intentos de registro. Intente más tarde.' },
                { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
            );
        }

        const body = await request.json();
        const parsed = RegisterSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
                { status: 400 }
            );
        }
        const { name, email, password, role, rubro } = parsed.data;

        const department = 'Sin Asignar';
        const userRole = role || 'user';
        const userRubro = userRole === 'supervisor' ? rubro : null;

        if (userRole !== 'user' && !password) {
            return NextResponse.json({ error: 'La contraseña es obligatoria para este rol' }, { status: 400 });
        }

        console.log('Registering user:', name, email, userRole, userRubro);

        const approved = 0;
        const hashedPassword = password ? await hashPassword(password) : '';

        const stmt = db.prepare('INSERT INTO users (name, email, password, department, role, approved, rubro) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const result = await stmt.run(name, email, hashedPassword, department, userRole, approved, userRubro);

        return NextResponse.json({
            message: 'Usuario registrado exitosamente',
            userId: result.lastInsertRowid,
            user: { name, email, department, role: userRole, approved, rubro: userRubro }
        });
    } catch (error: any) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === '23505') {
            return NextResponse.json({ error: 'El email ya está registrado' }, { status: 400 });
        }
        console.error('Registration error:', error);
        return NextResponse.json({ error: 'Error al registrar usuario' }, { status: 500 });
    }
}
