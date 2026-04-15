import * as XLSX from 'xlsx';
import type { ImportError, ImportResult } from '@/lib/agenda-types';
import db from '@/lib/db';
import { calculateExpirationDate } from '@/lib/agenda-helpers';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface EmployeeImportRow {
  documento: string;
  nombre: string;
  empresa?: string;
  sector?: string;
  puesto?: string;
  workplace_category?: string;
  fecha_ingreso?: string;
  talle_superior?: string;
  talle_inferior?: string;
  calzado?: string;
  enabled?: string | number;
  observaciones?: string;
}

export interface ArticleMigrationRow {
  documento: string;
  article_type: string;
  size?: string;
  delivery_date: string;
  useful_life_months?: string | number;
  condition_status?: string;
  notes?: string;
}

// ─── Parseo del buffer (xlsx/csv) → rows ─────────────────────────────────────

export function parseImportBuffer(buffer: Buffer): { headers: string[]; rows: Record<string, string>[] } {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const ws = workbook.Sheets[sheetName];

  // 1. Leer como matriz para buscar la cabecera real mediante un sistema de puntuación
  const matrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
  
  const keywords = ['documento', 'nombre', 'ci', 'cedula', 'puesto', 'sector', 'empresa', 'articulo', 'prenda', 'habilitado', 'estado'];
  let headerIndex = 0;
  let maxScore = -1;

  for (let i = 0; i < Math.min(matrix.length, 30); i++) {
    const row = matrix[i];
    if (!row || !Array.isArray(row)) continue;
    
    let currentScore = 0;
    row.forEach(cell => {
      const c = String(cell || '').toLowerCase().trim();
      if (!c) return;
      // Una coincidencia exacta vale más
      if (keywords.includes(c)) {
        currentScore += 2;
      } else if (keywords.some(k => c.includes(k) && c.length < 25)) {
        // Coincidencia parcial en celdas cortas (evita títulos largos)
        currentScore += 1;
      }
    });

    if (currentScore > maxScore) {
      maxScore = currentScore;
      headerIndex = i;
    }
  }

  // Solo confiamos si el sistema encontró al menos algo con sentido (score > 1)
  // De lo contrario, usamos la primera fila por defecto
  if (maxScore <= 1) headerIndex = 0;

  // 2. Parsear los datos reales ignorando lo anterior a la cabecera
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { 
    defval: '', 
    raw: false,
    range: headerIndex 
  });

  if (raw.length === 0) return { headers: [], rows: [] };

  const headers = Object.keys(raw[0]);
  const rows = raw.map(r => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) {
      // Normalizamos las claves para la lógica interna (lowercase, underscore)
      out[k.trim().toLowerCase().replace(/\s+/g, '_')] = String(v ?? '').trim();
    }
    return out;
  });

  return { headers, rows };
}

// ─── Importación de empleados ─────────────────────────────────────────────────

