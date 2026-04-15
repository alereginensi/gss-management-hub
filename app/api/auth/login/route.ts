import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { comparePassword } from '@/lib/auth';
import { createSession } from '@/lib/auth-server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { LoginSchema } from '@/lib/schemas/auth';

export async function POST(request: Request) {
    try {
        const ip = getClientIp(request);
        const limit = rateLimit(ip, 'login', { windowMs: 15 * 60 * 1000, max: 5 });
        if (!limit.success) {
            return NextResponse.json(
                { error: 'Demasiados intentos. Intente nuevamente en unos minutos.' },
                { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
            );
        }

        const body = await request.json();
        const parsed = LoginSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
                { status: 400 }
            );
        }
        const { email, password, isAdminLogin } = parsed.data;

        if (!email) {
            return NextResponse.json({ error: 'Email es obligatorio' }, { status: 400 });
        }


        if (!db) {
            console.error('Database not initialized');
            return NextResponse.json({ error: 'Error de conexión con la base de datos' }, { status: 500 });
        }

        const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

        if (!user) {
            return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
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

        // Create the session (returns token)
        const sessionToken = await createSession({
            id: user.id,
            name: user.name,
            email: user.email,
            department: user.department,
            role: user.role,
            rubro: user.rubro,
            modules: user.modules ?? null,
            panel_access: user.panel_access ?? 1,
            cliente_asignado: user.cliente_asignado ?? null,
            sector_asignado: user.sector_asignado ?? null,
        });

        const response = NextResponse.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                department: user.department,
                role: user.role,
                rubro: user.rubro,
                modules: user.modules ?? null,
                panel_access: user.panel_access ?? 1,
                cliente_asignado: user.cliente_asignado ?? null,
                sector_asignado: user.sector_asignado ?? null,
            },
            // token eliminado del body — la sesión se maneja por la cookie httpOnly 'session'
        });

        // FORCE cookie on the response object to ensure it is sent
        response.cookies.set('session', sessionToken, {
            maxAge: 8 * 60 * 60, // 8 hours — consistente con createSession en auth-server.ts
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            priority: 'high'
        });

        return response;
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Error al iniciar sesión' }, { status: 500 });
    }
}
