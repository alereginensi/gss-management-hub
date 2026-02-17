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

        // Get unread notifications for the user
        const notifications = db.prepare(`
            SELECT * FROM notifications 
            WHERE user_id = ? AND read = 0
            ORDER BY created_at DESC
            LIMIT 50
        `).all(userId);

        return NextResponse.json(notifications);
    } catch (error: any) {
        console.error('Error fetching notifications:', error);
        return NextResponse.json({ error: 'Failed to fetch notifications', details: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { notificationId, action } = await request.json();

        if (action === 'mark_read') {
            db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(notificationId);
            return NextResponse.json({ success: true });
        }

        if (action === 'mark_all_read') {
            db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(session.user.id);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        console.error('Error updating notifications:', error);
        return NextResponse.json({ error: 'Failed to update notifications', details: error.message }, { status: 500 });
    }
}
