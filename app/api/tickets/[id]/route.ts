import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { NextRequest } from 'next/server';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession(request);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id: ticketId } = await params;
        const userId = session.user.id;
        const userRole = session.user.role;
        const userEmail = session.user.email;

        const ticket = await db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as any;
        if (!ticket) {
            return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        }

        // Permission check
        const isAdmin = userRole === 'admin';
        const isJefe = userRole === 'jefe' && ticket.department === session.user.department;
        const isRequester = ticket.requester_email === userEmail;
        const isSupervisorField = ticket.supervisor === session.user.name;

        const collaboratorRow = await db.prepare('SELECT 1 FROM ticket_collaborators WHERE ticket_id = ? AND user_id = ?').get(ticketId, userId) as any;
        const isCollaborator = !!collaboratorRow;

        const teamTaskRow = await db.prepare('SELECT 1 FROM team_ticket_tasks WHERE ticket_id = ? AND user_id = ?').get(ticketId, userId) as any;
        const isTeamMember = !!teamTaskRow;

        if (!isAdmin && !isJefe && !isRequester && !isSupervisorField && !isCollaborator && !isTeamMember) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const collaborators = await db.prepare('SELECT user_id FROM ticket_collaborators WHERE ticket_id = ?').all(ticketId) as { user_id: number }[];

        return NextResponse.json({
            ...ticket,
            collaboratorIds: collaborators.map(c => c.user_id),
            requesterEmail: ticket.requester_email,
            statusColor: ticket.status_color,
            createdAt: ticket.created_at,
            startedAt: ticket.started_at,
            resolvedAt: ticket.resolved_at,
            affectedWorker: ticket.affected_worker,
            attachmentUrl: ticket.attachment_url,
            isImportant: !!(ticket.is_important),
            isTeamTicket: !!(ticket.is_team_ticket)
        });
    } catch (error: any) {
        console.error('Error fetching ticket:', error);
        return NextResponse.json({ error: 'Failed to fetch ticket', details: error.message }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession(request);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role;

    try {
        const { id: ticketId } = await params;
        const body = await request.json();
        const { status, is_important } = body;

        // Handle marking as important (admin/supervisor only)
        if (is_important !== undefined) {
            if (userRole !== 'admin' && userRole !== 'supervisor') {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
            const ticket = await db.prepare('SELECT id FROM tickets WHERE id = ?').get(ticketId);
            if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
            await db.prepare('UPDATE tickets SET is_important = ? WHERE id = ?').run(is_important ? 1 : 0, ticketId);
            return NextResponse.json({ success: true, isImportant: !!is_important, ticketId });
        }

        // Handle status change (admin, jefe, supervisor, funcionario)
        if (userRole !== 'admin' && userRole !== 'jefe' && userRole !== 'supervisor' && userRole !== 'funcionario') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!status || !['Nuevo', 'En Progreso', 'Resuelto'].includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }

        const ticket = await db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as any;
        if (!ticket) {
            return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        }

        const now = new Date().toISOString();
        const statusColors: Record<string, string> = {
            'Nuevo': 'var(--status-new)',
            'En Progreso': 'var(--status-progress)',
            'Resuelto': 'var(--status-resolved)'
        };

        let updateQuery = 'UPDATE tickets SET status = ?, status_color = ?';
        const updateParams: any[] = [status, statusColors[status]];

        if (status === 'En Progreso' && !ticket.started_at) {
            updateQuery += ', started_at = ?';
            updateParams.push(now);
        } else if (status === 'Resuelto' && !ticket.resolved_at) {
            updateQuery += ', resolved_at = ?';
            updateParams.push(now);
        }

        updateQuery += ' WHERE id = ?';
        updateParams.push(ticketId);

        await db.prepare(updateQuery).run(...updateParams);

        return NextResponse.json({ success: true, status, ticketId });
    } catch (error: any) {
        console.error('Error updating ticket:', error);
        return NextResponse.json({ error: 'Failed to update ticket', details: error.message }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession(request);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admins and jefes can delete tickets
    if (session.user.role !== 'admin' && session.user.role !== 'jefe') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { id: ticketId } = await params;

        // Verify ticket exists
        const ticket = await db.prepare('SELECT id FROM tickets WHERE id = ?').get(ticketId);
        if (!ticket) {
            return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        }

        // Delete ticket and all its references in a transaction
        await db.transaction(async (tx) => {
            await tx.run('DELETE FROM ticket_activities WHERE ticket_id = ?', [ticketId]);
            await tx.run('DELETE FROM ticket_collaborators WHERE ticket_id = ?', [ticketId]);
            await tx.run('DELETE FROM notifications WHERE ticket_id = ?', [ticketId]);
            await tx.run('DELETE FROM tickets WHERE id = ?', [ticketId]);
        });

        return NextResponse.json({ success: true, message: 'Ticket deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting ticket:', error);
        return NextResponse.json({ error: 'Failed to delete ticket', details: error.message }, { status: 500 });
    }
}
