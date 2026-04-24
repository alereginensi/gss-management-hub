import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { isCitacionesRole } from '@/lib/citaciones-helpers';
import {
  extractPdfText,
  extractCitacionFromPdfText,
  looksScanned,
  detectCorruptedFields,
} from '@/lib/citaciones-pdf-parser';

export const maxDuration = 60;

const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !isCitacionesRole(session.user?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo faltante' }, { status: 400 });
    }
    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: 'PDF excede 10 MB' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Valida magic bytes "%PDF"
    if (buffer.length < 4 || buffer.slice(0, 4).toString('ascii') !== '%PDF') {
      return NextResponse.json({ error: 'El archivo no parece un PDF válido' }, { status: 400 });
    }

    let rawText = '';
    try {
      rawText = await extractPdfText(buffer);
    } catch (err) {
      console.error('Error extrayendo texto del PDF:', err);
      return NextResponse.json({ error: 'No se pudo leer el PDF' }, { status: 422 });
    }

    const scanned = looksScanned(rawText);
    const parsed = scanned ? {} : extractCitacionFromPdfText(rawText);
    const corruptedFields = scanned ? [] : detectCorruptedFields(parsed);

    return NextResponse.json({
      parsed,
      rawText,
      scanned,
      corruptedFields,
      filename: file.name || 'citacion.pdf',
      size: file.size,
    });
  } catch (err) {
    console.error('Error en parse-pdf citaciones:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
