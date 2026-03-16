import { NextResponse } from 'next/server';
import db from '@/lib/db';
import ExcelJS from 'exceljs';
import { getSession } from '@/lib/auth-server';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const session = await getSession(request);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'Todos';
    const departmentFilter = searchParams.get('department') || 'Todos';
    const statusFilter = searchParams.get('status') || 'Todos';   // Todos | Pendiente | Resuelto
    const priorityFilter = searchParams.get('priority') || 'Todos'; // Todos | Alta | Media | Baja
    const folderId = searchParams.get('folderId'); // optional: restrict to a folder

    try {
        console.log(`[Export] Request params - Filter: ${filter}, Dept: ${departmentFilter}, UserRole: ${session.user.role}`);

        let query = 'SELECT * FROM tickets';
        const params: any[] = [];
        const conditions: string[] = [];

        // 1. Status Filter
        // Normalize filter to handle potential casing or encoding issues
        const normalizedFilter = filter.toLowerCase().trim();

        if (normalizedFilter === 'abiertos') {
            conditions.push("LOWER(status) IN ('nuevo', 'en progreso')");
        } else if (normalizedFilter === 'cerrados') {
            conditions.push("LOWER(status) = 'resuelto'");
        }

        // 1b. Dashboard status filter (Pendiente / Resuelto)
        if (statusFilter === 'Pendiente') {
            conditions.push("LOWER(status) IN ('nuevo', 'en progreso')");
        } else if (statusFilter === 'Resuelto') {
            conditions.push("LOWER(status) = 'resuelto'");
        }

        // 1c. Priority filter
        if (priorityFilter !== 'Todos') {
            conditions.push("priority = ?");
            params.push(priorityFilter);
        }

        // 2. Department / role Filter
        if (session.user.role === 'jefe') {
            // Jefe always restricted to their own department
            conditions.push("t.department = ?");
            params.push(session.user.department);
        } else if (session.user.role === 'admin' && departmentFilter !== 'Todos') {
            conditions.push("department = ?");
            params.push(departmentFilter);
        } else if (session.user.role === 'supervisor' || session.user.role === 'funcionario') {
            conditions.push("(t.department = ? OR t.supervisor = ? OR tc.user_id = ?)");
            params.push(session.user.department, session.user.name, session.user.id);
        } else if (session.user.role === 'user') {
            conditions.push("(t.requester_email = ? OR tc.user_id = ?)");
            params.push(session.user.email, session.user.id);
        }

        // Use LEFT JOIN so collaborator check works for all roles
        query = 'SELECT DISTINCT t.* FROM tickets t LEFT JOIN ticket_collaborators tc ON t.id = tc.ticket_id';

        // Folder filter: restrict to tickets in the given folder (owned by the requesting user)
        if (folderId) {
            query = `SELECT DISTINCT t.* FROM tickets t
                     INNER JOIN ticket_folder tf ON t.id = tf.ticket_id
                     INNER JOIN folders f ON tf.folder_id = f.id
                     LEFT JOIN ticket_collaborators tc ON t.id = tc.ticket_id
                     WHERE f.id = ? AND f.user_id = ?`;
            // prepend folder conditions, then append others
            const folderParams = [folderId, session.user.id];
            if (conditions.length > 0) {
                query += ' AND ' + conditions.join(' AND ');
            }
            const tickets = await db.prepare(query).all(...folderParams, ...params) as any[];
            const priorityOrder: Record<string, number> = { 'Alta': 1, 'Media': 2, 'Baja': 3 };
            tickets.sort((a, b) => {
                const pA = priorityOrder[a.priority] || 99;
                const pB = priorityOrder[b.priority] || 99;
                if (pA !== pB) return pA - pB;
                return parseInt(b.id || '0') - parseInt(a.id || '0');
            });
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Tickets');
            sheet.columns = [
                { header: 'ID', key: 'id', width: 10 },
                { header: 'Fecha', key: 'date', width: 18 },
                { header: 'Asunto', key: 'subject', width: 30 },
                { header: 'Departamento', key: 'department', width: 15 },
                { header: 'Solicitante', key: 'requester', width: 20 },
                { header: 'Funcionario Afectado', key: 'affectedWorker', width: 20 },
                { header: 'Prioridad', key: 'priority', width: 10 },
                { header: 'Estado', key: 'status', width: 12 },
                { header: 'Supervisor', key: 'supervisor', width: 20 },
                { header: 'Descripción', key: 'description', width: 40 },
            ];
            sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
            tickets.forEach(t => {
                const row = sheet.addRow({ id: t.id, date: t.date, subject: t.subject, department: t.department, requester: t.requester, affectedWorker: t.affected_worker || '-', priority: t.priority, status: t.status, supervisor: t.supervisor || '-', description: t.description });
                const priorityCell = row.getCell('priority');
                if (t.priority === 'Alta') priorityCell.font = { color: { argb: 'FFFF0000' }, bold: true };
                else if (t.priority === 'Media') priorityCell.font = { color: { argb: 'FFF59E0B' } };
                else priorityCell.font = { color: { argb: 'FF10B981' } };
            });
            const buffer = await workbook.xlsx.writeBuffer();
            return new NextResponse(buffer, {
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': `attachment; filename="carpeta_${folderId}_tickets_${new Date().toISOString().split('T')[0]}.xlsx"`
                }
            });
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        console.log(`[Export] Query: ${query}`);
        console.log(`[Export] Params:`, params);

        const tickets = await db.prepare(query).all(...params) as any[];

        // 3. Sort by Priority (Alta > Media > Baja) then Date DESC
        const priorityOrder: Record<string, number> = { 'Alta': 1, 'Media': 2, 'Baja': 3 };

        tickets.sort((a, b) => {
            const pA = priorityOrder[a.priority] || 99;
            const pB = priorityOrder[b.priority] || 99;
            if (pA !== pB) return pA - pB;
            // Secondary sort by ID desc (proxy for date)
            return parseInt(b.id || '0') - parseInt(a.id || '0');
        });

        // 4. Generate Excel
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Tickets');

        sheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Fecha', key: 'date', width: 18 },
            { header: 'Asunto', key: 'subject', width: 30 },
            { header: 'Departamento', key: 'department', width: 15 },
            { header: 'Solicitante', key: 'requester', width: 20 },
            { header: 'Funcionario Afectado', key: 'affectedWorker', width: 20 },
            { header: 'Prioridad', key: 'priority', width: 10 },
            { header: 'Estado', key: 'status', width: 12 },
            { header: 'Supervisor', key: 'supervisor', width: 20 },
            { header: 'Descripción', key: 'description', width: 40 },
        ];

        // Style the header
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1F2937' } // Dark gray/navy
        };

        // Add rows
        tickets.forEach(t => {
            const row = sheet.addRow({
                id: t.id,
                date: t.date,
                subject: t.subject,
                department: t.department,
                requester: t.requester,
                affectedWorker: t.affected_worker || '-',
                priority: t.priority,
                status: t.status,
                supervisor: t.supervisor || '-',
                description: t.description
            });

            // Conditional formatting for Priority
            const priorityCell = row.getCell('priority');
            if (t.priority === 'Alta') {
                priorityCell.font = { color: { argb: 'FFFF0000' }, bold: true };
            } else if (t.priority === 'Media') {
                priorityCell.font = { color: { argb: 'FFF59E0B' } }; // Orange/Yellow
            } else {
                priorityCell.font = { color: { argb: 'FF10B981' } }; // Green
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="tickets_${statusFilter !== 'Todos' ? statusFilter + '_' : ''}${priorityFilter !== 'Todos' ? priorityFilter + '_' : ''}${new Date().toISOString().split('T')[0]}.xlsx"`
            }
        });

    } catch (error: any) {
        console.error('Export Error:', error);
        return NextResponse.json({ error: 'Failed to export tickets' }, { status: 500 });
    }
}
