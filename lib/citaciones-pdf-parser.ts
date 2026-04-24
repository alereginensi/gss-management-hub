/**
 * Parser heurístico de PDFs de citaciones laborales (MTSS / Juzgado).
 *
 * Estrategia: extrae texto con pdf-parse, busca labels frecuentes en formularios
 * uruguayos (MTSS = Ministerio de Trabajo, Juzgado Letrado del Trabajo) y
 * autollena los campos del formulario `CitacionFormData`.
 *
 * Los regex son best-effort: un PDF con layout muy distinto puede dejar campos
 * vacíos y el usuario los completa a mano. No rompe nunca — si no matchea,
 * devuelve ese campo sin valor.
 *
 * Nota: muchos PDFs del MTSS extraen el texto con UN salto de línea entre cada
 * palabra. Trabajamos con una versión "colapsada" (saltos simples → espacio) y
 * otra "original" para bloques multilínea.
 */

export interface CitacionParsed {
  empresa?: string;
  org?: 'MTSS' | 'Juzgado';
  fecha?: string;        // YYYY-MM-DD
  hora?: string;         // HH:MM
  sede?: string;
  trabajador?: string;
  abogado?: string;
  rubros?: string;
  total?: number;
  motivo?: string;
}

/** Extrae texto plano de un Buffer PDF usando pdf-parse (dynamic import).
 *  Usamos el punto de entrada interno `pdf-parse/lib/pdf-parse.js` para evitar
 *  que la librería corra código de "debug" al importarse en entornos Next.js.
 *  Los `@types/pdf-parse` no tipan esa subruta, por eso casteamos el default. */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  // @ts-expect-error — `pdf-parse/lib/pdf-parse.js` no está en los types publicados;
  // usamos esa ruta para evitar el index.js del paquete (que intenta leer un PDF de test en build).
  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default as (buf: Buffer) => Promise<{ text: string }>;
  const data = await pdfParse(buffer);
  return String(data?.text || '').trim();
}

/** True si el PDF parece escaneado (casi no tiene texto extraíble). */
export function looksScanned(rawText: string): boolean {
  // Heurística: menos de 80 chars "útiles" (ignorando espacios y saltos)
  const useful = rawText.replace(/\s+/g, '').length;
  return useful < 80;
}

/**
 * Restaura tildes que pdf-parse suele perder con fuentes custom (caso típico
 * de los PDFs del MTSS): "aclaracin" → "aclaración", "admision" → "admisión".
 *
 * Reglas conservadoras basadas en morfología del español:
 *   1) palabra terminada en [vocal]+"cin"  → sustituye por [vocal]+"ción"
 *   2) palabra terminada en [consonante]+"sion" → sustituye por [consonante]+"sión"
 *
 * No toca palabras cortas (<5 letras) ni contextos ambiguos.
 */
export function restoreCommonAccents(text: string): string {
  let out = text;
  // aclaracin → aclaración, situacin → situación, relacin → relación, funcin → función
  out = out.replace(/(\w{2,})([aeiou])cin\b/g, '$1$2ción');
  // admision → admisión, pension → pensión, profesion → profesión, dimision → dimisión
  out = out.replace(/(\w{2,})([bcdfghjklmnpqrstvwxz])sion\b/gi, '$1$2sión');
  return out;
}

/** Colapsa saltos simples a espacio (los dobles se preservan como separadores de bloque). */
function collapseSingleBreaks(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/([^\n])\n([^\n])/g, '$1 $2') // une líneas separadas por UN solo salto
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Match del primer capturing group del primer patrón que matchee. */
function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) return m[1].trim().replace(/\s+/g, ' ');
  }
  return undefined;
}

/** Detecta organismo por keywords. */
function detectOrg(text: string): 'MTSS' | 'Juzgado' | undefined {
  const up = text.toUpperCase();
  const juz = /JUZGADO\s+LETRADO|JUZGADO\s+DE\s+TRABAJO|PODER\s+JUDICIAL|CEDUL[ÓO]N\s+JUDICIAL|JUZGADO/;
  const mtss = /MINISTERIO\s+DE\s+TRABAJO|\bMTSS\b|INSPECCI[ÓO]N\s+GENERAL\s+DEL\s+TRABAJO|DINATRA|AUDIENCIA\s+DE\s+CONCILIACI[ÓO]N/;
  const hasJuz = juz.test(up);
  const hasMtss = mtss.test(up);
  if (hasMtss && !hasJuz) return 'MTSS';
  if (hasJuz && !hasMtss) return 'Juzgado';
  // Ambos mencionados: el MTSS típicamente cita a audiencia; un expediente judicial raramente nombra MTSS en el header.
  if (hasMtss && /CITACI[ÓO]N|AUDIENCIA\s+DE\s+CONCILIACI[ÓO]N/i.test(up)) return 'MTSS';
  if (hasJuz) return 'Juzgado';
  if (hasMtss) return 'MTSS';
  return undefined;
}

