import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';

async function requireAdmin(request: NextRequest) {
  const session = await getSession(request);
  if (!session || session.user.role !== 'admin') return null;
  return session;
}

function normalizeTurno(raw: string): string {
  return String(raw || '')
    .replace(/^\s*turno\s*/i, '')
    .replace(/\s+a\s+/i, ' A ')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b0+(\d)/g, '$1');
}

function normNombre(s: string): string {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// POST /api/limpieza/admin/puestos/limpiar-duplicados
// form-data: cliente_id, apply ('0' preview / '1' aplicar)
// Normaliza turnos de limpieza_puestos y fusiona duplicados exactos en el mismo
// sector (misma combinación sector_id + turno_norm + nombre_norm). El "ganador"
// es el puesto con lugar_sistema más completo; se borran los demás.
export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const form = await request.formData();
    const clienteIdRaw = form.get('cliente_id');
    const clienteId = clienteIdRaw ? parseInt(String(clienteIdRaw), 10) : null;
    const apply = form.get('apply') === '1';
    if (!clienteId) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 });

    const puestos = await db.query(
      `SELECT p.id, p.sector_id, p.turno, p.nombre, p.cantidad, p.lugar_sistema, p.active, p.orden,
              s.name AS sector_name
       FROM limpieza_puestos p
       JOIN limpieza_sectores s ON s.id = p.sector_id
       WHERE s.cliente_id = ? AND s.active = 1 AND p.active = 1`,
      [clienteId]
    );

    // Agrupar por (sector_id, turno_norm, nombre_norm)
    const groups = new Map<string, any[]>();
    const turnosToRename: { id: number; turno_actual: string; turno_nuevo: string }[] = [];
    for (const p of puestos as any[]) {
      const turnoNorm = normalizeTurno(p.turno);
      if (turnoNorm !== p.turno) {
        turnosToRename.push({ id: p.id, turno_actual: p.turno, turno_nuevo: turnoNorm });
      }
      const key = `${p.sector_id}|${turnoNorm}|${normNombre(p.nombre)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ ...p, turno_norm: turnoNorm });
    }

    const duplicados: any[] = [];
    const toDelete: number[] = [];
    const toKeep: { winner: any; mergedLugarSistema: string | null }[] = [];

    for (const [, items] of groups) {
      if (items.length < 2) continue;
      // Elegir winner: el que tiene lugar_sistema (priorizar no-vacío), luego el menor id
      const sorted = [...items].sort((a, b) => {
        const aLS = a.lugar_sistema ? 1 : 0;
        const bLS = b.lugar_sistema ? 1 : 0;
        if (aLS !== bLS) return bLS - aLS;
        return a.id - b.id;
      });
      const winner = sorted[0];
      // Si el winner no tiene lugar_sistema pero alguno de los otros sí, usar el primero no vacío
      const mergedLS = winner.lugar_sistema || items.find((x: any) => x.lugar_sistema)?.lugar_sistema || null;
      const losers = sorted.slice(1);
      duplicados.push({
        sector: winner.sector_name,
        turno: winner.turno_norm,
        puesto: winner.nombre,
        winner_id: winner.id,
        losers_ids: losers.map((l: any) => l.id),
        merged_lugar_sistema: mergedLS,
      });
      for (const l of losers) toDelete.push(l.id);
      toKeep.push({ winner, mergedLugarSistema: mergedLS });
    }

    if (apply) {
      // 1. Normalizar turnos que difieren de la versión normalizada
      for (const tr of turnosToRename) {
        await db.run('UPDATE limpieza_puestos SET turno = ? WHERE id = ?', [tr.turno_nuevo, tr.id]);
      }
      // 2. Actualizar lugar_sistema del winner si hace falta
      for (const { winner, mergedLugarSistema } of toKeep) {
        if (mergedLugarSistema && winner.lugar_sistema !== mergedLugarSistema) {
          await db.run('UPDATE limpieza_puestos SET lugar_sistema = ? WHERE id = ?', [mergedLugarSistema, winner.id]);
        }
      }
      // 3. Borrar losers
      if (toDelete.length) {
        const placeholders = toDelete.map(() => '?').join(',');
        await db.run(`DELETE FROM limpieza_puestos WHERE id IN (${placeholders})`, toDelete);
      }
    }

    return NextResponse.json({
      ok: true,
      mode: apply ? 'applied' : 'preview',
      turnos_renombrados: turnosToRename,
      duplicados,
      total_turnos_normalizar: turnosToRename.length,
      total_grupos_duplicados: duplicados.length,
      total_borrar: toDelete.length,
    });
  } catch (e: any) {
    console.error('Error limpiar-duplicados:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
