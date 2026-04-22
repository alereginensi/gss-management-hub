import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { AGENDA_ADMIN_ROLES } from '@/lib/agenda-roles';
import { reconcileOrderItemsFromRemitoPdf, detectRemitoNumber } from '@/lib/agenda-remito-pdf-parser';

const AUTH_ROLES: readonly string[] = AGENDA_ADMIN_ROLES;
const MAX_PDF_SIZE_BYTES = 8 * 1024 * 1024;

// POST /api/logistica/agenda/remito/parse-pdf
// FormData: file (PDF)
// Responde { parsed_items, parsed_text, remito_number } sin persistir nada.
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const head = buffer.slice(0, 4).toString('ascii');
    if (head !== '%PDF') {
      return NextResponse.json({ error: 'El archivo no es un PDF valido.' }, { status: 400 });
    }
    if (buffer.length > MAX_PDF_SIZE_BYTES) {
      return NextResponse.json({ error: `El PDF supera ${Math.round(MAX_PDF_SIZE_BYTES / 1024 / 1024)}MB.` }, { status: 400 });
    }

    // @ts-expect-error — evita el index.js del paquete (lee un PDF de test en build)
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default as (buf: Buffer) => Promise<{ text: string }>;
    const data = await pdfParse(buffer);
    const parsedText = (data.text || '').trim();
    const remitoNumber = parsedText ? detectRemitoNumber(parsedText) : '';
    const rows = parsedText ? reconcileOrderItemsFromRemitoPdf(parsedText) || [] : [];

    return NextResponse.json({
      parsed_text: parsedText,
      remito_number: remitoNumber,
      parsed_items: rows.map(r => ({ article_type: r.item, size: r.size, color: r.color, qty: r.qty })),
    });
  } catch (err) {
    console.error('Error parse-pdf:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
