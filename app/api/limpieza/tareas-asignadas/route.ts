import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

// GET: worker lookup (cedula+fecha) OR supervisor list (auth)
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const cedula = searchParams.get('cedula');
    const fecha = searchParams.get('fecha');
    const cliente = searchParams.get('cliente') || '';
    const sector = searchParams.get('sector') || '';

    if (cedula && fecha) {
        // 1. Exact date match
        let rows = await db.query(
            `SELECT * FROM limpieza_tareas_asignadas
             WHERE fecha = ?
               AND (
                 (scope = 'individual' AND cedula = ?)
                 OR (scope = 'cliente' AND cliente = ?)
                 OR (scope = 'sector' AND cliente = ? AND sector = ?)
               )
             ORDER BY created_at ASC`,
            [fecha, cedula, cliente, cliente, sector]
        );
        if ((rows as any[]).length === 0) {
            // 2. Most recent before today
            rows = await db.query(
                `SELECT * FROM limpieza_tareas_asignadas
                 WHERE fecha < ?
                   AND fecha IS NOT NULL
                   AND (
                     (scope = 'individual' AND cedula = ?)
                     OR (scope = 'cliente' AND cliente = ?)
                     OR (scope = 'sector' AND cliente = ? AND sector = ?)
                   )
                 ORDER BY fecha DESC, created_at DESC`,
                [fecha, cedula, cliente, cliente, sector]
            );
            if ((rows as any[]).length > 0) {
                const latestFecha = (rows as any[])[0].fecha;
                rows = (rows as any[]).filter((r: any) => r.fecha === latestFecha);
            }
        }
        if ((rows as any[]).length === 0) {
            // 3. Permanent tasks (fecha IS NULL)
            rows = await db.query(
                `SELECT * FROM limpieza_tareas_asignadas
                 WHERE fecha IS NULL
                   AND (
                     (scope = 'individual' AND cedula = ?)
                     OR (scope = 'cliente' AND cliente = ?)
                     OR (scope = 'sector' AND cliente = ? AND sector = ?)
                   )
                 ORDER BY created_at ASC`,
                [cedula, cliente, cliente, sector]
            );
        }
        return NextResponse.json(rows);
    }

    // Protected: supervisor fetches all
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const permanentes = searchParams.get('permanentes');
    if (permanentes === '1') {
        const rows = await db.query(
            `SELECT * FROM limpieza_tareas_asignadas WHERE fecha IS NULL ORDER BY created_at DESC`
        );
        return NextResponse.json(rows);
    }

    const conditions: string[] = [];
    const params: any[] = [];
    if (fecha) { conditions.push('fecha = ?'); params.push(fecha); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await db.query(
        `SELECT * FROM limpieza_tareas_asignadas ${where} ORDER BY fecha DESC, created_at DESC`,
        params
    );
    return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { titulo, descripcion, tareas, scope, cedula, cliente, sector, fecha } = await request.json();
    if (!titulo || !tareas?.length || !scope)
        return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });

    await db.run(
        `INSERT INTO limpieza_tareas_asignadas (titulo, descripcion, tareas, scope, cedula, cliente, sector, fecha, creado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            titulo,
            descripcion || null,
            JSON.stringify(tareas),
            scope,
            cedula || null,
            cliente || null,
            sector || null,
            fecha,
            (session as any).name || (session as any).email || 'supervisor',
        ]
    );
    return NextResponse.json({ success: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    await db.run('DELETE FROM limpieza_tareas_asignadas WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
}