export async function importEmployees(
  rows: Record<string, string>[],
  createdBy: number
): Promise<ImportResult> {
  const errors: ImportError[] = [];
  let successful = 0;
  const isPg = (db as any).type === 'pg';

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2 porque fila 1 es cabecera

    const documento = (row.documento || row.ci || row.cedula || '').trim();
    const nombre = (row.nombre || row.name || row.nombre_completo || '').trim();

    if (!documento) {
      errors.push({ row: rowNum, field: 'documento', message: 'Documento vacío' });
      continue;
    }
    if (!nombre) {
      errors.push({ row: rowNum, field: 'nombre', message: 'Nombre vacío' });
      continue;
    }

    const enabledVal = row.enabled === '0' || row.enabled === 'no' || row.enabled === 'false' || row.habilitado === '0' || (row.habilitado && String(row.habilitado).toLowerCase() === 'no') ? 0 : 1;
    const estadoVal = (row.estado || row.status || 'activo').toLowerCase().trim();
    
    // NOTA: Como solicitó el usuario, ignoramos talles en la carga masiva (los dejamos como null o que mantengan lo anterior)
    const params = [
      documento, nombre,
      row.empresa || null, row.sector || null, row.puesto || null,
      row.workplace_category || row.categoría_de_lugar || null, row.fecha_ingreso || null,
      enabledVal, estadoVal, row.observaciones || null, createdBy,
    ];

    try {
      if (isPg) {
        await db.query(
          `INSERT INTO agenda_employees (documento, nombre, empresa, sector, puesto, workplace_category, fecha_ingreso, enabled, estado, observaciones, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (documento) DO UPDATE SET
             nombre = EXCLUDED.nombre, empresa = EXCLUDED.empresa, sector = EXCLUDED.sector,
             puesto = EXCLUDED.puesto, workplace_category = EXCLUDED.workplace_category,
             fecha_ingreso = EXCLUDED.fecha_ingreso, enabled = EXCLUDED.enabled,
             estado = EXCLUDED.estado, observaciones = EXCLUDED.observaciones`,
          params
        );
      } else {
        await db.run(
          `INSERT INTO agenda_employees (documento, nombre, empresa, sector, puesto, workplace_category, fecha_ingreso, enabled, estado, observaciones, created_by)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(documento) DO UPDATE SET
             nombre = excluded.nombre, empresa = excluded.empresa, sector = excluded.sector,
             puesto = excluded.puesto, workplace_category = excluded.workplace_category,
             fecha_ingreso = excluded.fecha_ingreso, enabled = excluded.enabled,
             estado = excluded.estado, observaciones = excluded.observaciones`,
          params
        );
      }
      successful++;
    } catch (err: any) {
      errors.push({ row: rowNum, field: 'documento', message: err.message || 'Error al insertar' });
    }
  }

  return { success: errors.length === 0, processed: rows.length, successful, failed: errors.length, errors };
}

// ─── Importación de migración histórica de artículos ─────────────────────────

export async function importArticlesMigration(
  rows: Record<string, string>[],
  createdBy: number
): Promise<ImportResult> {
  const errors: ImportError[] = [];
  let successful = 0;
  const isPg = (db as any).type === 'pg';

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const documento = (row.documento || row.ci || row.cedula || '').trim();
    const articleType = (row.article_type || row.articulo || row.prenda || '').trim();
    const deliveryDate = (row.delivery_date || row.fecha_entrega || row.fecha || '').trim();

    if (!documento) { errors.push({ row: rowNum, field: 'documento', message: 'Documento vacío' }); continue; }
    if (!articleType) { errors.push({ row: rowNum, field: 'article_type', message: 'Tipo de artículo vacío' }); continue; }
    if (!deliveryDate) { errors.push({ row: rowNum, field: 'delivery_date', message: 'Fecha de entrega vacía' }); continue; }

    const employee = await db.get('SELECT id FROM agenda_employees WHERE documento = ?', [documento]);
    if (!employee) {
      errors.push({ row: rowNum, field: 'documento', message: `Empleado con documento "${documento}" no encontrado` });
      continue;
    }

    const usefulLife = parseInt(row.useful_life_months || '12', 10) || 12;
    const expirationDate = calculateExpirationDate(deliveryDate, usefulLife);
    const renewalEnabledAt = calculateExpirationDate(deliveryDate, Math.round(usefulLife * 0.8));
    const conditionStatus = row.condition_status || 'nuevo';
    const size = row.size || row.talle || null;
    const notes = row.notes || row.observaciones || null;

    try {
      if (isPg) {
        await db.query(
          `INSERT INTO agenda_articles (employee_id, article_type, size, delivery_date, useful_life_months, expiration_date, renewal_enabled_at, condition_status, origin_type, notes, migrated_flag, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'migracion',$9,1,$10)`,
          [employee.id, articleType, size, deliveryDate, usefulLife, expirationDate, renewalEnabledAt, conditionStatus, notes, createdBy]
        );
      } else {
        await db.run(
          `INSERT INTO agenda_articles (employee_id, article_type, size, delivery_date, useful_life_months, expiration_date, renewal_enabled_at, condition_status, origin_type, notes, migrated_flag, created_by)
           VALUES (?,?,?,?,?,?,?,?,'migracion',?,1,?)`,
          [employee.id, articleType, size, deliveryDate, usefulLife, expirationDate, renewalEnabledAt, conditionStatus, notes, createdBy]
        );
      }
      successful++;
    } catch (err: any) {
      errors.push({ row: rowNum, message: err.message || 'Error al insertar artículo' });
    }
  }

  return { success: errors.length === 0, processed: rows.length, successful, failed: errors.length, errors };
}

