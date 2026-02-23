import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const session = await getSession(request);
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

        // Admins see all tickets
        if (userRole === 'admin') {
            const rawTickets = await db.prepare('SELECT * FROM tickets ORDER BY created_at DESC').all() as any[];
            const tickets = await Promise.all(rawTickets.map(async (ticket) => {
                const collaborators = await db.prepare('SELECT user_id FROM ticket_collaborators WHERE ticket_id = ?').all(ticket.id) as { user_id: number }[];
                return {
                    ...ticket,
                    collaboratorIds: collaborators.map(c => c.user_id),
                    statusColor: ticket.status_color,
                    createdAt: ticket.created_at,
                    startedAt: ticket.started_at,
                    resolvedAt: ticket.resolved_at,
                    affectedWorker: ticket.affected_worker
                };
            }));
            return NextResponse.json(tickets);
        }

        // Check if this user's email is in any department notification settings
        const allSettings = await db.prepare('SELECT key, value FROM settings WHERE key LIKE ?').all('notification_emails%') as { key: string; value: string }[];

        const departmentsForUser: string[] = [];
        let hasGlobalAccess = false;

        for (const row of allSettings) {
            const emails = row.value.split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean);
            if (!emails.includes(userEmail.toLowerCase())) continue;

            if (row.key === 'notification_emails') {
                hasGlobalAccess = true;
                break;
            } else {
                const deptRaw = row.key.replace('notification_emails_', '');
                const dept = deptRaw.replace(/_/g, ' ');
                departmentsForUser.push(dept);
                if (deptRaw !== dept) departmentsForUser.push(deptRaw);
            }
        }

        if (hasGlobalAccess) {
            const rawTickets = await db.prepare('SELECT * FROM tickets ORDER BY created_at DESC').all() as any[];
            const tickets = await Promise.all(rawTickets.map(async (ticket) => {
                const collaborators = await db.prepare('SELECT user_id FROM ticket_collaborators WHERE ticket_id = ?').all(ticket.id) as { user_id: number }[];
                return {
                    ...ticket,
                    collaboratorIds: collaborators.map(c => c.user_id),
                    statusColor: ticket.status_color,
                    createdAt: ticket.created_at,
                    startedAt: ticket.started_at,
                    resolvedAt: ticket.resolved_at,
                    affectedWorker: ticket.affected_worker
                };
            }));
            return NextResponse.json(tickets);
        }

        if (departmentsForUser.length > 0) {
            const placeholders = departmentsForUser.map(() => '?').join(', ');
            const tickets = await db.prepare(`
                SELECT DISTINCT t.* FROM tickets t
                LEFT JOIN ticket_collaborators tc ON t.id = tc.ticket_id
                WHERE t.department IN (${placeholders})
                   OR tc.user_id = ?
                   OR t.requester_email = ?
                   OR (t.supervisor = ? AND t.supervisor IS NOT NULL AND t.supervisor != '')
                ORDER BY t.created_at DESC
            `).all(...departmentsForUser, userId, userEmail, session.user.name);

            // Map snake_case to camelCase
            const mappedTickets = tickets.map((t: any) => ({
                ...t,
                requesterEmail: t.requester_email,
                statusColor: t.status_color,
                createdAt: t.created_at,
                startedAt: t.started_at,
                resolvedAt: t.resolved_at,
                affectedWorker: t.affected_worker
            }));

            return NextResponse.json(mappedTickets);
        }

        // Default: user sees only tickets they created, are collaborators on, or are assigned supervisor
        const rawTickets = await db.prepare(`
            SELECT DISTINCT t.* FROM tickets t
            LEFT JOIN ticket_collaborators tc ON t.id = tc.ticket_id
            WHERE t.requester_email = ?
               OR tc.user_id = ?
               OR (t.supervisor = ? AND t.supervisor IS NOT NULL AND t.supervisor != '')
            ORDER BY t.created_at DESC
        `).all(userEmail, userId, session.user.name) as any[];

        const tickets = await Promise.all(rawTickets.map(async (ticket) => {
            const collaborators = await db.prepare('SELECT user_id FROM ticket_collaborators WHERE ticket_id = ?').all(ticket.id) as { user_id: number }[];
            return {
                ...ticket,
                collaboratorIds: collaborators.map(c => c.user_id),
                requesterEmail: ticket.requester_email,
                statusColor: ticket.status_color,
                createdAt: ticket.created_at,
                startedAt: ticket.started_at,
                resolvedAt: ticket.resolved_at,
                affectedWorker: ticket.affected_worker
            };
        }));

        return NextResponse.json(tickets);
    } catch (error: any) {
        console.error('Error fetching tickets:', error);
        return NextResponse.json({ error: 'Failed to fetch tickets', details: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const ticket = await request.json();

        // Validate required fields (id is now generated server-side)
        if (!ticket.subject || !ticket.priority || !ticket.status) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Generate ID using a transaction and the counters table
        let newId = '';
        await db.transaction(async (tx) => {
            // Check if counter exists
            let counter = await tx.get("SELECT value FROM counters WHERE key = 'ticket_id'") as { value: number };

            if (!counter) {
                // Try to initialize from existing tickets max ID or default to 1000
                const maxTicket = await tx.get("SELECT id FROM tickets WHERE id ~ '^[0-9]+$' ORDER BY id::integer DESC LIMIT 1") as { id: string };
                const startVal = maxTicket ? parseInt(maxTicket.id) + 1 : 1000;
                await tx.run("INSERT INTO counters (key, value) VALUES ('ticket_id', ?)", [startVal]);
                newId = startVal.toString();
            } else {
                // Increment counter
                await tx.run("UPDATE counters SET value = value + 1 WHERE key = 'ticket_id'");
                // Get new value
                const updatedCounter = await tx.get("SELECT value FROM counters WHERE key = 'ticket_id'") as { value: number };
                newId = updatedCounter.value.toString();
            }
        });

        const stmt = db.prepare(`
            INSERT INTO tickets (
                id, subject, description, department, priority, status,
                requester, requester_email, affected_worker, date,
                supervisor, status_color, created_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?
            )
        `);

        try {
            await stmt.run(
                newId,
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
                details: insertError.message
            }, { status: 500 });
        }

        return NextResponse.json({ success: true, id: newId, message: 'Ticket created successfully' }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating ticket:', error);
        return NextResponse.json({ error: 'Failed to create ticket', details: error.message }, { status: 500 });
    }
}
