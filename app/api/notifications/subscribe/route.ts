import { NextResponse } from 'next/server';
import webpush from 'web-push';

// Configuration
// Configuration
// webpush.setVapidDetails(
//     process.env.VAPID_SUBJECT || 'mailto:admin@gss.com',
//     process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
//     process.env.VAPID_PRIVATE_KEY!
// );

// In-memory storage for subscriptions (Replace with DB in production)
// Note: In a real app, store this in `tickets.db` (users table or subscriptions table)
// For now, we'll try to store it in a global variable, but it will be lost on restart.
// TODO: Store in SQLite
let subscriptions: any[] = [];

export async function POST(request: Request) {
    const subscription = await request.json();

    // Save subscription
    subscriptions.push(subscription);
    console.log('New Subscription registered:', subscription.endpoint);

    // Send a test notification
    const payload = JSON.stringify({ title: 'GSS Hub', body: 'Subscripción exitosa a notificaciones.' });

    try {
        // Only send if VAPID keys are configured
        if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
            webpush.setVapidDetails(
                process.env.VAPID_SUBJECT || 'mailto:admin@gss.com',
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
