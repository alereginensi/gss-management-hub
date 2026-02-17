import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

export async function GET() {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userId = session.user.id;
        const userRole = session.user.role;
        const userEmail = session.user.email;

        let tickets;

        if (userRole === 'admin') {
            // Admins see all tickets
            tickets = db.prepare('SELECT * FROM tickets ORDER BY date DESC').all();
        } else if (userRole === 'supervisor') {
            // Supervisors see tickets assigned to them or where they are collaborators
            const userName = session.user.name;
            tickets = db.prepare(`
                SELECT DISTINCT t.* FROM tickets t
                LEFT JOIN ticket_collaborators tc ON t.id = tc.ticket_id
                WHERE (t.supervisor = ? AND t.supervisor IS NOT NULL)
                   OR tc.user_id = ?
                ORDER BY t.date DESC
            `).all(userName, userId);
        } else {
            // Regular users see tickets they created or where they are collaborators
            tickets = db.prepare(`
                SELECT DISTINCT t.* FROM tickets t
                LEFT JOIN ticket_collaborators tc ON t.id = tc.ticket_id AND tc.user_id = ?
                WHERE t.requesterEmail = ?
                   OR tc.user_id = ?
                ORDER BY t.date DESC
            `).all(userId, userEmail, userId);
        }

        return NextResponse.json(tickets);
    } catch (error: any) {
        console.error('Error fetching tickets:', error);
        return NextResponse.json({ error: 'Failed to fetch tickets', details: error.message }, { status: 500 });
    }
}
