import { NextResponse, NextRequest } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { uploadToCloudinary } from '@/lib/cloudinary';
import pdfParse from 'pdf-parse';

function parseCalendarioPdf(raw: string) {
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const text = lines.join('\n');

    // ── 1. Fecha ──────────────────────────────────────────────────────────
    // Any dd/mm/yyyy in the document
    let fecha = '';
    const anyDate = text.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (anyDate) {
        const [d, mo, y] = anyDate[1].split('/');
        fecha = `${y}-${mo}-${d}`;
    }

    // ── 2. Título / Proveedor ─────────────────────────────────────────────
    // In 2-column PDFs the values appear BEFORE their labels in the raw text.
    // The company name is typically the FIRST line (top-left header).
    let titulo = '';
    // First non-numeric line that looks like a company name
    for (const line of lines) {
        if (
            line.length >= 3 &&
            line.length <= 80 &&
            /[A-ZÁÉÍÓÚÑ]/.test(line) &&          // has at least one uppercase letter
            !/^\d+$/.test(line) &&                  // not purely numeric (RUT)
            !/^(Nro|NRO|RUT|ID|CANT|Fecha|Razon|Nombre|Origen|Destino|Direcci|Remito|Entrega|Despacho|MONTEVIDEO|URUGUAY|Br |Av\.|Tel|Fax)/i.test(line) &&
            !/^\d{2}\/\d{2}\/\d{4}$/.test(line)   // not a date
        ) {
            titulo = line.trim();
            break;
        }
    }

    // ── 3. Artículos ──────────────────────────────────────────────────────
    const items: { article: string; quantity: number | string }[] = [];
    const seen = new Set<string>();

    // Strategy A — GSS Remito format (confirmed from raw):
    // "{4-digit ID}{1-4 digit qty}{article starting with letter or 'R -'}"
    // e.g. "34371R - Casaca Medica Blanco XL"  → ID=3437, qty=1, article="R - Casaca..."
    //      "32381Pantalon Medico Blanco - 2XL"  → ID=3238, qty=1, article="Pantalon..."
    const remitoConcat = /\b(\d{4})(\d{1,3})([A-Za-záéíóúñÁÉÍÓÚÑ][^\n]{2,80})/g;
    let m: RegExpExecArray | null;
    while ((m = remitoConcat.exec(text)) !== null) {
        const qty = parseInt(m[2]);
        const article = m[3].trim().replace(/\s+/g, ' ');
        // Skip metadata-looking articles
        if (/^(MONTEVIDEO|URUGUAY|Br |Av\.|Tel|Fax|Fecha|Razon|Nombre|RUT|Origen|Destino|Remito|Entrega|Despacho|GSS)/i.test(article)) continue;
        // qty must be reasonable
        if (qty < 1 || qty > 99999) continue;
        const key = `${qty}|${article}`;
        if (!seen.has(key)) { seen.add(key); items.push({ quantity: qty, article }); }
    }

    // Strategy B — spaced format: "{qty} {article}" lines after table header
    // Used when Strategy A finds nothing (different PDF layouts)
    if (items.length === 0) {
        let tableStart = 0;
        for (let i = 0; i < lines.length; i++) {
            if (/CANT\.?.*ARTIC|ARTIC.*CANT\.?|CANTIDAD.*DESCRIP/i.test(lines[i])) {
                tableStart = i + 1; break;
            }
        }
        for (let i = tableStart; i < lines.length; i++) {
            const sm = lines[i].match(/^(\d{1,5})\s+([A-Za-záéíóúñÁÉÍÓÚÑ][^\n]{2,80})$/);
            if (sm) {
                const qty = parseInt(sm[1]);
                const article = sm[2].trim();
                if (qty > 0 && qty <= 99999 && !/^(ID|CANT|ARTÍCULO|FECHA|TOTAL|RUT|TEL|Br |Av\.)/i.test(article)) {
                    const key = `${qty}|${article}`;
                    if (!seen.has(key)) { seen.add(key); items.push({ quantity: qty, article }); }
                }
            }
        }
    }

    // Strategy C — "{article} x {qty}" pattern
    if (items.length === 0) {
        const axq = /([A-Za-záéíóúñÁÉÍÓÚÑ][^\n$]{3,60})\s+[xX×]\s*(\d{1,5})/gm;
        while ((m = axq.exec(text)) !== null && items.length < 50) {
            const article = m[1].trim();
            const qty = parseInt(m[2]);
            if (qty > 0 && !/^(ID|CANT|ARTÍCULO|FECHA|TOTAL)/i.test(article)) {
                items.push({ quantity: qty, article });
            }
        }
    }

    // ── 4. Descripción ────────────────────────────────────────────────────
    // "Destino :" label — value may be inline or on next non-header line
    const isTableHeader = (s: string) => /^CANT\.?|^ID\s*CANT|^ARTIC|^Remito\s+de|^Nota\s+de|^Factura|^Recibo/i.test(s);
    let descripcion = '';
    for (let i = 0; i < lines.length; i++) {
        if (/^Destino\s*:/i.test(lines[i])) {
            // Inline: "Destino :Entrega de Uniformes"
            const inline = lines[i].match(/Destino\s*:\s*(.{3,})/i);
            if (inline) { descripcion = inline[1].trim(); break; }
            // Search next lines, skipping table headers or empty-looking lines
            for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
                if (!isTableHeader(lines[j]) && lines[j].length > 2 && /[A-Za-z]/.test(lines[j])) {
                    descripcion = lines[j].trim();
                    break;
                }
            }
            break;
        }
    }

    return { fecha, titulo, items, descripcion };
}

export async function POST(request: NextRequest) {
    const session = await getSession(request);
    if (!session || !['admin', 'logistica', 'jefe'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        if (file.type !== 'application/pdf') {
            return NextResponse.json({ error: 'Solo se aceptan archivos PDF' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        let fileUrl = '';
        try {
            fileUrl = await uploadToCloudinary(buffer, 'logistica/calendario', `cal-${Date.now()}`, 'raw');
        } catch { /* non-critical */ }

        const parsed = await pdfParse(buffer);
        const extracted = parseCalendarioPdf(parsed.text);

        return NextResponse.json({ fileUrl, ...extracted });
    } catch (err: any) {
        console.error('Calendario parse-pdf error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
