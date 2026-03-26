import { NextResponse, NextRequest } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import ExcelJS from 'exceljs';

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pendiente',
    in_transit: 'En tránsito',
    delivered: 'Entregado',
    issue: 'Con problema',
};

export async function GET(request: NextRequest) {
    const session = await getSession(request);
    if (!session || !['admin', 'logistica'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';

    const conditions: string[] = [];
    const params: any[] = [];
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (dateFrom) { conditions.push('date_sent >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('date_sent <= ?'); params.push(dateTo); }

    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';

    try {
        const rows = await db.query(
            `SELECT * FROM logistics_shipments${where} ORDER BY date_sent DESC, created_at DESC`,
            params
        );

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Envíos DAC');

        const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF29416B' } };
        const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };

        sheet.columns = [
            { header: 'Nº Seguimiento', key: 'tracking_number', width: 20, numFmt: '@' },
            { header: 'Destinatario',   key: 'recipient',        width: 28, numFmt: '@' },
            { header: 'Destino',        key: 'destination',      width: 22, numFmt: '@' },
            { header: 'Fecha Envío',    key: 'date_sent',        width: 14, numFmt: '@' },
            { header: 'Estado',         key: 'status',           width: 14, numFmt: '@' },
            { header: 'Peso (kg)',      key: 'weight',           width: 11 },
            { header: 'Valor ($)',      key: 'declared_value',   width: 13 },
            { header: 'Descripción',    key: 'description',      width: 30, numFmt: '@' },
            { header: 'Creado por',     key: 'created_by',       width: 18, numFmt: '@' },
        ];

        sheet.getRow(1).eachCell(cell => {
            cell.fill = headerFill;
            cell.font = headerFont;
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
        sheet.getRow(1).height = 22;

        for (const row of rows) {
            sheet.addRow({
                tracking_number: String(row.tracking_number || ''),
                recipient:       String(row.recipient),
                destination:     String(row.destination),
                date_sent:       String(row.date_sent),
                status:          String(STATUS_LABELS[row.status] || row.status),
                weight:          row.weight != null ? parseFloat(row.weight) : null,
                declared_value:  row.declared_value != null ? parseFloat(row.declared_value) : null,
                description:     String(row.description || ''),
                created_by:      String(row.created_by || ''),
            });
        }

        // Alternate row shading
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1 && rowNumber % 2 === 0) {
                row.eachCell(cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } };
                });
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const today = new Date().toISOString().split('T')[0];

        return new NextResponse(buffer as any, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="envios-dac-${today}.xlsx"`,
            },
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
