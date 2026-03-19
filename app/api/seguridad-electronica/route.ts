import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const session = await getSession(request);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    try {
        let sql = 'SELECT * FROM security_records';
        const params: any[] = [];

        if (type) {
            sql += ' WHERE type = ?';
            params.push(type);
        }

        sql += ' ORDER BY id DESC';

        const records = await db.query(sql, params);
        return NextResponse.json(records);
    } catch (error: any) {
        console.error('Security Records GET Error:', error);
        return NextResponse.json({ error: error?.message || 'Failed to fetch records' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const session = await getSession(request);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();

        const sql = `
            INSERT INTO security_records (
                type, report_datetime, client, branch, supervisor, technician,
                record_type, security_event, mobile_intervention, affected_system,
                record_detail, event_classification, public_force, complaint_number,
                end_datetime, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const result = await db.run(sql, [
            body.type || null,
            body.report_datetime || null,
            body.client || null,
            body.branch || null,
            body.supervisor || null,
            body.technician || null,
            body.record_type || null,
            body.security_event || null,
            body.mobile_intervention || null,
            body.affected_system || null,
            body.record_detail || null,
            body.event_classification || null,
            body.public_force ? 1 : 0,
            body.complaint_number || null,
            body.end_datetime || null,
            session.user?.name || null
        ]);

        return NextResponse.json({ success: true, id: result.lastInsertRowid }, { status: 201 });
    } catch (error: any) {
        console.error('Security Records POST Error:', error);
        return NextResponse.json({ error: error?.message || 'Failed to create record' }, { status: 500 });
    }
}
