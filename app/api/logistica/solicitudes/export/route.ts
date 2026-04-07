import { NextResponse, NextRequest } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import ExcelJS from 'exceljs';
import { parseDbJsonArray } from '@/lib/parse-db-json';

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pendiente',
    ordered: 'Ordenada',
    fulfilled: 'Entregada',
};

async function checkAuth(request: NextRequest) {
    const session = await getSession(request);
    if (!session || !['admin', 'logistica', 'jefe'].includes(session.user.role)) return null;
    return session;
}

export async function GET(request: NextRequest) {
    const session = await checkAuth(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';

    const conditions: string[] = [];
    const params: any[] = [];

    if (dateFrom) { conditions.push('needed_date >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('needed_date <= ?'); params.push(dateTo); }

    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';

    try {
        const rows = await db.query(`SELECT * FROM material_requests${where} ORDER BY needed_date ASC`, params);
        
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Solicitudes de Materiales');

        // Main Title
        sheet.mergeCells('A1:H1');
        const titleCell = sheet.getCell('A1');
        titleCell.value = 'REPORTE: SOLICITUDES DE MATERIALES';
        titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Dark Slate

        // Subtitle Filters
        sheet.mergeCells('A2:H2');
        const subtitleCell = sheet.getCell('A2');
        subtitleCell.value = `Filtros Aplicados: ${dateFrom ? `Desde ${dateFrom}` : 'Inicio'} - ${dateTo ? `Hasta ${dateTo}` : 'Actualidad'}`;
        subtitleCell.font = { name: 'Arial', size: 10, italic: true };
        subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
        
        // Setup Columns
        sheet.getRow(4).values = ['ID Solicitud', 'Cliente / Ubic.', 'Fecha Necesaria', 'Artículo', 'Cantidad', 'Estado', 'Solicitado Por', 'Fecha Creación'];
        sheet.columns = [
            { key: 'id', width: 15 },
            { key: 'client', width: 30 },
            { key: 'needed_date', width: 18 },
            { key: 'article', width: 40 },
            { key: 'quantity', width: 12 },
            { key: 'status', width: 18 },
            { key: 'requested_by', width: 25 },
            { key: 'created_at', width: 22 },
        ];

        // Format Headers
        const headerRow = sheet.getRow(4);
        headerRow.font = { name: 'Arial', bold: true, size: 11, color: { argb: 'FF000000' } };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }; // Light Slate
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'medium' }, right: { style: 'thin' } };
        });

        // Add Data Rows
        let currentRow = 5;
        for (const row of rows) {
            const parsed = parseDbJsonArray(row.items);
            const items = parsed.length > 0 ? parsed : [{ article: row.article, quantity: row.quantity }];
            
            for (const item of items) {
                const r = sheet.getRow(currentRow);
                r.values = {
                    id: `REQ-${row.id}`,
                    client: row.client,
                    needed_date: row.needed_date,
                    article: item.article,
                    quantity: Number(item.quantity) || item.quantity,
                    status: STATUS_LABELS[row.status] || row.status,
                    requested_by: row.requested_by,
                    created_at: new Date(row.created_at).toLocaleString('es-UY'),
                };
                
                // Alignment and styles per cell
                r.font = { name: 'Arial', size: 10 };
                r.alignment = { vertical: 'middle' };
                r.getCell('id').alignment = { horizontal: 'center', vertical: 'middle' };
                r.getCell('id').font = { bold: true };
                r.getCell('needed_date').alignment = { horizontal: 'center', vertical: 'middle' };
                r.getCell('quantity').alignment = { horizontal: 'center', vertical: 'middle' };
                r.getCell('status').alignment = { horizontal: 'center', vertical: 'middle' };

                // Borders
                r.eachCell({ includeEmpty: true }, cell => {
                    cell.border = { top: { style: 'thin', color: { argb: 'FFCCCCCC' } }, bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } }, left: { style: 'thin', color: { argb: 'FFCCCCCC' } }, right: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
                });
                
                currentRow++;
            }
        }

        // Enable Autofilter
        sheet.autoFilter = `A4:H${currentRow - 1}`;
        
        // Optional: Alternate row colors
        for (let i = 5; i < currentRow; i++) {
            if (i % 2 === 0) {
                sheet.getRow(i).eachCell({ includeEmpty: true }, cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                });
            }
        }

        const buffer = await workbook.xlsx.writeBuffer();

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Disposition': `attachment; filename="solicitudes-materiales-${new Date().toISOString().split('T')[0]}.xlsx"`,
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            }
        });

    } catch (error: any) {
        console.error('Error exporting logistica solicitudes:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
