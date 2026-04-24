import type { UniformItem } from '@/lib/agenda-uniforms';

export interface RemitoPdfItem {
  item: string;
  size: string;
  color?: string;
}

interface DescWithQty {
  desc: string;
  qty: number;
}

function normKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const SIZE_ALIASES: Record<string, string> = {
  '2xl': 'XXL',
  '3xl': 'XXXL',
  '4xl': 'XXXXL',
  '5xl': 'XXXXXL',
  xxxxxl: 'XXXXXL',
  xxxxl: 'XXXXL',
  xxxl: 'XXXL',
  xxl: 'XXL',
  xl: 'XL',
  l: 'L',
  m: 'M',
  s: 'S',
};

function normalizeSizeToken(raw: string): string {
  const t = raw.trim();
  const nk = normKey(t);
  if (SIZE_ALIASES[nk]) return SIZE_ALIASES[nk];
  const up = t.toUpperCase();
  if (up === 'XXL' || up === 'XXXL' || up === 'XXXXL' || up === 'XXXXXL') return up;
  return t;
}

// Patrón de talles válidos reutilizable: letras (S/M/L/XL/XXL/XXXL/3XL/4XL/5XL)
// o números de calzado 36-46. Extender acá si aparecen nuevos talles.
const SIZE_TOKEN_PATTERN = '(?:S|M|L|XL|XXL|XXXL|XXXXL|XXXXXL|3XL|4XL|5XL|3[6-9]|4[0-6])';

// Artículos de talle único: cuando el remito no trae talle (ni "- S" ni "Talle
// XX"), si la descripción incluye una de estas keywords asumimos size = 'Única'
// (consistente con lib/agenda-uniforms.ts donde Corbata y Pañuelo se declaran
// con `sizes: ['Única']`). Extender si aparecen más items sin talle.
const SIZELESS_ITEM_KEYWORDS = ['corbata', 'pañuelo', 'panuelo'];
const UNICA_SIZE = 'Única';

function detectSizelessItem(desc: string): boolean {
  const n = normKey(desc); // ya quita tildes y pasa a lowercase
  return SIZELESS_ITEM_KEYWORDS.some((kw) => n.includes(normKey(kw)));
}

function splitBodyAndTrailingSize(desc: string): { body: string; size: string } | null {
  // Caso 1: formato clásico "Body - TALLE" (con dash delimitador).
  const last = desc.lastIndexOf(' - ');
  if (last !== -1) {
    const sizeRaw = desc.slice(last + 3).trim();
    const body = desc.slice(0, last).trim();
    if (body && sizeRaw) {
      const talleMatch = sizeRaw.match(/^tall[ea]\s+(\d{2}|[A-Za-z]{1,5})$/i);
      if (talleMatch) {
        const raw = talleMatch[1];
        const size = /^\d{2}$/.test(raw) ? raw : normalizeSizeToken(raw);
        return { body, size };
      }
      const size = /^\d{2}$/.test(sizeRaw) ? sizeRaw : normalizeSizeToken(sizeRaw);
      return { body, size };
    }
  }
  // Caso 2: "Body Talle XX" / "Body Talla XX" al final, sin dash precediendo.
  // Algunos proveedores (ej. ORBIS) emiten remitos con ese formato.
  const talleEnd = desc.match(/^(.+?)\s+tall[ea]\s+(\d{2}|[A-Za-z]{1,5})$/i);
  if (talleEnd) {
    // Quitar dash colgante al final del body (ocurre cuando la línea tenía
    // "Body - Talla X" y el regex capturó hasta antes de "Talla").
    const body = talleEnd[1].trim().replace(/\s*-\s*$/, '').trim();
    const raw = talleEnd[2];
    if (body.length >= 2) {
      const size = /^\d{2}$/.test(raw) ? raw : normalizeSizeToken(raw);
      return { body, size };
    }
  }
  // Caso 3: artículo de talle único (ej. "Corbata (Orbis)", "Pañuelo"). No
  // tiene talle en el remito; se marca con 'Única' igual que en el catálogo.
  if (desc.trim().length >= 2 && detectSizelessItem(desc)) {
    return { body: desc.trim(), size: UNICA_SIZE };
  }
  return null;
}

function scoreUniformAgainstBody(bodyNorm: string, u: UniformItem): number {
  const nameNorm = normKey(u.name);
  const keywords = nameNorm.split(/\s+/).filter(w => w.length >= 2);
  if (keywords.length === 0) return 0;
  let hits = 0;
  for (const kw of keywords) if (bodyNorm.includes(kw)) hits++;
  return hits / keywords.length;
}

