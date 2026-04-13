import path from 'path';
import fs from 'fs/promises';

// ─── Abstracción de almacenamiento para archivos del módulo agenda ───────────
// Por defecto guarda en public/uploads/agenda/{folder}/{filename}
// Si CLOUDINARY_URL está definido → Cloudinary
// Si AGENDA_S3_BUCKET está definido → S3 (placeholder)

export async function saveAgendaFile(
  buffer: Buffer,
  filename: string,
  folder: string
): Promise<string> {
  // ── Cloudinary ──────────────────────────────────────────────────────────────
  if (process.env.CLOUDINARY_URL || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) {
    try {
      const { uploadToCloudinary } = await import('@/lib/cloudinary');
      const publicId = `agenda/${folder}/${filename.replace(/\.[^/.]+$/, '')}`;
      const url = await uploadToCloudinary(buffer, `agenda/${folder}`, filename.replace(/\.[^/.]+$/, ''));
      return url;
    } catch (err) {
      console.error('Cloudinary upload failed, falling back to filesystem:', err);
    }
  }

  // ── Filesystem local ────────────────────────────────────────────────────────
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
