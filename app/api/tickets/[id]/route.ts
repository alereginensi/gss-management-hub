import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { NextRequest } from 'next/server';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession(request);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only supervisors and admins can change ticket status
    const userRole = session.user.role;
    if (userRole !== 'admin' && userRole !== 'supervisor' && userRole !== 'funcionario') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { id: ticketId } = await params;
        const body = await request.json();
        const { status } = body;

        if (!status || !['Nuevo', 'En Progreso', 'Resuelto'].includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }

        // Verify ticket exists
        const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as any;
        if (!ticket) {
            return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        }

        const now = new Date().toISOString();
        const statusColors: Record<string, string> = {
            'Nuevo': 'var(--status-new)',
            'En Progreso': 'var(--status-progress)',
            'Resuelto': 'var(--status-resolved)'
        };

        // Build dynamic update query based on new status
        let updateQuery = 'UPDATE tickets SET status = ?, statusColor = ?';
        const updateParams: any[] = [status, statusColors[status]];

        if (status === 'En Progreso' && !ticket.startedAt) {
            updateQuery += ', startedAt = ?';
            updateParams.push(now);
        } else if (status === 'Resuelto' && !ticket.resolvedAt) {
            updateQuery += ', resolvedAt = ?';
            updateParams.push(now);
        }

        updateQuery += ' WHERE id = ?';
        updateParams.push(ticketId);

        db.prepare(updateQuery).run(...updateParams);

        return NextResponse.json({ success: true, status, ticketId });
    } catch (error: any) {
        console.error('Error updating ticket status:', error);
        return NextResponse.json({ error: 'Failed to update ticket status', details: error.message }, { status: 500 });
    }
}
