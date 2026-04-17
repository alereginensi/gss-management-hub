import { sendEmail } from '@/lib/mail';
import db from '@/lib/db';

export interface NotifyOptions {
    to: string | string[];
    subject: string;
    body: string;
    ticketData?: {
        id?: string;
        requester?: string;
        requesterEmail?: string;
        supervisorEmail?: string;
        deptEmails?: string;
        affectedWorker?: string;
        description?: string;
        [key: string]: any;
    };
}

export async function sendNotification({ to, subject, body, ticketData }: NotifyOptions): Promise<void> {
    const results: any = { powerAutomate: null, push: null, smtp: null };

    // 1. Try Power Automate
    try {
        const settingsRow = await db.prepare('SELECT value FROM settings WHERE key = ?').get('power_automate_url') as any;
        const powerAutomateUrl = (settingsRow?.value || process.env.POWER_AUTOMATE_URL || '').trim();

        if (powerAutomateUrl && powerAutomateUrl.startsWith('http')) {
            const {
                description: ticketDesc,
                deptEmails,
                supervisorEmail,
                requesterEmail,
                affectedWorker,
                ...otherTicketData
            } = ticketData || {};

            const rawEmails = [
                ...(Array.isArray(to) ? to : [to]),
                deptEmails,
                supervisorEmail,
                requesterEmail,
            ];

            const consolidatedEmails = Array.from(new Set(
                rawEmails
                    .filter(Boolean)
                    .flatMap(e => (Array.isArray(e) ? e : (e as string).split(/[;,]/)))
                    .map(e => e.trim())
                    .filter(e => e.length > 0)
            )).join('; ');

            const payload = {
                to: consolidatedEmails,
                all_recipients: consolidatedEmails,
                subject,
                body,
                description: body,
                ticket_description: ticketDesc || '',
                dept_emails: deptEmails || '',
                supervisor_email: supervisorEmail || '',
                requester_email: requesterEmail || '',
                affected_worker: affectedWorker || '',
                ...otherTicketData,
            };

            console.log('📤 [notify] Sending to Power Automate:', JSON.stringify(payload, null, 2));
            const response = await fetch(powerAutomateUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                console.log('✅ [notify] Power Automate success');
                results.powerAutomate = { success: true };
            } else {
                const errorText = await response.text();
                console.error('❌ [notify] Power Automate error:', response.status, errorText);
                results.powerAutomate = { success: false };
            }
        }
    } catch (e: any) {
        console.error('❌ [notify] Power Automate exception:', e.message);
    }

    // 2. Push notifications
    try {
        const emails = Array.from(new Set([
            ...(Array.isArray(to) ? to : [to]),
            ticketData?.supervisorEmail,
            ticketData?.requesterEmail,
        ])).filter(Boolean) as string[];

        if (emails.length > 0) {
            const subsList = await db.query(
                `SELECT * FROM push_subscriptions WHERE user_email IN (${emails.map(() => '?').join(',')})`,
                emails
            ) as any[];

            if (subsList.length > 0 && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
                const webpush = (await import('web-push')).default;
                webpush.setVapidDetails(
                    process.env.VAPID_SUBJECT || 'mailto:admin@gss.com',
                    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
                    process.env.VAPID_PRIVATE_KEY
                );

                const stripHtml = (html: string) =>
                    html.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

                const pushPayload = JSON.stringify({
                    title: subject,
                    body: stripHtml(body),
                    url: ticketData?.id ? `/tickets/${ticketData.id}` : '/',
                });

                await Promise.all(subsList.map(async (sub) => {
                    try {
                        await webpush.sendNotification(
                            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                            pushPayload
                        );
                    } catch (pushErr: any) {
                        if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                            await db.run('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
                        }
                    }
                }));
                console.log(`✅ [notify] Push sent to ${subsList.length} devices`);
            }
        }
    } catch (e: any) {
        console.error('❌ [notify] Push exception:', e.message);
    }

    // 3. SMTP fallback (only if Power Automate was not used or failed)
    if (!results.powerAutomate?.success) {
        try {
            await sendEmail({ to, subject, body });
            console.log('✅ [notify] SMTP success');
        } catch (e: any) {
            console.error('❌ [notify] SMTP exception:', e.message);
        }
    }
}
