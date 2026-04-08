import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

const TABLES = [
    'users',
    'tickets',
    'team_ticket_tasks',
    'ticket_folder',
    'folders',
    'notifications',
    'logbook',
    'logbook_columns',
    'limpieza_usuarios',
    'limpieza_registros',
    'limpieza_asistencia',
    'limpieza_tareas_asignadas',
    'locations',
    'sectors',
    'billing_categories',
    'billing_rates',
    'billing_periods',
    'billing_entries',
    'material_requests',
    'purchase_orders',
    'purchase_order_items',
    'logistica_calendario',
    'counters',
];

export async function GET(request: NextRequest) {
    const session = await getSession(request);
    if (session?.user?.role !== 'admin') {
        return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const backup: Record<string, any[]> = {};
    const errors: string[] = [];

    for (const table of TABLES) {
        try {
            const rows = await db.query(`SELECT * FROM ${table}`);
            backup[table] = rows as any[];
        } catch {
            errors.push(table);
        }
    }

    const payload = {
        version: 1,
        created_at: new Date().toISOString(),
        db_type: db.type,
        tables: backup,
        skipped_tables: errors,
    };

    const json = JSON.stringify(payload, null, 2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `gss_backup_${timestamp}.json`;

    return new NextResponse(json, {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
        },
    });
}
