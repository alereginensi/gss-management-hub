import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'rrhh', 'supervisor'];

// Respuesta de error sin cache para que el browser no se quede pegado
// con un 410/404 viejo después de resubir el remito.
function errorResponse(body: object, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}

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
      // no-store para evitar que el browser sirva un PDF viejo después de resubir
      'Cache-Control': 'private, no-store',
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
    return errorResponse({ error: 'Unauthorized' }, 401);
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  const kind = request.nextUrl.searchParams.get('kind') || 'delivery';
  const isReturn = kind === 'return';

  // Intento leer los bytes del PDF directo desde DB (nueva estrategia).
  // Si las columnas _pdf_data no existen todavía (migración no corrió), caemos al flujo por URL.
  try {
    const col = isReturn ? 'remito_return_pdf_data' : 'remito_pdf_data';
    const urlCol = isReturn ? 'remito_return_pdf_url' : 'remito_pdf_url';
    const row = await db.get(`SELECT ${col} AS data, ${urlCol} AS url FROM agenda_appointments WHERE id = ?`, [id]);
    if (!row) return errorResponse({ error: 'Cita no encontrada' }, 404);
    if (row.data) {
      const buf = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
      console.log(`[remito-pdf] appt=${id} kind=${kind} served from DB (${buf.length} bytes)`);
      return serveBuffer(buf, id, kind);
    }
    // No hay bytes en DB — fallback al flujo antiguo por URL
    const originalUrl = row.url;
    if (!originalUrl) return errorResponse({ error: 'Remito no disponible' }, 404);
    return await serveFromUrl(originalUrl, id, kind);
  } catch (err) {
    // Si el SELECT falla (p.ej. columna _pdf_data no existe), caemos al flujo viejo
    console.warn(`[remito-pdf] fallback to URL flow:`, (err as Error).message);
    const row = await db.get('SELECT remito_pdf_url, remito_return_pdf_url FROM agenda_appointments WHERE id = ?', [id]);
    if (!row) return errorResponse({ error: 'Cita no encontrada' }, 404);
    const originalUrl = isReturn ? row.remito_return_pdf_url : row.remito_pdf_url;
    if (!originalUrl) return errorResponse({ error: 'Remito no disponible' }, 404);
    return await serveFromUrl(originalUrl, id, kind);
  }
}

async function serveFromUrl(originalUrl: string, id: number, kind: string): Promise<NextResponse> {
  console.log(`[remito-pdf] appt=${id} kind=${kind} url=${originalUrl.slice(0, 80)}`);

  // ── Railway Volume (volume:///agenda/...) ──────────────────────────────────
  if (originalUrl.startsWith('volume:///')) {
    const volumeBase = process.env.AGENDA_STORAGE_PATH;
    if (!volumeBase) {
      return errorResponse({ error: 'Storage volume no montado (AGENDA_STORAGE_PATH no configurado)' }, 503);
    }
    try {
      const relPath = originalUrl.slice('volume:///'.length);
      const buffer = await fs.readFile(path.join(volumeBase, relPath));
      return serveBuffer(Buffer.from(buffer), id, kind);
    } catch {
      return errorResponse({ error: 'Archivo no encontrado en el volumen' }, 404);
    }
  }

  // ── Filesystem local de desarrollo (/uploads/agenda/...) ───────────────────
  if (originalUrl.startsWith('/uploads/')) {
    const candidates = [
      path.join(process.cwd(), 'public', originalUrl),
      // Next.js standalone output: public/ queda en la raíz del standalone, no dentro de .next
      path.join(process.cwd(), '..', 'public', originalUrl),
      // Algunos deploys: public/ está al mismo nivel que el server
      path.join(process.cwd(), originalUrl.replace(/^\//, '')),
    ];
    for (const candidate of candidates) {
      try {
        const buffer = await fs.readFile(candidate);
        console.log(`[remito-pdf] served from local fs: ${candidate}`);
        return serveBuffer(Buffer.from(buffer), id, kind);
      } catch (err: any) {
        console.log(`[remito-pdf] tried ${candidate} → ${err?.code || err?.message}`);
      }
    }
    console.error(`[remito-pdf] local file not found for appt=${id} url=${originalUrl} cwd=${process.cwd()}`);
    return errorResponse(
      {
        error: 'El archivo del remito no se encuentra en el filesystem. ' +
               'Probablemente se perdió en un redeploy (filesystem local no es persistente en Railway). ' +
               'Subí el remito de nuevo; si Cloudinary está configurado se guardará ahí automáticamente.',
        debug: { originalUrl, cwd: process.cwd(), triedPaths: candidates },
      },
      410
    );
  }

  // ── URL externa (Cloudinary u otro CDN) ────────────────────────────────────
  if (!/^https?:\/\//i.test(originalUrl)) {
    return errorResponse({ error: 'URL de remito no válida. Volvé a subirlo.' }, 410);
  }

  // Cloudinary: la restricción de cuenta "Restricted media types: PDF"
  // bloquea el acceso público a PDFs tanto en /raw/upload/ como en /image/upload/.
  // Usamos private_download_url (signed, short-lived) para bypasearla en cualquiera
  // de los dos casos.
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
        // Para raw: ext va en el public_id. Para image/video: ext va aparte.
        const signedPublicId = resourceType === 'raw' && extFromUrl ? `${publicId}.${extFromUrl}` : publicId;
        const signedUrl = cld.utils.private_download_url(signedPublicId, extFromUrl || '', {
          resource_type: resourceType,
          expires_at: Math.floor(Date.now() / 1000) + 300,
        });
        console.log(`[remito-pdf] signed (${resourceType}): ${signedUrl.slice(0, 120)}`);
        const upstream = await fetch(signedUrl, { cache: 'no-store' });
        if (upstream.ok) return serveBuffer(Buffer.from(await upstream.arrayBuffer()), id, kind);
        console.error(`[remito-pdf] signed URL failed ${upstream.status} — fallback al fetch directo`);
      } catch (e: any) {
        console.error('[remito-pdf] private_download_url error:', e?.message);
      }
    } else {
      console.warn('[remito-pdf] Cloudinary credentials not configured server-side');
    }
  }

  // Fallback: fetch directo (imágenes u otros CDN sin restricción)
  try {
    const upstream = await fetch(originalUrl, { cache: 'no-store' });
    if (!upstream.ok) {
      console.error(`[remito-pdf] upstream error ${upstream.status} for url=${originalUrl.slice(0, 80)}`);
      return errorResponse({ error: `No se pudo obtener el archivo (upstream ${upstream.status})` }, 502);
    }
    const buffer = Buffer.from(await upstream.arrayBuffer());
    return serveBuffer(buffer, id, kind);
  } catch (err: any) {
    console.error('Error proxy remito:', err);
    return errorResponse({ error: err?.message || 'Error interno' }, 500);
  }
}
