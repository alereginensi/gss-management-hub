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

        // Get ALL notifications for the user (read and unread)
        const notifications = await db.prepare(`
            SELECT * FROM notifications 
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 100
        `).all(userId);

        return NextResponse.json(notifications);
    } catch (error: any) {
        console.error('Error fetching notifications:', error);
        return NextResponse.json({ error: 'Failed to fetch notifications', details: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const session = await getSession(request);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { notificationId, action } = await request.json();

        if (action === 'mark_read') {
            if (!notificationId) {
                return NextResponse.json({ error: 'Notification ID required' }, { status: 400 });
            }
            // For Postgres, very large IDs from Date.now() might still cause issues if not handled as BIGINT
            // Although we migrated to BIGINT, validating it's a number is good practice.
            await db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(notificationId);
            return NextResponse.json({ success: true });
        }

        if (action === 'mark_all_read') {
            await db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(session.user.id);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        console.error('Error updating notifications:', error);
        return NextResponse.json({
            error: 'Failed to update notifications',
            details: error.message,
            code: error.code // Include PG error code if possible
        }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const session = await getSession(request);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const notificationId = searchParams.get('id');
        const deleteAll = searchParams.get('all');

        if (deleteAll === 'true') {
            // Delete all notifications for this user
            await db.prepare('DELETE FROM notifications WHERE user_id = ?').run(session.user.id);
            return NextResponse.json({ success: true, message: 'All notifications deleted' });
        }

        if (!notificationId) {
            return NextResponse.json({ error: 'Notification ID required' }, { status: 400 });
        }

        // Ensure the notification belongs to the current user
        await db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(
            parseInt(notificationId),
            session.user.id
        );
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting notification:', error);
        return NextResponse.json({ error: 'Failed to delete notification', details: error.message }, { status: 500 });
    }
}
