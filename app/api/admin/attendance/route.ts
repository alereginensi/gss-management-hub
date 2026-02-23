import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const requesterId = searchParams.get('requesterId'); // ID of the admin/supervisor requesting
    const requesterRole = searchParams.get('requesterRole');
    const startDate = searchParams.get('startDate'); // YYYY-MM-DD
    const endDate = searchParams.get('endDate'); // YYYY-MM-DD
    const filterLocation = searchParams.get('location');
    const filterRubro = searchParams.get('rubro');
    const filterSector = searchParams.get('sector');

    if (!requesterId || !requesterRole) {
        return NextResponse.json({ error: 'Missing requester info' }, { status: 400 });
    }

    try {
        let query = `
            SELECT 
                t.*, 
                t.location as taskLocation,
                u.name as userName,
                u.department as userDepartment,
                u.rubro as userRubro
            FROM tasks t
            JOIN users u ON t.user_id = u.id
            WHERE 1=1
        `;
        const params: any[] = [];

        // Filter by location/sector at the DB level
        if (filterLocation || filterSector) {
            query += ` AND t.user_id IN (
                SELECT DISTINCT user_id FROM tasks 
                WHERE type = 'check_in' 
                ${filterLocation ? 'AND location = ?' : ''} 
                ${filterSector ? 'AND sector = ?' : ''}
                ${startDate ? 'AND DATE(created_at) >= ?' : ''}
                ${endDate ? 'AND DATE(created_at) <= ?' : ''}
            )`;
            if (filterLocation) params.push(filterLocation);
            if (filterSector) params.push(filterSector);
            if (startDate) params.push(startDate);
            if (endDate) params.push(endDate);
        }

        // Filter by Supervisor if not Admin
        if (requesterRole === 'supervisor') {
            query += ` AND u.id IN (SELECT worker_id FROM supervisor_worker WHERE supervisor_id = ?)`;
            params.push(requesterId);
        } else if (requesterRole !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        if (startDate) {
            query += ` AND DATE(t.created_at) >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND DATE(t.created_at) <= ?`;
            params.push(endDate);
        }
        if (filterRubro) {
            query += ` AND u.rubro = ?`;
            params.push(filterRubro);
        }

        query += ` ORDER BY t.created_at ASC`;

        const rawTasks = await db.prepare(query).all(...params) as any[];

        // Group by Date and User
        const workdaySummary: Record<string, any> = {};

        rawTasks.forEach(task => {
            const date = new Date(task.created_at).toISOString().split('T')[0];
            const key = `${date}_${task.user_id}`;

            if (!workdaySummary[key]) {
                workdaySummary[key] = {
                    date,
                    userId: task.user_id,
                    userName: task.userName,
                    department: task.userDepartment,
                    rubro: task.userRubro,
                    checkIn: null,
                    checkOut: null,
                    tasks: [],
                    rawEvents: []
                };
            }

            const current = workdaySummary[key];
            const time = new Date(task.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

            if (task.type === 'check_in' && !current.checkIn) {
                current.checkIn = time;
                current.checkInFull = task.created_at;
                current.location = task.taskLocation; // Capture location from check-in
                current.sector = task.sector; // Capture sector from check-in
            } else if (task.type === 'check_out') {
                current.checkOut = time;
                current.checkOutFull = task.created_at;
            } else if (task.type === 'task') {
                current.tasks.push({ time, description: task.description });
            }

            current.rawEvents.push(task);
        });

        // Convert to array and calculate durations
        const result = Object.values(workdaySummary).map((day: any) => {
            let totalHours = "00:00";
            if (day.checkInFull && day.checkOutFull) {
                const start = new Date(day.checkInFull).getTime();
                const end = new Date(day.checkOutFull).getTime();
                const diffMs = end - start;
                if (diffMs > 0) {
                    const hours = Math.floor(diffMs / (1000 * 60 * 60));
                    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    totalHours = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                }
            }

            return {
                ...day,
                totalHours
            };
        });

        // Filter by location and sector if requested
        const filteredResult = result.filter((day: any) => {
            const locMatch = !filterLocation || day.location === filterLocation;
            const secMatch = !filterSector || day.sector === filterSector;
            return locMatch && secMatch;
        });

        // Sort by date DESC
        filteredResult.sort((a, b) => b.date.localeCompare(a.date));

        return NextResponse.json(filteredResult);
    } catch (error: any) {
        console.error('Attendance API Error:', error);
        console.error('Error Stack:', error.stack);
        return NextResponse.json({ error: 'Error processing attendance data', details: error.message }, { status: 500 });
    }
}
