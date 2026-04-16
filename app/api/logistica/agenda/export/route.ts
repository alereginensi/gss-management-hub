import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { parseOrderItems } from '@/lib/agenda-helpers';
import ExcelJS from 'exceljs';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'rrhh'];

// Convención uruguaya: "Apellido1 Apellido2 Nombre1 Nombre2".
// Si hay ≥4 tokens, últimos 2 = nombre; si menos, último = nombre.
function splitNombre(full: string | null | undefined): { apellido: string; nombre: string } {
  if (!full) return { apellido: '', nombre: '' };
  const tokens = String(full).trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { apellido: '', nombre: '' };
  if (tokens.length === 1) return { apellido: tokens[0], nombre: '' };
  const nombreCount = tokens.length >= 4 ? 2 : 1;
  const nombre = tokens.slice(-nombreCount).join(' ');
  const apellido = tokens.slice(0, tokens.length - nombreCount).join(' ');
  return { apellido, nombre };
}

function fmtFechaDMY(raw: string | null | undefined): string {
  if (!raw) return '';
  const s = String(raw);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

function fmtFechaHoraDMY(raw: string | null | undefined): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return String(raw);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  let h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'p. m.' : 'a. m.';
  h = h % 12 || 12;
  return `${dd}/${mm}/${yyyy}, ${String(h).padStart(2, '0')}:${min} ${ampm}`;
}

function fmtItemLine(i: any): string {
  if (!i) return '';
  const name = i.article_type || i.article_name_normalized || i.item || i.name || 'Artículo';
  const size = i.size || '';
  const color = i.color || '';
  const parts: string[] = [];
  if (size) parts.push(`Talla: ${size}`);
  if (color) parts.push(`Color: ${color}`);
  return parts.length ? `${name} — ${parts.join(', ')}` : name;
}

