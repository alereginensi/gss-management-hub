import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { getSession } from '@/lib/auth-server';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const session = await getSession(request);
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'supervisor')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const { searchParams } = new URL(request.url);
        const roleFilter = searchParams.get('role');
        const users = roleFilter
            ? db.prepare('SELECT id, name, email, department, role, approved FROM users WHERE role = ? ORDER BY name ASC').all(roleFilter)
            : db.prepare('SELECT id, name, email, department, role, approved FROM users ORDER BY name ASC').all();
        return NextResponse.json(users);
    } catch (error) {
        return NextResponse.json({ error: 'Error fetching users' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const session = await getSession(request);
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'supervisor')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const { email, action, name, password, department, role } = await request.json();

        if (action === 'approve') {
            db.prepare('UPDATE users SET approved = 1 WHERE email = ?').run(email);
            return NextResponse.json({ success: true });
        }

        if (action === 'reject') {
            db.prepare('DELETE FROM users WHERE email = ? AND approved = 0').run(email);
            return NextResponse.json({ success: true });
        }

        if (action === 'delete') {
            db.prepare('DELETE FROM users WHERE email = ?').run(email);
            return NextResponse.json({ success: true });
        }

        if (action === 'create_admin') {
            const hashedPassword = await hashPassword(password);
            db.prepare('INSERT INTO users (name, email, password, department, role, approved) VALUES (?, ?, ?, ?, ?, ?)')
                .run(name, email, hashedPassword, department, 'admin', 1);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    } catch (error) {
        console.error('Admin API error:', error);
        return NextResponse.json({ error: 'Error en la operación' }, { status: 500 });
    }
}
