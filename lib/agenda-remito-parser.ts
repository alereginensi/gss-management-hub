import type { RemitoItem, RemitoParseResult } from '@/lib/agenda-types';
import { ARTICLE_NAME_ALIASES } from '@/lib/agenda-article-aliases';

// ─── Normalización de texto ───────────────────────────────────────────────────

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// ─── Construir mapa inverso alias → normalized key ───────────────────────────

function buildAliasMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const [key, aliases] of Object.entries(ARTICLE_NAME_ALIASES)) {
    map.set(normalizeText(key), key);
    for (const alias of aliases) {
      map.set(normalizeText(alias), key);
    }
  }
  return map;
}

const ALIAS_MAP = buildAliasMap();

// ─── Intentar leer cantidad al inicio de la línea ────────────────────────────

function extractQtyAndText(line: string): { qty: number; text: string } {
  const match = line.match(/^(\d+)\s+(.+)$/);
  if (match) {
    return { qty: parseInt(match[1], 10), text: match[2].trim() };
  }
  return { qty: 1, text: line.trim() };
}

// ─── Intentar identificar artículo desde texto libre ────────────────────────

function matchArticle(text: string): string | null {
  const norm = normalizeText(text);

  // Coincidencia exacta
  if (ALIAS_MAP.has(norm)) return ALIAS_MAP.get(norm)!;

  // Coincidencia parcial: el texto contiene algún alias
  for (const [alias, key] of ALIAS_MAP.entries()) {
    if (norm.includes(alias) || alias.includes(norm)) return key;
  }

  return null;
}

// ─── Parser principal ─────────────────────────────────────────────────────────

export function parseRemitoText(
  rawText: string,
  catalog?: string[] // lista de article_type del catálogo para refinar match
): RemitoParseResult {
  const matched: RemitoItem[] = [];
  const unmatched: string[] = [];
  const special: string[] = [];

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const line of lines) {
    // Líneas especiales: devolución / reutilizable (R - ...)
    if (/^R\s*[-–]\s*/i.test(line)) {
      special.push(line);
      continue;
    }

    // Ignorar líneas que parecen cabecera o separador
    if (/^[-=*#]{3,}/.test(line)) continue;
    if (/^(remito|nro|numero|fecha|cliente|empresa|id|item|art[íi]culo|cant[idad]*|descripcion)/i.test(line)) continue;

    const { qty, text } = extractQtyAndText(line);

    // Intentar match en catálogo explícito primero
    let articleType: string | undefined;
    if (catalog && catalog.length > 0) {
      const normText = normalizeText(text);
      const found = catalog.find((cat) => {
        const normCat = normalizeText(cat);
        return normCat === normText || normText.includes(normCat) || normCat.includes(normText);
      });
      if (found) articleType = found;
    }

    // Fallback al mapa de aliases
    if (!articleType) {
      const key = matchArticle(text);
      if (key) {
        // Intentar devolver el article_type del catálogo que corresponde al normalized key
        if (catalog && catalog.length > 0) {
          const found = catalog.find((cat) => {
            const normCat = normalizeText(cat);
            for (const [alias, aliasKey] of ALIAS_MAP.entries()) {
              if (aliasKey === key && (normCat === alias || normCat.includes(alias) || alias.includes(normCat))) {
                return true;
              }
            }
            return false;
          });
          articleType = found || key;
        } else {
          articleType = key;
        }
      }
    }

    if (articleType) {
      matched.push({ raw: line, article_type: articleType, qty, matched: true });
    } else {
      // Guardar igual con matched=false para que el admin pueda asignar manualmente
      matched.push({ raw: line, article_type: undefined, qty, matched: false });
      unmatched.push(line);
    }
  }

  return { matched, unmatched, special };
}

// ─── Reconciliación: comparar pedido vs remito ───────────────────────────────

export interface ReconciliationResult {
  ok: boolean;
  discrepancies: {
    article_type: string;
    ordered_qty: number;
    remito_qty: number;
    diff: number;
  }[];
}

export function reconcileOrderVsRemito(
  orderItems: { article_type: string; qty: number }[],
  remitoResult: RemitoParseResult
): ReconciliationResult {
  const discrepancies: ReconciliationResult['discrepancies'] = [];

  const remitoMap = new Map<string, number>();
  for (const item of remitoResult.matched) {
    if (item.matched && item.article_type) {
      const key = normalizeText(item.article_type);
      remitoMap.set(key, (remitoMap.get(key) || 0) + item.qty);
    }
  }

  for (const ordered of orderItems) {
    const key = normalizeText(ordered.article_type);
    const remitoQty = remitoMap.get(key) || 0;
    if (remitoQty !== ordered.qty) {
      discrepancies.push({
        article_type: ordered.article_type,
        ordered_qty: ordered.qty,
        remito_qty: remitoQty,
        diff: remitoQty - ordered.qty,
      });
    }
  }

  return { ok: discrepancies.length === 0, discrepancies };
}
