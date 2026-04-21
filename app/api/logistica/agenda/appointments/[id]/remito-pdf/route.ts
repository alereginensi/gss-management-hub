import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'rrhh', 'supervisor'];

function serveBuffer(buffer: Buffer, id: number, kind: string): NextResponse {
  const head = buffer.slice(0, 8);
  const isPdf = head.slice(0, 4).toString('ascii') === '%PDF';
  const isPng = head[0] === 0x89 && head.slice(1, 4).toString('ascii') === 'PNG';
  const isJpg = head[0] === 0xff && head[1] === 0xd8;
  const contentType = isPdf ? 'application/pdf' : isPng ? 'image/png' : isJpg ? 'image/jpeg' : 'application/octet-stream';
  const ext = isPdf ? 'pdf' : isPng ? 'png' : isJpg ? 'jpg' : 'bin';
  const suffix = kind === 'return' ? '-devolucion' : '';
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `${isPdf ? 'inline' : 'attachment'}; filename="remito-${id}${suffix}.${ext}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

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
  console.log(`[remito-pdf] appt=${id} kind=${kind} url=${originalUrl.slice(0, 80)}`);

  // ── Railway Volume (volume:///agenda/...) ──────────────────────────────────
  if (originalUrl.startsWith('volume:///')) {
    const volumeBase = process.env.AGENDA_STORAGE_PATH;
    if (!volumeBase) {
      return NextResponse.json({ error: 'Storage volume no montado (AGENDA_STORAGE_PATH no configurado)' }, { status: 503 });
    }
    try {
      const relPath = originalUrl.slice('volume:///'.length);
      const buffer = await fs.readFile(path.join(volumeBase, relPath));
      return serveBuffer(Buffer.from(buffer), id, kind);
    } catch {
      return NextResponse.json({ error: 'Archivo no encontrado en el volumen' }, { status: 404 });
    }
  }

  // ── Filesystem local de desarrollo (/uploads/agenda/...) ───────────────────
  if (originalUrl.startsWith('/uploads/')) {
    try {
      const buffer = await fs.readFile(path.join(process.cwd(), 'public', originalUrl));
      return serveBuffer(Buffer.from(buffer), id, kind);
    } catch {
      return NextResponse.json(
        { error: 'El remito se guardó en filesystem local y se perdió en un redeploy. Volvé a subirlo.' },
        { status: 410 }
      );
    }
  }

  // ── URL externa (Cloudinary u otro CDN) ────────────────────────────────────
  if (!/^https?:\/\//i.test(originalUrl)) {
    return NextResponse.json({ error: 'URL de remito no válida. Volvé a subirlo.' }, { status: 410 });
  }

  // Cloudinary raw PDF: la restricción "Restricted media types: PDF" bloquea el
  // acceso público. Usamos private_download_url (signed, short-lived) para bypasearla.
  if (/res\.cloudinary\.com.*\/raw\//.test(originalUrl)) {
    const hasCreds = !!(
      process.env.CLOUDINARY_URL ||
      (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
    );
    if (hasCreds) {
      try {
        const { v2: cld } = await import('cloudinary');
        const m = /\/raw\/(?:upload|authenticated)\/(?:v\d+\/)?(.+)$/.exec(originalUrl);
        if (m) {
          const signedUrl = cld.utils.private_download_url(m[1], '', {
            resource_type: 'raw',
            expires_at: Math.floor(Date.now() / 1000) + 300,
          });
          const upstream = await fetch(signedUrl, { cache: 'no-store' });
          if (upstream.ok) return serveBuffer(Buffer.from(await upstream.arrayBuffer()), id, kind);
          console.error(`[remito-pdf] signed URL error ${upstream.status}`);
        }
      } catch (e: any) {
        console.error('[remito-pdf] private_download_url failed:', e?.message);
      }
    }
  }

  // Fallback: fetch directo (imágenes u otros CDN sin restricción)
  try {
    const upstream = await fetch(originalUrl, { cache: 'no-store' });
    if (!upstream.ok) {
      console.error(`[remito-pdf] upstream error ${upstream.status} for url=${originalUrl.slice(0, 80)}`);
      return NextResponse.json(
        { error: `No se pudo obtener el archivo (upstream ${upstream.status})` },
        { status: 502 }
      );
    }
    const buffer = Buffer.from(await upstream.arrayBuffer());
    return serveBuffer(buffer, id, kind);
  } catch (err: any) {
    console.error('Error proxy remito:', err);
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 });
  }
}
