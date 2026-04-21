import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { logAudit } from '@/lib/agenda-helpers';
import { saveAgendaFile } from '@/lib/agenda-storage';
import { reconcileOrderItemsFromRemitoPdf, detectRemitoNumber, type RemitoPdfItemWithQty } from '@/lib/agenda-remito-pdf-parser';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'rrhh', 'supervisor'];

// POST /api/logistica/agenda/appointments/[id]/remito
// FormData: file (PDF o imagen), remito_number (opcional), raw_text (opcional; si no → se extrae del filename)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  const appt = await db.get(
    `SELECT a.*, e.empresa as employee_empresa
     FROM agenda_appointments a
     JOIN agenda_employees e ON e.id = a.employee_id
     WHERE a.id = ?`,
    [id]
  );
  if (!appt) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const remitoNumber = (formData.get('remito_number') as string) || '';
    const kind = ((formData.get('kind') as string) || 'delivery').toLowerCase();
    const isReturn = kind === 'return';

    if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();

    // Validar que el archivo sea realmente lo que dice ser.
    // Magic bytes: PDF = %PDF-, PNG = \x89PNG, JPG = \xFF\xD8, ZIP/DOCX/XLSX = PK.
    const head = buffer.slice(0, 4);
    const isPdfMagic = head.toString('ascii') === '%PDF';
    const isPngMagic = head[0] === 0x89 && head.slice(1, 4).toString('ascii') === 'PNG';
    const isJpgMagic = head[0] === 0xff && head[1] === 0xd8;
    if (ext === 'pdf' && !isPdfMagic) {
      return NextResponse.json(
        { error: 'El archivo no es un PDF válido. Verificá que el archivo no sea un ZIP/XLSX/DOCX con extensión .pdf.' },
        { status: 400 }
      );
    }
    if (['png', 'jpg', 'jpeg'].includes(ext) && !isPngMagic && !isJpgMagic) {
      return NextResponse.json(
        { error: 'El archivo no es una imagen válida.' },
        { status: 400 }
      );
    }
    const suffix = isReturn ? 'return' : 'delivery';
    const filename = `remito-${suffix}-appt${id}-${Date.now()}.${ext}`;
    const fileUrl = await saveAgendaFile(buffer, filename, 'remitos');
    console.log(`[remito upload] appt=${id} kind=${kind} stored=${fileUrl.slice(0, 60)}`);

    // Extraer texto del PDF, reconciliar contra catálogo de la empresa del empleado
    let extractedText = '';
    let detectedRemitoNumber = '';
    let parsedRows: RemitoPdfItemWithQty[] = [];
    if (ext === 'pdf' || file.type === 'application/pdf') {
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
        console.warn('No se pudo extraer texto del PDF de remito:', (e as Error).message);
      }
    }
    const finalRemitoNumber = (remitoNumber || detectedRemitoNumber || '').trim();

    // Reconciliar los items del remito contra el pedido original:
    // - items del pedido que aparecen en el remito → actualizar talle y cantidad
    // - items del pedido que NO están en el remito → eliminar de la entrega
    // - items del remito que no estaban en el pedido → agregar como nuevos
    type DeliveredItem = { article_type: string; size?: string; qty: number; color?: string; [key: string]: unknown };

    function normArticle(s: string): string {
      return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    }

    function buildDeliveredItems(
      orderItemsRaw: string | null,
      remito: RemitoPdfItemWithQty[]
    ): DeliveredItem[] | null {
      if (remito.length === 0) return null;

      // Índice de items del remito por article_type normalizado
      const byType = new Map<string, RemitoPdfItemWithQty>();
      for (const r of remito) byType.set(normArticle(r.item), r);

      let orderItems: DeliveredItem[] = [];
      try {
        orderItems = JSON.parse(orderItemsRaw || '[]') as DeliveredItem[];
      } catch { orderItems = []; }

      const result: DeliveredItem[] = [];
      const usedKeys = new Set<string>();

      for (const oi of orderItems) {
        const key = normArticle(oi.article_type);
        const match = byType.get(key);
        if (match) {
          // Item presente en el remito: actualizar talle, cantidad y color; conservar resto del pedido
          result.push({
            ...oi,
            size: match.size || oi.size,
            qty: match.qty,
            color: match.color ?? oi.color,
          });
          usedKeys.add(key);
        }
        // Si NO está en el remito → no lo incluimos (se elimina de la entrega)
      }

      // Items del remito que no estaban en el pedido original → agregar
      for (const [key, r] of byType) {
        if (!usedKeys.has(key)) {
          result.push({ article_type: r.item, size: r.size, qty: r.qty, color: r.color });
        }
      }

      return result.length > 0 ? result : null;
    }

    const isPg = (db as any).type === 'pg';
    const nowSql = isPg ? 'NOW()' : "datetime('now')";

    const parsedPayload = parsedRows.length > 0 ? JSON.stringify(
      parsedRows.map(r => ({ article_type: r.item, size: r.size, color: r.color, qty: r.qty }))
    ) : null;

    const originalFilename = file.name || null;

    if (isReturn) {
      const reconciledReturn = buildDeliveredItems(appt.returned_order_items, parsedRows);
      const returnPayload = reconciledReturn ? JSON.stringify(reconciledReturn) : null;
      await db.run(
        `UPDATE agenda_appointments SET
          remito_return_pdf_url = ?,
          remito_return_number = COALESCE(?, remito_return_number),
          parsed_remito_return_text = COALESCE(?, parsed_remito_return_text),
          parsed_remito_return_data = COALESCE(?, parsed_remito_return_data),
          returned_order_items = COALESCE(?, returned_order_items),
          has_return = 1,
          updated_at = ${nowSql}
         WHERE id = ?`,
        [fileUrl, finalRemitoNumber || null, extractedText || null, parsedPayload, returnPayload, id]
      );
      if (originalFilename) {
        try { await db.run(`UPDATE agenda_appointments SET remito_return_filename = ? WHERE id = ?`, [originalFilename, id]); } catch { /* columna puede no existir aún */ }
      }
    } else {
      const reconciledDelivery = buildDeliveredItems(appt.order_items, parsedRows);
      const deliveryPayload = reconciledDelivery ? JSON.stringify(reconciledDelivery) : null;
      await db.run(
        `UPDATE agenda_appointments SET
          remito_pdf_url = ?,
          remito_number = COALESCE(?, remito_number),
          parsed_remito_text = COALESCE(?, parsed_remito_text),
          parsed_remito_data = COALESCE(?, parsed_remito_data),
          delivered_order_items = COALESCE(?, delivered_order_items),
          updated_at = ${nowSql}
         WHERE id = ?`,
        [fileUrl, finalRemitoNumber || null, extractedText || null, parsedPayload, deliveryPayload, id]
      );
      if (originalFilename) {
        try { await db.run(`UPDATE agenda_appointments SET remito_filename = ? WHERE id = ?`, [originalFilename, id]); } catch { /* columna puede no existir aún */ }
      }
    }

    const returnedItems = parsedRows.map(r => ({ article_type: r.item, size: r.size, color: r.color, qty: r.qty }));

    await logAudit('upload_remito', 'appointment', id, session.user.id, {
      fileUrl,
      remitoNumber: finalRemitoNumber,
      items_count: returnedItems.length,
      kind,
    });

    return NextResponse.json({
      fileUrl,
      items: returnedItems,
      remitoNumber: finalRemitoNumber,
      parsedText: extractedText,
    });
  } catch (err) {
    console.error('Error subiendo remito:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// DELETE /api/logistica/agenda/appointments/[id]/remito?kind=delivery|return
// Elimina el remito (URL, número, texto parseado y items parseados) pero
// mantiene el resto del registro de la cita intacto.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  const appt = await db.get('SELECT id FROM agenda_appointments WHERE id = ?', [id]);
  if (!appt) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });

  const kind = (request.nextUrl.searchParams.get('kind') || 'delivery').toLowerCase();
  const isReturn = kind === 'return';

  try {
    const isPg = (db as any).type === 'pg';
    const nowSql = isPg ? 'NOW()' : "datetime('now')";
    if (isReturn) {
      await db.run(
        `UPDATE agenda_appointments SET
          remito_return_pdf_url = NULL,
          remito_return_number = NULL,
          parsed_remito_return_text = NULL,
          parsed_remito_return_data = NULL,
          returned_order_items = NULL,
          has_return = 0,
          updated_at = ${nowSql}
         WHERE id = ?`,
        [id]
      );
      // Columna nueva — puede no existir aún si la migración no corrió
      try { await db.run(`UPDATE agenda_appointments SET remito_return_filename = NULL WHERE id = ?`, [id]); } catch { /* ignorar si la columna no existe */ }
    } else {
      await db.run(
        `UPDATE agenda_appointments SET
          remito_pdf_url = NULL,
          remito_number = NULL,
          parsed_remito_text = NULL,
          parsed_remito_data = NULL,
          updated_at = ${nowSql}
         WHERE id = ?`,
        [id]
      );
      try { await db.run(`UPDATE agenda_appointments SET remito_filename = NULL WHERE id = ?`, [id]); } catch { /* ignorar si la columna no existe */ }
    }
    await logAudit('delete', 'appointment', id, session.user.id, { kind: isReturn ? 'return_remito' : 'delivery_remito' });
    console.log(`[remito delete] appt=${id} kind=${kind} OK`);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(`[remito delete] appt=${id} kind=${kind} ERROR:`, err?.message || err);
    return NextResponse.json({ error: err?.message || 'Error interno al eliminar' }, { status: 500 });
  }
}
