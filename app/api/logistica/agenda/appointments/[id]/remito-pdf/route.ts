import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'rrhh', 'supervisor'];

// GET /api/logistica/agenda/appointments/[id]/remito-pdf
// Proxy para servir el PDF del remito desde nuestro dominio.
// Útil cuando la URL original es un raw de Cloudinary con delivery bloqueado
// (401), o cuando el SW/CSP del cliente corta el CDN externo.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  const row = await db.get('SELECT remito_pdf_url, remito_return_pdf_url FROM agenda_appointments WHERE id = ?', [id]);
  if (!row) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });

  const kind = request.nextUrl.searchParams.get('kind') || 'delivery';
  const originalUrl = kind === 'return' ? row.remito_return_pdf_url : row.remito_pdf_url;
  if (!originalUrl) return NextResponse.json({ error: 'Remito no disponible' }, { status: 404 });

  // URL relativa local (ej /uploads/agenda/remitos/...) apunta al filesystem
  // efímero de Railway que ya no existe: el archivo se perdió al redeploy.
  if (!/^https?:\/\//i.test(originalUrl)) {
    return NextResponse.json(
      { error: 'El remito se guardó en filesystem local y se perdió en un redeploy. Volvé a subirlo.' },
      { status: 410 }
    );
  }

  // Con la restricción "PDF and ZIP" destildada en Cloudinary, el URL público
  // del PDF se sirve sin firma. El proxy mantiene la capa de auth del backend.
  try {
    const upstream = await fetch(originalUrl, { cache: 'no-store' });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `No se pudo obtener el PDF (upstream ${upstream.status})` },
        { status: 502 }
      );
    }
    const buffer = Buffer.from(await upstream.arrayBuffer());
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="remito-${id}${kind === 'return' ? '-devolucion' : ''}.pdf"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err: any) {
    console.error('Error proxy remito:', err);
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 });
  }
}
