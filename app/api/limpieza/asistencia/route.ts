import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const fecha = searchParams.get('fecha');
    const cliente = searchParams.get('cliente');
    const sector = searchParams.get('sector');

    try {
        if (action === 'list_dates') {
            const rows = await db.query('SELECT DISTINCT fecha FROM limpieza_asistencia ORDER BY fecha DESC');
            return NextResponse.json(rows.map((r: any) => r.fecha));
        }

        if (!fecha) return NextResponse.json({ error: 'Fecha requerida' }, { status: 400 });

        let query = 'SELECT * FROM limpieza_asistencia WHERE fecha = ?';
        const params: string[] = [fecha];

        if (cliente && cliente !== 'Todos' && cliente !== 'null') {
            query += ' AND cliente = ?';
            params.push(cliente);
        }
        if (sector && sector !== 'null') {
            query += ' AND sector = ?';
            params.push(sector);
        }

        query += ' ORDER BY seccion, id ASC';

        const rows = await db.query(query, params);
        return NextResponse.json(rows);
    } catch (error: any) {
        console.error('Error in GET limpieza_asistencia:', error);
        return NextResponse.json({ error: 'Error al obtener datos' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const {
            id, fecha, seccion, funcionario_id, nombre, cedula, cliente, sector, puesto,
            entrada1, salida1, entrada2, salida2, firma
        } = body;

        if (!fecha || !seccion) {
            return NextResponse.json({ error: 'Fecha y sección son obligatorias' }, { status: 400 });
        }

        if (id !== undefined && id !== null) {
            let finalFirma = firma;
            if (!finalFirma) {
                const existing = await db.get('SELECT firma FROM limpieza_asistencia WHERE id = ?', [id]);
                if (existing && existing.firma) finalFirma = existing.firma;
            }

            await db.run(
                `UPDATE limpieza_asistencia SET
                    funcionario_id = ?, nombre = ?, cedula = ?, cliente = ?, sector = ?, puesto = ?,
                    entrada1 = ?, salida1 = ?, entrada2 = ?, salida2 = ?,
                    firma = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [funcionario_id, nombre, cedula, cliente, sector ?? null, puesto ?? null, entrada1, salida1, entrada2, salida2, finalFirma, id]
            );
            return NextResponse.json({ success: true, id });
        } else {
            const existing = await db.get(
                'SELECT id, firma FROM limpieza_asistencia WHERE fecha = ? AND seccion = ? AND funcionario_id = ?',
                [fecha, seccion, funcionario_id]
            );

            if (existing && funcionario_id) {
                let finalFirma = firma || existing.firma;
                await db.run(
                    `UPDATE limpieza_asistencia SET
                        nombre = ?, cedula = ?, cliente = ?, sector = ?, puesto = ?,
                        entrada1 = ?, salida1 = ?, entrada2 = ?, salida2 = ?,
                        firma = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`,
                    [nombre, cedula, cliente, sector ?? null, puesto ?? null, entrada1, salida1, entrada2, salida2, finalFirma, existing.id]
                );
                return NextResponse.json({ success: true, id: Number(existing.id) });
            } else {
                const result = await db.run(
                    `INSERT INTO limpieza_asistencia
                     (fecha, seccion, funcionario_id, nombre, cedula, cliente, sector, puesto, entrada1, salida1, entrada2, salida2, firma)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [fecha, seccion, funcionario_id, nombre, cedula, cliente, sector ?? null, puesto ?? null, entrada1, salida1, entrada2, salida2, firma]
                );
                const newId = result.lastInsertRowid ? Number(result.lastInsertRowid) : null;
                return NextResponse.json({ success: true, id: newId }, { status: 201 });
            }
        }
    } catch (error: any) {
        console.error('Error saving limpieza_asistencia:', error);
        return NextResponse.json({
            error: 'Error al guardar datos',
            details: error.message
        }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    try {
        await db.run('DELETE FROM limpieza_asistencia WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting limpieza_asistencia:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
