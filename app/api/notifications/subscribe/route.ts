import { NextResponse } from 'next/server';
import webpush from 'web-push';

// Configuration
// Configuration
// webpush.setVapidDetails(
//     process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
//     process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
//     process.env.VAPID_PRIVATE_KEY!
// );

import db from '@/lib/db';

// VAPID details will be set during individual notification sends if keys are present

export async function POST(request: Request) {
    const { subscription, email } = await request.json();

    if (!subscription || !subscription.endpoint) {
        return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    // Save subscription to DB
    try {
        const query = db.type === 'pg'
            ? 'INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_email) VALUES (?, ?, ?, ?) ON CONFLICT (endpoint) DO NOTHING'
            : 'INSERT OR IGNORE INTO push_subscriptions (endpoint, p256dh, auth, user_email) VALUES (?, ?, ?, ?)';

        await db.run(
            query,
            [
                subscription.endpoint,
                subscription.keys?.p256dh || '',
                subscription.keys?.auth || '',
                email || null
            ]
        );
        console.log('New Subscription registered in DB:', subscription.endpoint);
    } catch (dbError) {
        console.error('Error saving subscription to DB:', dbError);
    }

    // Send a test notification
    const payload = JSON.stringify({ title: 'GSS Hub', body: 'Subscripción exitosa a notificaciones.' });

    try {
        // Only send if VAPID keys are configured
        if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
            webpush.setVapidDetails(
                process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
                process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
                process.env.VAPID_PRIVATE_KEY
            );
            await webpush.sendNotification(subscription, payload);
            return NextResponse.json({ success: true, message: 'Subscribed successfully' });
        } else {
            console.log('Push notifications disabled: keys not configured');
            return NextResponse.json({ success: true, message: 'Push notifications disabled' });
        }
    } catch (error) {
        console.error('Error sending test notification', error);
        // Don't fail the request if push fails
        return NextResponse.json({ success: false, error: 'Failed to subscribe' }, { status: 200 });
    }
}
