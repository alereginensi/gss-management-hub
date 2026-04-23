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

// Parsea un turno tipo "6 A 14" → { start: 6, end: 14 }. Devuelve null si no es numérico.
// Para turnos que cruzan medianoche ("22 A 6" → end=6+24=30) devuelve end > 24.
function parseTurnoRango(t: string): { start: number; end: number } | null {
  const m = t.match(/^(\d+)\s*A\s*(\d+)$/i);
  if (!m) return null;
  const start = parseInt(m[1], 10);
  let end = parseInt(m[2], 10);
  if (end <= start) end += 24;
  return { start, end };
}

// Dado un turno del Excel y los turnos configurados del sector, devuelve el
// turno estándar cuyo rango cubre la hora de inicio del turno del Excel.
// Ej: "13 A 19" y ["6 A 14", "14 A 22", "22 A 6"] → "6 A 14" (porque 13 ∈ [6, 14)).
// Si el turno del Excel ya existe en la lista, devuelve el mismo.
// Si no es numérico (ej "HEMOTERAPIA") o no hay match, devuelve null.
function findMatchingStandardTurno(turnoExcel: string, turnosEstandar: string[]): string | null {
  const norm = normalizeTurno(turnoExcel);
  // Match exacto primero
  for (const t of turnosEstandar) {
    if (normalizeTurno(t) === norm) return t;
  }
  const nuevo = parseTurnoRango(norm);
  if (!nuevo) return null;
  // Probar contención: start del turno nuevo debe caer en [std.start, std.end)
  for (const t of turnosEstandar) {
    const std = parseTurnoRango(normalizeTurno(t));
    if (!std) continue;
    let hora = nuevo.start;
    // Ajustar si el turno estándar cruza medianoche y la hora es AM (ej "22 A 6", hora=2)
    if (std.end > 24 && hora < std.start) hora += 24;
    if (hora >= std.start && hora < std.end) return t;
  }
  return null;
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
    const createMissing = form.get('create_missing') === '1';
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
    // Turnos conocidos por sector (para reasignación de turnos no-estándar)
    const turnosPorSector = new Map<string, Set<string>>();
    for (const p of puestosWithLS as any[]) {
      const key = `${normNombre(p.sector_name)}|${normalizeTurno(p.turno)}|${normNombre(p.nombre)}`;
      puestoIndex.set(key, { id: p.id, sector_name: p.sector_name, turno: p.turno, nombre: p.nombre, lugar_sistema: p.lugar_sistema });
      const sectorKey = normNombre(p.sector_name);
      if (!turnosPorSector.has(sectorKey)) turnosPorSector.set(sectorKey, new Set());
      turnosPorSector.get(sectorKey)!.add(p.turno);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);

    let updated = 0;
    let skipped = 0;
    let created = 0;
    let createdSectors = 0;
    const unmatched: { sheet: string; turno: string; puesto: string; lugar_sistema: string }[] = [];
    const matches: { puesto_id: number; sector: string; turno: string; nombre: string; lugar_sistema_actual: string | null; lugar_sistema_nuevo: string }[] = [];
    const toCreate: { sector: string; turno: string; nombre: string; lugar_sistema: string; sector_exists: boolean; turno_original?: string }[] = [];
    const seenPuestoIds = new Set<number>();
    const plannedCreate = new Set<string>(); // sector|turno|nombre ya agendado para crear
    const reassigned: { sector: string; turno_original: string; turno_final: string; puesto: string }[] = [];

    // Indexar sectores existentes por norm para crear los faltantes si hace falta
    const sectoresMap = new Map<string, { id: number; name: string }>();
    for (const s of sectores as any[]) {
      sectoresMap.set(normNombre(s.name), { id: s.id, name: s.name });
    }

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
      // Si createMissing y la hoja no matchea con ningún sector existente,
      // usar el nombre de la hoja como sector target (se creará si hace falta).
      if (!targetSector && createMissing) {
        targetSector = ws.name;
      }
      if (!targetSector) continue; // hoja no matchea ningún sector del cliente

      for (let r = hdrRow + 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const get = (c: number) => c ? cellText(row.getCell(c).value) : '';
        const lugar_sistema = get(cLS);
        const lugar_planilla = get(cLP);
        const turno_raw = get(cT);
        if (!lugar_sistema || !lugar_planilla) continue;

        const turnoOriginal = normalizeTurno(turno_raw);
        // Reasignar turnos no-estándar al turno configurado cuyo rango cubra la hora de inicio.
        // Ej: "13 A 19" no existe en el sector pero "6 A 14" sí → usar "6 A 14".
        const sectorKey = normNombre(targetSector);
        const turnosConocidos = [...(turnosPorSector.get(sectorKey) || new Set<string>())];
        let turno = turnoOriginal;
        const matchingStd = findMatchingStandardTurno(turnoOriginal, turnosConocidos);
        if (matchingStd && normalizeTurno(matchingStd) !== turnoOriginal) {
          turno = normalizeTurno(matchingStd);
          reassigned.push({ sector: targetSector, turno_original: turnoOriginal, turno_final: turno, puesto: lugar_planilla });
        }
        const key = `${sectorKey}|${turno}|${normNombre(lugar_planilla)}`;
        const pInfo = puestoIndex.get(key);
        if (!pInfo) {
          // Puesto inexistente: registrar en unmatched siempre; si createMissing,
          // agendar su creación (dedup por key para no crear duplicados del mismo puesto).
          if (createMissing && !plannedCreate.has(key)) {
            plannedCreate.add(key);
            const sectorExists = sectoresMap.has(sectorKey);
            toCreate.push({
              sector: targetSector, turno, nombre: lugar_planilla, lugar_sistema, sector_exists: sectorExists,
              turno_original: turnoOriginal !== turno ? turnoOriginal : undefined,
            });
          }
          unmatched.push({ sheet: ws.name, turno: turnoOriginal, puesto: lugar_planilla, lugar_sistema });
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

    // Si apply y createMissing, crear sectores/puestos faltantes
    if (apply && createMissing && toCreate.length > 0) {
      const isPg = (db as any).type === 'pg';
      for (const c of toCreate) {
        let sectorId: number | undefined;
        const existingSector = sectoresMap.get(normNombre(c.sector));
        if (existingSector) {
          sectorId = existingSector.id;
        } else {
          // Crear sector
          const sectorRes = await db.run(
            'INSERT INTO limpieza_sectores (cliente_id, name) VALUES (?, ?)',
            [clienteId, c.sector]
          );
          if (isPg) {
            const r = await db.get(
              'SELECT id FROM limpieza_sectores WHERE cliente_id = ? AND name = ? ORDER BY id DESC LIMIT 1',
              [clienteId, c.sector]
            );
            sectorId = r?.id;
          } else {
            sectorId = sectorRes.lastInsertRowid as number;
          }
          if (sectorId) {
            sectoresMap.set(normNombre(c.sector), { id: sectorId, name: c.sector });
            createdSectors++;
          }
        }
        if (!sectorId) continue;
        // Crear puesto
        await db.run(
          'INSERT INTO limpieza_puestos (sector_id, turno, nombre, cantidad, orden, lugar_sistema) VALUES (?, ?, ?, 1, 0, ?)',
          [sectorId, c.turno, c.nombre, c.lugar_sistema]
        );
        created++;
      }
    }

    return NextResponse.json({
      ok: true,
      mode: apply ? 'applied' : 'preview',
      updated,
      created,
      createdSectors,
      skipped,
      matches_count: matches.length,
      to_create_count: toCreate.length,
      matches,
      to_create: toCreate,
      unmatched,
      reassigned,
    });
  } catch (e: any) {
    console.error('Error import-mapeo:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
