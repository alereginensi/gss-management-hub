import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
    try {
        let columns: any[] = [];

        if (db.type === 'pg') {
            const res = await (db as any).pgPool.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'logbook'
                ORDER BY ordinal_position
            `);
            columns = res.rows;
        } else {
            columns = (db as any).sqliteDb.prepare("PRAGMA table_info(logbook)").all();
        }

        return NextResponse.json({
            type: db.type,
            columns: columns
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 });
    }
}
