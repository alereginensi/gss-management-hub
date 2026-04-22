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
  categoria?: string;
  fecha?: string;
  raw: Record<string, string>;
}
interface ParsedSheet {
  name: string;
  rows: ParsedRow[];
  missing_headers: string[];
}

// Normaliza "Local" del panel y "Lugar en sistema" del template para matching.
// Quita "Casmu 2" / "Casmu" prefix, tildes, dashes, dobles espacios.
function normalizeLocal(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\bcasmu\s*2\b/g, '')
    .replace(/\bcasmu\b/g, '')
    .replace(/[\-\/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Convierte entrada/salida planificada del panel (HH:MM) a turno tipo "6 A 14"
function turnoFromHorario(entrada: string, salida: string): string {
  if (!entrada || !salida) return '';
  const e = entrada.split(':')[0].replace(/^0+/, '') || '0';
  const s = salida.split(':')[0].replace(/^0+/, '') || '0';
  if (e === '0' && salida === '23:59') return ''; // supervisor sin turno fijo
  return `${e} A ${s}`;
}

// DD/MM/YYYY → YYYY-MM-DD
function parseFechaPanel(raw: string): string {
  const m = String(raw || '').trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!m) return '';
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
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
    const panelFile = form.get('panel') as File | null;
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

    // Si vino también el Panel de Control (Mitrabajo), cruzar funcionarios reales
    // con la estructura del template. Por cada row del panel que matchee un
    // "Lugar en sistema" → crear row en el sheet correspondiente con los datos
    // reales del funcionario. Rows del panel sin match → descartadas.
    let matched = 0;
    let discarded = 0;
    let panelTotalRows = 0;
    const discardedSamples: string[] = [];
    let mode: 'template' | 'crossed' = 'template';
    let fechasDetectadas: string[] = [];

    if (panelFile) {
      mode = 'crossed';
      const panelBuf = Buffer.from(await panelFile.arrayBuffer());
      const panelWb = new ExcelJS.Workbook();
      await panelWb.xlsx.load(panelBuf as any);
      const pWs = panelWb.worksheets[0];
      if (!pWs) return NextResponse.json({ error: 'El panel no tiene hojas' }, { status: 400 });

      // Detectar cabecera del panel (primer row con "local" + "ci" + "nombre")
      let pHeaderRow = 0;
      const pCols: Record<string, number> = {};
      for (let r = 1; r <= Math.min(pWs.rowCount, 5); r++) {
        const row = pWs.getRow(r);
        const keys: Record<string, number> = {};
        for (let c = 1; c <= Math.min(pWs.columnCount, 40); c++) {
          const k = normKey(row.getCell(c).value);
          if (k && !keys[k]) keys[k] = c;
        }
        if (keys['local'] && keys['ci'] && keys['nombre']) {
          pHeaderRow = r;
          Object.assign(pCols, keys);
          break;
        }
      }
      if (!pHeaderRow) {
        return NextResponse.json({ error: 'El panel no tiene cabecera con Local, CI y Nombre.' }, { status: 400 });
      }
      const cLocal = pCols['local'];
      const cCI = pCols['ci'] || pCols['cedula'] || pCols['documento'];
      const cNombrePanel = pCols['nombre'];
      const cFechaPanel = pCols['fecha'];
      const cCategoriaPanel = pCols['categoria'];
      const cEntrada = pCols['entradaplanificada'] || pCols['entrada'];
      const cSalida = pCols['salidaplanificada'] || pCols['salida'];

      // Indexar template por normalizeLocal(lugar_sistema)
      const index = new Map<string, { sheet: string; lugar_planilla: string; turno: string; lugar_sistema: string }[]>();
      for (const s of sheets) {
        for (const r of s.rows) {
          const key = normalizeLocal(r.lugar_sistema);
          if (!key) continue;
          if (!index.has(key)) index.set(key, []);
          index.get(key)!.push({ sheet: s.name, lugar_planilla: r.lugar_planilla, turno: r.turno, lugar_sistema: r.lugar_sistema });
        }
      }

      // Limpiar rows del template (vamos a poblarlas solo con matches del panel)
      for (const s of sheets) s.rows = [];

      const fechasSet = new Set<string>();

      for (let r = pHeaderRow + 1; r <= pWs.rowCount; r++) {
        const row = pWs.getRow(r);
        const get = (c: number) => c ? cellText(row.getCell(c).value) : '';
        const local = get(cLocal);
        const ci = get(cCI);
        const rawNombre = get(cNombrePanel);
        if (!local && !ci && !rawNombre) continue; // fila vacía
        if (!local || !ci || !rawNombre) continue;

        panelTotalRows++;
        const key = normalizeLocal(local);
        const matches = index.get(key);
        if (!matches || !matches.length) {
          discarded++;
          if (discardedSamples.length < 8) discardedSamples.push(local);
          continue;
        }
        const entrada = get(cEntrada);
        const salida = get(cSalida);
        const turnoPanel = turnoFromHorario(entrada, salida);
        // Elegir match: por turno si coincide, sino el primero
        const m = matches.find(t => t.turno === turnoPanel) || matches[0];
        const sheet = sheets.find(s => s.name === m.sheet);
        if (!sheet) continue;

        // Limpiar sufijos tipo "Nombre (S) (1234)"
        const nombre = rawNombre.replace(/\s*\([Ss]\)/g, '').replace(/\s*\(\d+\)/g, '').trim();
        const fecha = parseFechaPanel(get(cFechaPanel));
        if (fecha) fechasSet.add(fecha);

        sheet.rows.push({
          lugar_sistema: m.lugar_sistema,
          lugar_planilla: m.lugar_planilla,
          turno: turnoPanel || m.turno,
          turno_raw: `${entrada}-${salida}`,
          frecuencia: '',
          cantidad: 1,
          funcionario_nombre: nombre || undefined,
          funcionario_cedula: ci || undefined,
          categoria: get(cCategoriaPanel) || undefined,
          fecha: fecha || undefined,
          raw: {},
        });
        matched++;
      }
      fechasDetectadas = [...fechasSet].sort();
    }

    // Totales
    const totalRows = sheets.reduce((sum, s) => sum + s.rows.length, 0);
    return NextResponse.json({
      sheets,
      total_rows: totalRows,
      mode,
      panel_stats: panelFile ? { panel_total: panelTotalRows, matched, discarded, discarded_samples: discardedSamples, fechas_detectadas: fechasDetectadas } : null,
    });
  } catch (err: any) {
    console.error('Error parse planilla:', err);
    return NextResponse.json({ error: err.message || 'Error al leer el Excel' }, { status: 500 });
  }
}
