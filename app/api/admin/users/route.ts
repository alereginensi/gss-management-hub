import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { getSession } from '@/lib/auth-server';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const session = await getSession(request);
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'supervisor' && session.user.role !== 'jefe')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const { searchParams } = new URL(request.url);
        const roleFilter = searchParams.get('role');
        const rubroFilter = searchParams.get('rubro');

        let users;
        if (roleFilter && rubroFilter) {
            users = await db.prepare('SELECT id, name, email, department, role, rubro, approved, modules, panel_access, cliente_asignado, sector_asignado FROM users WHERE role = ? AND rubro = ? ORDER BY name ASC').all(roleFilter, rubroFilter);
        } else if (roleFilter) {
            users = await db.prepare('SELECT id, name, email, department, role, rubro, approved, modules, panel_access, cliente_asignado, sector_asignado FROM users WHERE role = ? ORDER BY name ASC').all(roleFilter);
        } else if (rubroFilter) {
            users = await db.prepare('SELECT id, name, email, department, role, rubro, approved, modules, panel_access, cliente_asignado, sector_asignado FROM users WHERE rubro = ? ORDER BY name ASC').all(rubroFilter);
        } else {
            users = await db.prepare('SELECT id, name, email, department, role, rubro, approved, modules, panel_access, cliente_asignado, sector_asignado FROM users ORDER BY name ASC').all();
        }
        return NextResponse.json(users);
    } catch (error) {
        console.error('GET /api/admin/users:', error);
        return NextResponse.json({ error: 'Error fetching users' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const session = await getSession(request);
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'supervisor' && session.user.role !== 'jefe')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const body = await request.json();
        const { email, action, name, password, department, role, rubro } = body;

        if (action === 'approve') {
            await db.prepare('UPDATE users SET approved = 1 WHERE email = ?').run(email);
            return NextResponse.json({ success: true });
        }

        if (action === 'reject') {
            await db.prepare('DELETE FROM users WHERE email = ? AND approved = 0').run(email);
            return NextResponse.json({ success: true });
        }

        if (action === 'delete') {
            const user = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
            if (user) {
                const userId = user.id;
                // Cleanup related records to avoid foreign key violations
                await db.prepare('DELETE FROM tasks WHERE user_id = ?').run(userId);
                await db.prepare('DELETE FROM supervisor_worker WHERE supervisor_id = ? OR worker_id = ?').run(userId, userId);
                await db.prepare('DELETE FROM ticket_collaborators WHERE user_id = ? OR added_by = ?').run(userId, userId);
                await db.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId);

                // Only allow admin to delete users
                if (session.user.role === 'admin') {
                    await db.prepare('DELETE FROM users WHERE id = ?').run(userId);
                } else {
                    return NextResponse.json({ error: 'Only administrators can delete users' }, { status: 403 });
                }
            }
            return NextResponse.json({ success: true });
        }

        if (action === 'create_admin') {
            const hashedPassword = await hashPassword(password);
            await db.prepare('INSERT INTO users (name, email, password, department, role, approved) VALUES (?, ?, ?, ?, ?, ?)')
                .run(name, email, hashedPassword, department, 'admin', 1);
            return NextResponse.json({ success: true });
        }

        if (action === 'create_supervisor') {
            const hashedPassword = await hashPassword(password);
            await db.prepare('INSERT INTO users (name, email, password, department, role, rubro, approved) VALUES (?, ?, ?, ?, ?, ?, ?)')
                .run(name, email, hashedPassword, department, 'supervisor', rubro, 1);
            return NextResponse.json({ success: true });
        }

        if (action === 'create_encargado_limpieza') {
            const { cliente_asignado, sector_asignado } = body;
            if (!cliente_asignado) {
                return NextResponse.json({ error: 'Cliente asignado es obligatorio' }, { status: 400 });
            }
            const hashedPassword = await hashPassword(password);
            await db.prepare('INSERT INTO users (name, email, password, department, role, approved, panel_access, cliente_asignado, sector_asignado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
                .run(name, email, hashedPassword, department || 'Limpieza', 'encargado_limpieza', 1, 0, cliente_asignado, sector_asignado || null);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    } catch (error) {
        console.error('Admin API error:', error);
        return NextResponse.json({ error: 'Error en la operación' }, { status: 500 });
    }
}