/** Convierte DD/MM/YYYY, D/M/YY, "22 de mayo de 2026", etc → YYYY-MM-DD. */
function parseFechaFromText(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim();

  // DD/MM/YYYY o DD-MM-YYYY
  const m1 = s.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (m1) {
    const d = parseInt(m1[1], 10);
    const m = parseInt(m1[2], 10);
    let y = parseInt(m1[3], 10);
    if (y < 100) y += 2000;
    if (d && m && y && m <= 12 && d <= 31) return toIso(y, m, d);
  }

  // "22 de mayo de 2026"
  const meses: Record<string, number> = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, setiembre: 9, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  };
  const m2 = s.toLowerCase().match(/(\d{1,2})\s+de\s+([a-zñ]+)\s+de\s+(\d{4})/);
  if (m2) {
    const d = parseInt(m2[1], 10);
    const mes = meses[m2[2]];
    const y = parseInt(m2[3], 10);
    if (d && mes && y) return toIso(y, mes, d);
  }

  return undefined;
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** "14:30" / "14h30" / "14 horas" → "HH:MM" */
function parseHora(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const m1 = raw.match(/(\d{1,2})\s*[:h\.]\s*(\d{2})/i);
  if (m1) {
    const h = parseInt(m1[1], 10);
    const min = parseInt(m1[2], 10);
    if (h >= 0 && h < 24 && min >= 0 && min < 60) {
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
  }
  const m2 = raw.match(/(\d{1,2})\s*horas?/i);
  if (m2) {
    const h = parseInt(m2[1], 10);
    if (h >= 0 && h < 24) return `${String(h).padStart(2, '0')}:00`;
  }
  return undefined;
}

/** "$ 1.234.567,89" / "$0.0" / "UYU 12500,50" → number o undefined */
function parseMonto(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/\$|UYU|U\$S|U\$|pesos|uruguayos/gi, '').trim();
  const m = cleaned.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/);
  if (!m) return undefined;
  let str = m[1];
  // Si tiene puntos de miles + coma decimal → formato UY
  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',') && !str.includes('.')) {
    // Solo coma: puede ser decimal "12,50"
    str = str.replace(',', '.');
  }
  const n = Number(str);
  if (!isFinite(n) || n < 0) return undefined;
  return n;
}

/** Limpia y trunca un bloque de texto largo (rubros/motivo). */
function cleanBlock(raw: string, maxLen = 1000): string {
  return raw
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/**
 * Detecta si un bloque de texto extraído de PDF está severamente corrupto
 * (fuente custom que pdf-parse no decodifica bien). Señales frecuentes:
 *   (1) palabras de ≥3 letras sin ninguna vocal ("trnbnjnr", "cltndn", "pnrn")
 *   (2) secuencias de palabras muy cortas (1-2 letras) consecutivas,
 *       típicas cuando el extractor inserta espacios espurios ("I O 12 2024")
 * Umbrales bajos porque en español estos casos son muy raros en texto limpio.
 */
// Palabras cortas comunes en español que NO son señal de corrupción.
const SHORT_STOPWORDS = new Set([
  'de','la','el','en','y','a','o','u','se','es','su','ha','un','ya','si','no','lo','al','le','me','te','ni',
  'los','las','del','por','con','que','más','mas','sin','son','fue','era','una','sus','sus','sra','sr','dra','dr',
]);

export function isLikelyCorrupt(text: string): boolean {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 10) return false; // bloques cortos no evalúa
  const letterWords = words.map((w) => w.replace(/[^a-záéíóúñA-ZÁÉÍÓÚÑ]/g, '').toLowerCase());

  let wordsNoVowels = 0;
  let shortRuns = 0;
  let currentRun = 0;

  for (const lw of letterWords) {
    if (lw.length === 0) {
      currentRun = 0;
      continue;
    }
    if (lw.length >= 3 && !/[aeiouáéíóú]/i.test(lw)) {
      wordsNoVowels++;
    }
    // Solo cuenta como "palabra corta sospechosa" si NO es stopword común.
    if (lw.length <= 2 && !SHORT_STOPWORDS.has(lw)) {
      currentRun++;
      if (currentRun >= 2) shortRuns++;
    } else {
      currentRun = 0;
    }
  }

  const total = words.length;
  return wordsNoVowels / total > 0.01 || shortRuns / total > 0.02;
}

/**
 * Parser principal. Toma el texto plano extraído del PDF y devuelve un objeto
 * con los campos detectados. Ningún campo es obligatorio — los que no matchee
 * simplemente no van en el objeto.
 */
