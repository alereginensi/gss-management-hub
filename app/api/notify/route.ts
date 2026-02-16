import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/mail';
import db from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { to, subject, body, ticketData } = await request.json();

        if (!to || !subject || !body) {
            return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
        }

        // 1. Try Power Automate Webhook first (Check DB settings then Env)
        const settingsRows = db.prepare('SELECT * FROM settings WHERE key = ?').get('power_automate_url') as any;
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

        // 2. Fallback to SMTP/Nodemailer
        const result = await sendEmail({ to, subject, body });

        if (result.success) {
            return NextResponse.json({ success: true, message: 'Notificación enviada vía SMTP' });
        } else {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }
    } catch (error) {
        console.error('Notify API error:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
