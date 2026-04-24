import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { isCitacionesRole } from '@/lib/citaciones-helpers';
import { extractPdfText } from '@/lib/citaciones-pdf-parser';

export const maxDuration = 60;

const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

interface PdfRow {
  id: string;
  pdf_data: Buffer | Uint8Array | null;
  pdf_filename: string | null;
  pdf_url: string | null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession(request);
  if (!session || !isCitacionesRole(session.user?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const rows = (await db.query(
      `SELECT id, pdf_data, pdf_filename, pdf_url FROM rrhh_citaciones WHERE id = ?`,
      [id],
    )) as PdfRow[];
    if (rows.length === 0 || !rows[0].pdf_data) {
      return NextResponse.json({ error: 'PDF no adjunto' }, { status: 404 });
    }
    const buf = Buffer.isBuffer(rows[0].pdf_data)
      ? rows[0].pdf_data
      : Buffer.from(rows[0].pdf_data);
    const filename = rows[0].pdf_filename || `citacion-${id}.pdf`;
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('Error sirviendo PDF citación:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession(request);
  if (!session || !isCitacionesRole(session.user?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo faltante' }, { status: 400 });
    }
    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: 'PDF excede 10 MB' }, { status: 413 });
    }

    const exists = (await db.query(
      `SELECT id FROM rrhh_citaciones WHERE id = ?`,
      [id],
    )) as Array<{ id: string }>;
    if (exists.length === 0) {
      return NextResponse.json({ error: 'Citación no encontrada' }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length < 4 || buffer.slice(0, 4).toString('ascii') !== '%PDF') {
      return NextResponse.json({ error: 'El archivo no parece un PDF válido' }, { status: 400 });
    }

    let parsedText = '';
    try {
      parsedText = await extractPdfText(buffer);
    } catch {
      parsedText = '';
    }

    const filename = file.name || `citacion-${id}.pdf`;
    const marker = `db://${id}`;
    const now = new Date().toISOString();

    await db.run(
      `UPDATE rrhh_citaciones
         SET pdf_data = ?, pdf_filename = ?, pdf_url = ?, parsed_pdf_text = ?, updated_at = ?
       WHERE id = ?`,
      [buffer, filename, marker, parsedText || null, now, id],
    );

    return NextResponse.json({
      ok: true,
      pdfUrl: marker,
      pdfFilename: filename,
    });
  } catch (err) {
    console.error('Error subiendo PDF citación:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession(request);
  if (!session || !isCitacionesRole(session.user?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const result = await db.run(
      `UPDATE rrhh_citaciones
         SET pdf_data = NULL, pdf_filename = NULL, pdf_url = NULL, parsed_pdf_text = NULL, updated_at = ?
       WHERE id = ?`,
      [new Date().toISOString(), id],
    );
    if (!result.changes) {
      return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error borrando PDF citación:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
