import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await params;
        const activities = db.prepare('SELECT * FROM ticket_activities WHERE ticket_id = ? ORDER BY created_at DESC').all(id);

        // Map to frontend model
        const mappedActivities = activities.map((a: any) => ({
            id: a.id.toString(),
            ticketId: a.ticket_id,
            user: a.user_name,
            message: a.message,
            timestamp: new Date(a.created_at)
        }));

        return NextResponse.json(mappedActivities);
    } catch (error: any) {
        console.error('Error fetching activities:', error);
        return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await params;
        const { message, type } = await request.json();

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        const stmt = db.prepare('INSERT INTO ticket_activities (ticket_id, user_name, user_email, message, type) VALUES (?, ?, ?, ?, ?)');
        const result = stmt.run(
            id,
            session.user.name,
            session.user.email,
            message,
            type || 'comment'
        );

        return NextResponse.json({
            success: true,
            id: result.lastInsertRowid
        }, { status: 201 });

    } catch (error: any) {
        console.error('Error creating activity:', error);
        return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 });
    }
}
