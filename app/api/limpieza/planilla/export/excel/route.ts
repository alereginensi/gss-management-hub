import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import ExcelJS from 'exceljs';
import { calcHorasTrabajadas } from '@/lib/limpieza-hours';

const ALLOWED_ROLES = ['admin', 'jefe', 'supervisor', 'encargado_limpieza'];

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fecha = searchParams.get('fecha') || '';
  let cliente = searchParams.get('cliente') || '';
  let sector = searchParams.get('sector') || '';
  const seccion = searchParams.get('seccion') || '';

  if (!fecha) return NextResponse.json({ error: 'Fecha requerida' }, { status: 400 });

  const sUser: any = session.user;
  if (sUser.role === 'encargado_limpieza') {
    if (sUser.cliente_asignado) cliente = sUser.cliente_asignado;
    if (sUser.sector_asignado) sector = sUser.sector_asignado;
  }

  const conditions: string[] = ['fecha = ?'];
  const params: unknown[] = [fecha];
  if (cliente) { conditions.push('cliente = ?'); params.push(cliente); }
  if (sector) { conditions.push('sector = ?'); params.push(sector); }
  if (seccion) { conditions.push('seccion = ?'); params.push(seccion); }
  const where = `WHERE ${conditions.join(' AND ')}`;

  try {
    const rows = await db.query(
      `SELECT * FROM limpieza_asistencia ${where} ORDER BY seccion, puesto, nombre`,
      params
    );

    const wb = new ExcelJS.Workbook();
    wb.creator = 'GSS Management Hub';
    const ws = wb.addWorksheet('Planilla', { views: [{ state: 'frozen', ySplit: 1 }] });

    type Col = { header: string; key: string; width: number };
    const columns: Col[] = [
      { header: 'Fecha', key: 'fecha', width: 12 },
      { header: 'Turno', key: 'seccion', width: 14 },
      { header: 'Cliente', key: 'cliente', width: 16 },
      { header: 'Sector', key: 'sector', width: 18 },
      { header: 'Puesto', key: 'puesto', width: 18 },
      { header: 'Categoría', key: 'categoria', width: 14 },
      { header: 'Documento', key: 'cedula', width: 14 },
      { header: 'Nombre', key: 'nombre', width: 30 },
      { header: 'Planificado', key: 'planificado', width: 12 },
      { header: 'Asistió', key: 'asistio', width: 10 },
      { header: 'Entrada 1', key: 'entrada1', width: 11 },
      { header: 'Salida 1', key: 'salida1', width: 11 },
      { header: 'Entrada 2', key: 'entrada2', width: 11 },
      { header: 'Salida 2', key: 'salida2', width: 11 },
      { header: 'Horas', key: 'horas', width: 10 },
      { header: 'Firma', key: 'firma', width: 14 },
      { header: 'Observaciones', key: 'observaciones', width: 32 },
    ];
    ws.columns = columns.map(c => ({ header: c.header, key: c.key, width: c.width }));

    rows.forEach((r: any) => {
      const horas = r.asistio === 1 ? calcHorasTrabajadas(r) : 0;
      ws.addRow({
        fecha: r.fecha,
        seccion: r.seccion,
        cliente: r.cliente || '',
        sector: r.sector || '',
        puesto: r.puesto || '',
        categoria: r.categoria || '',
        cedula: r.cedula || '',
        nombre: r.nombre || '',
        planificado: r.planificado ? 'Sí' : 'No',
        asistio: r.asistio === 1 ? 'Sí' : r.asistio === 0 ? 'No' : '',
        entrada1: r.entrada1 || '',
        salida1: r.salida1 || '',
        entrada2: r.entrada2 || '',
        salida2: r.salida2 || '',
        horas,
        firma: r.firma ? 'Sí' : '',
        observaciones: r.observaciones || '',
      });
    });

    const header = ws.getRow(1);
    header.height = 22;
    header.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2A4A' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    const lastCol = ws.getColumn(columns.length).letter;
    ws.autoFilter = { from: 'A1', to: `${lastCol}${Math.max(ws.rowCount, 1)}` };

    for (let r = 2; r <= ws.rowCount; r++) {
      if (r % 2 === 0) {
        ws.getRow(r).eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } };
        });
      }
    }

    const buffer = Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="planilla_${cliente || 'general'}_${fecha}.xlsx"`,
      },
    });
  } catch (err: any) {
    console.error('Error export excel planilla:', err);
    return NextResponse.json({ error: err.message || 'Error al exportar' }, { status: 500 });
  }
}