// GET /api/logistica/agenda/export?type=citas|empleados|entregas&from=&to=&empresa=
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const origin = request.nextUrl.origin;
  const toAbsolute = (u: string | null | undefined): string => {
    if (!u) return '';
    const s = String(u).trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith('/')) return `${origin}${s}`;
    return `${origin}/${s}`;
  };
  const type = searchParams.get('type') || 'citas';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const empresa = searchParams.get('empresa') || '';
  const status = searchParams.get('status') || '';
  const search = searchParams.get('search') || '';

  type ColDef = { header: string; key: string; width?: number; wrap?: boolean };

  const buildSheet = (wb: ExcelJS.Workbook, name: string, columns: ColDef[], rows: any[]) => {
    const ws = wb.addWorksheet(name, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    ws.columns = columns.map(c => ({
      header: c.header,
      key: c.key,
      width: c.width ?? Math.max(c.header.length + 2, 12),
    }));
    rows.forEach(r => {
      const row = ws.addRow(r);
      columns.forEach((c, idx) => {
        if (c.wrap) {
          row.getCell(idx + 1).alignment = { vertical: 'middle', wrapText: true };
        } else {
          row.getCell(idx + 1).alignment = { vertical: 'middle' };
        }
      });
    });

    const header = ws.getRow(1);
    header.height = 24;
    header.eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1B2A4A' },
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    if (columns.length > 0) {
      const lastCol = ws.getColumn(columns.length).letter;
      const lastRow = Math.max(ws.rowCount, 1);
      ws.autoFilter = { from: `A1`, to: `${lastCol}${lastRow}` };
    }

    for (let r = 2; r <= ws.rowCount; r++) {
      if (r % 2 === 0) {
        ws.getRow(r).eachCell(cell => {
          if (!cell.fill || (cell.fill as any).type !== 'pattern' || !(cell.fill as any).fgColor) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF5F7FA' },
            };
          }
        });
      }
    }
    return ws;
  };

  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'GSS Management Hub';
    wb.created = new Date();

    let filename = 'exportacion.xlsx';

    if (type === 'citas') {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (from) { conditions.push('s.fecha >= ?'); params.push(from); }
      if (to) { conditions.push('s.fecha <= ?'); params.push(to); }
      if (empresa) { conditions.push('e.empresa = ?'); params.push(empresa); }
      if (status) { conditions.push('a.status = ?'); params.push(status); }
      if (search) {
        conditions.push('(LOWER(e.nombre) LIKE ? OR LOWER(e.documento) LIKE ?)');
        params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const data = await db.query(
        `SELECT a.id, a.status, a.remito_number, a.remito_pdf_url, a.delivered_at,
                a.employee_signature_url, a.responsible_signature_url,
                e.nombre, e.documento, e.empresa, e.sector, e.puesto,
                s.fecha, s.start_time, s.end_time,
                a.order_items, a.delivered_order_items, a.delivery_notes
         FROM agenda_appointments a
         JOIN agenda_employees e ON e.id = a.employee_id
         JOIN agenda_time_slots s ON s.id = a.time_slot_id
         ${where} ORDER BY s.fecha DESC`,
        params
      );

      const rows = data.map((r: any) => {
        const { apellido, nombre } = splitNombre(r.nombre);
        const pedidos = parseOrderItems(r.order_items).map(fmtItemLine).filter(Boolean).join('\n');
        const entregados = parseOrderItems(r.delivered_order_items).map(fmtItemLine).filter(Boolean).join('\n');
        const horario = `${r.start_time || ''} - ${r.end_time || ''}`.trim();
        return {
          documento: r.documento || '',
          apellido,
          nombre,
          empresa: r.empresa || '',
          cargo: r.puesto || '',
          fecha_turno: fmtFechaDMY(r.fecha),
          horario_turno: horario === '-' ? '' : horario,
          fecha_entrega: fmtFechaHoraDMY(r.delivered_at),
          prendas_solicitadas: pedidos,
          prendas_entregadas: entregados,
          remito: r.remito_pdf_url
            ? { text: 'Ver remito', hyperlink: toAbsolute(r.remito_pdf_url), tooltip: 'Abrir remito' }
            : (r.remito_number || ''),
          firma: r.employee_signature_url
            ? { text: 'Ver firma', hyperlink: toAbsolute(r.employee_signature_url), tooltip: 'Abrir firma' }
            : '',
        };
      });

      const columns: ColDef[] = [
        { header: 'Documento', key: 'documento', width: 14 },
        { header: 'Apellido', key: 'apellido', width: 18 },
        { header: 'Nombre', key: 'nombre', width: 18 },
        { header: 'Empresa', key: 'empresa', width: 12 },
        { header: 'Cargo', key: 'cargo', width: 24 },
        { header: 'Fecha turno', key: 'fecha_turno', width: 14 },
        { header: 'Horario turno', key: 'horario_turno', width: 16 },
        { header: 'Fecha entrega', key: 'fecha_entrega', width: 18 },
        { header: 'Prendas solicitadas', key: 'prendas_solicitadas', width: 42, wrap: true },
        { header: 'Prendas entregadas', key: 'prendas_entregadas', width: 42, wrap: true },
        { header: 'Remito', key: 'remito', width: 50 },
        { header: 'Firma', key: 'firma', width: 50 },
      ];
      buildSheet(wb, 'Entregas', columns, rows);
      filename = `agenda_entregas_${new Date().toISOString().split('T')[0]}.xlsx`;

    } else if (type === 'empleados') {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (empresa) { conditions.push('empresa = ?'); params.push(empresa); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const data = await db.query(`SELECT * FROM agenda_employees ${where} ORDER BY nombre ASC`, params);
      const rows = data.map((r: any) => {
        const { apellido, nombre } = splitNombre(r.nombre);
        return {
          id: r.id,
          documento: r.documento,
          apellido,
          nombre,
          empresa: r.empresa || '',
          sector: r.sector || '',
          puesto: r.puesto || '',
          categoria: r.workplace_category || '',
          fecha_ingreso: r.fecha_ingreso || '',
          talle_sup: r.talle_superior || '',
          talle_inf: r.talle_inferior || '',
          calzado: r.calzado || '',
          habilitado: r.enabled ? 'Sí' : 'No',
          estado: r.estado,
          observaciones: r.observaciones || '',
          creado: r.created_at,
        };
      });
      const columns: ColDef[] = [
        { header: 'ID', key: 'id', width: 8 },
        { header: 'Documento', key: 'documento', width: 14 },
        { header: 'Apellido', key: 'apellido', width: 18 },
        { header: 'Nombre', key: 'nombre', width: 18 },
        { header: 'Empresa', key: 'empresa', width: 12 },
        { header: 'Sector', key: 'sector', width: 16 },
        { header: 'Puesto', key: 'puesto', width: 18 },
        { header: 'Categoría', key: 'categoria', width: 16 },
        { header: 'Fecha ingreso', key: 'fecha_ingreso', width: 14 },
        { header: 'Talle sup.', key: 'talle_sup', width: 10 },
        { header: 'Talle inf.', key: 'talle_inf', width: 10 },
        { header: 'Calzado', key: 'calzado', width: 10 },
        { header: 'Habilitado', key: 'habilitado', width: 12 },
        { header: 'Estado', key: 'estado', width: 12 },
        { header: 'Observaciones', key: 'observaciones', width: 40, wrap: true },
        { header: 'Creado', key: 'creado', width: 18 },
      ];
      buildSheet(wb, 'Empleados', columns, rows);
      filename = `agenda_empleados_${new Date().toISOString().split('T')[0]}.xlsx`;

    } else if (type === 'entregas') {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (from) { conditions.push('a.delivery_date >= ?'); params.push(from); }
      if (to) { conditions.push('a.delivery_date <= ?'); params.push(to); }
      if (empresa) { conditions.push('e.empresa = ?'); params.push(empresa); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const data = await db.query(
        `SELECT a.*, e.nombre, e.documento, e.empresa
         FROM agenda_articles a JOIN agenda_employees e ON e.id = a.employee_id
         ${where} ORDER BY a.delivery_date DESC`,
        params
      );
      const rows = data.map((r: any) => {
        const { apellido, nombre } = splitNombre(r.nombre);
        return {
          id: r.id,
          documento: r.documento,
          apellido,
          nombre,
          empresa: r.empresa || '',
          articulo: r.article_type,
          talle: r.size || '',
          fecha_entrega: fmtFechaDMY(r.delivery_date),
          vida_util: r.useful_life_months,
          vencimiento: fmtFechaDMY(r.expiration_date),
          estado_articulo: r.current_status,
          condicion: r.condition_status,
          origen: r.origin_type,
          notas: r.notes || '',
          migrado: r.migrated_flag ? 'Sí' : 'No',
        };
      });
      const columns: ColDef[] = [
        { header: 'ID', key: 'id', width: 8 },
        { header: 'Documento', key: 'documento', width: 14 },
        { header: 'Apellido', key: 'apellido', width: 18 },
        { header: 'Nombre', key: 'nombre', width: 18 },
        { header: 'Empresa', key: 'empresa', width: 12 },
        { header: 'Artículo', key: 'articulo', width: 30 },
        { header: 'Talle', key: 'talle', width: 10 },
        { header: 'Fecha entrega', key: 'fecha_entrega', width: 14 },
        { header: 'Vida útil (meses)', key: 'vida_util', width: 14 },
        { header: 'Vencimiento', key: 'vencimiento', width: 14 },
        { header: 'Estado artículo', key: 'estado_articulo', width: 14 },
        { header: 'Condición', key: 'condicion', width: 14 },
        { header: 'Origen', key: 'origen', width: 12 },
        { header: 'Notas', key: 'notas', width: 40, wrap: true },
        { header: 'Migrado', key: 'migrado', width: 10 },
      ];
      buildSheet(wb, 'Entregas', columns, rows);
      filename = `agenda_entregas_${new Date().toISOString().split('T')[0]}.xlsx`;
    }

    const arrayBuffer = await wb.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer as ArrayBuffer);

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('Error exportando:', err);
    return NextResponse.json({ error: 'Error interno al exportar' }, { status: 500 });
  }
}
