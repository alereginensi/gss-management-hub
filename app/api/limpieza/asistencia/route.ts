import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

// GET: Fetch all assistance records for a date
export async function GET(request: NextRequest) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const fecha = searchParams.get('fecha');
    const cliente = searchParams.get('cliente');

    try {
        if (action === 'list_dates') {
            // Get all unique dates from the attendance table
            const rows = await db.query('SELECT DISTINCT fecha FROM limpieza_asistencia ORDER BY fecha DESC');
            return NextResponse.json(rows.map((r: any) => r.fecha));
        }

        if (!fecha) return NextResponse.json({ error: 'Fecha requerida' }, { status: 400 });

        let query = 'SELECT * FROM limpieza_asistencia WHERE fecha = ?';
        let params = [fecha];

        if (cliente && cliente !== 'Todos' && cliente !== 'null') {
            query += ' AND cliente = ?';
            params.push(cliente);
        }

        query += ' ORDER BY seccion, id ASC';
        
        const rows = await db.query(query, params);
        return NextResponse.json(rows);
    } catch (error: any) {
        console.error('Error in GET limpieza_asistencia:', error);
        return NextResponse.json({ error: 'Error al obtener datos' }, { status: 500 });
    }
}

// POST: Upsert (Create or Update) an assistance record
export async function POST(request: NextRequest) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const {
            id, fecha, seccion, funcionario_id, nombre, cedula, cliente,
            entrada1, salida1, entrada2, salida2, firma
        } = body;

        if (!fecha || !seccion) {
            return NextResponse.json({ error: 'Fecha y sección son obligatorias' }, { status: 400 });
        }

        if (id !== undefined && id !== null) {
            // Update existing record by ID
            // First, if firma is null/empty in body, check if we should preserve existing one
            let finalFirma = firma;
            if (!finalFirma) {
                const existing = await db.get('SELECT firma FROM limpieza_asistencia WHERE id = ?', [id]);
                if (existing && existing.firma) finalFirma = existing.firma;
            }

            await db.run(
                `UPDATE limpieza_asistencia SET
                    funcionario_id = ?, nombre = ?, cedula = ?, cliente = ?,
                    entrada1 = ?, salida1 = ?, entrada2 = ?, salida2 = ?,
                    firma = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [funcionario_id, nombre, cedula, cliente, entrada1, salida1, entrada2, salida2, finalFirma, id]
            );
            return NextResponse.json({ success: true, id });
        } else {
            // No ID provided, check for existing record by (fecha, seccion, funcionario_id)
            // This prevents duplicate rows if user clicks save multiple times or from different tabs
            const existing = await db.get(
                'SELECT id, firma FROM limpieza_asistencia WHERE fecha = ? AND seccion = ? AND funcionario_id = ?',
                [fecha, seccion, funcionario_id]
            );

            if (existing && funcionario_id) {
                let finalFirma = firma || existing.firma;
                await db.run(
                    `UPDATE limpieza_asistencia SET
                        nombre = ?, cedula = ?, cliente = ?,
                        entrada1 = ?, salida1 = ?, entrada2 = ?, salida2 = ?,
                        firma = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`,
                    [nombre, cedula, cliente, entrada1, salida1, entrada2, salida2, finalFirma, existing.id]
                );
                return NextResponse.json({ success: true, id: Number(existing.id) });
            } else {
                // Create new record
                const result = await db.run(
                    `INSERT INTO limpieza_asistencia
                     (fecha, seccion, funcionario_id, nombre, cedula, cliente, entrada1, salida1, entrada2, salida2, firma)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [fecha, seccion, funcionario_id, nombre, cedula, cliente, entrada1, salida1, entrada2, salida2, firma]
                );
                // Ensure id is a number/string, not a BigInt which fails JSON.stringify
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
