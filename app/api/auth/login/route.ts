import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { comparePassword } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const { email, password, isAdminLogin } = await request.json();

        if (!email) {
            return NextResponse.json({ error: 'Email es obligatorio' }, { status: 400 });
        }

        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

        if (!user) {
            return NextResponse.json({ error: 'El usuario no existe o no ha sido aprobado' }, { status: 401 });
        }

        if (isAdminLogin) {
            // Personal/Admin Login (Requires Password)
            if (!password) {
                return NextResponse.json({ error: 'Contraseña obligatoria' }, { status: 400 });
            }

            const isPasswordValid = await comparePassword(password, user.password);
            if (!isPasswordValid) {
                return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
            }

            // Check if user is approved (even for staff) - Admin is always approved effectively, but good to check
            if (user.role !== 'admin' && user.approved !== 1) {
                return NextResponse.json({ error: 'Tu cuenta requiere aprobación' }, { status: 403 });
            }

        } else {
            // Solicitante Login (No Password)
            if (user.role !== 'user') {
                return NextResponse.json({ error: 'Este email corresponde a un usuario con acceso restringido. Por favor utilice "Acceso Personal".' }, { status: 403 });
            }

            if (user.approved !== 1) {
                return NextResponse.json({ error: 'Tu acceso aún no ha sido aprobado por un administrador' }, { status: 403 });
            }
        }

        // In a real app, we would set a session cookie here.
        // For this demo, we'll return the user info and handle session in context.
        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                department: user.department,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Error al iniciar sesión' }, { status: 500 });
    }
}
