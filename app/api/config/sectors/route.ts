import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { name, location_id } = await request.json();

        if (!name || !location_id) {
            return NextResponse.json({ error: 'Name and Location ID are required' }, { status: 400 });
        }

        const stmt = db.prepare('INSERT INTO sectors (name, location_id) VALUES (?, ?)');
        const info = stmt.run(name.trim(), location_id);

        return NextResponse.json({ id: info.lastInsertRowid, name: name.trim(), location_id });
    } catch (error: any) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return NextResponse.json({ error: 'Sector already exists for this location' }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const location_id = searchParams.get('location_id');
        const name = searchParams.get('name');

        if (id) {
            const stmt = db.prepare('UPDATE sectors SET active = 0 WHERE id = ?');
            stmt.run(id);
        } else if (location_id && name) {
            const stmt = db.prepare('UPDATE sectors SET active = 0 WHERE location_id = ? AND name = ?');
            stmt.run(location_id, name);
        } else {
            return NextResponse.json({ error: 'ID or (Location ID + Name) required' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
