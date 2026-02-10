import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, label, type, options } = body;

        // name should be alphanumeric for safety in JSON keys
        const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

        db.prepare(`
            INSERT INTO logbook_columns (name, label, type, options)
            VALUES (?, ?, ?, ?)
        `).run(safeName, label, type, JSON.stringify(options || []));

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Logbook Columns POST Error:', error);
        if (error.code === 'SQLITE_CONSTRAINT') {
            return NextResponse.json({ error: 'El nombre de la columna ya existe' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to create column' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const name = searchParams.get('name');

        if (!name) {
            return NextResponse.json({ error: 'Column name is required' }, { status: 400 });
        }

        db.prepare('DELETE FROM logbook_columns WHERE name = ?').run(name);

        // Note: Data in logbook table remains in extra_data JSON but won't be displayed

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Logbook Columns DELETE Error:', error);
        return NextResponse.json({ error: 'Failed to delete column' }, { status: 500 });
    }
}
