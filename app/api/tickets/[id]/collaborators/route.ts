import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { NextRequest } from 'next/server';
import { sendNotification } from '@/lib/notify';

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
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession(request);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
        const ticket = await db.prepare('SELECT id, subject, status_color FROM tickets WHERE id = ?').get(ticketId) as { id: string; subject: string; status_color: string } | undefined;
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

        // Insert in-app notification for the collaborator
        const notifMessage = `Has sido agregado como colaborador al ticket: ${ticket.subject}`;
        await db.prepare(`
            INSERT INTO notifications (user_id, ticket_id, ticket_subject, message, type, status_color)
            VALUES (?, ?, ?, ?, 'info', ?)
        `).run(user.id, ticketId, ticket.subject, notifMessage, ticket.status_color || null);

        // Send email + push notification via shared helper
        if (user.email) {
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}`;
            const emailSubject = `Fuiste agregado como colaborador: ${ticket.subject}`;
            const emailBody = `<p>Hola ${user.name},</p><p>Has sido agregado como colaborador al ticket <strong>${ticket.subject}</strong>.</p><p>Puedes ver el ticket en: <a href="${baseUrl}/tickets/${ticketId}">${baseUrl}/tickets/${ticketId}</a></p>`;
            sendNotification({
                to: user.email,
                subject: emailSubject,
                body: emailBody,
                ticketData: { id: ticketId, requesterEmail: user.email },
            }).catch(err => console.error('Collaborator notification failed:', err));
        } else {
            console.warn(`Collaborator user ${user.id} (${user.name}) has no email — skipping notification`);
        }

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
