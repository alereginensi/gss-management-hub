import { NextResponse, NextRequest } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import ExcelJS from 'exceljs';

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pendiente', approved: 'Aprobada', paid: 'Pagada',
    cancelled: 'Anulada', partial_received: 'Recibida parcial', received: 'Recibida total',
};
const STATUS_FILL: Record<string, string> = {
    pending:          'FFFEF3C7',
    approved:         'FFD6E4FF',
    paid:             'FFD1FAE5',
    cancelled:        'FFFEE2E2',
    partial_received: 'FFEDE9FE',
    received:         'FFD1FAE5',
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
    if (dateFrom) { conditions.push('issue_date >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('issue_date <= ?'); params.push(dateTo); }
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';

    try {
        const orders = await db.query(`SELECT * FROM purchase_orders${where} ORDER BY issue_date DESC`, params);

        const wb = new ExcelJS.Workbook();
        const sheet = wb.addWorksheet('Órdenes de Compra');

        sheet.columns = [
            { header: 'ID Compra',      key: 'order_number',   width: 16, numFmt: '0' },
            { header: 'Adenda ID',      key: 'adenda_id',      width: 12, numFmt: '0' },
            { header: 'RUT Emisor',     key: 'rut_emisor',     width: 18, numFmt: '0' },
            { header: 'RUT Comprador',  key: 'rut_comprador',  width: 18, numFmt: '0' },
            { header: 'Comprador',      key: 'buyer_name',     width: 28, numFmt: '@' },
            { header: 'Fecha Emisión',  key: 'issue_date',     width: 14, numFmt: '@' },
            { header: 'Fecha Venc.',    key: 'due_date',       width: 14, numFmt: '@' },
            { header: 'Estado',         key: 'status',         width: 14, numFmt: '@' },
            { header: 'Neto Básica',    key: 'neto_basica',    width: 14 },
            { header: 'Neto Mínima',    key: 'neto_minima',    width: 14 },
            { header: 'IVA Básica',     key: 'iva_basica',     width: 14 },
            { header: 'IVA Mínima',     key: 'iva_minima',     width: 14 },
            { header: 'Descuentos',     key: 'discounts',      width: 14 },
            { header: 'Total',          key: 'total_amount',   width: 14 },
            { header: 'Notas',          key: 'notes',          width: 30, numFmt: '@' },
            { header: 'Creado por',     key: 'created_by',     width: 18, numFmt: '@' },
        ];

        // Header style
        sheet.getRow(1).eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF29416B' } };
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
        sheet.getRow(1).height = 22;

        for (const o of orders) {
            const row = sheet.addRow({
                order_number: o.order_number ? (Number(o.order_number) || o.order_number) : '',
                adenda_id: o.adenda_id ? (Number(o.adenda_id) || o.adenda_id) : '',
                rut_emisor: o.rut_emisor ? (Number(o.rut_emisor) || o.rut_emisor) : '',
                rut_comprador: o.rut_comprador ? (Number(o.rut_comprador) || o.rut_comprador) : '',
                buyer_name: o.buyer_name || '',
                issue_date: o.issue_date || '',
                due_date: o.due_date || '',
                status: STATUS_LABELS[o.status] || o.status,
                neto_basica: o.neto_basica != null ? Number(o.neto_basica) : '',
                neto_minima: o.neto_minima != null ? Number(o.neto_minima) : '',
                iva_basica: o.iva_basica != null ? Number(o.iva_basica) : '',
                iva_minima: o.iva_minima != null ? Number(o.iva_minima) : '',
                discounts: o.discounts != null ? Number(o.discounts) : '',
                total_amount: o.total_amount != null ? Number(o.total_amount) : '',
                notes: o.notes || '',
                created_by: o.created_by || '',
            });

            // Force integer format on ID/RUT cells to avoid scientific notation
            for (const key of ['order_number', 'adenda_id', 'rut_emisor', 'rut_comprador']) {
                const cell = row.getCell(sheet.getColumn(key).number);
                if (cell.value !== '') cell.numFmt = '0';
            }

            // Color status cell
            const statusCol = sheet.getColumn('status').number;
            const statusCell = row.getCell(statusCol);
            const fill = STATUS_FILL[o.status];
            if (fill) {
                statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
            }
        }

        const buf = await wb.xlsx.writeBuffer();
        return new NextResponse(buf, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="ordenes-compra.xlsx"`,
            },
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
