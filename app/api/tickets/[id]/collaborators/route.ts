import { NextResponse } from 'next/server';
import db from '@/lib/db';

// GET /api/tickets/[id]/collaborators - Get all collaborators for a ticket
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: ticketId } = await params;

        const collaborators = await db.prepare(`
            SELECT 
                tc.id,
                tc.user_id,
                tc.added_at,
                u.name,
                u.email,
                u.role,
                added_by_user.name as added_by_name
            FROM ticket_collaborators tc
            JOIN users u ON tc.user_id = u.id
            JOIN users added_by_user ON tc.added_by = added_by_user.id
            WHERE tc.ticket_id = ?
            ORDER BY tc.added_at DESC
        `).all(ticketId);

        return NextResponse.json(collaborators);
    } catch (error: any) {
        console.error('Error fetching collaborators:', error);
        return NextResponse.json({ error: 'Failed to fetch collaborators', details: error.message }, { status: 500 });
    }
}

// POST /api/tickets/[id]/collaborators - Add a collaborator to a ticket
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: ticketId } = await params;
        const { userId, addedBy } = await request.json();

        if (!userId || !addedBy) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Verify user exists
        const user = await db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId) as { id: number; name: string; email: string } | undefined;
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Verify ticket exists
        const ticket = await db.prepare('SELECT id FROM tickets WHERE id = ?').get(ticketId);
        if (!ticket) {
            return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        }

        // Check if already a collaborator
        const existing = await db.prepare('SELECT id FROM ticket_collaborators WHERE ticket_id = ? AND user_id = ?').get(ticketId, userId);
        if (existing) {
            return NextResponse.json({ error: 'User is already a collaborator' }, { status: 400 });
        }

        // Add collaborator
        const result = await db.prepare(`
            INSERT INTO ticket_collaborators (ticket_id, user_id, added_by)
            VALUES (?, ?, ?)
        `).run(ticketId, userId, addedBy);

        return NextResponse.json({
            success: true,
            message: `${user.name} added as collaborator`,
            collaboratorId: result.lastInsertRowid
        });
    } catch (error: any) {
        console.error('Error adding collaborator:', error);
        return NextResponse.json({ error: 'Failed to add collaborator', details: error.message }, { status: 500 });
    }
}

// DELETE /api/tickets/[id]/collaborators - Remove a collaborator from a ticket
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: ticketId } = await params;
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
        }

        // Remove collaborator
        const result = await db.prepare('DELETE FROM ticket_collaborators WHERE ticket_id = ? AND user_id = ?').run(ticketId, userId);

        if (result.changes === 0) {
            return NextResponse.json({ error: 'Collaborator not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: 'Collaborator removed'
        });
    } catch (error: any) {
        console.error('Error removing collaborator:', error);
        return NextResponse.json({ error: 'Failed to remove collaborator', details: error.message }, { status: 500 });
    }
}
