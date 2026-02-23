import { NextResponse } from 'next/server';
import db from '@/lib/db';

// GET all active roles
export async function GET() {
    try {
        const roles = await db.prepare('SELECT * FROM job_roles WHERE active = 1 ORDER BY name ASC').all();
        // Parse tasks JSON
        const parsedRoles = roles.map((r: any) => ({
            ...r,
            tasks: r.tasks ? JSON.parse(r.tasks) : []
        }));
        return NextResponse.json(parsedRoles);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST new role or update tasks
export async function POST(request: Request) {
    try {
        const { id, name, tasks } = await request.json();

        if (!name || !name.trim()) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        const tasksJson = JSON.stringify(tasks || []);

        if (id) {
            // Update existing
            const stmt = db.prepare('UPDATE job_roles SET name = ?, tasks = ? WHERE id = ?');
            await stmt.run(name.trim(), tasksJson, id);
            return NextResponse.json({ id, name, tasks, active: 1 });
        } else {
            // Create new
            const stmt = db.prepare('INSERT INTO job_roles (name, tasks) VALUES (?, ?)');
            const info = await stmt.run(name.trim(), tasksJson);
            return NextResponse.json({ id: info.lastInsertRowid, name: name.trim(), tasks, active: 1 });
        }
    } catch (error: any) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === '23505') {
            return NextResponse.json({ error: 'Role already exists' }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE role (Soft delete)
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        const stmt = db.prepare('UPDATE job_roles SET active = 0 WHERE id = ?');
        await stmt.run(id);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
