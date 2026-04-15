import db from '@/lib/db';
import type { AgendaUniformCatalogItem, OrderItem } from '@/lib/agenda-types';

// ─── Catálogo hardcoded por empresa (fallback si la DB está vacía) ────────────

export const DEFAULT_COMPANY_UNIFORMS: Record<string, Omit<AgendaUniformCatalogItem, 'id' | 'created_at'>[]> = {
  REIMA: [
    { empresa: 'REIMA', sector: null, puesto: null, workplace_category: null, article_type: 'Camisa manga larga', article_name_normalized: 'camisa_manga_larga', quantity: 2, useful_life_months: 12, initial_enabled: 1, renewable: 1, reusable_allowed: 0, special_authorization_required: 0 },
    { empresa: 'REIMA', sector: null, puesto: null, workplace_category: null, article_type: 'Pantalón de trabajo', article_name_normalized: 'pantalon_trabajo', quantity: 2, useful_life_months: 12, initial_enabled: 1, renewable: 1, reusable_allowed: 0, special_authorization_required: 0 },
    { empresa: 'REIMA', sector: null, puesto: null, workplace_category: null, article_type: 'Zapatos de seguridad', article_name_normalized: 'zapatos_seguridad', quantity: 1, useful_life_months: 24, initial_enabled: 1, renewable: 1, reusable_allowed: 1, special_authorization_required: 0 },
    { empresa: 'REIMA', sector: null, puesto: null, workplace_category: null, article_type: 'Chaleco reflectante', article_name_normalized: 'chaleco_reflectante', quantity: 1, useful_life_months: 18, initial_enabled: 1, renewable: 1, reusable_allowed: 1, special_authorization_required: 0 },
  ],
  ORBIS: [
    { empresa: 'ORBIS', sector: null, puesto: null, workplace_category: null, article_type: 'Remera polo', article_name_normalized: 'remera_polo', quantity: 3, useful_life_months: 12, initial_enabled: 1, renewable: 1, reusable_allowed: 0, special_authorization_required: 0 },
    { empresa: 'ORBIS', sector: null, puesto: null, workplace_category: null, article_type: 'Pantalón cargo', article_name_normalized: 'pantalon_cargo', quantity: 2, useful_life_months: 12, initial_enabled: 1, renewable: 1, reusable_allowed: 0, special_authorization_required: 0 },
    { empresa: 'ORBIS', sector: null, puesto: null, workplace_category: null, article_type: 'Campera', article_name_normalized: 'campera', quantity: 1, useful_life_months: 24, initial_enabled: 1, renewable: 1, reusable_allowed: 1, special_authorization_required: 0 },
    { empresa: 'ORBIS', sector: null, puesto: null, workplace_category: null, article_type: 'Calzado de seguridad', article_name_normalized: 'calzado_seguridad', quantity: 1, useful_life_months: 18, initial_enabled: 1, renewable: 1, reusable_allowed: 1, special_authorization_required: 0 },
  ],
  SCOUT: [
    { empresa: 'SCOUT', sector: null, puesto: null, workplace_category: null, article_type: 'Camisa manga corta', article_name_normalized: 'camisa_manga_corta', quantity: 2, useful_life_months: 12, initial_enabled: 1, renewable: 1, reusable_allowed: 0, special_authorization_required: 0 },
    { empresa: 'SCOUT', sector: null, puesto: null, workplace_category: null, article_type: 'Pantalón de trabajo', article_name_normalized: 'pantalon_trabajo', quantity: 2, useful_life_months: 12, initial_enabled: 1, renewable: 1, reusable_allowed: 0, special_authorization_required: 0 },
    { empresa: 'SCOUT', sector: null, puesto: null, workplace_category: null, article_type: 'Botas de seguridad', article_name_normalized: 'botas_seguridad', quantity: 1, useful_life_months: 18, initial_enabled: 1, renewable: 1, reusable_allowed: 1, special_authorization_required: 0 },
  ],
  ERGON: [
    { empresa: 'ERGON', sector: null, puesto: null, workplace_category: null, article_type: 'Remera manga larga', article_name_normalized: 'remera_manga_larga', quantity: 3, useful_life_months: 12, initial_enabled: 1, renewable: 1, reusable_allowed: 0, special_authorization_required: 0 },
    { empresa: 'ERGON', sector: null, puesto: null, workplace_category: null, article_type: 'Pantalón jean reforzado', article_name_normalized: 'pantalon_jean_reforzado', quantity: 2, useful_life_months: 18, initial_enabled: 1, renewable: 1, reusable_allowed: 0, special_authorization_required: 0 },
    { empresa: 'ERGON', sector: null, puesto: null, workplace_category: null, article_type: 'Calzado de seguridad', article_name_normalized: 'calzado_seguridad', quantity: 1, useful_life_months: 18, initial_enabled: 1, renewable: 1, reusable_allowed: 1, special_authorization_required: 0 },
    { empresa: 'ERGON', sector: null, puesto: null, workplace_category: null, article_type: 'Casco', article_name_normalized: 'casco', quantity: 1, useful_life_months: 36, initial_enabled: 1, renewable: 1, reusable_allowed: 1, special_authorization_required: 0 },
  ],
};

