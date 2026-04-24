/**
 * utils/storage.ts
 *
 * Capa de persistencia del módulo.
 * Adaptada al backend de GSS Management Hub:
 *   - GET    /api/rrhh/citaciones
 *   - POST   /api/rrhh/citaciones
 *   - PUT    /api/rrhh/citaciones/:id
 *   - DELETE /api/rrhh/citaciones/:id
 *
 * Auth: cookie httpOnly `session` (se envía con `credentials: 'include'`).
 */

import { Citacion, CitacionParsedPdf } from '../types/citacion';

const BASE = '/api/rrhh/citaciones';

async function parseOrThrow(res: Response) {
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  return res.json();
}

export async function getAll(): Promise<Citacion[]> {
  const res = await fetch(BASE, { credentials: 'include' });
  const data = await parseOrThrow(res);
  return data.citaciones ?? [];
}

export async function create(
  data: Omit<Citacion, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Citacion> {
  const res = await fetch(BASE, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await parseOrThrow(res);
  return json.citacion;
}

export async function update(
  id: string,
  data: Partial<Citacion>,
): Promise<Citacion | null> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (res.status === 404) return null;
  const json = await parseOrThrow(res);
  return json.citacion;
}

export async function remove(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`HTTP ${res.status}`);
  }
}

/** Sube un PDF y devuelve campos parseados para autollenar el formulario. No persiste nada. */
export async function parsePdf(file: File): Promise<CitacionParsedPdf> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${BASE}/parse-pdf`, {
    method: 'POST',
    credentials: 'include',
    body: fd,
  });
  return parseOrThrow(res);
}

/** Adjunta un PDF a una citación existente (BYTEA en DB). */
export async function attachPdf(
  id: string,
  file: File,
): Promise<{ pdfUrl: string; pdfFilename: string }> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}/pdf`, {
    method: 'POST',
    credentials: 'include',
    body: fd,
  });
  return parseOrThrow(res);
}

/** Borra el PDF adjunto de una citación. */
export async function removePdf(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}/pdf`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`HTTP ${res.status}`);
  }
}

/** URL del proxy para visualizar/descargar el PDF adjunto. */
export function pdfDownloadUrl(id: string): string {
  return `${BASE}/${encodeURIComponent(id)}/pdf`;
}
