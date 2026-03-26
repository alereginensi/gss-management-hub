import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

async function getRate(categoryId: number | null, date: string) {
    if (!categoryId) return null;
    return db.get(
        `SELECT * FROM billing_rates WHERE category_id = ? AND valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?) ORDER BY valid_from DESC LIMIT 1`,
        [categoryId, date, date]
    ) as Promise<any>;
}

export async function GET(request: NextRequest) {
    const session = await getSession(request);
    if (!session || !['admin', 'contador'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Most recent non-closed period
        const period = await db.get(
            `SELECT * FROM billing_periods WHERE status != 'closed' ORDER BY created_at DESC LIMIT 1`
        ) as any;

        if (!period) {
            return NextResponse.json({ period: null, total_hours: 0, total_employees: 0, estimated_cost: 0, by_service_type: [] });
        }

        const entries = await db.prepare(
            `SELECT be.*, bc.name as category_name FROM billing_entries be
             LEFT JOIN billing_categories bc ON be.category_id = bc.id
             WHERE be.period_id = ?`
        ).all(period.id) as any[];

        let totalHours = 0;
        let estimatedCost = 0;
        const byServiceType: Record<string, { hours: number; cost: number; count: number }> = {};

        for (const e of entries) {
            const rate = await getRate(e.category_id, e.date);
            const base = rate ? parseFloat(rate.rate) || 0 : 0;
            const mult = rate ? parseFloat(rate.overtime_multiplier) || 1.5 : 1.5;
            const ss = rate ? parseFloat(rate.social_security_pct) || 0 : 0;
            const bp = rate ? parseFloat(rate.bonus_provisions_pct) || 0 : 0;
            const hours = (parseFloat(e.regular_hours) || 0) + (parseFloat(e.overtime_hours) || 0);
            const subtotal = (parseFloat(e.regular_hours) || 0) * base + (parseFloat(e.overtime_hours) || 0) * base * mult;
            const cost = Math.round(subtotal * (1 + (ss + bp) / 100) * 100) / 100;

            totalHours += hours;
            estimatedCost += cost;

            const key = e.service_type || 'Sin tipo';
            if (!byServiceType[key]) byServiceType[key] = { hours: 0, cost: 0, count: 0 };
            byServiceType[key].hours += hours;
            byServiceType[key].cost += cost;
            byServiceType[key].count++;
        }

        const uniqueEmployees = new Set(entries.map((e: any) => e.funcionario)).size;

        return NextResponse.json({
            period,
            total_hours: Math.round(totalHours * 100) / 100,
            total_employees: uniqueEmployees,
            estimated_cost: Math.round(estimatedCost * 100) / 100,
            by_service_type: Object.entries(byServiceType).map(([name, data]) => ({ name, ...data, cost: Math.round(data.cost * 100) / 100 }))
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
