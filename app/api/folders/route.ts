import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { NextRequest } from 'next/server';

// GET /api/folders — list current user's folders with ticket count
export async function GET(request: NextRequest) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const folders = await db.prepare(`
            SELECT f.id, f.name, f.created_at,
                   COUNT(tf.ticket_id) AS ticket_count
            FROM folders f
            LEFT JOIN ticket_folder tf ON f.id = tf.folder_id
            WHERE f.user_id = ?
            GROUP BY f.id, f.name, f.created_at
            ORDER BY f.created_at DESC
        `).all(session.user.id) as any[];

        return NextResponse.json(folders.map(f => ({
            id: f.id,
            name: f.name,
            ticketCount: Number(f.ticket_count),
            createdAt: f.created_at
        })));
    } catch (error: any) {
        console.error('Error fetching folders:', error);
        return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 });
    }
}

// POST /api/folders — create a folder
export async function POST(request: NextRequest) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { name } = await request.json();
        if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

        const result = await db.prepare(
            'INSERT INTO folders (name, user_id) VALUES (?, ?)'
        ).run(name.trim(), session.user.id);

        return NextResponse.json({
            id: result.lastInsertRowid,
            name: name.trim(),
            ticketCount: 0
        }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating folder:', error);
        return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
    }
}
