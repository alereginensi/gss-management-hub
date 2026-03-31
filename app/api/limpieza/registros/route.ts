import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

// POST - public, no auth required
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, tareas, observaciones } = body;

        if (!email) {
            return NextResponse.json({ error: 'Email es obligatorio' }, { status: 400 });
        }

        // Look up worker data server-side
        const worker = await db.get(
            'SELECT nombre, cedula, sector, cliente FROM limpieza_usuarios WHERE LOWER(email) = ? AND activo = 1',
            [email.toLowerCase().trim()]
        ) as any;

        if (!worker) {
            return NextResponse.json({ error: 'Usuario no registrado' }, { status: 404 });
        }

        const fecha = new Date().toISOString().split('T')[0];
        const hora_actual = new Date().toTimeString().slice(0, 5);

        // Check if there is an existing record for today
        const existing = await db.get(
            'SELECT id, hora_fin, tareas FROM limpieza_registros WHERE LOWER(email) = ? AND fecha = ?',
            [email.toLowerCase().trim(), fecha]
        );

        if (existing) {
            // UPSERT/UPDATE LOGIC
            let hora_fin = existing.hora_fin;
            
            // Logic to set hora_fin if not set and all tasks are completed
            // Current list has 5 tasks.
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
                 SET tareas = ?, observaciones = ?, hora_fin = ?
                 WHERE id = ?`,
                [tareas, observaciones || null, hora_fin, existing.id]
            );

            return NextResponse.json({ success: true, message: 'Registro actualizado correctamente', updated: true });
        } else {
            // INSERT LOGIC (First record of the day)
            const hora_inicio = hora_actual;
            let hora_fin = null;

            // Optional: if they submit all tasks at once in the first go
            try {
                const arr = JSON.parse(tareas || '[]');
                if (arr.length >= 5) hora_fin = hora_actual;
            } catch {}

            await db.run(
                `INSERT INTO limpieza_registros (nombre, cedula, email, sector, ubicacion, fecha, hora_inicio, hora_fin, tareas, observaciones)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [worker.nombre, worker.cedula || null, email.toLowerCase().trim(), worker.sector || null, worker.cliente || null,
                 fecha, hora_inicio, hora_fin, tareas || null, observaciones || null]
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
            conditions.push('(LOWER(nombre) LIKE ? OR LOWER(cedula) LIKE ? OR LOWER(email) LIKE ? OR LOWER(sector) LIKE ? OR LOWER(ubicacion) LIKE ?)');
            const term = `%${search.toLowerCase()}%`;
            params.push(term, term, term, term, term);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const rows = await db.query(`SELECT * FROM limpieza_registros ${where} ORDER BY fecha DESC, created_at DESC`, params);

        return NextResponse.json(rows);
    } catch (error: any) {
        console.error('Error fetching limpieza registros:', error);
        return NextResponse.json({ error: 'Error al obtener registros' }, { status: 500 });
    }
}
