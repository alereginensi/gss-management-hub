import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/mail';
import db from '@/lib/db';
import webpush from 'web-push';

export async function POST(request: Request) {
    try {
        const { to, subject, body, ticketData } = await request.json();

        if (!to || !subject || !body) {
            return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
        }

        // 1. Try Power Automate Webhook first (Check DB settings then Env)
        const settingsRows = await db.prepare('SELECT * FROM settings WHERE key = ?').get('power_automate_url') as any;
        const powerAutomateUrl = settingsRows?.value || process.env.POWER_AUTOMATE_URL;

        console.log('Attempting notification. Power Automate URL:', powerAutomateUrl ? 'Found' : 'Not found');

        if (powerAutomateUrl) {
            try {
                const payload = {
                    to: Array.isArray(to) ? to.join(', ') : to,
                    subject,
                    description: body,
                    affected_worker: ticketData.affectedWorker,
                    ...ticketData
                };

                console.log('Sending to Power Automate...');
                const response = await fetch(powerAutomateUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    console.log('Power Automate notification success');
                    return NextResponse.json({ success: true, message: 'Notificación enviada vía Power Automate' });
                } else {
                    const errorText = await response.text();
                    console.error('Power Automate returned error:', response.status, errorText);
                }
            } catch (webhookError) {
                console.error('Power Automate fetch exception:', webhookError);
            }
            console.log('Falling back to SMTP due to Power Automate failure/skip');
        }

        // 2. Try Push Notifications (Non-blocking ideally, but we await for reliability)
        const emails = Array.isArray(to) ? to : [to];
        try {
            const subsList = await db.query(
                `SELECT * FROM push_subscriptions WHERE user_email IN (${emails.map(() => '?').join(',')})`,
                emails
            ) as any[];

            if (subsList.length > 0 && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
                webpush.setVapidDetails(
                    process.env.VAPID_SUBJECT || 'mailto:admin@gss.com',
                    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
                    process.env.VAPID_PRIVATE_KEY
                );

                const payload = JSON.stringify({
                    title: subject,
                    body: body,
                    url: ticketData?.id ? `/tickets/${ticketData.id}` : '/'
                });

                const pushPromises = subsList.map(async (sub) => {
                    const pushSubscription = {
                        endpoint: sub.endpoint,
                        keys: {
                            p256dh: sub.p256dh,
                            auth: sub.auth
                        }
                    };
                    try {
                        await webpush.sendNotification(pushSubscription, payload);
                    } catch (pushErr: any) {
                        if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                            console.log('Removing expired push subscription:', sub.id);
                            await db.run('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
                        }
                    }
                });
                await Promise.all(pushPromises);
                console.log(`Push notifications sent to ${subsList.length} devices`);
            }
        } catch (pushError) {
            console.error('Error broadcasting push notifications:', pushError);
        }

        // 2. Fallback to SMTP/Nodemailer
        try {
            const result = await sendEmail({ to, subject, body });

            if (result.success) {
                return NextResponse.json({ success: true, message: 'Notificación enviada vía SMTP' });
            } else {
                console.error('SMTP Error:', result.error);
                // Return success anyway to not block the UI, but log the error
                return NextResponse.json({
                    success: true,
                    warning: 'Ticket creado pero falló el envío de correo',
                    errorDetails: result.error
                });
            }
        } catch (smtpError: any) {
            console.error('SMTP Exception:', smtpError);
            return NextResponse.json({
                success: true,
                warning: 'Ticket creado pero ocurrió un error al enviar correo',
                errorDetails: smtpError.message
            });
        }
    } catch (error) {
        console.error('Notify API error (General):', error);
        // Even on general error, if it's just notification, we might want to return 200 or 202 if possible,
        // but since this is the top-level catch, something went wrong with parsing or logic.
        // We'll return 500 here but ensure we don't crash.
        return NextResponse.json({
            error: 'Error interno en servicio de notificaciones',
            details: (error as Error).message
        }, { status: 500 });
    }
}