// ─── Obtener catálogo desde DB (con fallback a hardcoded) ────────────────────

export async function getCatalogForEmployee(
  empresa?: string,
  sector?: string,
  puesto?: string,
  workplace_category?: string
): Promise<AgendaUniformCatalogItem[]> {
  const conditions: string[] = [];
  const params: string[] = [];

  if (empresa) {
    conditions.push('(empresa = ? OR empresa IS NULL)');
    params.push(empresa);
  }
  if (sector) {
    conditions.push('(sector = ? OR sector IS NULL)');
    params.push(sector);
  }
  if (puesto) {
    conditions.push('(puesto = ? OR puesto IS NULL)');
    params.push(puesto);
  }
  if (workplace_category) {
    conditions.push('(workplace_category = ? OR workplace_category IS NULL)');
    params.push(workplace_category);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await db.query(
    `SELECT * FROM agenda_uniform_catalog ${where} ORDER BY empresa, article_type`,
    params
  );

  // Si no hay catálogo en DB, usar fallback hardcoded
  if (rows.length === 0 && empresa && DEFAULT_COMPANY_UNIFORMS[empresa]) {
    return DEFAULT_COMPANY_UNIFORMS[empresa].map((item, i) => ({
      ...item,
      id: -(i + 1), // IDs negativos para indicar que son del fallback
      created_at: new Date().toISOString(),
    })) as AgendaUniformCatalogItem[];
  }

  return rows as AgendaUniformCatalogItem[];
}

// ─── Normalizar y validar un pedido contra el catálogo ──────────────────────

export interface NormalizeResult {
  valid: OrderItem[];
  errors: { item: string; reason: string }[];
}

export async function normalizeOrderItems(
  items: OrderItem[],
  catalog: AgendaUniformCatalogItem[]
): Promise<NormalizeResult> {
  const valid: OrderItem[] = [];
  const errors: { item: string; reason: string }[] = [];

  for (const item of items) {
    if (!item.article_type?.trim()) {
      errors.push({ item: JSON.stringify(item), reason: 'Tipo de artículo vacío' });
      continue;
    }
    if (!item.qty || item.qty < 1) {
      errors.push({ item: item.article_type, reason: 'Cantidad inválida' });
      continue;
    }

    // Buscar en catálogo por nombre o normalizado
    const catalogEntry = catalog.find(
      (c) =>
        c.article_type.toLowerCase() === item.article_type.toLowerCase() ||
        (c.article_name_normalized && c.article_name_normalized.toLowerCase() === item.article_type.toLowerCase())
    );

    if (!catalogEntry) {
      errors.push({ item: item.article_type, reason: 'Artículo no está en el catálogo de su empresa' });
      continue;
    }

    if (item.qty > catalogEntry.quantity) {
      errors.push({ item: item.article_type, reason: `Cantidad excede el máximo permitido (${catalogEntry.quantity})` });
      continue;
    }

    valid.push({
      article_type: catalogEntry.article_type,
      size: item.size,
      qty: item.qty,
    });
  }

  return { valid, errors };
}

// ─── Mapa de nombres alternativos para reconciliación de remito ──────────────

export { ARTICLE_NAME_ALIASES } from '@/lib/agenda-article-aliases';
