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

  // Si es una URL de Cloudinary raw (delivery de PDF bloqueado por default en
  // algunas cuentas + assets con access_mode='authenticated'), regeneramos una
  // URL firmada con el SDK. Requiere CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET.
  // Nota: para resource_type=raw, el public_id INCLUYE la extensión .pdf.
  let fetchUrl = originalUrl as string;
  const rawMatch = /res\.cloudinary\.com\/([^/]+)\/raw\/(?:upload|authenticated)\/(?:v\d+\/)?(.+)$/i.exec(fetchUrl);
  if (rawMatch) {
    try {
      const { v2: cloudinary } = await import('cloudinary');
      const cloudName = rawMatch[1];
      const publicIdWithExt = rawMatch[2];
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME || cloudName,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
      });
      fetchUrl = cloudinary.url(publicIdWithExt, {
        resource_type: 'raw',
        type: 'upload',
        sign_url: true,
        secure: true,
      });
    } catch (err) {
      console.error('No se pudo firmar la URL de Cloudinary:', err);
    }
  }

  try {
    const upstream = await fetch(fetchUrl, { cache: 'no-store' });
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
