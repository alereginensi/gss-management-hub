import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

// POST - public, no auth required
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { cedula, tareas, tareas_timestamps, fotos, observaciones } = body;

        if (!cedula) {
            return NextResponse.json({ error: 'Cédula es obligatoria' }, { status: 400 });
        }

        // Look up worker data server-side
        const worker = await db.get(
            'SELECT nombre, cedula, sector, cliente FROM limpieza_usuarios WHERE cedula = ? AND activo = 1',
            [cedula.trim()]
        ) as any;

        if (!worker) {
            return NextResponse.json({ error: 'Usuario no registrado' }, { status: 404 });
        }

        const fecha = new Date().toISOString().split('T')[0];
        const hora_actual = new Date().toTimeString().slice(0, 5);

        // Check if there is an existing record for today
        const existing = await db.get(
            'SELECT id, hora_fin, tareas FROM limpieza_registros WHERE cedula = ? AND fecha = ?',
            [cedula.trim(), fecha]
        );

        if (existing) {
            // UPSERT/UPDATE LOGIC
            let hora_fin = existing.hora_fin;
            
            // Logic to set hora_fin if not set and all tasks are completed
            try {
                const arr = JSON.parse(tareas || '[]');
                if (arr.length >= 5 && !hora_fin) {
                    hora_fin = hora_actual;
                }
            } catch (e) {
                console.error('Error parsing tareas for hora_fin logic:', e);
            }

            await db.run(
                `UPDATE limpieza_registros
                 SET tareas = ?, tareas_timestamps = ?, fotos = ?, observaciones = ?, hora_fin = ?
                 WHERE id = ?`,
                [tareas, tareas_timestamps || null, fotos || null, observaciones || null, hora_fin, existing.id]
            );

            return NextResponse.json({ success: true, message: 'Registro actualizado correctamente', updated: true });
        } else {
            // INSERT LOGIC (First record of the day)
            const hora_inicio = hora_actual;
            let hora_fin = null;

            try {
                const arr = JSON.parse(tareas || '[]');
                if (arr.length >= 5) hora_fin = hora_actual;
            } catch {}

            await db.run(
                `INSERT INTO limpieza_registros (nombre, cedula, sector, cliente, fecha, hora_inicio, hora_fin, tareas, tareas_timestamps, fotos, observaciones)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [worker.nombre, worker.cedula, worker.sector || null, worker.cliente || null,
                 fecha, hora_inicio, hora_fin, tareas || null, tareas_timestamps || null, fotos || null, observaciones || null]
            );

            return NextResponse.json({ success: true, message: 'Registro guardado correctamente', created: true }, { status: 201 });
        }
    } catch (error: any) {
        console.error('Error saving limpieza registro:', error);
        return NextResponse.json({ error: 'Error al guardar el registro' }, { status: 500 });
    }
}

// GET - protected, requires limpieza module access
export async function GET(request: NextRequest) {
    const session = await getSession(request);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');
    const search = searchParams.get('search')?.trim() || '';

    try {
        const conditions: string[] = [];
        const params: any[] = [];

        if (desde) {
            conditions.push('fecha >= ?');
            params.push(desde);
        }
        if (hasta) {
            conditions.push('fecha <= ?');
            params.push(hasta);
        }
        if (search) {
            conditions.push('(LOWER(nombre) LIKE ? OR LOWER(cedula) LIKE ? OR LOWER(sector) LIKE ? OR LOWER(cliente) LIKE ?)');
            const term = `%${search.toLowerCase()}%`;
            params.push(term, term, term, term);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const rows = await db.query(`SELECT * FROM limpieza_registros ${where} ORDER BY fecha DESC, created_at DESC`, params);

        return NextResponse.json(rows);
    } catch (error: any) {
        console.error('Error fetching limpieza registros:', error);
        return NextResponse.json({ error: 'Error al obtener registros' }, { status: 500 });
    }
}

// DELETE - Protected
export async function DELETE(request: NextRequest) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });

        await db.run('DELETE FROM limpieza_registros WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting registro:', error);
        return NextResponse.json({ error: 'Error al eliminar el registro' }, { status: 500 });
    }
}

// PUT - Protected
export async function PUT(request: NextRequest) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { id, sector, cliente, hora_inicio, hora_fin, tareas, observaciones } = body;

        if (!id) return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });

        await db.run(
            `UPDATE limpieza_registros 
             SET sector = ?, cliente = ?, hora_inicio = ?, hora_fin = ?, tareas = ?, observaciones = ?
             WHERE id = ?`,
            [sector, cliente, hora_inicio, hora_fin, tareas, observaciones, id]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error updating registro:', error);
        return NextResponse.json({ error: 'Error al actualizar el registro' }, { status: 500 });
    }
}
