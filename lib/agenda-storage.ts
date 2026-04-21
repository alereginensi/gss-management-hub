import path from 'path';
import fs from 'fs/promises';

// ─── Abstracción de almacenamiento para archivos del módulo agenda ───────────
// Prioridad: Cloudinary → Railway Volume (AGENDA_STORAGE_PATH) → filesystem local (solo dev)

function isCloudinaryConfigured(): boolean {
  // Requiere credenciales server-side reales — NEXT_PUBLIC_ solo sirve para el browser
  return !!(
    process.env.CLOUDINARY_URL ||
    (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
  );
}

// AGENDA_STORAGE_PATH apunta al mount point del Railway Volume (ej. /data)
function getVolumeBasePath(): string | null {
  return process.env.AGENDA_STORAGE_PATH || null;
}

export async function saveAgendaFile(
  buffer: Buffer,
  filename: string,
  folder: string
): Promise<string> {
  // ── Cloudinary ──────────────────────────────────────────────────────────────
  if (isCloudinaryConfigured()) {
    try {
      const { uploadToCloudinary } = await import('@/lib/cloudinary');
      // PDFs siempre como "raw" para poder bypass-ear la restricción "PDF restricted"
      // con private_download_url. URLs "image/upload/" con PDFs devuelven 401/403.
      const ext = filename.split('.').pop()?.toLowerCase();
      const resourceType: 'auto' | 'raw' = ext === 'pdf' ? 'raw' : 'auto';
      const url = await uploadToCloudinary(buffer, `agenda/${folder}`, filename.replace(/\.[^/.]+$/, ''), resourceType);
      console.log(`[storage] cloudinary upload ok (${resourceType}): ${url.slice(0, 100)}`);
      return url;
    } catch (err) {
      console.error('[storage] cloudinary upload failed:', err);
      if (process.env.NODE_ENV === 'production') {
        throw err instanceof Error ? err : new Error('Cloudinary upload failed');
      }
    }
  }

  // ── Railway Volume ──────────────────────────────────────────────────────────
  const volumeBase = getVolumeBasePath();
  if (volumeBase) {
    const dir = path.join(volumeBase, 'agenda', folder);
    await fs.mkdir(dir, { recursive: true });
    const absPath = path.join(dir, filename);
    await fs.writeFile(absPath, buffer);
    console.log(`[storage] volume write ok: ${absPath}`);
    return `volume:///agenda/${folder}/${filename}`;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'No hay storage persistente configurado. ' +
      'Setear CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET o AGENDA_STORAGE_PATH (Railway Volume mount path).'
    );
  }

  // ── Filesystem local (solo dev) ─────────────────────────────────────────────
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'agenda', folder);
  await fs.mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, filename);
  await fs.writeFile(filePath, buffer);
  // Readback verification — si esto falla, logueamos el problema en vez de devolver silenciosamente
  try {
    const stat = await fs.stat(filePath);
    console.log(`[storage] local fs write ok: ${filePath} (${stat.size} bytes)`);
  } catch (err: any) {
    console.error(`[storage] local fs write verification failed: ${filePath} → ${err?.code || err?.message}`);
  }
  return `/uploads/agenda/${folder}/${filename}`;
}

export async function deleteAgendaFile(fileUrl: string): Promise<void> {
  if (!fileUrl) return;

  if (fileUrl.startsWith('volume:///')) {
    const volumeBase = getVolumeBasePath();
    if (!volumeBase) return;
    try {
      await fs.unlink(path.join(volumeBase, fileUrl.slice('volume:///'.length)));
    } catch { /* ignorar si no existe */ }
    return;
  }

  if (fileUrl.startsWith('/uploads/agenda/')) {
    try {
      await fs.unlink(path.join(process.cwd(), 'public', fileUrl));
    } catch { /* ignorar si no existe */ }
  }
}
