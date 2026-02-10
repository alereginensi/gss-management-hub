import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const action = searchParams.get('action'); // 'clear_entries' or 'reset_all'

        if (action === 'clear_entries') {
            db.prepare('DELETE FROM logbook').run();
            return NextResponse.json({ success: true, message: 'All entries cleared' });
        }

        if (action === 'reset_all') {
            db.prepare('DELETE FROM logbook').run();
            db.prepare('DELETE FROM logbook_columns').run();
            return NextResponse.json({ success: true, message: 'List reset completely' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Logbook Management Error:', error);
        return NextResponse.json({ error: 'Failed to manage logbook' }, { status: 500 });
    }
}
