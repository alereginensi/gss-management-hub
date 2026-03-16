import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { NextRequest } from 'next/server';

// GET /api/folders/[id]/tickets — get tickets in a folder
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const folder = await db.prepare('SELECT id FROM folders WHERE id = ? AND user_id = ?').get(id, session.user.id);
        if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const tickets = await db.prepare(`
            SELECT t.* FROM tickets t
            INNER JOIN ticket_folder tf ON t.id = tf.ticket_id
            WHERE tf.folder_id = ?
            ORDER BY t.created_at DESC
        `).all(id) as any[];

        return NextResponse.json(tickets.map(t => ({
            ...t,
            requesterEmail: t.requester_email,
            statusColor: t.status_color,
            createdAt: t.created_at,
            startedAt: t.started_at,
            resolvedAt: t.resolved_at,
            affectedWorker: t.affected_worker,
            attachmentUrl: t.attachment_url
        })));
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
    }
}

// POST /api/folders/[id]/tickets — add ticket to folder
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const { ticketId } = await request.json();
        if (!ticketId) return NextResponse.json({ error: 'ticketId is required' }, { status: 400 });

        const folder = await db.prepare('SELECT id FROM folders WHERE id = ? AND user_id = ?').get(id, session.user.id);
        if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const ticket = await db.prepare('SELECT id FROM tickets WHERE id = ?').get(ticketId);
        if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

        // Remove from any other folder of this user first (one folder per ticket per user)
        await db.prepare(`
            DELETE FROM ticket_folder WHERE ticket_id = ?
            AND folder_id IN (SELECT id FROM folders WHERE user_id = ?)
        `).run(ticketId, session.user.id);

        await db.prepare('INSERT INTO ticket_folder (ticket_id, folder_id) VALUES (?, ?)').run(ticketId, id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to add ticket to folder' }, { status: 500 });
    }
}

// DELETE /api/folders/[id]/tickets — remove ticket from folder
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const { ticketId } = await request.json();
        if (!ticketId) return NextResponse.json({ error: 'ticketId is required' }, { status: 400 });

        const folder = await db.prepare('SELECT id FROM folders WHERE id = ? AND user_id = ?').get(id, session.user.id);
        if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        await db.prepare('DELETE FROM ticket_folder WHERE ticket_id = ? AND folder_id = ?').run(ticketId, id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to remove ticket from folder' }, { status: 500 });
    }
}
