import { NextResponse, NextRequest } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

const isPostgres = !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);

export async function POST(request: NextRequest) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { workers, cliente, sector } = await request.json();
    if (!Array.isArray(workers) || workers.length === 0)
        return NextResponse.json({ error: 'Sin datos' }, { status: 400 });

    let inserted = 0;
    let skipped = 0;

    for (const w of workers) {
        const nombre = (w.nombre || '').toString().trim();
        const cedula = (w.cedula || '').toString().trim();
        if (!nombre || !cedula) { skipped++; continue; }
        try {
            const sql = isPostgres
                ? 'INSERT INTO limpieza_usuarios (nombre, cedula, sector, cliente) VALUES ($1,$2,$3,$4) ON CONFLICT (cedula) DO NOTHING'
                : 'INSERT OR IGNORE INTO limpieza_usuarios (nombre, cedula, sector, cliente) VALUES (?,?,?,?)';
            const result = await db.run(sql, [nombre, cedula, sector || null, cliente || null]);
            const count = isPostgres ? (result as any).rowCount : (result as any).changes;
            if (count > 0) inserted++; else skipped++;
        } catch {
            skipped++;
        }
    }

    return NextResponse.json({ inserted, skipped });
}
