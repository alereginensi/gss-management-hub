import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import ExcelJS from 'exceljs';

async function requireAdmin(request: NextRequest) {
  const session = await getSession(request);
  if (!session || session.user.role !== 'admin') return null;
  return session;
}

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

function normalizeTurno(raw: string): string {
  return raw
    .replace(/^\s*turno\s*/i, '') // "Turno 06 a 14", "Turno22 A 6", "TURNO 14 A 22" → sin prefix
    .replace(/\s+a\s+/i, ' A ')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b0+(\d)/g, '$1'); // quitar ceros leading: "06" → "6"
}

function normNombre(s: string): string {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// POST /api/limpieza/admin/puestos/import-mapeo
// multipart/form-data: file=<xlsx>, cliente_id=<id>, apply=<'0'|'1'>
// Si apply='0' (default): modo DRY-RUN, solo analiza y devuelve preview.
// Si apply='1': aplica los UPDATE a limpieza_puestos.lugar_sistema.
// Match por sector (hoja) + turno + nombre del puesto. Lo no matchéado se reporta.
export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    const clienteIdRaw = form.get('cliente_id');
    const clienteId = clienteIdRaw ? parseInt(String(clienteIdRaw), 10) : null;
    const apply = form.get('apply') === '1';
    if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    if (!clienteId) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 });

    // Traer sectores + puestos del cliente
    const sectores = await db.query(
      'SELECT id, name FROM limpieza_sectores WHERE cliente_id = ? AND active = 1',
      [clienteId]
    );
    const puestos = await db.query(
      `SELECT p.id, p.sector_id, p.turno, p.nombre, s.name AS sector_name
       FROM limpieza_puestos p
       JOIN limpieza_sectores s ON s.id = p.sector_id
       WHERE s.cliente_id = ? AND p.active = 1 AND s.active = 1`,
      [clienteId]
    );

    // Indexar puestos por (sector_norm + turno_norm + nombre_norm)
    interface PuestoInfo { id: number; sector_name: string; turno: string; nombre: string; lugar_sistema?: string | null; }
    const puestoIndex = new Map<string, PuestoInfo>();
    const sectorByName = new Map<string, string>();
    for (const s of sectores as any[]) {
      sectorByName.set(normNombre(s.name), s.name);
    }
    const puestosWithLS = await db.query(
      `SELECT p.id, p.sector_id, p.turno, p.nombre, p.lugar_sistema, s.name AS sector_name
       FROM limpieza_puestos p
       JOIN limpieza_sectores s ON s.id = p.sector_id
       WHERE s.cliente_id = ? AND p.active = 1 AND s.active = 1`,
      [clienteId]
    );
    for (const p of puestosWithLS as any[]) {
      const key = `${normNombre(p.sector_name)}|${normalizeTurno(p.turno)}|${normNombre(p.nombre)}`;
      puestoIndex.set(key, { id: p.id, sector_name: p.sector_name, turno: p.turno, nombre: p.nombre, lugar_sistema: p.lugar_sistema });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);

    let updated = 0;
    let skipped = 0;
    const unmatched: { sheet: string; turno: string; puesto: string; lugar_sistema: string }[] = [];
    const matches: { puesto_id: number; sector: string; turno: string; nombre: string; lugar_sistema_actual: string | null; lugar_sistema_nuevo: string }[] = [];
    const seenPuestoIds = new Set<number>();

    for (const ws of wb.worksheets) {
      // Detectar cabecera. Si hay 2 columnas llamadas "Turno" (ej hoja Torre 2
      // Sanatorio donde la primera es FRECUENCIA y la segunda el turno real),
      // usamos la última ocurrencia para "turno".
      let hdrRow = 0;
      const cols: Record<string, number> = {};
      let turnoLast = 0;
      for (let r = 1; r <= Math.min(ws.rowCount, 15); r++) {
        const row = ws.getRow(r);
        const keys: Record<string, number> = {};
        let localTurnoLast = 0;
        for (let c = 1; c <= Math.min(ws.columnCount, 30); c++) {
          const k = normKey(row.getCell(c).value);
          if (!k) continue;
          if (k === 'turno') { localTurnoLast = c; }
          if (!keys[k]) keys[k] = c;
        }
        const hasLP = !!(keys['lugarenplanilla'] || keys['titular'] || keys['puesto']);
        const hasLS = !!(keys['lugarensistema'] || keys['lugar'] || keys['sector']);
        if (hasLP && hasLS) {
          hdrRow = r;
          Object.assign(cols, keys);
          turnoLast = localTurnoLast;
          break;
        }
      }
      if (!hdrRow) continue;

      const cLS = cols['lugarensistema'] || cols['lugar'] || cols['sector'];
      const cLP = cols['lugarenplanilla'] || cols['titular'] || cols['puesto'];
      // Si hay 2 columnas "Turno", usar la última (la derecha suele ser el turno real)
      const cT = turnoLast || cols['turno'];

      // Buscar el sector correspondiente al nombre de la hoja. Si no matchea
      // exacto, intentar por contenido (ej hoja "Planillas Asilo" contiene "Asilo").
      const sheetNameNorm = normNombre(ws.name);
      let targetSector = sectorByName.get(sheetNameNorm);
      if (!targetSector) {
        for (const [sn, sname] of sectorByName) {
          if (sheetNameNorm.includes(sn) || sn.includes(sheetNameNorm)) {
            targetSector = sname;
            break;
          }
        }
      }
      if (!targetSector) continue; // hoja no matchea ningún sector del cliente

      for (let r = hdrRow + 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const get = (c: number) => c ? cellText(row.getCell(c).value) : '';
        const lugar_sistema = get(cLS);
        const lugar_planilla = get(cLP);
        const turno_raw = get(cT);
        if (!lugar_sistema || !lugar_planilla) continue;

        const turno = normalizeTurno(turno_raw);
        const key = `${normNombre(targetSector)}|${turno}|${normNombre(lugar_planilla)}`;
        const pInfo = puestoIndex.get(key);
        if (!pInfo) {
          unmatched.push({ sheet: ws.name, turno, puesto: lugar_planilla, lugar_sistema });
          skipped++;
          continue;
        }
        // Evitar duplicados: si el mismo puesto ya fue listado (varias filas con mismo nombre en el Excel)
        if (seenPuestoIds.has(pInfo.id)) continue;
        seenPuestoIds.add(pInfo.id);

        matches.push({
          puesto_id: pInfo.id,
          sector: pInfo.sector_name,
          turno: pInfo.turno,
          nombre: pInfo.nombre,
          lugar_sistema_actual: pInfo.lugar_sistema || null,
          lugar_sistema_nuevo: lugar_sistema,
        });
        if (apply) {
          await db.run('UPDATE limpieza_puestos SET lugar_sistema = ? WHERE id = ?', [lugar_sistema, pInfo.id]);
          updated++;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      mode: apply ? 'applied' : 'preview',
      updated,
      skipped,
      matches_count: matches.length,
      matches,
      unmatched,
    });
  } catch (e: any) {
    console.error('Error import-mapeo:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
