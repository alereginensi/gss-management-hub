/**
 * Parser compartido entre el endpoint de import real y el de preview.
 * Lo que ve el usuario en el preview es EXACTAMENTE lo que se va a insertar.
 */

import * as XLSX from 'xlsx';
import { SECTORES, normalizeTipoLicencia, type TipoLicencia } from './licencias-helpers';

export interface LicenciaParseada {
  remitente: string;
  padron: string | null;
  funcionario: string;
  nombre_servicio: string | null;
  sector: string | null;
  tipo_licencia: TipoLicencia;
  desde: string | null;
  hasta: string | null;
  suplente: string | null;
  recep_notificacion: 0 | 1;
  supervision: 0 | 1;
  recep_certificado: 0 | 1;
  planificacion: 0 | 1;
  observaciones: string | null;
}

export interface ParseResult {
  validas: LicenciaParseada[];
  errores: string[];
  totalFilas: number;
  descartadas: number;
}

export type ImportStrategy = 'merge' | 'replace' | 'upsert';

/**
 * Clasifica las licencias parseadas contra la DB actual usando
 * `(funcionario + desde + tipo_licencia)` como clave lógica.
 * Devuelve las que ya existen (para UPDATE) y las que son nuevas (INSERT).
 *
 * Ignora filas sin `desde` — si no tiene fecha no hay forma de matchear
 * unicamente; van todas a `nuevas` (se insertan).
 */
export async function detectarMatchesContraDB(
  validas: LicenciaParseada[],
  dbInstance: { get: (sql: string, params: unknown[]) => Promise<{ id?: number } | null> },
): Promise<{ nuevas: LicenciaParseada[]; actualizaciones: Array<{ id: number; data: LicenciaParseada }> }> {
  const nuevas: LicenciaParseada[] = [];
  const actualizaciones: Array<{ id: number; data: LicenciaParseada }> = [];

  for (const v of validas) {
    if (!v.desde) {
      nuevas.push(v);
      continue;
    }
    try {
      const existing = await dbInstance.get(
        `SELECT id FROM rrhh_licencias
         WHERE LOWER(TRIM(funcionario)) = LOWER(TRIM(?))
           AND desde = ?
           AND tipo_licencia = ?
         LIMIT 1`,
        [v.funcionario, v.desde, v.tipo_licencia],
      );
      if (existing?.id) {
        actualizaciones.push({ id: existing.id, data: v });
      } else {
        nuevas.push(v);
      }
    } catch {
      // Si la query falla, tratamos como nueva (lado seguro: no rompe import).
      nuevas.push(v);
    }
  }

  return { nuevas, actualizaciones };
}

const SECTOR_SET = new Set<string>(SECTORES);

const MESES: Record<string, number> = {
  // Español
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, set: 9, sep: 9, oct: 10, nov: 11, dic: 12,
  // Inglés (el Excel histórico mezcla idiomas)
  jan: 1, apr: 4, aug: 8,
};

