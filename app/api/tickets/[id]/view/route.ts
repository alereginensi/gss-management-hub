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

        // Get ticket info to check if user is the requester
        const ticket = await db.prepare('SELECT requester_email FROM tickets WHERE id = ?').get(ticketId) as { requester_email: string } | undefined;
        
        if (!ticket) {
            return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        }

        // Don't record view for the requester
        if (ticket.requester_email === session.user.email) {
            return NextResponse.json({ success: true, message: 'Requester view not recorded' });
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
