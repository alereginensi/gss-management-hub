import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { AGENDA_ADMIN_ROLES } from '@/lib/agenda-roles';

const AUTH_ROLES: readonly string[] = AGENDA_ADMIN_ROLES;

function errorResponse(body: object, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}

function serveBuffer(buffer: Buffer, id: number): NextResponse {
  const head = buffer.slice(0, 8);
  const isPdf = head.slice(0, 4).toString('ascii') === '%PDF';
  const isPng = head[0] === 0x89 && head.slice(1, 4).toString('ascii') === 'PNG';
  const isJpg = head[0] === 0xff && head[1] === 0xd8;
  const contentType = isPdf ? 'application/pdf' : isPng ? 'image/png' : isJpg ? 'image/jpeg' : 'application/octet-stream';
  const ext = isPdf ? 'pdf' : isPng ? 'png' : isJpg ? 'jpg' : 'bin';
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `${isPdf ? 'inline' : 'attachment'}; filename="remito-egreso-${id}.${ext}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

// GET /api/logistica/agenda/egress-returns/[id]/remito-pdf
// Proxy: sirve bytes desde DB o URL externa (Cloudinary/filesystem).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return errorResponse({ error: 'Unauthorized' }, 401);
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);

  try {
    const row = await db.get(
      `SELECT remito_pdf_data AS data, remito_pdf_url AS url FROM agenda_egress_returns WHERE id = ?`,
      [id]
    );
    if (!row) return errorResponse({ error: 'Egreso no encontrado' }, 404);
    if (row.data) {
      const buf = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
      return serveBuffer(buf, id);
    }
    const originalUrl = row.url;
    if (!originalUrl) return errorResponse({ error: 'Remito no disponible' }, 404);
    return await serveFromUrl(originalUrl, id);
  } catch (err) {
    console.warn('[egress remito-pdf] fallback URL:', (err as Error).message);
    const row = await db.get('SELECT remito_pdf_url FROM agenda_egress_returns WHERE id = ?', [id]);
    if (!row?.remito_pdf_url) return errorResponse({ error: 'Remito no disponible' }, 404);
    return await serveFromUrl(row.remito_pdf_url, id);
  }
}

async function serveFromUrl(originalUrl: string, id: number): Promise<NextResponse> {
  if (originalUrl.startsWith('/uploads/')) {
    const candidates = [
      path.join(process.cwd(), 'public', originalUrl),
      path.join(process.cwd(), '..', 'public', originalUrl),
      path.join(process.cwd(), originalUrl.replace(/^\//, '')),
    ];
    for (const candidate of candidates) {
      try {
        const buffer = await fs.readFile(candidate);
        return serveBuffer(Buffer.from(buffer), id);
      } catch { /* next */ }
    }
    return errorResponse({ error: 'Archivo no encontrado en filesystem.' }, 410);
  }
  if (!/^https?:\/\//i.test(originalUrl)) {
    return errorResponse({ error: 'URL de remito invalida.' }, 410);
  }
  const cloudinaryMatch = /res\.cloudinary\.com\/[^/]+\/(raw|image|video)\/(?:upload|authenticated)\/(?:v\d+\/)?(.+?)(\.[a-z0-9]+)?$/i.exec(originalUrl);
  if (cloudinaryMatch) {
    const resourceType = cloudinaryMatch[1] as 'raw' | 'image' | 'video';
    const publicId = cloudinaryMatch[2];
    const extFromUrl = (cloudinaryMatch[3] || '').replace(/^\./, '');
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const cloudinaryUrl = process.env.CLOUDINARY_URL;
    const hasCreds = !!(cloudinaryUrl || (cloudName && apiKey && apiSecret));
    if (hasCreds) {
      try {
        const { v2: cld } = await import('cloudinary');
        if (cloudName && apiKey && apiSecret) {
          cld.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
        }
        const signedPublicId = resourceType === 'raw' && extFromUrl ? `${publicId}.${extFromUrl}` : publicId;
        const signedUrl = cld.utils.private_download_url(signedPublicId, extFromUrl || '', {
          resource_type: resourceType,
          expires_at: Math.floor(Date.now() / 1000) + 300,
        });
        const upstream = await fetch(signedUrl, { cache: 'no-store' });
        if (upstream.ok) return serveBuffer(Buffer.from(await upstream.arrayBuffer()), id);
      } catch (e: any) {
        console.error('[egress remito-pdf] private_download_url error:', e?.message);
      }
    }
  }
  try {
    const upstream = await fetch(originalUrl, { cache: 'no-store' });
    if (!upstream.ok) return errorResponse({ error: `Upstream ${upstream.status}` }, 502);
    return serveBuffer(Buffer.from(await upstream.arrayBuffer()), id);
  } catch (err: any) {
    return errorResponse({ error: err?.message || 'Error interno' }, 500);
  }
}
