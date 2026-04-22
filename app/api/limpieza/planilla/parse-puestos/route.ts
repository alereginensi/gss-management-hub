import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import * as XLSX from 'xlsx';
import db from '@/lib/db';

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

// "Turno 06 a 14" → "6 A 14". Quita prefijo "Turno" (con o sin espacio), uniforma caps y ceros leading.
function normalizeTurno(raw: string): string {
  return raw
    .replace(/^\s*turno\s*/i, '')
    .replace(/\s+a\s+/i, ' A ')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b0+(\d)/g, '$1');
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
    // Nuevo flujo: acepta solo el Panel Mitrabajo. El mapeo (Lugar en sistema →
    // Puesto/Turno/Sector) vive en la tabla limpieza_puestos y se configura desde
    // el editor de planillas. Mantengo `file` como alias de `panel` para
    // compatibilidad hacia atrás con modales viejos.
    const panelFile = (form.get('panel') || form.get('file')) as File | null;
    const cliente = String(form.get('cliente') || '').trim();
    if (!panelFile) return NextResponse.json({ error: 'Archivo del Panel requerido' }, { status: 400 });
    if (!cliente) return NextResponse.json({ error: 'Cliente requerido' }, { status: 400 });

    // Leer mapping desde limpieza_puestos del cliente seleccionado
    const mappingRows = await db.query(
      `SELECT p.id, p.turno, p.nombre AS lugar_planilla, p.lugar_sistema, s.name AS sector
       FROM limpieza_puestos p
       JOIN limpieza_sectores s ON s.id = p.sector_id
       JOIN limpieza_clientes c ON c.id = s.cliente_id
       WHERE p.active = 1 AND s.active = 1 AND c.active = 1 AND LOWER(c.name) = LOWER(?)
         AND p.lugar_sistema IS NOT NULL AND p.lugar_sistema <> ''`,
      [cliente]
    );

    // Indexar mapping por normalizeLocal(lugar_sistema).
    // Normalizar también el turno del mapping (DB puede tener turnos cargados
    // con el bug anterior "TURNO22 A 6" → queda limpio como "22 A 6").
    const mappingIndex = new Map<string, { sheet: string; lugar_planilla: string; turno: string; lugar_sistema: string }[]>();
    for (const r of mappingRows as any[]) {
      const key = normalizeLocal(r.lugar_sistema);
      if (!key) continue;
      if (!mappingIndex.has(key)) mappingIndex.set(key, []);
      mappingIndex.get(key)!.push({
        sheet: r.sector,
        lugar_planilla: r.lugar_planilla,
        turno: normalizeTurno(r.turno),
        lugar_sistema: r.lugar_sistema,
      });
    }

    // Si no hay ni un solo mapping con lugar_sistema cargado, avisar al user
    if (mappingIndex.size === 0) {
      return NextResponse.json({
        error: `No hay "Lugar en sistema" cargado para los puestos del cliente "${cliente}". Cargá el mapeo desde el Editor de Planillas antes de subir el Panel.`,
      }, { status: 400 });
    }

    // Estructura de sheets: una por sector único del mapping
    const sectorNames = Array.from(new Set((mappingRows as any[]).map(r => r.sector)));
    const sheets: ParsedSheet[] = sectorNames.map(name => ({ name, rows: [], missing_headers: [] }));

    // Parsear Panel Mitrabajo (soporta .xls y .xlsx usando SheetJS)
    const panelBuf = Buffer.from(await panelFile.arrayBuffer());
    const panelWb = XLSX.read(panelBuf, { type: 'buffer' });
    const firstSheet = panelWb.SheetNames[0];
    if (!firstSheet) return NextResponse.json({ error: 'El panel no tiene hojas' }, { status: 400 });
    const pWs = panelWb.Sheets[firstSheet];
    const panelRows = XLSX.utils.sheet_to_json<any[]>(pWs, { header: 1, defval: '' });

    // Detectar cabecera del panel (primer row con "local" + "ci" + "nombre")
    let pHeaderIdx = -1;
    const pCols: Record<string, number> = {};
    for (let r = 0; r < Math.min(panelRows.length, 5); r++) {
      const row = panelRows[r] || [];
      const keys: Record<string, number> = {};
      for (let c = 0; c < row.length; c++) {
        const k = normKey(row[c]);
        if (k && !(k in keys)) keys[k] = c;
      }
      if (keys['local'] !== undefined && keys['ci'] !== undefined && keys['nombre'] !== undefined) {
        pHeaderIdx = r;
        Object.assign(pCols, keys);
        break;
      }
    }
    if (pHeaderIdx < 0) {
      return NextResponse.json({ error: 'El Panel no tiene cabecera con Local, CI y Nombre.' }, { status: 400 });
    }
    const cLocal = pCols['local'];
    const cCI = pCols['ci'] !== undefined ? pCols['ci'] : (pCols['cedula'] !== undefined ? pCols['cedula'] : pCols['documento']);
    const cNombrePanel = pCols['nombre'];
    const cFechaPanel = pCols['fecha'];
    const cCategoriaPanel = pCols['categoria'];
    const cEntrada = pCols['entradaplanificada'] !== undefined ? pCols['entradaplanificada'] : pCols['entrada'];
    const cSalida = pCols['salidaplanificada'] !== undefined ? pCols['salidaplanificada'] : pCols['salida'];

    let matched = 0;
    let discarded = 0;
    let panelTotalRows = 0;
    const discardedSamples: string[] = [];
    const fechasSet = new Set<string>();

    for (let r = pHeaderIdx + 1; r < panelRows.length; r++) {
      const row = panelRows[r] || [];
      const getV = (c: number | undefined) => c !== undefined ? cellText(row[c]) : '';
      const local = getV(cLocal);
      const ci = getV(cCI);
      const rawNombre = getV(cNombrePanel);
      if (!local && !ci && !rawNombre) continue;
      if (!local || !ci || !rawNombre) continue;

      panelTotalRows++;
      const key = normalizeLocal(local);
      const matches = mappingIndex.get(key);
      if (!matches || !matches.length) {
        discarded++;
        if (discardedSamples.length < 8 && !discardedSamples.includes(local)) discardedSamples.push(local);
        continue;
      }
      const entrada = getV(cEntrada);
      const salida = getV(cSalida);
      const turnoPanel = turnoFromHorario(entrada, salida);
      const m = matches.find(t => t.turno === turnoPanel) || matches[0];
      const sheet = sheets.find(s => s.name === m.sheet);
      if (!sheet) continue;

      const nombre = rawNombre.replace(/\s*\([Ss]\)/g, '').replace(/\s*\(\d+\)/g, '').trim();
      const fecha = parseFechaPanel(getV(cFechaPanel));
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
        categoria: getV(cCategoriaPanel) || undefined,
        fecha: fecha || undefined,
        raw: {},
      });
      matched++;
    }

    const fechasDetectadas = [...fechasSet].sort();
    const totalRows = sheets.reduce((sum, s) => sum + s.rows.length, 0);
    return NextResponse.json({
      sheets: sheets.filter(s => s.rows.length > 0),
      total_rows: totalRows,
      mode: 'crossed',
      panel_stats: { panel_total: panelTotalRows, matched, discarded, discarded_samples: discardedSamples, fechas_detectadas: fechasDetectadas },
    });
  } catch (err: any) {
    console.error('Error parse planilla:', err);
    return NextResponse.json({ error: err.message || 'Error al leer el Excel' }, { status: 500 });
  }
}
