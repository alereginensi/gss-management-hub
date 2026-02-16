import { NextResponse } from 'next/server';
import db from '@/lib/db';

// GET all active locations with their sectors
export async function GET() {
    try {
        const locations = db.prepare('SELECT * FROM locations WHERE active = 1 ORDER BY name ASC').all();
        const sectors = db.prepare('SELECT * FROM sectors WHERE active = 1').all();

        const locationsWithSectors = locations.map((loc: any) => ({
            ...loc,
            sectors: sectors.filter((sec: any) => sec.location_id === loc.id)
        }));

        return NextResponse.json(locationsWithSectors);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST new location
export async function POST(request: Request) {
    try {
        const { name } = await request.json();
        if (!name || !name.trim()) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        const stmt = db.prepare('INSERT INTO locations (name) VALUES (?)');
        const info = stmt.run(name.trim());

        return NextResponse.json({ id: info.lastInsertRowid, name: name.trim(), active: 1 });
    } catch (error: any) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return NextResponse.json({ error: 'Location already exists' }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE location (Soft delete)
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        const stmt = db.prepare('UPDATE locations SET active = 0 WHERE id = ?');
        stmt.run(id);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
