import type { UniformItem } from '@/lib/agenda-uniforms';

export interface RemitoPdfItem {
  item: string;
  size: string;
  color?: string;
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
  if (t.toUpperCase() === 'XXL') return 'XXL';
  return t;
}

function splitBodyAndTrailingSize(desc: string): { body: string; size: string } | null {
  const last = desc.lastIndexOf(' - ');
  if (last === -1) return null;
  const sizeRaw = desc.slice(last + 3).trim();
  const body = desc.slice(0, last).trim();
  if (!body || !sizeRaw) return null;
  const talleMatch = sizeRaw.match(/^talle\s+(\d{2})$/i);
  if (talleMatch) return { body, size: talleMatch[1] };
  const size = /^\d{2}$/.test(sizeRaw) ? sizeRaw : normalizeSizeToken(sizeRaw);
  return { body, size };
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

const VALID_SIZE_TOKEN = /^(S|M|L|XL|XXL|3[6-9]|4[0-6])$/i;

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
  const lastDash = s.lastIndexOf(' - ');
  if (lastDash === -1) return null;
  const sizeToken = extractSizeToken(s.slice(lastDash + 3));
  if (!sizeToken) return null;
  const desc = s.slice(0, lastDash).trim();
  if (desc.length < 2) return null;
  return `${desc} - ${sizeToken}`;
}

function extractDescriptionsFromTightNoSpace(text: string): string[] {
  const full = text.replace(/\s+/g, ' ').trim();
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (t.length < 4) return;
    const k = normKey(t);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };
  const parts = full.split(/(?=\d{4}\d[A-Za-zR])/g);
  for (const part of parts) {
    const seg = part.trim();
    const m = seg.match(/^(\d{4})(\d)(.+)$/);
    if (!m) continue;
    const article = articleStringFromAfterCant(m[3].trim());
    if (article) add(article);
  }
  return out;
}

function extractDescriptionsFromGluedNumericRows(text: string): string[] {
  const full = text.replace(/\s+/g, ' ').trim();
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (t.length < 4) return;
    const k = normKey(t);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };
  const segments = full.split(/(?=\b\d{3,5}\s+\d+\s+)/);
  for (const part of segments) {
    const m = part.trim().match(/^(\d{3,5})\s+(\d+)\s+(.+)$/);
    if (!m) continue;
    const article = articleStringFromAfterCant(m[3]);
    if (article) add(article);
  }
  return out;
}

function extractLooseArticlePhrases(text: string): string[] {
  const full = text.replace(/\s+/g, ' ').trim();
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (t.length < 6) return;
    const k = normKey(t);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };
  const rLine = /\bR\s*-\s*[^\-]{2,100}?\s*-\s*(S|M|L|XL|XXL|3[6-9]|4[0-6])\b/gi;
  let rm: RegExpExecArray | null;
  while ((rm = rLine.exec(full)) !== null) add(rm[0].trim());
  const phrase = /([A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s\-]{4,100}?)\s+-\s+(?:[Tt]alle\s+)?(S|M|L|XL|XXL|3[6-9]|4[0-6])\b/g;
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

function mergeDedupe(strings: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of strings) {
    const t = s.trim();
    if (t.length < 4) continue;
    const k = normKey(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function extractStandaloneRMinusLines(text: string, existing: string[]): string[] {
  const seen = new Set(existing.map(normKey));
  const extra: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!/^r\s*-/i.test(line)) continue;
    const p = line.split(/\s*-\s*/).filter(Boolean);
    if (p.length < 3) continue;
    const k = normKey(line);
    if (seen.has(k)) continue;
    seen.add(k);
    extra.push(line);
  }
  return extra;
}

export function extractRemitoArticleDescriptions(text: string): string[] {
  const tight = extractDescriptionsFromTightNoSpace(text);
  if (tight.length > 0) return mergeDedupe([...tight, ...extractStandaloneRMinusLines(text, tight)]);

  const glued = extractDescriptionsFromGluedNumericRows(text);
  if (glued.length > 0) return mergeDedupe([...glued, ...extractStandaloneRMinusLines(text, glued)]);

  const out: string[] = [];
  const seen = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (t.length < 4) return;
    const k = normKey(t);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
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
    const row = line.match(/^\d+\s+\d+\s+(.+)$/);
    if (row) {
      const art = articleStringFromAfterCant(row[1]) ?? row[1].trim();
      add(art);
      continue;
    }
    if (/^r\s*-/i.test(line)) {
      const p = line.split(/\s*-\s*/).filter(Boolean);
      if (p.length >= 3) add(line);
    }
  }

  if (out.length === 0) {
    const full = text.replace(/\s+/g, ' ');
    const re = /\b(\d{3,5})\s+(\d+)\s+([A-Za-zÁÉÍÓÚáéíóúÑñ0-9][^.\n]{0,120}?\s*-\s*(?:S|M|L|XL|XXL|3[6-9]|4[0-6]))\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(full)) !== null) {
      const inner = articleStringFromAfterCant(m[3]) ?? m[3].trim();
      add(inner);
    }
  }

  if (out.length === 0) for (const s of extractLooseArticlePhrases(text)) add(s);

  return out;
}

export function reconcileOrderItemsFromRemitoPdf(text: string, uniforms: UniformItem[]): RemitoPdfItem[] | null {
  const descriptions = extractRemitoArticleDescriptions(text);
  if (descriptions.length === 0) return null;
  const items: RemitoPdfItem[] = [];
  for (const desc of descriptions) {
    const row = mapOneRemitoArticleLine(desc, uniforms);
    if (row) items.push(row);
  }
  if (items.length === 0) return null;
  return items;
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
];

export function detectRemitoNumber(text: string): string {
  for (const pattern of REMITO_NUMBER_PATTERNS) {
    const m = text.match(pattern);
    if (m) return m[1].trim();
  }
  return '';
}
