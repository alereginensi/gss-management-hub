import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

async function checkAuth(request: NextRequest) {
    const session = await getSession(request);
    if (!session || !['admin', 'contador'].includes(session.user.role)) return null;
    return session;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await checkAuth(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const period = await db.get('SELECT * FROM billing_periods WHERE id = ?', [id]);
        if (!period) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(period);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await checkAuth(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const body = await request.json();
        const period = await db.get('SELECT * FROM billing_periods WHERE id = ?', [id]) as any;
        if (!period) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        // Status transition: only admin can approve/close
        if (body.status && body.status !== period.status) {
            if (!['admin'].includes(session.user.role)) {
                return NextResponse.json({ error: 'Only admin can change period status' }, { status: 403 });
            }
        }

        const newStatus = body.status ?? period.status;
        const approvedBy = newStatus === 'approved' ? session.user.name : (period.approved_by ?? null);
        const approvedAt = newStatus === 'approved' ? new Date().toISOString() : (period.approved_at ?? null);

        await db.run(
            `UPDATE billing_periods SET label = ?, period_type = ?, date_from = ?, date_to = ?, status = ?, approved_by = ?, approved_at = ?, notes = ? WHERE id = ?`,
            [
                body.label ?? period.label,
                body.period_type ?? period.period_type,
                body.date_from ?? period.date_from,
                body.date_to ?? period.date_to,
                newStatus,
                approvedBy,
                approvedAt,
                body.notes ?? period.notes,
                id
            ]
        );
        const updated = await db.get('SELECT * FROM billing_periods WHERE id = ?', [id]);
        return NextResponse.json(updated);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await checkAuth(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const period = await db.get('SELECT status FROM billing_periods WHERE id = ?', [id]) as any;
        if (period?.status === 'closed') {
            return NextResponse.json({ error: 'Cannot delete a closed period' }, { status: 400 });
        }
        await db.run('DELETE FROM billing_periods WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
