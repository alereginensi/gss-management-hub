import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { logAudit } from '@/lib/agenda-helpers';
import { saveAgendaFile } from '@/lib/agenda-storage';
import { reconcileOrderItemsFromRemitoPdf, detectRemitoNumber } from '@/lib/agenda-remito-pdf-parser';
import { getUniformsForEmpresa } from '@/lib/agenda-uniforms';

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
    const suffix = isReturn ? 'return' : 'delivery';
    const filename = `remito-${suffix}-appt${id}-${Date.now()}.${ext}`;
    const fileUrl = await saveAgendaFile(buffer, filename, 'remitos');

    // Extraer texto del PDF, reconciliar contra catálogo de la empresa del empleado
    let extractedText = '';
    let detectedRemitoNumber = '';
    let reconciledItems: { article_type: string; size?: string; color?: string; qty: number }[] = [];
    if (ext === 'pdf' || file.type === 'application/pdf') {
      try {
        // @ts-expect-error — evita el index.js del paquete (lee un PDF de test en build)
        const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default as (buf: Buffer) => Promise<{ text: string }>;
        const data = await pdfParse(buffer);
        extractedText = (data.text || '').trim();
        if (extractedText) {
          detectedRemitoNumber = detectRemitoNumber(extractedText);
          const uniforms = getUniformsForEmpresa(appt.employee_empresa);
          const rows = reconcileOrderItemsFromRemitoPdf(extractedText, uniforms) || [];
          reconciledItems = rows.map(r => ({
            article_type: r.item,
            size: r.size,
            color: r.color,
            qty: 1,
          }));
        }
      } catch (e) {
        console.warn('No se pudo extraer texto del PDF de remito:', (e as Error).message);
      }
    }
    const finalRemitoNumber = (remitoNumber || detectedRemitoNumber || '').trim();

    const isPg = (db as any).type === 'pg';
    const nowSql = isPg ? 'NOW()' : "datetime('now')";

    const parsedPayload = reconciledItems.length > 0 ? JSON.stringify(reconciledItems) : null;

    if (isReturn) {
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
        [
          fileUrl,
          finalRemitoNumber || null,
          extractedText || null,
          parsedPayload,
          parsedPayload,
          id,
        ]
      );
    } else {
      await db.run(
        `UPDATE agenda_appointments SET
          remito_pdf_url = ?,
          remito_number = COALESCE(?, remito_number),
          parsed_remito_text = COALESCE(?, parsed_remito_text),
          parsed_remito_data = COALESCE(?, parsed_remito_data),
          delivered_order_items = COALESCE(?, delivered_order_items),
          updated_at = ${nowSql}
         WHERE id = ?`,
        [
          fileUrl,
          finalRemitoNumber || null,
          extractedText || null,
          parsedPayload,
          parsedPayload,
          id,
        ]
      );
    }

    await logAudit('upload_remito', 'appointment', id, session.user.id, {
      fileUrl,
      remitoNumber: finalRemitoNumber,
      items_count: reconciledItems.length,
      kind,
    });

    return NextResponse.json({
      fileUrl,
      items: reconciledItems,
      remitoNumber: finalRemitoNumber,
    });
  } catch (err) {
    console.error('Error subiendo remito:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
