import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

async function checkAuth(request: NextRequest) {
    const session = await getSession(request);
    if (!session || !['admin', 'contador'].includes(session.user.role)) return null;
    return session;
}

// Helper: get active rate for a category on a given date
async function getRate(categoryId: number | null, date: string) {
    if (!categoryId) return null;
    return db.get(
        `SELECT * FROM billing_rates WHERE category_id = ? AND valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?) ORDER BY valid_from DESC LIMIT 1`,
        [categoryId, date, date]
    ) as Promise<any>;
}

function computeCost(entry: any, rate: any) {
    if (!rate) return 0;
    const base = parseFloat(rate.rate) || 0;
    const mult = parseFloat(rate.overtime_multiplier) || 1.5;
    const ss = parseFloat(rate.social_security_pct) || 0;
    const bp = parseFloat(rate.bonus_provisions_pct) || 0;
    const regularCost = (parseFloat(entry.regular_hours) || 0) * base;
    const overtimeCost = (parseFloat(entry.overtime_hours) || 0) * base * mult;
    const subtotal = regularCost + overtimeCost;
    return Math.round(subtotal * (1 + (ss + bp) / 100) * 100) / 100;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await checkAuth(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const entries = await db.query(
            `SELECT be.*, bc.name as category_name
             FROM billing_entries be
             LEFT JOIN billing_categories bc ON be.category_id = bc.id
             WHERE be.period_id = ?
             ORDER BY be.date DESC, be.funcionario`,
            [id]
        ) as any[];

        // Attach computed cost per entry
        const withCost = await Promise.all(entries.map(async (e) => {
            const rate = await getRate(e.category_id, e.date);
            return { ...e, estimated_cost: computeCost(e, rate), rate };
        }));

        return NextResponse.json(withCost);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await checkAuth(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const period = await db.get('SELECT status FROM billing_periods WHERE id = ?', [id]) as any;
        if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 });
        if (period.status === 'closed') return NextResponse.json({ error: 'Period is closed' }, { status: 400 });

        const { funcionario, category_id, date, regular_hours, overtime_hours, location, sector, service_type, notes } = await request.json();
        if (!funcionario || !date) return NextResponse.json({ error: 'funcionario and date are required' }, { status: 400 });

        if (db.type === 'pg') {
            const result = await db.query(
                `INSERT INTO billing_entries (period_id, funcionario, category_id, date, regular_hours, overtime_hours, location, sector, service_type, source, notes, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?) RETURNING *`,
                [id, funcionario, category_id ?? null, date, regular_hours ?? 8, overtime_hours ?? 0, location ?? null, sector ?? null, service_type ?? null, notes ?? null, session.user.name]
            );
            return NextResponse.json(result[0], { status: 201 });
        } else {
            await db.run(
                `INSERT INTO billing_entries (period_id, funcionario, category_id, date, regular_hours, overtime_hours, location, sector, service_type, source, notes, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)`,
                [id, funcionario, category_id ?? null, date, regular_hours ?? 8, overtime_hours ?? 0, location ?? null, sector ?? null, service_type ?? null, notes ?? null, session.user.name]
            );
            const created = await db.get('SELECT * FROM billing_entries WHERE period_id = ? ORDER BY id DESC LIMIT 1', [id]);
            return NextResponse.json(created, { status: 201 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await checkAuth(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const period = await db.get('SELECT status FROM billing_periods WHERE id = ?', [id]) as any;
        if (period?.status === 'closed') return NextResponse.json({ error: 'Period is closed' }, { status: 400 });

        const { entryId, regular_hours, overtime_hours, category_id, funcionario, date, location, sector, service_type, notes } = await request.json();
        if (!entryId) return NextResponse.json({ error: 'entryId is required' }, { status: 400 });

        await db.run(
            `UPDATE billing_entries SET regular_hours = ?, overtime_hours = ?, category_id = ?, funcionario = ?, date = ?, location = ?, sector = ?, service_type = ?, notes = ? WHERE id = ? AND period_id = ?`,
            [regular_hours, overtime_hours, category_id ?? null, funcionario, date, location ?? null, sector ?? null, service_type ?? null, notes ?? null, entryId, id]
        );
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await checkAuth(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const entryId = searchParams.get('entryId');
    if (!entryId) return NextResponse.json({ error: 'entryId is required' }, { status: 400 });

    try {
        const { id } = await params;
        const period = await db.get('SELECT status FROM billing_periods WHERE id = ?', [id]) as any;
        if (period?.status === 'closed') return NextResponse.json({ error: 'Period is closed' }, { status: 400 });

        await db.run('DELETE FROM billing_entries WHERE id = ? AND period_id = ?', [entryId, id]);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
