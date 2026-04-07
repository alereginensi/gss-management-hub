import { NextResponse, NextRequest } from 'next/server';
import { getSession } from '@/lib/auth-server';
import db from '@/lib/db';

// Admin-only bulk import endpoint — for one-time data migration
export async function POST(request: NextRequest) {
    const session = await getSession(request);
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { workers } = await request.json();
        if (!Array.isArray(workers) || workers.length === 0) {
            return NextResponse.json({ error: 'workers array requerido' }, { status: 400 });
        }

        let inserted = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const w of workers) {
            if (!w.nombre || !w.cedula) { skipped++; continue; }
            try {
                await db.run(
                    `INSERT INTO limpieza_usuarios (nombre, cedula, sector, cliente)
                     VALUES (?, ?, ?, ?)
                     ON CONFLICT (cedula) DO NOTHING`,
                    [w.nombre.trim(), String(w.cedula).trim(), w.sector || null, w.cliente || null]
                );
                inserted++;
            } catch (e: any) {
                skipped++;
                errors.push(`${w.cedula}: ${e.message}`);
            }
        }

        return NextResponse.json({ success: true, inserted, skipped, errors });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
