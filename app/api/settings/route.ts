import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
    try {
        if (!db) {
            console.error('Database not initialized');
            return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        }
        const settingsRows = await db.prepare('SELECT * FROM settings').all() as any[];
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

        // Use a transaction for multiple updates
        await db.transaction(async (tx) => {
            for (const [key, value] of Object.entries(body as Record<string, string>)) {
                // Determine upsert syntax
                const sql = (db as any).type === 'pg'
                    ? 'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2'
                    : 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)';

                await tx.run(sql, [key, value]);
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating settings:', error);
        return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 });
    }
}
