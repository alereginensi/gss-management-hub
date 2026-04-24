/**
 * api/citaciones.api.ts
 *
 * Capa de API del módulo.
 * Por ahora re-exporta las funciones de storage.ts directamente.
 *
 * PARA INTEGRAR CON BACKEND:
 * Reemplazá el contenido de este archivo con llamadas fetch/axios
 * a tus endpoints reales. El hook useCitaciones.ts importa desde aquí.
 *
 * Ejemplo con fetch:
 *
 *   export async function getAll() {
 *     const res = await fetch('/api/rrhh/citaciones');
 *     return res.json();
 *   }
 *
 *   export async function create(data) {
 *     const res = await fetch('/api/rrhh/citaciones', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify(data),
 *     });
 *     return res.json();
 *   }
 *
 *   export async function update(id, data) {
 *     const res = await fetch(`/api/rrhh/citaciones/${id}`, {
 *       method: 'PUT',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify(data),
 *     });
 *     return res.json();
 *   }
 *
 *   export async function remove(id) {
 *     await fetch(`/api/rrhh/citaciones/${id}`, { method: 'DELETE' });
 *   }
 */

export {
  getAll,
  create,
  update,
  remove,
  parsePdf,
  attachPdf,
  removePdf,
  pdfDownloadUrl,
} from '../utils/storage';
