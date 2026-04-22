import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import ExcelJS from 'exceljs';

const ALLOWED_ROLES = ['admin', 'jefe', 'supervisor'];

// Normaliza keys de cabecera: quita tildes, espacios y pasa a minúsculas
function normKey(s: any): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function cellText(v: any): string {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.richText) v = v.richText.map((p: any) => p.text).join('');
    else if (v.text !== undefined) v = v.text;
    else if (v.result !== undefined) v = v.result;
  }
  return String(v).trim();
}

// "Turno 06 a 14" → "06 A 14". Quita prefijo "Turno " y uniforma caps/espacios.
function normalizeTurno(raw: string): string {
  return raw
    .replace(/^\s*turno\s+/i, '')
    .replace(/\s+a\s+/i, ' A ')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

interface ParsedRow {
  lugar_sistema: string;
  lugar_planilla: string;
  turno: string;
  turno_raw: string;
  frecuencia: string;
  cantidad: number;
  funcionario_nombre?: string;
  funcionario_cedula?: string;
  raw: Record<string, string>;
}
interface ParsedSheet {
  name: string;
  rows: ParsedRow[];
  missing_headers: string[];
}

// POST /api/limpieza/planilla/parse-puestos
// multipart/form-data: file=<xlsx>
// Devuelve preview por hoja sin persistir nada.
// Reconoce columnas con varios aliases:
//   - "lugar en sistema" | "lugar" → lugar_sistema (descripción larga del puesto)
//   - "lugar en planilla" | "titular" | "puesto" → lugar_planilla (nombre del puesto en la app)
//   - "turno" → turno
//   - "frecuencia" | "frec" → frecuencia
//   - "persona" | "personas" | "cantidad" → cantidad (default 1)
//   - "funcionario" | "nombre" | "apellido y nombre" → funcionario_nombre (opcional)
//   - "documento" | "cedula" | "ci" → funcionario_cedula (opcional)
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);

    const sheets: ParsedSheet[] = [];

    for (const ws of wb.worksheets) {
      // Detectar fila de cabecera (hasta 15 filas): busca "lugar" o "titular" o "puesto"
      let headerRow = 0;
      const colMap: Record<string, number> = {};
      for (let r = 1; r <= Math.min(ws.rowCount, 15); r++) {
        const row = ws.getRow(r);
        const keys: Record<string, number> = {};
        for (let c = 1; c <= Math.min(ws.columnCount, 30); c++) {
          const k = normKey(row.getCell(c).value);
          if (k && !keys[k]) keys[k] = c;
        }
        const hasLugar = !!(keys['lugarenplanilla'] || keys['titular'] || keys['puesto']);
        const hasSistema = !!(keys['lugarensistema'] || keys['lugar'] || keys['sector']);
        if (hasLugar && hasSistema) {
          headerRow = r;
          Object.assign(colMap, keys);
          break;
        }
      }

      if (!headerRow) {
        sheets.push({ name: ws.name, rows: [], missing_headers: ['lugar_sistema', 'lugar_planilla'] });
        continue;
      }

      const cLugarSistema = colMap['lugarensistema'] || colMap['lugar'] || colMap['sector'] || 0;
      const cLugarPlanilla = colMap['lugarenplanilla'] || colMap['titular'] || colMap['puesto'] || 0;
      const cTurno = colMap['turno'] || 0;
      const cFrecuencia = colMap['frecuencia'] || colMap['frec'] || 0;
      const cCantidad = colMap['persona'] || colMap['personas'] || colMap['cantidad'] || 0;
      const cNombre = colMap['funcionario'] || colMap['nombre'] || colMap['nombrecompleto'] || colMap['apellidoynombre'] || 0;
      const cCedula = colMap['documento'] || colMap['cedula'] || colMap['ci'] || colMap['ciudadania'] || 0;

      const rows: ParsedRow[] = [];
      for (let r = headerRow + 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const get = (c: number) => c ? cellText(row.getCell(c).value) : '';
        const lugar_sistema = get(cLugarSistema);
        const lugar_planilla = get(cLugarPlanilla);
        const turno_raw = get(cTurno);
        if (!lugar_sistema && !lugar_planilla) continue; // fila vacía
        if (!lugar_planilla) continue; // sin nombre de puesto no sirve

        const cantidadRaw = get(cCantidad);
        const cantidad = Math.max(1, parseInt(cantidadRaw, 10) || 1);

        rows.push({
          lugar_sistema,
          lugar_planilla,
          turno: normalizeTurno(turno_raw),
          turno_raw,
          frecuencia: get(cFrecuencia),
          cantidad,
          funcionario_nombre: get(cNombre) || undefined,
          funcionario_cedula: get(cCedula) || undefined,
          raw: {},
        });
      }
      sheets.push({ name: ws.name, rows, missing_headers: [] });
    }

    // Totales
    const totalRows = sheets.reduce((sum, s) => sum + s.rows.length, 0);
    return NextResponse.json({ sheets, total_rows: totalRows });
  } catch (err: any) {
    console.error('Error parse planilla:', err);
    return NextResponse.json({ error: err.message || 'Error al leer el Excel' }, { status: 500 });
  }
}
