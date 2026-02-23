import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const supervisorId = searchParams.get('supervisorId');

    try {
        let query = `
            SELECT 
                sw.id, 
                sw.supervisor_id, 
                sw.worker_id,
                u1.name as supervisorName,
                u2.name as workerName
            FROM supervisor_worker sw
            JOIN users u1 ON sw.supervisor_id = u1.id
            JOIN users u2 ON sw.worker_id = u2.id
        `;
        const params: any[] = [];

        if (supervisorId) {
            query += " WHERE sw.supervisor_id = ?";
            params.push(supervisorId);
        }

        const assignments = await db.prepare(query).all(...params);
        return NextResponse.json(assignments);
    } catch (error) {
        return NextResponse.json({ error: 'Error fetching assignments' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { supervisorId, workerId, action } = await request.json();

        if (action === 'delete') {
            await db.prepare('DELETE FROM supervisor_worker WHERE supervisor_id = ? AND worker_id = ?')
                .run(supervisorId, workerId);
            return NextResponse.json({ success: true });
        }

        const isPg = (db as any).type === 'pg';
        const insertSql = isPg
            ? 'INSERT INTO supervisor_worker (supervisor_id, worker_id) VALUES ($1, $2) ON CONFLICT DO NOTHING'
            : 'INSERT OR IGNORE INTO supervisor_worker (supervisor_id, worker_id) VALUES (?, ?)';

        await db.prepare(insertSql).run(supervisorId, workerId);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Error updating assignments' }, { status: 500 });
    }
}
