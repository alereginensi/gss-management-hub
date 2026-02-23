import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: ticketId } = await params;
        const { newSupervisorId, transferredBy, reason } = await request.json();

        if (!newSupervisorId || !transferredBy) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Verify the new supervisor exists
        const newSupervisor = await db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(newSupervisorId) as { id: number; name: string; email: string } | undefined;
        if (!newSupervisor) {
            return NextResponse.json({ error: 'Supervisor not found' }, { status: 404 });
        }

        // Get current ticket info
        const ticket = await db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
        if (!ticket) {
            return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        }

        // Update ticket supervisor
        await db.prepare('UPDATE tickets SET supervisor = ? WHERE id = ?').run(newSupervisor.name, ticketId);

        // Create notification for the new supervisor
        try {
            await db.prepare(`
                INSERT INTO notifications (user_id, ticket_id, message, type, created_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).run(
                newSupervisorId,
                ticketId,
                `Se te ha asignado el ticket: ${(ticket as any).subject}`,
                'ticket_assigned'
            );
        } catch (notifError) {
            console.error('Error creating notification:', notifError);
            // Don't fail the transfer if notification fails
        }

        return NextResponse.json({
            success: true,
            message: `Ticket transferred to ${newSupervisor.name}`,
            newSupervisor: newSupervisor.name
        });
    } catch (error: any) {
        console.error('Error transferring ticket:', error);
        return NextResponse.json({ error: 'Failed to transfer ticket', details: error.message }, { status: 500 });
    }
}