function pickColor(bodyNorm: string, colors: string[] | undefined): string | undefined {
  if (!colors?.length) return undefined;
  let best: string | undefined;
  for (const c of colors) {
    if (bodyNorm.includes(normKey(c))) {
      if (!best || c.length > best.length) best = c;
    }
  }
  return best;
}

export function mapOneRemitoArticleLine(desc: string, uniforms: UniformItem[]): RemitoPdfItem | null {
  const trimmed = desc.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s*-\s*/).map(p => p.trim()).filter(Boolean);
  if (parts.length >= 3 && /^r$/i.test(parts[0])) {
    const size = normalizeSizeToken(parts[parts.length - 1]);
    const bodyForMatch = parts.slice(1, -1).join(' - ');
    const bodyNorm = normKey(bodyForMatch);
    if (!bodyForMatch || bodyNorm.includes('remito')) return null;

    let best: UniformItem | null = null;
    let bestScore = 0;
    for (const u of uniforms) {
      const sc = scoreUniformAgainstBody(bodyNorm, u);
      if (sc > bestScore) { bestScore = sc; best = u; }
    }
    if (!best || bestScore < 0.34) return null;
    const color = pickColor(bodyNorm, best.colors);
    return { item: best.name, size, color };
  }

  const split = splitBodyAndTrailingSize(trimmed);
  if (!split) return null;
  const bodyNorm = normKey(split.body);
  if (bodyNorm.length < 3) return null;

  let best: UniformItem | null = null;
  let bestScore = 0;
  for (const u of uniforms) {
    const sc = scoreUniformAgainstBody(bodyNorm, u);
    if (sc > bestScore) { bestScore = sc; best = u; }
  }
  if (!best || bestScore < 0.34) return null;
  const color = pickColor(bodyNorm, best.colors);
  return { item: best.name, size: split.size, color };
}

const VALID_SIZE_TOKEN = new RegExp(`^${SIZE_TOKEN_PATTERN}$`, 'i');

function extractSizeToken(afterLastDash: string): string | null {
  const raw = afterLastDash.trim();
  const talleMatch = raw.match(/^talle\s+(\d{2})$/i);
  if (talleMatch) return talleMatch[1];
  const token = (raw.split(/\s+/)[0] ?? '').replace(/[,;.]$/, '');
  return VALID_SIZE_TOKEN.test(token) ? token : null;
}

function articleStringFromAfterCant(afterCant: string): string | null {
  const s = afterCant.trim();
  if (!s) return null;
  // Caso 1: formato clásico "Body - TALLE"
  const lastDash = s.lastIndexOf(' - ');
  if (lastDash !== -1) {
    const sizeToken = extractSizeToken(s.slice(lastDash + 3));
    if (sizeToken) {
      const desc = s.slice(0, lastDash).trim();
      if (desc.length >= 2) return `${desc} - ${sizeToken}`;
    }
  }
  // Caso 2: "Body Talle XX" / "Body Talla XX" al final (sin dash antes).
  const talleEnd = s.match(/^(.+?)\s+tall[ea]\s+(\d{2}|[A-Za-z]{1,5})$/i);
  if (talleEnd) {
    // Quitar dash colgante al final del body si el string original tenía
    // "Body - Talla X" (caso común: "R - Buzo Polar Gris - Talla S").
    const body = talleEnd[1].trim().replace(/\s*-\s*$/, '').trim();
    const raw = talleEnd[2];
    if (body.length >= 2) {
      const size = /^\d{2}$/.test(raw) ? raw : normalizeSizeToken(raw);
      if (size) return `${body} - ${size}`;
    }
  }
  // Caso 3: artículo de talle único (corbata, pañuelo, etc.). No trae talle
  // en el remito pero lo reconocemos por keyword y asignamos size 'Única'.
  if (s.length >= 2 && detectSizelessItem(s)) {
    return `${s} - ${UNICA_SIZE}`;
  }
  return null;
}

function extractDescriptionsFromTightNoSpace(text: string): DescWithQty[] {
  const full = text.replace(/\s+/g, ' ').trim();
  const out: DescWithQty[] = [];
  const parts = full.split(/(?=\d{4}\d[A-Za-zR])/g);
  for (const part of parts) {
    const seg = part.trim();
    const m = seg.match(/^(\d{4})(\d)(.+)$/);
    if (!m) continue;
    const article = articleStringFromAfterCant(m[3].trim());
    if (!article) continue;
    const qty = parseInt(m[2], 10) || 1;
    out.push({ desc: article, qty });
  }
  return out;
}

