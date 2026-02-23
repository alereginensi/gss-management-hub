import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { NextRequest } from 'next/server';

// GET /api/admin/users/[id]/workers — get workers assigned to a supervisor
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession(request);
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const { id } = await params;
        const supervisorId = parseInt(id);
        const rows = await db.prepare(
            'SELECT worker_id FROM supervisor_worker WHERE supervisor_id = ?'
        ).all(supervisorId) as { worker_id: number }[];
        return NextResponse.json({ workerIds: rows.map(r => r.worker_id) });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT /api/admin/users/[id]/workers — replace supervisor's assigned workers + department
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession(request);
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const { id } = await params;
        const supervisorId = parseInt(id);
        const { workerIds, department } = await request.json();

        // Sync supervisor_worker table in a transaction
        await db.transaction(async (tx) => {
            const isPg = (db as any).type === 'pg';
            await tx.run('DELETE FROM supervisor_worker WHERE supervisor_id = ?', [supervisorId]);

            if (Array.isArray(workerIds) && workerIds.length > 0) {
                const insertSql = isPg
                    ? 'INSERT INTO supervisor_worker (supervisor_id, worker_id) VALUES ($1, $2) ON CONFLICT DO NOTHING'
                    : 'INSERT OR IGNORE INTO supervisor_worker (supervisor_id, worker_id) VALUES (?, ?)';

                for (const wId of workerIds) {
                    await tx.run(insertSql, [supervisorId, wId]);
                }
            }

            // Update rubro (department) for the supervisor
            if (department !== undefined) {
                const updateSql = isPg
                    ? 'UPDATE users SET rubro = $1 WHERE id = $2'
                    : 'UPDATE users SET rubro = ? WHERE id = ?';
                await tx.run(updateSql, [department, supervisorId]);
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
