import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { NextRequest } from 'next/server';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: ticketId } = await params;
    const tasks = await db.query(
        'SELECT * FROM team_ticket_tasks WHERE ticket_id = ? ORDER BY id ASC',
        [ticketId]
    );
    return NextResponse.json(tasks);
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: ticketId } = await params;
    const { taskId } = await request.json();

    // Verify task belongs to this ticket
    const task = await db.get(
        'SELECT * FROM team_ticket_tasks WHERE id = ? AND ticket_id = ?',
        [taskId, ticketId]
    );
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    // Only the task owner can mark it complete
    if (Number(task.user_id) !== Number(session.user.id)) {
        return NextResponse.json({ error: 'Forbidden: solo podés marcar tu propia tarea' }, { status: 403 });
    }

    const now = new Date().toISOString();
    await db.run(
        'UPDATE team_ticket_tasks SET completed = 1, completed_at = ? WHERE id = ?',
        [now, taskId]
    );

    // Log activity
    await db.run(
        'INSERT INTO ticket_activities (ticket_id, user_name, user_email, message, type) VALUES (?, ?, ?, ?, ?)',
        [ticketId, session.user.name, session.user.email, `${session.user.name} completó su tarea`, 'status']
    );

    // Check if all tasks are now complete
    const allTasks = await db.query(
        'SELECT completed FROM team_ticket_tasks WHERE ticket_id = ?',
        [ticketId]
    );
    const allDone = allTasks.every((t: any) => t.completed === 1 || t.completed === true);

    if (allDone) {
        await db.run(
            'UPDATE tickets SET status = ?, status_color = ?, resolved_at = ? WHERE id = ?',
            ['Resuelto', 'var(--status-resolved)', now, ticketId]
        );
    }

    return NextResponse.json({ success: true, allDone });
}
