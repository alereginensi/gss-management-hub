import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { NextRequest } from 'next/server';

// PATCH /api/folders/[id] — rename folder
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const { name } = await request.json();
        if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

        const folder = await db.prepare('SELECT id FROM folders WHERE id = ? AND user_id = ?').get(id, session.user.id);
        if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        await db.prepare('UPDATE folders SET name = ? WHERE id = ?').run(name.trim(), id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to rename folder' }, { status: 500 });
    }
}

// DELETE /api/folders/[id] — delete folder
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const folder = await db.prepare('SELECT id FROM folders WHERE id = ? AND user_id = ?').get(id, session.user.id);
        if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        await db.prepare('DELETE FROM ticket_folder WHERE folder_id = ?').run(id);
        await db.prepare('DELETE FROM folders WHERE id = ?').run(id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
    }
}
