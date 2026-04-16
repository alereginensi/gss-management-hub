import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { logAudit } from '@/lib/agenda-helpers';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'rrhh', 'supervisor'];

// POST /api/logistica/agenda/appointments/[id]/revert-delivery
// Revierte una entrega completada por error humano (ej: talle equivocado).
// - Marca la cita como 'cancelada' con nota del motivo.
// - Da de baja los artículos creados en esa entrega (current_status='devuelto').
// - Habilita al empleado para re-agendar (enabled=1, allow_reorder=1).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  const appt = await db.get('SELECT * FROM agenda_appointments WHERE id = ?', [id]);
  if (!appt) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });
  if (appt.status !== 'completada') {
    return NextResponse.json({ error: 'Solo se pueden revertir entregas completadas' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const reason = String(body?.reason || '').trim();
    if (!reason) return NextResponse.json({ error: 'Motivo requerido' }, { status: 400 });

    const isPg = (db as any).type === 'pg';
    const nowSql = isPg ? 'NOW()' : "datetime('now')";
    const revertTag = `\n[ENTREGA REVERTIDA ${new Date().toISOString().split('T')[0]} por usuario #${session.user.id}] ${reason}`;

    // 1. Revertir appointment
    await db.run(
      `UPDATE agenda_appointments
         SET status = 'cancelada',
             delivery_notes = COALESCE(delivery_notes, '') || ?,
             updated_at = ${nowSql}
       WHERE id = ?`,
      [revertTag, id]
    );

    // 2. Dar de baja artículos generados por esa entrega
    const articleNote = `Entrega revertida: ${reason}`;
    const updatedArticles = await db.query(
      `UPDATE agenda_articles
         SET current_status = 'devuelto',
             notes = CASE WHEN notes IS NULL OR notes = '' THEN ? ELSE notes || ' | ' || ? END
       WHERE appointment_id = ? AND origin_type = 'entrega_inicial'
       ${isPg ? 'RETURNING id' : ''}`,
      isPg ? [articleNote, articleNote, id] : [articleNote, articleNote, id]
    );

    // 3. Habilitar empleado para re-agendar
    await db.run(
      `UPDATE agenda_employees SET enabled = 1, allow_reorder = 1 WHERE id = ?`,
      [appt.employee_id]
    );

    await logAudit('revert_delivery', 'appointment', id, session.user.id, {
      employee_id: appt.employee_id,
      reason,
      articles_reverted: Array.isArray(updatedArticles) ? updatedArticles.length : undefined,
    });

    return NextResponse.json({ ok: true, appointment_id: id });
  } catch (err) {
    console.error('Error revirtiendo entrega:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
