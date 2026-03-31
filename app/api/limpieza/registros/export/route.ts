import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import ExcelJS from 'exceljs';
import { getSession } from '@/lib/auth-server';

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
        const rows = await db.query(`SELECT * FROM limpieza_registros ${where} ORDER BY fecha DESC, created_at DESC`, params) as any[];

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Registros Limpieza');

        sheet.columns = [
            { header: 'ID', key: 'id', width: 8 },
            { header: 'Nombre', key: 'nombre', width: 25 },
            { header: 'Cédula', key: 'cedula', width: 15 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'Sector', key: 'sector', width: 20 },
            { header: 'Ubicación', key: 'ubicacion', width: 20 },
            { header: 'Fecha', key: 'fecha', width: 12 },
            { header: 'Hora Inicio', key: 'hora_inicio', width: 12 },
            { header: 'Hora Fin', key: 'hora_fin', width: 12 },
            { header: 'Tareas Realizadas', key: 'tareas', width: 40 },
            { header: 'Observaciones', key: 'observaciones', width: 35 },
            { header: 'Registrado', key: 'created_at', width: 20 },
        ];

        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
        sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        rows.forEach(r => {
            sheet.addRow({
                id: r.id,
                nombre: r.nombre,
                cedula: r.cedula,
                email: r.email || '-',
                sector: r.sector,
                ubicacion: r.ubicacion || '-',
                fecha: r.fecha,
                hora_inicio: r.hora_inicio || '-',
                hora_fin: r.hora_fin || '-',
                tareas: (() => { try { return JSON.parse(r.tareas || '[]').join(', ') || '-'; } catch { return r.tareas || '-'; } })(),
                observaciones: r.observaciones || '-',
                created_at: r.created_at ? new Date(r.created_at).toLocaleString('es-UY') : '-',
            });
        });

        const today = new Date().toISOString().split('T')[0];
        const buffer = await workbook.xlsx.writeBuffer();

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="registros_limpieza_${today}.xlsx"`,
            },
        });
    } catch (error: any) {
        console.error('Export error:', error);
        return NextResponse.json({ error: 'Error al exportar' }, { status: 500 });
    }
}
