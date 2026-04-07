import { NextResponse, NextRequest } from 'next/server';
import { getSession } from '@/lib/auth-server';
import db from '@/lib/db';
import ExcelJS from 'exceljs';
import { parseDbJsonArray } from '@/lib/parse-db-json';

const SOL_STATUS_LABELS: Record<string, string> = {
    pending: 'Pendiente', ordered: 'Ordenada', fulfilled: 'Entregada',
};

export async function GET(request: NextRequest) {
    const session = await getSession(request);
    if (!session || !['admin', 'logistica', 'jefe'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const desde = searchParams.get('desde') || '';
    const hasta = searchParams.get('hasta') || '';
    const search = searchParams.get('search')?.toLowerCase() || '';

    try {
        // Fetch calendar events (entregas + despachos)
        const calConditions: string[] = [];
        const calParams: any[] = [];
        if (desde) { calConditions.push('fecha >= ?'); calParams.push(desde); }
        if (hasta) { calConditions.push('fecha <= ?'); calParams.push(hasta); }
        const calWhere = calConditions.length ? `WHERE ${calConditions.join(' AND ')}` : '';
        const calRows = await db.query(
            `SELECT * FROM logistica_calendario ${calWhere} ORDER BY fecha ASC`,
            calParams
        );

        // Fetch solicitudes
        const solConditions: string[] = [];
        const solParams: any[] = [];
        if (desde) { solConditions.push('needed_date >= ?'); solParams.push(desde); }
        if (hasta) { solConditions.push('needed_date <= ?'); solParams.push(hasta); }
        const solWhere = solConditions.length ? `WHERE ${solConditions.join(' AND ')}` : '';
        const solRows = await db.query(
            `SELECT * FROM material_requests ${solWhere} ORDER BY needed_date ASC`,
            solParams
        );

        const workbook = new ExcelJS.Workbook();
        const dateRange = `${desde || 'inicio'} → ${hasta || 'actualidad'}`;

        // ── Sheet 1: Entregas & Despachos ──────────────────────────────────
        const sheetCal = workbook.addWorksheet('Entregas y Despachos');
        sheetCal.mergeCells('A1:G1');
        const t1 = sheetCal.getCell('A1');
        t1.value = 'ENTREGAS Y DESPACHOS';
        t1.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        t1.alignment = { vertical: 'middle', horizontal: 'center' };
        t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        sheetCal.getRow(1).height = 28;

        sheetCal.mergeCells('A2:G2');
        const s1 = sheetCal.getCell('A2');
        s1.value = `Período: ${dateRange}`;
        s1.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };
        s1.alignment = { horizontal: 'center', vertical: 'middle' };

        sheetCal.getRow(4).values = ['Fecha', 'Tipo', 'Título / Proveedor', 'Artículo', 'Cantidad', 'Notas', 'Registrado por'];
        sheetCal.columns = [
            { key: 'fecha', width: 14 },
            { key: 'tipo', width: 13 },
            { key: 'titulo', width: 28 },
            { key: 'article', width: 38 },
            { key: 'quantity', width: 12 },
            { key: 'descripcion', width: 30 },
            { key: 'created_by', width: 22 },
        ];
        const hdr1 = sheetCal.getRow(4);
        hdr1.font = { name: 'Arial', bold: true, size: 10 };
        hdr1.alignment = { vertical: 'middle', horizontal: 'center' };
        hdr1.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'medium' }, right: { style: 'thin' } };
        });

        let row = 5;
        for (const ev of calRows as any[]) {
            // apply text filter
            const searchable = `${ev.titulo || ''} ${ev.descripcion || ''} ${ev.created_by || ''} ${ev.tipo || ''}`.toLowerCase();
            if (search && !searchable.includes(search)) continue;

            const items = parseDbJsonArray(ev.items);
            const tipo = ev.tipo === 'entrega' ? 'Entrega' : 'Despacho';
            const tipoColor = ev.tipo === 'entrega' ? 'FF22c55e' : 'FFe04951';

            if (items.length === 0) {
                const r = sheetCal.getRow(row);
                r.values = { fecha: ev.fecha, tipo, titulo: ev.titulo || '', article: '', quantity: '', descripcion: ev.descripcion || '', created_by: ev.created_by || '' };
                styleCalRow(r, row, tipoColor, sheetCal);
                row++;
            } else {
                for (const item of items) {
                    const r = sheetCal.getRow(row);
                    r.values = { fecha: ev.fecha, tipo, titulo: ev.titulo || '', article: item.article, quantity: item.quantity, descripcion: ev.descripcion || '', created_by: ev.created_by || '' };
                    styleCalRow(r, row, tipoColor, sheetCal);
                    row++;
                }
            }
        }
        sheetCal.autoFilter = `A4:G${Math.max(row - 1, 4)}`;

        // ── Sheet 2: Solicitudes ───────────────────────────────────────────
        const sheetSol = workbook.addWorksheet('Solicitudes de Materiales');
        sheetSol.mergeCells('A1:H1');
        const t2 = sheetSol.getCell('A1');
        t2.value = 'SOLICITUDES DE MATERIALES';
        t2.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        t2.alignment = { vertical: 'middle', horizontal: 'center' };
        t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        sheetSol.getRow(1).height = 28;

        sheetSol.mergeCells('A2:H2');
        const s2 = sheetSol.getCell('A2');
        s2.value = `Período: ${dateRange}`;
        s2.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };
        s2.alignment = { horizontal: 'center', vertical: 'middle' };

        sheetSol.getRow(4).values = ['Fecha', 'Cliente', 'Artículo', 'Cantidad', 'Estado', 'Solicitado por', 'Adjunto', 'Creación'];
        sheetSol.columns = [
            { key: 'fecha', width: 14 },
            { key: 'client', width: 25 },
            { key: 'article', width: 38 },
            { key: 'quantity', width: 12 },
            { key: 'status', width: 16 },
            { key: 'requested_by', width: 22 },
            { key: 'file_url', width: 12 },
            { key: 'created_at', width: 20 },
        ];
        const hdr2 = sheetSol.getRow(4);
        hdr2.font = { name: 'Arial', bold: true, size: 10 };
        hdr2.alignment = { vertical: 'middle', horizontal: 'center' };
        hdr2.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'medium' }, right: { style: 'thin' } };
        });

        let srow = 5;
        for (const sol of solRows as any[]) {
            const searchable = `${sol.client || ''} ${sol.requested_by || ''}`.toLowerCase();
            if (search && !searchable.includes(search)) continue;

            const parsedSol = parseDbJsonArray(sol.items);
            const items = parsedSol.length > 0 ? parsedSol : [{ article: sol.article, quantity: sol.quantity }];
            for (const item of items) {
                const r = sheetSol.getRow(srow);
                r.values = {
                    fecha: sol.needed_date,
                    client: sol.client || '',
                    article: item.article,
                    quantity: Number(item.quantity) || item.quantity,
                    status: SOL_STATUS_LABELS[sol.status] || sol.status,
                    requested_by: sol.requested_by || '',
                    file_url: sol.file_url ? 'Sí' : 'No',
                    created_at: new Date(sol.created_at).toLocaleDateString('es-UY'),
                };
                r.font = { name: 'Arial', size: 10 };
                r.alignment = { vertical: 'middle' };
                r.getCell('fecha').alignment = { horizontal: 'center', vertical: 'middle' };
                r.getCell('quantity').alignment = { horizontal: 'center', vertical: 'middle' };
                r.getCell('status').alignment = { horizontal: 'center', vertical: 'middle' };
                r.getCell('file_url').alignment = { horizontal: 'center', vertical: 'middle' };
                r.eachCell({ includeEmpty: true }, cell => {
                    cell.border = { top: { style: 'thin', color: { argb: 'FFCCCCCC' } }, bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } }, left: { style: 'thin', color: { argb: 'FFCCCCCC' } }, right: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
                });
                if (srow % 2 === 0) {
                    r.eachCell({ includeEmpty: true }, cell => {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };
                    });
                }
                srow++;
            }
        }
        sheetSol.autoFilter = `A4:H${Math.max(srow - 1, 4)}`;

        const buffer = await workbook.xlsx.writeBuffer();
        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Disposition': `attachment; filename="calendario-logistico-${new Date().toISOString().split('T')[0]}.xlsx"`,
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            },
        });
    } catch (err: any) {
        console.error('Calendario export error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

function styleCalRow(r: ExcelJS.Row, rowIdx: number, tipoColor: string, sheet: ExcelJS.Worksheet) {
    r.font = { name: 'Arial', size: 10 };
    r.alignment = { vertical: 'middle' };
    r.getCell('fecha').alignment = { horizontal: 'center', vertical: 'middle' };
    r.getCell('tipo').alignment = { horizontal: 'center', vertical: 'middle' };
    r.getCell('tipo').font = { name: 'Arial', size: 10, bold: true, color: { argb: tipoColor } };
    r.getCell('quantity').alignment = { horizontal: 'center', vertical: 'middle' };
    r.eachCell({ includeEmpty: true }, cell => {
        cell.border = { top: { style: 'thin', color: { argb: 'FFCCCCCC' } }, bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } }, left: { style: 'thin', color: { argb: 'FFCCCCCC' } }, right: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
    });
    if (rowIdx % 2 === 0) {
        r.eachCell({ includeEmpty: true }, cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        });
    }
}
