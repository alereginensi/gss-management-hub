import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'UserID missing' }, { status: 400 });
    }

    try {
        const tasks = db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC').all(userId);
        return NextResponse.json(tasks);
    } catch (error) {
        return NextResponse.json({ error: 'Error fetching tasks' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { userId, description, type, localTimestamp, location, sector } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'UserID obligatorio' }, { status: 400 });
        }

        const taskType = type || 'task';

        if (taskType === 'check_in' && (!location || !location.trim())) {
            return NextResponse.json({ error: 'Debe seleccionar en qué lugar está trabajando.' }, { status: 400 });
        }
        const timestamp = localTimestamp || new Date().toISOString();

        // Ensure description is NEVER null/undefined for DB constraint
        const descValue = description || (taskType === 'check_in' ? `Ingreso registrado en ${location}${sector ? ' - ' + sector : ''}` : (taskType === 'check_out' ? 'Salida registrada' : 'Tarea sin descripción'));

        const stmt = db.prepare('INSERT INTO tasks (user_id, description, type, created_at, location, sector) VALUES (?, ?, ?, ?, ?, ?)');
        const result = stmt.run(userId, descValue, taskType, timestamp, location || null, sector || null);

        return NextResponse.json({
            success: true,
            taskId: result.lastInsertRowid,
            task: {
                id: result.lastInsertRowid,
                userId,
                type: taskType,
                created_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('API Tasks Error:', error);
        return NextResponse.json({ error: 'Error al procesar la tarea en el servidor' }, { status: 500 });
    }
}