function extractDescriptionsFromGluedNumericRows(text: string): DescWithQty[] {
  const full = text.replace(/\s+/g, ' ').trim();
  const out: DescWithQty[] = [];
  const segments = full.split(/(?=\b\d{3,5}\s+\d+\s+)/);
  for (const part of segments) {
    const m = part.trim().match(/^(\d{3,5})\s+(\d+)\s+(.+)$/);
    if (!m) continue;
    const article = articleStringFromAfterCant(m[3]);
    if (!article) continue;
    const qty = parseInt(m[2], 10) || 1;
    out.push({ desc: article, qty });
  }
  return out;
}

function extractLooseArticlePhrases(text: string): DescWithQty[] {
  const full = text.replace(/\s+/g, ' ').trim();
  const out: DescWithQty[] = [];
  const seen = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (t.length < 6) return;
    const k = normKey(t);
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ desc: t, qty: 1 });
  };
  const rLine = new RegExp(`\\bR\\s*-\\s*[^\\-]{2,100}?\\s*-\\s*${SIZE_TOKEN_PATTERN}\\b`, 'gi');
  let rm: RegExpExecArray | null;
  while ((rm = rLine.exec(full)) !== null) add(rm[0].trim());
  const phrase = new RegExp(`([A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ0-9\\s\\-]{4,100}?)\\s+-\\s+(?:[Tt]alle\\s+)?${SIZE_TOKEN_PATTERN}\\b`, 'g');
  let pm: RegExpExecArray | null;
  while ((pm = phrase.exec(full)) !== null) {
    const body = pm[1].trim();
    const size = pm[2];
    if (body.length < 4) continue;
    if (/^(fecha|razon|direccion|emitido|montevideo|uruguay|scout|gss)\b/i.test(body)) continue;
    add(`${body} - ${size}`);
  }
  return out;
}

function mergeDedupe(items: DescWithQty[]): DescWithQty[] {
  const map = new Map<string, DescWithQty>();
  for (const item of items) {
    const t = item.desc.trim();
    if (t.length < 4) continue;
    const k = normKey(t);
    if (map.has(k)) {
      map.get(k)!.qty += item.qty;
    } else {
      map.set(k, { desc: t, qty: item.qty });
    }
  }
  return [...map.values()];
}

function extractStandaloneRMinusLines(text: string, existing: DescWithQty[]): DescWithQty[] {
  const seen = new Set(existing.map(d => normKey(d.desc)));
  const extra: DescWithQty[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!/^r\s*-/i.test(line)) continue;
    const p = line.split(/\s*-\s*/).filter(Boolean);
    if (p.length < 3) continue;
    const k = normKey(line);
    if (seen.has(k)) continue;
    seen.add(k);
    extra.push({ desc: line, qty: 1 });
  }
  return extra;
}

function normalizeRemitoText(text: string): string {
  // "R • Article" → "R - Article"
  let t = text.replace(/\bR\s*•\s*/g, 'R - ');
  // "Article + TALLE" → "Article - TALLE" (S/M/L/XL/XXL/XXXL/3XL/4XL/5XL/36-46)
  t = t.replace(new RegExp(`\\s*\\+\\s*${SIZE_TOKEN_PATTERN}\\b`, 'gi'), (match) => {
    const sz = match.replace(/^\s*\+\s*/, '').toUpperCase();
    return ` - ${sz}`;
  });
  return t;
}

