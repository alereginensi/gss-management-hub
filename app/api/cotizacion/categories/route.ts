import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

async function checkAuth(request: NextRequest) {
    const session = await getSession(request);
    if (!session || !['admin', 'contador'].includes(session.user.role)) return null;
    return session;
}

export async function GET(request: NextRequest) {
    const session = await checkAuth(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const categories = await db.prepare('SELECT * FROM billing_categories ORDER BY name').all();
        return NextResponse.json(categories);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const session = await checkAuth(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { name, description } = await request.json();
        if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

        if (db.type === 'pg') {
            const result = await db.query(
                'INSERT INTO billing_categories (name, description) VALUES (?, ?) RETURNING *',
                [name.trim(), description || null]
            );
            return NextResponse.json(result[0], { status: 201 });
        } else {
            await db.run('INSERT INTO billing_categories (name, description) VALUES (?, ?)', [name.trim(), description || null]);
            const created = await db.get('SELECT * FROM billing_categories WHERE name = ?', [name.trim()]);
            return NextResponse.json(created, { status: 201 });
        }
    } catch (error: any) {
        if (error.message?.includes('UNIQUE')) return NextResponse.json({ error: 'Category already exists' }, { status: 409 });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
