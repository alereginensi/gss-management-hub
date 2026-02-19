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

        if (!db) {
            console.error('Database instance is null');
            return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        }

        let tickets;

        if (userRole === 'admin') {
            // Admins see all tickets
            tickets = db.prepare('SELECT * FROM tickets ORDER BY date DESC').all();
        } else if (userRole === 'supervisor') {
            // Supervisors see tickets:
            // 1. Where they are assigned as supervisor (by name)
            // 2. Where they are a collaborator
            // 3. Where they are the requester (created by them)
            const userName = session.user.name;
            const userEmail = session.user.email;

            tickets = db.prepare(`
                SELECT DISTINCT t.* FROM tickets t
                LEFT JOIN ticket_collaborators tc ON t.id = tc.ticket_id
                WHERE (t.supervisor = ? AND t.supervisor IS NOT NULL AND t.supervisor != '')
                   OR tc.user_id = ?
                   OR t.requesterEmail = ?
                ORDER BY t.date DESC
            `).all(userName, userId, userEmail);
        } else {
            // Funcionarios and regular users see only tickets they created or are collaborators of
            const userEmail = session.user.email;
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

export async function POST(request: Request) {
    try {
        const ticket = await request.json();

        // Validate required fields
        if (!ticket.id || !ticket.subject || !ticket.priority || !ticket.status) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const stmt = db.prepare(`
            INSERT INTO tickets (
                id, subject, description, department, priority, status,
                requester, requesterEmail, affected_worker, date,
                supervisor, statusColor, createdAt
            ) VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?
            )
        `);

        try {
            stmt.run(
                ticket.id,
                ticket.subject,
                ticket.description || '',
                ticket.department || 'General',
                ticket.priority,
                ticket.status,
                ticket.requester,
                ticket.requesterEmail,
                ticket.affectedWorker || null,
                ticket.date,
                ticket.supervisor || null,
                ticket.statusColor || null,
                ticket.createdAt ? new Date(ticket.createdAt).toISOString() : new Date().toISOString()
            );
        } catch (insertError: any) {
            console.error('Database Insertion Error:', insertError);
            return NextResponse.json({
                error: 'Database error during ticket creation',
                details: insertError.message,
                sql: stmt.source
            }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Ticket created successfully' }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating ticket:', error);
        return NextResponse.json({ error: 'Failed to create ticket', details: error.message }, { status: 500 });
    }
}
