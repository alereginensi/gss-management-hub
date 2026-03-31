import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

async function getRate(categoryId: number | null, date: string) {
    if (!categoryId) return null;
    return db.get(
        `SELECT * FROM billing_rates WHERE category_id = ? AND valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?) ORDER BY valid_from DESC LIMIT 1`,
        [categoryId, date, date]
    ) as Promise<any>;
}

function computeCost(entry: any, rate: any) {
    if (!rate) return 0;
    const base = parseFloat(rate.rate) || 0;
    const mult = parseFloat(rate.overtime_multiplier) || 1.5;
    const ss = parseFloat(rate.social_security_pct) || 0;
    const bp = parseFloat(rate.bonus_provisions_pct) || 0;
    const subtotal = (parseFloat(entry.regular_hours) || 0) * base + (parseFloat(entry.overtime_hours) || 0) * base * mult;
    return Math.round(subtotal * (1 + (ss + bp) / 100) * 100) / 100;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession(request);
    if (!session || !['admin', 'contador'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await params;
        const period = await db.get('SELECT * FROM billing_periods WHERE id = ?', [id]) as any;
        if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 });

        const entries = await db.query(
            `SELECT be.*, bc.name as category_name
             FROM billing_entries be
             LEFT JOIN billing_categories bc ON be.category_id = bc.id
             WHERE be.period_id = ?
             ORDER BY be.date, be.funcionario`,
            [id]
        ) as any[];

        const entriesWithCost = await Promise.all(entries.map(async (e) => {
            const rate = await getRate(e.category_id, e.date);
            return { ...e, estimated_cost: computeCost(e, rate) };
        }));

        const Excel = (await import('exceljs')).default;
        const workbook = new Excel.Workbook();

        const headerStyle: Partial<any> = {
            font: { bold: true, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF29416B' } },
            alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
            border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
        };
        const cellStyle: Partial<any> = {
            alignment: { vertical: 'top', wrapText: true },
            border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
        };

        // --- Sheet 1: Resumen ---
        const summarySheet = workbook.addWorksheet('Resumen');
        summarySheet.columns = [
            { header: 'Categoría', key: 'category', width: 25 },
            { header: 'Funcionarios', key: 'employees', width: 15 },
            { header: 'Horas Regulares', key: 'regular', width: 18 },
            { header: 'Horas Extra', key: 'overtime', width: 15 },
            { header: 'Total Horas', key: 'total', width: 15 },
            { header: 'Costo Estimado', key: 'cost', width: 18 },
        ];
        summarySheet.getRow(1).eachCell(cell => Object.assign(cell, headerStyle));
        summarySheet.getRow(1).height = 28;

        // Group by category
        const byCategory: Record<string, any> = {};
        for (const e of entriesWithCost) {
            const key = e.category_name || 'Sin categoría';
            if (!byCategory[key]) byCategory[key] = { employees: new Set(), regular: 0, overtime: 0, cost: 0 };
            byCategory[key].employees.add(e.funcionario);
            byCategory[key].regular += parseFloat(e.regular_hours) || 0;
            byCategory[key].overtime += parseFloat(e.overtime_hours) || 0;
            byCategory[key].cost += e.estimated_cost;
        }

        let totalHours = 0, totalCost = 0;
        for (const [cat, data] of Object.entries(byCategory) as any[]) {
            const row = summarySheet.addRow({
                category: cat, employees: data.employees.size,
                regular: data.regular, overtime: data.overtime,
                total: data.regular + data.overtime, cost: Math.round(data.cost * 100) / 100
            });
            row.eachCell(cell => Object.assign(cell, cellStyle));
            totalHours += data.regular + data.overtime;
            totalCost += data.cost;
        }

        // Totals row
        const totalsRow = summarySheet.addRow({
            category: 'TOTAL', employees: new Set(entriesWithCost.map((e: any) => e.funcionario)).size,
            regular: entriesWithCost.reduce((s: number, e: any) => s + (parseFloat(e.regular_hours) || 0), 0),
            overtime: entriesWithCost.reduce((s: number, e: any) => s + (parseFloat(e.overtime_hours) || 0), 0),
            total: totalHours, cost: Math.round(totalCost * 100) / 100
        });
        totalsRow.font = { bold: true };
        totalsRow.eachCell(cell => Object.assign(cell, { ...cellStyle, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } } }));

        // Period info at top
        summarySheet.insertRow(1, []);
        summarySheet.insertRow(1, [`Período: ${period.label}   |   ${period.date_from} → ${period.date_to}   |   Estado: ${period.status}`]);
        summarySheet.getRow(1).font = { bold: true, size: 12 };
        summarySheet.mergeCells(1, 1, 1, 6);
        summarySheet.insertRow(2, []);

        // --- Sheet 2: Detalle ---
        const detailSheet = workbook.addWorksheet('Detalle');
        detailSheet.columns = [
            { header: 'Fecha', key: 'date', width: 14 },
            { header: 'Funcionario', key: 'funcionario', width: 28 },
            { header: 'Categoría', key: 'category_name', width: 22 },
            { header: 'Ubicación', key: 'location', width: 22 },
            { header: 'Sector', key: 'sector', width: 18 },
            { header: 'Tipo Servicio', key: 'service_type', width: 18 },
            { header: 'Hs Regulares', key: 'regular_hours', width: 14 },
            { header: 'Hs Extra', key: 'overtime_hours', width: 12 },
            { header: 'Total Hs', key: 'total_hours', width: 12 },
            { header: 'Costo Est.', key: 'estimated_cost', width: 14 },
            { header: 'Fuente', key: 'source', width: 12 },
            { header: 'Notas', key: 'notes', width: 25 },
        ];
        detailSheet.getRow(1).eachCell(cell => Object.assign(cell, headerStyle));
        detailSheet.getRow(1).height = 28;

        for (const e of entriesWithCost) {
            const row = detailSheet.addRow({
                ...e,
                total_hours: (parseFloat(e.regular_hours) || 0) + (parseFloat(e.overtime_hours) || 0),
                category_name: e.category_name || '-'
            });
            row.eachCell(cell => Object.assign(cell, cellStyle));
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const filename = `Liquidacion_${period.label.replace(/[^a-zA-Z0-9]/g, '_')}_${period.date_from}.xlsx`;

        return new NextResponse(buffer as any, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`
            }
        });
    } catch (error: any) {
        console.error('Export error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