export function extractCitacionFromPdfText(rawText: string): CitacionParsed {
  const collapsed = collapseSingleBreaks(rawText);
  const result: CitacionParsed = {};

  // ── Organismo ─────────────────────────────────────────────────────────────
  const org = detectOrg(collapsed);
  if (org) result.org = org;

  // ── Empresa (empleador / destinatario de la citación) ─────────────────────
  // MTSS típico: "Señor/a: SCOUT SAS" — a veces "Seftor/a" porque pdf-parse
  // decodifica mal la ñ. Tolerante a cualquier char entre "Se" y "or".
  // Capturamos mayúsculas + espacios hasta el primer char fuera del set (símbolos
  // decorativos del membrete, minúsculas del texto corriente, etc).
  // Juzgado: "Empresa demandada:" / "Demandado/a:" / razón social tras encabezado.
  result.empresa = firstMatch(collapsed, [
    // "Señor/a:" con body en mayúsculas (MTSS)
    /Se.{1,3}or(?:\/a)?\s*:\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9\s\.&\-]{1,80}?)(?=[^A-ZÁÉÍÓÚÑ0-9\s\.&\-]|$)/,
    // Variante toda en mayúsculas del label ("SEÑOR/A:")
    /SE.{1,3}OR(?:\/A)?\s*:\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9\s\.&\-]{1,80}?)(?=[^A-ZÁÉÍÓÚÑ0-9\s\.&\-]|$)/,
    // Genérico (otros formatos)
    /(?:Empresa|Empleador(?:\/a)?|Denunciad[oa](?:\/a)?|Demandad[oa](?:\/a)?|Requerid[oa](?:\/a)?|Raz[óo]n\s+social|Destinatari[oa])\s*:\s*([^\n]{2,80}?)(?:\s{2,}|\n|$)/i,
  ]);

  // ── Trabajador (denunciante / reclamante / actor) ─────────────────────────
  // MTSS: "Para atender reclamo de CAMILA SOLEDAD RIVERO RONDAN"
  result.trabajador = firstMatch(collapsed, [
    /Para\s+atender\s+reclamo\s+de\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{3,80}?)(?:\s+\(|\s+asistid[oa]|\s{3,}|\n|$)/,
    /(?:Trabajador(?:\/a)?|Denunciante|Reclamante|Act[oa]ra?)\s*:\s*([^\n]{2,80}?)(?:\s{2,}|\n|$)/i,
  ]);

  // ── Abogado (letrado / patrocinante) ──────────────────────────────────────
  // MTSS: "asistido por: ROMINA PAULA ARGON TORRES"
  result.abogado = firstMatch(collapsed, [
    /asistid[oa]\s+por\s*:\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{3,80}?)(?:\s+\d{3,}|\s+Interno|\s+Por\s?el|\s+PorelMTSS|\s{3,}|\n|$)/i,
    /(?:Abogad[oa]\s+patrocinante|Letrad[oa]\s+patrocinante|Letrad[oa]|Patrocinante)\s*:\s*([^\n]{2,80}?)(?:\s{2,}|\n|$)/i,
    /\b(Dra?\.\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3})\b/,
  ]);

  // ── Sede (dirección de la audiencia) ──────────────────────────────────────
  // MTSS: "sita en Juncal 1517, Planta Baja"
  result.sede = firstMatch(collapsed, [
    /sita\s+en\s+([^\.\n]{5,150}?)(?:\s+El\s+d[íi]a|\.|\s{3,}|\n|$)/i,
    /(?:Sede|Direcci[óo]n|Lugar(?:\s+de\s+la\s+audiencia)?|Oficina)\s*:\s*([^\n]{3,150}?)(?:\s{2,}|\n|$)/i,
  ]);

  // ── Fecha de audiencia ────────────────────────────────────────────────────
  // MTSS: "El día 21/05/2026" (a veces hay otras fechas en el texto — priorizamos "El día")
  const fechaRaw =
    firstMatch(collapsed, [
      /El\s+d[íi]a\s+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /(?:Fecha(?:\s+de\s+audiencia)?|Audiencia(?:\s+el\s+d[íi]a)?|Citaci[óo]n\s+para\s+el\s+d[íi]a)\s*:?\s*([^\n]{3,60}?)(?:\s{2,}|\n|$)/i,
      /(?:se\s+convoca|audiencia\s+fijada)\s+para\s+el\s+d[íi]a\s+([^\n]{3,60}?)(?:\s+a\s+las|\s{2,}|\n|$)/i,
    ]);
  const fecha = parseFechaFromText(fechaRaw);
  if (fecha) result.fecha = fecha;

  // ── Hora ──────────────────────────────────────────────────────────────────
  // MTSS: "A la hora 12:30"
  const horaRaw = firstMatch(collapsed, [
    /A\s+la\s+hora\s+(\d{1,2}\s*[:h\.]\s*\d{2}|\d{1,2}\s*horas?)/i,
    /(?:Hora|a\s+las)\s*:?\s*(\d{1,2}\s*[:h\.]\s*\d{2}|\d{1,2}\s*horas?)/i,
  ]);
  const hora = parseHora(horaRaw);
  if (hora) result.hora = hora;

  // ── Total reclamado ───────────────────────────────────────────────────────
  // MTSS: dentro del bloque RUBROS RECLAMADOS suele venir "concepto:$monto" por línea.
  // Fallback: "Total reclamado: ..." explícito.
  const totalRaw = firstMatch(collapsed, [
    /(?:Total\s+reclamado|Monto\s+reclamado|Cuant[íi]a\s+reclamada|Se\s+reclama\s+la\s+suma\s+de)\s*:?\s*([^\n]{1,50}?)(?:\s{2,}|\n|$)/i,
  ]);
  let total = parseMonto(totalRaw);

  // ── Rubros y motivo (bloques) ─────────────────────────────────────────────
  // MTSS: "RUBROS RECLAMADOS" seguido de líneas "concepto:$monto" y después
  // "RELACION DE HECHOS QUE MOTIVAN EL RECLAMO:" con el texto del motivo.
  // Case-SENSITIVE a propósito: las secciones reales están en MAYÚSCULA;
  // minúsculas son referencias dentro del cuerpo ("ver rubros reclamados al dorso").
  const rubrosMatch = rawText.match(
    /RUBROS\s+RECLAMADOS[\s\S]*?(?=\s*RELACI[ÓO]N\s+DE\s+HECHOS|\s*MOTIVO|\s*Nota:|$)/,
  );
  if (rubrosMatch) {
    const block = rubrosMatch[0].replace(/^RUBROS\s+RECLAMADOS\s*/, '');
    result.rubros = restoreCommonAccents(cleanBlock(block, 600));
    // Sumar todos los montos ":$X" si no detectamos un total explícito.
    // Acepta también total=0 (es el valor real cuando el reclamo es no monetario).
    if (total === undefined) {
      const montos = [...block.matchAll(/:\s*\$\s*([\d.,]+)/g)];
      if (montos.length > 0) {
        const sum = montos.reduce((s, m) => {
          const n = parseMonto(m[1]);
          return typeof n === 'number' ? s + n : s;
        }, 0);
        total = sum;
      }
    }
  } else {
    const rubrosBlock = rawText.match(
      /(?:Rubros(?:\s+reclamados)?|Conceptos\s+reclamados|Se\s+reclama(?:n)?)\s*:\s*([\s\S]{10,800}?)(?:\n\s*\n|\bMotivo\b|\bObservaciones\b|\bTotal\b|$)/i,
    );
    if (rubrosBlock && rubrosBlock[1]) {
      result.rubros = restoreCommonAccents(cleanBlock(rubrosBlock[1], 600));
    }
  }

  if (typeof total === 'number' && total >= 0) result.total = total;

  // Motivo — prioridad: header en mayúscula del MTSS. Fallback: headers
  // genéricos (case-insensitive) para otros formatos.
  const motivoMatch =
    rawText.match(
      /RELACI[ÓO]N\s+DE\s+HECHOS\s+QUE\s+MOTIVAN\s+EL\s+RECLAMO\s*:?\s*([\s\S]{10,2000}?)(?=\s*Nota:|RUBROS\s+RECLAMADOS|$)/,
    ) ||
    rawText.match(
      /(?:Motivo(?:\s+del\s+reclamo)?|Hechos|Exposici[óo]n\s+de\s+hechos)\s*:\s*([\s\S]{10,2000}?)(?:\n\s*Nota:|RUBROS|Total\b|$)/i,
    );
  if (motivoMatch && motivoMatch[1]) {
    result.motivo = restoreCommonAccents(cleanBlock(motivoMatch[1], 1500));
  }

  return result;
}

/**
 * Devuelve los nombres de los campos del resultado cuyo texto parece corrupto.
 * La UI los muestra como warning ("revisá estos campos") para que el usuario
 * edite o reescriba lo autodetectado en vez de confiar ciegamente.
 */
export function detectCorruptedFields(parsed: CitacionParsed): string[] {
  const out: string[] = [];
  if (parsed.rubros && isLikelyCorrupt(parsed.rubros)) out.push('rubros');
  if (parsed.motivo && isLikelyCorrupt(parsed.motivo)) out.push('motivo');
  return out;
}
