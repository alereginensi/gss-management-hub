import { NextResponse } from 'next/server';
import db from '@/lib/db';
import ExcelJS from 'exceljs';
import { getSession } from '@/lib/auth-server';

export async function GET(request: Request) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'Todos'; // Todos, Abiertos, Cerrados
    const departmentFilter = searchParams.get('department') || 'Todos';

    try {
        console.log(`[Export] Request params - Filter: ${filter}, Dept: ${departmentFilter}, UserRole: ${session.user.role}`);

        let query = 'SELECT * FROM tickets';
        const params: any[] = [];
        const conditions: string[] = [];

        // 1. Status Filter
        // Normalize filter to handle potential casing or encoding issues
        const normalizedFilter = filter.toLowerCase().trim();

        if (normalizedFilter === 'abiertos') {
            // Use SQL LOWER() to be case-insensitive against the DB column
            conditions.push("LOWER(status) IN ('nuevo', 'en progreso')");
        } else if (normalizedFilter === 'cerrados') {
            // Use SQL LOWER() to be case-insensitive against the DB column
            conditions.push("LOWER(status) = 'resuelto'");
        }

        // 2. Department Filter (if Admin)
        if (session.user.role === 'admin' && departmentFilter !== 'Todos') {
            conditions.push("department = ?");
            params.push(departmentFilter);
        } else if (session.user.role === 'supervisor' || session.user.role === 'funcionario') {
            // Supervisors see ALL tickets of their department.
            conditions.push("(department = ? OR supervisor = ?)");
            params.push(session.user.department, session.user.name);
        } else if (session.user.role === 'user') {
            conditions.push("requesterEmail = ?");
            params.push(session.user.email);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        console.log(`[Export] Query: ${query}`);
        console.log(`[Export] Params:`, params);

        const tickets = db.prepare(query).all(...params) as any[];

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
                'Content-Disposition': `attachment; filename="tickets_${filter}_${new Date().toISOString().split('T')[0]}.xlsx"`
            }
        });

    } catch (error: any) {
        console.error('Export Error:', error);
        return NextResponse.json({ error: 'Failed to export tickets' }, { status: 500 });
    }
}
