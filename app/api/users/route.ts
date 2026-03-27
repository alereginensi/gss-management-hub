import { NextResponse, NextRequest } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const users = await db.prepare(
            'SELECT id, name, email, role, department, rubro, modules FROM users WHERE approved = 1 ORDER BY name ASC'
        ).all();
        return NextResponse.json(users);
    } catch (error) {
        return NextResponse.json({ error: 'Error fetching users' }, { status: 500 });
    }
}
