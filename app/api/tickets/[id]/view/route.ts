import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { NextRequest } from 'next/server';

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
        const userId = session.user.id;

        // Get ticket info to check if user is the requester and if they are relevant
        const ticket = await db.prepare('SELECT requester_email, department, supervisor, is_team_ticket FROM tickets WHERE id = ?').get(ticketId) as any;
        
        if (!ticket) {
            return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        }

        // Don't record view for the requester
        if (ticket.requester_email === session.user.email) {
            return NextResponse.json({ success: true, message: 'Requester view not recorded' });
        }

        // CHECK IF USER IS RELEVANT
        const isSupervisor = ticket.supervisor && ticket.supervisor.trim().toLowerCase() === session.user.name.trim().toLowerCase();
        const isInDepartment = ticket.department && ticket.department.split(',').map((d: string) => d.trim().toLowerCase()).includes(session.user.department?.toLowerCase());
        
        const collaboratorRow = await db.prepare('SELECT 1 FROM ticket_collaborators WHERE ticket_id = ? AND user_id = ?').get(ticketId, userId);
        const isCollaborator = !!collaboratorRow;

        let isTeamMember = false;
        if (ticket.is_team_ticket) {
            const teamTaskRow = await db.prepare('SELECT 1 FROM team_ticket_tasks WHERE ticket_id = ? AND user_id = ?').get(ticketId, userId);
            isTeamMember = !!teamTaskRow;
        }

        // Only record if user is actually responsible or involved in the ticket
        if (!isSupervisor && !isInDepartment && !isCollaborator && !isTeamMember) {
            return NextResponse.json({ success: true, message: 'Non-relevant user view not recorded' });
        }

        // Upsert view record
        if (db.type === 'pg') {
            await db.run(`
                INSERT INTO ticket_views (ticket_id, user_id, viewed_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT (ticket_id, user_id) 
                DO UPDATE SET viewed_at = CURRENT_TIMESTAMP
            `, [ticketId, userId]);
        } else {
            await db.run(`
                INSERT INTO ticket_views (ticket_id, user_id, viewed_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT (ticket_id, user_id) 
                DO UPDATE SET viewed_at = CURRENT_TIMESTAMP
            `, [ticketId, userId]);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error recording ticket view:', error);
        return NextResponse.json({ error: 'Failed to record view', details: error.message }, { status: 500 });
    }
}
