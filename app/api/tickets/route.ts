import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { NextRequest } from 'next/server';
import { sendNotification } from '@/lib/notify';

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
                const views = await db.prepare('SELECT COUNT(*) as count FROM ticket_views WHERE ticket_id = ?').get(ticket.id) as { count: number };
                const teamMembers = await db.prepare('SELECT user_id FROM team_ticket_tasks WHERE ticket_id = ?').all(ticket.id) as { user_id: number }[];
                return {
                    ...ticket,
                    collaboratorIds: collaborators.map(c => c.user_id),
                    teamMemberIds: teamMembers.map(t => t.user_id),
                    isViewedByOthers: (views?.count || 0) > 0,
                    requesterEmail: ticket.requester_email,
                    statusColor: ticket.status_color,
                    createdAt: ticket.created_at,
                    startedAt: ticket.started_at,
                    resolvedAt: ticket.resolved_at,
                    affectedWorker: ticket.affected_worker,
                    attachmentUrl: ticket.attachment_url,
                    isImportant: !!(ticket.is_important),
                    isTeamTicket: !!(ticket.is_team_ticket)
                };
            }));
            return NextResponse.json(tickets);
        }

        // Jefes see all tickets from their department + tickets they are involved in
        if (userRole === 'jefe') {
            const dept = session.user.department || '';
            const rawTickets = await db.prepare(`
                SELECT DISTINCT t.* FROM tickets t
                LEFT JOIN ticket_collaborators tc ON t.id = tc.ticket_id
                LEFT JOIN team_ticket_tasks ttt ON t.id = ttt.ticket_id
                WHERE t.department = ? OR t.department LIKE ? OR t.department LIKE ? OR t.department LIKE ?
                   OR tc.user_id = ?
                   OR ttt.user_id = ?
                   OR t.requester_email = ?
                   OR LOWER(TRIM(t.supervisor)) = LOWER(TRIM(?))
                ORDER BY t.created_at DESC
            `).all(dept, `${dept},%`, `%,${dept}`, `%,${dept},%`, userId, userId, userEmail, session.user.name) as any[];

            const tickets = await Promise.all(rawTickets.map(async (ticket) => {
                const collaborators = await db.prepare('SELECT user_id FROM ticket_collaborators WHERE ticket_id = ?').all(ticket.id) as { user_id: number }[];
                const views = await db.prepare('SELECT COUNT(*) as count FROM ticket_views WHERE ticket_id = ?').get(ticket.id) as { count: number };
                return {
                    ...ticket,
                    collaboratorIds: collaborators.map(c => c.user_id),
                    isViewedByOthers: (views?.count || 0) > 0,
                    requesterEmail: ticket.requester_email,
                    statusColor: ticket.status_color,
                    createdAt: ticket.created_at,
                    startedAt: ticket.started_at,
                    resolvedAt: ticket.resolved_at,
                    affectedWorker: ticket.affected_worker,
                    attachmentUrl: ticket.attachment_url,
                    isImportant: !!(ticket.is_important),
                    isTeamTicket: !!(ticket.is_team_ticket)
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
                const views = await db.prepare('SELECT COUNT(*) as count FROM ticket_views WHERE ticket_id = ?').get(ticket.id) as { count: number };
                return {
                    ...ticket,
                    collaboratorIds: collaborators.map(c => c.user_id),
                    isViewedByOthers: (views?.count || 0) > 0,
                    requesterEmail: ticket.requester_email,
                    statusColor: ticket.status_color,
                    createdAt: ticket.created_at,
                    startedAt: ticket.started_at,
                    resolvedAt: ticket.resolved_at,
                    affectedWorker: ticket.affected_worker,
                    attachmentUrl: ticket.attachment_url,
                    isImportant: !!(ticket.is_important),
                    isTeamTicket: !!(ticket.is_team_ticket)
                };
            }));
            return NextResponse.json(tickets);
        }

        if (departmentsForUser.length > 0) {
            const placeholders = departmentsForUser.map(() => '?').join(', ');
            const rawTickets = await db.prepare(`
                SELECT DISTINCT t.* FROM tickets t
                LEFT JOIN ticket_collaborators tc ON t.id = tc.ticket_id
                LEFT JOIN team_ticket_tasks ttt ON t.id = ttt.ticket_id
                WHERE t.department IN (${placeholders})
                   OR tc.user_id = ?
                   OR ttt.user_id = ?
                   OR t.requester_email = ?
                   OR LOWER(TRIM(t.supervisor)) = LOWER(TRIM(?))
                ORDER BY t.created_at DESC
            `).all(...departmentsForUser, userId, userId, userEmail, session.user.name) as any[];

            const tickets = await Promise.all(rawTickets.map(async (ticket) => {
                const collaborators = await db.prepare('SELECT user_id FROM ticket_collaborators WHERE ticket_id = ?').all(ticket.id) as { user_id: number }[];
                const views = await db.prepare('SELECT COUNT(*) as count FROM ticket_views WHERE ticket_id = ?').get(ticket.id) as { count: number };
                return {
                    ...ticket,
                    collaboratorIds: collaborators.map(c => c.user_id),
                    isViewedByOthers: (views?.count || 0) > 0,
                    requesterEmail: ticket.requester_email,
                    statusColor: ticket.status_color,
                    createdAt: ticket.created_at,
                    startedAt: ticket.started_at,
                    resolvedAt: ticket.resolved_at,
                    affectedWorker: ticket.affected_worker,
                    attachmentUrl: ticket.attachment_url,
                    isImportant: !!(ticket.is_important),
                    isTeamTicket: !!(ticket.is_team_ticket)
                };
            }));

            return NextResponse.json(tickets);
        }

        // Default: user sees only tickets they created, are collaborators on, assigned supervisor, affected worker, or are in team tasks
        const rawTickets = await db.prepare(`
            SELECT DISTINCT t.* FROM tickets t
            LEFT JOIN ticket_collaborators tc ON t.id = tc.ticket_id
            LEFT JOIN team_ticket_tasks ttt ON t.id = ttt.ticket_id
            WHERE t.requester_email = ?
               OR tc.user_id = ?
               OR ttt.user_id = ?
               OR LOWER(TRIM(t.supervisor)) = LOWER(TRIM(?))
               OR (t.affected_worker = ? AND t.affected_worker IS NOT NULL AND t.affected_worker != '')
            ORDER BY t.created_at DESC
        `).all(userEmail, userId, userId, session.user.name, session.user.name) as any[];

        const tickets = await Promise.all(rawTickets.map(async (ticket) => {
            const collaborators = await db.prepare('SELECT user_id FROM ticket_collaborators WHERE ticket_id = ?').all(ticket.id) as { user_id: number }[];
            const views = await db.prepare('SELECT COUNT(*) as count FROM ticket_views WHERE ticket_id = ?').get(ticket.id) as { count: number };
            return {
                ...ticket,
                collaboratorIds: collaborators.map(c => c.user_id),
                isViewedByOthers: views.count > 0,
                requesterEmail: ticket.requester_email,
                statusColor: ticket.status_color,
                createdAt: ticket.created_at,
                startedAt: ticket.started_at,
                resolvedAt: ticket.resolved_at,
                affectedWorker: ticket.affected_worker,
                attachmentUrl: ticket.attachment_url,
                isImportant: !!(ticket.is_important),
                isTeamTicket: !!(ticket.is_team_ticket)
            };
        }));

        return NextResponse.json(tickets);
    } catch (error: any) {
        console.error('Error fetching tickets:', error);
        return NextResponse.json({ error: 'Failed to fetch tickets', details: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const session = await getSession(request);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
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
                const isPg = (db as any).type === 'pg';
                const maxIdQuery = isPg
                    ? "SELECT id FROM tickets WHERE id ~ '^[0-9]+$' ORDER BY id::integer DESC LIMIT 1"
                    : "SELECT id FROM tickets WHERE id GLOB '[0-9]*' ORDER BY CAST(id AS INTEGER) DESC LIMIT 1";

                const maxTicket = await tx.get(maxIdQuery) as { id: string };
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
                supervisor, status_color, attachment_url, created_at, is_team_ticket
            ) VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?
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
                ticket.attachmentUrl || null,
                ticket.createdAt ? new Date(ticket.createdAt).toISOString() : new Date().toISOString(),
                ticket.isTeamTicket ? 1 : 0
            );
        } catch (insertError: any) {
            console.error('Database Insertion Error:', insertError);
            return NextResponse.json({
                error: 'Database error during ticket creation',
                details: insertError.message
            }, { status: 500 });
        }

        // Insert team tasks if this is a team ticket
        if (ticket.isTeamTicket && Array.isArray(ticket.teamTasks) && ticket.teamTasks.length > 0) {
            for (const task of ticket.teamTasks) {
                await db.run(
                    'INSERT INTO team_ticket_tasks (ticket_id, user_id, user_name, task_description) VALUES (?, ?, ?, ?)',
                    [newId, task.userId, task.userName, task.task]
                );
            }
        }

        // Insert collaborators if provided and notify each one
        if (Array.isArray(ticket.collaboratorIds) && ticket.collaboratorIds.length > 0) {
            const currentUserId = session.user.id;
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}`;
            for (const collabId of ticket.collaboratorIds) {
                await db.run(
                    'INSERT INTO ticket_collaborators (ticket_id, user_id, added_by) VALUES (?, ?, ?)',
                    [newId, collabId, currentUserId]
                );
                // In-app notification
                const collabUser = await db.get('SELECT id, name, email FROM users WHERE id = ?', [collabId]) as { id: number; name: string; email: string } | null;
                if (collabUser) {
                    const notifMessage = `Has sido agregado como colaborador al ticket: ${ticket.subject}`;
                    await db.run(
                        `INSERT INTO notifications (user_id, ticket_id, ticket_subject, message, type, status_color) VALUES (?, ?, ?, ?, 'info', ?)`,
                        [collabUser.id, newId, ticket.subject, notifMessage, ticket.status_color || null]
                    );
                    if (collabUser.email) {
                        const emailSubject = `Fuiste agregado como colaborador: ${ticket.subject}`;
                        const ticketUrl = `${baseUrl}/tickets/${newId}`;
                        const emailBody = `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <h2 style="color: #2563eb; margin-bottom: 10px;">🤝 Fuiste agregado como colaborador</h2>
  <p>Has sido agregado como colaborador a la siguiente solicitud:</p>
  <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; border-left: 4px solid #2563eb;">
    <ul style="list-style: none; padding: 0; margin: 0;">
      <li><strong>📌 Asunto:</strong> ${ticket.subject}</li>
      <li><strong>👤 Colaborador:</strong> ${collabUser.name}</li>
    </ul>
  </div>
  <p style="margin-top: 20px;">
    Puedes ver el ticket en: <a href="${ticketUrl}" style="color: #2563eb;">${ticketUrl}</a>
  </p>
  <p style="margin-top: 10px; font-style: italic; color: #6b7280; font-size: 0.9em;">
    Por favor, ingrese al portal administrativo para gestionar esta solicitud.
  </p>
</div>`.trim();
                        sendNotification({
                            to: collabUser.email,
                            subject: emailSubject,
                            body: emailBody,
                            ticketData: { id: newId, requesterEmail: collabUser.email },
                        }).catch(err => console.error('Collaborator creation notification failed:', err));
                    }
                }
            }
        }

        return NextResponse.json({ success: true, id: newId, message: 'Ticket created successfully' }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating ticket:', error);
        return NextResponse.json({ error: 'Failed to create ticket', details: error.message }, { status: 500 });
    }
}
