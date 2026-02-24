import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
    try {
        const dummyEntry = {
            date: new Date().toISOString().split('T')[0],
            sector: 'Test',
            supervisor: null,
            location: 'Test Location',
            incident: 'Test Incident',
            report: 'Test Report',
            staff_member: 'Test Staff',
            uniform: 'Completo',
            extra_data: {},
            supervised_by: 'Limpieza'
        };

        const insertSql = `
            INSERT INTO logbook (date, sector, supervisor, location, incident, report, staff_member, uniform, extra_data, supervised_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        let txError = null;
        let pgError = null;

        try {
            await db.transaction(async (tx) => {
                await tx.run(insertSql, [
                    dummyEntry.date || null,
                    dummyEntry.sector || null,
                    dummyEntry.supervisor || null,
                    dummyEntry.location || null,
                    dummyEntry.incident || '',
                    dummyEntry.report || '',
                    dummyEntry.staff_member || '',
                    dummyEntry.uniform || '',
                    JSON.stringify(dummyEntry.extra_data || {}),
                    dummyEntry.supervised_by || null
                ]);
            });
        } catch (e: any) {
            txError = e.message;
            pgError = JSON.stringify(e, Object.getOwnPropertyNames(e));
        }

        return NextResponse.json({
            error: txError,
            details: pgError,
            success: !txError
        });
    } catch (e: any) {
        return NextResponse.json({ outerError: e.message });
    }
}
