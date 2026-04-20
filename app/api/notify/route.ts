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

        const results: any = { powerAutomate: null, push: null, smtp: null };

        // 1. Try Power Automate Webhook first
        const settingsRow = await db.prepare('SELECT value FROM settings WHERE key = ?').get('power_automate_url') as any;
        const powerAutomateUrl = (settingsRow?.value || process.env.POWER_AUTOMATE_URL || "").trim();

        if (powerAutomateUrl && powerAutomateUrl.startsWith('http')) {
            try {
                // Ensure the full email body (body) is transmitted and not overwritten by ticketData.description
                const {
                    description: ticketDesc,
                    deptEmails,
                    supervisorEmail,
                    requesterEmail,
                    affectedWorker,
                    ...otherTicketData
                } = ticketData || {};

                // Consolidate all unique emails into a single string separated by semicolons
                const rawEmails = [
                    ...(Array.isArray(to) ? to : [to]),
                    deptEmails,
                    supervisorEmail,
                    requesterEmail
                ];

                const consolidatedEmails = Array.from(new Set(
                    rawEmails
                        .filter(Boolean)
                        .flatMap(e => {
                            if (Array.isArray(e)) return e;
                            return (e as string).split(/[;,]/);
                        })
                        .map(e => e.trim())
                        .filter(e => e.length > 0)
                )).join('; ');

                const payload = {
                    to: consolidatedEmails,
                    all_recipients: consolidatedEmails,
                    subject,
                    body,
                    description: body,
                    ticket_description: ticketDesc || "",
                    dept_emails: deptEmails || "",
                    supervisor_email: supervisorEmail || "",
                    requester_email: requesterEmail || "",
                    affected_worker: affectedWorker || "",
                    ...otherTicketData
                };

                console.log('📤 Sending to Power Automate. Payload:', JSON.stringify(payload, null, 2));
                const response = await fetch(powerAutomateUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    console.log('✅ Power Automate notification success');
                    results.powerAutomate = { success: true };
                } else {
                    const errorText = await response.text();
                    console.error('❌ Power Automate returned error:', response.status, errorText);
                    results.powerAutomate = { success: false, status: response.status, error: errorText };
                }
            } catch (webhookError: any) {
                console.error('❌ Power Automate fetch exception:', webhookError);
                results.powerAutomate = { success: false, error: webhookError.message };
            }
        }

        // 2. Try Push Notifications (Always attempt)
        const emails = Array.from(new Set([
            ...(Array.isArray(to) ? to : [to]),
            ticketData?.supervisorEmail,
            ticketData?.requesterEmail
        ])).filter(Boolean) as string[];

        try {
            const subsList = await db.query(
                `SELECT * FROM push_subscriptions WHERE user_email IN (${emails.map(() => '?').join(',')})`,
                emails
            ) as any[];

            if (subsList.length > 0 && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
                webpush.setVapidDetails(
                    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
                    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
                    process.env.VAPID_PRIVATE_KEY
                );

                // Strip HTML tags for Push Notifications (Browser notifications handle plain text)
                const stripHtml = (html: string) => {
                    return html.replace(/<[^>]*>?/gm, '') // Remove tags
                        .replace(/&nbsp;/g, ' ')  // Replace entities
                        .replace(/\s+/g, ' ')     // Collapse whitespace
                        .trim();
                };

                const pushPayload = JSON.stringify({
                    title: subject,
                    body: stripHtml(body),
                    url: ticketData?.id ? `/tickets/${ticketData.id}` : '/'
                });

                const pushPromises = subsList.map(async (sub) => {
                    const pushSubscription = {
                        endpoint: sub.endpoint,
                        keys: { p256dh: sub.p256dh, auth: sub.auth }
                    };
                    try {
                        await webpush.sendNotification(pushSubscription, pushPayload);
                    } catch (pushErr: any) {
                        if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                            await db.run('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
                        }
                    }
                });
                await Promise.all(pushPromises);
                console.log(`✅ Push notifications sent to ${subsList.length} devices`);
                results.push = { success: true, count: subsList.length };
            }
        } catch (pushError: any) {
            console.error('Error broadcasting push notifications:', pushError);
            results.push = { success: false, error: pushError.message };
        }

        // 3. Fallback to SMTP only if Power Automate was NOT used or failed
        if (!results.powerAutomate?.success) {
            try {
                console.log('Attempting SMTP delivery to:', to);
                const result = await sendEmail({ to, subject, body });
                if (result.success) {
                    console.log('✅ SMTP notification success');
                    results.smtp = { success: true };
                } else {
                    console.error('❌ SMTP Error:', result.error);
                    results.smtp = { success: false, error: result.error };
                }
            } catch (smtpError: any) {
                console.error('❌ SMTP Exception:', smtpError);
                results.smtp = { success: false, error: smtpError.message };
            }
        }

        return NextResponse.json({
            success: results.powerAutomate?.success || results.smtp?.success || results.push?.success,
            details: results
        });
    } catch (error: any) {
        console.error('Notify API error (General):', error);
        return NextResponse.json({
            error: 'Error interno en servicio de notificaciones',
            details: error.message
        }, { status: 500 });
    }
}
