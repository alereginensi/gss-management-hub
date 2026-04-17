import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import ExcelJS from 'exceljs';
import { calcHorasTrabajadas, normalizarCategoria } from '@/lib/limpieza-hours';

const ALLOWED_ROLES = ['admin', 'jefe', 'supervisor', 'encargado_limpieza'];

// GET /api/limpieza/planilla/export/versus?fecha=&cliente=
// Agrega por (fecha, sector, turno) con cantidad de funcionarios y horas totales
// desagregadas por categoría (AUXILIAR, LIMPIADOR, VIDRIERO, ENCARGADO).
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fecha = searchParams.get('fecha') || '';
  let cliente = searchParams.get('cliente') || '';
  const from = searchParams.get('from') || fecha;
  const to = searchParams.get('to') || fecha;

  const sUser: any = session.user;
  if (sUser.role === 'encargado_limpieza' && sUser.cliente_asignado) {
    cliente = sUser.cliente_asignado;
  }

  if (!cliente || !from || !to) {
    return NextResponse.json({ error: 'Parámetros requeridos: cliente + fecha (o from/to)' }, { status: 400 });
  }

  try {
    const rows = await db.query(
      `SELECT * FROM limpieza_asistencia
       WHERE cliente = ? AND fecha >= ? AND fecha <= ?
       ORDER BY fecha, sector, seccion`,
      [cliente, from, to]
    );

    // Agregación por (fecha, sector, seccion)
    type Agg = {
      fecha: string;
      sector: string;
      turno: string;
      cantFunc: number;
      horasTotal: number;
      horasAuxiliar: number;
      horasLimpiador: number;
      horasVidriero: number;
      horasEncargado: number;
    };
    const agg = new Map<string, Agg>();
    for (const r of rows as any[]) {
      if (r.asistio !== 1) continue;
      const key = `${r.fecha}|${r.sector || ''}|${r.seccion || ''}`;
      let a = agg.get(key);
      if (!a) {
        a = {
          fecha: r.fecha,
          sector: r.sector || '',
          turno: r.seccion || '',
          cantFunc: 0,
          horasTotal: 0,
          horasAuxiliar: 0,
          horasLimpiador: 0,
          horasVidriero: 0,
          horasEncargado: 0,
        };
        agg.set(key, a);
      }
      const horas = calcHorasTrabajadas(r);
      a.cantFunc += 1;
      a.horasTotal += horas;
      const cat = normalizarCategoria(r.categoria || r.puesto);
      if (cat === 'AUXILIAR') a.horasAuxiliar += horas;
      else if (cat === 'LIMPIADOR') a.horasLimpiador += horas;
      else if (cat === 'VIDRIERO') a.horasVidriero += horas;
      else if (cat === 'ENCARGADO') a.horasEncargado += horas;
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'GSS Centro de Gestión';
    const ws = wb.addWorksheet(`VERSUS ${cliente}`.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] });

    const columns = [
      { header: 'DIA', key: 'fecha', width: 14 },
      { header: 'SECTOR', key: 'sector', width: 28 },
      { header: 'TURNO', key: 'turno', width: 12 },
      { header: 'CANT. FUNC. GSS', key: 'cantFunc', width: 14 },
      { header: 'CANT. FUNC. CLIENTE', key: 'cantFuncCliente', width: 18 },
      { header: 'HORAS GSS', key: 'horasGss', width: 12 },
      { header: 'HORAS CLIENTE', key: 'horasCliente', width: 14 },
      { header: 'HORAS AUXILIAR', key: 'horasAuxiliar', width: 14 },
      { header: 'HORAS LIMPIADOR', key: 'horasLimpiador', width: 14 },
      { header: 'HORAS VIDRIERO', key: 'horasVidriero', width: 14 },
      { header: 'HORAS ENCARGADO', key: 'horasEncargado', width: 14 },
      { header: 'VALIDACION', key: 'validacion', width: 12 },
    ];
    ws.columns = columns.map(c => ({ header: c.header, key: c.key, width: c.width }));

    let totCant = 0, totH = 0, totAux = 0, totLim = 0, totVid = 0, totEnc = 0;
    const aggList = Array.from(agg.values()).sort((x, y) => (x.fecha + x.sector + x.turno).localeCompare(y.fecha + y.sector + y.turno));
    aggList.forEach((a, i) => {
      const row = ws.addRow({
        fecha: a.fecha,
        sector: a.sector,
        turno: a.turno,
        cantFunc: a.cantFunc,
        cantFuncCliente: '',
        horasGss: a.horasTotal,
        horasCliente: '',
        horasAuxiliar: a.horasAuxiliar,
        horasLimpiador: a.horasLimpiador,
        horasVidriero: a.horasVidriero,
        horasEncargado: a.horasEncargado,
        validacion: '',
      });
      const rowIdx = i + 2;
      row.getCell('validacion').value = { formula: `F${rowIdx}-G${rowIdx}`, result: a.horasTotal };
      totCant += a.cantFunc;
      totH += a.horasTotal;
      totAux += a.horasAuxiliar;
      totLim += a.horasLimpiador;
      totVid += a.horasVidriero;
      totEnc += a.horasEncargado;
    });

    if (aggList.length > 0) {
      const totalRow = ws.addRow({
        fecha: '',
        sector: `TOTAL ${cliente.toUpperCase()}`,
        turno: '',
        cantFunc: totCant,
        cantFuncCliente: '',
        horasGss: totH,
        horasCliente: '',
        horasAuxiliar: totAux,
        horasLimpiador: totLim,
        horasVidriero: totVid,
        horasEncargado: totEnc,
        validacion: '',
      });
      totalRow.eachCell(cell => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7CC' } };
      });
    }

    // Formato header
    const header = ws.getRow(1);
    header.height = 24;
    header.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2A4A' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    const lastCol = ws.getColumn(columns.length).letter;
    ws.autoFilter = { from: 'A1', to: `${lastCol}${Math.max(ws.rowCount, 1)}` };

    const buffer = Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="versus_${cliente}_${from}_${to}.xlsx"`,
      },
    });
  } catch (err: any) {
    console.error('Error export versus:', err);
    return NextResponse.json({ error: err.message || 'Error al exportar' }, { status: 500 });
  }
}
