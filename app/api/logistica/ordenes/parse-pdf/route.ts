import { NextResponse, NextRequest } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { uploadToCloudinary } from '@/lib/cloudinary';

function parseNum(s: string): number {
    // Format: 9,270.00 (comma=thousands, dot=decimal) → remove commas
    return parseFloat(s.replace(/,/g, '')) || 0;
}

function parseOrderPdf(text: string) {
    const full = text;

    const get = (pattern: RegExp) => {
        const m = full.match(pattern);
        return m ? m[1].trim() : '';
    };


    // RUT EMISOR — label followed immediately by number
    const rutEmisor = get(/RUT\s+EMISOR[:\s]*([0-9]+)/i);

    // RUT COMPRADOR — find all 12-digit numbers, pick the one that isn't the emisor
    const allRuts = [...full.matchAll(/\b(\d{12})\b/g)].map(m => m[1]);
    const rutComprador = allRuts.find(r => r !== rutEmisor) || '';

    // Dates dd/mm/yyyy — first = emisión, second = vencimiento
    const dates = [...full.matchAll(/(\d{2}\/\d{2}\/\d{4})/g)].map(m => m[1]);
    const issueDate = dates[0] || '';
    const dueDate   = dates[1] || '';

    // ID Compra: look for number after label or standalone after RUT EMISOR line
    const orderNumber = get(/ID\s+Compra:\s*([^\n\r]+)/i) ||
                        get(/RUT\s+EMISOR[^\n]*\n(\d+)/i);

    // Adenda ID — no space between ADENDA and ID in this PDF
    const adendaId = get(/ADENDA\s*ID[:\s]*([^\n\r]+)/i);

    // Totals — PDF renders labels concatenated, values as paired $X$Y on same line
    // Structure: Neto básica+Neto mínima / IVA básica+IVA mínima / Descuentos+Exento / Total (standalone)
    const pairs = [...full.matchAll(/\$([\d,]+\.\d{2})\$([\d,]+\.\d{2})/g)].map(m => [parseNum(m[1]), parseNum(m[2])]);
    const netoBasica = pairs[0]?.[0] ?? null;
    const netoMinima = pairs[0]?.[1] ?? null;
    const ivaBasica  = pairs[1]?.[0] ?? null;
    const ivaMinima  = pairs[1]?.[1] ?? null;
    const discounts  = pairs[2]?.[0] ?? null;
    const exempt     = pairs[2]?.[1] ?? null;

    // Total — standalone dollar amount on its own line (not paired)
    const totalMatch = full.match(/^\$([\d,]+\.\d{2})\s*$/m);
    const totalAmount = totalMatch ? parseNum(totalMatch[1]) : null;

    // Items: format is `{qty}{article}${unitPrice}{discount}{subtotal}`
    // e.g. "120Limpiador Cremosos 250 ML (JDS)$48.000.005,760.00"
    const items: { quantity: number; article: string; unit_price: number | null; discount: number; subtotal: number | null }[] = [];
    const itemRegex = /^(\d+)([^$\n]+)\$(\d+\.\d{2})(\d+\.\d{2})([\d,]+\.\d{2})$/gm;
    let m: RegExpExecArray | null;
    while ((m = itemRegex.exec(full)) !== null) {
        const qty      = parseInt(m[1], 10);
        const article  = m[2].trim();
        const unitPrice = parseNum(m[3]);
        const disc     = parseNum(m[4]);
        const sub      = parseNum(m[5]);
        if (qty > 0 && article) {
            items.push({ quantity: qty, article, unit_price: unitPrice || null, discount: disc, subtotal: sub || null });
        }
    }

    return { rutEmisor, rutComprador, issueDate, dueDate, orderNumber, adendaId, netoBasica, netoMinima, ivaBasica, ivaMinima, discounts, exempt, totalAmount, items };
}

export async function POST(request: NextRequest) {
    const session = await getSession(request);
    if (!session || !['admin', 'logistica'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        if (file.type !== 'application/pdf') return NextResponse.json({ error: 'Solo se aceptan archivos PDF' }, { status: 400 });

        const buffer = Buffer.from(await file.arrayBuffer());

        // Upload to Cloudinary
        const filename = `orden-${Date.now()}`;
        let fileUrl = '';
        try {
            fileUrl = await uploadToCloudinary(buffer, 'logistica/ordenes', filename);
        } catch { /* non-critical */ }

        // Parse PDF — use lib path to avoid Next.js test file loading issue
        const pdfParse = require('pdf-parse/lib/pdf-parse.js');
        const parsed = await pdfParse(buffer);
        const extracted = parseOrderPdf(parsed.text);

        return NextResponse.json({ text: parsed.text, fileUrl, ...extracted });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