export function extractRemitoArticleDescriptions(rawText: string): DescWithQty[] {
  const text = normalizeRemitoText(rawText);
  const tight = extractDescriptionsFromTightNoSpace(text);
  if (tight.length > 0) return mergeDedupe([...tight, ...extractStandaloneRMinusLines(text, tight)]);

  const glued = extractDescriptionsFromGluedNumericRows(text);
  if (glued.length > 0) return mergeDedupe([...glued, ...extractStandaloneRMinusLines(text, glued)]);

  const map = new Map<string, DescWithQty>();
  const add = (desc: string, qty = 1) => {
    const t = desc.trim();
    if (t.length < 4) return;
    const k = normKey(t);
    if (map.has(k)) map.get(k)!.qty += qty;
    else map.set(k, { desc: t, qty });
  };
  const skipLine = (line: string) => {
    const t = line.trim();
    const n = normKey(t);
    if (n.length < 4) return true;
    if (/^(id|cant|articulo|descripcion)$/i.test(t)) return true;
    if (n.startsWith('fecha emision') || n.startsWith('razon social')) return true;
    return false;
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || skipLine(line)) continue;
    const row = line.match(/^\d+\s+(\d+)\s+(.+)$/);
    if (row) {
      const qty = parseInt(row[1], 10) || 1;
      const art = articleStringFromAfterCant(row[2]) ?? row[2].trim();
      add(art, qty);
      continue;
    }
    if (/^r\s*-/i.test(line)) {
      const p = line.split(/\s*-\s*/).filter(Boolean);
      if (p.length >= 3) add(line, 1);
    } else {
      // Plain "Article - SIZE" line (no leading number, no R prefix)
      const sz = splitBodyAndTrailingSize(line);
      if (sz && VALID_SIZE_TOKEN.test(sz.size) && sz.body.length >= 4) {
        if (!/^(fecha|razon|direccion|emitido|montevideo|uruguay|scout|gss)\b/i.test(sz.body)) {
          add(`${sz.body} - ${sz.size}`, 1);
        }
      }
    }
  }

  if (map.size === 0) {
    const full = text.replace(/\s+/g, ' ');
    const re = new RegExp(`\\b(\\d{3,5})\\s+(\\d+)\\s+([A-Za-zÁÉÍÓÚáéíóúÑñ0-9][^.\\n]{0,120}?\\s*-\\s*${SIZE_TOKEN_PATTERN})\\b`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(full)) !== null) {
      const qty = parseInt(m[2], 10) || 1;
      const inner = articleStringFromAfterCant(m[3]) ?? m[3].trim();
      add(inner, qty);
    }
  }

  if (map.size === 0) for (const item of extractLooseArticlePhrases(text)) add(item.desc, item.qty);

  return [...map.values()];
}

export interface RemitoPdfItemWithQty extends RemitoPdfItem {
  qty: number;
}

export function reconcileOrderItemsFromRemitoPdf(text: string, _uniforms?: UniformItem[]): RemitoPdfItemWithQty[] | null {
  const descriptions = extractRemitoArticleDescriptions(text);
  if (descriptions.length === 0) return null;

  const agg = new Map<string, RemitoPdfItemWithQty>();
  for (const { desc, qty } of descriptions) {
    // Strip leading "R - " prefix if present
    const cleaned = desc.replace(/^r\s*-\s*/i, '').trim();
    const split = splitBodyAndTrailingSize(cleaned);
    if (!split || split.body.length < 2) continue;
    const key = `${split.body}|||${split.size}`;
    if (agg.has(key)) {
      agg.get(key)!.qty += qty;
    } else {
      agg.set(key, { item: split.body, size: split.size, qty });
    }
  }

  if (agg.size === 0) return null;
  return [...agg.values()];
}

// Patrones comunes para detectar número de remito dentro del texto del PDF
const REMITO_NUMBER_PATTERNS = [
  /[Rr]emito\s*[Nn][°oº]?\.?\s*:?\s*([A-Z0-9\-\/\.]{3,})/,
  /[Nn][°oº]\.?\s*[Rr]emito\s*:?\s*([A-Z0-9\-\/\.]{3,})/,
  /[Rr]emito\s*:?\s*([0-9]{4}[-–][0-9]{4}[-–][0-9]+)/,
  /[Nn]ro\.?\s+[Rr]emito\s*:?\s*([A-Z0-9\-\/\.]+)/i,
  /[Rr]emito\s+([0-9]+[-–][0-9]+[-–][0-9]+)/,
  /\bR\s*[-–]\s*([0-9]{3,})\b/,
  /\bNro\.?\s+([0-9]+)/i,
  // Formato común UY: "0001-00000123".
  /\b(\d{3,5}[-–]\d{5,})\b/,
  // "Remito N° 3062" / "REMITO 3062" (palabra clave + dígitos sin separador).
  /[Rr]emito\s+(?:N[°ºo]\.?\s*)?(\d{3,})/,
  // Fallback laxo: 4+ dígitos cerca de "remito" o "nota de entrega".
  /(?:[Nn]ota\s+de\s+[Ee]ntrega|[Rr]emito)[^\d]{0,30}(\d{4,})/,
];

export function detectRemitoNumber(text: string): string {
  for (const pattern of REMITO_NUMBER_PATTERNS) {
    const m = text.match(pattern);
    if (m) return m[1].trim();
  }
  return '';
}
