import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { logAudit } from '@/lib/agenda-helpers';
import { saveAgendaFile } from '@/lib/agenda-storage';
import { AGENDA_ADMIN_ROLES } from '@/lib/agenda-roles';
import { reconcileOrderItemsFromRemitoPdf, detectRemitoNumber, type RemitoPdfItemWithQty } from '@/lib/agenda-remito-pdf-parser';

const AUTH_ROLES: readonly string[] = AGENDA_ADMIN_ROLES;
const MAX_PDF_SIZE_BYTES = 8 * 1024 * 1024;

// POST /api/logistica/agenda/egress-returns/[id]/remito
// FormData: file (PDF o imagen), remito_number (opcional), replace_items ('1' para sobrescribir items con los del PDF)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  const egress = await db.get('SELECT id FROM agenda_egress_returns WHERE id = ?', [id]);
  if (!egress) return NextResponse.json({ error: 'Egreso no encontrado' }, { status: 404 });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const remitoNumber = (formData.get('remito_number') as string) || '';
    const replaceItems = formData.get('replace_items') === '1';
    if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
    const head = buffer.slice(0, 4);
    const isPdfMagic = head.toString('ascii') === '%PDF';
    const isPngMagic = head[0] === 0x89 && head.slice(1, 4).toString('ascii') === 'PNG';
    const isJpgMagic = head[0] === 0xff && head[1] === 0xd8;
    if (ext === 'pdf' && !isPdfMagic) {
      return NextResponse.json({ error: 'El archivo no es un PDF valido.' }, { status: 400 });
    }
    if (['png', 'jpg', 'jpeg'].includes(ext) && !isPngMagic && !isJpgMagic) {
      return NextResponse.json({ error: 'El archivo no es una imagen valida.' }, { status: 400 });
    }
    if (isPdfMagic && buffer.length > MAX_PDF_SIZE_BYTES) {
      return NextResponse.json({ error: `El PDF supera ${Math.round(MAX_PDF_SIZE_BYTES / 1024 / 1024)}MB.` }, { status: 400 });
    }

    const isPdf = isPdfMagic || ext === 'pdf' || file.type === 'application/pdf';
    const filename = `remito-egreso-${id}-${Date.now()}.${ext}`;

    let fileUrl: string;
    let pdfBytes: Buffer | null = null;
    if (isPdf) {
      pdfBytes = buffer;
      fileUrl = `db://${id}`;
    } else {
      fileUrl = await saveAgendaFile(buffer, filename, 'remitos');
    }

    let extractedText = '';
    let detectedRemitoNumber = '';
    let parsedRows: RemitoPdfItemWithQty[] = [];
    if (isPdf) {
      try {
        // @ts-expect-error — evita el index.js del paquete (lee un PDF de test en build)
        const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default as (buf: Buffer) => Promise<{ text: string }>;
        const data = await pdfParse(buffer);
        extractedText = (data.text || '').trim();
        if (extractedText) {
          detectedRemitoNumber = detectRemitoNumber(extractedText);
          parsedRows = reconcileOrderItemsFromRemitoPdf(extractedText) || [];
        }
      } catch (e) {
        console.warn('[egress remito] parse fallo:', (e as Error).message);
      }
    }
    const finalRemitoNumber = (remitoNumber || detectedRemitoNumber || '').trim();
    const parsedPayload = parsedRows.length > 0
      ? JSON.stringify(parsedRows.map(r => ({ article_type: r.item, size: r.size, color: r.color, qty: r.qty })))
      : null;

    const isPg = (db as any).type === 'pg';
    const nowSql = isPg ? 'NOW()' : "datetime('now')";
    const originalFilename = file.name || null;

    // Armar items a guardar: si replace_items y hay parsedRows → usar los del PDF
    const itemsPayload = replaceItems && parsedRows.length > 0 ? parsedPayload : null;

    await db.run(
      `UPDATE agenda_egress_returns SET
         remito_pdf_url = ?,
         remito_number = COALESCE(?, remito_number),
         remito_filename = COALESCE(?, remito_filename),
         parsed_remito_text = COALESCE(?, parsed_remito_text),
         parsed_remito_data = COALESCE(?, parsed_remito_data),
         returned_items = COALESCE(?, returned_items),
         updated_at = ${nowSql}
       WHERE id = ?`,
      [fileUrl, finalRemitoNumber || null, originalFilename, extractedText || null, parsedPayload, itemsPayload, id]
    );
    if (pdfBytes) {
      try { await db.run(`UPDATE agenda_egress_returns SET remito_pdf_data = ? WHERE id = ?`, [pdfBytes, id]); } catch (e) { console.warn('remito_pdf_data update failed:', (e as Error).message); }
    }

    await logAudit('upload_remito', 'egress_return', id, session.user.id, {
      remitoNumber: finalRemitoNumber,
      items_count: parsedRows.length,
    });

    return NextResponse.json({
      ok: true,
      file_url: fileUrl,
      remito_number: finalRemitoNumber,
      parsed_items: parsedRows.map(r => ({ article_type: r.item, size: r.size, color: r.color, qty: r.qty })),
      parsed_text: extractedText,
    });
  } catch (err) {
    console.error('Error subiendo remito egreso:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
