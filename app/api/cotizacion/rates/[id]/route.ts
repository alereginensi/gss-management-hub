import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

async function checkAuth(request: NextRequest) {
    const session = await getSession(request);
    if (!session || !['admin', 'contador'].includes(session.user.role)) return null;
    return session;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await checkAuth(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const { rate, overtime_multiplier, social_security_pct, bonus_provisions_pct, valid_from, valid_to, notes } = await request.json();
        await db.run(
            `UPDATE billing_rates SET rate = ?, overtime_multiplier = ?, social_security_pct = ?, bonus_provisions_pct = ?, valid_from = ?, valid_to = ?, notes = ? WHERE id = ?`,
            [rate, overtime_multiplier, social_security_pct, bonus_provisions_pct, valid_from, valid_to ?? null, notes ?? null, id]
        );
        const updated = await db.get('SELECT * FROM billing_rates WHERE id = ?', [id]);
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
        await db.run('DELETE FROM billing_rates WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
