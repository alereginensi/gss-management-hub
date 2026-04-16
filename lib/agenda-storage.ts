import path from 'path';
import fs from 'fs/promises';

// ─── Abstracción de almacenamiento para archivos del módulo agenda ───────────
// Por defecto guarda en public/uploads/agenda/{folder}/{filename}
// Si CLOUDINARY_URL está definido → Cloudinary
// Si AGENDA_S3_BUCKET está definido → S3 (placeholder)

function isCloudinaryConfigured(): boolean {
  return !!(
    process.env.CLOUDINARY_URL ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
  );
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
      const url = await uploadToCloudinary(buffer, `agenda/${folder}`, filename.replace(/\.[^/.]+$/, ''));
      return url;
    } catch (err) {
      console.error('Cloudinary upload failed:', err);
      // En producción no caemos al filesystem — el FS de Railway es efímero y
      // los archivos se pierden en cada redeploy. Fallar aquí es preferible a
      // escribir algo que luego no se puede leer.
      if (process.env.NODE_ENV === 'production') {
        throw err instanceof Error ? err : new Error('Cloudinary upload failed');
      }
    }
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error('Cloudinary no está configurado en producción. Setear CLOUDINARY_URL o CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET.');
  }

  // ── Filesystem local (solo dev) ─────────────────────────────────────────────
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'agenda', folder);
  await fs.mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, filename);
  await fs.writeFile(filePath, buffer);
  return `/uploads/agenda/${folder}/${filename}`;
}

export async function deleteAgendaFile(fileUrl: string): Promise<void> {
  if (!fileUrl) return;

  // Solo aplica para archivos locales
  if (fileUrl.startsWith('/uploads/agenda/')) {
    try {
      const filePath = path.join(process.cwd(), 'public', fileUrl);
      await fs.unlink(filePath);
    } catch {
      // Ignorar si no existe
    }
  }
}
