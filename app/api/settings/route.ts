import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
    try {
        const settingsRows = db.prepare('SELECT * FROM settings').all() as any[];
        const settings: Record<string, string> = {};
        settingsRows.forEach(row => {
            settings[row.key] = row.value;
        });

        return NextResponse.json(settings);
    } catch (error) {
        console.error('Error fetching settings:', error);
        return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

        const transaction = db.transaction((data: Record<string, string>) => {
            for (const [key, value] of Object.entries(data)) {
                upsert.run(key, value);
            }
        });

        transaction(body);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating settings:', error);
        return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 });
    }
}
