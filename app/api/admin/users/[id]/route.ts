import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { hashPassword } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession(request);

    // Verify admin permission
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { id: userId } = await params;
        const body = await request.json();
        const { email, name, department, role, rubro, password, modules, panel_access, cliente_asignado, sector_asignado } = body;

        // Verify user exists
        const existingUser = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!existingUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // If email is being changed, verify it's not already in use
        if (email && email !== (existingUser as any).email) {
            const emailExists = await db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, userId);
            if (emailExists) {
                return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
            }
        }

        // Build update query dynamically
        const updates: string[] = [];
        const values: any[] = [];

        if (email !== undefined) {
            updates.push('email = ?');
            values.push(email);
        }
        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name);
        }
        if (department !== undefined) {
            updates.push('department = ?');
            values.push(department);
        }
        if (role !== undefined) {
            updates.push('role = ?');
            values.push(role);
        }
        if (rubro !== undefined) {
            updates.push('rubro = ?');
            values.push(rubro);
        }
        if (modules !== undefined) {
            updates.push('modules = ?');
            values.push(modules || null);
        }
        if (panel_access !== undefined) {
            updates.push('panel_access = ?');
            values.push(panel_access ? 1 : 0);
        }
        if (cliente_asignado !== undefined) {
            updates.push('cliente_asignado = ?');
            values.push(cliente_asignado || null);
        }
        if (sector_asignado !== undefined) {
            updates.push('sector_asignado = ?');
            values.push(sector_asignado || null);
        }
        if (password && password.trim() !== '') {
            // Hash password with bcrypt
            const hashedPassword = await hashPassword(password);
            updates.push('password = ?');
            values.push(hashedPassword);
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        // Add userId to values array for WHERE clause
        values.push(userId);

        // Execute update
        const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
        await db.prepare(query).run(...values);

        return NextResponse.json({
            success: true,
            message: 'Usuario actualizado correctamente'
        });

    } catch (error: any) {
        console.error('Error updating user:', error);
        return NextResponse.json({
            error: 'Failed to update user',
            details: error.message
        }, { status: 500 });
    }
}
