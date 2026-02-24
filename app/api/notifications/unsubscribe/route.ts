import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { endpoint } = await request.json();

        if (!endpoint) {
            return NextResponse.json({ error: 'Endpoint is required' }, { status: 400 });
        }

        await db.run('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
        console.log('Unsubscribed device successfully:', endpoint);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in unsubscribe:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