export function parseFechaLicencia(raw: unknown, year: number): string | null {
  if (raw == null) return null;

  // Date object (cuando XLSX corre con cellDates: true o la celda viene ya tipada)
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    return `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, '0')}-${String(raw.getDate()).padStart(2, '0')}`;
  }

  const s = String(raw).trim();
  if (!s) return null;

  // Caso 1: "D-MMM" o "D MMM" con nombre de mes (formato del Excel histórico: "17-Jul")
  const mTxt = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3,4})$/);
  if (mTxt) {
    const d = parseInt(mTxt[1], 10);
    const mon = MESES[mTxt[2].toLowerCase().slice(0, 3)];
    if (d >= 1 && d <= 31 && mon >= 1 && mon <= 12) {
      return `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // Caso 2: ya viene ISO "YYYY-MM-DD" (validamos rango real)
  const mIso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
  if (mIso) {
    const y = parseInt(mIso[1], 10);
    const mm = parseInt(mIso[2], 10);
    const dd = parseInt(mIso[3], 10);
    if (y && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${y}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }
    return null; // evita ISOs inválidos como "2025-15-09"
  }

  // Caso 3: "DD/MM/YYYY" o "MM/DD/YYYY" (o con guiones). Detectamos el orden
  // por magnitud: si un componente es > 12 tiene que ser el día.
  const mNum = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (mNum) {
    const a = parseInt(mNum[1], 10);
    const b = parseInt(mNum[2], 10);
    let y = parseInt(mNum[3], 10);
    if (y < 100) y += 2000;
    if (!y || a < 1 || b < 1) return null;

    let d: number;
    let mm: number;
    if (a > 12 && b <= 12) {
      d = a; mm = b; // DD/MM (uruguayo, europeo)
    } else if (b > 12 && a <= 12) {
      d = b; mm = a; // MM/DD (americano)
    } else if (a <= 12 && b <= 12) {
      d = a; mm = b; // ambiguo: default DD/MM (uruguayo)
    } else {
      return null; // ambos > 12, no es fecha válida
    }
    if (d >= 1 && d <= 31 && mm >= 1 && mm <= 12) {
      return `${y}-${String(mm).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  return null;
}

function parseBool(raw: unknown): 0 | 1 {
  if (raw == null) return 0;
  const s = String(raw).trim().toUpperCase();
  return s === 'TRUE' || s === 'VERDADERO' || s === '1' || s === 'SI' || s === 'SÍ' ? 1 : 0;
}

function getCell(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
  }
  return null;
}

/**
 * Lee el Excel (buffer) y devuelve las licencias parseadas listas para insertar.
 * No persiste nada. Usar desde import/route.ts Y import/preview/route.ts.
 */
export function parseLicenciasFromExcel(buffer: Buffer, year: number): ParseResult {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase() === 'registro') || wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    return { validas: [], errores: ['El Excel no tiene hojas'], totalFilas: 0, descartadas: 0 };
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false, defval: null });
  const validas: LicenciaParseada[] = [];
  const errores: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const remitente = String(getCell(r, ['Remitente', 'remitente']) || '').trim();
    const funcionario = String(getCell(r, ['Funcionario', 'funcionario']) || '').trim();
    const tipoRaw = String(
      getCell(r, ['Tipo de licencia', 'Tipo de licencia ', 'tipo_licencia', 'Tipo']) || '',
    ).trim();

    if (!remitente || !funcionario || !tipoRaw) {
      errores.push(`Fila ${i + 2}: faltan campos obligatorios (Remitente/Funcionario/Tipo)`);
      continue;
    }

    const sectorRaw = String(getCell(r, ['SECTOR', 'Sector', 'sector']) || '').trim();
    const sector = SECTOR_SET.has(sectorRaw) ? sectorRaw : null;
    const tipo = normalizeTipoLicencia(tipoRaw);

    const padronRaw = getCell(r, ['Padron', 'Padrón', 'padron']);
    const servicioRaw = getCell(r, ['Nombre del Servicio', 'nombre_servicio', 'Servicio']);
    const suplenteRaw = getCell(r, ['Suplente', 'suplente']);

    // Observaciones puede estar distribuida en Columna2..Columna8 en algunas filas.
    const obsKeys = ['Observaciones', 'observaciones', 'Columna2', 'Columna3', 'Columna4', 'Columna5', 'Columna6', 'Columna7', 'Columna8'];
    let observaciones: string | null = null;
    for (const k of obsKeys) {
      const v = r[k];
      if (v != null && String(v).trim() !== '') { observaciones = String(v).trim(); break; }
    }

    validas.push({
      remitente,
      padron: padronRaw == null ? null : String(padronRaw).trim() || null,
      funcionario,
      nombre_servicio: servicioRaw == null ? null : String(servicioRaw).trim() || null,
      sector,
      tipo_licencia: tipo,
      desde: parseFechaLicencia(getCell(r, ['Desde', 'desde']), year),
      hasta: parseFechaLicencia(getCell(r, ['Hasta', 'hasta']), year),
      suplente: suplenteRaw == null ? null : String(suplenteRaw).trim() || null,
      recep_notificacion: parseBool(getCell(r, ['RRHH (Recepción Notificación)', 'RRHH (Recepcion Notificacion)', 'recep_notificacion'])),
      supervision: parseBool(getCell(r, ['Supervisión', 'Supervision', 'supervision'])),
      recep_certificado: parseBool(getCell(r, ['RRHH (Recepción Certificado)', 'RRHH (Recepcion Certificado)', 'recep_certificado'])),
      planificacion: parseBool(getCell(r, ['Planificación', 'Planificacion', 'planificacion'])),
      observaciones,
    });
  }

  return {
    validas,
    errores,
    totalFilas: rows.length,
    descartadas: rows.length - validas.length,
  };
}
