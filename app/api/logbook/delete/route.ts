import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function DELETE(req: Request) {
    try {
        const body = await req.json();
        const { ids } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
        }

        // Create placeholders for the SQL query
        const placeholders = ids.map(() => '?').join(',');
        const deleteStmt = db.prepare(`DELETE FROM logbook WHERE id IN (${placeholders})`);

        deleteStmt.run(...ids);

        return NextResponse.json({ success: true, deleted: ids.length });
    } catch (error) {
        console.error('Logbook DELETE Error:', error);
        return NextResponse.json({ error: 'Failed to delete logbook entries' }, { status: 500 });
    }
}