// ─── Plantillas descargables ──────────────────────────────────────────────────

export function buildEmployeeTemplate(): Buffer {
  const wb = XLSX.utils.book_new();
  const headers = ['documento', 'nombre', 'empresa', 'sector', 'puesto', 'workplace_category', 'fecha_ingreso', 'talle_superior', 'talle_inferior', 'calzado', 'enabled', 'observaciones'];
  const sample = [['12345678', 'Juan Pérez', 'REIMA', 'Depósito', 'Operario', 'logistica', '2024-01-15', 'M', '42', '42', '1', '']];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
  XLSX.utils.book_append_sheet(wb, ws, 'Empleados');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

export function buildArticlesTemplate(): Buffer {
  const wb = XLSX.utils.book_new();
  const headers = ['documento', 'article_type', 'size', 'delivery_date', 'useful_life_months', 'condition_status', 'notes'];
  const sample = [['12345678', 'Camisa manga larga', 'M', '2024-01-15', '12', 'nuevo', '']];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
  XLSX.utils.book_append_sheet(wb, ws, 'Artículos');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

// ─── Importación de catálogo de uniformes ─────────────────────────────────────

export async function importCatalogItems(
  rows: Record<string, string>[],
  createdBy: number
): Promise<ImportResult> {
  const errors: ImportError[] = [];
  let successful = 0;
  const isPg = (db as any).type === 'pg';

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const articleType = (row.article_type || row.artículo || row.prenda || row.nombre || '').trim();
    if (!articleType) {
      errors.push({ row: rowNum, field: 'article_type', message: 'Tipo de artículo vacío' });
      continue;
    }

    const empresa = (row.empresa || row.compañía || '').trim() || null;
    const usefulLifeMonths = parseInt(row.useful_life_months || row.vida_útil || row.meses || '12', 10) || 12;

    const params = [
      empresa, 
      null, // sector
      null, // puesto
      null, // workplace_category
      articleType,
      null, // article_name_normalized
      1,    // quantity
      usefulLifeMonths,
      1,    // initial_enabled
      1,    // renewable
      0,    // reusable_allowed
      0,    // special_authorization_required
    ];

    try {
      if (isPg) {
        await db.query(
          `INSERT INTO agenda_uniform_catalog (empresa, sector, puesto, workplace_category, article_type, article_name_normalized, quantity, useful_life_months, initial_enabled, renewable, reusable_allowed, special_authorization_required)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          params
        );
      } else {
        await db.run(
          `INSERT INTO agenda_uniform_catalog (empresa, sector, puesto, workplace_category, article_type, article_name_normalized, quantity, useful_life_months, initial_enabled, renewable, reusable_allowed, special_authorization_required)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          params
        );
      }
      successful++;
    } catch (err: any) {
      errors.push({ row: rowNum, message: err.message || 'Error al insertar en catálogo' });
    }
  }

  return { success: errors.length === 0, processed: rows.length, successful, failed: errors.length, errors };
}

export function buildCatalogTemplate(): Buffer {
  const wb = XLSX.utils.book_new();
  const headers = ['article_type', 'empresa', 'useful_life_months'];
  const sample = [
    ['Camisa manga larga', 'REIMA', '12'],
    ['Pantalón cargo', 'ORBIS', '12'],
    ['Zapatos de seguridad', 'SCOUT', '6'],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
  XLSX.utils.book_append_sheet(wb, ws, 'Catálogo');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
